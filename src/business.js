// JobExpress Business (Fase 4) — strumenti per chi pubblica, gratuiti.
//   Schede: Annunci · Panoramica · Calendario (giorno / settimana / mese) · Modelli e ricorrenze · Collaborazioni.
//   * I numeri vengono dal database (panoramica_business, calendario_business, archivio_collaborazioni).
//   * Gli annunci ricorrenti NON si pubblicano da soli: creano date «da confermare».
//   * L'archivio mostra solo fatti (incarichi svolti insieme): nessuna nota privata, nessun voto nascosto sulle persone.
//   * Business Pro (più sedi, referenti, ruoli) è predisposto ma NON attivo: nessun prezzo.
//   * Account di prova: dati di esempio, sempre etichettati come tali.
import { SUPABASE_KEY, SUPABASE_URL } from './config.js'
import { apriProceduraDa, bozzaDaDati, ultimaPubblicata } from './annunci.js'
import { pubblicaReale } from './reale.js'
import { apriProfiloPubblico, codiciTrust, finestraTrust } from './trust.js'

const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const ora = (t) => new Date(t).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const giorno0 = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const piu = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const lunedi = (d) => { const x = giorno0(d); return piu(x, -((x.getDay() + 6) % 7)) }
const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const GIORNI_LUNGHI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']

let s = { utente: () => null, token: async () => null, apri: () => {}, ridisegna: () => {} }
const st = { vista: 'annunci', periodo: 'settimana', cal: { modo: 'settimana', rif: giorno0(new Date()) }, pan: null, voci: null, chiaveCal: '', modelli: null, ric: null, coll: null, caricando: new Set(), errore: '' }
const reale = () => { const u = s.utente(); return !!(u && !u.prova && SUPABASE_KEY) }
const prova = () => !!s.utente()?.prova

async function rpc(nome, corpo = {}) {
  const t = await s.token()
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}`, {
    method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(15000),
  })
  const testo = await r.text()
  if (!r.ok) throw new Error(testo)
  return testo ? JSON.parse(testo) : null
}
async function leggiTabella(percorso) {
  const t = await s.token()
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${percorso}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${t}` }, signal: AbortSignal.timeout(15000) })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}
const errore = () => s.apri('<h2>Non riesco a collegarmi</h2><p>Riprova tra poco.</p>')

// carica una volta sola per chiave, poi ridisegna
const falliti = {}
function carica(chiave, fn) {
  if (st.caricando.has(chiave) || falliti[chiave] > Date.now() - 30000) return
  st.caricando.add(chiave)
  fn().then(() => { st.errore = ''; delete falliti[chiave] }).catch(() => { falliti[chiave] = Date.now(); st.errore = 'Non riesco a caricare i dati. Riprova tra poco.' })
    .finally(() => { st.caricando.delete(chiave); s.ridisegna() })
}

// ---------- periodi ----------
function periodo() {
  const oggi = giorno0(new Date())
  if (st.periodo === 'settimana') { const l = lunedi(oggi); return [l, piu(l, 6), 'questa settimana'] }
  if (st.periodo === 'mese') return [new Date(oggi.getFullYear(), oggi.getMonth(), 1), new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0), 'questo mese']
  return [new Date(oggi.getFullYear(), oggi.getMonth() - 1, 1), new Date(oggi.getFullYear(), oggi.getMonth(), 0), 'il mese scorso']
}
function intervalloCal() {
  const r = st.cal.rif
  if (st.cal.modo === 'giorno') return [r, r]
  if (st.cal.modo === 'settimana') { const l = lunedi(r); return [l, piu(l, 6)] }
  const primo = new Date(r.getFullYear(), r.getMonth(), 1); const ult = new Date(r.getFullYear(), r.getMonth() + 1, 0)
  return [lunedi(primo), piu(lunedi(ult), 6)]
}

