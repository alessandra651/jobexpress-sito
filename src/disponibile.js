// "Disponibile ora": chi lavora segnala che c'è, per un tempo che sceglie.
// Scade da sola. Agli altri si mostra solo la zona, mai la posizione esatta.
// In questa versione di prova resta salvata solo in questo browser.
import { CATEGORIE, INCARICHI_DEMO } from './incarichi.js'
import { notifica } from './notifiche.js'

const CHIAVE = 'jobexpress-disponibile'
const NOME_CAT = Object.fromEntries(CATEGORIE)
const hhmm = (d) => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

let stato = leggi()
let apri = () => {}
let messaggio = ''
const ascoltatori = []

function leggi() {
  try {
    const s = JSON.parse(localStorage.getItem(CHIAVE) || 'null')
    return s && s.fino > Date.now() ? s : null
  } catch {
    return null
  }
}
function scrivi(s) {
  stato = s
  try {
    s ? localStorage.setItem(CHIAVE, JSON.stringify(s)) : localStorage.removeItem(CHIAVE)
  } catch { /* memoria del browser non disponibile: resta valido finché la pagina è aperta */ }
  ascoltatori.forEach((f) => f(stato))
}

export const leggiDisponibile = () => (stato && stato.fino > Date.now() ? stato : null)
export const quandoCambia = (f) => ascoltatori.push(f)

// Quanti incarichi di oggi stanno nella finestra scelta (stesse regole della bacheca)
function compatibiliOggi(s) {
  const adesso = new Date()
  const da = adesso.getHours() + adesso.getMinutes() / 60
  const fine = new Date(s.fino)
  let a = fine.getHours() + fine.getMinutes() / 60
  if (fine.getDate() !== adesso.getDate()) a += 24
  return INCARICHI_DEMO.filter((i) => i.giorno === 'oggi' && i.inizio >= da && i.fine <= a && i.km <= s.km && (!s.cat.length || s.cat.includes(i.cat)))
}

function descrizione(s) {
  const cat = s.cat.length ? s.cat.map((c) => NOME_CAT[c]).join(', ') : 'tutte le categorie'
  return `${cat} · entro ${s.km} km`
}

function disegna(radice) {
  const s = leggiDisponibile()
  if (!s) {
    radice.className = 'dispo'
    radice.innerHTML = `
      <div class="dispo__testo">
        <strong>Disponibile ora</strong>
        <span>${messaggio ? esc(messaggio) : 'Hai qualche ora libera adesso? Fallo sapere a chi cerca qualcuno vicino a te.'}</span>
      </div>
      <button type="button" class="dispo__interruttore" role="switch" aria-checked="false" data-dispo-attiva>
        <span class="dispo__pallino" aria-hidden="true"></span><span class="sr">Disponibile ora</span>
      </button>`
    return
  }
  const n = compatibiliOggi(s).length
  radice.className = 'dispo dispo--attiva'
  radice.innerHTML = `
    <div class="dispo__testo">
      <strong><span class="dispo__luce" aria-hidden="true"></span>Sei disponibile fino alle ${hhmm(new Date(s.fino))}</strong>
      <span>${esc(descrizione(s))}. Chi pubblica vede solo la tua zona, mai la posizione esatta.</span>
      <span class="dispo__match">${n ? `${n} ${n === 1 ? 'incarico di oggi è compatibile' : 'incarichi di oggi sono compatibili'} con questa finestra.` : 'Per ora nessun incarico di oggi in questa finestra: nella versione completa ti avvisiamo appena ne arriva uno.'}</span>
    </div>
    <div class="dispo__azioni">
      <button type="button" class="tasto tasto--chiaro" data-dispo-modifica>Modifica</button>
      <button type="button" class="dispo__interruttore" role="switch" aria-checked="true" data-dispo-spegni>
        <span class="dispo__pallino" aria-hidden="true"></span><span class="sr">Disattiva Disponibile ora</span>
      </button>
    </div>`
}

