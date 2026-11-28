// JOBEXPRESS TRUST — profilo professionale, foto del volto, CV PDF, verifiche progressive,
// «Sicurezza e identità», aziende e referenti, segnalazioni e blocchi.
//
// Regole che questo file rispetta (vedi docs/trust/):
//   * Nessun documento d'identità, selfie di identificazione, PIN CIE o credenziale SPID passa da JobExpress.
//   * Niente riconoscimento facciale, confronto biometrico o "liveness": la foto è solo un'immagine profilo.
//   * La foto non serve a ordinare o filtrare le persone.
//   * Nessuno può darsi da solo lo stato «verificato»: lo scrive solo il server (provider) o, per i test,
//     l'amministratore con una verifica SIMULATA, segnata come tale.
//   * SPID, CIE, eIDAS e provider restano «non ancora attivi» finché non c'è un'integrazione vera e autorizzata.
//   * Account di prova: tutto resta sul dispositivo e le verifiche sono simulate, con l'etichetta «simulata».
import { TIPI_SEGNALAZIONE, bloccoReputazione, leggiReputazione, riquadroSafe } from './safe.js'
import { SUPABASE_KEY, SUPABASE_URL } from './config.js'
import { impostazioni } from './regole.js'
import { haPlus } from './abbonamenti.js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const dataBreve = (t) => t ? new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
const lista = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 30)
const K_PROVA = 'jobexpress-trust-prova'

const VUOTO = {
  tipo: 'lavoratore', cognome: '', presentazione: '', settori: [], mansioni: [], competenze_tecniche: [], competenze_trasversali: [],
  lingue: [], formazione: [], certificazioni: [], esperienze_esterne: [], disponibilita: {},
  visibilita: { foto: true, presentazione: true, competenze: true, esperienze: true, formazione: true },
  foto_path: null, foto_stato: 'assente', cv_path: null, cv_nome: null, cv_aggiornato_il: null,
}

let s = { utente: () => null, token: async () => null, apri: () => {}, ridisegna: () => {}, vaiSicurezza: () => {} }
let st = { pro: structuredClone(VUOTO), riservati: {}, trust: null, aziende: [], fotoUrl: null, caricato: false, per: null }
export let sottoProfilo = 'pro' // 'pro' | 'sicurezza' | 'account'
export const impostaSottoProfilo = (k) => { sottoProfilo = k }
let avviso = ''
let avvisoOk = false
let cvLocale = null // account di prova: il PDF resta in memoria su questo dispositivo

const reale = () => { const u = s.utente(); return !!(u && !u.prova && SUPABASE_KEY) }
const imp = (k, base) => (impostazioni()[k] ?? base)

// ---------- account di prova: stato simulato sul dispositivo ----------
function leggiProva() {
  try { return JSON.parse(localStorage.getItem(K_PROVA)) || {} } catch { return {} }
}
function scriviProva() {
  const x = { pro: st.pro, riservati: st.riservati, verifiche: st.trust?.verifiche || {}, aziende: st.aziende, foto: st.fotoUrl }
  try { localStorage.setItem(K_PROVA, JSON.stringify(x)) } catch { avviso = 'Spazio del dispositivo pieno: la foto non è stata salvata.' }
}
function caricaProva(u) {
  const x = leggiProva()
  st.pro = { ...structuredClone(VUOTO), ...(x.pro || {}) }
  st.riservati = x.riservati || {}
  st.aziende = x.aziende || []
  st.fotoUrl = x.foto || null
  st.trust = { email: u.email, email_verificata: true, iscritto_il: null, ultimo_accesso: Date.now(), verifiche: x.verifiche || {}, sospeso: false, richieste: x.richieste || [], prova: true }
  st.caricato = true
  st.per = u.id
}

