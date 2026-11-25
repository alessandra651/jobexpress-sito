// Area Admin del fondatore.
// Accesso: con un account vero, Supabase controlla che tu sia nella tabella
// "amministratori" (conoscere l'indirizzo della pagina non basta).
// Con l'account di prova si vede un'area Admin di prova, solo con i dati di
// questo dispositivo.
import { SUPABASE_KEY, SUPABASE_URL } from './config.js'
import { NOME_CAT, tuttiIncarichi } from './incarichi.js'
import { moderaAnnuncio, tuttiIMieiAnnunci } from './annunci.js'
import { aggiornaSegnalazione, segnalazioni } from './segnalazioni.js'
import { leggiCand } from './lavori.js'
import { pianoAttivo } from './abbonamenti.js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const CHIAVE_LOG = 'jobexpress-registro-admin'
let s = {} // strumenti: utente, token
let pannello = null
let stato = { reale: null, statistiche: null, errore: '' }

async function rpc(nome, corpo = {}) {
  const token = await s.token()
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(15000),
  })
  if (!r.ok) throw new Error(String(r.status))
  const t = await r.text()
  return t ? JSON.parse(t) : null
}

// Può vedere il pulsante "Area Admin"?
export async function puoAmministrare() {
  const u = s.utente?.()
  if (!u) return false
  if (u.prova) return true
  try { return (await rpc('sono_admin')) === true } catch { return false }
}

function registra(azione, dettagli) {
  let l = []
  try { l = JSON.parse(localStorage.getItem(CHIAVE_LOG) || '[]') } catch { /* vuoto */ }
  l.unshift({ azione, dettagli, il: Date.now() })
  try { localStorage.setItem(CHIAVE_LOG, JSON.stringify(l.slice(0, 100))) } catch { /* non disponibile */ }
  if (stato.reale) rpc('admin_registra', { azione, dettagli }).catch(() => {})
}
const registro = () => { try { return JSON.parse(localStorage.getItem(CHIAVE_LOG) || '[]') } catch { return [] } }

function numeri() {
  const annunci = tuttiIMieiAnnunci()
  const cand = leggiCand()
  const tutti = tuttiIncarichi()
  const perCat = {}
  tutti.forEach((a) => { perCat[a.cat] = (perCat[a.cat] || 0) + 1 })
  const perCitta = {}
  tutti.forEach((a) => { perCitta[a.citta] = (perCitta[a.citta] || 0) + 1 })
  return {
    annunci: tutti.length,
    attivi: annunci.filter((a) => a.stato === 'attivo').length + tutti.filter((a) => !a.mio).length,
    revisione: annunci.filter((a) => a.stato === 'revisione'),
    candidature: cand.length,
    confermati: cand.filter((c) => ['confermato', 'completato'].includes(c.stato)).length,
    completati: cand.filter((c) => c.stato === 'completato').length,
    annullati: cand.filter((c) => ['annullato', 'rifiutata'].includes(c.stato)).length,
    perCat: Object.entries(perCat).sort((a, b) => b[1] - a[1]).slice(0, 6),
    perCitta: Object.entries(perCitta).sort((a, b) => b[1] - a[1]),
    piano: pianoAttivo(),
  }
}

const barre = (righe, nome) => {
  const max = Math.max(1, ...righe.map(([, v]) => v))
  return `<ul class="percat">${righe.map(([k, v]) => `<li><span>${esc(nome(k))}</span><span class="percat__barra"><i style="width:${(v / max) * 100}%"></i></span><strong>${v}</strong></li>`).join('')}</ul>`
}

