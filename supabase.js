import { SUPABASE_KEY, SUPABASE_URL } from './config.js'

export class NonCollegato extends Error {}

// Inserimento diretto via API REST: niente SDK, nessun cookie.
export async function inserisci(tabella, riga) {
  if (!SUPABASE_KEY) throw new NonCollegato('Chiave Supabase mancante')
  const risposta = await fetch(`${SUPABASE_URL}/rest/v1/${tabella}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(riga),
    signal: AbortSignal.timeout(15000),
  })
  if (!risposta.ok) throw new Error(`Supabase ${risposta.status}: ${await risposta.text()}`)
}
