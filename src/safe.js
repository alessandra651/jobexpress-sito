// JobExpress Safe (essenziale) e recensioni reciproche a doppio cieco.
//   * Centro sicurezza: 112, consigli, le mie segnalazioni (con esito e contestazione), persone bloccate.
//   * Condividi l'incarico con una persona di fiducia: link temporaneo e revocabile, indirizzo solo se lo scegli.
//     Nessun GPS, nessun tracciamento: la persona vede solo cosa fai, dove (zona) e quando.
//   * Segnalazioni con priorità e allegati protetti (bucket privato, li vedono solo chi segnala e il team).
//   * Recensioni: 14 giorni, nascoste finché scrivete entrambi o finché scade il tempo. Le regole stanno nel database.
// Contatti di fiducia registrati e avvisi automatici: NON attivi (servono valutazioni legali).
import { SUPABASE_KEY, SUPABASE_URL } from './config.js'

const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const data = (t) => t ? new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const dataOra = (t) => new Date(t).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

let s = { utente: () => null, token: async () => null, apri: () => {}, ridisegna: () => {} }
const st = { recensioni: [], segnalazioni: [], blocchi: [], caricato: false }
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
const errore = () => s.apri('<h2>Non riesco a collegarmi</h2><p>Riprova tra poco.</p>')

// ---------- categorie ----------
export const TIPI_SEGNALAZIONE = [
  ['molestie', 'Molestie o comportamenti inappropriati'], ['aggressivita', 'Comportamento aggressivo o minacce'],
  ['discriminazione', 'Discriminazione'], ['condizioni_pericolose', 'Condizioni di lavoro pericolose'],
  ['accordi_non_rispettati', 'Accordi non rispettati (orari, mansioni)'], ['mancato_pagamento', 'Mancato pagamento'],
  ['lavoro_irregolare', 'Richiesta di lavoro irregolare (in nero)'], ['annuncio_fraudolento', 'Annuncio falso o truffa'],
  ['profilo_falso', 'Profilo falso'], ['furto_identita', 'Qualcuno usa la mia identità'], ['foto', 'Foto non adatta'], ['altro', 'Altro'],
]
const NOME_TIPO = Object.fromEntries([...TIPI_SEGNALAZIONE, ['recensione', 'Recensione'], ['comportamento', 'Comportamento scorretto'], ['annuncio', 'Annuncio'], ['sicurezza', 'Sicurezza']])
const STATO_SEGN = { aperta: 'Ricevuta', in_esame: 'In esame', info_richieste: 'Servono altre informazioni', in_revisione: 'In revisione', risolta: 'Gestita', archiviata: 'Archiviata', contestata: 'Hai contestato l’esito' }
// il lavoratore valuta il committente; il committente valuta il lavoratore
export const CATEGORIE = {
  lavoratore: [['rispetto_compenso', 'Compenso come concordato'], ['rispetto_orari', 'Orari rispettati'], ['ambiente', 'Ambiente di lavoro'], ['comunicazione', 'Comunicazione'], ['organizzazione', 'Organizzazione']],
  committente: [['puntualita', 'Puntualità'], ['professionalita', 'Professionalità'], ['qualita', 'Qualità del lavoro'], ['comunicazione', 'Comunicazione'], ['rispetto_accordi', 'Rispetto degli accordi']],
}
export const NOME_CATEGORIA = Object.fromEntries([...CATEGORIE.lavoratore, ...CATEGORIE.committente])
const stelle = (m) => m == null ? '' : `<span class="stelle" aria-label="${String(m).replace('.', ',')} su 5">${'★'.repeat(Math.round(m))}${'☆'.repeat(5 - Math.round(m))}</span>`
const num = (m) => Number(m).toLocaleString('it-IT', { maximumFractionDigits: 1 })

