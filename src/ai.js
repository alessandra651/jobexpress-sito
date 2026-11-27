// JobExpress AI — assistente per la crescita professionale (funzione Plus).
// * Cinque aree: colloqui, curriculum, mansioni, crescita, organizzazione economica.
// * 20 richieste al mese (Plus e ogni membro Friends), contate SOLO dal server:
//   la funzione sicura «jobexpress-ai» su Supabase tiene la chiave del provider e il contatore.
// * Le informazioni professionali (dal CV) si usano solo se la persona dà il consenso.
//   Mai dati economici o chat private.
// * Storico delle conversazioni, eliminabili in ogni momento.
import { haPlus } from './abbonamenti.js'
import { fotografia } from './cv.js'
import { SUPABASE_KEY, SUPABASE_URL } from './config.js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const K = 'jobexpress-ai-consenso'
const AREE = [
  ['colloqui', 'Colloqui', ['Simula un colloquio per cameriere', 'Come presento le mie esperienze in 1 minuto?', 'Domande tipiche per hostess a una fiera']],
  ['curriculum', 'Curriculum', ['Migliora la mia presentazione del CV', 'Come descrivo l’esperienza da barista?', 'Quali competenze valorizzare per un negozio?']],
  ['mansioni', 'Mansioni', ['Cosa fa un runner al primo giorno?', 'Come mi preparo a un turno di babysitting?', 'Come gestisco un cliente scortese?']],
  ['crescita', 'Crescita', ['Quali competenze potrei sviluppare?', 'Che percorsi posso fare nella ristorazione?', 'Aiutami a fissare un obiettivo per i prossimi 3 mesi']],
  ['economia', 'Guadagni e tempo', ['Come organizzo lavoro ed esami questo mese?', 'Quante ore servono per 300 € al mese?', 'Come divido le entrate tra spese e risparmi?']],
]
const ERRORI = {
  non_configurato: 'Il servizio AI non è ancora collegato: va aggiunta la chiave del provider AI su Supabase.',
  non_attiva: 'JobExpress AI non è ancora attiva: si accende dall’area Admin.',
  serve_plus: 'JobExpress AI è inclusa in Plus e Friends.',
  limite: 'Hai usato tutte le richieste di questo mese. Si rinnovano il primo giorno del mese.',
  troppo_lunga: 'La domanda è troppo lunga: massimo 1000 caratteri.',
  servizio: 'Il servizio non ha risposto. La richiesta non è stata conteggiata: riprova tra poco.',
  accesso: 'Sessione scaduta: esci e rientra.',
}

let s = { utente: () => null, token: async () => null, ridisegna: () => {} }
let stato = null // { attiva, piano, limite, usate, rinnovo }
let conversazioni = []
let attuale = null // { id, area, messaggi }
let area = 'colloqui'
let attesa = false
let errore = ''
let caricato = false
const consenso = () => { try { return localStorage.getItem(K) === 'si' } catch { return false } }

export const avviaAI = (strumenti) => { s = { ...s, ...strumenti } }

async function rest(percorso, opz = {}) {
  const t = await s.token()
  const r = await fetch(`${SUPABASE_URL}${percorso}`, { ...opz, headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(opz.headers || {}) } })
  const testo = await r.text()
  const dati = testo ? JSON.parse(testo) : null
  if (!r.ok) { const e = new Error(dati?.errore || String(r.status)); e.codice = dati?.errore; throw e }
  return dati
}

async function carica() {
  const u = s.utente()
  if (!u || u.prova || !SUPABASE_KEY) { caricato = true; return }
  try {
    stato = await rest('/rest/v1/rpc/ai_stato', { method: 'POST', body: '{}' })
    conversazioni = await rest('/rest/v1/ai_conversazioni?select=id,area,titolo,messaggi,aggiornato_il&order=aggiornato_il.desc&limit=30')
  } catch { /* senza rete */ }
  caricato = true
  s.ridisegna()
}

