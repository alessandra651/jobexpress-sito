// Abbonamenti Free / Plus / Friends.
// Pagamento SIMULATO: nessun addebito reale. Il pagamento vero passerà da Stripe
// (prima in modalità test) solo dopo la verifica legale del modello.
// Gli abbonamenti danno strumenti di organizzazione e statistiche:
// mai più visibilità o priorità nelle candidature.
import { notifica } from './notifiche.js'

const CHIAVE = 'jobexpress-abbonamento'
export const PREZZI = { plus: { mese: 4.99, anno: 39.99 }, friends: { mese: 9.99, anno: 79.99 } }
const NOMI = { free: 'Free', plus: 'Plus', friends: 'Friends' }
const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const data = (t) => new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
const leggi = () => { try { return JSON.parse(localStorage.getItem(CHIAVE) || 'null') } catch { return null } }
let ab = leggi()
const salva = () => { try { localStorage.setItem(CHIAVE, JSON.stringify(ab)) } catch { /* non disponibile */ } }

let s = {} // strumenti: apri, utente, apriAccesso, dopo
const ascoltatori = []
export const quandoCambiaAbbonamento = (f) => ascoltatori.push(f)
const avvisa = () => ascoltatori.forEach((f) => f())

// Il piano che conta adesso (una disdetta vale fino alla data di rinnovo)
export function pianoAttivo() {
  if (!ab || ab.piano === 'free') return 'free'
  if (ab.stato === 'disdetto' && Date.now() > ab.rinnovo) return 'free'
  return ab.piano
}
export const haPlus = () => pianoAttivo() !== 'free'

function rinnovoDa(periodo, da = Date.now()) {
  const d = new Date(da)
  periodo === 'anno' ? d.setFullYear(d.getFullYear() + 1) : d.setMonth(d.getMonth() + 1)
  return d.getTime()
}
const codice = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('')

function riepilogo(piano, periodo) {
  const p = PREZZI[piano][periodo]
  const mensile = periodo === 'anno' ? p / 12 : p
  const righe = [`<dt>Piano</dt><dd>${NOMI[piano]}${piano === 'friends' ? ' · 3 account indipendenti' : ''}</dd>`,
    `<dt>Addebito oggi</dt><dd><strong>${euro.format(p)}</strong> ${periodo === 'anno' ? 'per un anno' : 'per un mese'}</dd>`,
    `<dt>Rinnovo</dt><dd>${data(rinnovoDa(periodo))}, stesso importo. Disdici quando vuoi.</dd>`]
  if (periodo === 'anno') righe.push(`<dt>Equivale a</dt><dd>${euro.format(mensile)} al mese · risparmi ${euro.format(PREZZI[piano].mese * 12 - p)} rispetto al mensile</dd>`)
  if (piano === 'friends') righe.push(`<dt>A persona</dt><dd>${euro.format(mensile / 3)} al mese, se siete in tre</dd>`)
  return `<dl class="dettaglio__info">${righe.join('')}</dl>`
}

