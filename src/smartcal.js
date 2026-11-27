// JobExpress Smart Calendar (funzione Plus): lavoro, università e tempo libero in un posto solo.
// * Viste giorno / settimana / mese.
// * Eventi: incarichi confermati, proposte ricevute, candidature in attesa (dalle tue attività)
//   + impegni universitari, personali, indisponibilità e tempo libero (li aggiungi tu).
// * Gli impegni personali e universitari li vedi SOLO tu: aziende e privati non li vedono mai.
//   Vedono solo le disponibilità che scegli di condividere (calendario base in «Attività»).
// * Sovrapposizioni, avvisi spostamenti, ore lavorate e ore libere, collegamento con Goal.
// * Esporta in formato ICS (Google Calendar, Apple Calendar, Outlook) e «Aggiungi a Google Calendar».
//   La sincronizzazione automatica arriverà con il collegamento all'account Google (serve il consenso).
import { intervallo, leggiCand } from './lavori.js'
import { haPlus } from './abbonamenti.js'
import { notifica } from './notifiche.js'
import { avvisiSpostamenti, sovrappone } from './regole.js'
import { calcolaGoal, leggiGoal } from './percorso.js'
import { SUPABASE_KEY, SUPABASE_URL } from './config.js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const K = 'jobexpress-smartcal'
const TIPI = {
  confermato: ['Incarico confermato', '✓'], proposta: ['Proposta da confermare', '!'], candidatura: ['Candidatura in attesa', '…'],
  universita: ['Università', '🎓'], personale: ['Personale', '●'], indisponibile: ['Non disponibile', '⦸'], libero: ['Tempo libero', '☀'],
}
const MIEI = ['universita', 'personale', 'indisponibile', 'libero']
const GIORNO_DA = 8; const GIORNO_A = 22 // fascia considerata per le «ore libere»
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const ora = (ms) => new Date(ms).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
const n1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',')
const inizioGiorno = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }
const lunedi = (t) => { const d = new Date(inizioGiorno(t)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime() }

let st = (() => { try { return { eventi: [], vista: 'settimana', giorno: iso(new Date()), promemoriaIncarichi: 60, avvisati: [], ...JSON.parse(localStorage.getItem(K) || 'null') } } catch { return { eventi: [], vista: 'settimana', giorno: iso(new Date()), promemoriaIncarichi: 60, avvisati: [] } } })()
let s = { utente: () => null, token: async () => null }
function salva(sincronizza = false) {
  try { localStorage.setItem(K, JSON.stringify(st)) } catch { /* non disponibile */ }
  const u = s.utente()
  if (sincronizza && u && !u.prova && SUPABASE_KEY) {
    s.token().then((t) => t && fetch(`${SUPABASE_URL}/rest/v1/calendario_personale`, {
      method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: u.id, eventi: st.eventi, aggiornato_il: new Date().toISOString() }),
    })).catch(() => {})
  }
}

// ---------- eventi nel periodo ----------
function eventi(da, a) {
  const out = []
  leggiCand().forEach((c) => {
    const tipo = { confermato: 'confermato', selezionato: 'proposta', inviata: 'candidatura' }[c.stato]
    if (!tipo) return
    const iv = intervallo(c)
    if (iv && iv.fine > da && iv.inizio < a) out.push({ id: `c-${c.id}`, tipo, titolo: c.titolo, dove: c.luogo, ...iv, incarico: c })
  })
  st.eventi.forEach((e) => {
    const [h1, m1] = e.inizio.split(':').map(Number); const [h2, m2] = e.fine.split(':').map(Number)
    const base = new Date(`${e.data}T00:00:00`).getTime()
    const passi = e.ripeti === 'settimana' ? Math.ceil((a - base) / (7 * 864e5)) + 1 : 1
    for (let k = 0; k < passi; k++) {
      const g = new Date(base); g.setDate(g.getDate() + 7 * k)
      const i = g.getTime() + (h1 * 60 + m1) * 60000
      let f = g.getTime() + (h2 * 60 + m2) * 60000
      if (f <= i) f += 864e5 // finisce dopo mezzanotte
      if (f > da && i < a) out.push({ id: `${e.id}-${k}`, base: e.id, tipo: e.tipo, titolo: e.titolo, inizio: i, fine: f, promemoria: e.promemoria })
    }
  })
  return out.sort((x, y) => x.inizio - y.inizio)
}