function contesto() {
  if (!consenso()) return ''
  const f = fotografia()
  const esp = f.sezioni.find((x) => x.k === 'esperienze')
  const righe = [
    f.titolo && `Ruolo: ${f.titolo}`,
    ...(f.sezioni.find((x) => x.k === 'presentazione')?.testo ? [`Presentazione: ${f.sezioni.find((x) => x.k === 'presentazione').testo}`] : []),
    esp?.jobexpress?.length && `Esperienze su JobExpress: ${esp.jobexpress.map((x) => `${x.titolo} (${x.categoria}, ${x.periodo})`).join('; ')}`,
    esp?.esterne?.length && `Altre esperienze dichiarate: ${esp.esterne.map((x) => `${x.ruolo} presso ${x.dove}`).join('; ')}`,
    f.sezioni.find((x) => x.k === 'competenze')?.voci?.length && `Competenze dichiarate: ${f.sezioni.find((x) => x.k === 'competenze').voci.join(', ')}`,
    f.sezioni.find((x) => x.k === 'lingue')?.voci?.length && `Lingue: ${f.sezioni.find((x) => x.k === 'lingue').voci.map((x) => `${x.lingua} ${x.livello}`).join(', ')}`,
  ].filter(Boolean)
  return righe.join('\n').slice(0, 1500)
}

async function invia(testo) {
  attesa = true; errore = ''; s.ridisegna()
  try {
    const r = await rest('/functions/v1/jobexpress-ai', { method: 'POST', body: JSON.stringify({ area, testo, conversazione_id: attuale?.id || null, contesto: contesto() }) })
    attuale = { id: r.conversazione_id, area, messaggi: [...(attuale?.messaggi || []), { ruolo: 'tu', testo }, { ruolo: 'ai', testo: r.risposta }] }
    if (stato) { stato.usate = r.usate; stato.limite = r.limite }
    conversazioni = [{ id: attuale.id, area, titolo: attuale.messaggi[0].testo.slice(0, 80), messaggi: attuale.messaggi }, ...conversazioni.filter((c) => c.id !== attuale.id)]
  } catch (e) {
    errore = ERRORI[e.codice] || ERRORI.servizio
  }
  attesa = false
  s.ridisegna()
}