export function apriCheckout(piano, periodo = 'mese') {
  if (!s.utente()) return s.apriAccesso(piano === 'friends' ? 'Per attivare Friends, registrati o accedi' : 'Per passare a Plus, registrati o accedi')
  s.apri(`
    <p class="dettaglio__cat">Abbonamento ${NOMI[piano]}</p>
    <h2>${piano === 'friends' ? 'In tre conviene di più' : 'Organizza meglio il tuo tempo'}</h2>
    <div class="scelta scelta--vista2" role="group" aria-label="Periodo">
      <button type="button" data-ck-periodo="mese" aria-pressed="${periodo === 'mese'}">Mensile</button>
      <button type="button" data-ck-periodo="anno" aria-pressed="${periodo === 'anno'}">Annuale <span class="risparmio">−33%</span></button>
    </div>
    <div data-ck-riepilogo>${riepilogo(piano, periodo)}</div>
    <p class="avviso-prova"><strong>Pagamento di prova.</strong> Non ti viene chiesta nessuna carta e non paghi niente. Il pagamento vero sarà attivato con Stripe solo dopo la verifica legale.</p>
    <label class="spunta"><input type="checkbox" data-ck-ok /> Ho letto le condizioni dell’abbonamento (bozza da completare)</label>
    <p class="conto-form__errore" data-ck-errore role="alert"></p>
    <div class="finestra__azioni"><button type="button" class="tasto" data-ck-conferma>Attiva ${NOMI[piano]} (prova)</button></div>`)
  const f = document.querySelector('dialog.finestra')
  let per = periodo
  f.querySelectorAll('[data-ck-periodo]').forEach((b) => (b.onclick = () => {
    per = b.dataset.ckPeriodo
    f.querySelectorAll('[data-ck-periodo]').forEach((x) => x.setAttribute('aria-pressed', x === b))
    f.querySelector('[data-ck-riepilogo]').innerHTML = riepilogo(piano, per)
  }))
  f.querySelector('[data-ck-conferma]').onclick = () => {
    if (!f.querySelector('[data-ck-ok]').checked) { f.querySelector('[data-ck-errore]').textContent = 'Spunta la casella per continuare.'; return }
    const ora = Date.now()
    const ricevute = ab?.ricevute || []
    ricevute.unshift({ il: ora, descr: `${NOMI[piano]} ${per === 'anno' ? 'annuale' : 'mensile'} (prova)`, importo: PREZZI[piano][per] })
    const gruppo = piano === 'friends' ? (ab?.gruppo || { codice: codice(), inviti: [] }) : ab?.gruppo
    ab = { piano, periodo: per, dal: ora, rinnovo: rinnovoDa(per, ora), stato: 'attivo', ricevute, gruppo }
    salva()
    notifica('abbonamento', `${NOMI[piano]} attivo fino al ${data(ab.rinnovo)} (prova, nessun addebito).`, { scheda: 'profilo' })
    avvisa()
    s.apri(`<h2>${NOMI[piano]} è attivo</h2><p>Si rinnova il ${data(ab.rinnovo)}. Lo gestisci da «La mia area» → Profilo.</p>
      ${piano === 'friends' ? '<p>Ora invita due amici: ognuno avrà il suo account, i suoi dati e la sua privacy.</p>' : ''}
      <div class="finestra__azioni"><button type="button" class="tasto" data-ck-vai>${piano === 'friends' ? 'Invita i tuoi amici' : 'Vai al tuo profilo'}</button></div>`)
    document.querySelector('dialog.finestra [data-ck-vai]').onclick = () => { document.querySelector('dialog.finestra').close(); s.dopo() }
  }
}