// Ore libere di un giorno (dalle 8 alle 22, togliendo tutto ciò che è occupato)
function liberi(giornoMs, lista) {
  const da = giornoMs + GIORNO_DA * 3600000; const a = giornoMs + GIORNO_A * 3600000
  const occupati = lista.filter((e) => e.tipo !== 'libero' && e.tipo !== 'candidatura' && e.fine > da && e.inizio < a)
    .map((e) => [Math.max(da, e.inizio), Math.min(a, e.fine)]).sort((x, y) => x[0] - y[0])
  const buchi = []; let t = da
  occupati.forEach(([i, f]) => { if (i > t) buchi.push([t, i]); t = Math.max(t, f) })
  if (t < a) buchi.push([t, a])
  return buchi.filter(([i, f]) => f - i >= 3600000) // almeno un'ora
}

function analisi(da, a) {
  const l = eventi(da, a)
  const sovr = []
  for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
    const x = l[i]; const y = l[j]
    if (!sovrappone(x, y) || x.tipo === 'libero' || y.tipo === 'libero') continue
    if (x.tipo === 'candidatura' && y.tipo === 'candidatura') continue // le candidature possono sovrapporsi (fino a 3)
    if (['confermato', 'proposta', 'candidatura'].includes(x.tipo) || ['confermato', 'proposta', 'candidatura'].includes(y.tipo)) sovr.push([x, y])
  }
  const conf = l.filter((e) => e.tipo === 'confermato')
  const spost = []
  conf.forEach((x, i) => conf.slice(i + 1).forEach((y) => { avvisiSpostamenti([x], [y]).forEach((w) => spost.push([x, y, w.minuti])) }))
  const oreLavoro = conf.reduce((t, e) => t + (e.fine - e.inizio), 0) / 3600000
  let oreLibere = 0
  for (let g = inizioGiorno(da); g < a; g += 864e5) oreLibere += liberi(g, l).reduce((t, [i, f]) => t + (f - i), 0) / 3600000
  return { l, sovr, spost, oreLavoro, oreLibere }
}

// ---------- promemoria (finché il sito è aperto; push ed email arriveranno con il server) ----------
export function controllaPromemoria() {
  if (!haPlus()) return
  const adesso = Date.now()
  eventi(adesso, adesso + 864e5).forEach((e) => {
    const prima = e.tipo === 'confermato' ? st.promemoriaIncarichi : e.promemoria
    if (!prima) return
    const chiave = `${e.id}@${e.inizio}`
    if (st.avvisati.includes(chiave) || e.inizio - adesso > prima * 60000 || e.inizio < adesso) return
    st.avvisati = [...st.avvisati.slice(-200), chiave]
    salva()
    notifica(e.tipo === 'confermato' ? 'selezione' : 'candidatura', `${e.tipo === 'confermato' ? 'Incarico imminente' : 'Promemoria'}: «${e.titolo}» alle ${ora(e.inizio)}.`, { scheda: 'percorso' })
  })
}

