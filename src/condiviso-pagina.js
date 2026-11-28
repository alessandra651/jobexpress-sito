// Pagina aperta da una persona di fiducia (incarico-condiviso.html?t=...).
// Mostra solo: chi, cosa, per chi, zona (indirizzo solo se scelto), orari. Nessuna posizione GPS.
// Se il link è scaduto o revocato non mostra nulla.
import './stile.css'
import './design2026.css'
import { SUPABASE_KEY, SUPABASE_URL } from './config.js'

const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const quando = (t) => new Date(t).toLocaleString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
const ora = (t) => new Date(t).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
const box = document.querySelector('#condiviso')
const token = new URLSearchParams(location.search).get('t') || ''

async function carica() {
  if (!/^[0-9a-f-]{36}$/i.test(token)) { box.innerHTML = '<h1>Link non valido</h1>'; return }
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/leggi_condivisione`, {
      method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_token: token }),
    })
    const d = r.ok ? await r.json() : null
    if (!d) { box.innerHTML = '<h1>Link non più attivo</h1><p>Questo link è scaduto oppure è stato revocato da chi l’ha condiviso.</p>'; return }
    const adesso = Date.now()
    const turni = d.turni || []
    const inCorso = turni.some((t) => new Date(t.inizio) <= adesso && new Date(t.fine) > adesso)
    const finito = turni.length && new Date(turni[turni.length - 1].fine) <= adesso
    box.innerHTML = `<section class="condiviso-scheda">
      <p class="dettaglio__cat">Condiviso con te tramite JobExpress Safe</p>
      <h1>${esc(d.persona)} lavora come ${esc(d.mansione)}</h1>
      <p class="condiviso-stato">${d.stato === 'annullato' ? 'L’incarico è stato annullato.' : inCorso ? 'In questo momento è nell’orario di lavoro.' : finito ? 'L’orario di lavoro è terminato.' : 'L’incarico non è ancora iniziato.'}</p>
      <ul class="trust-righe">
        <li><span>Per</span><strong>${esc(d.committente)}</strong></li>
        <li><span>Dove</span><strong>${d.indirizzo ? `${esc(d.indirizzo)}, ` : ''}${d.zona ? `${esc(d.zona)}, ` : ''}${esc(d.citta)}</strong></li>
        ${turni.map((t) => `<li><span>Quando</span><strong>${quando(t.inizio)} – ${ora(t.fine)}</strong></li>`).join('')}
      </ul>
      <p class="finestra__nota">${d.indirizzo ? '' : 'Per scelta di chi l’ha condiviso è indicata solo la zona. '}Questa pagina non mostra la posizione in tempo reale: JobExpress non usa il GPS. Il link si spegne da solo il ${quando(d.scade_il)}.</p>
      <div class="safe-112"><div><strong>Pensi che sia in pericolo?</strong><p>Prova a contattarla direttamente. In caso di emergenza chiama il numero unico.</p></div><a class="tasto tasto--pericolo" href="tel:112">Chiama il 112</a></div>
    </section>`
  } catch {
    box.innerHTML = '<p>Non riesco a caricare la pagina. Riprova tra poco.</p>'
  }
}
carica()
