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
import { pulsantiMappe } from './mappe.js'
import { bloccoProposteDirette, bloccoRescue, impostaAnnunciCommittente } from './live.js'
import { bloccoSafe } from './safe.js'
import { apriCVCandidato, apriProfiloPubblico, codiciTrust, condividiCV, finestraTrust, haCV } from './trust.js'

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
    euroOra: Number(a.compenso_ora), esperienza: 'nessuna', descrizione: a.descrizione || '',
    requisiti: [...(a.qualifiche_obbligatorie || []).map((q) => `Obbligatorio: ${q}`), ...(a.requisiti ? a.requisiti.split(',').map((x) => x.trim()).filter(Boolean) : [])].slice(0, 8).concat(a.qualifiche_obbligatorie?.length || a.requisiti ? [] : ['Nessun requisito particolare']),
    sicurezza: a.info_sicurezza || '', rapporto: NOMI_RAPPORTO[a.tipo_rapporto] || '',
    ore, totale: Math.round(Number(a.compenso_ora) * ore * 100) / 100, turni, posti: a.posti,
    pagamento: `Compenso ${a.compenso_tipo === 'netto' ? 'netto' : a.compenso_tipo === 'lordo' ? 'lordo' : 'da concordare'}`,
    forma: [a.tipo_rapporto && a.tipo_rapporto !== 'da_definire' ? NOMI_RAPPORTO[a.tipo_rapporto] : '', a.condizioni || ''].filter(Boolean).join(' · '),
    mansioni: a.mansione && turni.length <= 1 ? a.mansione : turni.length > 1 ? `Annuncio con ${turni.length} turni: ${turniTesto(a.turni)}` : '',
  }
}
export async function caricaBacheca() {
  if (!SUPABASE_KEY) return
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/annunci?select=id,titolo,categoria,nome_pubblico,tipo,citta,zona,descrizione,condizioni,compenso_ora,compenso_tipo,posti,stato,mansione,requisiti,qualifiche_obbligatorie,tipo_rapporto,info_sicurezza,turni(inizio,fine)&stato=eq.pubblicato&order=creato_il.desc&limit=100`,
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
  non_ancora_finito: 'L’incarico non è ancora finito.', gia_iniziato: 'L’incarico è già iniziato: per i problemi usa «Contesta» o l’assistenza.',
  non_ancora_iniziato: 'Si può segnalare solo dopo l’orario di inizio.', gia_segnalata: 'È già stata segnalata.', nessuna_modifica: 'Non hai cambiato niente.',
  superata: 'Le condizioni sono cambiate nel frattempo: la proposta non vale più.', non_attivo: 'Funzione non attiva.', testo_breve: 'Scrivi qualche parola in più.', modifica_gia_in_attesa: 'C’è già una richiesta di cambio orari in attesa.',
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
  } catch (e) {
    const c = codiciTrust(e)
    if (c) { finestraTrust(c, 'candidatura'); return null }
    return 'Non riesco a collegarmi. Riprova tra poco.'
  }
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

// ---------- Fase 1: assegnazioni, condizioni, annullamenti ----------
function TIPO_RAPPORTO(forma = '') {
  if (/intermittente/i.test(forma)) return 'lavoro_intermittente'
  if (/determinato|busta/i.test(forma)) return 'lavoro_subordinato'
  if (/occasionale|libretto/i.test(forma)) return 'prestazione_occasionale'
  return 'da_definire'
}
const NOMI_RAPPORTO = { da_definire: 'Da definire', prestazione_occasionale: 'Prestazione occasionale', lavoro_subordinato: 'Lavoro subordinato', lavoro_intermittente: 'Lavoro intermittente', somministrazione: 'Somministrazione', lavoro_autonomo: 'Lavoro autonomo', altro: 'Altro' }
const FASI = {
  adempimenti_da_completare: 'Confermato · adempimenti da completare', pronto_avvio: 'Pronto all’avvio', in_corso: 'In corso',
  da_completare: 'Da segnare come completato', completato: 'Completato', annullato: 'Annullato', contestato: 'Contestato',
  mancata_presentazione_da_verificare: 'Presenza da verificare', archiviato: 'Archiviato',
}
const CATEGORIE_ANNULLO = [['imprevisto_personale', 'Imprevisto personale'], ['emergenza', 'Emergenza'], ['problema_organizzativo', 'Problema organizzativo'],
  ['modifica_condizioni', 'Condizioni cambiate'], ['accordo_reciproco', 'Accordo con l’altra parte'], ['altro', 'Altro']]
const FASCE = { anticipato: 'anticipato (oltre 24 ore prima)', tardivo: 'tardivo (tra 6 e 24 ore prima)', urgente: 'urgente (tra 1 e 6 ore prima)', critico: 'critico (meno di 1 ora prima)' }
const CAMPI_MOD = { compenso_ora: 'Compenso orario', mansione: 'Mansione', zona: 'Luogo / zona', bonus_urgenza: 'Bonus urgenza', note: 'Note' }
const valoreCampo = (k, v) => v == null || v === '' ? '—' : k === 'compenso_ora' ? `${euro.format(v)}/ora` : k === 'bonus_urgenza' ? (Number(v) ? euro.format(v) : 'nessuno') : String(v)
function fasciaPrevista(turni) {
  const min = turni?.length ? (new Date(turni[0].inizio) - Date.now()) / 60000 : 0
  return min >= 1440 ? 'anticipato' : min >= 360 ? 'tardivo' : min >= 60 ? 'urgente' : 'critico'
}
function condizioniHtml(c) {
  if (!c) return ''
  return `<p>${esc(c.mansione || c.titolo || '')} · ${euro.format(c.compenso_ora)}/ora${c.compenso_tipo && c.compenso_tipo !== 'non_specificato' ? ` ${esc(c.compenso_tipo)}` : ''}${Number(c.bonus_urgenza) ? ` <span class="bonus-urgenza">+ bonus urgenza ${euro.format(c.bonus_urgenza)}</span>` : ''}</p>
    ${c.tipo_rapporto ? `<p class="finestra__nota">Rapporto previsto: ${esc(NOMI_RAPPORTO[c.tipo_rapporto] || c.tipo_rapporto)}${c.info_sicurezza ? ` · Sicurezza: ${esc(c.info_sicurezza)}` : ''}</p>` : ''}`
}
function confrontoHtml(att = {}, nuove = {}) {
  return `<table class="confronto"><thead><tr><th>Voce</th><th>Ora</th><th>Proposta</th></tr></thead><tbody>
    ${Object.keys(nuove).map((k) => `<tr><th>${esc(CAMPI_MOD[k] || k)}</th><td>${esc(valoreCampo(k, att[k]))}</td><td><strong>${esc(valoreCampo(k, nuove[k]))}</strong></td></tr>`).join('')}</tbody></table>`
}
function extraLavoratore(c) {
  const i = c.incarico
  if (!i) return ''
  const m = i.modifica_condizioni; const mp = i.mancata_presentazione
  return `${i.fase && i.stato === 'programmato' ? `<p class="fase-incarico">${esc(FASI[i.fase] || i.fase)}${i.versione > 1 ? ` · condizioni v${i.versione}` : ''}</p>` : ''}
    ${i.stato === 'programmato' ? condizioniHtml(i.condizioni) : ''}
    ${i.annullamento ? `<p class="finestra__nota">Annullamento ${esc(FASCE[i.annullamento.fascia] || i.annullamento.fascia)} da parte ${i.annullamento.ruolo === 'lavoratore' ? 'tua' : 'del committente'}. Nessuna penalità automatica.</p>` : ''}
    ${m ? `<div class="avviso-modifica"><strong>Il committente propone di cambiare le condizioni</strong>${m.messaggio ? `<p>«${esc(m.messaggio)}»</p>` : ''}
      ${confrontoHtml(i.condizioni, m.nuove)}
      ${m.stato === 'chiarimento' ? `<p class="finestra__nota">Hai chiesto: «${esc(m.risposta)}». In attesa della risposta del committente.</p>` : ''}
      <div class="pa-azioni-riga"><button type="button" class="tasto" data-re="mod-accetta" data-id="${esc(m.id)}">Accetto</button>
        <button type="button" class="tasto tasto--chiaro" data-re="mod-rifiuta" data-id="${esc(m.id)}">Rifiuto</button>
        <button type="button" class="tasto tasto--chiaro" data-re="mod-chiarimento" data-id="${esc(m.id)}">Chiedi un chiarimento</button></div>
      <p class="finestra__nota">Se rifiuti, l’incarico resta valido con le condizioni originali.</p></div>` : ''}
    ${mp ? `<div class="avviso-spostamenti"><strong>Presenza da verificare</strong><p>Il committente segnala che non risultavi presente. È una segnalazione, non un fatto accertato, e non è pubblica.</p>
      ${mp.chiarimento ? `<p>La tua versione: «${esc(mp.chiarimento)}»</p>` : ''}${mp.decisione ? `<p>Decisione del team (${esc(mp.stato === 'confermata' ? 'assenza confermata' : mp.stato === 'non_confermata' ? 'assenza non confermata' : 'in revisione')}): ${esc(mp.decisione)}</p>` : ''}
      ${['segnalata', 'chiarimento_inviato', 'confermata'].includes(mp.stato) ? `<button type="button" class="tasto tasto--chiaro" data-re="mancata-chiarisci" data-id="${esc(i.id)}">${mp.stato === 'confermata' ? 'Contesta la decisione' : mp.chiarimento ? 'Aggiungi la tua versione' : 'Racconta cosa è successo'}</button>` : ''}</div>` : ''}
    ${bloccoSafe(i, 'lavoratore', c.turni)}`
}
function postiHtml(ps) {
  if (!ps || ps.richiesti <= 1 && !ps.annullati) return ''
  const v = [['richiesti', 'richiesti'], ['confermati', 'confermati'], ['riservati', 'in attesa di risposta'], ['disponibili', 'disponibili'], ['completati', 'completati'], ['scoperti', 'rimasti scoperti']]
  return `<ul class="posti-stato">${v.filter(([k]) => k === 'richiesti' || ps[k]).map(([k, n]) => `<li class="posti-stato__${k}"><strong>${ps[k]}</strong> ${n}</li>`).join('')}</ul>`
}
function extraCommittente(c, a) {
  const i = c.incarico
  if (!i) return ''
  const m = i.modifica_condizioni; const mp = i.mancata_presentazione
  return `${i.stato === 'programmato' ? `<span class="fase-incarico">${esc(FASI[i.fase] || '')}${i.versione > 1 ? ` · v${i.versione}` : ''}${Number(i.bonus_urgenza) ? ` · bonus ${euro.format(i.bonus_urgenza)}` : ''}</span>` : ''}
    ${i.annullamento ? `<span class="finestra__nota">Annullamento ${esc(i.annullamento.fascia)} (${i.annullamento.ruolo === 'committente' ? 'tuo' : 'della persona'})</span>` : ''}
    ${m ? `<span class="re-attesa">${m.stato === 'chiarimento' ? `Chiede un chiarimento: «${esc(m.risposta)}»` : 'Modifica delle condizioni in attesa di risposta'}</span>` : ''}
    ${mp ? `<span class="re-attesa">Mancata presentazione: ${esc({ segnalata: 'segnalata', chiarimento_inviato: 'la persona ha risposto', in_revisione: 'in revisione', confermata: 'confermata', non_confermata: 'non confermata', contestata: 'contestata' }[mp.stato])}</span>` : ''}`
    + (i.stato === 'programmato' ? `<span class="pa-azioni-riga">
      ${!iniziato(a.turni) && !m ? `<button type="button" class="tasto tasto--chiaro" data-re="mod-proponi" data-id="${esc(i.id)}">Proponi una modifica</button>` : ''}
      ${m ? `<button type="button" class="tasto tasto--chiaro" data-re="mod-ritira" data-id="${esc(m.id)}">Ritira la modifica</button>` : ''}
      ${!iniziato(a.turni) && !i.adempimenti_dichiarati ? `<button type="button" class="tasto tasto--chiaro" data-re="adempimenti" data-id="${esc(i.id)}">Adempimenti fatti</button>` : ''}
      ${iniziato(a.turni) && !mp ? `<button type="button" class="tasto tasto--chiaro" data-re="mancata" data-id="${esc(i.id)}">Non si è presentato</button>` : ''}
      <button type="button" class="tasto tasto--chiaro" data-re="storico" data-id="${esc(i.id)}">Storico condizioni</button></span>` : '')
    + (['programmato', 'completato', 'contestato'].includes(i.stato) ? bloccoSafe(i, 'committente', a.turni) : '')
}

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
    if (i && ['programmato', 'contestato'].includes(i.stato) && !finito(c.turni)) az.push(['mappe', 'Indicazioni', false])
    if (i?.stato === 'programmato' && !iniziato(c.turni)) az.push(['annulla', 'Annulla', true])
    if (i?.stato === 'programmato' && finito(c.turni)) az.push(['completa', 'Segna come completato', false])
    if (i && ['programmato', 'completato'].includes(i.stato) && iniziato(c.turni)) az.push(['contesta', 'Apri una contestazione', true])
    if (haCV() && !['ritirata', 'rifiutata_committente', 'rifiutata_lavoratore', 'scaduta'].includes(c.stato)) az.push(c.cv_condiviso ? ['cv-no', 'Non condividere più il CV', true] : ['cv-si', 'Condividi il CV in PDF', true])
    return `<li class="candidatura">
      <div><strong>${esc(a.titolo)}</strong> <span class="etichetta-esempio etichetta-vero">annuncio vero</span><p>${esc(a.nome)} · ${esc(a.citta)}</p>
        <p>${esc(turniTesto(c.turni))} · ${euro.format(a.compenso_ora)}/ora ${a.compenso_tipo === 'non_specificato' ? '' : esc(a.compenso_tipo)}</p>
        ${p ? `<p class="proposta-tempo">Hai <strong data-scade="${new Date(p.scade_il).getTime()}">${restante(new Date(p.scade_il).getTime() - adesso())}</strong> per confermare</p>
          ${a.condizioni ? `<p>Condizioni: ${esc(a.condizioni)}</p>` : ''}<p class="finestra__nota">Confermare non è ancora un contratto: prima di iniziare va formalizzato il rapporto.</p>` : ''}
        ${extraLavoratore(c)}
        ${m ? `<div class="avviso-spostamenti">Il committente propone nuovi orari: <strong>${esc(turniTesto(m.turni))}</strong>
          <div class="pa-azioni-riga"><button type="button" class="tasto" data-re="orari-si" data-id="${esc(m.id)}">Accetto</button><button type="button" class="tasto tasto--chiaro" data-re="orari-no" data-id="${esc(m.id)}">Non posso</button></div>
          <p class="finestra__nota">Se non puoi, l’incarico si annulla senza penalità e non conta nel limite del mese.</p></div>` : ''}</div>
      <div class="candidatura__lato"><span class="stato stato--${i ? i.stato : c.stato}">${esc(statoTesto)}</span></div>
      ${az.length ? `<div class="pa-azioni-riga">${az.map(([k, t, chiaro]) => `<button type="button" class="tasto ${chiaro ? 'tasto--chiaro' : ''}" data-re="${k}" data-id="${esc(k === 'conferma' || k === 'rifiuta' ? p.id : ['annulla', 'completa', 'contesta', 'mappe'].includes(k) ? i.id : c.candidatura_id)}" data-annuncio="${esc(a.id)}" data-inizio="${esc(c.turni?.[0]?.inizio || '')}">${t}</button>`).join('')}</div>` : ''}
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
        ${postiHtml(a.posti_stato)}
        ${bloccoRescue(a)}${bloccoProposteDirette(a)}
        ${a.modifica_in_attesa ? '<p class="avviso-spostamenti">Nuovi orari in attesa della risposta delle persone assegnate.</p>' : ''}</div>
      <div class="candidatura__lato"><span class="stato">${esc({ pubblicato: 'Pubblicato', completo: 'Posti completi', chiuso: 'Chiuso', annullato: 'Annullato' }[a.stato])}</span></div>
      ${a.candidati.length ? `<ul class="re-candidati">${a.candidati.map((c) => `<li><div><strong>${esc(c.nome)}</strong><span>${esc(c.citta || '')}${c.automunito ? ' · automunito' : ''}</span>
          <span class="stato stato--${c.incarico ? c.incarico.stato : c.stato}">${esc(c.incarico ? STATI_INCARICO[c.incarico.stato] : STATI_REALI[c.stato])}</span>
          ${extraCommittente(c, a)}
          ${c.proposta ? `<span class="re-attesa">Risposta entro <strong data-scade="${new Date(c.proposta.scade_il).getTime()}">${restante(new Date(c.proposta.scade_il).getTime() - adesso())}</strong></span>` : ''}</div>
        <div class="pa-azioni-riga">
          ${['inviata', 'in_valutazione'].includes(c.stato) && a.stato === 'pubblicato' ? `<button type="button" class="tasto" data-re="seleziona" data-id="${esc(c.candidatura_id)}">Seleziona</button><button type="button" class="tasto tasto--chiaro" data-re="scarta" data-id="${esc(c.candidatura_id)}">Rifiuta</button>` : ''}
              <button type="button" class="tasto tasto--chiaro" data-re="profilo" data-id="${esc(c.lavoratore_id)}">Profilo</button>
          ${c.cv_condiviso ? `<button type="button" class="tasto tasto--chiaro" data-re="cv" data-id="${esc(c.candidatura_id)}">CV in PDF</button>` : ''}
          ${c.incarico?.stato === 'programmato' && !iniziato(a.turni) ? `<button type="button" class="tasto tasto--chiaro" data-re="annulla" data-id="${esc(c.incarico.id)}" data-inizio="${esc(a.turni?.[0]?.inizio || '')}" data-ruolo="committente">Annulla incarico</button>` : ''}
          ${c.incarico?.stato === 'programmato' && finito(a.turni) ? `<button type="button" class="tasto" data-re="completa" data-id="${esc(c.incarico.id)}">Segna come completato</button>` : ''}
          ${c.incarico && ['programmato', 'completato'].includes(c.incarico.stato) && iniziato(a.turni) ? `<button type="button" class="tasto tasto--chiaro" data-re="contesta" data-id="${esc(c.incarico.id)}">Contesta</button>` : ''}
        </div></li>`).join('')}</ul>` : '<p class="finestra__nota">Ancora nessuna candidatura.</p>'}
      <div class="pa-azioni-riga biz-azioni-annuncio"><button type="button" class="tasto tasto--chiaro tasto--piccolo" data-biz="duplica" data-id="${esc(a.id)}">Duplica</button>
        <button type="button" class="tasto tasto--chiaro tasto--piccolo" data-biz="modello" data-id="${esc(a.id)}">Salva come modello</button></div>
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
  const id = await pubblicaSolo(b)
  // l'indirizzo preciso va in una tabella a parte: lo vede solo chi ha l'incarico confermato
  if (id && b.indirizzo) await rpc('imposta_indirizzo', { p_annuncio: id, p_indirizzo: b.indirizzo }).catch(() => {})
  return id
}
async function pubblicaSolo(b) {
  const inizio = new Date(`${b.data}T00:00:00`); inizio.setMinutes(Math.round(b.inizio * 60))
  const fine = new Date(`${b.data}T00:00:00`); fine.setMinutes(Math.round(b.fine * 60))
  return rpc('pubblica_annuncio', {
    p_annuncio: {
      nome_pubblico: b.chi, tipo: b.tipo, titolo: b.titolo, categoria: b.cat, descrizione: [b.descrizione, b.mansioni && `Mansioni: ${b.mansioni}`, b.rimborsi && `Rimborsi: ${b.rimborsi}`].filter(Boolean).join('\n'),
      condizioni: [b.forma, b.pagamento && `Pagamento: ${b.pagamento}`].filter(Boolean).join(' · ').slice(0, 500), citta: b.citta, zona: b.zona,
      compenso_ora: b.euroOra, compenso_tipo: /netto/i.test(b.natura) ? 'netto' : /lordo/i.test(b.natura) ? 'lordo' : 'non_specificato', posti: b.posti || 1,
      mansione: (b.mansioni || b.titolo).slice(0, 80), requisiti: (b.requisiti || []).join(', ').slice(0, 1000) || null,
      qualifiche_obbligatorie: String(b.qualifiche || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 10),
      tipo_rapporto: TIPO_RAPPORTO(b.forma), info_sicurezza: (b.sicurezza || '').slice(0, 1000) || null,
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
  } catch (e) {
    const c = codiciTrust(e)
    if (c) finestraTrust(c, 'candidatura')
    else s.apri('<h2>Non riesco a collegarmi</h2><p>Riprova tra poco.</p>')
  }
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

function chiediAnnullamento(id, inizio, ruolo) {
  const fascia = fasciaPrevista(inizio ? [{ inizio }] : [])
  s.apri(`<p class="dettaglio__cat">Richiesta di annullamento</p><h2>Annullare l’incarico confermato?</h2>
    <p>Sarebbe un annullamento <strong>${esc(FASCE[fascia])}</strong>.${fascia !== 'anticipato' ? ' L’altra parte ha poco tempo per organizzarsi: se puoi, avvisala anche in chat.' : ''}</p>
    <form class="conto-form" data-re-annulla novalidate>
      <fieldset class="conto-form__gruppo"><legend>Motivo (generico)</legend>
        ${CATEGORIE_ANNULLO.map(([v, t2], n) => `<label class="spunta"><input type="radio" name="categoria" value="${v}" ${n === 0 ? 'checked' : ''}/> ${t2}</label>`).join('')}</fieldset>
      <div class="campo"><label for="an-nota">Nota <span class="facoltativo">facoltativa, non scrivere dati sanitari</span></label><input id="an-nota" name="nota" maxlength="300" /></div>
      <label class="spunta"><input type="checkbox" name="assistenza" /> Vorrei essere contattato/a dall’assistenza</label>
      <p class="finestra__nota">Non ci sono penalità automatiche. L’annullamento su JobExpress non sostituisce gli eventuali obblighi del contratto: quelli vanno gestiti a parte.${ruolo === 'lavoratore' ? '' : ' La persona riceve un avviso.'}</p>
      <div class="finestra__azioni"><button type="submit" class="tasto tasto--pericolo">Conferma l’annullamento</button></div></form>`)
  document.querySelector('[data-re-annulla]').onsubmit = (e) => {
    e.preventDefault()
    const f = e.target
    esito(rpc('richiedi_annullamento', { p_incarico: id, p_categoria: f.elements.categoria.value, p_nota: f.elements.nota.value.trim() || null, p_assistenza: f.elements.assistenza.checked }),
      (r) => `<h2>Annullamento registrato</h2><p>Fascia: ${esc(FASCE[r.fascia] || r.fascia)}. L’altra parte riceve un avviso.</p>${r.posto_scoperto ? '' : '<p class="finestra__nota">Il posto torna disponibile nell’annuncio.</p>'}`)
  }
}

function chiediModifica(id) {
  const i = miei.flatMap((a) => a.candidati).find((c) => c.incarico?.id === id)?.incarico
  const c = i?.condizioni || {}
  s.apri(`<p class="dettaglio__cat">Modifica delle condizioni</p><h2>Proponi una modifica</h2>
    <p>Dopo la conferma non puoi cambiare le condizioni da solo: la persona deve accettarle. Finché non risponde valgono quelle attuali.</p>
    <form class="conto-form" data-re-modifica novalidate>
      <div class="pa-due"><div class="campo"><label for="mo-euro">Compenso orario (€)</label><input id="mo-euro" name="compenso_ora" type="number" min="1" max="200" step="0.5" value="${esc(c.compenso_ora ?? '')}" /></div>
        <div class="campo"><label for="mo-bonus">Bonus urgenza (€)</label><input id="mo-bonus" name="bonus_urgenza" type="number" min="0" max="500" step="1" value="${esc(c.bonus_urgenza ?? 0)}" /></div></div>
      <div class="campo"><label for="mo-mans">Mansione</label><input id="mo-mans" name="mansione" maxlength="80" value="${esc(c.mansione || '')}" /></div>
      <div class="campo"><label for="mo-zona">Luogo / zona</label><input id="mo-zona" name="zona" maxlength="80" value="${esc(c.zona || '')}" /></div>
      <div class="campo"><label for="mo-msg">Messaggio per la persona</label><input id="mo-msg" name="messaggio" maxlength="300" placeholder="Perché serve la modifica" /></div>
      <p class="finestra__nota">Il bonus urgenza va tutto alla persona. Per cambiare gli orari usa «Cambia orari». Ogni versione resta nello storico.</p>
      <p class="conto-form__errore" data-errore role="alert"></p>
      <div class="finestra__azioni"><button type="submit" class="tasto">Invia la proposta</button></div></form>`)
  document.querySelector('[data-re-modifica]').onsubmit = (e) => {
    e.preventDefault()
    const f = e.target
    const nuove = {}
    const num = (n) => f.elements[n].value === '' ? null : Number(f.elements[n].value)
    if (num('compenso_ora') != null && num('compenso_ora') !== Number(c.compenso_ora)) nuove.compenso_ora = num('compenso_ora')
    if (num('bonus_urgenza') != null && num('bonus_urgenza') !== Number(c.bonus_urgenza || 0)) nuove.bonus_urgenza = num('bonus_urgenza')
    for (const k of ['mansione', 'zona']) if (f.elements[k].value.trim() && f.elements[k].value.trim() !== (c[k] || '')) nuove[k] = f.elements[k].value.trim()
    if (!Object.keys(nuove).length) { f.querySelector('[data-errore]').textContent = 'Non hai cambiato niente.'; return }
    esito(rpc('proponi_modifica_condizioni', { p_incarico: id, p_nuove: nuove, p_messaggio: f.elements.messaggio.value.trim() || null }),
      () => `<h2>Proposta inviata</h2>${confrontoHtml(c, nuove)}<p class="finestra__nota">Ti avvisiamo quando la persona risponde.</p>`)
  }
}

function chiediTesto(titolo, etichetta, invia, obbligatorio = true) {
  s.apri(`<h2>${esc(titolo)}</h2><form class="conto-form" data-re-testo novalidate>
    <div class="campo"><label for="re-testo">${esc(etichetta)}</label><textarea id="re-testo" name="testo" rows="3" maxlength="500" ${obbligatorio ? 'required' : ''}></textarea></div>
    <div class="finestra__azioni"><button type="submit" class="tasto">Invia</button></div></form>`)
  document.querySelector('[data-re-testo]').onsubmit = (e) => {
    e.preventDefault()
    const v = e.target.elements.testo.value.trim()
    if (obbligatorio && v.length < 3) return e.target.elements.testo.focus()
    invia(v || null)
  }
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
  if (k === 'profilo') apriProfiloPubblico(id)
  if (k === 'cv') rpc('cv_candidatura', { p_candidatura: id }).then((p) => { if (!p) throw new Error(); return apriCVCandidato(p) }).catch(() => s.apri('<h2>CV non disponibile</h2><p>Il candidato potrebbe averlo tolto.</p>'))
  if (k === 'cv-si' || k === 'cv-no') condividiCV(id, k === 'cv-si').then(() => aggiorna()).catch(() => s.apri('<h2>Non riesco a collegarmi</h2><p>Riprova tra poco.</p>'))
  if (k === 'mappe') {
    rpc('indirizzo_incarico', { p_annuncio: b.dataset.annuncio }).then((x) => {
      const dove = x?.indirizzo ? `${x.indirizzo}, ${x.citta}` : `${x?.zona ? `${x.zona}, ` : ''}${x?.citta || ''}`
      s.apri(`<p class="dettaglio__cat">Come arrivare</p><h2>${esc(dove)}</h2>
        <p>${pulsantiMappe(dove, { percorso: true })}</p>
        <p class="finestra__nota">${x?.indirizzo ? 'Indirizzo condiviso perché hai l’incarico confermato: non diffonderlo.' : 'Chi ha pubblicato non ha indicato l’indirizzo preciso: chiedilo in chat.'}</p>`)
    }).catch(() => s.apri('<h2>Non riesco a collegarmi</h2><p>Riprova tra poco.</p>'))
  }
  if (k === 'rifiuta') esito(rpc('rispondi_proposta', { p_proposta: id, p_accetta: false }))
  if (k === 'ritira') esito(rpc('ritira_candidatura', { p_candidatura: id }))
  if (k === 'annulla') chiediAnnullamento(id, b.dataset.inizio, b.dataset.ruolo || 'lavoratore')
  if (k === 'mod-proponi') chiediModifica(id)
  if (k === 'mod-accetta') esito(rpc('rispondi_modifica_condizioni', { p_richiesta: id, p_esito: 'accetta' }), (x) => `<h2>Nuove condizioni accettate</h2><p>Ora valgono le condizioni della versione ${x.versione}. Le precedenti restano nello storico.</p>`)
  if (k === 'mod-rifiuta') esito(rpc('rispondi_modifica_condizioni', { p_richiesta: id, p_esito: 'rifiuta' }), () => '<h2>Modifica rifiutata</h2><p>L’incarico resta valido con le condizioni originali.</p>')
  if (k === 'mod-chiarimento') chiediTesto('Chiedi un chiarimento', 'Cosa vuoi sapere?', (testo) => esito(rpc('rispondi_modifica_condizioni', { p_richiesta: id, p_esito: 'chiarimento', p_testo: testo }), () => '<h2>Domanda inviata</h2><p>Il committente riceve un avviso. Finché non rispondi, valgono le condizioni originali.</p>'))
  if (k === 'mod-ritira') esito(rpc('ritira_modifica_condizioni', { p_richiesta: id }), () => '<h2>Modifica ritirata</h2>')
  if (k === 'adempimenti') esito(rpc('dichiara_adempimenti', { p_incarico: id }), () => '<h2>Segnato</h2><p>Hai dichiarato di aver completato gli adempimenti (es. comunicazioni obbligatorie). JobExpress non li verifica: restano una tua responsabilità.</p>')
  if (k === 'mancata') chiediTesto('Non si è presentato?', 'Racconta brevemente (facoltativo)', (testo) => esito(rpc('segnala_mancata_presentazione', { p_incarico: id, p_nota: testo }), () => '<h2>Segnalazione registrata</h2><p>La persona riceve un avviso e può spiegare cosa è successo. Nulla diventa pubblico e non ci sono penalità automatiche: decide il team dopo aver sentito entrambi.</p>'), false)
  if (k === 'mancata-chiarisci') chiediTesto('La tua versione', 'Cosa è successo?', (testo) => esito(rpc('chiarisci_mancata_presentazione', { p_incarico: id, p_testo: testo }), () => '<h2>Grazie</h2><p>La tua versione è stata inviata al team.</p>'))
  if (k === 'storico') rpc('storico_condizioni', { p_incarico: id }).then((v) => s.apri(`<p class="dettaglio__cat">Condizioni concordate</p><h2>Storico delle versioni</h2>
    <ol class="storico-versioni">${(v || []).map((x) => `<li><strong>Versione ${x.versione}</strong> · ${esc({ conferma: 'alla conferma', modifica: 'modifica accettata', orari: 'nuovi orari accettati' }[x.origine])} · ${new Date(x.creato_il).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      ${condizioniHtml(x.condizioni)}<p>${esc(turniTesto(x.condizioni.turni || []))}</p></li>`).join('')}</ol>`)).catch(() => s.apri('<h2>Non riesco a collegarmi</h2><p>Riprova tra poco.</p>'))
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
  impostaAnnunciCommittente(() => miei)
  caricaBacheca()
  aggiorna()
  setInterval(() => { aggiorna() }, 30000)
  setInterval(caricaBacheca, 120000)
}
