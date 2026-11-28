// JobExpress LIVE e RESCUE (lato sito).
// Live: chi lavora dichiara VOLONTARIAMENTE quando è disponibile. Nessun obbligo di risposta, nessuna penalità,
// nessuna posizione GPS: solo città e zona scelte a mano. Le disponibilità scadono da sole.
// Rescue: quando un posto resta scoperto, chi pubblica può avviare una ricerca urgente di sostituti (gratis per tutti).
// Le regole vere (verifiche, posti, sovrapposizioni, scadenze) le applica il database: qui si mostra e si chiede.
import { SUPABASE_KEY, SUPABASE_URL } from './config.js'
import { impostazioni } from './regole.js'
import { codiciTrust, finestraTrust } from './trust.js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const ora = (t) => new Date(t).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
const giorno = (t) => new Date(t).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
const fascia = (a, b) => `${giorno(a)} · ${ora(a)}–${ora(b)}`
const K_PROVA = 'jobexpress-live-prova'
const RAPPORTO = { da_definire: 'Da definire', prestazione_occasionale: 'Prestazione occasionale', lavoro_subordinato: 'Lavoro subordinato', lavoro_intermittente: 'Lavoro intermittente', somministrazione: 'Somministrazione', lavoro_autonomo: 'Lavoro autonomo', altro: 'Altro' }
const MOTIVI = {
  sovrapposta: 'Hai già una disponibilità in quella fascia: modificala o disattivala prima.', orari_non_validi: 'Controlla gli orari: la fine deve essere dopo l’inizio (massimo 24 ore).',
  troppo_lontano: 'Puoi programmare al massimo 30 giorni avanti.', non_attivo: 'Funzione non attiva in questo momento.', troppe: 'Hai già molte disponibilità programmate.',
  annuncio_incompleto: 'L’annuncio deve indicare mansione e tipo di rapporto prima di inviare proposte.', non_disponibile: 'La persona non è più disponibile in quella fascia.',
  posti_esauriti: 'I posti sono già coperti.', gia_iniziato: 'L’incarico è già iniziato.', gia_inviata: 'Hai già inviato una proposta a questa persona per questo annuncio.',
  gia_rifiutata: 'Questa persona ha già rifiutato oggi la proposta per questo annuncio.', scaduta: 'La proposta è scaduta.', non_in_attesa: 'Non è più in attesa.',
  incarico_confermato: 'Hai già un incarico confermato in quell’orario.', gia_candidato: 'Sei già in attesa di conferma per questo incarico.', gia_risposto: 'Hai già risposto.',
  rescue_gia_attivo: 'C’è già una ricerca Rescue attiva per questo annuncio.', nessun_posto_scoperto: 'Non ci sono posti scoperti da coprire.', testo_breve: 'Scrivi qualche parola in più.',
  limite_mensile: 'Hai raggiunto il limite di incarichi del mese per il piano Free.',
}

let s = { utente: () => null, token: async () => null, apri: () => {}, ridisegna: () => {} }
let mie = []        // disponibilità
let offerte = []    // proposte dirette + Rescue ricevute
let preferenze = { urgenti: false, proposte_live: true }
const reale = () => { const u = s.utente(); return !!(u && !u.prova && SUPABASE_KEY) }
const attivo = () => impostazioni().live_enabled !== false

async function rpc(nome, corpo = {}) {
  const t = await s.token()
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}`, {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  })
  const testo = await r.text()
  if (!r.ok) throw new Error(testo || String(r.status))
  return testo ? JSON.parse(testo) : null
}
function errore(e, azione = 'candidatura') {
  const c = codiciTrust(e)
  if (c) return finestraTrust(c, azione)
  s.apri('<h2>Non riesco a collegarmi</h2><p>Riprova tra poco.</p>')
}

// ---------- account di prova: disponibilità sul dispositivo ----------
function leggiProva() { try { return (JSON.parse(localStorage.getItem(K_PROVA)) || []).filter((d) => new Date(d.fine) > Date.now()) } catch { return [] } }
function scriviProva(l) { try { localStorage.setItem(K_PROVA, JSON.stringify(l)) } catch { /* pieno */ } }

export async function aggiornaLive() {
  const u = s.utente()
  if (!u) return
  if (!reale()) { mie = leggiProva(); return }
  try {
    const [d, o, p] = await Promise.all([rpc('mie_disponibilita'), rpc('mie_offerte'), fetchPreferenze()])
    mie = d || []; offerte = o || []; if (p) preferenze = p
    s.ridisegna()
  } catch { /* riprova al prossimo giro */ }
}
async function fetchPreferenze() {
  const u = s.utente()
  const r = await fetch(`${SUPABASE_URL}/rest/v1/preferenze_notifiche?user_id=eq.${u.id}&select=urgenti,proposte_live`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${await s.token()}` } })
  const j = r.ok ? await r.json() : []
  return j[0] || null
}

