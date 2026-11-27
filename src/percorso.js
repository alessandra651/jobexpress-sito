// «Il tuo percorso» — Lavora, cresci, raggiungi i tuoi obiettivi.
// Dashboard di crescita di chi lavora, con cinque sezioni:
//   1. JobExpress Goal (pronto)   2. CV   3. Career   4. Smart Calendar   5. AI (in arrivo)
// Regole:
//   * Free vede i suoi compensi, il badge e i requisiti per salire (sempre gratis);
//     gli strumenti Plus sono presentati senza dati inventati.
//   * Si distinguono: compensi PREVISTI (incarichi futuri), MATURATI (incarichi completati,
//     importo lordo stimato dall'annuncio) e RICEVUTI (solo se dichiarati da te).
//   * Le previsioni sono stime, mai guadagni garantiti.
// In questa versione di prova i dati restano su questo dispositivo.
import { NOME_CAT } from './incarichi.js'
import { guadagni, intervallo, leggiCand } from './lavori.js'
import { datiReputazione } from './reputazione.js'
import { apriCheckout, haPlus, pianoAttivo } from './abbonamenti.js'
import { impostazioni } from './regole.js'
import { gestisciCV, pannelloCV } from './cv.js'
import { pannelloCareer } from './career.js'
import { gestisciSmartCal, pannelloSmartCal } from './smartcal.js'
import { gestisciAI, pannelloAI } from './ai.js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const euro0 = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const ore1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',')
const leggi = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d } catch { return d } }
const scrivi = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* non disponibile */ } }
const K_GOAL = 'jobexpress-goal'
const K_FESTA = 'jobexpress-festa-mesi'

let vista = 'panoramica' // 'panoramica' | 'goal' | 'cv' | 'career' | 'smart_calendar' | 'ai'
const VISTE = { goal: () => vistaGoal(), cv: () => pannelloCV(), career: () => pannelloCareer(), smart_calendar: () => pannelloSmartCal(), ai: () => pannelloAI() }
let grafico = 'settimane' // 'settimane' | 'mesi' | 'anni'
let s = { apri: () => {} }
export const avviaPercorso = (strumenti) => { s = strumenti }

// ================= DATI =================
// Un elemento per ogni incarico confermato o completato, con orari veri
function incarichi() {
  const dich = new Map(guadagni().map((g) => [String(g.id), g]))
  return leggiCand()
    .filter((c) => ['confermato', 'completato'].includes(c.stato))
    .map((c) => {
      const iv = intervallo(c)
      const d = dich.get(String(c.id))
      const oreAnnuncio = Math.max(0, c.fine - c.inizio)
      return {
        id: c.id, titolo: c.titolo, chi: c.chi, cat: c.cat || 'altro', stato: c.stato,
        quando: iv ? iv.inizio : c.il,
        ore: d?.ore ?? oreAnnuncio,
        lordo: c.totale, // stimato dall'annuncio: ore × compenso orario
        ricevuto: d ? d.euro : null, // solo se dichiarato da chi lavora
      }
    })
    .sort((a, b) => b.quando - a.quando)
}

const inizioSettimana = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime() }
const inizioMese = (t) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), 1).getTime() }
const inizioAnno = (t) => new Date(new Date(t).getFullYear(), 0, 1).getTime()

// Finestra dell'obiettivo: [da, a)
function finestra(goal, ora = Date.now()) {
  if (goal.periodo === 'settimana') { const da = inizioSettimana(ora); return [da, da + 7 * 864e5] }
  if (goal.periodo === 'anno') { const da = inizioAnno(ora); return [da, new Date(new Date(da).getFullYear() + 1, 0, 1).getTime()] }
  if (goal.periodo === 'personalizzato') {
    const da = goal.creato || ora
    const a = goal.scadenza ? new Date(`${goal.scadenza}T23:59:59`).getTime() + 1000 : inizioMese(ora) + 31 * 864e5
    return [da, a]
  }
  const da = inizioMese(ora)
  const d = new Date(da)
  return [da, new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()]
}

const NOMI_PERIODO = { settimana: 'questa settimana', mese: 'questo mese', anno: 'quest’anno', personalizzato: 'entro la data scelta' }
export const leggiGoal = () => leggi(K_GOAL, null)