// ---------- caricamento ----------
export async function aggiornaSafe() {
  if (!reale()) { st.caricato = false; return }
  try {
    const [r, sg, bl] = await Promise.all([rpc('mie_recensioni'), rpc('mie_segnalazioni'), rpc('miei_blocchi')])
    const prima = JSON.stringify([st.recensioni, st.segnalazioni, st.blocchi])
    st.recensioni = r || []; st.segnalazioni = sg || []; st.blocchi = bl || []; st.caricato = true
    // ridisegna solo se qualcosa è cambiato, per non disturbare chi sta scrivendo in un modulo
    if (JSON.stringify([st.recensioni, st.segnalazioni, st.blocchi]) !== prima) s.ridisegna()
  } catch { /* rete assente: riprova al prossimo giro */ }
}

// ---------- pulsanti sull'incarico ----------
const finito = (turni) => turni?.length && new Date(turni[turni.length - 1].fine) <= Date.now()
export function bloccoSafe(i, ruolo, turni) {
  if (!i) return ''
  const b = []
  if (ruolo === 'lavoratore' && i.stato === 'programmato' && !finito(turni)) b.push(`<button type="button" class="tasto tasto--chiaro" data-safe="condividi" data-id="${esc(i.id)}">Condividi con una persona di fiducia</button>`)
  if (i.stato === 'completato') {
    const r = st.recensioni.find((x) => x.incarico_id === i.id)
    if (r && r.periodo?.stato === 'aperto' && (!r.mia || r.mia.stato === 'bozza')) b.push(`<button type="button" class="tasto" data-safe="recensisci" data-id="${esc(i.id)}">${r.mia ? 'Completa la recensione' : 'Lascia una recensione'}</button>`)
    else if (r?.mia?.stato === 'inviata') b.push('<span class="re-attesa">Recensione inviata: sarà visibile quando scrive anche l’altra parte o tra al massimo 14 giorni.</span>')
  }
  b.push(`<button type="button" class="tasto tasto--chiaro" data-safe="segnala" data-incarico="${esc(i.id)}">Segnala un problema</button>`)
  return `<div class="pa-azioni-riga safe-azioni">${b.join('')}</div>`
}

// ---------- Centro sicurezza ----------
export function riquadroSafe(u) {
  const prova = u?.prova
  return `<section class="riquadro safe-centro" id="centro-sicurezza">
    <h3>Centro sicurezza</h3>
    <div class="safe-112"><div><strong>Sei in pericolo adesso?</strong><p>Chiama subito il numero unico di emergenza. JobExpress non è un servizio di emergenza.</p></div>
      <a class="tasto tasto--pericolo" href="tel:112">Chiama il 112</a></div>
    <details class="safe-consigli"><summary>Consigli prima di un incarico</summary>
      <ul class="lista-semplice">
        <li>Controlla mansione, orari e compenso nell’incarico: valgono le condizioni concordate e lo storico delle versioni.</li>
        <li>Puoi condividere l’incarico con una persona di fiducia: riceve un link con cosa fai, la zona e gli orari. L’indirizzo solo se lo scegli tu.</li>
        <li>Se ti chiedono di lavorare in nero, di pagare per lavorare o di mandare documenti in chat, fermati e segnalalo.</li>
        <li>Se qualcosa non va durante il lavoro puoi andartene: la tua sicurezza viene prima. Nessuna penalità automatica.</li>
      </ul></details>
    <p class="finestra__nota">La condivisione è manuale: JobExpress non usa il GPS e non segue i tuoi spostamenti. Contatti di fiducia registrati e avvisi automatici non sono ancora attivi.</p>
    ${prova ? '<p class="finestra__nota"><strong>Account di prova:</strong> segnalazioni, blocchi e link di condivisione funzionano solo con un account vero.</p>' : `
    <h4>Le mie segnalazioni</h4>
    ${st.segnalazioni.length ? `<ul class="trust-voci">${st.segnalazioni.map((x) => `<li><div><strong>${esc(NOME_TIPO[x.tipo] || x.tipo)}</strong>
      <span>${data(x.creato_il)} · ${esc(STATO_SEGN[x.stato] || x.stato)}${x.priorita === 'urgente' ? ' · priorità alta' : ''}</span>
      ${x.esito ? `<span>Esito: ${esc(x.esito)}</span>` : ''}${x.contestazione ? `<span>La tua contestazione: ${esc(x.contestazione)}</span>` : ''}</div>
      ${['risolta', 'archiviata'].includes(x.stato) ? `<button type="button" class="tasto tasto--chiaro tasto--piccolo" data-safe="contesta-segn" data-id="${esc(x.id)}">Non sono d’accordo</button>` : ''}</li>`).join('')}</ul>`
      : '<p class="finestra__nota">Nessuna segnalazione. Puoi segnalare un incarico, un annuncio, un profilo o una recensione dal loro pulsante «Segnala».</p>'}
    <button type="button" class="tasto tasto--chiaro" data-safe="segnala">Segnala un problema</button>
    <h4>Persone bloccate</h4>
    ${st.blocchi.length ? `<ul class="trust-voci">${st.blocchi.map((b) => `<li><div><strong>${esc(b.nome)}</strong><span>bloccata il ${data(b.creato_il)}</span></div>
      <button type="button" class="tasto tasto--chiaro tasto--piccolo" data-safe="sblocca" data-id="${esc(b.id)}">Sblocca</button></li>`).join('')}</ul>`
      : '<p class="finestra__nota">Nessuna persona bloccata. Chi blocchi non può candidarsi ai tuoi annunci, mandarti proposte o scriverti.</p>'}`}
    <p class="finestra__nota">Le segnalazioni sono riservate: la persona segnalata non sa chi l’ha fatta. Non ci sono penalità automatiche: decide il team dopo aver sentito entrambe le parti.</p>
  </section>`
}