function disegna() {
  const n = numeri()
  const seg = segnalazioni()
  const aperte = seg.filter((x) => x.stato === 'aperta')
  const st = stato.statistiche
  pannello.innerHTML = `
    <div class="area__interno">
      <header class="area__testa">
        <div><p class="area__data">Area riservata</p><h2>Admin JobExpress</h2>
          ${stato.reale ? '<p class="finestra__nota">Accesso verificato da Supabase.</p>' : '<p class="avviso-prova">Admin di prova: vedi solo i dati di questo dispositivo. Con il tuo account vero, Supabase controlla che tu sia amministratore.</p>'}</div>
        <button type="button" class="tasto tasto--chiaro" data-admin-chiudi>Chiudi</button>
      </header>

      <section class="admin__blocco">
        <h3>Utenti registrati ${stato.reale ? '<span class="stato">dati reali</span>' : ''}</h3>
        ${st ? `<ul class="stat stat--sei">
            <li><strong>${st.utenti}</strong><span>Utenti</span></li><li><strong>${st.nuovi_7_giorni}</strong><span>Nuovi in 7 giorni</span></li>
            <li><strong>${st.lavoratori}</strong><span>Lavoratori</span></li><li><strong>${st.aziende}</strong><span>Aziende</span></li>
            <li><strong>${st.privati}</strong><span>Privati</span></li><li><strong>${st.interesse_lavoratori + st.interesse_attivita + st.interesse_partner}</strong><span>Contatti dal vecchio modulo</span></li></ul>
            ${st.citta.length ? `<h4>Distribuzione per città</h4>${barre(st.citta.map((c) => [c.citta, c.utenti]), (k) => k)}` : ''}`
          : `<p>${stato.errore || 'I numeri reali degli utenti arrivano da Supabase quando entri con il tuo account da amministratore.'}</p>`}
      </section>

      <section class="admin__blocco">
        <h3>Piattaforma <span class="etichetta-esempio">dati dimostrativi</span></h3>
        <ul class="stat stat--sei">
          <li><strong>${n.annunci}</strong><span>Annunci in bacheca</span></li><li><strong>${n.candidature}</strong><span>Candidature</span></li>
          <li><strong>${n.confermati}</strong><span>Incarichi confermati</span></li><li><strong>${n.completati}</strong><span>Completati</span></li>
          <li><strong>${n.annullati}</strong><span>Annullati o rifiutati</span></li><li><strong>${aperte.length}</strong><span>Segnalazioni aperte</span></li>
        </ul>
        <div class="admin__due">
          <div><h4>Categorie più usate</h4>${barre(n.perCat, (k) => NOME_CAT[k] || k)}</div>
          <div><h4>Annunci per città</h4>${barre(n.perCitta, (k) => k)}</div>
        </div>
        <p class="finestra__nota">Abbonamenti e ricavi: nessun pagamento reale è attivo. Piano su questo dispositivo: ${esc(n.piano)}.</p>
      </section>

      <section class="admin__blocco">
        <h3>Annunci da rivedere (${n.revisione.length})</h3>
        ${n.revisione.length ? `<ul class="candidature">${n.revisione.map((a) => `<li class="candidatura"><div><strong>${esc(a.titolo)}</strong><p>${esc(NOME_CAT[a.cat])} · ${esc(a.citta)} · ${esc(a.chi)}</p><p>${esc(a.descrizione)}</p></div>
          <div class="pa-azioni-riga"><button type="button" class="tasto" data-admin-annuncio="${esc(a.id)}" data-ok="1">Approva</button><button type="button" class="tasto tasto--chiaro" data-admin-annuncio="${esc(a.id)}" data-ok="0">Rifiuta</button></div></li>`).join('')}</ul>`
          : '<p>Nessun annuncio in attesa. Qui arrivano le categorie che richiedono una verifica, come l’assistenza alla persona.</p>'}
      </section>

      <section class="admin__blocco">
        <h3>Segnalazioni (${aperte.length} aperte)</h3>
        ${seg.length ? `<ul class="candidature">${seg.map((x) => `<li class="candidatura"><div><strong>${esc(x.titolo)}</strong><p>${esc({ annuncio: 'Annuncio', persona: 'Persona', recensione: 'Recensione' }[x.tipo] || x.tipo)} · ${esc(x.motivo)} · ${new Date(x.il).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p></div>
          <div class="candidatura__lato"><span class="stato stato--${x.stato === 'aperta' ? 'revisione' : 'chiuso'}">${{ aperta: 'Aperta', risolta: 'Risolta', archiviata: 'Archiviata' }[x.stato]}</span></div>
          ${x.stato === 'aperta' ? `<div class="pa-azioni-riga"><button type="button" class="tasto" data-admin-seg="${x.id}" data-esito="risolta">Risolta</button><button type="button" class="tasto tasto--chiaro" data-admin-seg="${x.id}" data-esito="archiviata">Archivia</button></div>` : ''}</li>`).join('')}</ul>`
          : '<p>Nessuna segnalazione.</p>'}
        <p class="finestra__nota">Le chat private non si leggono da qui: per una segnalazione si vede solo ciò che è stato segnalato.</p>
      </section>

      <section class="admin__blocco">
        <h3>Registro delle azioni</h3>
        ${registro().length ? `<ul class="admin__registro">${registro().slice(0, 15).map((r) => `<li><span>${new Date(r.il).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>${esc(r.azione)}</li>`).join('')}</ul>` : '<p>Nessuna azione registrata.</p>'}
        <button type="button" class="tasto tasto--chiaro" data-admin-report>Copia il report aggregato (CSV)</button>
        <p class="finestra__nota" data-admin-msg role="status"></p>
      </section>
    </div>`
}

