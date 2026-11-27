// JobExpress AI — funzione server sicura.
// * La chiave del provider AI resta qui (segreto ANTHROPIC_API_KEY): mai nel sito.
// * Il contatore delle richieste si aggiorna solo da qui (ai_riserva), non dal browser.
// * Se il provider fallisce, la richiesta viene restituita (ai_restituisci).
// * Limiti di lunghezza su domanda e risposta, per controllare costi e abusi.
// * L'assistente non decide chi assumere, non cambia badge o reputazione, non inventa esperienze.
//
// Per attivarla: Supabase → Edge Functions → Secrets → ANTHROPIC_API_KEY = (la tua chiave)
// e nell'area Admin accendere «Funzione attiva: JobExpress AI».

const URL_DB = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVIZIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CHIAVE_AI = Deno.env.get('ANTHROPIC_API_KEY')
const MODELLO = Deno.env.get('JOBEXPRESS_AI_MODELLO') || 'claude-haiku-5-5'
const MAX_DOMANDA = 1000
const MAX_CONTESTO = 1500
const MAX_RISPOSTA_TOKEN = 700
// Stima dei costi (euro per milione di token), da aggiornare con il listino del provider
const EUR_IN = Number(Deno.env.get('JOBEXPRESS_AI_EUR_IN') || '1')
const EUR_OUT = Number(Deno.env.get('JOBEXPRESS_AI_EUR_OUT') || '5')

const AREE: Record<string, string> = {
  colloqui: 'preparazione ai colloqui (simulazioni, domande per mansione, feedback sulla presentazione, primi incarichi)',
  curriculum: 'miglioramento del curriculum (revisione dei testi, descrizioni delle esperienze, competenze da valorizzare, presentazione)',
  mansioni: 'preparazione alle mansioni (responsabilità principali, primo giorno, comunicazione professionale, situazioni comuni)',
  crescita: 'crescita professionale (analisi delle esperienze, competenze da sviluppare, obiettivi, possibili percorsi)',
  economia: 'organizzazione economica e del tempo (obiettivi di guadagno, ore lavorate, organizzazione del tempo)',
  altro: 'domande sul lavoro e sulla crescita professionale',
}

const SISTEMA = (area: string) => `Sei JobExpress AI, l'assistente professionale di JobExpress, piattaforma italiana di lavoro last minute per giovani e studenti.
Ambito di questa conversazione: ${AREE[area] || AREE.altro}.
Regole:
- Rispondi in italiano, in modo semplice, pratico e incoraggiante. Massimo 250 parole, con elenchi brevi quando servono.
- Non inventare MAI esperienze, titoli, qualifiche o certificazioni: usa solo ciò che la persona ti dice o che è nel contesto fornito.
- I consigli sulle mansioni non sostituiscono la formazione obbligatoria, le abilitazioni o le indicazioni del datore di lavoro: dillo quando è rilevante.
- Non decidi chi assumere, non valuti o modifichi badge, recensioni o reputazione, non dai penalità.
- Le stime economiche sono indicative, mai guadagni garantiti. Non dai consulenza legale o fiscale: suggerisci un professionista se serve.
- Resta sul tema lavoro e crescita professionale; se la domanda è fuori tema, riportala gentilmente sul percorso professionale.`

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const risposta = (corpo: unknown, stato = 200) => new Response(JSON.stringify(corpo), { status: stato, headers: { ...CORS, 'Content-Type': 'application/json' } })