// ---------- Recensioni (account vero) ----------
export function riquadroRecensioniReali() {
  const da = st.recensioni.filter((r) => r.periodo?.stato === 'aperto' && (!r.mia || r.mia.stato === 'bozza'))
  const attesa = st.recensioni.filter((r) => r.mia?.stato === 'inviata')
  const ric = st.recensioni.filter((r) => r.ricevuta)
  const scritte = st.recensioni.filter((r) => ['pubblicata', 'rimossa'].includes(r.mia?.stato))
  return `<div class="recensioni">
    <h3>Le tue recensioni</h3>
    <p class="finestra__nota">Doppio cieco: nessuno dei due legge la recensione dell’altro prima di aver scritto la propria. Escono insieme quando scrivete entrambi, oppure dopo 14 giorni.</p>
    ${da.length ? `<h4>Da scrivere</h4><ul class="trust-voci">${da.map((r) => `<li><div><strong>${esc(r.titolo)}</strong><span>con ${esc(r.altra_parte)} · entro il ${data(r.periodo.chiude_il)}${r.mia ? ' · bozza salvata' : ''}</span></div>
      <button type="button" class="tasto tasto--piccolo" data-safe="recensisci" data-id="${esc(r.incarico_id)}">${r.mia ? 'Completa' : 'Scrivi'}</button></li>`).join('')}</ul>` : ''}
    ${attesa.length ? `<h4>In attesa di pubblicazione</h4><ul class="trust-voci">${attesa.map((r) => `<li><div><strong>${esc(r.titolo)}</strong><span>Inviata. Esce quando scrive anche ${esc(r.altra_parte)} o entro il ${data(r.periodo.chiude_il)}.</span></div></li>`).join('')}</ul>` : ''}
    ${ric.length ? `<h4>Ricevute</h4><ul class="recensioni__lista">${ric.map((r) => `<li><div><strong>${esc(r.altra_parte)}</strong> ${stelle(r.ricevuta.media)} ${r.ricevuta.media != null ? num(r.ricevuta.media) : ''}
      <p>${esc(r.ricevuta.commento || 'Nessun commento')}</p><small>${esc(r.titolo)} · ${data(r.ricevuta.pubblicata_il)}</small>
      ${r.ricevuta.risposta ? `<p class="recensione-risposta"><strong>La tua risposta:</strong> ${esc(r.ricevuta.risposta)}</p>` : ''}</div>
      <span class="pa-azioni-riga">${r.ricevuta.risposta ? '' : `<button type="button" class="tasto tasto--chiaro tasto--piccolo" data-safe="rispondi" data-id="${esc(r.ricevuta.id)}">Rispondi</button>`}
        <button type="button" class="tasto tasto--chiaro tasto--piccolo" data-safe="segnala-rec" data-id="${esc(r.ricevuta.id)}">Segnala</button></span></li>`).join('')}</ul>` : ''}
    ${scritte.length ? `<details class="storico"><summary>Recensioni che hai scritto (${scritte.length})</summary><ul class="recensioni__lista">${scritte.map((r) => `<li><div><strong>${esc(r.altra_parte)}</strong> ${stelle(r.mia.media)}<p>${esc(r.mia.commento || 'Nessun commento')}</p><small>${esc(r.titolo)}${r.mia.stato === 'rimossa' ? ' · rimossa dal team' : ''}</small>${r.mia.risposta ? `<p class="recensione-risposta"><strong>Risposta:</strong> ${esc(r.mia.risposta)}</p>` : ''}</div></li>`).join('')}</ul></details>` : ''}
    ${!st.recensioni.length ? '<p>Nessuna recensione ancora. Si possono scrivere solo dopo un incarico completato, e solo tra le due persone che hanno lavorato insieme.</p>' : ''}
  </div>`
}