// ---------- riquadro nella Home di chi lavora ----------
export function riquadroLive() {
  if (!attivo()) return ''
  const ora2 = Date.now()
  const inCorso = mie.find((d) => new Date(d.inizio) <= ora2 && new Date(d.fine) > ora2)
  const future = mie.filter((d) => new Date(d.inizio) > ora2)
  return `<article class="riquadro riquadro--live ${inCorso ? 'riquadro--live-on' : ''}">
    <div class="riquadro__testa"><h3>JobExpress Live</h3><span class="stato">${inCorso ? 'Disponibile' : 'Non disponibile'}</span></div>
    <div class="live-switch" role="group" aria-label="La tua disponibilità">
      <button type="button" data-live="on" aria-pressed="${!!inCorso}">Disponibile</button>
      <button type="button" data-live="off" aria-pressed="${!inCorso}">Non disponibile</button>
    </div>
    ${inCorso ? `<p class="grande">Fino alle ${ora(inCorso.fine)}</p><p>${esc(inCorso.citta)}${inCorso.zona ? ` · ${esc(inCorso.zona)}` : ''} · entro ${inCorso.raggio_km} km${inCorso.mansioni?.length ? ` · ${esc(inCorso.mansioni.join(', '))}` : ''}</p>`
      : '<p>Il tuo tempo libero, nuove opportunità. Dichiara quando sei libero/a: chi cerca personale può proporti un incarico.</p>'}
    ${future.length ? `<p class="trust-etichetta">Programmate</p><ul class="live-lista">${future.map((d) => `<li><span>${esc(fascia(d.inizio, d.fine))} · ${esc(d.citta)}</span><button type="button" class="tasto tasto--chiaro tasto--piccolo" data-live-togli="${esc(d.id)}">Togli</button></li>`).join('')}</ul>` : ''}
    <div class="pa-azioni-riga"><button type="button" class="tasto tasto--chiaro" data-live="programma">Programma una disponibilità</button></div>
    <p class="finestra__nota">Non è un obbligo di reperibilità: puoi spegnere quando vuoi, rifiutare o non rispondere senza penalità. La posizione precisa non viene mai condivisa. ${s.utente()?.prova ? 'Con l’account di prova resta su questo dispositivo.' : ''}</p>
  </article>`
}

