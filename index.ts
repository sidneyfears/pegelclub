// PEGELCLUB PUSH - OneSignal Version
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPA_URL     = Deno.env.get('SUPABASE_URL') ?? ''
  const SUPA_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const OS_APP_ID    = Deno.env.get('ONESIGNAL_APP_ID') ?? ''
  const OS_API_KEY   = Deno.env.get('ONESIGNAL_API_KEY') ?? ''

  const db = async (path: string) => {
    const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
    })
    return r.json()
  }

  try {
    const { type, payload, sender_id } = await req.json()

    // Get target user IDs
    let targetIds: string[] = []
    if (type === 'payment' && payload?.target_user_id) {
      targetIds = [payload.target_user_id]
    } else {
      const members = await db(`profiles?role=in.(mitglied,admin)&id=neq.${sender_id}&select=id`)
      targetIds = Array.isArray(members) ? members.map((m: any) => m.id) : []
    }

    if (!targetIds.length) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Build notification title and body
    const p = payload || {}
    const messages: Record<string, { title: string, body: string }> = {
      chat:    { title: '💬 Neue Nachricht',  body: `${p.sender || 'Jemand'}: ${p.text || ''}` },
      event:   { title: '⚡ Neues Event',      body: `${p.sender || 'Jemand'} hat "${p.name || ''}" erstellt` },
      expense: { title: '💳 Neue Ausgabe',     body: `${p.sender || 'Jemand'} hat eine Ausgabe eingetragen` },
      poll:    { title: '🗳️ Neue Abstimmung',  body: `${p.sender || 'Jemand'}: "${p.question || ''}"` },
      trip:    { title: '🗺️ Neuer Trip',       body: `${p.sender || 'Jemand'} hat einen Trip erstellt` },
      payment: { title: '💸 Zahlung',          body: p.role === 'debtor' ? `${p.sender || 'Jemand'} hat gezahlt` : `${p.sender || 'Jemand'} hat empfangen` },
    }
    const msg = messages[type] || { title: '🍻 Pegelclub', body: 'Neue Aktivität!' }

    // Send via OneSignal REST API
    // Use external_id (= our Supabase user IDs) to target specific users
    const osPayload = {
      app_id: OS_APP_ID,
      include_aliases: { external_id: targetIds },
      target_channel: 'push',
      headings: { en: msg.title, de: msg.title },
      contents: { en: msg.body, de: msg.body },
      url: 'https://sidneyfears.github.io',
    }

    const osRes = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${OS_API_KEY}`,
      },
      body: JSON.stringify(osPayload),
    })

    const osData = await osRes.json()
    console.log('OneSignal response:', JSON.stringify(osData))

    return new Response(
      JSON.stringify({ sent: osData.recipients || 0, id: osData.id, errors: osData.errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (e) {
    console.error('Error:', (e as Error).message)
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