// Reputazione nel profilo pubblico (solo recensioni pubblicate). Chi è nuovo NON ha un voto basso: ha «nessuna recensione».
export function bloccoReputazione(rep) {
  if (!rep) return ''
  if (!rep.recensioni) return `<div class="reputazione-pubblica"><h3>Recensioni</h3><p><span class="badge-nuovo">Nuovo su JobExpress</span> Ancora nessuna recensione${rep.collaborazioni ? ` · ${rep.collaborazioni} collaborazioni completate` : ''}.</p></div>`
  const cat = Object.entries(rep.per_categoria || {})
  return `<div class="reputazione-pubblica"><h3>Recensioni</h3>
    <p class="recensioni__media">${stelle(rep.media)} <strong>${num(rep.media)}</strong> su 5 · ${rep.recensioni} ${rep.recensioni === 1 ? 'recensione' : 'recensioni'} · ${rep.collaborazioni} collaborazioni</p>
    ${cat.length ? `<ul class="reputazione-cat">${cat.map(([k, v]) => `<li><span>${esc(NOME_CATEGORIA[k] || k)}</span><strong>${num(v)}</strong></li>`).join('')}</ul>` : ''}
    ${(rep.commenti || []).slice(0, 4).map((c) => `<blockquote class="recensione-citata">${stelle(c.media)}<p>${esc(c.commento)}</p><small>da ${c.ruolo_autore === 'lavoratore' ? 'una persona che ha lavorato qui' : 'un committente'} · ${esc(c.quando)}</small>
      ${c.risposta ? `<p class="recensione-risposta"><strong>Risposta:</strong> ${esc(c.risposta)}</p>` : ''}</blockquote>`).join('')}
    <p class="finestra__nota">Solo recensioni di incarichi completati su JobExpress. Nessun badge o classifica per le aziende.</p></div>`
}
export const leggiReputazione = (id) => rpc('reputazione_pubblica', { p_user: id }).catch(() => null)

