// Centro notifiche: avvisi dentro il sito, con le preferenze di chi li riceve.
// In questa versione di prova restano su questo dispositivo.
// Email e notifiche push si potranno aggiungere quando il sito sarà online.

const CHIAVE = 'jobexpress-notifiche'
const CHIAVE_PREF = 'jobexpress-notifiche-pref'
export const TIPI = {
  candidatura: 'Le tue candidature',
  ricevuta: 'Candidature ricevute',
  messaggio: 'Nuovi messaggi',
  selezione: 'Selezioni e conferme',
  disponibilita: 'Disponibilità in scadenza',
  annuncio: 'I tuoi annunci',
  recensione: 'Recensioni',
  ricerca: 'Ricerche salvate',
  abbonamento: 'Abbonamento e Friends',
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const leggi = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d } catch { return d } }
const scrivi = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* non disponibile */ } }

let lista = leggi(CHIAVE, [])
let pref = { ...Object.fromEntries(Object.keys(TIPI).map((k) => [k, true])), ...leggi(CHIAVE_PREF, {}) }
const ascoltatori = []
export const quandoCambianoNotifiche = (f) => ascoltatori.push(f)
const avvisa = () => ascoltatori.forEach((f) => f())

// Aggiunge una notifica (se quel tipo non è stato spento). "vai" dice dove porta il tocco.
export function notifica(tipo, testo, vai = null) {
  if (!pref[tipo]) return
  lista.unshift({ id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, tipo, testo, vai, il: Date.now(), letta: false })
  lista = lista.slice(0, 50)
  scrivi(CHIAVE, lista)
  avvisa()
}

export const nonLette = () => lista.filter((n) => !n.letta).length

const quando = (t) => {
  const min = Math.round((Date.now() - t) / 6e4)
  if (min < 1) return 'adesso'
  if (min < 60) return `${min} min fa`
  if (min < 1440) return `${Math.round(min / 60)} h fa`
  return new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

export function pannelloNotifiche() {
  return `
    <div class="notif">
      <div class="riquadro__testa"><h3 class="notif__titolo">Notifiche</h3>
        ${lista.some((n) => !n.letta) ? '<button type="button" class="tasto tasto--chiaro" data-notif="tutte">Segna tutte come lette</button>' : ''}</div>
      ${lista.length ? `<ul class="notif__lista">${lista.map((n) => `
        <li><button type="button" class="notif__voce${n.letta ? '' : ' nuova'}" data-notif-apri="${n.id}">
          <span class="notif__punto" aria-hidden="true"></span>
          <span><strong>${esc(TIPI[n.tipo] || 'Avviso')}</strong>${esc(n.testo)}<small>${quando(n.il)}${n.letta ? '' : ' · nuova'}</small></span>
        </button></li>`).join('')}</ul>`
        : '<div class="vuoto"><strong>Nessuna notifica.</strong><p>Qui trovi candidature, messaggi e promemoria.</p></div>'}
      <details class="notif__pref">
        <summary>Quali notifiche vuoi ricevere</summary>
        ${Object.entries(TIPI).map(([k, t]) => `<label class="interruttore"><input type="checkbox" data-notif-pref="${k}" ${pref[k] ? 'checked' : ''}/> ${t}</label>`).join('')}
        <p class="finestra__nota">Per ora le notifiche arrivano solo qui. Email e notifiche push si attivano quando il sito sarà online, e solo se lo vorrai.</p>
      </details>
    </div>`
}

// Restituisce: false se l'evento non è delle notifiche, true per ridisegnare,
// oppure l'oggetto "vai" della notifica toccata
export function gestisciNotifiche(e) {
  const t = e.target
  if (e.type === 'change' && t.matches('[data-notif-pref]')) {
    pref[t.dataset.notifPref] = t.checked
    scrivi(CHIAVE_PREF, pref)
    return true
  }
  if (e.type !== 'click') return false
  if (t.closest('[data-notif="tutte"]')) {
    lista.forEach((n) => { n.letta = true })
    scrivi(CHIAVE, lista)
    avvisa()
    return true
  }
  const v = t.closest('[data-notif-apri]')
  if (v) {
    const n = lista.find((x) => x.id === v.dataset.notifApri)
    if (!n) return false
    n.letta = true
    scrivi(CHIAVE, lista)
    avvisa()
    return n.vai || true
  }
  return false
}