export function calcolaGoal(goal = leggiGoal(), ora = Date.now()) {
  const tutti = incarichi()
  const fatti = tutti.filter((x) => x.stato === 'completato')
  const [da, a] = goal ? finestra(goal, ora) : finestra({ periodo: 'mese' }, ora)
  const nel = (x) => x.quando >= da && x.quando < a
  const maturati = fatti.filter(nel).reduce((t, x) => t + x.lordo, 0)
  const ricevuti = fatti.filter((x) => nel(x) && x.ricevuto != null).reduce((t, x) => t + x.ricevuto, 0)
  const previsti = tutti.filter((x) => x.stato === 'confermato' && x.quando >= ora && nel(x)).reduce((t, x) => t + x.lordo, 0)
  const oreTot = fatti.reduce((t, x) => t + x.ore, 0)
  const lordoTot = fatti.reduce((t, x) => t + x.lordo, 0)
  // Media attendibile solo con almeno 2 incarichi completati e 4 ore
  const media = fatti.length >= 2 && oreTot >= 4 ? lordoTot / oreTot : null
  const obiettivo = goal?.importo || 0
  const mancante = Math.max(0, obiettivo - maturati)
  return {
    da, a, obiettivo, maturati, ricevuti, previsti, mancante,
    perc: obiettivo ? Math.min(100, Math.round((maturati / obiettivo) * 100)) : 0,
    percPrevisti: obiettivo ? Math.min(100 - Math.min(100, (maturati / obiettivo) * 100), (previsti / obiettivo) * 100) : 0,
    media, oreNecessarie: media && mancante ? Math.ceil(mancante / media) : 0,
    mediaIncarico: fatti.length ? lordoTot / fatti.length : null,
    oreTot, fatti, tutti,
    oreNelPeriodo: fatti.filter(nel).reduce((t, x) => t + x.ore, 0),
  }
}

// Serie per i grafici (ultimi 8 periodi)
function serie(fatti, tipo) {
  const ora = Date.now()
  const passi = { settimane: 8, mesi: 6, anni: 3 }[tipo]
  const righe = []
  for (let i = passi - 1; i >= 0; i--) {
    let da, a, nome
    if (tipo === 'settimane') {
      da = inizioSettimana(ora) - i * 7 * 864e5; a = da + 7 * 864e5
      nome = new Date(da).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
    } else if (tipo === 'mesi') {
      const d = new Date(inizioMese(ora)); d.setMonth(d.getMonth() - i); da = d.getTime()
      const f = new Date(d); f.setMonth(f.getMonth() + 1); a = f.getTime()
      nome = d.toLocaleDateString('it-IT', { month: 'short' })
    } else {
      const y = new Date(ora).getFullYear() - i; da = new Date(y, 0, 1).getTime(); a = new Date(y + 1, 0, 1).getTime(); nome = String(y)
    }
    const dentro = fatti.filter((x) => x.quando >= da && x.quando < a)
    righe.push({ nome, euro: dentro.reduce((t, x) => t + x.lordo, 0), ore: dentro.reduce((t, x) => t + x.ore, 0) })
  }
  return righe
}