function finestraLive(programmata = false) {
  const u = s.utente()
  const oggi = new Date(); const dom = new Date(Date.now() + 864e5)
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  s.apri(`<p class="dettaglio__cat">JobExpress Live</p><h2>${programmata ? 'Programma una disponibilità' : 'Sono disponibile'}</h2>
    <form class="conto-form" data-live-form novalidate>
      ${programmata ? `<div class="pa-due"><div class="campo"><label for="lv-data">Giorno</label><input id="lv-data" name="data" type="date" min="${iso(oggi)}" value="${iso(dom)}" /></div>
        <div class="campo"><label for="lv-ini">Dalle</label><input id="lv-ini" name="ini" type="time" step="900" value="18:00" /></div></div>` : ''}
      <fieldset class="conto-form__gruppo"><legend>Per quanto tempo</legend><div class="live-durate">
        ${[1, 2, 4, 6, 8].map((h) => `<label class="pillola"><input type="radio" name="durata" value="${h}" ${h === 4 ? 'checked' : ''}/> <span>${h} ${h === 1 ? 'ora' : 'ore'}</span></label>`).join('')}
        <label class="pillola"><input type="radio" name="durata" value="su_misura" /> <span>Fino alle…</span></label></div>
        <div class="campo" data-live-fino style="display:none"><label for="lv-fino">Fino alle</label><input id="lv-fino" name="fino" type="time" step="900" value="23:00" /></div></fieldset>
      <div class="pa-due"><div class="campo"><label for="lv-citta">Città</label><input id="lv-citta" name="citta" maxlength="80" value="${esc(u?.citta || 'Forlì')}" /></div>
        <div class="campo"><label for="lv-zona">Zona <span class="facoltativo">facoltativa</span></label><input id="lv-zona" name="zona" maxlength="60" placeholder="centro, Ronco…" /></div></div>
      <div class="campo"><label for="lv-km">Quanto lontano puoi andare (km)</label><input id="lv-km" name="km" type="number" min="1" max="100" value="10" /></div>
      <div class="campo"><label for="lv-mans">Cosa ti va di fare <span class="facoltativo">separato da virgola</span></label><input id="lv-mans" name="mansioni" maxlength="200" placeholder="cameriere, barista, magazzino" /></div>
      <div class="campo"><label for="lv-euro">Compenso minimo orario (€) <span class="facoltativo">facoltativo</span></label><input id="lv-euro" name="euro" type="number" min="0" max="200" step="0.5" /></div>
      <label class="spunta"><input type="checkbox" name="urgenti" checked /> Ricevi anche richieste urgenti (Rescue)</label>
      <p class="finestra__nota">La disponibilità si spegne da sola alla fine. Gli incarichi che confermi restano validi anche se la spegni prima.</p>
      <p class="conto-form__errore" data-errore role="alert"></p>
      <div class="finestra__azioni"><button type="submit" class="tasto">${programmata ? 'Programma' : 'Attiva Live'}</button></div>
    </form>`)
  const f = document.querySelector('[data-live-form]')
  f.addEventListener('change', () => { f.querySelector('[data-live-fino]').style.display = f.elements.durata.value === 'su_misura' ? '' : 'none' })
  f.onsubmit = async (e) => {
    e.preventDefault()
    const v = (n) => f.elements[n]?.value?.trim() || ''
    let inizio = new Date()
    if (programmata) { inizio = new Date(`${v('data')}T${v('ini') || '00:00'}`); if (!(inizio > Date.now())) { f.querySelector('[data-errore]').textContent = 'Scegli un momento nel futuro.'; return } }
    let fine
    if (f.elements.durata.value === 'su_misura') {
      fine = new Date(inizio); const [h, m] = v('fino').split(':').map(Number); fine.setHours(h, m || 0, 0, 0)
      if (fine <= inizio) fine.setDate(fine.getDate() + 1) // fasce che passano la mezzanotte
    } else fine = new Date(inizio.getTime() + Number(f.elements.durata.value) * 3600000)
    const corpo = { inizio: inizio.toISOString(), fine: fine.toISOString(), citta: v('citta'), zona: v('zona'), raggio_km: Number(v('km')) || 10,
      mansioni: v('mansioni').split(',').map((x) => x.trim()).filter(Boolean), compenso_min: Number(v('euro')) || null, urgenti: f.elements.urgenti.checked }
    if (!reale()) {
      const l = leggiProva()
      if (l.some((d) => new Date(d.inizio) < fine && inizio < new Date(d.fine))) { f.querySelector('[data-errore]').textContent = MOTIVI.sovrapposta; return }
      l.push({ id: `p-${Date.now()}`, ...corpo, citta: corpo.citta || 'Forlì' }); scriviProva(l); mie = l
      document.querySelector('dialog.finestra').close(); s.ridisegna(); return
    }
    try {
      const r = await rpc('live_attiva', { p: corpo })
      if (!r.ok) { f.querySelector('[data-errore]').textContent = MOTIVI[r.motivo] || 'Non è stato possibile.'; return }
      document.querySelector('dialog.finestra').close(); await aggiornaLive()
    } catch (err) { errore(err) }
  }
}

// ---------- offerte ricevute (proposte dirette e Rescue) ----------
function condizioniOfferta(a, bonus) {
  const t = a.turni || []
  const ore = t.reduce((x, y) => x + (new Date(y.fine) - new Date(y.inizio)) / 3600000, 0)
  const base = Math.round(a.compenso_ora * ore * 100) / 100
  return `<dl class="dettaglio__dati offerta-dati">
    <dt>Mansione</dt><dd>${esc(a.mansione)}</dd>
    <dt>Quando</dt><dd>${t.map((x) => esc(fascia(x.inizio, x.fine))).join('<br>')}</dd>
    <dt>Dove</dt><dd>${esc(a.citta)}${a.zona ? ` · ${esc(a.zona)}` : ''} <small>(indirizzo preciso dopo la conferma)</small></dd>
    <dt>Compenso</dt><dd>${euro.format(a.compenso_ora)}/ora ${a.compenso_tipo !== 'non_specificato' ? esc(a.compenso_tipo) : ''} · circa ${euro.format(base)}</dd>
    ${Number(bonus) ? `<dt>Bonus urgenza</dt><dd><span class="bonus-urgenza">+ ${euro.format(bonus)}</span> tutto per te · totale circa <strong>${euro.format(base + Number(bonus))}</strong></dd>` : ''}
    <dt>Requisiti</dt><dd>${esc([...(a.qualifiche_obbligatorie || []).map((q) => `${q} (obbligatorio)`), a.requisiti].filter(Boolean).join(' · ') || 'Nessun requisito particolare')}</dd>
    <dt>Rapporto previsto</dt><dd>${esc(RAPPORTO[a.tipo_rapporto] || a.tipo_rapporto)}</dd>
    ${a.info_sicurezza ? `<dt>Sicurezza</dt><dd>${esc(a.info_sicurezza)}</dd>` : ''}
  </dl>`
}
export function pannelloOfferte() {
  if (!reale() || !offerte.length) return ''
  return `<h3 class="area__sotto-titolo">Offerte per te</h3><ul class="candidature">${offerte.map((o) => `<li class="candidatura offerta ${o.tipo === 'rescue' ? 'offerta--rescue' : ''}">
    <div><strong>${esc(o.annuncio.titolo)}</strong> <span class="etichetta-esempio ${o.tipo === 'rescue' ? 'etichetta-urgente' : 'etichetta-vero'}">${o.tipo === 'rescue' ? 'Rescue · urgente' : 'proposta diretta'}</span>
      <p>${esc(o.annuncio.nome)}</p>
      ${o.messaggio ? `<p>«${esc(o.messaggio)}»</p>` : ''}
      ${condizioniOfferta(o.annuncio, o.bonus_urgenza)}
      ${o.domanda ? `<p class="finestra__nota">Hai chiesto: «${esc(o.domanda)}»${o.risposta ? ` — risposta: «${esc(o.risposta)}»` : ' — in attesa di risposta'}</p>` : ''}
      ${o.scade_il ? `<p class="proposta-tempo">Puoi rispondere fino alle ${ora(o.scade_il)}</p>` : ''}
      <p class="finestra__nota">Nessuna penalità se rifiuti o non rispondi. Accettare completa la conferma reciproca, ma non sostituisce il contratto né gli adempimenti obbligatori.</p></div>
    <div class="pa-azioni-riga">
      <button type="button" class="tasto" data-offerta="accetta" data-tipo="${o.tipo}" data-id="${esc(o.id)}">Accetto</button>
      <button type="button" class="tasto tasto--chiaro" data-offerta="rifiuta" data-tipo="${o.tipo}" data-id="${esc(o.id)}">${o.tipo === 'rescue' ? 'Non posso' : 'Rifiuto'}</button>
      ${o.tipo === 'proposta' ? `<button type="button" class="tasto tasto--chiaro" data-offerta="chiarimento" data-tipo="proposta" data-id="${esc(o.id)}">Chiedi un chiarimento</button>` : ''}
    </div></li>`).join('')}</ul>`
}

