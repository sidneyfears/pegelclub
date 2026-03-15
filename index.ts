// supabase/functions/send-push/index.ts
// Supabase Edge Function – sendet Web Push Benachrichtigungen

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Web Push via VAPID
const webpush = await import('https://esm.sh/web-push@3.6.6')

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_EMAIL       = Deno.env.get('VAPID_EMAIL')!   // z.B. mailto:du@email.de

webpush.default.setVapidDetails(
  VAPID_EMAIL,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  const { type, payload, sender_id } = await req.json()

  // Bestimme welche Nutzer benachrichtigt werden sollen
  let targetUserIds: string[] = []

  if (type === 'payment') {
    // Nur den Empfänger (Gegenseite) benachrichtigen
    if (payload.target_user_id) {
      targetUserIds = [payload.target_user_id]
    }
  } else {
    // Alle anderen Nutzer außer dem Sender
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .neq('id', sender_id)
      .eq('role', 'mitglied')  // Nur Mitglieder + Admins

    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .neq('id', sender_id)
      .eq('role', 'admin')

    const allTargets = [...(profiles || []), ...(admins || [])]
    targetUserIds = allTargets.map(p => p.id)
  }

  if (!targetUserIds.length) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  }

  // Lade Push-Subscriptions der Zielnutzer
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription, user_id')
    .in('user_id', targetUserIds)

  if (!subs || !subs.length) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  }

  // Sende Push an jeden Nutzer
  let sent = 0
  for (const row of subs) {
    try {
      const sub = JSON.parse(row.subscription)
      await webpush.default.sendNotification(sub, JSON.stringify({ type, payload }))
      sent++
    } catch(e) {
      console.error('Push failed for user', row.user_id, e.message)
      // Wenn Subscription abgelaufen ist → löschen
      if (e.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('user_id', row.user_id)
      }
    }
  }

  return new Response(JSON.stringify({ sent }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
})