// ================= DISEGNO =================
const ICONE = {
  goal: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  cv: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="9" r="2.5"/><path d="M8.5 16c.8-1.8 2-2.5 3.5-2.5s2.7.7 3.5 2.5"/>',
  career: '<path d="M4 19l5-6 4 3 7-9"/><path d="M15 7h5v5"/>',
  smart_calendar: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="M9 14l2 2 4-4"/>',
  ai: '<path d="M12 3l1.8 4.6L18.5 9l-4.7 1.6L12 15l-1.8-4.4L5.5 9l4.7-1.4z"/><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
}
const SEZIONI = [
  ['goal', 'JobExpress Goal', 'Obiettivi economici e guadagni'],
  ['cv', 'JobExpress CV', 'Un curriculum che cresce con te'],
  ['career', 'JobExpress Career', 'Esperienze e competenze nel tempo'],
  ['smart_calendar', 'JobExpress Smart Calendar', 'Lavoro, università e tempo libero'],
  ['ai', 'JobExpress AI', 'Assistente per colloqui e crescita'],
]
export const PRONTE = ['goal', 'cv', 'career', 'smart_calendar', 'ai']
const icona = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONE[k]}</svg>`

function barra(perc, percPrevisti = 0, etichetta = '') {
  return `<div class="pc-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${perc}" aria-label="${esc(etichetta)}">
    <i style="--w:${perc}%"></i>${percPrevisti > 0 ? `<b style="--w:${percPrevisti}%;--da:${perc}%"></b>` : ''}</div>`
}

function sintesiObiettivo(plus) {
  const goal = leggiGoal()
  const g = calcolaGoal(goal?.periodo === 'mese' ? goal : { periodo: 'mese', importo: goal?.periodo === 'mese' ? goal.importo : 0 })
  if (plus && goal?.periodo === 'mese' && goal.importo) {
    return `<article class="pc-hero">
      <div class="pc-hero__testa"><span class="pc-etichetta">Obiettivo di ${new Date().toLocaleDateString('it-IT', { month: 'long' })}</span><strong>${g.perc}%</strong></div>
      <p class="pc-hero__cifre"><strong>${euro0.format(g.maturati)}</strong> su ${euro0.format(g.obiettivo)}</p>
      ${barra(g.perc, g.percPrevisti, `${g.perc}% dell’obiettivo mensile`)}
      <p class="pc-legenda"><span class="pc-punto pc-punto--fatto"></span>maturati <span class="pc-punto pc-punto--previsto"></span>previsti ${euro0.format(g.previsti)}</p>
    </article>`
  }
  return `<article class="pc-hero">
    <div class="pc-hero__testa"><span class="pc-etichetta">I tuoi compensi di ${new Date().toLocaleDateString('it-IT', { month: 'long' })}</span></div>
    <p class="pc-hero__cifre"><strong>${euro0.format(g.maturati)}</strong> maturati${g.previsti ? ` · ${euro0.format(g.previsti)} previsti` : ''}</p>
    <p class="pc-nota">${plus ? 'Imposta un obiettivo mensile in Goal per vedere la barra di avanzamento.' : 'Con Plus puoi darti un obiettivo e vedere quanto manca.'}</p>
  </article>`
}

function sintesiBadge() {
  const d = datiReputazione(false)
  const p = d.prossimo
  const perc = p ? Math.min(100, Math.round((d.incarichi / Math.max(1, p.incarichi)) * 100)) : 100
  return `<article class="pc-card pc-badge">
    <span class="pc-etichetta">Badge · gratis per tutti</span>
    <p class="pc-badge__nome"><span class="pc-badge__n">${d.livello.n}</span>${esc(d.livello.nome)}</p>
    ${p ? `${barra(perc, 0, `Verso ${p.nome}`)}<p class="pc-nota">Verso <strong>${esc(p.nome)}</strong>: ${d.incarichi}/${p.incarichi} incarichi${p.recensioni ? ` · ${d.recensioni}/${p.recensioni} recensioni` : ''}</p>` : '<p class="pc-nota">Livello massimo raggiunto.</p>'}
    <button type="button" class="tasto tasto--chiaro" data-apri-passport>Livelli e requisiti</button>
  </article>`
}

function ultimiIncarichi(lista) {
  if (!lista.length) return `<article class="pc-card"><span class="pc-etichetta">Ultimi incarichi</span><p class="pc-nota">Ancora nessun incarico confermato. Quando ne completi uno, lo trovi qui.</p>
    <button type="button" class="tasto tasto--chiaro" data-area-scheda="esplora">Esplora gli incarichi</button></article>`
  return `<article class="pc-card"><span class="pc-etichetta">Ultimi incarichi</span>
    <ul class="pc-ultimi">${lista.slice(0, 3).map((x) => `<li><span class="pc-ultimi__cat">${esc(NOME_CAT[x.cat] || x.cat)}</span><strong>${esc(x.titolo)}</strong>
      <span>${new Date(x.quando).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} · ${x.stato === 'completato' ? 'completato' : 'in programma'} · ${euro0.format(x.lordo)}</span></li>`).join('')}</ul></article>`
}

function panoramica() {
  const plus = haPlus()
  const fp = impostazioni().funzioni_premium || {}
  const g = calcolaGoal()
  return `
    <div class="pc">
      <header class="pc-testa"><h3>Il tuo percorso</h3><p>Lavora, cresci, raggiungi i tuoi obiettivi.</p></header>
      ${sintesiObiettivo(plus)}
      <div class="pc-due">${sintesiBadge()}${ultimiIncarichi(g.tutti)}</div>
      <h4 class="pc-sotto">Strumenti${plus ? '' : ' <span class="pc-plus">Plus</span>'}</h4>
      <ul class="pc-sezioni">${SEZIONI.map(([k, t, d], i) => {
        const pronta = PRONTE.includes(k) && (fp[k] !== false || k === 'ai')
        return `<li><button type="button" class="pc-sezione ${pronta ? '' : 'pc-sezione--presto'}" ${pronta ? `data-pc-vai="${k}"` : 'disabled'} style="--i:${i}">
          <span class="pc-sezione__icona">${icona(k)}</span>
          <span class="pc-sezione__testo"><strong>${t}</strong><span>${d}</span></span>
          ${pronta ? (k === 'ai' && fp.ai === false ? '<span class="in-arrivo in-arrivo--scuro">da attivare</span>' : plus ? '<span class="pc-freccia" aria-hidden="true">→</span>' : '<span class="pc-plus">Plus</span>') : '<span class="in-arrivo in-arrivo--scuro">in arrivo</span>'}
        </button></li>`
      }).join('')}</ul>
      ${plus ? '' : `<p class="pc-nota">Badge, livello, compensi e calendario degli incarichi restano gratis per tutti. Plus aggiunge strumenti per organizzarti: non compra reputazione né visibilità.</p>
        <button type="button" class="tasto" data-abbonati="plus">Scopri Plus</button>`}
    </div>`
}

function vistaGoal() {
  const plus = haPlus()
  const goal = leggiGoal()
  const indietro = '<button type="button" class="pc-indietro" data-pc-vai="panoramica">← Il tuo percorso</button>'
  const g = calcolaGoal(goal)
  // Compensi: gratis per tutti
  const compensi = `<article class="pc-card">
      <span class="pc-etichetta">Compensi · ${NOMI_PERIODO[goal?.periodo || 'mese']}</span>
      <ul class="pc-tre">
        <li><span>Previsti</span><strong>${euro.format(g.previsti)}</strong><small>incarichi futuri confermati</small></li>
        <li><span>Maturati</span><strong>${euro.format(g.maturati)}</strong><small>incarichi completati</small></li>
        <li><span>Ricevuti</span><strong>${euro.format(g.ricevuti)}</strong><small>solo se li hai dichiarati</small></li>
      </ul>
      <p class="pc-nota">Previsti e maturati sono importi <strong>lordi stimati</strong> (ore × compenso dell’annuncio). Un incarico completato non vuol dire compenso già ricevuto.</p>
    </article>`
  if (!plus) {
    return `<div class="pc">${indietro}
      <header class="pc-testa"><h3>JobExpress Goal</h3><p>Dai un obiettivo ai tuoi guadagni.</p></header>
      ${compensi}
      <article class="pc-card pc-promo">
        <span class="pc-plus">Plus</span>
        <h4>Con Goal puoi…</h4>
        <ul class="pc-lista-check"><li>darti un obiettivo settimanale, mensile, annuale o personalizzato</li><li>vedere quanto manca e le ore indicative per arrivarci</li><li>confrontare settimane, mesi e anni</li><li>capire quanto guadagni all’ora e per categoria</li><li>scaricare report dei tuoi guadagni</li></ul>
        <button type="button" class="tasto" data-abbonati="plus">Scopri Plus</button>
      </article></div>`
  }
  const ser = serie(g.fatti, grafico)
  const max = Math.max(1, ...ser.map((r) => r.euro))
  const attuale = ser[ser.length - 1]
  const prima = ser[ser.length - 2]
  const delta = prima && prima.euro ? Math.round(((attuale.euro - prima.euro) / prima.euro) * 100) : null
  const perCat = {}
  g.fatti.forEach((x) => { const c = (perCat[x.cat] ||= { euro: 0, ore: 0, n: 0 }); c.euro += x.lordo; c.ore += x.ore; c.n++ })
  const cats = Object.entries(perCat).sort((a, b) => b[1].euro - a[1].euro)
  const maxCat = Math.max(1, ...cats.map(([, v]) => v.euro))
  const pr = goal?.periodo || 'mese'
  return `<div class="pc">${indietro}
    <header class="pc-testa"><h3>JobExpress Goal</h3><p>Dai un obiettivo ai tuoi guadagni.</p></header>

    <form class="pc-card pc-goal-form" data-pc-goal novalidate>
      <span class="pc-etichetta">Il tuo obiettivo</span>
      <div class="scelta scelta--vista2 pc-periodi" role="group" aria-label="Periodo dell’obiettivo">
        ${[['settimana', 'Settimana'], ['mese', 'Mese'], ['anno', 'Anno'], ['personalizzato', 'Fino a una data']].map(([k, t]) => `<button type="button" data-pc-periodo="${k}" aria-pressed="${pr === k}">${t}</button>`).join('')}
      </div>
      <div class="pc-goal-campi">
        <label class="pc-importo"><span>Importo</span><span class="pc-importo__campo"><input name="importo" type="number" inputmode="numeric" min="5" max="100000" step="5" value="${goal?.importo || ''}" placeholder="500" required /> €</span></label>
        <label class="pc-data" ${pr === 'personalizzato' ? '' : 'hidden'}><span>Entro il</span><input name="scadenza" type="date" value="${goal?.scadenza || ''}" /></label>
        <button type="submit" class="tasto">${goal ? 'Aggiorna' : 'Imposta'}</button>
      </div>
      <p class="pc-errore" data-pc-errore role="alert"></p>
    </form>

    ${goal ? `<article class="pc-hero">
      <div class="pc-hero__testa"><span class="pc-etichetta">Obiettivo ${esc(NOMI_PERIODO[pr])}</span><strong>${g.perc}%</strong></div>
      ${barra(g.perc, g.percPrevisti, `${g.perc}% dell’obiettivo`)}
      <p class="pc-legenda"><span class="pc-punto pc-punto--fatto"></span>maturati <span class="pc-punto pc-punto--previsto"></span>previsti</p>
      <ul class="pc-cifre">
        <li><span>Obiettivo</span><strong>${euro0.format(g.obiettivo)}</strong></li>
        <li><span>Maturati</span><strong>${euro.format(g.maturati)}</strong></li>
        <li><span>Mancano</span><strong>${euro.format(g.mancante)}</strong></li>
        <li><span>Media oraria</span><strong>${g.media ? euro.format(g.media) : '—'}</strong></li>
        <li><span>Ore indicative</span><strong>${g.mancante === 0 ? '0' : g.media ? `≈ ${g.oreNecessarie}` : '—'}</strong></li>
        <li><span>Ore lavorate</span><strong>${ore1(g.oreNelPeriodo)}</strong></li>
      </ul>
      ${g.mancante === 0 && g.obiettivo ? '<p class="pc-traguardo">Obiettivo raggiunto! 🎉</p>'
        : g.media ? `<p class="pc-nota">Stima: con la tua media di ${euro.format(g.media)} l’ora servirebbero circa ${g.oreNecessarie} ore. Non è un guadagno garantito.</p>`
        : '<p class="pc-nota">Per calcolare una media attendibile servono almeno 2 incarichi completati (e 4 ore di lavoro).</p>'}
    </article>` : '<article class="pc-card"><p class="pc-nota">Scegli un periodo e un importo: la barra si aggiornerà da sola a ogni incarico completato.</p></article>'}

    ${compensi}

    <article class="pc-card">
      <div class="pc-card__testa"><span class="pc-etichetta">Andamento</span>
        <div class="scelta scelta--vista2 pc-periodi pc-periodi--piccoli" role="group" aria-label="Tipo di grafico">
          ${[['settimane', 'Settimane'], ['mesi', 'Mesi'], ['anni', 'Anni']].map(([k, t]) => `<button type="button" data-pc-grafico="${k}" aria-pressed="${grafico === k}">${t}</button>`).join('')}
        </div></div>
      ${g.fatti.length ? `<div class="pc-grafico" role="img" aria-label="Compensi maturati per ${grafico}">${ser.map((r, i) => `<div class="pc-colonna"><span class="pc-colonna__val">${r.euro ? euro0.format(r.euro) : ''}</span><i style="--h:${Math.round((r.euro / max) * 100)}%;--i:${i}"></i><span class="pc-colonna__nome">${esc(r.nome)}</span></div>`).join('')}</div>
        <p class="pc-confronto">${delta == null ? 'Confronto con il periodo precedente: dati insufficienti.' : `Rispetto al periodo precedente: <strong class="${delta >= 0 ? 'su' : 'giu'}">${delta >= 0 ? '+' : ''}${delta}%</strong> (${euro0.format(attuale.euro)} contro ${euro0.format(prima.euro)})`}</p>`
        : '<p class="pc-nota">Il grafico compare dopo il primo incarico completato.</p>'}
    </article>

    <div class="pc-due">
      <article class="pc-card">
        <span class="pc-etichetta">Medie</span>
        <ul class="pc-cifre pc-cifre--due">
          <li><span>All’ora</span><strong>${g.media ? euro.format(g.media) : '—'}</strong></li>
          <li><span>Per incarico</span><strong>${g.mediaIncarico != null && g.fatti.length >= 2 ? euro.format(g.mediaIncarico) : '—'}</strong></li>
          <li><span>Ore totali</span><strong>${ore1(g.oreTot)}</strong></li>
          <li><span>Incarichi</span><strong>${g.fatti.length}</strong></li>
        </ul>
        ${g.media ? '' : '<p class="pc-nota">Le medie compaiono con almeno 2 incarichi completati.</p>'}
      </article>
      <article class="pc-card">
        <span class="pc-etichetta">Per categoria</span>
        ${cats.length ? `<ul class="pc-cat">${cats.map(([k, v]) => `<li><span>${esc(NOME_CAT[k] || k)}</span><span class="pc-cat__barra"><i style="width:${(v.euro / maxCat) * 100}%"></i></span><strong>${euro0.format(v.euro)}</strong><small>${v.n} · ${ore1(v.ore)} h</small></li>`).join('')}</ul>`
          : '<p class="pc-nota">Ancora nessun incarico completato.</p>'}
      </article>
    </div>

    <article class="pc-card pc-report">
      <div><span class="pc-etichetta">Report</span><p class="pc-nota">Tutti i tuoi incarichi con ore, importo lordo stimato e importo ricevuto dichiarato.</p></div>
      <div class="pc-report__azioni"><button type="button" class="tasto tasto--chiaro" data-pc-report="scarica">Scarica CSV</button><button type="button" class="tasto tasto--chiaro" data-pc-report="copia">Copia</button></div>
      <p class="pc-nota" data-pc-msg role="status"></p>
    </article>
  </div>`
}

export function pannelloPercorso() {
  return (VISTE[vista] || panoramica)()
}

function csv() {
  const righe = [['data', 'incarico', 'committente', 'categoria', 'stato', 'ore', 'lordo stimato (euro)', 'ricevuto dichiarato (euro)']]
  incarichi().forEach((x) => righe.push([new Date(x.quando).toLocaleDateString('it-IT'), x.titolo, x.chi, NOME_CAT[x.cat] || x.cat,
    x.stato === 'completato' ? 'completato' : 'in programma', ore1(x.ore), String(x.lordo.toFixed(2)).replace('.', ','), x.ricevuto == null ? '' : String(x.ricevuto.toFixed(2)).replace('.', ',')]))
  return righe.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
}

// true = ridisegna l'area
export function gestisciPercorso(e) {
  const t = e.target
  const sotto = { cv: gestisciCV, smart_calendar: gestisciSmartCal, ai: gestisciAI }[vista]
  if (sotto && !t.closest('[data-pc-vai]')) { const r = sotto(e); if (r || e.defaultPrevented) return r }
  if (e.type === 'submit' && t.closest('[data-pc-goal]')) {
    e.preventDefault()
    const f = t.closest('[data-pc-goal]')
    const importo = Number(f.elements.importo.value)
    const periodo = f.querySelector('[data-pc-periodo][aria-pressed="true"]')?.dataset.pcPeriodo || 'mese'
    const scadenza = f.elements.scadenza.value || null
    const err = f.querySelector('[data-pc-errore]')
    if (!(importo >= 5 && importo <= 100000)) { err.textContent = 'Scrivi un importo tra 5 e 100.000 €.'; return false }
    if (periodo === 'personalizzato' && (!scadenza || new Date(`${scadenza}T23:59:59`) < new Date())) { err.textContent = 'Scegli una data futura.'; return false }
    const prima = leggiGoal()
    scrivi(K_GOAL, { importo, periodo, scadenza: periodo === 'personalizzato' ? scadenza : null, creato: prima?.periodo === periodo ? prima.creato : Date.now() })
    return true
  }
  if (e.type !== 'click') return false
  const vai = t.closest('[data-pc-vai]')
  if (vai) { vista = VISTE[vai.dataset.pcVai] ? vai.dataset.pcVai : 'panoramica'; document.querySelector('#area')?.scrollTo?.(0, 0); return true }
  const per = t.closest('[data-pc-periodo]')
  if (per) {
    const f = per.closest('form')
    f.querySelectorAll('[data-pc-periodo]').forEach((b) => b.setAttribute('aria-pressed', b === per))
    f.querySelector('.pc-data').hidden = per.dataset.pcPeriodo !== 'personalizzato'
    return false
  }
  const gr = t.closest('[data-pc-grafico]')
  if (gr) { grafico = gr.dataset.pcGrafico; return true }
  const rep = t.closest('[data-pc-report]')
  if (rep) {
    const testo = csv()
    const msg = document.querySelector('[data-pc-msg]')
    if (rep.dataset.pcReport === 'scarica') {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob(['﻿' + testo], { type: 'text/csv;charset=utf-8' }))
      a.download = `jobexpress-guadagni-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a); a.click(); a.remove()
      if (msg) msg.textContent = 'Report scaricato. Se non parte, usa «Copia».'
    } else {
      navigator.clipboard?.writeText(testo).then(() => { if (msg) msg.textContent = 'Report copiato: incollalo in un foglio di calcolo.' }, () => { if (msg) msg.textContent = testo })
    }
    return false
  }
  return false
}