// ---------- chi pubblica: «Lavoratori disponibili» ----------
const DEMO = [
  { user_id: 'demo-1', nome: 'Sara B.', citta: 'Forlì', zona: 'Centro', raggio_km: 10, mansioni: ['cameriera', 'barista'], competenze: ['servizio ai tavoli', 'caffetteria'], identita_verificata: true, identita_simulata: true, incarichi_completati: 7, ore: 6 },
  { user_id: 'demo-2', nome: 'Luca M.', citta: 'Forlì', zona: 'Ronco', raggio_km: 15, mansioni: ['magazzino'], competenze: ['muletto', 'inventario'], identita_verificata: true, identita_simulata: true, incarichi_completati: 3, ore: 4 },
  { user_id: 'demo-3', nome: 'Amina K.', citta: 'Forlì', zona: 'San Martino', raggio_km: 8, mansioni: ['hostess', 'accoglienza'], competenze: ['inglese B2', 'francese'], identita_verificata: true, identita_simulata: true, incarichi_completati: 0, ore: 8 },
]
export function riquadroDisponibili() {
  if (!attivo()) return ''
  return `<article class="riquadro riquadro--largo riquadro--live">
    <h3>Lavoratori disponibili</h3>
    <p>Persone verificate che hanno dichiarato di essere libere. Puoi inviare una proposta collegata a un tuo annuncio completo.</p>
    <button type="button" class="tasto" data-live="cerca">Cerca chi è disponibile</button>
  </article>`
}
async function cercaDisponibili(filtri = {}) {
  const dataOra = filtri.inizio ? new Date(filtri.inizio) : new Date()
  const fine = filtri.fine ? new Date(filtri.fine) : new Date(dataOra.getTime() + 3600000)
  let lista = []
  let nota = ''
  if (reale()) {
    try {
      const r = await rpc('lavoratori_disponibili', { p: { inizio: dataOra.toISOString(), fine: fine.toISOString(), citta: filtri.citta || null, mansione: filtri.mansione || null, solo_immediata: !!filtri.subito } })
      if (r?.errore) { finestraTrust(['identita'], 'pubblica'); return }
      lista = r || []
    } catch (e) { errore(e, 'pubblica'); return }
  } else {
    lista = DEMO.filter((d) => !filtri.mansione || [...d.mansioni, ...d.competenze].some((m) => m.includes(filtri.mansione.toLowerCase())))
      .map((d) => ({ ...d, inizio: new Date().toISOString(), fine: new Date(Date.now() + d.ore * 3600000).toISOString() }))
    nota = '<p class="etichetta-esempio">Profili di esempio (account di prova): non sono persone reali.</p>'
  }
  s.apri(`<p class="dettaglio__cat">JobExpress Live</p><h2>Lavoratori disponibili</h2>
    <form class="live-filtri" data-live-filtri novalidate>
      <input name="mansione" placeholder="Mansione (es. cameriere)" value="${esc(filtri.mansione || '')}" aria-label="Mansione" />
      <input name="citta" placeholder="Città" value="${esc(filtri.citta || s.utente()?.citta || '')}" aria-label="Città" />
      <input name="inizio" type="datetime-local" value="${filtri.inizioLocale || ''}" aria-label="Da quando" />
      <label class="spunta"><input type="checkbox" name="subito" ${filtri.subito ? 'checked' : ''}/> Solo disponibili adesso</label>
      <button type="submit" class="tasto tasto--chiaro">Filtra</button>
    </form>
    ${nota}
    ${lista.length ? `<ul class="live-persone">${lista.map((p) => `<li class="live-persona">
      <span class="avatar" aria-hidden="true">${esc(p.nome.charAt(0))}</span>
      <div><strong>${esc(p.nome)}</strong> ${p.identita_verificata ? `<span class="badge-verifica badge-verifica--identita">${p.identita_simulata ? 'Identità verificata · simulata' : 'Identità verificata'}</span>` : ''}
        <p>${esc(p.citta)}${p.zona ? ` · ${esc(p.zona)}` : ''} · entro ${p.raggio_km} km · ${p.immediata === false ? `dal ${esc(fascia(p.inizio, p.fine))}` : `libero/a fino alle ${ora(p.fine)}`}</p>
        <p>${esc([...(p.mansioni || []), ...(p.competenze || [])].slice(0, 6).join(' · ') || 'Competenze non indicate')}</p>
        <p class="finestra__nota">${p.incarichi_completati ? `${p.incarichi_completati} incarichi completati su JobExpress` : 'Nuovo su JobExpress'}${p.compenso_min ? ` · chiede almeno ${euro.format(p.compenso_min)}/ora` : ''}</p></div>
      <button type="button" class="tasto tasto--chiaro" data-live-proponi="${esc(p.user_id)}" data-nome="${esc(p.nome)}">Invia proposta</button></li>`).join('')}</ul>`
      : '<p>Nessuna persona disponibile con questi filtri in questo momento. Prova un altro orario o pubblica l’annuncio: le candidature arriveranno lo stesso.</p>'}
    <p class="finestra__nota">L’ordine non dipende dall’abbonamento né dall’aspetto: prima chi è libero/a prima, poi a rotazione. Non vedi telefono, indirizzo o posizione.</p>`)
  const f = document.querySelector('[data-live-filtri]')
  f.onsubmit = (e) => {
    e.preventDefault()
    const v = (n) => f.elements[n].value.trim()
    const ini = v('inizio') ? new Date(v('inizio')) : null
    cercaDisponibili({ mansione: v('mansione'), citta: v('citta'), subito: f.elements.subito.checked, inizioLocale: v('inizio'), inizio: ini?.toISOString(), fine: ini ? new Date(ini.getTime() + 3600000).toISOString() : null })
  }
  document.querySelectorAll('[data-live-proponi]').forEach((b) => { b.onclick = () => scegliAnnuncio(b.dataset.liveProponi, b.dataset.nome) })
}
let annunciCommittente = () => []
export const impostaAnnunciCommittente = (f) => { annunciCommittente = f }
function scegliAnnuncio(id, nome) {
  if (!reale()) { s.apri(`<h2>Proposta a ${esc(nome)}</h2><p>Con l’account di prova le proposte non partono: i profili sono di esempio. Con un account vero la proposta arriva alla persona, che può accettare, rifiutare o chiedere un chiarimento.</p>`); return }
  const lista = annunciCommittente().filter((a) => a.stato === 'pubblicato' && a.posti_liberi > 0 && a.turni?.length && new Date(a.turni[0].inizio) > Date.now())
  if (!lista.length) { s.apri('<h2>Serve un annuncio</h2><p>Per inviare una proposta serve un tuo annuncio pubblicato, con posti liberi, che indichi mansione, orario, compenso, luogo e tipo di rapporto.</p><button type="button" class="tasto" data-pubblica>+ Pubblica un incarico</button>'); return }
  s.apri(`<h2>Proposta a ${esc(nome)}</h2><form class="conto-form" data-live-invia novalidate>
    <div class="campo"><label for="lp-ann">Per quale annuncio</label><select id="lp-ann" name="annuncio">${lista.map((a) => `<option value="${esc(a.id)}">${esc(a.titolo)} · ${esc(fascia(a.turni[0].inizio, a.turni[a.turni.length - 1].fine))}</option>`).join('')}</select></div>
    <div class="campo"><label for="lp-msg">Messaggio <span class="facoltativo">facoltativo</span></label><input id="lp-msg" name="msg" maxlength="300" placeholder="Ciao, ti andrebbe di…" /></div>
    <p class="finestra__nota">La persona vede tutte le condizioni dell’annuncio prima di decidere. Può rifiutare o non rispondere senza conseguenze. Se accetta, l’incarico è confermato da entrambi.</p>
    <p class="conto-form__errore" data-errore role="alert"></p>
    <div class="finestra__azioni"><button type="submit" class="tasto">Invia la proposta</button></div></form>`)
  const f = document.querySelector('[data-live-invia]')
  f.onsubmit = async (e) => {
    e.preventDefault()
    try {
      const r = await rpc('invia_proposta_diretta', { p_annuncio: f.elements.annuncio.value, p_lavoratore: id, p_messaggio: f.elements.msg.value.trim() || null })
      if (!r.ok) { f.querySelector('[data-errore]').textContent = MOTIVI[r.motivo] || 'Non è stato possibile.'; return }
      s.apri(`<h2>Proposta inviata</h2><p>${esc(nome)} può rispondere fino alle ${ora(r.scade_il)}. Ti avvisiamo quando risponde.</p>`)
    } catch (err) { errore(err, 'pubblica') }
  }
}