// ---------- esportazione ----------
const icsData = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const icsTesto = (t) => String(t ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
function ics(conPersonali) {
  const da = Date.now() - 30 * 864e5; const a = Date.now() + 365 * 864e5
  const l = eventi(da, a).filter((e) => e.tipo === 'confermato' || (conPersonali && MIEI.includes(e.tipo)))
  const righe = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//JobExpress//Smart Calendar//IT', 'CALSCALE:GREGORIAN',
    ...l.flatMap((e) => ['BEGIN:VEVENT', `UID:${e.id}-${e.inizio}@jobexpress`, `DTSTAMP:${icsData(Date.now())}`, `DTSTART:${icsData(e.inizio)}`, `DTEND:${icsData(e.fine)}`,
      `SUMMARY:${icsTesto(e.tipo === 'confermato' ? `JobExpress · ${e.titolo}` : e.titolo)}`, ...(e.dove ? [`LOCATION:${icsTesto(e.dove)}`] : []), 'END:VEVENT']),
    'END:VCALENDAR']
  return righe.join('\r\n')
}
const linkGoogle = (e) => `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`JobExpress · ${e.titolo}`)}&dates=${icsData(e.inizio)}/${icsData(e.fine)}&location=${encodeURIComponent(e.dove || '')}&details=${encodeURIComponent('Incarico confermato su JobExpress')}`

// ---------- disegno ----------
const chip = (e) => `<li class="sc-ev sc-ev--${e.tipo}"><span class="sc-ev__ora">${ora(e.inizio)}–${ora(e.fine)}</span><span class="sc-ev__t"><span aria-hidden="true">${TIPI[e.tipo][1]}</span> ${esc(e.titolo)}</span>
  <span class="sc-ev__tipo">${TIPI[e.tipo][0]}</span>${e.base ? `<button type="button" class="cal-x" data-sc-togli="${esc(e.base)}" aria-label="Elimina ${esc(e.titolo)}">×</button>` : ''}
  ${e.tipo === 'confermato' ? `<a class="sc-ev__g" href="${esc(linkGoogle(e))}" target="_blank" rel="noopener">+ Google Calendar</a>` : ''}</li>`

function vistaGiorno(g) {
  const l = eventi(g, g + 864e5)
  const lib = liberi(g, l)
  return `<div class="sc-giorno">
    ${l.length ? `<ul class="sc-lista">${l.map(chip).join('')}</ul>` : '<p class="pc-nota">Niente in programma.</p>'}
    <p class="pc-sotto-titolo">Fasce libere (8–22)</p>
    ${lib.length ? `<ul class="sc-liberi">${lib.map(([i, f]) => `<li>${ora(i)}–${ora(f)}</li>`).join('')}</ul>` : '<p class="pc-nota">Nessuna fascia libera di almeno un’ora.</p>'}
  </div>`
}

function vistaSettimana(da) {
  const giorni = Array.from({ length: 7 }, (_, i) => da + i * 864e5)
  const tutti = eventi(da, da + 7 * 864e5)
  return `<ol class="sc-sett">${giorni.map((g) => {
    const l = tutti.filter((e) => e.inizio < g + 864e5 && e.fine > g)
    const lib = liberi(g, l).reduce((t, [i, f]) => t + (f - i), 0) / 3600000
    const oggi = inizioGiorno(Date.now()) === g
    return `<li class="${oggi ? 'oggi' : ''}"><button type="button" class="sc-sett__giorno" data-sc-giorno="${iso(new Date(g))}"><strong>${new Date(g).toLocaleDateString('it-IT', { weekday: 'short' })}</strong> ${new Date(g).getDate()}</button>
      <div>${l.length ? `<ul class="sc-lista sc-lista--compatta">${l.map(chip).join('')}</ul>` : '<span class="pc-nota">—</span>'}<span class="sc-sett__lib">${n1(lib)} h libere</span></div></li>`
  }).join('')}</ol>`
}

