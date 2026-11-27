// Collegamento del sito ai DATI VERI (Supabase), per chi ha un account vero.
// Le regole le applica il database: qui si leggono i dati e si chiamano le sue funzioni.
//   * Bacheca: gli annunci veri compaiono insieme a quelli di esempio (con l'etichetta «annuncio vero»).
//   * Lavoratore: candidature, proposte con conto alla rovescia, conferma, ritiro, nuovi orari, contestazioni.
//   * Committente: annunci pubblicati, candidati, selezione, annullamenti, cambio orari, completamento.
//   * Notifiche: arrivano dal server.
// Con l'account di prova tutto continua a funzionare come prima, sul dispositivo.
import { SUPABASE_KEY, SUPABASE_URL } from './config.js'
import { NOME_CAT, aggiornaBacheca, registraFonte } from './incarichi.js'
import { adesso, restante } from './regole.js'
import { importaNotifiche } from './notifiche.js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const ora = (t) => new Date(t).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
const giornoBreve = (t) => new Date(t).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
const turniTesto = (turni = []) => turni.map((t) => `${giornoBreve(t.inizio)} · ${ora(t.inizio)}–${ora(t.fine)}`).join(' + ')
const isoLocale = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

let s = { utente: () => null, token: async () => null, apri: () => {}, ridisegna: () => {} }
let bacheca = []
let mie = []
let miei = []
let caricando = false
const reale = () => { const u = s.utente(); return !!(u && !u.prova && SUPABASE_KEY) }

async function rpc(nome, corpo = {}) {
  const t = await s.token()
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}`, {
    method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(15000),
  })
  const testo = await r.text()
  if (!r.ok) throw new Error(testo)
  return testo ? JSON.parse(testo) : null
}

// ---------- bacheca: annunci veri ----------
const GIORNI = ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato']
function comeIncarico(a) {
  const turni = (a.turni || []).map((t) => ({ inizio: new Date(t.inizio).getTime(), fine: new Date(t.fine).getTime() })).sort((x, y) => x.inizio - y.inizio)
  const p = turni[0]
  const d = new Date(p.inizio); const base = new Date(d); base.setHours(0, 0, 0, 0)
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0)
  const diff = Math.round((base - oggi) / 864e5)
  const inizio = (p.inizio - base.getTime()) / 3600000
  const fine = (p.fine - base.getTime()) / 3600000
  const ore = turni.reduce((t, x) => t + (x.fine - x.inizio) / 3600000, 0)
  return {
    id: a.id, reale: true, titolo: a.titolo, cat: a.categoria, chi: a.nome_pubblico, tipo: a.tipo, citta: a.citta, zona: a.zona || 'zona indicativa',
    km: 5, pos: [120, 120], giorno: diff === 0 ? 'oggi' : diff === 1 ? 'domani' : GIORNI[d.getDay()], data: isoLocale(d), inizio, fine,
    euroOra: Number(a.compenso_ora), esperienza: 'nessuna', requisiti: ['Nessun requisito particolare'], descrizione: a.descrizione || '',
    ore, totale: Math.round(Number(a.compenso_ora) * ore * 100) / 100, turni, posti: a.posti,
    pagamento: `Compenso ${a.compenso_tipo === 'netto' ? 'netto' : a.compenso_tipo === 'lordo' ? 'lordo' : 'da concordare'}`, forma: a.condizioni || '',
    mansioni: turni.length > 1 ? `Annuncio con ${turni.length} turni: ${turniTesto(a.turni)}` : '',
  }
}
export async function caricaBacheca() {
  if (!SUPABASE_KEY) return
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/annunci?select=id,titolo,categoria,nome_pubblico,tipo,citta,zona,descrizione,condizioni,compenso_ora,compenso_tipo,posti,stato,turni(inizio,fine)&stato=eq.pubblicato&order=creato_il.desc&limit=100`,
      { headers: { apikey: SUPABASE_KEY }, signal: AbortSignal.timeout(10000) })
    if (!r.ok) return
    const ora = Date.now()
    bacheca = (await r.json()).filter((a) => a.turni?.length && new Date(a.turni.map((t) => t.inizio).sort()[0]).getTime() > ora).map(comeIncarico)
    aggiornaBacheca()
  } catch { /* senza rete restano gli annunci di esempio */ }
}