// ---------- finestre ----------
function formRecensione(id) {
  const r = st.recensioni.find((x) => x.incarico_id === id)
  if (!r) return errore()
  const voti = r.mia?.voti || {}
  s.apri(`<p class="dettaglio__cat">Recensione · ${esc(r.titolo)}</p><h2>Com’è andata con ${esc(r.altra_parte)}?</h2>
    <p class="finestra__nota">Resta nascosta finché anche ${esc(r.altra_parte)} scrive la sua, o fino al ${data(r.periodo.chiude_il)}. Dopo l’invio non si può modificare. È facoltativa.</p>
    <form class="conto-form" data-safe-rec novalidate>
      ${CATEGORIE[r.ruolo].map(([k, n]) => `<div class="campo campo--voto"><label for="rv-${k}">${esc(n)}</label>
        <select id="rv-${k}" name="${k}"><option value="">Non valutabile</option>${[5, 4, 3, 2, 1].map((v) => `<option value="${v}" ${voti[k] === v ? 'selected' : ''}>${'★'.repeat(v)} ${v}</option>`).join('')}</select></div>`).join('')}
      <div class="campo"><label for="rv-commento">Commento <small>facoltativo, max 1000 caratteri</small></label>
        <textarea id="rv-commento" name="commento" rows="3" maxlength="1000" placeholder="Racconta i fatti. Niente dati personali, offese o informazioni sulla salute.">${esc(r.mia?.commento || '')}</textarea></div>
      <p class="conto-form__errore" data-errore role="alert"></p>
      <div class="finestra__azioni"><button type="submit" class="tasto" value="invia">Invia la recensione</button><button type="submit" class="tasto tasto--chiaro" value="bozza">Salva bozza</button></div></form>`)
  const f = document.querySelector('[data-safe-rec]')
  f.onsubmit = async (e) => {
    e.preventDefault()
    const invia = e.submitter?.value === 'invia'
    const v = {}
    for (const [k] of CATEGORIE[r.ruolo]) v[k] = f.elements[k].value ? Number(f.elements[k].value) : null
    if (invia && !Object.values(v).some((x) => x != null)) { f.querySelector('[data-errore]').textContent = 'Dai almeno un voto, oppure salva come bozza.'; return }
    try {
      const x = await rpc('salva_recensione', { p_incarico: id, p_voti: v, p_commento: f.elements.commento.value.trim() || null, p_invia: invia })
      if (x?.ok === false) { f.querySelector('[data-errore]').textContent = { periodo_chiuso: 'Il tempo per recensire è finito.', gia_inviata: 'Hai già inviato questa recensione.', serve_un_voto: 'Dai almeno un voto.' }[x.motivo] || 'Non è stato possibile.'; return }
      s.apri(x.stato === 'pubblicata' ? '<h2>Recensioni pubblicate</h2><p>Avevate scritto entrambi: ora le due recensioni sono visibili insieme.</p>'
        : x.stato === 'inviata' ? `<h2>Recensione inviata</h2><p>Resta nascosta finché scrive anche ${esc(r.altra_parte)}, o fino al ${data(x.pubblicazione_entro)}.</p>`
          : '<h2>Bozza salvata</h2><p>Nessuno la vede. Puoi completarla quando vuoi entro la scadenza.</p>')
      aggiornaSafe()
    } catch { errore() }
  }
}

async function finestraCondividi(id) {
  let lista = []
  try { lista = await rpc('mie_condivisioni', { p_incarico: id }) || [] } catch { return errore() }
  const base = new URL('incarico-condiviso.html', location.href).href.split('?')[0]
  const link = (t) => `${base}?t=${t}`
  const attive = lista.filter((x) => x.attiva)
  s.apri(`<p class="dettaglio__cat">JobExpress Safe</p><h2>Condividi con una persona di fiducia</h2>
    <p>Crea un link da mandare a chi vuoi (un familiare, un’amica). Vedrà cosa fai, per chi, la zona e gli orari. Si spegne da solo 2 ore dopo la fine dell’incarico e puoi revocarlo quando vuoi.</p>
    ${attive.length ? `<ul class="trust-voci">${attive.map((x) => `<li><div><strong>Link attivo${x.con_indirizzo ? ' · con indirizzo' : ''}</strong><span>scade ${dataOra(x.scade_il)} · aperto ${x.aperture} ${x.aperture === 1 ? 'volta' : 'volte'}</span>
      <input class="safe-link" readonly value="${esc(link(x.token))}" aria-label="Link da condividere" /></div>
      <span class="pa-azioni-riga"><button type="button" class="tasto tasto--piccolo" data-safe="copia" data-link="${esc(link(x.token))}">Copia</button>
      <button type="button" class="tasto tasto--chiaro tasto--piccolo" data-safe="revoca" data-id="${esc(x.id)}" data-incarico="${esc(id)}">Revoca</button></span></li>`).join('')}</ul>` : ''}
    <form class="conto-form" data-safe-condividi novalidate>
      <label class="spunta"><input type="checkbox" name="indirizzo" /> Includi l’indirizzo preciso</label>
      <p class="finestra__nota">Di base mostriamo solo la zona. Non condividiamo mai telefono, documenti o la tua posizione: JobExpress non usa il GPS.</p>
      <div class="finestra__azioni"><button type="submit" class="tasto">${attive.length ? 'Crea un altro link' : 'Crea il link'}</button></div></form>`)
  document.querySelector('[data-safe-condividi]').onsubmit = async (e) => {
    e.preventDefault()
    try {
      const x = await rpc('crea_condivisione', { p_incarico: id, p_con_indirizzo: e.target.elements.indirizzo.checked })
      if (x?.ok === false) return s.apri(`<h2>Non è stato possibile</h2><p>${esc({ troppe: 'Hai già 3 link attivi per questo incarico: revocane uno.', gia_finito: 'L’incarico è già finito.', stato_non_valido: 'Puoi condividere solo un incarico confermato.', non_attivo: 'Funzione momentaneamente non attiva.' }[x.motivo] || 'Riprova tra poco.')}</p>`)
      const l = link(x.token)
      if (navigator.share) navigator.share({ title: 'Il mio incarico su JobExpress', text: 'Ecco dove e quando lavoro:', url: l }).catch(() => {})
      finestraCondividi(id)
    } catch { errore() }
  }
}