function vistaMese(g) {
  const d = new Date(g); const primo = new Date(d.getFullYear(), d.getMonth(), 1)
  const inizio = lunedi(primo.getTime())
  const fine = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
  const celle = Math.ceil((fine - inizio) / 864e5 / 7) * 7
  const tutti = eventi(inizio, inizio + celle * 864e5)
  return `<div class="sc-mese" role="grid">${['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((x) => `<span class="sc-mese__int">${x}</span>`).join('')}
    ${Array.from({ length: celle }, (_, i) => {
      const gg = inizio + i * 864e5
      const l = tutti.filter((e) => e.inizio < gg + 864e5 && e.fine > gg)
      const fuori = new Date(gg).getMonth() !== d.getMonth()
      return `<button type="button" class="sc-mese__c ${fuori ? 'fuori' : ''} ${inizioGiorno(Date.now()) === gg ? 'oggi' : ''}" data-sc-giorno="${iso(new Date(gg))}" aria-label="${new Date(gg).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}, ${l.length} eventi">
        <span>${new Date(gg).getDate()}</span><span class="sc-punti">${[...new Set(l.map((e) => e.tipo))].slice(0, 4).map((t) => `<i class="sc-p--${t}"></i>`).join('')}</span></button>`
    }).join('')}</div>`
}

