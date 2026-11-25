// Messaggi tra chi lavora e chi pubblica, sempre legati a un incarico.
// Numero di telefono ed email non vengono mai mostrati in automatico.
// In questa versione di prova le conversazioni restano su questo dispositivo
// e le risposte dell'altra persona sono di esempio.
import { apriIncarico } from './incarichi.js'
import { notifica } from './notifiche.js'
import { segnala } from './segnalazioni.js'

const CHIAVE = 'jobexpress-chat'
const MAX = 1000
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const leggi = () => { try { return JSON.parse(localStorage.getItem(CHIAVE) || '[]') } catch { return [] } }
let conv = leggi()
const salva = () => { try { localStorage.setItem(CHIAVE, JSON.stringify(conv)) } catch { /* non disponibile */ } }
const ascoltatori = []
export const quandoCambiaChat = (f) => ascoltatori.push(f)
const avvisa = () => ascoltatori.forEach((f) => f())

const RISPOSTE = {
  lavoro: ['Ciao! Grazie per la candidatura. Sei disponibile per tutto l’orario indicato?', 'Perfetto. Ti scrivo appena decidiamo, entro oggi.', 'Ottimo, a presto!'],
  pubblico: ['Ciao, grazie per avermi selezionato! Confermo la disponibilità.', 'Va bene, mi segno tutto. Serve portare qualcosa?', 'Perfetto, a presto!'],
}

let aperta = null
let cerca = ''
let mostraArchivio = false
const inviiRecenti = []

export const nonLetti = () => conv.filter((c) => !c.archiviata).reduce((t, c) => t + (c.nonLetti || 0), 0)

// Crea (o riapre) la conversazione per un incarico. lato: 'lavoro' se scrivo io come lavoratore,
// 'pubblico' se scrivo come chi ha pubblicato.
export function avviaConversazione({ incaricoId, titolo, con, lato, sistema }) {
  let c = conv.find((x) => x.incaricoId === incaricoId && x.con === con)
  if (!c) {
    c = { id: `c-${Date.now()}`, incaricoId, titolo, con, lato, messaggi: [], nonLetti: 0, risposte: 0, archiviata: false, bloccata: false, segnalata: false }
    conv.unshift(c)
  }
  if (sistema) c.messaggi.push({ da: 'sistema', testo: sistema, il: Date.now() })
  salva()
  rispondiPiuTardi(c)
  avvisa()
  return c.id
}

// Risposta di esempio dell'altra persona, dopo qualche secondo
function rispondiPiuTardi(c) {
  if (c.bloccata || c.risposte >= RISPOSTE[c.lato].length) return
  setTimeout(() => {
    const x = conv.find((y) => y.id === c.id)
    if (!x || x.bloccata) return
    x.messaggi.push({ da: 'loro', testo: RISPOSTE[x.lato][x.risposte], il: Date.now(), esempio: true })
    x.risposte++
    x.messaggi.forEach((m) => { if (m.da === 'io') m.letto = true })
    if (aperta !== x.id) x.nonLetti = (x.nonLetti || 0) + 1
    salva()
    notifica('messaggio', `${x.con} ti ha scritto: «${breve(RISPOSTE[x.lato][x.risposte - 1])}»`, { scheda: 'chat', chat: x.id })
    avvisa()
  }, 2500)
}

export function apriConversazione(id) {
  aperta = id
  const c = conv.find((x) => x.id === id)
  if (c) { c.nonLetti = 0; salva(); avvisa() }
}

const ora = (t) => new Date(t).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
const breve = (t, n = 60) => (t.length <= n ? t : `${t.slice(0, n).replace(/\s+\S*$/, '')}…`)
const haContatti = (t) => /(\+?\d[\d\s.-]{7,}\d)|([^\s@]+@[^\s@]+\.[a-z]{2,})/i.test(t)

function elenco() {
  const lista = conv.filter((c) => c.archiviata === mostraArchivio && (!cerca || `${c.con} ${c.titolo}`.toLowerCase().includes(cerca.toLowerCase())))
  return `
    <div class="chat__cerca">
      <input type="search" placeholder="Cerca per nome o incarico" value="${esc(cerca)}" data-chat-cerca aria-label="Cerca nelle conversazioni" />
      <button type="button" class="tasto tasto--chiaro" data-chat-archivio>${mostraArchivio ? 'Conversazioni attive' : 'Archiviate'}</button>
    </div>
    ${lista.length ? `<ul class="chat__elenco">${lista.map((c) => {
      const ultimo = c.messaggi.at(-1)
      return `<li><button type="button" class="chat__voce" data-chat-apri="${c.id}">
        <span class="avatar avatar--piccolo" aria-hidden="true">${esc(c.con[0])}</span>
        <span class="chat__voce-testo"><strong>${esc(c.con)}</strong><small>${esc(c.titolo)}</small><span>${esc(ultimo ? ultimo.testo.slice(0, 70) : '')}</span></span>
        ${c.nonLetti ? `<span class="chat__badge" aria-label="${c.nonLetti} da leggere">${c.nonLetti}</span>` : ''}
      </button></li>`
    }).join('')}</ul>`
      : `<div class="vuoto"><strong>${cerca ? 'Nessuna conversazione trovata.' : mostraArchivio ? 'Nessuna conversazione archiviata.' : 'Nessun messaggio.'}</strong>
        <p>${cerca || mostraArchivio ? '' : 'Quando ti candidi a un incarico, o quando selezioni qualcuno, la conversazione compare qui.'}</p></div>`}`
}