// ---------- chiamate al server ----------
async function chiama(percorso, { metodo = 'GET', corpo, prefer, tipo = 'application/json', grezzo = false } = {}) {
  const t = await s.token()
  const r = await fetch(`${SUPABASE_URL}${percorso}`, {
    method: metodo, signal: AbortSignal.timeout(20000),
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${t}`, 'Content-Type': tipo, ...(prefer ? { Prefer: prefer } : {}), ...(grezzo ? { 'x-upsert': 'true' } : {}) },
    body: corpo === undefined ? undefined : grezzo ? corpo : JSON.stringify(corpo),
  })
  const testo = await r.text()
  if (!r.ok) throw new Error(testo || String(r.status))
  try { return testo ? JSON.parse(testo) : null } catch { return testo }
}
const rpc = (nome, corpo = {}) => chiama(`/rest/v1/rpc/${nome}`, { metodo: 'POST', corpo })

async function linkFirmato(bucket, percorso, secondi = 600) {
  const r = await chiama(`/storage/v1/object/sign/${bucket}/${percorso}`, { metodo: 'POST', corpo: { expiresIn: secondi } })
  return r?.signedURL ? `${SUPABASE_URL}/storage/v1${r.signedURL}` : null
}

export async function caricaTrust(forza = false) {
  const u = s.utente()
  if (!u) { st.caricato = false; return }
  if (u.prova) { caricaProva(u); return }
  if (!reale() || (st.caricato && st.per === u.id && !forza)) return
  try {
    const [trust, pro, ris, az] = await Promise.all([
      rpc('mio_trust'),
      chiama(`/rest/v1/profili_professionali?user_id=eq.${u.id}&select=*`),
      chiama(`/rest/v1/dati_riservati?user_id=eq.${u.id}&select=data_nascita,telefono,telefono_verificato_il`),
      rpc('mie_aziende').catch(() => []),
    ])
    st.trust = trust
    st.pro = { ...structuredClone(VUOTO), ...(pro?.[0] || {}) }
    st.riservati = ris?.[0] || {}
    st.aziende = az || []
    st.fotoUrl = st.pro.foto_path ? await linkFirmato('foto-profilo', st.pro.foto_path).catch(() => null) : null
    st.caricato = true
    st.per = u.id
  } catch { /* senza rete: si riprova al prossimo giro */ }
  s.ridisegna()
}

async function assicuraRiga(tabella) {
  const u = s.utente()
  await chiama(`/rest/v1/${tabella}?on_conflict=user_id`, { metodo: 'POST', corpo: { user_id: u.id }, prefer: 'resolution=ignore-duplicates,return=minimal' })
}
async function salvaPro(campi) {
  if (!reale()) { st.pro = { ...st.pro, ...campi }; scriviProva(); return }
  const u = s.utente()
  await assicuraRiga('profili_professionali')
  const r = await chiama(`/rest/v1/profili_professionali?user_id=eq.${u.id}`, { metodo: 'PATCH', corpo: campi, prefer: 'return=representation' })
  st.pro = { ...st.pro, ...(r?.[0] || campi) }
}
async function salvaRiservati(campi) {
  if (!reale()) { st.riservati = { ...st.riservati, ...campi }; scriviProva(); return }
  const u = s.utente()
  await assicuraRiga('dati_riservati')
  await chiama(`/rest/v1/dati_riservati?user_id=eq.${u.id}`, { metodo: 'PATCH', corpo: campi, prefer: 'return=minimal' })
  st.riservati = { ...st.riservati, ...campi }
}

// ---------- requisiti (verifica progressiva) ----------
// Sul server decidono i trigger del database (_controlla_trust). Qui serve solo per spiegare prima cosa manca.
export function requisitiMancanti(azione = 'candidatura') {
  const u = s.utente()
  if (!u) return []
  if (imp('identity_verification_required', true) === false) return []
  if (!u.prova) {
    if (!st.trust) return []
    return (azione === 'pubblica' ? st.trust.mancano_pubblica : st.trust.mancano_candidatura) || []
  }
  const m = []
  if (st.trust?.verifiche?.identita?.stato !== 'verificata') m.push('identita')
  if (imp('profile_photo_required', true) && !['caricata', 'verificata'].includes(st.pro.foto_stato)) m.push('foto')
  if (azione === 'pubblica' && st.pro.tipo === 'azienda' && !st.aziende.some((a) => a.stato_verifica === 'verificata')) m.push('azienda')
  return m
}

const MANCA = {
  sospeso: ['Account sospeso', 'Il tuo account è sospeso in via cautelativa. Scrivi all’assistenza dalla sezione «Sicurezza e identità».'],
  eta: ['Età minima', 'JobExpress è riservato a chi ha almeno 18 anni.'],
  email: ['Email da confermare', 'Apri il link che ti abbiamo mandato per email (guarda anche nello spam).'],
  telefono: ['Telefono da verificare', 'Verifica il tuo numero di telefono.'],
  identita: ['Identità da verificare', 'Serve una verifica dell’identità prima della prima candidatura o pubblicazione.'],
  foto: ['Foto del volto', 'Carica una foto in cui il tuo volto si veda bene (per le aziende va bene il logo).'],
  azienda: ['Azienda da verificare', 'Prima di pubblicare per un’azienda, va verificata l’azienda e il tuo ruolo di referente.'],
  troppe_richieste: ['Troppe richieste', 'Hai fatto molte richieste in poco tempo. Riprova tra un po’.'],
  bloccato: ['Non disponibile', 'Non è possibile: tra voi due c’è un blocco.'],
}

// Legge un errore del server tipo «TRUST:identita,foto» e restituisce l'elenco, oppure null
export function codiciTrust(errore) {
  const m = String(errore?.message ?? errore ?? '').match(/TRUST:([a-z_,]+)/)
  return m ? m[1].split(',').filter(Boolean) : null
}

export function finestraTrust(codici, azione = 'candidatura') {
  const cosa = azione === 'pubblica' ? 'pubblicare un incarico' : 'candidarti'
  s.apri(`<p class="dettaglio__cat">Sicurezza e identità</p>
    <h2>Prima di ${cosa}</h2>
    <p>Puoi esplorare JobExpress liberamente. Per ${cosa} servono ancora questi passaggi:</p>
    <ul class="trust-manca">${codici.map((c) => `<li><strong>${esc(MANCA[c]?.[0] || c)}</strong><span>${esc(MANCA[c]?.[1] || '')}</span></li>`).join('')}</ul>
    <p class="finestra__nota">Servono a ridurre profili falsi e account duplicati. Il controllo lo fa il server: non basta modificare l’app.</p>
    <div class="finestra__azioni"><button type="button" class="tasto" data-trust-completa>Completa ora</button></div>`)
  const b = document.querySelector('dialog.finestra [data-trust-completa]')
  if (b) b.onclick = () => { document.querySelector('dialog.finestra').close(); sottoProfilo = 'sicurezza'; s.vaiSicurezza() }
}

// ---------- completamento del profilo ----------
export function completamento(u = s.utente()) {
  const p = st.pro
  const azienda = p.tipo === 'azienda'
  const obbl = [
    ['Nome', !!u?.nome], ['Cognome', !!p.cognome || azienda], ['Città', !!u?.citta],
    [azienda ? 'Logo o foto' : 'Foto del volto', ['caricata', 'verificata'].includes(p.foto_stato)],
    ['Email confermata', !!st.trust?.email_verificata], ['Identità verificata', st.trust?.verifiche?.identita?.stato === 'verificata'],
    ...(azienda ? [['Azienda verificata', st.aziende.some((a) => a.stato_verifica === 'verificata')]] : []),
  ]
  const fac = [
    ['Presentazione', !!p.presentazione], ['Competenze', (p.settori.length + p.mansioni.length + p.competenze_tecniche.length) > 0],
    ['Esperienze', p.esperienze_esterne.length > 0], ['Formazione o lingue', p.formazione.length + p.lingue.length + p.certificazioni.length > 0],
    ['Disponibilità', !!(p.disponibilita?.giorni?.length || p.disponibilita?.fasce?.length)], ['CV in PDF', !!p.cv_path],
  ]
  const fatti = obbl.filter((x) => x[1]).length * 2 + fac.filter((x) => x[1]).length
  return { obbl, fac, perc: Math.round((fatti / (obbl.length * 2 + fac.length)) * 100) }
}

// ---------- badge di verifica (diversi dai badge professionali) ----------
function badgeVerifica() {
  const v = st.trust?.verifiche || {}
  const id = v.identita
  const b = []
  if (st.trust?.email_verificata) b.push(['contatti', 'Contatti verificati'])
  if (id?.stato === 'verificata') b.push(['identita', id.simulata ? 'Identità verificata · simulata' : 'Identità verificata'])
  if (st.pro.foto_stato === 'verificata') b.push(['foto', 'Foto confermata'])
  if (st.aziende.some((a) => a.stato_verifica === 'verificata')) b.push(['azienda', 'Azienda verificata'])
  if (v.qualifica?.stato === 'verificata') b.push(['qualifica', 'Qualifica verificata'])
  return b
}
export const htmlBadgeVerifica = () => badgeVerifica().map(([k, t]) => `<span class="badge-verifica badge-verifica--${k}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1l2 1.5 2.5-.2.7 2.4 2 1.6-1 2.3.3 2.5-2.4.8-1.5 2-2.6-.6L5.4 14l-1.5-2-2.4-.8.3-2.5-1-2.3 2-1.6.7-2.4L6 2.5z"/><path d="M5.5 8l1.7 1.7L10.8 6" fill="none" stroke="#fff" stroke-width="1.6"/></svg>${esc(t)}</span>`).join('')

const STATO_VERIFICA = {
  non_iniziata: 'Non iniziata', in_corso: 'In corso', in_attesa: 'In attesa', verificata: 'Verificata', non_riuscita: 'Non riuscita',
  revisione_manuale: 'In revisione manuale', da_aggiornare: 'Da aggiornare', revocata: 'Revocata',
}
const STATO_FOTO = { assente: 'Non caricata', caricata: 'Caricata', in_revisione: 'In revisione (segnalata)', verificata: 'Confermata', da_sostituire: 'Da sostituire' }

// ---------- PANNELLO: Profilo professionale ----------
function avatar(u, grande = false) {
  const iniz = esc((u?.nome || u?.email || '?').trim().charAt(0).toUpperCase())
  return st.fotoUrl ? `<img class="avatar avatar--foto${grande ? ' avatar--grande' : ''}" src="${esc(st.fotoUrl)}" alt="Foto profilo" />`
    : `<span class="avatar${grande ? ' avatar--grande' : ''}" aria-hidden="true">${iniz}</span>`
}
export const avatarUtente = avatar

function voceLista(arr, chiave, campi) {
  return arr.length ? `<ul class="trust-voci">${arr.map((x, i) => `<li><div><strong>${esc(x[campi[0]])}</strong><span>${campi.slice(1).map((c) => esc(x[c] || '')).filter(Boolean).join(' · ')}</span>
    <span class="trust-dich">${x.stato === 'verificata' ? 'Verificata' : 'Autodichiarata'}</span></div>
    <button type="button" class="tasto tasto--chiaro tasto--piccolo" data-trust-togli="${chiave}" data-i="${i}" aria-label="Togli">Togli</button></li>`).join('')}</ul>` : '<p class="finestra__nota">Ancora niente.</p>'
}

function pannelloPro(u) {
  const p = st.pro
  const c = completamento(u)
  const d = p.disponibilita || {}
  const azienda = p.tipo === 'azienda'
  const GIORNI = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom']
  const FASCE = [['mattina', 'Mattina'], ['pomeriggio', 'Pomeriggio'], ['sera', 'Sera'], ['notte', 'Notte']]
  return `
    <div class="trust-testa">
      ${avatar(u, true)}
      <div><strong class="trust-nome">${esc(u.nome || 'Senza nome')}${p.cognome ? ` ${esc(p.cognome)}` : ''}</strong>
        <p>${esc({ lavoratore: 'Profilo lavoratore', privato: 'Committente privato', azienda: 'Azienda' }[p.tipo])}${u.citta ? ` · ${esc(u.citta)}` : ''}</p>
        <div class="trust-badge">${htmlBadgeVerifica() || '<span class="finestra__nota">Nessuna verifica ancora</span>'}</div></div>
      <button type="button" class="tasto tasto--chiaro" data-trust-anteprima>Come ti vedono gli altri</button>
    </div>

    <section class="riquadro trust-compl" aria-label="Completamento del profilo">
      <div class="trust-compl__testa"><h3>Profilo completo al ${c.perc}%</h3><span>${c.obbl.filter((x) => x[1]).length}/${c.obbl.length} obbligatori</span></div>
      <div class="trust-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${c.perc}"><i style="width:${c.perc}%"></i></div>
      <div class="trust-compl__liste">
        <div><p class="trust-etichetta">Obbligatori per lavorare o pubblicare</p><ul>${c.obbl.map(([t, ok]) => `<li class="${ok ? 'ok' : ''}">${ok ? '✓' : '○'} ${esc(t)}</li>`).join('')}</ul></div>
        <div><p class="trust-etichetta">Facoltativi (aiutano a farti scegliere)</p><ul>${c.fac.map(([t, ok]) => `<li class="${ok ? 'ok' : ''}">${ok ? '✓' : '○'} ${esc(t)}</li>`).join('')}</ul></div>
      </div>
    </section>

    <section class="profilo-blocco" id="trust-foto">
      <h3>${azienda ? 'Logo o foto' : 'Foto del volto'} <span class="stato">${esc(STATO_FOTO[p.foto_stato])}</span></h3>
      <div class="trust-foto">
        ${avatar(u, true)}
        <div>
          <p>${azienda ? 'Per un’azienda puoi usare il logo. I referenti che lavorano con le persone usano comunque una propria foto.' : 'Serve una foto reale in cui il volto si veda bene: da solo, senza occhiali scuri, filtri pesanti o foto di gruppo.'}</p>
          <div class="pa-azioni-riga">
            <label class="tasto">Scegli una foto<input type="file" accept="image/jpeg,image/png,image/webp" data-trust-foto hidden /></label>
            <label class="tasto tasto--chiaro">Scatta ora<input type="file" accept="image/*" capture="user" data-trust-foto hidden /></label>
          </div>
          <p class="finestra__nota">JPG, PNG o WebP, massimo 2 MB dopo il ritaglio. La foto viene ricompressa sul tuo telefono e i dati nascosti (posizione GPS, modello del telefono) vengono tolti. JobExpress non usa riconoscimento facciale e non usa la foto per ordinare o scegliere le persone. La vedono solo gli utenti registrati.</p>
          ${p.foto_stato === 'da_sostituire' ? '<p class="avviso-spostamenti">Il team ha chiesto di sostituire la foto: finché non la cambi non puoi candidarti o pubblicare.</p>' : ''}
        </div>
      </div>
    </section>

    <form class="conto-form profilo-blocco" data-trust-pro novalidate>
      <h3>Identità e presentazione</h3>
      <div class="campo"><label for="tp-tipo">Tipo di profilo</label>
        <select id="tp-tipo" name="tipo">${[['lavoratore', 'Lavoratore'], ['privato', 'Committente privato'], ['azienda', 'Azienda']].map(([v, t]) => `<option value="${v}" ${p.tipo === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="campo"><label for="tp-cognome">Cognome <span class="facoltativo">gli altri vedono solo l’iniziale</span></label>
        <input id="tp-cognome" name="cognome" value="${esc(p.cognome)}" maxlength="80" autocomplete="family-name" ${st.trust?.verifiche?.identita?.stato === 'verificata' ? 'readonly' : ''} />
        ${st.trust?.verifiche?.identita?.stato === 'verificata' ? '<p class="finestra__nota">Bloccato dopo la verifica dell’identità: per correggerlo scrivi all’assistenza.</p>' : ''}</div>
      <div class="campo"><label for="tp-pres">Presentazione <span class="facoltativo" data-conta-pres>${(p.presentazione || '').length}/600</span></label>
        <textarea id="tp-pres" name="presentazione" rows="4" maxlength="600" placeholder="Chi sei, cosa sai fare, che tipo di lavoro cerchi.">${esc(p.presentazione)}</textarea>
        ${haPlus() ? '<button type="button" class="tasto tasto--chiaro tasto--piccolo" data-area-scheda="percorso">Migliorala con l’assistente AI (Plus)</button>' : '<p class="finestra__nota">Con Plus puoi farti aiutare dall’assistente AI a scriverla. Nessun dato riservato viene inviato all’AI.</p>'}</div>
      <h3>Competenze</h3>
      <div class="campo"><label for="tp-settori">Settori <span class="facoltativo">separati da virgola</span></label><input id="tp-settori" name="settori" value="${esc(p.settori.join(', '))}" placeholder="ristorazione, eventi" /></div>
      <div class="campo"><label for="tp-mansioni">Mansioni</label><input id="tp-mansioni" name="mansioni" value="${esc(p.mansioni.join(', '))}" placeholder="cameriere, barista, magazzino" /></div>
      <div class="campo"><label for="tp-tec">Competenze tecniche</label><input id="tp-tec" name="competenze_tecniche" value="${esc(p.competenze_tecniche.join(', '))}" placeholder="caffetteria, cassa, HACCP" /></div>
      <div class="campo"><label for="tp-tra">Competenze trasversali</label><input id="tp-tra" name="competenze_trasversali" value="${esc(p.competenze_trasversali.join(', '))}" placeholder="puntualità, lavoro in squadra" /></div>
      <div class="campo"><label for="tp-lingue">Lingue <span class="facoltativo">es. italiano madrelingua, inglese B1</span></label><input id="tp-lingue" name="lingue" value="${esc(p.lingue.map((l) => l.nome).join(', '))}" /></div>
      <h3>Disponibilità e mobilità</h3>
      <fieldset class="conto-form__gruppo"><legend>Giorni</legend><div class="trust-chip">${GIORNI.map((g) => `<label class="spunta"><input type="checkbox" name="giorni" value="${g}" ${d.giorni?.includes(g) ? 'checked' : ''}/> ${g}</label>`).join('')}</div></fieldset>
      <fieldset class="conto-form__gruppo"><legend>Fasce orarie</legend><div class="trust-chip">${FASCE.map(([v, t]) => `<label class="spunta"><input type="checkbox" name="fasce" value="${v}" ${d.fasce?.includes(v) ? 'checked' : ''}/> ${t}</label>`).join('')}</div></fieldset>
      <div class="campo"><label for="tp-km">Quanto lontano puoi spostarti (km)</label><input id="tp-km" name="km" type="number" min="1" max="100" value="${esc(d.km ?? 15)}" /></div>
      <div class="campo"><label for="tp-mezzi">Come ti sposti</label><input id="tp-mezzi" name="mezzi" value="${esc(d.mezzi || '')}" placeholder="auto, bici, autobus" maxlength="80" /></div>
      <p class="conto-form__errore${avvisoOk ? ' trust-ok' : ''}" data-errore role="status">${esc(avviso)}</p>
      <div class="finestra__azioni"><button class="tasto" type="submit">Salva il profilo professionale</button></div>
    </form>

    <section class="profilo-blocco">
      <h3>Esperienze</h3>
      <p class="finestra__nota">Le esperienze fatte con JobExpress compaiono da sole dopo ogni incarico completato. Quelle esterne restano «autodichiarate» finché non vengono verificate.</p>
      ${voceLista(p.esperienze_esterne, 'esperienze_esterne', ['ruolo', 'dove', 'periodo'])}
      <form class="cv-ed__form" data-trust-aggiungi="esperienze_esterne" novalidate>
        <label><span>Ruolo</span><input name="ruolo" maxlength="80" required /></label>
        <label><span>Dove</span><input name="dove" maxlength="80" /></label>
        <label><span>Periodo</span><input name="periodo" maxlength="40" placeholder="2024–2025" /></label>
        <button type="submit" class="tasto tasto--chiaro">Aggiungi esperienza</button>
      </form>
    </section>

    <section class="profilo-blocco">
      <h3>Formazione e certificazioni</h3>
      ${voceLista([...p.formazione.map((x) => ({ ...x, _k: 'formazione' }))], 'formazione', ['titolo', 'ente', 'anno'])}
      ${voceLista(p.certificazioni, 'certificazioni', ['titolo', 'ente', 'anno'])}
      <form class="cv-ed__form" data-trust-aggiungi="formazione" novalidate>
        <label><span>Titolo o corso</span><input name="titolo" maxlength="100" required /></label>
        <label><span>Scuola o ente</span><input name="ente" maxlength="80" /></label>
        <label><span>Anno</span><input name="anno" maxlength="10" /></label>
        <label class="spunta"><input type="checkbox" name="certificazione" /> È una certificazione (es. HACCP, sicurezza)</label>
        <button type="submit" class="tasto tasto--chiaro">Aggiungi</button>
      </form>
    </section>

    <section class="profilo-blocco" id="trust-cv">
      <h3>Curriculum in PDF <span class="facoltativo">facoltativo, gratuito</span></h3>
      ${p.cv_path ? `<p><strong>${esc(p.cv_nome || 'curriculum.pdf')}</strong> · aggiornato il ${dataBreve(p.cv_aggiornato_il)}</p>
        <div class="pa-azioni-riga"><button type="button" class="tasto tasto--chiaro" data-trust-cv="vedi">Apri</button>
          <label class="tasto tasto--chiaro">Sostituisci<input type="file" accept="application/pdf" data-trust-cv-file hidden /></label>
          <button type="button" class="tasto tasto--chiaro" data-trust-cv="elimina">Elimina</button></div>`
        : '<label class="tasto">Carica il CV in PDF<input type="file" accept="application/pdf" data-trust-cv-file hidden /></label>'}
      <p class="finestra__nota">Solo PDF, massimo ${imp('cv_max_mb', 5)} MB. Il file è privato: lo vedi tu e, solo se lo scegli quando ti candidi, il committente di quell’annuncio. Non è il «CV JobExpress», che resta separato. Il CV non è mai obbligatorio.</p>
    </section>`
}

// ---------- PANNELLO: Sicurezza e identità ----------
const METODI = [
  ['spid_enabled', 'SPID', 'Identità digitale italiana. Entri con il tuo gestore SPID sul suo sito: JobExpress non vede né salva le tue credenziali.'],
  ['cie_enabled', 'CIE', 'Carta d’identità elettronica con «Entra con CIE». Il PIN lo inserisci solo nell’app o sul sito del Ministero, mai su JobExpress.'],
  ['eidas_enabled', 'Identità europea (eIDAS)', 'Per chi ha un’identità digitale di un altro Paese dell’Unione europea.'],
  ['id_provider_enabled', 'Verifica con documento (provider esterno)', 'Un fornitore specializzato controlla il documento sul suo sistema. JobExpress riceve solo l’esito, non le immagini.'],
  ['alternative_verification_enabled', 'Verifica assistita', 'Per chi non ha SPID o CIE: un percorso con l’aiuto del team, senza dati biometrici.'],
]
function pannelloSicurezza(u) {
  const t = st.trust || {}
  const v = t.verifiche || {}
  const id = v.identita
  const vis = st.pro.visibilita || {}
  const demo = u.prova && imp('verifiche_simulate_consentite', true)
  const mancaC = requisitiMancanti('candidatura')
  const azienda = st.pro.tipo === 'azienda' || u.modalita?.includes('attivita')
  return `
    ${riquadroSafe(u)}
    <section class="riquadro trust-stato">
      <h3>Stato dell’account</h3>
      <ul class="trust-righe">
        <li><span>Account</span><strong>${t.sospeso ? 'Sospeso in via cautelativa' : 'Attivo'}</strong></li>
        <li><span>Iscritto il</span><strong>${dataBreve(t.iscritto_il)}</strong></li>
        <li><span>Ultimo accesso</span><strong>${dataBreve(t.ultimo_accesso)}</strong></li>
        <li><span>Puoi candidarti o pubblicare?</span><strong>${mancaC.length ? `Non ancora: ${esc(mancaC.map((c) => MANCA[c]?.[0] || c).join(', ').toLowerCase())}` : 'Sì'}</strong></li>
      </ul>
    </section>

    <section class="profilo-blocco">
      <h3>Contatti</h3>
      <ul class="trust-righe">
        <li><span>Email ${esc(t.email || u.email || '')}</span><strong>${t.email_verificata ? 'Confermata' : 'Da confermare'}</strong></li>
        <li><span>Telefono ${st.riservati.telefono ? esc(st.riservati.telefono) : ''}</span><strong>${st.riservati.telefono_verificato_il ? 'Verificato' : imp('phone_verification_enabled', false) ? 'Da verificare' : 'Verifica via SMS non ancora attiva'}</strong></li>
      </ul>
      <form class="cv-ed__form" data-trust-riservati novalidate>
        <label><span>Telefono <small>riservato, non è mai pubblico</small></span><input name="telefono" type="tel" maxlength="20" value="${esc(st.riservati.telefono || '')}" autocomplete="tel" /></label>
        <label><span>Data di nascita <small>riservata: serve solo per i 18 anni</small></span><input name="data_nascita" type="date" value="${esc(st.riservati.data_nascita || '')}" ${id?.stato === 'verificata' ? 'readonly' : ''} /></label>
        <button type="submit" class="tasto tasto--chiaro">Salva</button>
      </form>
    </section>

    <section class="profilo-blocco" id="trust-identita">
      <h3>Identità <span class="stato">${esc(STATO_VERIFICA[id?.stato || 'non_iniziata'])}${id?.simulata ? ' · simulata' : ''}</span></h3>
      ${id?.stato === 'verificata' ? `<p>Verificata il ${dataBreve(id.verificata_il)}${id.metodo && !id.simulata ? ` con ${esc(id.metodo.toUpperCase())}` : ''}.${id.simulata ? ' <strong>Verifica simulata per i test: non è un’identificazione reale.</strong>' : ''}</p>`
        : id?.stato === 'revisione_manuale' ? '<p>La verifica è in revisione manuale da parte del team. Ti avvisiamo nelle notifiche.</p>'
        : id?.stato === 'non_riuscita' ? `<p>La verifica non è riuscita${id.motivo === 'eta_minima' ? ': JobExpress è riservato ai maggiorenni' : ''}. Puoi chiedere aiuto all’assistenza.</p>`
        : '<p>Serve prima della prima candidatura o pubblicazione. Fino ad allora puoi esplorare tutto.</p>'}
      <ul class="trust-metodi">${METODI.map(([k, nome, desc]) => {
        const attivo = imp(k, false) === true
        return `<li class="${attivo ? '' : 'spento'}"><div><strong>${esc(nome)}</strong><p>${esc(desc)}</p></div>
          ${attivo ? `<button type="button" class="tasto" data-trust-metodo="${k}">Inizia</button>` : '<span class="stato">Non ancora attivo</span>'}</li>`
      }).join('')}</ul>
      ${demo ? `<div class="trust-demo"><p><strong>Solo nel prototipo:</strong> puoi simulare l’esito per vedere come funziona. Nessun dato reale viene controllato.</p>
        <div class="pa-azioni-riga"><button type="button" class="tasto" data-trust-simula="verificata">Simula verifica riuscita</button>
          <button type="button" class="tasto tasto--chiaro" data-trust-simula="non_riuscita">Simula non riuscita</button>
          ${id ? '<button type="button" class="tasto tasto--chiaro" data-trust-simula="azzera">Azzera</button>' : ''}</div></div>`
        : !u.prova && id?.stato !== 'verificata' ? '<p class="finestra__nota">In questa fase i metodi veri non sono ancora collegati: gli account di test vengono abilitati dall’amministratrice con una verifica segnata come «simulata».</p>' : ''}
      <p class="finestra__nota">La verifica riduce il rischio di profili falsi e account doppi, ma non garantisce il comportamento delle persone né l’assenza di precedenti. JobExpress non conserva documenti, selfie o dati biometrici.</p>
    </section>

    ${azienda ? pannelloAziende(u) : ''}

    <section class="profilo-blocco">
      <h3>Sicurezza dell’accesso</h3>
      <div class="pa-azioni-riga">
        <button type="button" class="tasto tasto--chiaro" data-trust-password>Cambia password</button>
        <button type="button" class="tasto tasto--chiaro" data-trust-altri ${u.prova ? 'disabled' : ''}>Esci dagli altri dispositivi</button>
      </div>
      <p class="finestra__nota" data-trust-msg role="status"></p>
    </section>

    <section class="profilo-blocco">
      <h3>Privacy: cosa vedono gli altri</h3>
      <p class="finestra__nota">Gli altri utenti registrati vedono il tuo nome con l’iniziale del cognome. Email, telefono, data di nascita e CV non sono mai pubblici.</p>
      <div class="trust-chip">${[['foto', 'Foto'], ['presentazione', 'Presentazione'], ['competenze', 'Competenze e lingue'], ['esperienze', 'Esperienze esterne'], ['formazione', 'Formazione']].map(([k, t2]) => `<label class="interruttore"><input type="checkbox" data-trust-vis="${k}" ${vis[k] !== false ? 'checked' : ''}/> ${t2}</label>`).join('')}</div>
      ${vis.foto === false ? '<p class="finestra__nota">Se nascondi la foto, la vedrà solo chi ti ha selezionato per un incarico.</p>' : ''}
      <button type="button" class="tasto tasto--chiaro" data-trust-anteprima>Anteprima: come ti vedono gli altri</button>
    </section>

    <section class="profilo-blocco">
      <h3>Assistenza</h3>
      <form class="cv-ed__form" data-trust-assistenza novalidate>
        <label><span>Argomento</span><select name="tipo">${[['verifica', 'Verifica dell’identità'], ['contestazione_verifica', 'Contesto un esito'], ['metodo_alternativo', 'Non ho SPID né CIE'], ['account', 'Account'], ['privacy', 'Privacy e dati'], ['sospensione', 'Sospensione'], ['altro', 'Altro']].map(([v2, t2]) => `<option value="${v2}">${t2}</option>`).join('')}</select></label>
        <label><span>Messaggio</span><textarea name="messaggio" rows="3" maxlength="2000" required placeholder="Non scrivere numeri di documenti o password."></textarea></label>
        <button type="submit" class="tasto tasto--chiaro">Invia</button>
      </form>
      ${(t.richieste || []).length ? `<ul class="trust-voci">${t.richieste.map((r) => `<li><div><strong>${esc(r.tipo.replace('_', ' '))}</strong><span>${dataBreve(r.creato_il)} · ${esc(r.stato)}</span>${r.risposta ? `<span>Risposta: ${esc(r.risposta)}</span>` : ''}</div></li>`).join('')}</ul>` : ''}
    </section>`
}

function pannelloAziende(u) {
  return `<section class="profilo-blocco" id="trust-azienda">
    <h3>Azienda e referenti</h3>
    ${st.aziende.length ? `<ul class="trust-voci">${st.aziende.map((a) => `<li><div><strong>${esc(a.ragione_sociale)}</strong>
      <span>${a.partita_iva ? `P. IVA ${esc(a.partita_iva)} · ` : ''}verifica: ${esc(STATO_VERIFICA[a.stato_verifica] || a.stato_verifica)}</span>
      <span>Referenti: ${(a.referenti || []).map((r) => `${esc(r.nome)} (${esc(r.ruolo)}, ${esc(r.stato)})`).join(', ') || '—'}</span>
      ${u.prova ? '' : `<form class="trust-riga-form" data-trust-referente="${esc(a.id)}" novalidate><input name="email" type="email" placeholder="Email del collega (deve avere un account)" required />
        <select name="ruolo"><option value="referente">Referente</option><option value="collaboratore">Collaboratore</option></select><button class="tasto tasto--chiaro tasto--piccolo" type="submit">Aggiungi</button></form>`}</div></li>`).join('')}</ul>` : ''}
    <details ${st.aziende.length ? '' : 'open'}><summary>Registra un’azienda</summary>
      <form class="cv-ed__form" data-trust-azienda novalidate>
        <label><span>Ragione sociale</span><input name="ragione_sociale" maxlength="120" required /></label>
        <label><span>Partita IVA <small>11 cifre</small></span><input name="partita_iva" inputmode="numeric" pattern="[0-9]{11}" maxlength="11" /></label>
        <label><span>Forma giuridica</span><input name="forma_giuridica" maxlength="60" placeholder="snc, srl, ditta individuale…" /></label>
        <label><span>Sede</span><input name="sede" maxlength="160" /></label>
        <label><span>Il tuo ruolo</span><select name="ruolo"><option value="titolare">Titolare o legale rappresentante</option><option value="referente">Referente delegato</option></select></label>
        <button type="submit" class="tasto">Registra l’azienda</button>
      </form>
      <p class="finestra__nota">L’azienda e il tuo ruolo vanno verificati prima di pubblicare. In questa fase la verifica la fa il team JobExpress (nel prototipo è simulata).</p>
    </details>
  </section>`
}

export function pannelloTrust(u, account) {
  const t = [['pro', 'Profilo professionale'], ['sicurezza', 'Sicurezza e identità'], ['account', 'Account e piano']]
  return `<div class="scelta scelta--vista2 area__sotto trust-schede" role="group" aria-label="Sezioni del profilo">
      ${t.map(([k, n]) => `<button type="button" data-trust-sotto="${k}" aria-pressed="${sottoProfilo === k}">${n}</button>`).join('')}</div>
    ${!st.caricato && !u.prova ? '<p class="finestra__nota">Carico il profilo…</p>' : ''}
    ${sottoProfilo === 'pro' ? pannelloPro(u) : sottoProfilo === 'sicurezza' ? pannelloSicurezza(u) : account}`
}

// ---------- anteprima / profilo pubblico ----------
function schedaPubblica(p, mio = false) {
  const r = p.riconoscimenti || {}
  const fotoUrl = p._fotoUrl
  return `<div class="trust-pubblico">
    ${fotoUrl ? `<img class="avatar avatar--foto avatar--grande" src="${esc(fotoUrl)}" alt="Foto profilo" />` : `<span class="avatar avatar--grande" aria-hidden="true">${esc((p.nome || '?').charAt(0))}</span>`}
    <h2>${esc(p.nome)}</h2><p>${esc(p.citta || '')}${p.iscritto_il ? ` · su JobExpress da ${new Date(p.iscritto_il).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}` : ''} · ${p.incarichi_completati || 0} incarichi completati</p>
    <div class="trust-badge">${[r.contatti && 'Contatti verificati', r.identita && (r.identita_simulata ? 'Identità verificata · simulata' : 'Identità verificata'), r.foto && 'Foto confermata', r.azienda && 'Azienda verificata', r.qualifiche && 'Qualifica verificata'].filter(Boolean).map((x) => `<span class="badge-verifica">${esc(x)}</span>`).join('')}</div>
    ${p.presentazione ? `<p>${esc(p.presentazione)}</p>` : ''}
    ${p._rep ? bloccoReputazione(p._rep) : ''}
    ${[...(p.settori || []), ...(p.mansioni || []), ...(p.competenze_tecniche || [])].length ? `<div class="etichette">${[...(p.settori || []), ...(p.mansioni || []), ...(p.competenze_tecniche || [])].map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
    ${(p.esperienze_esterne || []).length ? `<h3>Esperienze</h3><ul class="lista-semplice">${p.esperienze_esterne.map((x) => `<li>${esc(x.ruolo)}${x.dove ? ` · ${esc(x.dove)}` : ''} <small>(autodichiarata)</small></li>`).join('')}</ul>` : ''}
    ${(p.formazione || []).length + (p.certificazioni || []).length ? `<h3>Formazione</h3><ul class="lista-semplice">${[...(p.formazione || []), ...(p.certificazioni || [])].map((x) => `<li>${esc(x.titolo)}${x.ente ? ` · ${esc(x.ente)}` : ''}</li>`).join('')}</ul>` : ''}
    ${mio ? '<p class="finestra__nota">Così ti vede un altro utente registrato. Email, telefono, data di nascita e CV non compaiono mai. Chi non è registrato non vede il profilo.</p>'
      : `<div class="finestra__azioni"><button type="button" class="tasto tasto--chiaro" data-trust-segnala="${esc(p.id)}">Segnala</button><button type="button" class="tasto tasto--chiaro" data-trust-blocca="${esc(p.id)}">Blocca</button></div>
         <p class="finestra__nota">La verifica riduce il rischio di profili falsi ma non garantisce il comportamento delle persone.</p>`}
  </div>`
}

function anteprimaLocale(u) {
  const p = st.pro
  const vis = p.visibilita || {}
  return {
    id: u.id, nome: `${u.nome || 'Utente'}${p.cognome ? ` ${p.cognome.charAt(0)}.` : ''}`, citta: u.citta, iscritto_il: st.trust?.iscritto_il, incarichi_completati: 0,
    presentazione: vis.presentazione !== false ? p.presentazione : null,
    settori: vis.competenze !== false ? p.settori : [], mansioni: vis.competenze !== false ? p.mansioni : [], competenze_tecniche: vis.competenze !== false ? p.competenze_tecniche : [],
    esperienze_esterne: vis.esperienze !== false ? p.esperienze_esterne : [], formazione: vis.formazione !== false ? p.formazione : [], certificazioni: vis.formazione !== false ? p.certificazioni : [],
    _fotoUrl: vis.foto !== false ? st.fotoUrl : null,
    riconoscimenti: { contatti: !!st.trust?.email_verificata, identita: st.trust?.verifiche?.identita?.stato === 'verificata', identita_simulata: !!st.trust?.verifiche?.identita?.simulata, foto: p.foto_stato === 'verificata', azienda: st.aziende.some((a) => a.stato_verifica === 'verificata') },
  }
}

export async function apriProfiloPubblico(id) {
  const u = s.utente()
  if (!u) return
  if (id === u.id || u.prova) return s.apri(schedaPubblica(anteprimaLocale(u), id === u.id))
  try {
    const p = await rpc('profilo_pubblico', { p_user: id })
    if (!p) return s.apri('<h2>Profilo non disponibile</h2><p>Questo profilo non è visibile in questo momento.</p>')
    if (p.foto_path) p._fotoUrl = await linkFirmato('foto-profilo', p.foto_path, 300).catch(() => null)
    p._rep = await leggiReputazione(id)
    s.apri(schedaPubblica(p))
  } catch { s.apri('<h2>Non riesco a collegarmi</h2><p>Riprova tra poco.</p>') }
}

// ---------- foto: ritaglio e compressione sul dispositivo ----------
function ritaglia(file) {
  return new Promise((ok, no) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && !/^image\//.test(file.type)) return no(new Error('Formato non supportato: usa JPG, PNG o WebP.'))
    if (file.size > 15 * 1024 * 1024) return no(new Error('La foto è troppo grande (più di 15 MB).'))
    createImageBitmap(file).then((img) => {
      let zoom = 1; let dx = 0; let dy = 0
      s.apri(`<h2>Sistema la foto</h2>
        <p>Trascina per centrare il volto e usa lo zoom. Il volto deve vedersi bene.</p>
        <canvas class="trust-ritaglio" width="320" height="320" aria-label="Anteprima del ritaglio"></canvas>
        <label class="campo"><span>Zoom</span><input type="range" min="1" max="3" step="0.01" value="1" data-zoom /></label>
        <p class="conto-form__errore" data-errore role="alert"></p>
        <div class="finestra__azioni"><button type="button" class="tasto" data-ok>Usa questa foto</button><button type="button" class="tasto tasto--chiaro" data-annulla>Annulla</button></div>`)
      const f = document.querySelector('dialog.finestra')
      const cv = f.querySelector('canvas'); const cx = cv.getContext('2d')
      const lato = Math.min(img.width, img.height)
      const disegna = (c, ctx, n) => {
        const l = lato / zoom
        const mx = (img.width - l) / 2; const my = (img.height - l) / 2
        const sx = Math.max(0, Math.min(img.width - l, mx - dx * l)); const sy = Math.max(0, Math.min(img.height - l, my - dy * l))
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, n, n)
        ctx.drawImage(img, sx, sy, l, l, 0, 0, n, n)
        void c
      }
      const aggiorna = () => disegna(cv, cx, 320)
      aggiorna()
      f.querySelector('[data-zoom]').oninput = (e) => { zoom = Number(e.target.value); aggiorna() }
      let pr = null
      cv.onpointerdown = (e) => { pr = { x: e.clientX, y: e.clientY, dx, dy }; cv.setPointerCapture(e.pointerId) }
      cv.onpointermove = (e) => { if (!pr) return; dx = pr.dx + (e.clientX - pr.x) / 320; dy = pr.dy + (e.clientY - pr.y) / 320; aggiorna() }
      cv.onpointerup = () => { pr = null }
      f.querySelector('[data-annulla]').onclick = () => { f.close(); no(null) }
      f.querySelector('[data-ok]').onclick = () => {
        const out = document.createElement('canvas'); out.width = 640; out.height = 640
        disegna(out, out.getContext('2d'), 640)
        // ricodifica in JPEG: i metadati EXIF (GPS, modello del telefono) non vengono copiati
        out.toBlob((b) => {
          if (!b) return no(new Error('Non riesco a preparare la foto.'))
          if (b.size > 2 * 1024 * 1024) return no(new Error('La foto è ancora troppo pesante.'))
          f.close(); ok(b)
        }, 'image/jpeg', 0.85)
      }
    }).catch(() => no(new Error('Non riesco ad aprire questa immagine. Prova con una foto JPG.')))
  })
}

async function caricaFoto(file) {
  const blob = await ritaglia(file)
  const u = s.utente()
  if (!reale()) {
    st.fotoUrl = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob) })
    st.pro.foto_stato = 'caricata'; st.pro.foto_path = 'locale'
    scriviProva(); return
  }
  const vecchia = st.pro.foto_path
  const percorso = `${u.id}/foto-${Date.now()}.jpg`
  await chiama(`/storage/v1/object/foto-profilo/${percorso}`, { metodo: 'POST', corpo: blob, tipo: 'image/jpeg', grezzo: true })
  await salvaPro({ foto_path: percorso })
  if (vecchia && vecchia !== percorso) chiama(`/storage/v1/object/foto-profilo/${vecchia}`, { metodo: 'DELETE' }).catch(() => {})
  st.caricato = false
  await caricaTrust(true)
}

// ---------- CV PDF ----------
async function caricaCV(file) {
  const max = imp('cv_max_mb', 5)
  if (file.size > max * 1024 * 1024) throw new Error(`Il file supera ${max} MB.`)
  const testa = new Uint8Array(await file.slice(0, 5).arrayBuffer())
  if (String.fromCharCode(...testa) !== '%PDF-') throw new Error('Il file non è un PDF valido.')
  const nome = file.name.replace(/[^\w.\- ]+/g, '_').slice(0, 120)
  if (!reale()) {
    if (cvLocale) URL.revokeObjectURL(cvLocale)
    cvLocale = URL.createObjectURL(file)
    st.pro = { ...st.pro, cv_path: 'locale', cv_nome: nome, cv_aggiornato_il: new Date().toISOString() }
    scriviProva(); return
  }
  const u = s.utente()
  const vecchio = st.pro.cv_path
  const percorso = `${u.id}/cv-${Date.now()}.pdf`
  await chiama(`/storage/v1/object/curriculum/${percorso}`, { metodo: 'POST', corpo: file, tipo: 'application/pdf', grezzo: true })
  await salvaPro({ cv_path: percorso, cv_nome: nome })
  st.pro.cv_aggiornato_il = new Date().toISOString()
  if (vecchio && vecchio !== percorso) chiama(`/storage/v1/object/curriculum/${vecchio}`, { metodo: 'DELETE' }).catch(() => {})
}
async function eliminaCV() {
  if (reale() && st.pro.cv_path) await chiama(`/storage/v1/object/curriculum/${st.pro.cv_path}`, { metodo: 'DELETE' }).catch(() => {})
  if (cvLocale) { URL.revokeObjectURL(cvLocale); cvLocale = null }
  await salvaPro({ cv_path: null, cv_nome: null })
}
export const haCV = () => !!st.pro.cv_path
export async function condividiCV(candidatura, si) {
  if (!reale()) return
  return rpc('condividi_cv', { p_candidatura: candidatura, p_condividi: si })
}
export async function apriCVCandidato(percorso) {
  const url = await linkFirmato('curriculum', percorso, 120)
  if (url) window.open(url, '_blank', 'noopener')
}

// ---------- gestione eventi ----------
function messaggio(t) {
  const n = document.querySelector('#area [data-trust-msg], #area [data-errore]')
  if (n) n.textContent = t
}
const erroreTesto = (e) => {
  const x = String(e?.message || e || '')
  if (/IDENTITA_BLOCCATA/.test(x)) return 'Questo dato è bloccato dopo la verifica: per correggerlo scrivi all’assistenza.'
  if (/Failed to fetch|NetworkError|timeout/i.test(x)) return 'Nessuna connessione: riprova.'
  if (/partita_iva/.test(x)) return 'La partita IVA deve avere 11 cifre.'
  return 'Non è stato possibile salvare. Riprova.'
}

export function gestisciTrust(e) {
  const t = e.target
  const fatto = (p, ok) => p.then(() => { avviso = ok || ''; avvisoOk = true; s.ridisegna() }).catch((err) => { if (err) { avvisoOk = false; avviso = err.message && !/^\{/.test(err.message) && err.message.length < 140 ? err.message : erroreTesto(err); s.ridisegna(); messaggio(avviso) } })

  if (e.type === 'change') {
    if (t.matches('[data-trust-foto]') && t.files?.[0]) { fatto(caricaFoto(t.files[0]), 'Foto caricata.'); return true }
    if (t.matches('[data-trust-cv-file]') && t.files?.[0]) { fatto(caricaCV(t.files[0]), 'CV caricato.'); return true }
    if (t.matches('[data-trust-vis]')) {
      const vis = { ...(st.pro.visibilita || {}), [t.dataset.trustVis]: t.checked }
      fatto(salvaPro({ visibilita: vis }))
      return true
    }
    return false
  }
  if (e.type === 'input' && t.matches('#tp-pres')) {
    const c = document.querySelector('[data-conta-pres]'); if (c) c.textContent = `${t.value.length}/600`
    return true
  }
  if (e.type === 'submit') {
    const f = t.closest('form')
    if (!f) return false
    if (f.matches('[data-trust-pro]')) {
      e.preventDefault()
      const v = (n) => f.elements[n]?.value?.trim() || ''
      const tutti = (n) => [...f.querySelectorAll(`[name=${n}]:checked`)].map((x) => x.value)
      const campi = {
        tipo: v('tipo'), presentazione: v('presentazione') || null,
        settori: lista(v('settori')), mansioni: lista(v('mansioni')), competenze_tecniche: lista(v('competenze_tecniche')), competenze_trasversali: lista(v('competenze_trasversali')),
        lingue: lista(v('lingue')).map((nome) => ({ nome })),
        disponibilita: { giorni: tutti('giorni'), fasce: tutti('fasce'), km: Math.max(1, Math.min(100, Number(v('km')) || 15)), mezzi: v('mezzi') },
      }
      if (!f.elements.cognome.readOnly) campi.cognome = v('cognome') || null
      fatto(salvaPro(campi), 'Profilo professionale salvato.')
      return true
    }
    if (f.matches('[data-trust-aggiungi]')) {
      e.preventDefault()
      const v = (n) => f.elements[n]?.value?.trim() || ''
      const k0 = f.dataset.trustAggiungi
      const primo = k0 === 'esperienze_esterne' ? 'ruolo' : 'titolo'
      if (!v(primo)) { f.elements[primo].focus(); return true }
      const k = k0 === 'formazione' && f.elements.certificazione?.checked ? 'certificazioni' : k0
      const voce = k0 === 'esperienze_esterne' ? { ruolo: v('ruolo'), dove: v('dove'), periodo: v('periodo') } : { titolo: v('titolo'), ente: v('ente'), anno: v('anno') }
      fatto(salvaPro({ [k]: [...(st.pro[k] || []), { ...voce, stato: 'autodichiarata' }].slice(0, 20) }))
      return true
    }
    if (f.matches('[data-trust-riservati]')) {
      e.preventDefault()
      const campi = { telefono: f.elements.telefono.value.trim() || null }
      if (!f.elements.data_nascita.readOnly) campi.data_nascita = f.elements.data_nascita.value || null
      if (campi.data_nascita) {
        const n = new Date(campi.data_nascita); const d18 = new Date(); d18.setFullYear(d18.getFullYear() - imp('minimum_user_age', 18))
        if (n > d18) { messaggio('JobExpress è riservato a chi ha almeno 18 anni.'); return true }
      }
      fatto(salvaRiservati(campi), 'Dati riservati salvati.')
      return true
    }
    if (f.matches('[data-trust-assistenza]')) {
      e.preventDefault()
      const m = f.elements.messaggio.value.trim()
      if (m.length < 5) { f.elements.messaggio.focus(); return true }
      if (!reale()) {
        st.trust.richieste = [{ tipo: f.elements.tipo.value, stato: 'aperta (prova)', creato_il: new Date().toISOString() }, ...(st.trust.richieste || [])]
        s.ridisegna(); return true
      }
      fatto(rpc('richiedi_assistenza', { p_tipo: f.elements.tipo.value, p_messaggio: m }).then(() => caricaTrust(true)), 'Richiesta inviata.')
      return true
    }
    if (f.matches('[data-trust-azienda]')) {
      e.preventDefault()
      const d = Object.fromEntries(new FormData(f))
      if (!d.ragione_sociale?.trim()) { f.elements.ragione_sociale.focus(); return true }
      if (d.partita_iva && !/^\d{11}$/.test(d.partita_iva.trim())) { messaggio('La partita IVA deve avere 11 cifre.'); return true }
      if (!reale()) {
        st.aziende = [...st.aziende, { id: `prova-${Date.now()}`, ragione_sociale: d.ragione_sociale.trim(), partita_iva: d.partita_iva || null, stato_verifica: 'non_iniziata', referenti: [{ nome: s.utente().nome, ruolo: d.ruolo, stato: 'in_attesa' }] }]
        st.pro.tipo = 'azienda'; scriviProva(); s.ridisegna(); return true
      }
      fatto(rpc('crea_azienda', { p: d }).then(() => caricaTrust(true)), 'Azienda registrata: ora va verificata.')
      return true
    }
    if (f.matches('[data-trust-referente]')) {
      e.preventDefault()
      fatto(rpc('aggiungi_referente', { p_azienda: f.dataset.trustReferente, p_email: f.elements.email.value.trim(), p_ruolo: f.elements.ruolo.value })
        .then((r) => { if (r?.ok === false) throw new Error(r.motivo === 'utente_non_trovato' ? 'Nessun account con questa email: chiedi al collega di registrarsi.' : 'Non è stato possibile aggiungerlo.'); return caricaTrust(true) }), 'Referente aggiunto: resta «in attesa» finché non viene verificato.')
      return true
    }
    return false
  }
  if (e.type !== 'click') return false
  const so = t.closest('[data-trust-sotto]')
  if (so) { sottoProfilo = so.dataset.trustSotto; avviso = ''; s.ridisegna(); return true }
  if (t.closest('[data-trust-anteprima]')) { apriProfiloPubblico(s.utente().id); return true }
  const tg = t.closest('[data-trust-togli]')
  if (tg) { const k = tg.dataset.trustTogli; fatto(salvaPro({ [k]: st.pro[k].filter((_, i) => i !== Number(tg.dataset.i)) })); return true }
  const cv = t.closest('[data-trust-cv]')
  if (cv) {
    if (cv.dataset.trustCv === 'vedi') { if (cvLocale) window.open(cvLocale, '_blank', 'noopener'); else apriCVCandidato(st.pro.cv_path) }
    else fatto(eliminaCV(), 'CV eliminato.')
    return true
  }
  const sim = t.closest('[data-trust-simula]')
  if (sim && s.utente()?.prova) {
    const esito = sim.dataset.trustSimula
    const v = { ...(st.trust.verifiche || {}) }
    if (esito === 'azzera') delete v.identita
    else v.identita = { stato: esito, metodo: 'simulata', simulata: true, verificata_il: esito === 'verificata' ? new Date().toISOString() : null }
    if (esito === 'verificata') st.aziende = st.aziende.map((a) => ({ ...a, stato_verifica: 'verificata', referenti: (a.referenti || []).map((r) => ({ ...r, stato: 'verificato' })) }))
    st.trust.verifiche = v
    scriviProva(); s.ridisegna(); return true
  }
  if (t.closest('[data-trust-metodo]')) { messaggio('Questo metodo non è ancora collegato.'); return true }
  if (t.closest('[data-trust-password]')) {
    const u = s.utente()
    if (u.prova) { messaggio('Con l’account di prova non c’è una password vera.'); return true }
    fetch(`${SUPABASE_URL}/auth/v1/recover`, { method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.email }) })
      .then(() => messaggio(`Ti abbiamo mandato un link a ${u.email} per scegliere la nuova password.`)).catch(() => messaggio('Nessuna connessione: riprova.'))
    return true
  }
  if (t.closest('[data-trust-altri]')) {
    chiama('/auth/v1/logout?scope=others', { metodo: 'POST', corpo: {} }).then(() => messaggio('Fatto: sugli altri dispositivi dovrai accedere di nuovo.')).catch(() => messaggio('Non è stato possibile: riprova.'))
    return true
  }
  const sg = t.closest('[data-trust-segnala]')
  if (sg) { chiediSegnalazione(sg.dataset.trustSegnala); return true }
  const bl = t.closest('[data-trust-blocca]')
  if (bl) {
    if (bl.dataset.conferma !== 'si') { bl.dataset.conferma = 'si'; bl.textContent = 'Tocca di nuovo per bloccare'; return true }
    rpc('blocca_utente', { p_utente: bl.dataset.trustBlocca }).then(() => s.apri('<h2>Utente bloccato</h2><p>Non potrà candidarsi ai tuoi annunci né scriverti. Puoi sbloccarlo dal Centro sicurezza, in Profilo › Sicurezza e identità.</p>'))
      .catch(() => s.apri('<h2>Non riesco a collegarmi</h2><p>Riprova tra poco.</p>'))
    return true
  }
  return false
}

function chiediSegnalazione(id) {
  s.apri(`<h2>Segnala questo profilo</h2>
    <form class="conto-form" data-trust-segnala-form novalidate>
      <div class="campo"><label for="sg-tipo">Motivo</label><select id="sg-tipo" name="tipo">${TIPI_SEGNALAZIONE.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></div>
      <div class="campo"><label for="sg-motivo">Racconta cosa è successo</label><textarea id="sg-motivo" name="motivo" rows="3" maxlength="1000" required></textarea></div>
      <label class="spunta"><input type="checkbox" name="pericolo" /> Mi sono sentita/o in pericolo</label>
      <p class="finestra__nota">La segnalazione è riservata: l’altra persona non sa chi l’ha fatta. Se c’è un pericolo immediato chiama il <a href="tel:112">112</a>.</p>
      <div class="finestra__azioni"><button class="tasto" type="submit">Invia la segnalazione</button></div></form>`)
  document.querySelector('[data-trust-segnala-form]').onsubmit = (e) => {
    e.preventDefault()
    const f = e.target
    if (f.elements.motivo.value.trim().length < 5) return f.elements.motivo.focus()
    rpc('segnala', { p: { segnalato_id: id, tipo: f.elements.tipo.value, motivo: f.elements.motivo.value.trim(), pericolo_immediato: f.elements.pericolo.checked } })
      .then(() => s.apri('<h2>Segnalazione inviata</h2><p>Grazie. Il team JobExpress la esaminerà. Trovi lo stato nel Centro sicurezza.</p>'))
      .catch((err) => s.apri(`<h2>Non è stato possibile</h2><p>${codiciTrust(err)?.includes('troppe_richieste') ? 'Hai inviato molte segnalazioni oggi: riprova domani.' : 'Riprova tra poco.'}</p>`))
  }
}

export function avviaTrust(strumenti) {
  s = { ...s, ...strumenti }
  caricaTrust()
  setInterval(() => { if (reale()) caricaTrust(true) }, 120000)
}