// ---------- dati di esempio (solo account di prova) ----------
function esempioCal() {
  const b = giorno0(new Date())
  const t = (g, h1, h2) => [new Date(piu(b, g).setHours(h1, 0, 0, 0)).toISOString(), new Date(piu(b, g).setHours(h2, 0, 0, 0)).toISOString()]
  const v = (g, h1, h2, titolo, rich, conf, persone, extra = {}) => { const [i, f] = t(g, h1, h2); return { annuncio_id: `es-${g}-${h1}`, titolo, mansione: titolo, stato: 'pubblicato', inizio: i, fine: f, posti: rich, posti_stato: { richiesti: rich, confermati: conf, disponibili: rich - conf }, persone: persone.map((n) => ({ nome: n, stato: 'programmato' })), rescue: false, ...extra } }
  return [v(0, 18, 23, 'Cameriere di sala', 3, 2, ['Sara', 'Luca'], { rescue: true }), v(1, 7, 11, 'Aiuto cucina', 1, 1, ['Marta']), v(2, 19, 24, 'Barista', 2, 2, ['Amina', 'Davide']),
    v(4, 10, 15, 'Allestimento evento', 4, 1, ['Yassin']), v(5, 18, 23, 'Cameriere di sala', 3, 0, []), v(9, 8, 12, 'Inventario', 2, 2, ['Sara', 'Marta']), v(-2, 18, 23, 'Cameriere di sala', 2, 2, ['Luca', 'Sara'])]
}
const ESEMPIO_PAN = { annunci: 6, annunci_aperti: 3, posti_richiesti: 14, posti_coperti: 9, completati: 2, annullati_da_te: 0, annullati_da_persone: 1, ore: 41, compensi_stimati: 512.5, rescue_attive: 1,
  da_fare: { candidature_da_valutare: 4, proposte_in_attesa: 1, adempimenti_da_dichiarare: 2, da_segnare_completati: 1, recensioni_da_scrivere: 2, date_ricorrenti_da_confermare: 3 } }
const ESEMPIO_MODELLI = [{ id: 'em1', nome: 'Cameriere per la cena', usi: 7, dati: { titolo: 'Cameriere di sala', cat: 'camerieri', euroOra: 12, inizio: 18, fine: 23, citta: 'Forlì', zona: 'Centro' } },
  { id: 'em2', nome: 'Aiuto cucina mattina', usi: 2, dati: { titolo: 'Aiuto cucina', cat: 'cucina', euroOra: 11, inizio: 7, fine: 11, citta: 'Forlì' } }]
const ESEMPIO_RIC = { ricorrenze: [{ id: 'er1', modello: 'Cameriere per la cena', giorni: [5, 6], dal: iso(new Date()), al: null, anticipo_giorni: 7, attiva: true }],
  da_confermare: [1, 2, 8].map((g, n) => ({ id: `eo${n}`, data: iso(piu(new Date(), g)), modello: 'Cameriere per la cena', dati: ESEMPIO_MODELLI[0].dati })) }
const ESEMPIO_COLL = [{ lavoratore_id: 'x', nome: 'Sara', citta: 'Forlì', completati: 6, programmati: 1, ultima: piu(new Date(), -3).toISOString(), mansioni: ['Cameriera di sala'] },
  { lavoratore_id: 'y', nome: 'Luca', citta: 'Forlimpopoli', completati: 2, programmati: 0, ultima: piu(new Date(), -20).toISOString(), mansioni: ['Cameriere', 'Barista'] }]
const etichettaEsempio = '<p class="biz-esempio"><span class="etichetta-esempio">esempio</span> Account di prova: questi sono dati di esempio, non persone o annunci veri.</p>'

// ---------- pannello principale ----------
export function pannelloBusiness(pannelloAnnunci) {
  const u = s.utente()
  if (!u) return ''
  const schede = [['annunci', 'Annunci'], ['panoramica', 'Panoramica'], ['calendario', 'Calendario'], ['modelli', 'Modelli e ricorrenze'], ['collaborazioni', 'Collaborazioni']]
  const corpo = { annunci: pannelloAnnunci, panoramica: vistaPanoramica, calendario: vistaCalendario, modelli: vistaModelli, collaborazioni: vistaCollaborazioni }[st.vista]()
  return `<nav class="biz-schede" aria-label="Strumenti per chi pubblica">${schede.map(([k, t]) => `<button type="button" data-biz-vista="${k}" aria-pressed="${st.vista === k}">${t}</button>`).join('')}</nav>
    ${st.errore && st.vista !== 'annunci' ? `<p class="conto-form__errore">${esc(st.errore)}</p>` : ''}
    <div class="biz-corpo">${corpo}</div>`
}