function finestra(radice) {
  const s = leggiDisponibile()
  const tra3 = new Date(Date.now() + 3 * 3600e3)
  const fineDefault = `${String(tra3.getHours()).padStart(2, '0')}:00`
  apri(`
    <h2>Disponibile ora</h2>
    <p>Per quanto tempo ci sei? La disponibilità si spegne da sola alla fine.</p>
    <form class="dispo-form" data-dispo-form>
      <fieldset class="dispo-form__durata">
        <legend>Per quanto tempo</legend>
        <label><input type="radio" name="durata" value="1" ${!s ? 'checked' : ''}/> Un’ora</label>
        <label><input type="radio" name="durata" value="2" /> Due ore</label>
        <label><input type="radio" name="durata" value="4" /> Quattro ore</label>
        <label><input type="radio" name="durata" value="fino" ${s ? 'checked' : ''}/> Fino alle <input type="time" name="fino" value="${s ? hhmm(new Date(s.fino)) : fineDefault}" aria-label="Fino alle" /></label>
        <label><input type="radio" name="durata" value="giorno" /> Tutta la giornata</label>
      </fieldset>
      <fieldset>
        <legend>Categorie <span class="facoltativo">nessuna scelta = tutte</span></legend>
        <div class="dispo-form__cat">
          ${CATEGORIE.map(([k, t]) => `<label class="pillola"><input type="checkbox" name="cat" value="${k}" ${s?.cat.includes(k) ? 'checked' : ''}/> <span>${t}</span></label>`).join('')}
        </div>
      </fieldset>
      <label class="dispo-form__km">Distanza massima
        <select name="km">${[2, 5, 10, 25].map((k) => `<option value="${k}" ${(s?.km ?? 10) === k ? 'selected' : ''}>Entro ${k} km</option>`).join('')}</select>
      </label>
      <p class="finestra__nota">Gli altri vedono il tuo nome, la zona e le categorie. Mai la posizione GPS esatta. Versione di prova: la disponibilità resta solo su questo dispositivo.</p>
      <p class="dispo-form__errore" data-dispo-errore role="alert"></p>
      <div class="finestra__azioni">
        <button class="tasto" type="submit">${s ? 'Aggiorna' : 'Attiva'}</button>
        <button class="tasto tasto--chiaro" type="button" data-dispo-annulla>Annulla</button>
      </div>
    </form>`)
  const dlg = document.querySelector('dialog.finestra')
  const form = dlg.querySelector('[data-dispo-form]')
  dlg.querySelector('[data-dispo-annulla]').onclick = () => dlg.close()
  form.fino.addEventListener('focus', () => { form.querySelector('[value=fino]').checked = true })
  form.onsubmit = (e) => {
    e.preventDefault()
    const durata = form.durata.value
    const adesso = new Date()
    let fino
    if (durata === 'giorno') {
      fino = new Date(adesso); fino.setHours(23, 59, 0, 0)
    } else if (durata === 'fino') {
      const [h, m] = (form.fino.value || '').split(':').map(Number)
      fino = new Date(adesso); fino.setHours(h, m, 0, 0)
      if (Number.isNaN(fino.getTime())) fino = null
      else if (fino <= adesso) fino.setDate(fino.getDate() + 1) // es. "fino alle 01:00" = dopo mezzanotte
      if (fino && fino - adesso > 16 * 3600e3) fino = null
    } else {
      fino = new Date(adesso.getTime() + Number(durata) * 3600e3)
    }
    if (!fino) {
      dlg.querySelector('[data-dispo-errore]').textContent = 'Scegli un orario entro le prossime 16 ore.'
      return
    }
    messaggio = ''
    scrivi({ fino: fino.getTime(), cat: [...form.querySelectorAll('[name=cat]:checked')].map((c) => c.value), km: Number(form.km.value) })
    disegna(radice)
    dlg.close()
  }
}

export function avviaDisponibile(strumenti) {
  const radice = document.querySelector('[data-dispo]')
  if (!radice) return
  apri = strumenti.apri
  radice.addEventListener('click', (e) => {
    if (e.target.closest('[data-dispo-attiva], [data-dispo-modifica]')) finestra(radice)
    if (e.target.closest('[data-dispo-spegni]')) {
      messaggio = 'Disattivata. Puoi riattivarla quando vuoi.'
      scrivi(null)
      disegna(radice)
    }
  })
  // Scadenza automatica: controllo ogni 20 secondi
  setInterval(() => {
    if (stato && stato.fino <= Date.now()) {
      messaggio = 'La tua disponibilità è scaduta. Riattivala quando vuoi.'
      notifica('disponibilita', 'La tua disponibilità «Disponibile ora» è scaduta. Riattivala quando vuoi.', { scheda: 'home' })
      scrivi(null)
      disegna(radice)
    }
  }, 20000)
  disegna(radice)
}