function finestraSegnala({ incarico = null, recensione = null } = {}) {
  const u = s.utente()
  if (u?.prova) return s.apri('<h2>Segnalazioni</h2><p>Con l’account di prova le segnalazioni non vengono inviate. Con un account vero arrivano al team JobExpress.</p><p class="finestra__nota">Se sei in pericolo chiama il 112.</p>')
  s.apri(`<h2>${recensione ? 'Segnala questa recensione' : 'Segnala un problema'}</h2>
    <div class="safe-112 safe-112--piccolo"><p>In pericolo adesso? <a href="tel:112"><strong>Chiama il 112</strong></a></p></div>
    <form class="conto-form" data-safe-segnala novalidate>
      ${recensione ? '<input type="hidden" name="tipo" value="recensione" />' : `<div class="campo"><label for="sf-tipo">Di cosa si tratta?</label><select id="sf-tipo" name="tipo">${TIPI_SEGNALAZIONE.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></div>`}
      <div class="campo"><label for="sf-motivo">Racconta cosa è successo</label><textarea id="sf-motivo" name="motivo" rows="4" maxlength="1000" required placeholder="Quando, dove, cosa. Non scrivere numeri di documenti o password."></textarea></div>
      ${recensione ? '' : `<label class="spunta"><input type="checkbox" name="pericolo" /> Mi sono sentita/o in pericolo</label>
      <div class="campo"><label for="sf-file">Allegati <small>facoltativi: foto o PDF, max 3 file da 5 MB. Li vede solo il team.</small></label><input id="sf-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple /></div>`}
      <p class="conto-form__errore" data-errore role="alert"></p>
      <p class="finestra__nota">È riservata: l’altra persona non sa chi l’ha fatta. Non ci sono penalità automatiche: il team esamina e può chiedere altre informazioni.</p>
      <div class="finestra__azioni"><button class="tasto" type="submit">Invia la segnalazione</button></div></form>`)
  const f = document.querySelector('[data-safe-segnala]')
  f.onsubmit = async (e) => {
    e.preventDefault()
    const err = f.querySelector('[data-errore]')
    if (f.elements.motivo.value.trim().length < 5) { err.textContent = 'Scrivi almeno qualche parola.'; return f.elements.motivo.focus() }
    const file = [...(f.elements.file?.files || [])]
    if (file.length > 3 || file.some((x) => x.size > 5 * 1024 * 1024)) { err.textContent = 'Al massimo 3 file da 5 MB ciascuno.'; return }
    f.querySelector('button[type=submit]').disabled = true
    try {
      const allegati = []
      for (const x of file) {
        const est = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }[x.type]
        if (!est) continue
        const percorso = `${u.id}/${crypto.randomUUID()}.${est}`
        const r = await fetch(`${SUPABASE_URL}/storage/v1/object/segnalazioni/${percorso}`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${await s.token()}`, 'Content-Type': x.type }, body: x })
        if (r.ok) allegati.push(percorso)
      }
      const x = await rpc('segnala', { p: { tipo: f.elements.tipo.value, motivo: f.elements.motivo.value.trim(), incarico_id: incarico, recensione_id: recensione, pericolo_immediato: !!f.elements.pericolo?.checked, allegati } })
      s.apri(`<h2>Segnalazione inviata</h2><p>Grazie. ${x.priorita === 'urgente' ? 'L’abbiamo messa tra le priorità del team.' : 'Il team JobExpress la esaminerà.'} Trovi lo stato nel Centro sicurezza, in Profilo › Sicurezza e identità.</p>${x.priorita === 'urgente' ? '<p><strong>Se il pericolo è in corso, chiama il 112.</strong></p>' : ''}`)
      aggiornaSafe()
    } catch (e2) {
      f.querySelector('button[type=submit]').disabled = false
      err.textContent = String(e2.message).includes('troppe_richieste') ? 'Hai inviato molte segnalazioni oggi: riprova domani o scrivi all’assistenza.' : 'Non riesco a inviarla. Riprova tra poco.'
    }
  }
}