export function pannelloSmartCal() {
  const indietro = '<button type="button" class="pc-indietro" data-pc-vai="panoramica">← Il tuo percorso</button>'
  const testa = '<header class="pc-testa"><h3>JobExpress Smart Calendar</h3><p>Lavoro, università e tempo libero insieme.</p></header>'
  if (!haPlus()) {
    return `<div class="pc">${indietro}${testa}<article class="pc-card pc-promo"><span class="pc-plus">Plus</span><h4>Con Smart Calendar puoi…</h4>
      <ul class="pc-lista-check"><li>vedere incarichi, proposte e candidature per giorno, settimana e mese</li><li>aggiungere lezioni, esami e impegni personali (li vedi solo tu)</li><li>trovare le fasce libere e ricevere promemoria</li><li>esportare tutto in Google Calendar o Apple Calendar</li></ul>
      <p class="pc-nota">Il calendario degli incarichi confermati e i controlli sugli orari restano gratis in «Attività».</p>
      <button type="button" class="tasto" data-abbonati="plus">Scopri Plus</button></article></div>`
  }
  const g = new Date(`${st.giorno}T00:00:00`).getTime()
  const [da, a] = st.vista === 'giorno' ? [g, g + 864e5] : st.vista === 'settimana' ? [lunedi(g), lunedi(g) + 7 * 864e5]
    : [new Date(new Date(g).getFullYear(), new Date(g).getMonth(), 1).getTime(), new Date(new Date(g).getFullYear(), new Date(g).getMonth() + 1, 1).getTime()]
  const an = analisi(da, a)
  const goal = leggiGoal()
  const cg = goal ? calcolaGoal(goal) : null
  const titolo = st.vista === 'giorno' ? new Date(g).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
    : st.vista === 'settimana' ? `${new Date(da).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} – ${new Date(a - 1).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`
      : new Date(g).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  const nomePeriodo = { giorno: 'oggi', settimana: 'questa settimana', mese: 'questo mese' }[st.vista]
  return `<div class="pc">${indietro}${testa}
    <div class="sc-barra">
      <div class="scelta scelta--vista2" role="group" aria-label="Vista">${[['giorno', 'Giorno'], ['settimana', 'Settimana'], ['mese', 'Mese']].map(([k, t]) => `<button type="button" data-sc-vista="${k}" aria-pressed="${st.vista === k}">${t}</button>`).join('')}</div>
      <div class="sc-nav"><button type="button" class="cv-mini" data-sc-sposta="-1" aria-label="Periodo precedente">‹</button><strong>${esc(titolo)}</strong><button type="button" class="cv-mini" data-sc-sposta="1" aria-label="Periodo successivo">›</button><button type="button" class="cv-mini cv-mini--testo" data-sc-oggi>Oggi</button></div>
    </div>
    <article class="pc-card sc-corpo">${st.vista === 'giorno' ? vistaGiorno(g) : st.vista === 'settimana' ? vistaSettimana(da) : vistaMese(g)}
      <ul class="sc-legenda">${Object.entries(TIPI).map(([k, [t]]) => `<li><i class="sc-p--${k}"></i>${t}</li>`).join('')}</ul></article>

    <ul class="pc-cifre pc-cifre--chiaro">
      <li><span>Ore di lavoro ${nomePeriodo}</span><strong>${n1(an.oreLavoro)}</strong></li>
      <li><span>Ore libere (8–22)</span><strong>${n1(an.oreLibere)}</strong></li>
      <li><span>Avvisi</span><strong>${an.sovr.length + an.spost.length}</strong></li>
    </ul>

    ${an.sovr.length || an.spost.length ? `<article class="pc-card"><span class="pc-etichetta">Da controllare</span><ul class="sc-avvisi">
      ${an.sovr.map(([x, y]) => `<li class="sc-avv--sovr"><strong>Sovrapposizione:</strong> ${esc(x.titolo)} (${ora(x.inizio)}–${ora(x.fine)}) e ${esc(y.titolo)} (${ora(y.inizio)}–${ora(y.fine)}), ${new Date(x.inizio).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' })}.</li>`).join('')}
      ${an.spost.map(([x, y, m]) => `<li class="sc-avv--spost"><strong>Spostamenti:</strong> solo ${m} minuti tra «${esc(x.titolo)}» e «${esc(y.titolo)}». Verifica di riuscire ad arrivare in tempo.</li>`).join('')}
    </ul></article>` : ''}

    <article class="pc-card"><span class="pc-etichetta">Suggerimenti</span><ul class="cr-sugg">
      ${cg && cg.mancante > 0 && cg.media ? `<li>Per il tuo obiettivo servono circa ${cg.oreNecessarie} ore di lavoro; ${nomePeriodo} hai ${n1(an.oreLibere)} ore libere tra le 8 e le 22.</li>` : ''}
      ${an.oreLibere >= 6 ? `<li>Hai diverse fasce libere ${nomePeriodo}: puoi attivare «Disponibile ora» quando vuoi lavorare.</li>` : `<li>${nomePeriodo[0].toUpperCase() + nomePeriodo.slice(1)} sei piuttosto impegnato: tieni del tempo per riposare e studiare.</li>`}
      ${st.eventi.some((e) => e.tipo === 'universita') ? '' : '<li>Aggiungi lezioni ed esami: così i suggerimenti tengono conto dello studio.</li>'}
    </ul><p class="pc-nota">Sono stime basate sui tuoi orari, non impegni garantiti.</p></article>

    <details class="cv-ed sc-nuovo" ${st.eventi.length ? '' : 'open'}><summary>Aggiungi un impegno</summary>
      <form class="cv-ed__form" data-sc-nuovo novalidate>
        <label><span>Tipo</span><select name="tipo">${MIEI.map((k) => `<option value="${k}">${TIPI[k][0]}</option>`).join('')}</select></label>
        <label><span>Titolo</span><input name="titolo" maxlength="60" placeholder="Es. Lezione di Statistica" /></label>
        <label><span>Giorno</span><input name="data" type="date" value="${st.giorno}" /></label>
        <label><span>Dalle</span><input name="inizio" type="time" value="09:00" /></label>
        <label><span>Alle</span><input name="fine" type="time" value="11:00" /></label>
        <label><span>Ripeti</span><select name="ripeti"><option value="no">Una volta</option><option value="settimana">Ogni settimana</option></select></label>
        <label><span>Promemoria</span><select name="promemoria"><option value="">Nessuno</option><option value="15">15 minuti prima</option><option value="60">1 ora prima</option><option value="1440">Il giorno prima</option></select></label>
        <button type="submit" class="tasto">Aggiungi</button>
        <p class="pc-errore" data-sc-errore role="alert"></p>
      </form>
      <p class="pc-nota">Impegni personali e universitari li vedi solo tu: aziende e privati non li vedono.</p>
    </details>

    <article class="pc-card sc-esporta"><span class="pc-etichetta">Promemoria e calendari esterni</span>
      <label class="cv-scelta">Avvisami prima degli incarichi: <select data-sc-prom>${[[0, 'mai'], [30, '30 minuti'], [60, '1 ora'], [180, '3 ore'], [1440, '1 giorno']].map(([v, t]) => `<option value="${v}" ${Number(st.promemoriaIncarichi) === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <div class="pc-report__azioni"><button type="button" class="tasto tasto--chiaro" data-sc-ics="incarichi">Esporta incarichi (.ics)</button><button type="button" class="tasto tasto--chiaro" data-sc-ics="tutto">Esporta tutto (.ics)</button></div>
      <p class="pc-nota">Il file .ics si apre con Google Calendar, Apple Calendar e Outlook. Per ogni incarico confermato c’è anche «+ Google Calendar». La sincronizzazione automatica con Google arriverà con il collegamento dell’account (sempre con il tuo consenso).</p>
      <p class="pc-nota" data-sc-msg role="status"></p>
    </article>
  </div>`
}

export const avviaSmartCal = (strumenti) => { s = { ...s, ...strumenti }; setInterval(controllaPromemoria, 30000) }

// true = ridisegna
export function gestisciSmartCal(e) {
  const t = e.target
  if (e.type === 'change' && t.matches('[data-sc-prom]')) { st.promemoriaIncarichi = Number(t.value); salva(); return false }
  if (e.type === 'submit' && t.closest('[data-sc-nuovo]')) {
    e.preventDefault()
    const f = t.closest('[data-sc-nuovo]'); const el = f.elements
    const titolo = el.titolo.value.trim() || { universita: 'Università', personale: 'Impegno', indisponibile: 'Non disponibile', libero: 'Tempo libero' }[el.tipo.value]
    if (!el.data.value || !el.inizio.value || !el.fine.value) { f.querySelector('[data-sc-errore]').textContent = 'Scegli giorno e orari.'; return false }
    if (el.inizio.value === el.fine.value) { f.querySelector('[data-sc-errore]').textContent = 'L’orario di fine deve essere diverso dall’inizio.'; return false }
    st.eventi.push({ id: `e${Date.now().toString(36)}`, tipo: el.tipo.value, titolo: titolo.slice(0, 60), data: el.data.value, inizio: el.inizio.value, fine: el.fine.value, ripeti: el.ripeti.value, promemoria: el.promemoria.value ? Number(el.promemoria.value) : null })
    st.giorno = el.data.value
    salva(true)
    return true
  }
  if (e.type !== 'click') return false
  const v = t.closest('[data-sc-vista]'); if (v) { st.vista = v.dataset.scVista; salva(); return true }
  const g = t.closest('[data-sc-giorno]'); if (g) { st.giorno = g.dataset.scGiorno; st.vista = 'giorno'; salva(); return true }
  if (t.closest('[data-sc-oggi]')) { st.giorno = iso(new Date()); salva(); return true }
  const sp = t.closest('[data-sc-sposta]')
  if (sp) {
    const d = new Date(`${st.giorno}T00:00:00`); const n = Number(sp.dataset.scSposta)
    if (st.vista === 'giorno') d.setDate(d.getDate() + n); else if (st.vista === 'settimana') d.setDate(d.getDate() + 7 * n); else d.setMonth(d.getMonth() + n)
    st.giorno = iso(d); salva(); return true
  }
  const x = t.closest('[data-sc-togli]'); if (x) { st.eventi = st.eventi.filter((ev) => ev.id !== x.dataset.scTogli); salva(true); return true }
  const ex = t.closest('[data-sc-ics]')
  if (ex) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([ics(ex.dataset.scIcs === 'tutto')], { type: 'text/calendar;charset=utf-8' }))
    a.download = ex.dataset.scIcs === 'tutto' ? 'jobexpress-calendario.ics' : 'jobexpress-incarichi.ics'
    document.body.appendChild(a); a.click(); a.remove()
    const m = document.querySelector('[data-sc-msg]'); if (m) m.textContent = 'File .ics scaricato: aprilo per aggiungerlo al tuo calendario.'
    return false
  }
  return false
}