// ---------- Rescue (chi pubblica) ----------
export function bloccoRescue(a) {
  if (!reale() || impostazioni().rescue_enabled === false) return ''
  const r = a.rescue
  const iniziato = a.turni?.length && new Date(a.turni[0].inizio) <= Date.now()
  const liberi = a.posti_stato ? a.posti_stato.disponibili : a.posti_liberi
  if (r?.stato === 'attiva') {
    const g = r.per_gruppo || {}
    return `<div class="rescue-stato" role="status">
      <p class="rescue-stato__titolo">Rescue attivo · ricerca ${esc({ ordinaria: 'progressiva', accelerata: 'accelerata', simultanea: 'immediata' }[r.intensita])}</p>
      <ol class="rescue-gruppi">
        <li class="${r.gruppo >= 1 ? 'fatto' : ''}"><strong>${g[1] || 0}</strong> chi si era già candidato</li>
        <li class="${r.gruppo >= 2 ? 'fatto' : ''}"><strong>${g[2] || 0}</strong> lavoratori Live disponibili</li>
        <li class="${r.gruppo >= 3 ? 'fatto' : ''}"><strong>${g[3] || 0}</strong> community della zona (avvisi urgenti)</li></ol>
      <p>${r.avvisati ? `${r.avvisati} persone avvisate · ${r.rifiuti} non possono` : 'Nessuna persona compatibile trovata finora: la ricerca continua da sola.'}${Number(r.bonus_urgenza) ? ` · bonus ${euro.format(r.bonus_urgenza)}` : ''}</p>
      <div class="pa-azioni-riga"><button type="button" class="tasto tasto--chiaro" data-rescue="bonus" data-id="${esc(r.id)}" data-bonus="${esc(r.bonus_urgenza)}">Aumenta il bonus</button>
        <button type="button" class="tasto tasto--chiaro" data-rescue="chiudi" data-id="${esc(r.id)}">Ferma la ricerca</button></div>
      <p class="finestra__nota">Non possiamo garantire che si trovi un sostituto. La ricerca si ferma da sola quando il posto è coperto o l’incarico inizia.</p></div>`
  }
  const esito = r && r.stato !== 'attiva' ? `<p class="finestra__nota">Ultima ricerca Rescue: ${esc({ coperta: 'posto coperto ✓', annullata: 'fermata da te', scaduta: 'nessun sostituto trovato in tempo' }[r.stato])}.</p>` : ''
  if (iniziato || !(liberi > 0) || a.stato !== 'pubblicato') return esito
  const haAnnullati = a.posti_stato?.annullati > 0
  return `${esito}<div class="rescue-invito${haAnnullati ? ' rescue-invito--urgente' : ''}"><p><strong>${haAnnullati ? 'Un posto è rimasto scoperto.' : `${liberi} ${liberi === 1 ? 'posto libero' : 'posti liberi'}.`}</strong> Con Rescue avvisiamo chi può sostituire.</p>
    <button type="button" class="tasto ${haAnnullati ? '' : 'tasto--chiaro'}" data-rescue="attiva" data-id="${esc(a.id)}" data-euro="${esc(a.compenso_ora)}" data-ore="${esc(oreAnnuncio(a))}">Attiva Rescue</button></div>`
}
const oreAnnuncio = (a) => (a.turni || []).reduce((x, t) => x + (new Date(t.fine) - new Date(t.inizio)) / 3600000, 0)
function finestraRescue(id, euroOra, ore) {
  const base = Math.round(Number(euroOra) * Number(ore) * 100) / 100
  const conBonus = impostazioni().rescue_urgency_bonus_enabled !== false
  s.apri(`<p class="dettaglio__cat">JobExpress Rescue</p><h2>Cerca un sostituto</h2>
    <p>Quando un imprevisto non deve fermare il lavoro. Avvisiamo, in quest’ordine:</p>
    <ol class="rescue-gruppi rescue-gruppi--spiega"><li>chi si era già candidato ed è ancora libero/a</li><li>chi ha attivato Live in quella fascia e zona</li><li>chi in zona ha scelto di ricevere richieste urgenti</li></ol>
    <p class="finestra__nota">Più manca poco all’inizio, più la ricerca è rapida (sotto 1 ora avvisiamo tutti insieme). Nessuno riceve avvisi doppi. L’abbonamento non dà priorità.</p>
    <form class="conto-form" data-rescue-form novalidate>
      ${conBonus ? `<div class="campo"><label for="rs-bonus">Bonus urgenza (€) <span class="facoltativo">facoltativo, va tutto a chi accetta</span></label><input id="rs-bonus" name="bonus" type="number" min="0" max="500" step="1" value="0" /></div>
      <p class="rescue-conto" data-rescue-conto>Compenso lordo originale: <strong>${euro.format(base)}</strong></p>` : ''}
      <p class="finestra__nota">Il bonus non è una commissione per JobExpress, è visibile prima dell’accettazione e non può sostituire i minimi retributivi. Dopo la conferma non si può ridurre.</p>
      <p class="conto-form__errore" data-errore role="alert"></p>
      <div class="finestra__azioni"><button type="submit" class="tasto">Avvia la ricerca</button></div></form>`)
  const f = document.querySelector('[data-rescue-form]')
  const conto = f.querySelector('[data-rescue-conto]')
  f.oninput = () => { if (!conto) return; const b = Math.max(0, Number(f.elements.bonus.value) || 0); conto.innerHTML = `Compenso lordo originale: <strong>${euro.format(base)}</strong>${b ? ` · Bonus urgenza: <strong>${euro.format(b)}</strong> · Totale: <strong>${euro.format(base + b)}</strong>` : ''}` }
  f.onsubmit = async (e) => {
    e.preventDefault()
    try {
      const r = await rpc('attiva_rescue', { p_annuncio: id, p_bonus: Number(f.elements.bonus?.value) || 0, p_motivo: 'posto_scoperto', p_incarico_originale: null })
      if (!r.ok) {
        if (r.motivo === 'gia_iniziato') { s.apri('<h2>L’incarico è già iniziato</h2><p>Rescue funziona prima dell’inizio. Per le ore che restano puoi pubblicare un nuovo annuncio: ci vuole un minuto.</p><button type="button" class="tasto" data-pubblica>+ Nuovo annuncio per le ore rimanenti</button>'); return }
        f.querySelector('[data-errore]').textContent = MOTIVI[r.motivo] || 'Non è stato possibile.'; return
      }
      s.apri(`<h2>Ricerca avviata</h2><p>${r.nuovi_avvisati ? `Abbiamo avvisato ${r.nuovi_avvisati} ${r.nuovi_avvisati === 1 ? 'persona' : 'persone'}.` : 'Per ora nessuna persona compatibile: la ricerca continua da sola nei prossimi minuti.'} Ti avvisiamo appena qualcuno accetta.</p>`)
      s.dopo?.()
    } catch (err) { errore(err, 'pubblica') }
  }
}
export function bloccoProposteDirette(a) {
  const l = (a.proposte_dirette || []).filter((p) => ['inviata', 'chiarimento', 'accettata', 'rifiutata', 'scaduta'].includes(p.stato))
  if (!l.length) return ''
  const NOMI = { inviata: 'in attesa', chiarimento: 'chiede un chiarimento', accettata: 'accettata', rifiutata: 'rifiutata', scaduta: 'scaduta' }
  return `<ul class="proposte-dirette">${l.map((p) => `<li><span>Proposta a <strong>${esc(p.nome)}</strong>: ${esc(NOMI[p.stato])}${p.domanda && p.stato === 'chiarimento' ? ` — «${esc(p.domanda)}»` : ''}</span>
    ${p.stato === 'chiarimento' ? `<button type="button" class="tasto tasto--chiaro tasto--piccolo" data-pd="rispondi" data-id="${esc(p.id)}">Rispondi</button>` : ''}
    ${['inviata', 'chiarimento'].includes(p.stato) ? `<button type="button" class="tasto tasto--chiaro tasto--piccolo" data-pd="ritira" data-id="${esc(p.id)}">Ritira</button>` : ''}</li>`).join('')}</ul>`
}