// ---------- pannello nel Profilo ----------
export function pannelloAbbonamento() {
  const p = pianoAttivo()
  if (p === 'free') {
    return `
      <div class="abb">
        <div class="abb__testa"><span class="abb__piano">Free</span><p>Gratis, senza scadenza. Cerchi, ti candidi e pubblichi senza pagare niente.</p></div>
        <div class="finestra__azioni">
          <button type="button" class="tasto" data-abbonati="plus">Passa a Plus · da ${euro.format(PREZZI.plus.anno / 12)}/mese</button>
          <button type="button" class="tasto tasto--chiaro" data-abbonati="friends">Friends in tre · da ${euro.format(PREZZI.friends.anno / 36)} a testa</button>
        </div>
        ${ab?.ricevute?.length ? ricevute() : ''}
      </div>`
  }
  const g = ab.gruppo
  const accettati = g?.inviti.filter((i) => i.stato === 'accettato').length || 0
  return `
    <div class="abb">
      <div class="abb__testa"><span class="abb__piano abb__piano--${p}">${NOMI[p]}</span>
        <p>${ab.periodo === 'anno' ? 'Annuale' : 'Mensile'} · ${euro.format(PREZZI[p][ab.periodo])}
        ${ab.stato === 'disdetto' ? `· <strong>disdetto</strong>: resta attivo fino al ${data(ab.rinnovo)}` : `· si rinnova il ${data(ab.rinnovo)}`}</p></div>
      ${ab.stato === 'fallito' ? `<p class="avviso-prova avviso-prova--errore"><strong>Il pagamento del rinnovo non è andato a buon fine.</strong> Aggiorna il metodo di pagamento entro 7 giorni per non perdere ${NOMI[p]}.
        <button type="button" class="tasto tasto--chiaro" data-abb="riprova">Riprova il pagamento (prova)</button></p>` : ''}
      <div class="finestra__azioni">
        ${ab.stato === 'disdetto' ? '<button type="button" class="tasto" data-abb="riattiva">Riattiva il rinnovo</button>'
          : `<button type="button" class="tasto tasto--chiaro" data-abb="periodo">Passa al piano ${ab.periodo === 'anno' ? 'mensile' : 'annuale'}</button>
             <button type="button" class="tasto tasto--chiaro" data-abbonati="${p === 'plus' ? 'friends' : 'plus'}">Passa a ${p === 'plus' ? 'Friends' : 'Plus'}</button>
             <button type="button" class="tasto tasto--pericolo" data-abb="disdici">Disdici</button>`}
      </div>
      ${p === 'friends' && g ? `
        <div class="friends">
          <h4>Il tuo gruppo Friends</h4>
          <p class="friends__posti"><strong>${1 + accettati} di 3</strong> posti occupati · ${2 - accettati} ${2 - accettati === 1 ? 'posto libero' : 'posti liberi'}</p>
          <div class="friends__codice"><span>Codice invito</span><strong>${esc(g.codice)}</strong>
            <button type="button" class="tasto tasto--chiaro" data-abb="copia">Copia il link</button></div>
          ${accettati < 2 ? `<form class="friends__invita" data-friends-invita novalidate>
            <label class="sr" for="fr-email">Email dell’amico</label>
            <input id="fr-email" type="email" name="email" placeholder="email del tuo amico" required />
            <button type="submit" class="tasto">Invita</button></form>` : ''}
          <ul class="friends__lista">
            <li><span class="avatar avatar--piccolo" aria-hidden="true">${esc((s.utente()?.nome || 'T')[0])}</span><span>Tu · amministratore</span><span class="stato">Attivo</span></li>
            ${g.inviti.map((i, n) => `<li><span class="avatar avatar--piccolo" aria-hidden="true">${esc(i.email[0].toUpperCase())}</span><span>${esc(i.email)}</span>
              ${i.stato === 'accettato' ? '<span class="stato">Attivo</span>' : `<span class="stato stato--bozza">Invito inviato</span><button type="button" class="tasto tasto--chiaro" data-abb="accetta" data-n="${n}">Simula accettazione</button>`}
              <button type="button" class="cal-x" data-abb="togli" data-n="${n}" aria-label="Togli ${esc(i.email)}">×</button></li>`).join('')}
          </ul>
          <p class="finestra__nota">Condividete l’abbonamento, non i vostri dati: ognuno ha profilo, chat, calendario e guadagni suoi, e tu non puoi vederli. Regola di prova da confermare: un posto liberato si può riassegnare dal mese successivo.</p>
          <p class="finestra__nota" data-abb-msg role="status"></p>
        </div>` : ''}
      ${ricevute()}
      ${ab.stato === 'attivo' ? '<button type="button" class="link-prova" data-abb="fallito">Prova: simula un pagamento non riuscito</button>' : ''}
    </div>`
}

const ricevute = () => `<details class="abb__ricevute"><summary>Ricevute (${ab.ricevute.length})</summary>
  <ul>${ab.ricevute.map((r) => `<li><span>${data(r.il)}</span><span>${esc(r.descr)}</span><strong>${euro.format(r.importo)}</strong></li>`).join('')}</ul>
  <p class="finestra__nota">Ricevute di prova: nessun pagamento reale.</p></details>`