// ---------- Panoramica ----------
function vistaPanoramica() {
  const [dal, al, nome] = periodo()
  const chiave = `pan-${iso(dal)}`
  if (prova()) st.pan = { ...ESEMPIO_PAN, chiave }
  else if (!st.pan || st.pan.chiave !== chiave) carica(chiave, async () => { const p = await rpc('panoramica_business', { p_dal: iso(dal), p_al: iso(al) }); st.pan = { ...p, chiave } })
  const p = st.pan?.chiave === chiave ? st.pan : null
  const sel = `<div class="biz-periodo" role="group" aria-label="Periodo">${[['settimana', 'Questa settimana'], ['mese', 'Questo mese'], ['scorso', 'Mese scorso']].map(([k, t]) => `<button type="button" data-biz-periodo="${k}" aria-pressed="${st.periodo === k}">${t}</button>`).join('')}</div>`
  if (!p) return `${sel}<p class="finestra__nota">Carico la panoramica…</p>`
  const cop = p.posti_richiesti ? Math.round(100 * p.posti_coperti / p.posti_richiesti) : null
  const df = p.da_fare || {}
  const fare = [['candidature_da_valutare', 'candidature da valutare', 'annunci'], ['proposte_in_attesa', 'proposte in attesa di risposta', 'annunci'], ['adempimenti_da_dichiarare', 'incarichi con adempimenti da completare', 'annunci'],
    ['da_segnare_completati', 'incarichi da segnare come completati', 'annunci'], ['recensioni_da_scrivere', 'recensioni da scrivere', null], ['date_ricorrenti_da_confermare', 'date ricorrenti da confermare', 'modelli']].filter(([k]) => df[k])
  return `${prova() ? etichettaEsempio : ''}${sel}
    <div class="biz-kpi">
      <div><span>Annunci aperti</span><strong>${p.annunci_aperti}</strong><small>su ${p.annunci} nel periodo</small></div>
      <div><span>Posti coperti</span><strong>${p.posti_coperti}/${p.posti_richiesti}</strong><small>${cop == null ? '—' : `${cop}% di copertura`}</small><i class="biz-barra"><b style="width:${Math.min(100, cop || 0)}%"></b></i></div>
      <div><span>Ore programmate</span><strong>${String(p.ore).replace('.', ',')}</strong><small>${p.completati} ${p.completati === 1 ? 'incarico completato' : 'incarichi completati'}</small></div>
      <div><span>Compensi stimati</span><strong>${euro.format(p.compensi_stimati)}</strong><small>compenso orario × ore + bonus</small></div>
      <div><span>Annullamenti</span><strong>${p.annullati_da_te + p.annullati_da_persone}</strong><small>${p.annullati_da_te} tuoi · ${p.annullati_da_persone} delle persone</small></div>
      <div><span>Rescue attive</span><strong>${p.rescue_attive}</strong><small>ricerche urgenti in corso</small></div>
    </div>
    <p class="finestra__nota">Dati di ${nome}. I compensi sono una stima dagli importi degli annunci: non comprendono contributi, tasse o altri costi del rapporto di lavoro. Gli annullamenti non danno penalità automatiche.</p>
    <h3 class="area__sotto-titolo">Da fare</h3>
    ${fare.length ? `<ul class="biz-fare">${fare.map(([k, t, v]) => `<li><strong>${df[k]}</strong> ${t}${v ? ` <button type="button" class="tasto tasto--chiaro tasto--piccolo" data-biz-vista="${v}">Vai</button>` : ''}</li>`).join('')}</ul>` : '<p>Tutto in ordine: niente da fare adesso. 👍</p>'}
    ${riquadroPro()}`
}