function chiediTesto(titolo, etichetta, max, invia) {
  s.apri(`<h2>${esc(titolo)}</h2><form class="conto-form" data-safe-testo novalidate>
    <div class="campo"><label for="sf-testo">${esc(etichetta)}</label><textarea id="sf-testo" name="testo" rows="3" maxlength="${max}" required></textarea></div>
    <div class="finestra__azioni"><button type="submit" class="tasto">Invia</button></div></form>`)
  document.querySelector('[data-safe-testo]').onsubmit = (e) => {
    e.preventDefault()
    const v = e.target.elements.testo.value.trim()
    if (v.length < 5) return e.target.elements.testo.focus()
    invia(v)
  }
}

// ---------- clic (ascoltati su tutta la pagina, così funzionano anche nelle finestre) ----------
export function gestisciSafe(e) {
  const b = e.target.closest?.('[data-safe]')
  if (!b) return false
  const k = b.dataset.safe; const id = b.dataset.id
  if (k === 'condividi') finestraCondividi(id)
  if (k === 'revoca') rpc('revoca_condivisione', { p_id: id }).then(() => finestraCondividi(b.dataset.incarico)).catch(errore)
  if (k === 'copia') navigator.clipboard?.writeText(b.dataset.link).then(() => { b.textContent = 'Copiato' }).catch(() => {})
  if (k === 'segnala') finestraSegnala({ incarico: b.dataset.incarico || null })
  if (k === 'segnala-rec') finestraSegnala({ recensione: id })
  if (k === 'recensisci') formRecensione(id)
  if (k === 'rispondi') chiediTesto('Rispondi alla recensione', 'La tua risposta pubblica (una sola volta, max 600 caratteri)', 600,
    (v) => rpc('rispondi_recensione', { p_id: id, p_testo: v }).then((x) => { s.apri(x?.ok ? '<h2>Risposta pubblicata</h2><p>Compare sotto la recensione.</p>' : '<h2>Non è stato possibile</h2><p>Hai già risposto a questa recensione.</p>'); aggiornaSafe() }).catch(errore))
  if (k === 'contesta-segn') chiediTesto('Non sei d’accordo con l’esito?', 'Spiega perché', 1000,
    (v) => rpc('contesta_esito_segnalazione', { p_id: Number(id), p_testo: v }).then(() => { s.apri('<h2>Contestazione inviata</h2><p>Il team riesaminerà la segnalazione.</p>'); aggiornaSafe() }).catch(errore))
  if (k === 'sblocca') {
    if (b.dataset.conferma !== 'si') { b.dataset.conferma = 'si'; b.textContent = 'Tocca di nuovo per sbloccare'; return true }
    rpc('sblocca_utente', { p_utente: id }).then(aggiornaSafe).catch(errore)
  }
  return true
}

export function avviaSafe(strumenti) {
  s = { ...s, ...strumenti }
  document.addEventListener('click', (e) => { gestisciSafe(e) })
  aggiornaSafe()
  setInterval(aggiornaSafe, 60000)
}