// true = ridisegna
export function gestisciAbbonamento(e) {
  const t = e.target
  if (e.type === 'submit' && t.matches('[data-friends-invita]')) {
    e.preventDefault()
    const email = t.elements.email.value.trim()
    if (!t.checkValidity() || !email) { t.elements.email.reportValidity(); return false }
    if (ab.gruppo.inviti.some((i) => i.email === email)) return false
    ab.gruppo.inviti.push({ email, stato: 'inviato', il: Date.now() })
    salva()
    notifica('abbonamento', `Invito Friends inviato a ${email} (prova: nessuna email parte davvero).`, { scheda: 'profilo' })
    return true
  }
  if (e.type !== 'click') return false
  const ab1 = t.closest('[data-abbonati]')
  if (ab1) { apriCheckout(ab1.dataset.abbonati, ab?.periodo || 'mese'); return false }
  const a = t.closest('[data-abb]')?.dataset.abb
  if (!a) return false
  const n = Number(t.closest('[data-n]')?.dataset.n)
  if (a === 'disdici') {
    const b = t.closest('[data-abb]')
    if (b.dataset.conferma !== 'si') { b.dataset.conferma = 'si'; b.textContent = `Confermi? Resta attivo fino al ${data(ab.rinnovo)}`; return false }
    ab.stato = 'disdetto'
  }
  if (a === 'riattiva') ab.stato = 'attivo'
  if (a === 'periodo') {
    ab.periodo = ab.periodo === 'anno' ? 'mese' : 'anno'
    ab.ricevute.unshift({ il: Date.now(), descr: `Cambio a ${NOMI[ab.piano]} ${ab.periodo === 'anno' ? 'annuale' : 'mensile'} dal prossimo rinnovo (prova)`, importo: 0 })
  }
  if (a === 'fallito') { ab.stato = 'fallito'; notifica('abbonamento', 'Il pagamento del rinnovo non è andato a buon fine (prova).', { scheda: 'profilo' }) }
  if (a === 'riprova') { ab.stato = 'attivo'; ab.ricevute.unshift({ il: Date.now(), descr: `Rinnovo ${NOMI[ab.piano]} (prova)`, importo: PREZZI[ab.piano][ab.periodo] }) }
  if (a === 'accetta') { ab.gruppo.inviti[n].stato = 'accettato'; notifica('abbonamento', `${ab.gruppo.inviti[n].email} è entrato nel tuo gruppo Friends (prova).`, { scheda: 'profilo' }) }
  if (a === 'togli') ab.gruppo.inviti.splice(n, 1)
  if (a === 'copia') {
    const link = `${location.origin}${location.pathname}#invito-${ab.gruppo.codice}`
    navigator.clipboard?.writeText(link).then(
      () => { const m = document.querySelector('[data-abb-msg]'); if (m) m.textContent = 'Link copiato: mandalo ai tuoi amici.' },
      () => { const m = document.querySelector('[data-abb-msg]'); if (m) m.textContent = link },
    )
    return false
  }
  salva()
  avvisa()
  return true
}

export function avviaAbbonamenti(strumenti) {
  s = strumenti
  // Pulsanti nella sezione "Quanto costa": il periodo è quello scelto con l'interruttore
  document.addEventListener('click', (e) => {
    const b = e.target.closest('#costi [data-abbonati]')
    if (!b) return
    const periodo = document.querySelector('[data-periodo][aria-pressed="true"]')?.dataset.periodo || 'mese'
    apriCheckout(b.dataset.abbonati, periodo)
  })
  // Arrivo da un link di invito Friends
  if (location.hash.startsWith('#invito-')) {
    const cod = location.hash.slice(8).replace(/[^A-Z0-9]/gi, '').slice(0, 8)
    history.replaceState(null, '', location.pathname + location.search)
    s.apri(`<h2>Ti hanno invitato in Friends</h2>
      <p>Con il codice <strong>${esc(cod)}</strong> entri in un gruppo di tre: avrai tutti i vantaggi di Plus, con il tuo account e i tuoi dati, che restano solo tuoi.</p>
      <p class="avviso-prova">Versione di prova: l’ingresso nei gruppi Friends è simulato.</p>
      <div class="finestra__azioni"><button type="button" class="tasto" data-accedi="email">Registrati gratis per entrare</button></div>`)
  }
}