function conversazione(c) {
  return `
    <div class="chat__conv">
      <div class="chat__testa">
        <button type="button" class="tasto tasto--chiaro" data-chat-indietro aria-label="Torna alle conversazioni">←</button>
        <span class="avatar avatar--piccolo" aria-hidden="true">${esc(c.con[0])}</span>
        <div><strong>${esc(c.con)}</strong><button type="button" class="chat__incarico" data-chat-incarico="${esc(c.incaricoId)}">${esc(c.titolo)} · vedi incarico</button></div>
        <details class="chat__menu"><summary aria-label="Altre azioni">···</summary>
          <div>
            <button type="button" data-chat-azione="archivia">${c.archiviata ? 'Togli dall’archivio' : 'Archivia'}</button>
            <button type="button" data-chat-azione="blocca">${c.bloccata ? 'Sblocca' : 'Blocca questa persona'}</button>
            <button type="button" data-chat-azione="segnala" ${c.segnalata ? 'disabled' : ''}>${c.segnalata ? 'Segnalata' : 'Segnala'}</button>
          </div>
        </details>
      </div>
      <ol class="chat__messaggi" aria-live="polite">
        ${c.messaggi.map((m) => m.da === 'sistema'
          ? `<li class="msg msg--sistema">${esc(m.testo)}</li>`
          : `<li class="msg msg--${m.da}"><span>${esc(m.testo)}</span><small>${ora(m.il)}${m.da === 'io' ? (m.letto ? ' · Letto' : ' · Inviato') : ''}${m.esempio ? ' · risposta di esempio' : ''}</small></li>`).join('')}
      </ol>
      ${c.segnalata ? '<p class="finestra__nota">Segnalazione inviata alla moderazione. Versione di prova: resta su questo dispositivo.</p>' : ''}
      ${c.bloccata ? '<p class="chat__bloccata">Hai bloccato questa persona: non può più scriverti. Puoi sbloccarla dal menu ···</p>' : `
      <form class="chat__scrivi" data-chat-form>
        <label class="sr" for="chat-testo">Scrivi un messaggio</label>
        <textarea id="chat-testo" name="testo" rows="1" maxlength="${MAX}" placeholder="Scrivi un messaggio…" required></textarea>
        <button type="submit" class="tasto">Invia</button>
        <p class="chat__avviso" data-chat-avviso role="status"></p>
      </form>`}
    </div>`
}

export function pannelloChat() {
  const c = aperta && conv.find((x) => x.id === aperta)
  return `<div class="chat">${c ? conversazione(c) : elenco()}
    <p class="finestra__nota">Versione di prova: i messaggi restano su questo dispositivo e le risposte sono di esempio. Telefono ed email non vengono mai mostrati in automatico.</p></div>`
}

// true = ridisegna l'area
export function gestisciChat(e) {
  const t = e.target
  if (e.type === 'input' && t.matches('[data-chat-cerca]')) { cerca = t.value; return 'cerca' }
  if (e.type === 'input' && t.matches('#chat-testo')) {
    const avviso = document.querySelector('[data-chat-avviso]')
    if (avviso) avviso.textContent = haContatti(t.value) ? 'Attenzione: stai per condividere un numero o un’email. Fallo solo se ti fidi.' : ''
    return false
  }
  if (e.type === 'submit' && t.matches('[data-chat-form]')) {
    e.preventDefault()
    const testo = t.elements.testo.value.trim()
    const avviso = t.querySelector('[data-chat-avviso]')
    if (!testo) return false
    const adesso = Date.now()
    while (inviiRecenti.length && adesso - inviiRecenti[0] > 10000) inviiRecenti.shift()
    if (inviiRecenti.length >= 5) { avviso.textContent = 'Stai scrivendo troppo in fretta: aspetta qualche secondo.'; return false }
    inviiRecenti.push(adesso)
    const c = conv.find((x) => x.id === aperta)
    c.messaggi.push({ da: 'io', testo: testo.slice(0, MAX), il: adesso })
    salva()
    rispondiPiuTardi(c)
    return 'inviato'
  }
  if (e.type !== 'click') return false
  const a = t.closest('[data-chat-apri]')
  if (a) { apriConversazione(a.dataset.chatApri); return true }
  if (t.closest('[data-chat-indietro]')) { aperta = null; return true }
  if (t.closest('[data-chat-archivio]')) { mostraArchivio = !mostraArchivio; return true }
  const inc = t.closest('[data-chat-incarico]')
  if (inc) { apriIncarico(inc.dataset.chatIncarico); return false }
  const az = t.closest('[data-chat-azione]')?.dataset.chatAzione
  if (az) {
    const c = conv.find((x) => x.id === aperta)
    if (az === 'archivia') { c.archiviata = !c.archiviata; aperta = null }
    if (az === 'blocca') c.bloccata = !c.bloccata
    if (az === 'segnala') { c.segnalata = true; segnala({ tipo: 'persona', riferimento: c.id, titolo: `${c.con} · chat per «${c.titolo}»`, motivo: 'Comportamento scorretto' }) }
    salva()
    avvisa()
    return true
  }
  return false
}