export async function apriAdmin() {
  const u = s.utente()
  if (!u) return
  pannello.hidden = false
  document.documentElement.classList.add('area-aperta')
  stato = { reale: false, statistiche: null, errore: '' }
  if (!u.prova) {
    pannello.innerHTML = '<div class="area__interno"><p>Controllo l’accesso…</p></div>'
    try {
      if ((await rpc('sono_admin')) !== true) {
        pannello.innerHTML = `<div class="area__interno"><h2>Accesso riservato</h2><p>Questa area è solo per gli amministratori di JobExpress.</p><button type="button" class="tasto" data-admin-chiudi>Torna indietro</button></div>`
        return
      }
      stato.reale = true
      stato.statistiche = await rpc('admin_statistiche')
    } catch {
      stato.errore = 'Non riesco a collegarmi a Supabase per i numeri reali.'
    }
  }
  disegna()
}

function chiudi() {
  pannello.hidden = true
  if (document.querySelector('#area')?.hidden !== false) document.documentElement.classList.remove('area-aperta')
}

export function avviaAdmin(strumenti) {
  s = strumenti
  pannello = document.createElement('div')
  pannello.className = 'area admin'
  pannello.hidden = true
  pannello.setAttribute('role', 'region')
  pannello.setAttribute('aria-label', 'Area Admin')
  document.body.appendChild(pannello)
  pannello.addEventListener('click', (e) => {
    const t = e.target
    if (t.closest('[data-admin-chiudi]')) return chiudi()
    const an = t.closest('[data-admin-annuncio]')
    if (an) {
      const a = moderaAnnuncio(an.dataset.adminAnnuncio, an.dataset.ok === '1')
      if (a) registra(`${an.dataset.ok === '1' ? 'Approvato' : 'Rifiutato'} annuncio «${a.titolo}»`, { annuncio: a.id })
      return disegna()
    }
    const sg = t.closest('[data-admin-seg]')
    if (sg) {
      const x = aggiornaSegnalazione(sg.dataset.adminSeg, sg.dataset.esito)
      if (x) registra(`Segnalazione ${sg.dataset.esito}: ${x.titolo}`, { segnalazione: x.id })
      return disegna()
    }
    if (t.closest('[data-admin-report]')) {
      const n = numeri()
      const righe = [['voce', 'valore'], ['annunci', n.annunci], ['candidature', n.candidature], ['confermati', n.confermati], ['completati', n.completati], ['annullati', n.annullati], ['segnalazioni', segnalazioni().length],
        ...n.perCat.map(([k, v]) => [`categoria ${NOME_CAT[k] || k}`, v]), ...(stato.statistiche ? [['utenti', stato.statistiche.utenti], ['nuovi 7 giorni', stato.statistiche.nuovi_7_giorni]] : [])]
      const csv = righe.map((r) => r.join(';')).join('\n')
      const m = pannello.querySelector('[data-admin-msg]')
      navigator.clipboard?.writeText(csv).then(() => { m.textContent = 'Report copiato.' }, () => { m.textContent = csv })
      registra('Esportato report aggregato', {})
    }
  })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pannello.hidden && !document.querySelector('dialog.finestra')?.open) chiudi() })
}