export function pannelloAI() {
  const u = s.utente()
  const indietro = '<button type="button" class="pc-indietro" data-pc-vai="panoramica">← Il tuo percorso</button>'
  const testa = '<header class="pc-testa"><h3>JobExpress AI</h3><p>Il tuo assistente per lavoro e crescita.</p></header>'
  if (!haPlus()) {
    return `<div class="pc">${indietro}${testa}<article class="pc-card pc-promo"><span class="pc-plus">Plus</span><h4>Con JobExpress AI puoi…</h4>
      <ul class="pc-lista-check"><li>allenarti ai colloqui con domande sulla mansione</li><li>migliorare il tuo curriculum senza inventare nulla</li><li>prepararti al primo giorno di un incarico</li><li>pianificare crescita, guadagni e tempo</li></ul>
      <p class="pc-nota">20 richieste al mese incluse in Plus; con Friends 20 a testa.</p>
      <button type="button" class="tasto" data-abbonati="plus">Scopri Plus</button></article></div>`
  }
  if (!caricato) carica()
  const reale = u && !u.prova
  const lim = stato?.limite ?? 20
  const usate = stato?.usate ?? 0
  const rest_ = Math.max(0, lim - usate)
  const rinnovo = stato?.rinnovo ? new Date(`${stato.rinnovo}T00:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }) : ''
  const blocco = !reale ? 'Con l’account di prova l’assistente non risponde: serve un account vero con Plus.'
    : stato && !stato.attiva ? ERRORI.non_attiva : rest_ === 0 ? ERRORI.limite : ''
  const sug = AREE.find((x) => x[0] === area)[2]
  return `<div class="pc">${indietro}${testa}
    <article class="pc-card ai-contatore">
      <div class="pc-card__testa"><span>Hai utilizzato <strong>${usate}</strong> richieste su <strong>${lim}</strong>.</span>${rinnovo ? `<span class="pc-nota">Si rinnovano il ${rinnovo}</span>` : ''}</div>
      <div class="pc-barra"><i style="--w:${Math.min(100, (usate / lim) * 100)}%"></i></div>
      ${rest_ > 0 && rest_ <= 3 ? `<p class="ai-avviso">Ti restano solo ${rest_} richieste questo mese.</p>` : ''}
    </article>
    ${blocco ? `<p class="avviso-prova">${esc(blocco)}</p>` : ''}
    <div class="ai-aree" role="tablist" aria-label="Argomento">${AREE.map(([k, t]) => `<button type="button" role="tab" data-ai-area="${k}" aria-selected="${area === k}">${t}</button>`).join('')}</div>
    <article class="pc-card ai-chat">
      ${attuale?.messaggi?.length ? `<ol class="ai-messaggi">${attuale.messaggi.map((m) => `<li class="ai-m ai-m--${m.ruolo === 'ai' ? 'ai' : 'tu'}">${esc(m.testo).replace(/\n/g, '<br>')}</li>`).join('')}${attesa ? '<li class="ai-m ai-m--ai ai-m--attesa"><span></span><span></span><span></span></li>' : ''}</ol>`
        : `<div class="ai-vuoto"><p>Da dove vuoi partire?</p><ul class="ai-sugg">${sug.map((x) => `<li><button type="button" data-ai-sugg="${esc(x)}" ${blocco ? 'disabled' : ''}>${esc(x)}</button></li>`).join('')}</ul></div>`}
      <form class="ai-form" data-ai-form novalidate>
        <label class="sr" for="ai-testo">La tua domanda</label>
        <textarea id="ai-testo" name="testo" rows="2" maxlength="1000" placeholder="Scrivi la tua domanda…" ${blocco || attesa ? 'disabled' : ''}></textarea>
        <button type="submit" class="tasto" ${blocco || attesa ? 'disabled' : ''}>${attesa ? 'Attendi…' : 'Invia'}</button>
      </form>
      ${errore ? `<p class="pc-errore" role="alert">${esc(errore)}</p>` : ''}
      <label class="cv-scelta ai-consenso"><input type="checkbox" data-ai-consenso ${consenso() ? 'checked' : ''}/> Usa le informazioni del mio CV (esperienze, competenze, lingue) per risposte su misura. Mai compensi o chat private.</label>
      <p class="pc-nota">L’assistente non inventa esperienze o qualifiche, non sostituisce la formazione obbligatoria e non decide chi viene assunto. Una richiesta che fallisce per un problema tecnico non viene contata.</p>
      ${attuale ? '<button type="button" class="link-prova" data-ai-nuova>Nuova conversazione</button>' : ''}
    </article>
    ${conversazioni.length ? `<details class="cv-ed"><summary>Conversazioni precedenti <span class="cv-ed__n">${conversazioni.length}</span></summary>
      <ul class="cv-ed__lista">${conversazioni.map((c) => `<li><button type="button" class="ai-storico" data-ai-apri="${esc(c.id)}">${esc(c.titolo)}</button><button type="button" class="cal-x" data-ai-elimina="${esc(c.id)}" aria-label="Elimina la conversazione">×</button></li>`).join('')}</ul></details>` : ''}
  </div>`
}

// true = ridisegna
export function gestisciAI(e) {
  const t = e.target
  if (e.type === 'change' && t.matches('[data-ai-consenso]')) { try { localStorage.setItem(K, t.checked ? 'si' : 'no') } catch { /* */ } return false }
  if (e.type === 'submit' && t.closest('[data-ai-form]')) {
    e.preventDefault()
    const testo = t.closest('[data-ai-form]').elements.testo.value.trim()
    if (testo && !attesa) invia(testo.slice(0, 1000))
    return false
  }
  if (e.type !== 'click') return false
  const a = t.closest('[data-ai-area]'); if (a) { area = a.dataset.aiArea; attuale = null; return true }
  const sg = t.closest('[data-ai-sugg]'); if (sg) { invia(sg.dataset.aiSugg); return false }
  if (t.closest('[data-ai-nuova]')) { attuale = null; return true }
  const ap = t.closest('[data-ai-apri]'); if (ap) { const c = conversazioni.find((x) => x.id === ap.dataset.aiApri); if (c) { attuale = { id: c.id, area: c.area, messaggi: c.messaggi }; area = c.area } return true }
  const el = t.closest('[data-ai-elimina]')
  if (el) {
    const id = el.dataset.aiElimina
    rest(`/rest/v1/ai_conversazioni?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
      .then(() => { conversazioni = conversazioni.filter((x) => x.id !== id); if (attuale?.id === id) attuale = null; s.ridisegna() }).catch(() => {})
    return false
  }
  return false
}