// ---------- Calendario ----------
function vistaCalendario() {
  const [dal, al] = intervalloCal()
  const chiave = `cal-${iso(dal)}-${iso(al)}`
  if (prova()) { if (st.chiaveCal !== chiave) { st.voci = esempioCal(); st.chiaveCal = chiave } }
  else if (st.chiaveCal !== chiave) carica(chiave, async () => { st.voci = await rpc('calendario_business', { p_dal: iso(dal), p_al: iso(al) }) || []; st.chiaveCal = chiave })
  const r = st.cal.rif
  const titolo = st.cal.modo === 'giorno' ? r.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
    : st.cal.modo === 'settimana' ? `${dal.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} – ${al.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : r.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  const voci = st.chiaveCal === chiave ? (st.voci || []) : null
  const barra = `<div class="biz-cal-barra">
    <div class="biz-periodo" role="group" aria-label="Vista">${[['giorno', 'Giorno'], ['settimana', 'Settimana'], ['mese', 'Mese']].map(([k, t]) => `<button type="button" data-biz-calmodo="${k}" aria-pressed="${st.cal.modo === k}">${t}</button>`).join('')}</div>
    <div class="biz-cal-nav"><button type="button" class="tasto tasto--chiaro tasto--piccolo" data-biz-calvai="-1" aria-label="Precedente">‹</button>
      <button type="button" class="tasto tasto--chiaro tasto--piccolo" data-biz-calvai="0">Oggi</button>
      <button type="button" class="tasto tasto--chiaro tasto--piccolo" data-biz-calvai="1" aria-label="Successivo">›</button></div>
    <h3 class="biz-cal-titolo">${esc(titolo)}</h3></div>`
  if (!voci) return `${prova() ? etichettaEsempio : ''}${barra}<p class="finestra__nota">Carico il calendario…</p>`
  const delGiorno = (d) => voci.filter((v) => giorno0(new Date(v.inizio)).getTime() === d.getTime())
  let corpo = ''
  if (st.cal.modo === 'giorno') {
    const l = delGiorno(r)
    corpo = l.length ? `<ul class="biz-giorno">${l.map((v) => voceLunga(v)).join('')}</ul>` : '<p class="vuoto">Nessun turno in questo giorno.</p>'
  } else if (st.cal.modo === 'settimana') {
    corpo = `<div class="biz-settimana">${Array.from({ length: 7 }, (_, i) => { const d = piu(dal, i); const l = delGiorno(d); const oggi = d.getTime() === giorno0(new Date()).getTime()
      return `<section class="biz-col ${oggi ? 'biz-col--oggi' : ''}"><button type="button" class="biz-col__testa" data-biz-calgiorno="${iso(d)}"><span>${GIORNI[i]}</span> <strong>${d.getDate()}</strong></button>
        ${l.length ? l.map((v) => voceBreve(v)).join('') : '<p class="biz-vuoto">—</p>'}</section>` }).join('')}</div>`
  } else {
    const giorni = Math.round((al - dal) / 864e5) + 1
    corpo = `<div class="biz-mese" role="grid">${GIORNI.map((g) => `<div class="biz-mese__intest" role="columnheader">${g}</div>`).join('')}
      ${Array.from({ length: giorni }, (_, i) => { const d = piu(dal, i); const l = delGiorno(d); const fuori = d.getMonth() !== r.getMonth(); const oggi = d.getTime() === giorno0(new Date()).getTime()
        const scop = l.some((v) => (v.posti_stato?.disponibili || 0) > 0)
        return `<button type="button" role="gridcell" class="biz-mese__g ${fuori ? 'fuori' : ''} ${oggi ? 'oggi' : ''}" data-biz-calgiorno="${iso(d)}" aria-label="${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}: ${l.length} turni">
          <span class="n">${d.getDate()}</span>${l.length ? `<span class="biz-mese__turni ${scop ? 'scoperti' : 'coperti'}">${l.length} ${l.length === 1 ? 'turno' : 'turni'}</span>` : ''}</button>` }).join('')}</div>`
  }
  return `${prova() ? etichettaEsempio : ''}${barra}${corpo}
    <p class="biz-legenda"><span class="coperti">tutti i posti coperti</span><span class="scoperti">posti ancora liberi</span><span class="rescue">Rescue attiva</span></p>`
}
const statoVoce = (v) => (v.posti_stato?.disponibili || 0) > 0 ? 'scoperti' : 'coperti'
const conf = (v) => `${v.posti_stato?.confermati ?? v.persone?.length ?? 0}/${v.posti_stato?.richiesti ?? v.posti}`
function voceBreve(v) {
  return `<button type="button" class="biz-voce biz-voce--${statoVoce(v)}" data-biz-calgiorno="${iso(giorno0(new Date(v.inizio)))}">
    <span>${ora(v.inizio)}–${ora(v.fine)}</span><strong>${esc(v.mansione || v.titolo)}</strong><small>${conf(v)} persone${v.rescue ? ' · Rescue' : ''}</small></button>`
}
function voceLunga(v) {
  return `<li class="biz-voce biz-voce--${statoVoce(v)}"><div><span>${ora(v.inizio)}–${ora(v.fine)}</span><strong>${esc(v.titolo)}</strong>
    <small>${esc([v.zona, v.citta].filter(Boolean).join(', '))} · ${conf(v)} persone confermate${v.rescue ? ' · <b>Rescue attiva</b>' : ''}</small>
    ${v.persone?.length ? `<p class="biz-persone">${v.persone.map((p) => `<span>${esc(p.nome)}</span>`).join('')}</p>` : '<p class="biz-persone"><em>Nessuna persona confermata</em></p>'}</div></li>`
}

// ---------- Modelli e ricorrenze ----------
function vistaModelli() {
  if (prova()) { st.modelli = ESEMPIO_MODELLI; st.ric = ESEMPIO_RIC }
  else if (!st.modelli || !st.ric) carica('modelli', caricaModelli)
  if (!st.modelli || !st.ric) return '<p class="finestra__nota">Carico i modelli…</p>'
  const dc = st.ric.da_confermare || []
  return `${prova() ? etichettaEsempio : ''}
    ${dc.length ? `<section class="riquadro biz-conferma"><h3>Date ricorrenti da confermare</h3>
      <p class="finestra__nota">Gli annunci ricorrenti non vengono mai pubblicati da soli: confermi tu ogni data.</p>
      <ul class="trust-voci">${dc.map((o) => `<li><div><strong>${esc(new Date(`${o.data}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }))}</strong>
        <span>${esc(o.modello)} · ${esc(o.dati?.titolo || '')}${o.dati?.inizio != null ? ` · ${hh(o.dati.inizio)}–${hh(o.dati.fine)}` : ''}</span></div>
        <span class="pa-azioni-riga"><button type="button" class="tasto tasto--piccolo" data-biz="occ-pubblica" data-id="${esc(o.id)}">Pubblica</button>
          <button type="button" class="tasto tasto--chiaro tasto--piccolo" data-biz="occ-modifica" data-id="${esc(o.id)}">Modifica e pubblica</button>
          <button type="button" class="tasto tasto--chiaro tasto--piccolo" data-biz="occ-salta" data-id="${esc(o.id)}">Salta</button></span></li>`).join('')}</ul></section>` : ''}
    <h3 class="area__sotto-titolo">I tuoi modelli</h3>
    ${st.modelli.length ? `<ul class="trust-voci biz-modelli">${st.modelli.map((m) => `<li><div><strong>${esc(m.nome)}</strong>
      <span>${esc(m.dati?.titolo || '')}${m.dati?.euroOra ? ` · ${euro.format(m.dati.euroOra)}/ora` : ''}${m.dati?.inizio != null ? ` · ${hh(m.dati.inizio)}–${hh(m.dati.fine)}` : ''}${m.dati?.citta ? ` · ${esc(m.dati.citta)}` : ''}</span>
      <span>usato ${m.usi} ${m.usi === 1 ? 'volta' : 'volte'}</span></div>
      <span class="pa-azioni-riga"><button type="button" class="tasto tasto--piccolo" data-biz="usa" data-id="${esc(m.id)}">Usa</button>
        <button type="button" class="tasto tasto--chiaro tasto--piccolo" data-biz="ricorrente" data-id="${esc(m.id)}">Rendi ricorrente</button>
        <button type="button" class="tasto tasto--chiaro tasto--piccolo" data-biz="elimina-modello" data-id="${esc(m.id)}">Elimina</button></span></li>`).join('')}</ul>`
      : '<p class="vuoto">Nessun modello. Da un annuncio pubblicato tocca «Salva come modello»: la prossima volta lo ripubblichi in un attimo.</p>'}
    <h3 class="area__sotto-titolo">Annunci ricorrenti</h3>
    ${(st.ric.ricorrenze || []).length ? `<ul class="trust-voci">${st.ric.ricorrenze.map((r) => `<li><div><strong>${esc(r.modello)}</strong>
      <span>ogni ${r.giorni.map((g) => GIORNI_LUNGHI[g - 1]).join(', ')} · dal ${esc(new Date(`${r.dal}T12:00:00`).toLocaleDateString('it-IT'))}${r.al ? ` al ${esc(new Date(`${r.al}T12:00:00`).toLocaleDateString('it-IT'))}` : ''}</span>
      <span>${r.attiva ? `date preparate ${r.anticipo_giorni} giorni prima` : 'ferma'}</span></div>
      ${r.attiva ? `<button type="button" class="tasto tasto--chiaro tasto--piccolo" data-biz="ferma" data-id="${esc(r.id)}">Ferma</button>` : ''}</li>`).join('')}</ul>`
      : '<p class="finestra__nota">Nessun annuncio ricorrente. Da un modello tocca «Rendi ricorrente», per esempio ogni venerdì e sabato.</p>'}`
}
const hh = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`
async function caricaModelli() {
  const [m, r] = await Promise.all([leggiTabella('modelli_annuncio?select=id,nome,dati,usi,usato_il&order=usato_il.desc.nullslast,creato_il.desc'), rpc('mie_ricorrenze')])
  st.modelli = m || []; st.ric = r || { ricorrenze: [], da_confermare: [] }
}

// ---------- Collaborazioni ----------
function vistaCollaborazioni() {
  if (prova()) st.coll = ESEMPIO_COLL
  else if (!st.coll) carica('coll', async () => { st.coll = await rpc('archivio_collaborazioni') || [] })
  if (!st.coll) return '<p class="finestra__nota">Carico l’archivio…</p>'
  return `${prova() ? etichettaEsempio : ''}
    <p class="finestra__nota">Le persone con cui hai completato almeno un incarico. Solo fatti: quanti incarichi e quando. Niente note private o voti nascosti.</p>
    ${st.coll.length ? `<ul class="trust-voci biz-coll">${st.coll.map((c) => `<li><div><strong>${esc(c.nome)}</strong>
      <span>${esc(c.citta || '')}${c.citta ? ' · ' : ''}${c.completati} ${c.completati === 1 ? 'incarico completato' : 'incarichi completati'}${c.programmati ? ` · ${c.programmati} in programma` : ''}</span>
      <span>${esc((c.mansioni || []).join(', '))}${c.ultima ? ` · ultimo il ${new Date(c.ultima).toLocaleDateString('it-IT')}` : ''}${c.bloccata ? ' · bloccata da te' : ''}</span></div>
      ${prova() ? '' : `<button type="button" class="tasto tasto--chiaro tasto--piccolo" data-biz="profilo" data-id="${esc(c.lavoratore_id)}">Profilo</button>`}</li>`).join('')}</ul>`
      : '<p class="vuoto">Ancora nessuna collaborazione completata.</p>'}`
}

function riquadroPro() {
  return `<details class="biz-pro"><summary>Più sedi e più collaboratori? (Business Pro)</summary>
    <p>Sedi diverse, referenti con ruoli (titolare, referente, collaboratore) e un calendario per sede sono già previsti, ma <strong>non ancora attivi</strong>. Tutto ciò che vedi qui resta gratuito.</p></details>`
}

// ---------- dati di un annuncio vero → bozza del modulo di pubblicazione ----------
function bozzaDaAnnuncio(a) {
  const ini = a.turno ? new Date(a.turno.inizio) : null; const fin = a.turno ? new Date(a.turno.fine) : null
  const ore = (d) => d.getHours() + d.getMinutes() / 60
  const forma = { lavoro_intermittente: 'Lavoro intermittente (a chiamata)', lavoro_subordinato: 'Contratto a tempo determinato', prestazione_occasionale: 'Prestazione occasionale' }[a.tipo_rapporto] || 'Da definire con un consulente del lavoro'
  const descrizione = String(a.descrizione || '').split('\n').filter((r) => !/^(Mansioni|Rimborsi):/.test(r)).join('\n')
  return {
    titolo: a.titolo, cat: a.categoria, descrizione, mansioni: a.mansione || '', requisiti: a.requisiti ? a.requisiti.split(',').map((x) => x.trim()).filter(Boolean) : [],
    citta: a.citta, zona: a.zona || '', euroOra: Number(a.compenso_ora), natura: a.compenso_tipo === 'netto' ? 'Netto' : 'Lordo', posti: a.posti || 1,
    qualifiche: (a.qualifiche_obbligatorie || []).join(', '), sicurezza: a.info_sicurezza || '', tipo: a.tipo, chi: a.nome_pubblico, forma,
    ...(ini ? { inizio: ore(ini), fine: fin < ini || ore(fin) === 0 ? 24 : ore(fin) } : {}),
  }
}

// ---------- finestre ----------
function chiediNome(titolo, predefinito, invia) {
  s.apri(`<h2>${esc(titolo)}</h2><form class="conto-form" data-biz-nome novalidate>
    <div class="campo"><label for="bz-nome">Nome del modello</label><input id="bz-nome" name="nome" maxlength="80" value="${esc(predefinito)}" required /></div>
    <p class="finestra__nota">Il modello salva solo i dati dell’annuncio (mansione, orari, compenso, zona…), mai dati delle persone.</p>
    <p class="conto-form__errore" data-errore role="alert"></p>
    <div class="finestra__azioni"><button class="tasto" type="submit">Salva il modello</button></div></form>`)
  const f = document.querySelector('[data-biz-nome]')
  f.onsubmit = (e) => { e.preventDefault(); const v = f.elements.nome.value.trim(); if (v.length < 2) { f.querySelector('[data-errore]').textContent = 'Scrivi un nome.'; return } invia(v) }
}
async function salvaModello(nome, dati) {
  try {
    const r = await rpc('salva_modello', { p_id: null, p_nome: nome, p_dati: dati })
    if (r?.ok === false) return s.apri(`<h2>Non è stato possibile</h2><p>${{ troppi_modelli: 'Hai raggiunto il numero massimo di modelli: eliminane uno.', non_attivo: 'Funzione non attiva.' }[r.motivo] || 'Riprova tra poco.'}</p>`)
    st.modelli = null
    s.apri(`<h2>Modello salvato</h2><p>Lo trovi in Attività › Modelli e ricorrenze.</p><div class="finestra__azioni"><button type="button" class="tasto" data-biz-vista="modelli">Vai ai modelli</button></div>`)
  } catch { errore() }
}
function finestraRicorrente(id) {
  const m = st.modelli?.find((x) => x.id === id)
  if (!m) return
  if (prova()) return s.apri('<h2>Annunci ricorrenti</h2><p>Con l’account di prova le ricorrenze non vengono salvate. Con un account vero prepariamo le date in anticipo e tu confermi ogni pubblicazione.</p>')
  s.apri(`<p class="dettaglio__cat">Modello · ${esc(m.nome)}</p><h2>Rendi ricorrente</h2>
    <form class="conto-form" data-biz-ric novalidate>
      <fieldset class="conto-form__gruppo"><legend>Ogni</legend><div class="biz-giorni">${GIORNI.map((g, i) => `<label class="pillola"><input type="checkbox" name="giorni" value="${i + 1}" /> <span>${g}</span></label>`).join('')}</div></fieldset>
      <div class="campo"><label for="bz-dal">Dal</label><input id="bz-dal" name="dal" type="date" value="${iso(new Date())}" min="${iso(new Date())}" /></div>
      <div class="campo"><label for="bz-al">Al <small>facoltativo</small></label><input id="bz-al" name="al" type="date" min="${iso(new Date())}" /></div>
      <div class="campo"><label for="bz-ant">Prepara le date</label><select id="bz-ant" name="anticipo">${[3, 7, 14].map((n) => `<option value="${n}" ${n === 7 ? 'selected' : ''}>${n} giorni prima</option>`).join('')}</select></div>
      <p class="finestra__nota">Le date compaiono in «Date ricorrenti da confermare» e ti mandiamo un avviso. <strong>Nulla viene pubblicato senza la tua conferma.</strong></p>
      <p class="conto-form__errore" data-errore role="alert"></p>
      <div class="finestra__azioni"><button class="tasto" type="submit">Salva la ricorrenza</button></div></form>`)
  const f = document.querySelector('[data-biz-ric]')
  f.onsubmit = async (e) => {
    e.preventDefault()
    const giorni = [...f.querySelectorAll('[name=giorni]:checked')].map((x) => Number(x.value))
    if (!giorni.length) { f.querySelector('[data-errore]').textContent = 'Scegli almeno un giorno.'; return }
    try {
      const r = await rpc('salva_ricorrenza', { p: { modello_id: id, giorni, dal: f.elements.dal.value, al: f.elements.al.value || null, anticipo_giorni: Number(f.elements.anticipo.value) } })
      if (r?.ok === false) { f.querySelector('[data-errore]').textContent = { troppe_ricorrenze: 'Hai già troppe ricorrenze attive.', servono_giorni: 'Scegli almeno un giorno.' }[r.motivo] || 'Non è stato possibile.'; return }
      st.ric = null; st.modelli = null
      s.apri('<h2>Ricorrenza salvata</h2><p>Le prossime date sono pronte da confermare in «Modelli e ricorrenze».</p>')
      s.ridisegna()
    } catch { errore() }
  }
}
async function pubblicaOccorrenza(o) {
  try {
    const id = await pubblicaReale(bozzaDaDati(o.dati, o.data))
    if (!id) throw new Error('nessun id')
    await rpc('segna_occorrenza', { p_id: o.id, p_esito: 'pubblicata', p_annuncio: id })
    st.ric = null; st.pan = null; st.chiaveCal = ''
    s.apri(`<h2>Annuncio pubblicato</h2><p>${esc(o.dati?.titolo || o.modello)} · ${esc(new Date(`${o.data}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }))}.</p>`)
    s.ridisegna()
  } catch (e) {
    const c = codiciTrust(e)
    if (c) finestraTrust(c, 'pubblica')
    else s.apri(`<h2>Non è stato possibile</h2><p>${/futuro/.test(String(e.message)) ? 'L’orario di questa data è già passato: saltala o usa «Modifica e pubblica».' : 'Riprova tra poco.'}</p>`)
  }
}

// ---------- clic ----------
export function gestisciBusiness(e) {
  const t = e.target
  const v = t.closest?.('[data-biz-vista]')
  if (v) { st.vista = v.dataset.bizVista; document.querySelector('dialog.finestra[open]')?.close(); s.ridisegna(); return true }
  const p = t.closest?.('[data-biz-periodo]')
  if (p) { st.periodo = p.dataset.bizPeriodo; s.ridisegna(); return true }
  const cm = t.closest?.('[data-biz-calmodo]')
  if (cm) { st.cal.modo = cm.dataset.bizCalmodo; s.ridisegna(); return true }
  const cv = t.closest?.('[data-biz-calvai]')
  if (cv) {
    const n = Number(cv.dataset.bizCalvai); const r = st.cal.rif
    st.cal.rif = n === 0 ? giorno0(new Date()) : st.cal.modo === 'giorno' ? piu(r, n) : st.cal.modo === 'settimana' ? piu(r, 7 * n) : new Date(r.getFullYear(), r.getMonth() + n, 1)
    s.ridisegna(); return true
  }
  const cg = t.closest?.('[data-biz-calgiorno]')
  if (cg) { st.cal.rif = giorno0(new Date(`${cg.dataset.bizCalgiorno}T12:00:00`)); st.cal.modo = 'giorno'; s.ridisegna(); return true }
  const b = t.closest?.('[data-biz]')
  if (!b) return false
  const k = b.dataset.biz; const id = b.dataset.id
  if (k === 'profilo') apriProfiloPubblico(id)
  if (k === 'usa') {
    const m = st.modelli?.find((x) => x.id === id)
    if (m) { if (!prova()) rpc('usa_modello', { p_id: id }).catch(() => {}); apriProceduraDa(m.dati) }
  }
  if (k === 'ricorrente') finestraRicorrente(id)
  if (k === 'elimina-modello') {
    if (b.dataset.conferma !== 'si') { b.dataset.conferma = 'si'; b.textContent = 'Tocca di nuovo per eliminare'; return true }
    if (prova()) return true
    rpc('elimina_modello', { p_id: id }).then(() => { st.modelli = null; st.ric = null; s.ridisegna() }).catch(errore)
  }
  if (k === 'ferma') rpc('ferma_ricorrenza', { p_id: id }).then(() => { st.ric = null; s.ridisegna() }).catch(errore)
  const o = st.ric?.da_confermare?.find((x) => x.id === id)
  if (k === 'occ-pubblica' && o) { if (prova()) s.apri('<h2>Esempio</h2><p>Con un account vero la data verrebbe pubblicata come annuncio.</p>'); else pubblicaOccorrenza(o) }
  if (k === 'occ-modifica' && o) apriProceduraDa(o.dati, o.data, prova() ? null : (annuncio) => rpc('segna_occorrenza', { p_id: o.id, p_esito: 'pubblicata', p_annuncio: annuncio }).then(() => { st.ric = null }))
  if (k === 'occ-salta' && o && !prova()) rpc('segna_occorrenza', { p_id: o.id, p_esito: 'saltata' }).then(() => { st.ric = null; s.ridisegna() }).catch(errore)
  if (k === 'duplica') rpc('annuncio_da_duplicare', { p_annuncio: id }).then((a) => { if (!a) throw new Error(); apriProceduraDa(bozzaDaAnnuncio(a)) }).catch(errore)
  if (k === 'modello') rpc('annuncio_da_duplicare', { p_annuncio: id }).then((a) => { if (!a) throw new Error(); chiediNome('Salva come modello', a.titolo, (nome) => salvaModello(nome, bozzaDaAnnuncio(a))) }).catch(errore)
  if (k === 'modello-ultima') { const u = ultimaPubblicata(); if (u) chiediNome('Salva come modello', u.titolo, (nome) => salvaModello(nome, u)) }
  return true
}

export function avviaBusiness(strumenti) {
  s = { ...s, ...strumenti }
  document.addEventListener('click', (e) => { gestisciBusiness(e) })
  // i dati si ricaricano quando cambi scheda; qui li invalidiamo ogni 2 minuti
  setInterval(() => { st.pan = null; st.chiaveCal = ''; st.coll = null; st.ric = null }, 120000)
}
export function azzeraBusiness() { Object.assign(st, { pan: null, voci: null, chiaveCal: '', modelli: null, ric: null, coll: null, vista: 'annunci' }) }