// ---------- eventi ----------
function chiediTesto(titolo, invia) {
  s.apri(`<h2>${esc(titolo)}</h2><form class="conto-form" data-live-testo novalidate>
    <div class="campo"><label for="lt">Messaggio</label><textarea id="lt" name="t" rows="3" maxlength="500" required></textarea></div>
    <div class="finestra__azioni"><button type="submit" class="tasto">Invia</button></div></form>`)
  document.querySelector('[data-live-testo]').onsubmit = (e) => { e.preventDefault(); const v = e.target.elements.t.value.trim(); if (v.length >= 3) invia(v) }
}
async function esito(p, ok) {
  try {
    const r = await p
    if (r && r.ok === false) s.apri(`<h2>Non è stato possibile</h2><p>${esc(MOTIVI[r.motivo] || 'Riprova tra poco.')}</p>`)
    else if (ok) s.apri(ok(r))
  } catch (e) { errore(e) }
  await aggiornaLive(); s.dopo?.()
}
export function gestisciLive(e) {
  if (e.type !== 'click') return false
  const t = e.target
  const l = t.closest('[data-live]')
  if (l) {
    const k = l.dataset.live
    if (k === 'on') { if (!mie.some((d) => new Date(d.inizio) <= Date.now())) finestraLive(false); return true }
    if (k === 'programma') { finestraLive(true); return true }
    if (k === 'cerca') { cercaDisponibili({}); return true }
    if (k === 'off') {
      if (!reale()) { mie = leggiProva().filter((d) => new Date(d.inizio) > Date.now()); scriviProva(mie); s.ridisegna(); return true }
      const ora2 = Date.now(); const corrente = mie.find((d) => new Date(d.inizio) <= ora2)
      if (corrente) esito(rpc('live_disattiva', { p_id: corrente.id }))
      return true
    }
  }
  const tg = t.closest('[data-live-togli]')
  if (tg) {
    if (!reale()) { mie = leggiProva().filter((d) => d.id !== tg.dataset.liveTogli); scriviProva(mie); s.ridisegna(); return true }
    esito(rpc('live_disattiva', { p_id: tg.dataset.liveTogli })); return true
  }
  const o = t.closest('[data-offerta]')
  if (o) {
    const { offerta: k, tipo, id } = o.dataset
    if (tipo === 'rescue') esito(rpc('rispondi_rescue', { p_richiesta: id, p_accetta: k === 'accetta' }), (r) => k === 'accetta' ? `<h2>Incarico confermato</h2><p>Grazie! Il committente è avvisato.${r.avvisi_spostamenti?.length ? ' Attenzione: è vicino a un altro tuo incarico, controlla gli spostamenti.' : ''}</p><p class="finestra__nota">La conferma non sostituisce il contratto né gli adempimenti obbligatori.</p>` : '<h2>Va bene</h2><p>Nessun problema e nessuna penalità.</p>')
    else if (k === 'chiarimento') chiediTesto('Chiedi un chiarimento', (v) => esito(rpc('rispondi_proposta_diretta', { p_id: id, p_esito: 'chiarimento', p_testo: v }), () => '<h2>Domanda inviata</h2><p>Ti avvisiamo quando il committente risponde.</p>'))
    else esito(rpc('rispondi_proposta_diretta', { p_id: id, p_esito: k }), () => k === 'accetta' ? '<h2>Incarico confermato</h2><p>Confermato da entrambi. Lo trovi in Attività.</p><p class="finestra__nota">La conferma non sostituisce il contratto né gli adempimenti obbligatori.</p>' : '<h2>Proposta rifiutata</h2><p>Nessuna penalità.</p>')
    return true
  }
  const rs = t.closest('[data-rescue]')
  if (rs) {
    const { rescue: k, id } = rs.dataset
    if (k === 'attiva') finestraRescue(id, rs.dataset.euro, rs.dataset.ore)
    if (k === 'chiudi') esito(rpc('chiudi_rescue', { p_id: id }), () => '<h2>Ricerca fermata</h2>')
    if (k === 'bonus') {
      s.apri(`<h2>Aumenta il bonus urgenza</h2><form class="conto-form" data-rescue-bonus novalidate><div class="campo"><label for="rb">Nuovo bonus (€)</label><input id="rb" name="b" type="number" min="${Number(rs.dataset.bonus) + 1}" max="500" value="${Number(rs.dataset.bonus) + 10}" /></div>
        <p class="finestra__nota">Si può solo aumentare. Vale per chi accetta da ora in poi.</p><div class="finestra__azioni"><button type="submit" class="tasto">Aggiorna</button></div></form>`)
      document.querySelector('[data-rescue-bonus]').onsubmit = (ev) => { ev.preventDefault(); esito(rpc('aumenta_bonus_rescue', { p_id: id, p_bonus: Number(ev.target.elements.b.value) }), () => '<h2>Bonus aggiornato</h2>') }
    }
    return true
  }
  const pd = t.closest('[data-pd]')
  if (pd) {
    if (pd.dataset.pd === 'ritira') esito(rpc('ritira_proposta_diretta', { p_id: pd.dataset.id }), () => '<h2>Proposta ritirata</h2>')
    else chiediTesto('Rispondi alla domanda', (v) => esito(rpc('rispondi_domanda_proposta', { p_id: pd.dataset.id, p_testo: v }), () => '<h2>Risposta inviata</h2>'))
    return true
  }
  return false
}

export function avviaLive(strumenti) {
  s = { ...s, ...strumenti }
  aggiornaLive()
  setInterval(aggiornaLive, 30000)
}