// ---------- dati della persona ----------
export async function aggiorna() {
  if (!reale() || caricando) return
  caricando = true
  try {
    const [c, a, n] = await Promise.all([rpc('mie_candidature'), rpc('miei_annunci'), notificheServer()])
    mie = c || []; miei = a || []
    if (n) importaNotifiche(n)
    s.ridisegna()
  } catch { /* riprova al prossimo giro */ }
  caricando = false
}
async function notificheServer() {
  const t = await s.token()
  const r = await fetch(`${SUPABASE_URL}/rest/v1/notifiche?select=id,tipo,testo,letta,creato_il&order=creato_il.desc&limit=50`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${t}` } })
  return r.ok ? r.json() : null
}
export const segnaLetteServer = () => { if (reale()) rpc('segna_notifiche_lette', { p_ids: null }).catch(() => {}) }

// ---------- candidarsi a un annuncio vero ----------
const MOTIVI = {
  annuncio_non_disponibile: 'Questo annuncio non è più disponibile.', tuo_annuncio: 'È un tuo annuncio.', gia_iniziato: 'L’incarico è già iniziato.',
  gia_candidato: 'Ti sei già candidato a questo incarico.', limite_mensile: 'Con il piano Free hai raggiunto gli incarichi confermabili questo mese. Con Plus sono illimitati.',
  scaduta: 'La proposta è scaduta. Nessun problema: non cambia nulla per il tuo profilo.', non_in_attesa: 'Questa proposta non è più in attesa.',
  posti_esauriti: 'I posti sono già tutti assegnati o riservati.', serve_nuova_accettazione: 'Ci sono persone assegnate: i nuovi orari devono essere accettati da loro.',
  incompatibile: 'I nuovi orari si sovrappongono a un altro tuo incarico confermato: puoi solo rifiutarli.', non_iniziato: 'Si può contestare solo dopo l’inizio dell’incarico.',
  non_ancora_finito: 'L’incarico non è ancora finito.', modifica_gia_in_attesa: 'C’è già una richiesta di cambio orari in attesa.',
}
const spostamentiHtml = (l) => l?.length ? `<p class="avviso-spostamenti">Attenzione: potresti non avere abbastanza tempo per raggiungere il prossimo luogo di lavoro. Verifica gli spostamenti prima di confermare.</p>
  <ul class="lista-semplice">${l.map((x) => `<li>${esc(x.titolo)} (${esc(x.citta)}) · ${x.minuti} minuti di margine</li>`).join('')}</ul>` : ''

export async function candidaReale(a) {
  if (!reale()) return 'Questo è un annuncio vero: per candidarti serve un account vero (non quello di prova).'
  try {
    const r = await rpc('candidati', { p_annuncio: a.id })
    if (r.ok) { aggiorna(); return `Candidatura inviata a ${a.chi}. La trovi in «La mia area» → Attività.${r.avvisi_spostamenti?.length ? ' Attenzione: è vicino a un altro tuo incarico, controlla gli spostamenti.' : ''}` }
    if (r.motivo === 'sovrapposte' || r.motivo === 'incarico_confermato') { conflitti(a, r); return null }
    return MOTIVI[r.motivo] || 'Non è stato possibile inviare la candidatura.'
  } catch { return 'Non riesco a collegarmi. Riprova tra poco.' }
}

function conflitti(a, r) {
  const confermato = r.motivo === 'incarico_confermato'
  s.apri(`<p class="dettaglio__cat">${confermato ? 'Orario già occupato' : 'Fascia oraria piena'}</p>
    <h2>${confermato ? 'Hai già un incarico confermato' : `Hai già ${r.conflitti.length} candidature qui`}</h2>
    <p>${confermato ? 'In questo orario hai già un incarico confermato: non puoi candidarti.' : 'Hai già tre candidature attive in questa fascia oraria. Per candidarti a questo incarico, ritira una delle candidature incompatibili.'}</p>
    <ul class="conflitti">${r.conflitti.map((c) => `<li class="conflitto"><div><strong>${esc(c.titolo)}</strong><p>${esc(c.nome)}</p>
      <p class="conflitto__quando">${esc(turniTesto(c.turni))}</p><p>${euro.format(c.compenso_ora)}/ora <span class="stato">${esc(STATI_REALI[c.stato] || c.stato)}</span></p></div>
      ${confermato ? '' : `<div class="conflitto__azioni"><button type="button" class="tasto tasto--chiaro" data-re-conf-ritira="${esc(c.candidatura_id)}">Ritira</button></div>`}</li>`).join('')}</ul>
    <p class="finestra__nota" data-re-conf-esito aria-live="polite">${confermato ? '' : 'Nessuna candidatura viene ritirata in automatico: scegli tu.'}</p>`)
  const f = document.querySelector('dialog.finestra')
  f.querySelectorAll('[data-re-conf-ritira]').forEach((b) => {
    b.onclick = async () => {
      b.disabled = true
      const x = await rpc('ritira_candidatura', { p_candidatura: b.dataset.reConfRitira }).catch(() => null)
      f.querySelector('[data-re-conf-esito]').textContent = x?.ok ? 'Candidatura ritirata. Ora puoi candidarti a questo incarico.' : 'Ritiro non riuscito, riprova.'
      if (x?.ok) { b.closest('li').classList.add('conflitto--ritirata'); aggiorna() }
    }
  })
  void a
}

// ---------- pannello del lavoratore ----------
export const STATI_REALI = {
  inviata: 'Inviata', in_valutazione: 'In valutazione', in_attesa_conferma: 'In attesa di conferma', confermata: 'Confermata',
  rifiutata_committente: 'Rifiutata dal committente', rifiutata_lavoratore: 'Rifiutata da te', ritirata: 'Ritirata',
  ritirata_incompatibile: 'Ritirata per incompatibilità', scaduta: 'Proposta scaduta', annullata: 'Annullata',
}
const STATI_INCARICO = { programmato: 'Programmato', completato: 'Completato', annullato: 'Annullato', contestato: 'Contestato' }
const inCorso = (turni) => { const n = Date.now(); return turni?.some((t) => new Date(t.inizio) <= n && new Date(t.fine) > n) }
const iniziato = (turni) => turni?.length && new Date(turni[0].inizio) <= Date.now()
const finito = (turni) => turni?.length && new Date(turni[turni.length - 1].fine) <= Date.now()

export function pannelloLavoratoreReale() {
  if (!reale()) return ''
  if (!mie.length) return '<p class="finestra__nota">Candidature agli annunci veri: ancora nessuna.</p>'
  return `<h3 class="area__sotto-titolo">Annunci veri</h3><ul class="candidature">${mie.map((c) => {
    const a = c.annuncio; const i = c.incarico; const p = c.proposta; const m = c.modifica
    const statoTesto = i ? (inCorso(c.turni) && i.stato === 'programmato' ? 'In corso' : STATI_INCARICO[i.stato]) : STATI_REALI[c.stato]
    const az = []
    if (['inviata', 'in_valutazione'].includes(c.stato)) az.push(['ritira', 'Ritira', true])
    if (p) az.push(['conferma', 'Conferma', false], ['rifiuta', 'Rifiuta', true])
    if (i?.stato === 'programmato' && !iniziato(c.turni)) az.push(['annulla', 'Annulla', true])
    if (i?.stato === 'programmato' && finito(c.turni)) az.push(['completa', 'Segna come completato', false])
    if (i && ['programmato', 'completato'].includes(i.stato) && iniziato(c.turni)) az.push(['contesta', 'Apri una contestazione', true])
    return `<li class="candidatura">
      <div><strong>${esc(a.titolo)}</strong> <span class="etichetta-esempio etichetta-vero">annuncio vero</span><p>${esc(a.nome)} · ${esc(a.citta)}</p>
        <p>${esc(turniTesto(c.turni))} · ${euro.format(a.compenso_ora)}/ora ${a.compenso_tipo === 'non_specificato' ? '' : esc(a.compenso_tipo)}</p>
        ${p ? `<p class="proposta-tempo">Hai <strong data-scade="${new Date(p.scade_il).getTime()}">${restante(new Date(p.scade_il).getTime() - adesso())}</strong> per confermare</p>
          ${a.condizioni ? `<p>Condizioni: ${esc(a.condizioni)}</p>` : ''}<p class="finestra__nota">Confermare non è ancora un contratto: prima di iniziare va formalizzato il rapporto.</p>` : ''}
        ${m ? `<div class="avviso-spostamenti">Il committente propone nuovi orari: <strong>${esc(turniTesto(m.turni))}</strong>
          <div class="pa-azioni-riga"><button type="button" class="tasto" data-re="orari-si" data-id="${esc(m.id)}">Accetto</button><button type="button" class="tasto tasto--chiaro" data-re="orari-no" data-id="${esc(m.id)}">Non posso</button></div>
          <p class="finestra__nota">Se non puoi, l’incarico si annulla senza penalità e non conta nel limite del mese.</p></div>` : ''}</div>
      <div class="candidatura__lato"><span class="stato stato--${i ? i.stato : c.stato}">${esc(statoTesto)}</span></div>
      ${az.length ? `<div class="pa-azioni-riga">${az.map(([k, t, chiaro]) => `<button type="button" class="tasto ${chiaro ? 'tasto--chiaro' : ''}" data-re="${k}" data-id="${esc(k === 'conferma' || k === 'rifiuta' ? p.id : ['annulla', 'completa', 'contesta'].includes(k) ? i.id : c.candidatura_id)}" data-annuncio="${esc(a.id)}">${t}</button>`).join('')}</div>` : ''}
    </li>`
  }).join('')}</ul>`
}

// ---------- pannello del committente ----------
const isoInput = (t) => { const d = new Date(t); return `${isoLocale(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
export function pannelloCommittenteReale() {
  if (!reale()) return ''
  if (!miei.length) return '<p class="finestra__nota">Annunci veri pubblicati: ancora nessuno. Quelli che pubblichi con il tuo account vero arrivano qui.</p>'
  return `<h3 class="area__sotto-titolo">Annunci veri pubblicati</h3><ul class="candidature">${miei.map((a) => `
    <li class="candidatura re-annuncio">
      <div><strong>${esc(a.titolo)}</strong> <span class="etichetta-esempio etichetta-vero">annuncio vero</span><p>${esc(NOME_CAT[a.categoria] || a.categoria)} · ${esc(a.citta)} · ${euro.format(a.compenso_ora)}/ora</p>
        <p>${esc(turniTesto(a.turni))} · posti ${a.posti} (liberi ${Math.max(0, a.posti_liberi)})</p>
        ${a.modifica_in_attesa ? '<p class="avviso-spostamenti">Nuovi orari in attesa della risposta delle persone assegnate.</p>' : ''}</div>
      <div class="candidatura__lato"><span class="stato">${esc({ pubblicato: 'Pubblicato', completo: 'Posti completi', chiuso: 'Chiuso', annullato: 'Annullato' }[a.stato])}</span></div>
      ${a.candidati.length ? `<ul class="re-candidati">${a.candidati.map((c) => `<li><div><strong>${esc(c.nome)}</strong><span>${esc(c.citta || '')}${c.automunito ? ' · automunito' : ''}</span>
          <span class="stato stato--${c.incarico ? c.incarico.stato : c.stato}">${esc(c.incarico ? STATI_INCARICO[c.incarico.stato] : STATI_REALI[c.stato])}</span>
          ${c.proposta ? `<span class="re-attesa">Risposta entro <strong data-scade="${new Date(c.proposta.scade_il).getTime()}">${restante(new Date(c.proposta.scade_il).getTime() - adesso())}</strong></span>` : ''}</div>
        <div class="pa-azioni-riga">
          ${['inviata', 'in_valutazione'].includes(c.stato) && a.stato === 'pubblicato' ? `<button type="button" class="tasto" data-re="seleziona" data-id="${esc(c.candidatura_id)}">Seleziona</button><button type="button" class="tasto tasto--chiaro" data-re="scarta" data-id="${esc(c.candidatura_id)}">Rifiuta</button>` : ''}
          ${c.incarico?.stato === 'programmato' && !iniziato(a.turni) ? `<button type="button" class="tasto tasto--chiaro" data-re="annulla" data-id="${esc(c.incarico.id)}">Annulla incarico</button>` : ''}
          ${c.incarico?.stato === 'programmato' && finito(a.turni) ? `<button type="button" class="tasto" data-re="completa" data-id="${esc(c.incarico.id)}">Segna come completato</button>` : ''}
          ${c.incarico && ['programmato', 'completato'].includes(c.incarico.stato) && iniziato(a.turni) ? `<button type="button" class="tasto tasto--chiaro" data-re="contesta" data-id="${esc(c.incarico.id)}">Contesta</button>` : ''}
        </div></li>`).join('')}</ul>` : '<p class="finestra__nota">Ancora nessuna candidatura.</p>'}
      ${['pubblicato', 'completo'].includes(a.stato) && !iniziato(a.turni) ? `<details class="re-orari"><summary>Cambia orari o annulla</summary>
        <form class="cv-ed__form" data-re-orari="${esc(a.id)}" novalidate>
          <label><span>Nuovo inizio</span><input type="datetime-local" name="inizio" value="${isoInput(a.turni[0].inizio)}" /></label>
          <label><span>Nuova fine</span><input type="datetime-local" name="fine" value="${isoInput(a.turni[0].fine)}" /></label>
          <button type="submit" class="tasto tasto--chiaro">Proponi nuovi orari</button></form>
        <p class="finestra__nota">Se ci sono persone assegnate, i nuovi orari valgono solo dopo che li hanno accettati.</p>
        <button type="button" class="tasto tasto--pericolo" data-re="annulla-annuncio" data-id="${esc(a.id)}">Annulla l’annuncio</button></details>` : ''}
    </li>`).join('')}</ul>`
}

// ---------- pubblicare un annuncio vero ----------
export async function pubblicaReale(b) {
  if (!reale()) return null
  const inizio = new Date(`${b.data}T00:00:00`); inizio.setMinutes(Math.round(b.inizio * 60))
  const fine = new Date(`${b.data}T00:00:00`); fine.setMinutes(Math.round(b.fine * 60))
  return rpc('pubblica_annuncio', {
    p_annuncio: {
      nome_pubblico: b.chi, tipo: b.tipo, titolo: b.titolo, categoria: b.cat, descrizione: [b.descrizione, b.mansioni && `Mansioni: ${b.mansioni}`, b.rimborsi && `Rimborsi: ${b.rimborsi}`].filter(Boolean).join('\n'),
      condizioni: [b.forma, b.pagamento && `Pagamento: ${b.pagamento}`].filter(Boolean).join(' · ').slice(0, 500), citta: b.citta, zona: b.zona,
      compenso_ora: b.euroOra, compenso_tipo: /netto/i.test(b.natura) ? 'netto' : /lordo/i.test(b.natura) ? 'lordo' : 'non_specificato', posti: 1,
    },
    p_turni: [{ inizio: inizio.toISOString(), fine: fine.toISOString() }],
  })
}

// ---------- azioni ----------
async function esito(promessa, ok) {
  try {
    const r = await promessa
    if (r && r.ok === false) s.apri(`<h2>Non è stato possibile</h2><p>${esc(MOTIVI[r.motivo] || 'Riprova tra poco.')}</p>`)
    else if (ok) s.apri(ok(r))
  } catch { s.apri('<h2>Non riesco a collegarmi</h2><p>Riprova tra poco.</p>') }
  aggiorna(); caricaBacheca()
}

async function conferma(id, annuncio, forza = false) {
  if (!forza) {
    const avvisi = await rpc('controlla_spostamenti', { p_annuncio: annuncio }).catch(() => [])
    if (avvisi?.length) {
      s.apri(`<p class="dettaglio__cat">Controlla gli spostamenti</p><h2>Poco tempo tra due incarichi</h2>${spostamentiHtml(avvisi)}
        <p class="finestra__nota">Non è un blocco: se i due posti sono vicini, puoi confermare lo stesso.</p>
        <div class="finestra__azioni"><button type="button" class="tasto" data-re-forza>Conferma comunque</button></div>`)
      document.querySelector('[data-re-forza]').onclick = () => conferma(id, annuncio, true)
      return
    }
  }
  esito(rpc('rispondi_proposta', { p_proposta: id, p_accetta: true }), (r) => `<p class="dettaglio__cat">Doppia conferma completata</p><h2>Incarico confermato</h2>
    ${r.ritirate ? `<p>Abbiamo ritirato ${r.ritirate} candidatur${r.ritirate === 1 ? 'a' : 'e'} con orari incompatibili.</p>` : ''}
    <p class="finestra__nota">La conferma su JobExpress non sostituisce il contratto di lavoro né gli adempimenti obbligatori: prima di iniziare va formalizzato il rapporto.</p>`)
}

function chiediMotivo(id) {
  s.apri(`<h2>Apri una contestazione</h2><form class="conto-form" data-re-contesta novalidate>
    <div class="campo"><label for="re-motivo">Cosa non è andato?</label><textarea id="re-motivo" name="motivo" rows="3" maxlength="1000" required></textarea></div>
    <p class="finestra__nota">Il team JobExpress la esaminerà. L’altra persona riceve un avviso.</p>
    <div class="finestra__azioni"><button type="submit" class="tasto">Invia</button></div></form>`)
  document.querySelector('[data-re-contesta]').onsubmit = (e) => {
    e.preventDefault()
    esito(rpc('contesta_incarico', { p_incarico: id, p_motivo: e.target.elements.motivo.value }), () => '<h2>Contestazione inviata</h2><p>Ti aggiorneremo nelle notifiche.</p>')
  }
}

// true se l'evento è stato gestito
export function gestisciReale(e) {
  const t = e.target
  if (e.type === 'submit' && t.closest('[data-re-orari]')) {
    e.preventDefault()
    const f = t.closest('[data-re-orari]')
    const i = new Date(f.elements.inizio.value); const fi = new Date(f.elements.fine.value)
    if (!(fi > i)) { s.apri('<h2>Orari non validi</h2><p>La fine deve essere dopo l’inizio.</p>'); return true }
    esito(rpc('proponi_nuovi_orari', { p_annuncio: f.dataset.reOrari, p_turni: [{ inizio: i.toISOString(), fine: fi.toISOString() }] }),
      (r) => r?.in_attesa ? '<h2>Nuovi orari proposti</h2><p>Le persone assegnate devono accettarli. Ti avvisiamo quando rispondono.</p>' : '<h2>Orari aggiornati</h2><p>Chi si era candidato riceve un avviso e può ricandidarsi.</p>')
    return true
  }
  if (e.type !== 'click') return false
  const b = t.closest('[data-re]')
  if (!b) return false
  const id = b.dataset.id
  const k = b.dataset.re
  if (k === 'conferma') conferma(id, b.dataset.annuncio)
  if (k === 'rifiuta') esito(rpc('rispondi_proposta', { p_proposta: id, p_accetta: false }))
  if (k === 'ritira') esito(rpc('ritira_candidatura', { p_candidatura: id }))
  if (k === 'annulla') esito(rpc('annulla_incarico', { p_incarico: id }), () => '<h2>Incarico annullato</h2><p>L’altra persona riceve un avviso.</p>')
  if (k === 'completa') esito(rpc('completa_incarico', { p_incarico: id }), () => '<h2>Incarico completato</h2><p>Grazie! Ora potete lasciarvi una recensione.</p>')
  if (k === 'contesta') chiediMotivo(id)
  if (k === 'orari-si') esito(rpc('rispondi_nuovi_orari', { p_modifica: id, p_accetta: true }), () => '<h2>Nuovi orari accettati</h2>')
  if (k === 'orari-no') esito(rpc('rispondi_nuovi_orari', { p_modifica: id, p_accetta: false }), () => '<h2>Va bene</h2><p>L’incarico è annullato senza penalità e non conta nel limite del mese.</p>')
  if (k === 'seleziona') esito(rpc('seleziona_candidato', { p_candidatura: id }), (r) => `<h2>Proposta inviata</h2><p>La persona ha tempo fino alle ${ora(r.scade_il)} per confermare. L’incarico è assegnato solo dopo la sua conferma.</p>`)
  if (k === 'scarta') esito(rpc('rifiuta_candidato', { p_candidatura: id }))
  if (k === 'annulla-annuncio') esito(rpc('annulla_annuncio', { p_annuncio: id }), () => '<h2>Annuncio annullato</h2><p>Chi si era candidato riceve un avviso.</p>')
  return true
}

export function avviaReale(strumenti) {
  s = { ...s, ...strumenti }
  registraFonte(() => bacheca)
  caricaBacheca()
  aggiorna()
  setInterval(() => { aggiorna() }, 30000)
  setInterval(caricaBacheca, 120000)
}
