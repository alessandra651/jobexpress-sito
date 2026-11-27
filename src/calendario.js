// Calendario intelligente di chi lavora:
// - disponibilità ricorrenti (ogni settimana) e occasionali (un giorno preciso)
// - giorni bloccati
// - incarichi a cui ti sei candidato, senza sovrapposizioni
// - suggerimenti di incarichi compatibili, con il motivo spiegato
// In questa versione di prova resta salvato solo su questo dispositivo.
import { apriIncarico, impostaCalendario, tuttiIncarichi } from './incarichi.js'

const CHIAVE = 'jobexpress-calendario'
const GIORNI_SETT = [['lun', 'Lunedì'], ['mar', 'Martedì'], ['mer', 'Mercoledì'], ['gio', 'Giovedì'], ['ven', 'Venerdì'], ['sab', 'Sabato'], ['dom', 'Domenica']]
const DA_JS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']
const NOMI_LUNGHI = { lunedi: 'lun', martedi: 'mar', mercoledi: 'mer', giovedi: 'gio', venerdi: 'ven', sabato: 'sab', domenica: 'dom' }
const TUTTO = [0, 24]

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const hhmm = (h) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`
const daOra = (v) => { const [h, m] = String(v).split(':').map(Number); return Number.isNaN(h) ? null : h + (m || 0) / 60 }
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const oggi = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
const piu = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const nomeData = (d) => d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
const fasciaTesto = (f) => (f[0] === 0 && f[1] === 24 ? 'tutto il giorno' : `${hhmm(f[0])}–${hhmm(f[1])}`)

const vuota = () => ({ settimana: Object.fromEntries(GIORNI_SETT.map(([k]) => [k, []])), eccezioni: {}, km: 10 })
let cal = (() => {
  try { return { ...vuota(), ...JSON.parse(localStorage.getItem(CHIAVE) || 'null') } } catch { return vuota() }
})()
const salva = () => { try { localStorage.setItem(CHIAVE, JSON.stringify(cal)) } catch { /* non disponibile */ } }

let giornoScelto = iso(oggi())
let leggiCandidature = () => []
export const collegaCandidature = (fn) => { leggiCandidature = fn }

// ---------- logica ----------
export function dataDi(a) {
  if (a.data) return new Date(`${a.data}T00:00:00`)
  if (a.giorno === 'oggi') return oggi()
  if (a.giorno === 'domani') return piu(oggi(), 1)
  const k = NOMI_LUNGHI[a.giorno]
  if (!k) return null
  const t = oggi()
  return piu(t, (DA_JS.indexOf(k) - t.getDay() + 7) % 7)
}

export function fasceDi(d) {
  const e = cal.eccezioni[iso(d)]
  if (e?.tipo === 'blocco') return []
  const base = cal.settimana[DA_JS[d.getDay()]] || []
  return e?.tipo === 'extra' ? [...base, ...e.fasce] : base
}

const compilato = () => Object.values(cal.settimana).some((l) => l.length) || Object.values(cal.eccezioni).some((e) => e.tipo === 'extra')
const dentro = (a, f) => a.inizio >= f[0] && Math.min(a.fine, 24) <= f[1]
const sovrappone = (a1, b1, a2, b2) => a1 < b2 && a2 < b1

// Candidature attive che si sovrappongono a questo incarico (stesso giorno, orari che si toccano)
export function sovrapposizioni(a, escludiId) {
  const d = dataDi(a)
  if (!d) return []
  return leggiCandidature().filter((c) => ['inviata', 'selezionato', 'confermato'].includes(c.stato) && c.id !== escludiId && c.data === iso(d) && sovrappone(a.inizio, a.fine, c.inizio, c.fine))
}

export function compatCalendario(a) {
  if (!compilato()) return null
  const d = dataDi(a)
  if (!d) return null
  const fasce = fasceDi(d)
  const nome = nomeData(d)
  if (cal.eccezioni[iso(d)]?.tipo === 'blocco') return { ok: false, testo: `Hai bloccato ${nome} nel tuo calendario.` }
  if (!fasce.length) return { ok: false, testo: `Nel tuo calendario ${nome} non risulti disponibile.` }
  const f = fasce.find((x) => dentro(a, x))
  if (!f) return { ok: false, testo: `${nome[0].toUpperCase() + nome.slice(1)} sei disponibile ${fasce.map(fasciaTesto).join(' e ')}, ma l’incarico va dalle ${hhmm(a.inizio)} alle ${hhmm(a.fine)}.` }
  if (a.km > cal.km) return { ok: false, testo: `Gli orari vanno bene, ma è a ${String(a.km).replace('.', ',')} km: oltre il tuo raggio di ${cal.km} km.` }
  const altri = sovrapposizioni(a)
  const confermato = altri.find((c) => c.stato === 'confermato')
  if (confermato) return { ok: false, testo: `In questo orario hai già un incarico confermato: ${confermato.titolo}.` }
  if (altri.length) return { ok: true, testo: `Compatibile con la tua disponibilità, ma hai già ${altri.length === 1 ? 'una candidatura' : `${altri.length} candidature`} in questo orario: se confermi un incarico, le altre si ritirano da sole.` }
  return { ok: true, testo: `Compatibile con la tua disponibilità di ${nome} (${fasciaTesto(f)}) ed entro il tuo raggio di ${cal.km} km.` }
}
impostaCalendario(compatCalendario)

function suggerimenti() {
  const limite = piu(oggi(), 7)
  return tuttiIncarichi()
    .filter((a) => !a.mio)
    .map((a) => ({ a, d: dataDi(a), c: compatCalendario(a) }))
    .filter((x) => x.d && x.d < limite && x.c?.ok)
    .sort((x, y) => x.d - y.d || x.a.inizio - y.a.inizio)
    .slice(0, 6)
}

// ---------- disegno ----------
function rigaGiorno([k, nome]) {
  const fasce = cal.settimana[k]
  const modo = !fasce.length ? 'no' : fasce.length === 1 && fasce[0][0] === 0 && fasce[0][1] === 24 ? 'tutto' : 'fasce'
  return `
  <div class="cal-giorno" data-g="${k}">
    <strong>${nome}</strong>
    <div class="cal-modo" role="group" aria-label="Disponibilità del ${nome.toLowerCase()}">
      ${[['no', 'No'], ['fasce', 'Fasce'], ['tutto', 'Tutto il giorno']].map(([m, t]) => `<button type="button" data-cal-modo="${m}" aria-pressed="${modo === m}">${t}</button>`).join('')}
    </div>
    ${modo === 'fasce' ? `<div class="cal-fasce">${fasce.map((f, i) => `
      <span class="cal-fascia"><input type="time" step="1800" value="${hhmm(f[0])}" data-cal-ora="${i}-0" aria-label="${nome}, dalle" /> – <input type="time" step="1800" value="${hhmm(f[1] === 24 ? 23.99 : f[1])}" data-cal-ora="${i}-1" aria-label="${nome}, alle" />
      ${fasce.length > 1 ? `<button type="button" class="cal-x" data-cal-togli="${i}" aria-label="Togli questa fascia">×</button>` : ''}</span>`).join('')}
      ${fasce.length < 2 ? '<button type="button" class="cal-piu" data-cal-aggiungi>+ fascia</button>' : ''}</div>` : ''}
  </div>`
}

function striscia() {
  const cand = leggiCandidature().filter((c) => c.stato !== 'ritirata')
  return Array.from({ length: 14 }, (_, i) => {
    const d = piu(oggi(), i)
    const k = iso(d)
    const e = cal.eccezioni[k]
    const fasce = fasceDi(d)
    const n = cand.filter((c) => c.data === k).length
    const stato = e?.tipo === 'blocco' ? 'bloccato' : e?.tipo === 'extra' ? 'extra' : fasce.length ? 'libero' : 'no'
    return `<button type="button" class="cal-data cal-data--${stato}${k === giornoScelto ? ' scelto' : ''}" data-cal-data="${k}" aria-pressed="${k === giornoScelto}"
      aria-label="${nomeData(d)}: ${{ bloccato: 'bloccato', extra: 'disponibilità extra', libero: 'disponibile', no: 'non disponibile' }[stato]}${n ? `, ${n} incarichi` : ''}">
      <span>${d.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '')}</span><strong>${d.getDate()}</strong>${n ? '<i aria-hidden="true"></i>' : ''}</button>`
  }).join('')
}

function editorGiorno() {
  const d = new Date(`${giornoScelto}T00:00:00`)
  const e = cal.eccezioni[giornoScelto]
  const base = cal.settimana[DA_JS[d.getDay()]]
  const cand = leggiCandidature().filter((c) => c.stato !== 'ritirata' && c.data === giornoScelto)
  return `
    <div class="cal-editor">
      <h4>${nomeData(d)}</h4>
      <p>Di solito: <strong>${base.length ? base.map(fasciaTesto).join(' e ') : 'non disponibile'}</strong>${e?.tipo === 'blocco' ? ' · <span class="stato stato--ritirata">Bloccato</span>' : ''}${e?.tipo === 'extra' ? ` · in più: <strong>${e.fasce.map(fasciaTesto).join(', ')}</strong>` : ''}</p>
      ${cand.map((c) => `<p class="cal-incarico"><i aria-hidden="true"></i>${esc(c.titolo)}, ${hhmm(c.inizio)}–${hhmm(c.fine)} <span class="stato">Candidatura inviata</span></p>`).join('')}
      <div class="finestra__azioni">
        ${e ? '<button type="button" class="tasto tasto--chiaro" data-cal-ecc="solito">Torna come di solito</button>' : ''}
        ${e?.tipo !== 'blocco' ? '<button type="button" class="tasto tasto--chiaro" data-cal-ecc="blocco">Blocca questo giorno</button>' : ''}
      </div>
      <div class="cal-extra">
        <span>Disponibilità extra solo per questo giorno:</span>
        <input type="time" step="1800" value="09:00" data-cal-extra="0" aria-label="Extra, dalle" /> – <input type="time" step="1800" value="13:00" data-cal-extra="1" aria-label="Extra, alle" />
        <button type="button" class="tasto" data-cal-ecc="extra">Aggiungi</button>
      </div>
      <p class="conto-form__errore" data-cal-errore role="alert"></p>
    </div>`
}

export function pannelloCalendario() {
  const sugg = suggerimenti()
  return `
  <div class="cal">
    <article class="riquadro">
      <div class="riquadro__testa"><h3>La tua settimana</h3>
        <label class="cal-raggio">Raggio <select data-cal-km>${[2, 5, 10, 25].map((k) => `<option value="${k}" ${cal.km === k ? 'selected' : ''}>${k} km</option>`).join('')}</select></label></div>
      <p class="finestra__nota">Le ore in cui di solito sei libero/a. Valgono ogni settimana, finché non le cambi.</p>
      ${compilato() ? '' : '<button type="button" class="tasto tasto--chiaro" data-cal-esempio>Parti da un esempio</button>'}
      <div class="cal-settimana">${GIORNI_SETT.map(rigaGiorno).join('')}</div>
    </article>
    <article class="riquadro">
      <h3>Prossimi 14 giorni</h3>
      <p class="finestra__nota">Tocca un giorno per bloccarlo o aggiungere ore in più solo per quella volta.</p>
      <div class="cal-striscia">${striscia()}</div>
      <p class="cal-legenda"><span class="l libero"></span>Disponibile <span class="l extra"></span>Ore extra <span class="l bloccato"></span>Bloccato <span class="l punto"></span>Incarico</p>
      ${editorGiorno()}
    </article>
    <article class="riquadro">
      <h3>Incarichi compatibili nei prossimi 7 giorni</h3>
      ${!compilato() ? '<p>Compila la tua settimana e qui compaiono gli incarichi che ci stanno dentro, con il motivo.</p>'
        : sugg.length ? `<ul class="sugg">${sugg.map(({ a, d, c }) => `<li>
            <div><strong>${esc(a.titolo)}</strong><p>${nomeData(d)}, ${hhmm(a.inizio)}–${hhmm(a.fine)} · ${esc(a.citta)} · ${String(a.euroOra).replace('.', ',')} €/ora</p><p class="sugg__perche">${esc(c.testo)}</p></div>
            <button type="button" class="tasto tasto--chiaro" data-cal-vedi="${esc(a.id)}">Vedi</button></li>`).join('')}</ul>`
        : '<p>Nessun incarico compatibile in questi giorni. Prova ad ampliare il raggio o ad aggiungere qualche fascia.</p>'}
    </article>
  </div>`
}

// ---------- azioni ----------
// Restituisce true se l'evento era del calendario (così l'area ridisegna)
export function gestisciCalendario(e) {
  const t = e.target
  const g = t.closest('[data-g]')?.dataset.g
  const err = (m) => { const n = document.querySelector('[data-cal-errore]'); if (n) n.textContent = m }
  if (e.type === 'click') {
    const modo = t.closest('[data-cal-modo]')?.dataset.calModo
    if (modo && g) {
      cal.settimana[g] = modo === 'no' ? [] : modo === 'tutto' ? [TUTTO] : [[14, 19]]
      return salva(), true
    }
    if (t.closest('[data-cal-aggiungi]') && g) {
      const ultima = cal.settimana[g].at(-1)
      cal.settimana[g].push([Math.min(ultima[1] + 1, 22), Math.min(ultima[1] + 3, 24)])
      return salva(), true
    }
    const togli = t.closest('[data-cal-togli]')
    if (togli && g) {
      cal.settimana[g].splice(Number(togli.dataset.calTogli), 1)
      return salva(), true
    }
    if (t.closest('[data-cal-esempio]')) {
      cal.settimana = { lun: [[14, 19]], mar: [], mer: [[9, 13]], gio: [[17, 21]], ven: [], sab: [TUTTO], dom: [[9, 13]] }
      return salva(), true
    }
    const data = t.closest('[data-cal-data]')
    if (data) { giornoScelto = data.dataset.calData; return true }
    const ecc = t.closest('[data-cal-ecc]')?.dataset.calEcc
    if (ecc === 'solito') { delete cal.eccezioni[giornoScelto]; return salva(), true }
    if (ecc === 'blocco') { cal.eccezioni[giornoScelto] = { tipo: 'blocco' }; return salva(), true }
    if (ecc === 'extra') {
      const da = daOra(document.querySelector('[data-cal-extra="0"]').value)
      const a = daOra(document.querySelector('[data-cal-extra="1"]').value)
      if (da == null || a == null || a <= da) { err('L’ora di fine deve venire dopo quella di inizio.'); return false }
      const prima = cal.eccezioni[giornoScelto]
      cal.eccezioni[giornoScelto] = { tipo: 'extra', fasce: [...(prima?.tipo === 'extra' ? prima.fasce : []), [da, a]] }
      return salva(), true
    }
    const vedi = t.closest('[data-cal-vedi]')
    if (vedi) { apriIncarico(vedi.dataset.calVedi); return false }
  }
  if (e.type === 'change') {
    if (t.matches('[data-cal-km]')) { cal.km = Number(t.value); return salva(), true }
    const ora = t.dataset.calOra
    if (ora && g) {
      const [i, lato] = ora.split('-').map(Number)
      const v = daOra(t.value)
      if (v == null) return false
      const f = [...cal.settimana[g][i]]
      f[lato] = lato === 1 && v >= 23.98 ? 24 : v
      if (f[1] <= f[0]) { t.setCustomValidity('La fine deve venire dopo l’inizio'); t.reportValidity(); return false }
      t.setCustomValidity('')
      cal.settimana[g][i] = f
      return salva(), true
    }
  }
  return false
}

export const dataIso = iso
