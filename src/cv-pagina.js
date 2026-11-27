// Pagina pubblica di un curriculum condiviso con link (cv.html?t=...).
// Mostra solo ciò che la persona ha scelto. Se il link è stato revocato, non mostra nulla.
import './stile.css'
import './design2026.css'
import { SUPABASE_KEY, SUPABASE_URL } from './config.js'
import { disegnaCV } from './cv-vista.js'

const box = document.querySelector('#cv-contenuto')
const token = new URLSearchParams(location.search).get('t') || ''
const valido = /^[0-9a-f-]{36}$/i.test(token)

async function carica() {
  if (!valido) { box.innerHTML = '<p>Link non valido.</p>'; return }
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/cv_leggi`, {
      method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_token: token }),
    })
    const dati = r.ok ? await r.json() : null
    if (!dati) { box.innerHTML = '<p>Questo curriculum non è più disponibile: il link è stato revocato.</p>'; return }
    box.innerHTML = disegnaCV(dati)
    document.title = `${dati.nome || 'Curriculum'} · JobExpress`
    const b = document.querySelector('[data-stampa]')
    b.hidden = false
    b.onclick = () => window.print()
  } catch {
    box.innerHTML = '<p>Non riesco a caricare il curriculum. Riprova tra poco.</p>'
  }
}
carica()