// ================= SCHERMATA CELEBRATIVA =================
// Per chi usa Free: dopo il SECONDO incarico completato nello stesso mese (una volta al mese).
// Non attiva prove o abbonamenti da sola: serve sempre la scelta della persona.
export function festaSeServe(dopo = () => document.querySelector('dialog.finestra')?.close()) {
  if (pianoAttivo() !== 'free') return dopo()
  const ora = Date.now()
  const mese = new Date(ora).toISOString().slice(0, 7)
  const gia = leggi(K_FESTA, [])
  const delMese = incarichi().filter((x) => x.stato === 'completato' && inizioMese(x.quando) === inizioMese(ora))
  if (delMese.length < 2 || gia.includes(mese)) return dopo()
  scrivi(K_FESTA, [...gia, mese])
  const imp = impostazioni()
  const ore = delMese.reduce((t, x) => t + x.ore, 0)
  const lordo = delMese.reduce((t, x) => t + x.lordo, 0)
  const cats = [...new Set(delMese.map((x) => NOME_CAT[x.cat] || x.cat))]
  const rep = datiReputazione(false)
  const p = rep.prossimo
  s.apri(`
    <div class="festa">
      <div class="festa__coriandoli" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
      <p class="dettaglio__cat">Secondo incarico del mese</p>
      <h2>Il tuo percorso è appena iniziato!</h2>
      <ul class="festa__cifre">
        <li><strong>${delMese.length}</strong><span>incarichi completati</span></li>
        <li><strong>${euro0.format(lordo)}</strong><span>compensi maturati (lordi stimati)</span></li>
        <li><strong>${ore1(ore)} h</strong><span>ore lavorate</span></li>
      </ul>
      <p>Esperienze in: <strong>${cats.map(esc).join(', ')}</strong>.</p>
      <p>Livello <strong>${esc(rep.livello.nome)}</strong>${p ? ` · verso ${esc(p.nome)}: ${rep.incarichi}/${p.incarichi} incarichi` : ''}.</p>
      <h3 class="festa__invito">Porta il tuo percorso al livello successivo.</h3>
      <ul class="pc-lista-check">
        <li>Monitora i tuoi obiettivi economici.</li><li>Costruisci il tuo curriculum.</li><li>Scopri come stai crescendo professionalmente.</li>
        <li>Organizza il tuo tempo.</li><li>Accedi al tuo assistente professionale AI.</li>
      </ul>
      ${imp.prova_gratuita?.attiva ? `<p class="pc-nota">Puoi provare Plus gratis per ${Number(imp.prova_gratuita.giorni)} giorni: si attiva solo se lo scegli tu.</p>` : ''}
      ${imp.free_monthly_job_limit_enabled ? '' : '<p class="pc-nota">Con Free puoi continuare a confermare incarichi gratuitamente.</p>'}
      <div class="finestra__azioni"><button type="button" class="tasto" data-festa-plus>Scopri Plus</button><button type="button" class="tasto tasto--chiaro" data-festa-chiudi>Chiudi</button></div>
    </div>`)
  const f = document.querySelector('dialog.finestra')
  f.querySelector('[data-festa-plus]').onclick = () => apriCheckout('plus')
  f.querySelector('[data-festa-chiudi]').onclick = () => f.close()
}