async function rpc(nome: string, corpo: unknown) {
  const r = await fetch(`${URL_DB}/rest/v1/rpc/${nome}`, {
    method: 'POST', headers: { apikey: SERVIZIO, Authorization: `Bearer ${SERVIZIO}`, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  })
  if (!r.ok) throw new Error(`rpc ${nome} ${r.status}`)
  const t = await r.text()
  return t ? JSON.parse(t) : null
}

async function tabella(metodo: string, percorso: string, corpo?: unknown) {
  const r = await fetch(`${URL_DB}/rest/v1/${percorso}`, {
    method: metodo,
    headers: { apikey: SERVIZIO, Authorization: `Bearer ${SERVIZIO}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  if (!r.ok) throw new Error(`db ${r.status}`)
  return r.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return risposta({ errore: 'metodo' }, 405)

  // 1. Chi sei (token della sessione)
  const auth = req.headers.get('Authorization') || ''
  const u = await fetch(`${URL_DB}/auth/v1/user`, { headers: { apikey: ANON, Authorization: auth } })
  if (!u.ok) return risposta({ errore: 'accesso' }, 401)
  const utente = await u.json()

  // 2. Controllo dell'input
  let dati: { area?: string; testo?: string; conversazione_id?: string; contesto?: string }
  try { dati = await req.json() } catch { return risposta({ errore: 'input' }, 400) }
  const area = AREE[dati.area || ''] ? dati.area! : 'altro'
  const testo = String(dati.testo || '').trim()
  if (!testo) return risposta({ errore: 'vuota' }, 400)
  if (testo.length > MAX_DOMANDA) return risposta({ errore: 'troppo_lunga', max: MAX_DOMANDA }, 400)
  const contesto = String(dati.contesto || '').slice(0, MAX_CONTESTO)
  const idConv = /^[0-9a-f-]{36}$/i.test(dati.conversazione_id || '') ? dati.conversazione_id : null

  // 3. Servizio configurato?
  if (!CHIAVE_AI) return risposta({ errore: 'non_configurato' }, 503)

  // 4. Prenota una richiesta (limite mensile, solo lato server)
  const prenota = await rpc('ai_riserva', { p_user: utente.id })
  if (!prenota?.ok) return risposta({ errore: prenota?.motivo || 'limite', ...prenota }, 403)

  try {
    // 5. Conversazione precedente (solo la tua)
    let storico: { ruolo: string; testo: string }[] = []
    if (idConv) {
      const righe = await tabella('GET', `ai_conversazioni?id=eq.${idConv}&user_id=eq.${utente.id}&select=messaggi`)
      storico = (righe[0]?.messaggi || []).slice(-10)
    }
    const messaggi = [
      ...storico.map((m) => ({ role: m.ruolo === 'ai' ? 'assistant' : 'user', content: m.testo })),
      { role: 'user', content: contesto ? `Contesto professionale condiviso dalla persona (con il suo consenso):\n${contesto}\n\nDomanda: ${testo}` : testo },
    ]

    // 6. Chiamata al provider
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': CHIAVE_AI, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODELLO, max_tokens: MAX_RISPOSTA_TOKEN, system: SISTEMA(area), messages: messaggi }),
      signal: AbortSignal.timeout(40000),
    })
    if (!r.ok) throw new Error(`provider ${r.status}`)
    const out = await r.json()
    const testoAi = (out.content || []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('\n').trim()
    if (!testoAi) throw new Error('vuota')
    const costo = ((out.usage?.input_tokens || 0) * EUR_IN + (out.usage?.output_tokens || 0) * EUR_OUT) / 1e6
    await rpc('ai_registra_costo', { p_user: utente.id, p_eur: costo }).catch(() => {})

    // 7. Salva la conversazione
    const nuovi = [...storico, { ruolo: 'tu', testo, il: new Date().toISOString() }, { ruolo: 'ai', testo: testoAi, il: new Date().toISOString() }]
    let id = idConv
    if (id) await tabella('PATCH', `ai_conversazioni?id=eq.${id}&user_id=eq.${utente.id}`, { messaggi: nuovi, aggiornato_il: new Date().toISOString() })
    else id = (await tabella('POST', 'ai_conversazioni', { user_id: utente.id, area, titolo: testo.slice(0, 80), messaggi: nuovi }))[0].id

    return risposta({ risposta: testoAi, conversazione_id: id, usate: prenota.usate, limite: prenota.limite })
  } catch (_e) {
    // Errore tecnico: la richiesta non si conta
    await rpc('ai_restituisci', { p_user: utente.id }).catch(() => {})
    return risposta({ errore: 'servizio' }, 502)
  }
})
