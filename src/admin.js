// Area Admin del fondatore.
// Accesso: con un account vero, Supabase controlla che tu sia nella tabella
// "amministratori" (conoscere l'indirizzo della pagina non basta).
// Con l'account di prova si vede un'area Admin di prova, solo con i dati di
// questo dispositivo.
import { SUPABASE_KEY, SUPABASE_URL } from './config.js'
import { NOME_CAT, tuttiIncarichi } from './incarichi.js'
import { moderaAnnuncio, tuttiIMieiAnnunci } from './annunci.js'
import { aggiornaSegnalazione, segnalazioni } from './segnalazioni.js'
import { leggiCand } from './lavori.js'
import { pianoAttivo } from './abbonamenti.js'
import { caricaImpostazioni, impostazioni, impostazioniDalServer } from './regole.js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const CHIAVE_LOG = 'jobexpress-registro-admin'
let s = {} // strumenti: utente, token
let pannello = null
let stato = { reale: null, statistiche: null, incarichi: null, errore: '' }

async function rpc(nome, corpo = {}) {
  const token = await s.token()
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(15000),
  })
  if (!r.ok) throw new Error(String(r.status))
  const t = await r.text()
  return t ? JSON.parse(t) : null
}

// Può vedere il pulsante "Area Admin"?
export async function puoAmministrare() {
  const u = s.utente?.()
  if (!u) return false
  if (u.prova) return true
  try { return (await rpc('sono_admin')) === true } catch { return false }
}

function registra(azione, dettagli) {
  let l = []
  try { l = JSON.parse(localStorage.getItem(CHIAVE_LOG) || '[]') } catch { /* vuoto */ }
  l.unshift({ azione, dettagli, il: Date.now() })
  try { localStorage.setItem(CHIAVE_LOG, JSON.stringify(l.slice(0, 100))) } catch { /* non disponibile */ }
  if (stato.reale) rpc('admin_registra', { azione, dettagli }).catch(() => {})
}
const registro = () => { try { return JSON.parse(localStorage.getItem(CHIAVE_LOG) || '[]') } catch { return [] } }

function numeri() {
  const annunci = tuttiIMieiAnnunci()
  const cand = leggiCand()
  const tutti = tuttiIncarichi()
  const perCat = {}
  tutti.forEach((a) => { perCat[a.cat] = (perCat[a.cat] || 0) + 1 })
  const perCitta = {}
  tutti.forEach((a) => { perCitta[a.citta] = (perCitta[a.citta] || 0) + 1 })
  return {
    annunci: tutti.length,
    attivi: annunci.filter((a) => a.stato === 'attivo').length + tutti.filter((a) => !a.mio).length,
    revisione: annunci.filter((a) => a.stato === 'revisione'),
    candidature: cand.length,
    confermati: cand.filter((c) => ['confermato', 'completato'].includes(c.stato)).length,
    completati: cand.filter((c) => c.stato === 'completato').length,
    annullati: cand.filter((c) => ['annullato', 'rifiutata'].includes(c.stato)).length,
    perCat: Object.entries(perCat).sort((a, b) => b[1] - a[1]).slice(0, 6),
    perCitta: Object.entries(perCitta).sort((a, b) => b[1] - a[1]),
    piano: pianoAttivo(),
  }
}

const barre = (righe, nome) => {
  const max = Math.max(1, ...righe.map(([, v]) => v))
  return `<ul class="percat">${righe.map(([k, v]) => `<li><span>${esc(nome(k))}</span><span class="percat__barra"><i style="width:${(v / max) * 100}%"></i></span><strong>${v}</strong></li>`).join('')}</ul>`
}


// ---------- Regole della piattaforma (tabella "impostazioni" su Supabase) ----------
const n2 = (v) => String(v).replace('.', ',')
function rigaNumero(nome, etichetta, valore, { min = 0, max = 1000, passo = 1 } = {}) {
  return `<div class="regole__riga"><label for="rg-${nome}">${etichetta}</label><input id="rg-${nome}" name="${nome}" type="number" inputmode="decimal" min="${min}" max="${max}" step="${passo}" value="${valore}" ${stato.reale ? '' : 'disabled'} /></div>`
}
function rigaSpunta(nome, etichetta, acceso) {
  return `<div class="regole__riga"><label for="rg-${nome}">${etichetta}</label><input id="rg-${nome}" name="${nome}" type="checkbox" ${acceso ? 'checked' : ''} ${stato.reale ? '' : 'disabled'} /></div>`
}
function bloccoRegole() {
  const im = impostazioni()
  const tempi = im.tempi_conferma
  const fasce = ['Meno di 1 ora all’inizio', 'Da 1 a 3 ore', 'Da 3 a 24 ore', 'Più di 24 ore']
  const fp = im.funzioni_premium || {}
  return `
      <section class="admin__blocco">
        <h3>Regole della piattaforma ${stato.reale ? '<span class="stato">modificabili</span>' : '<span class="etichetta-esempio">sola lettura</span>'}</h3>
        ${impostazioniDalServer() ? '' : '<p class="avviso-prova">Non riesco a leggere le regole da Supabase: vedi quelle predefinite.</p>'}
        <form class="regole" data-admin-regole novalidate>
          <fieldset class="regole__gruppo"><legend>Limite sperimentale per Free</legend>
            ${rigaSpunta('free_monthly_job_limit_enabled', 'Limite acceso per gli account veri', im.free_monthly_job_limit_enabled === true)}
            <p class="regole__avviso">Da tenere SPENTO finché un avvocato del lavoro non lo ha verificato. Accenderlo non risolve la questione legale: serve solo a rendere la scelta reversibile. Quando è spento, chi usa Free conferma incarichi senza limiti.</p>
            ${rigaSpunta('free_monthly_job_limit_demo', 'Mostra e applica il limite nel prototipo (solo account di prova)', im.free_monthly_job_limit_demo === true)}
            ${rigaNumero('free_monthly_job_limit', 'Incarichi confermati al mese con Free', im.free_monthly_job_limit, { min: 1, max: 100 })}
            ${rigaSpunta('annullamenti_lavoratore_contano', 'Se il lavoratore annulla, l’incarico resta nel conteggio del mese (evita abusi, nessuna penalità sul badge)', im.annullamenti_lavoratore_contano === true)}
          </fieldset>
          <fieldset class="regole__gruppo"><legend>Candidature e proposte</legend>
            ${rigaNumero('max_candidature_sovrapposte', 'Candidature attive nella stessa fascia oraria (uguale per tutti i piani)', im.max_candidature_sovrapposte, { min: 1, max: 100 })}
            ${rigaNumero('margine_spostamenti_minuti', 'Avviso spostamenti sotto (minuti)', im.margine_spostamenti_minuti, { min: 0, max: 240 })}
            ${tempi.map((t, i) => rigaNumero(`tempo_${i}`, `Tempo per confermare · ${fasce[i] || (t.meno_di_minuti == null ? 'oltre' : `meno di ${t.meno_di_minuti} min`)} (minuti)`, t.minuti, { min: 1, max: 1440 })).join('')}
          </fieldset>
          <fieldset class="regole__gruppo"><legend>Abbonamenti e funzioni Plus</legend>
            ${rigaNumero('plus_mese', 'Plus mensile (€)', im.prezzi.plus.mese, { min: 0, max: 999, passo: 0.01 })}
            ${rigaNumero('plus_anno', 'Plus annuale (€)', im.prezzi.plus.anno, { min: 0, max: 999, passo: 0.01 })}
            ${rigaNumero('friends_mese', 'Friends mensile, in tre (€)', im.prezzi.friends.mese, { min: 0, max: 999, passo: 0.01 })}
            ${rigaNumero('friends_anno', 'Friends annuale, in tre (€)', im.prezzi.friends.anno, { min: 0, max: 999, passo: 0.01 })}
            ${rigaSpunta('prova_attiva', 'Prova gratuita di Plus disponibile (solo se la persona la sceglie)', im.prova_gratuita?.attiva === true)}
            ${rigaNumero('prova_giorni', 'Giorni di prova gratuita', im.prova_gratuita?.giorni ?? 7, { min: 1, max: 60 })}
            ${rigaNumero('ai_richieste_mensili', 'Richieste AI al mese (Plus e ogni membro Friends)', im.ai_richieste_mensili, { min: 1, max: 100 })}
            ${['goal', 'cv', 'career', 'smart_calendar', 'ai'].map((k) => rigaSpunta(`fp_${k}`, `Funzione attiva: JobExpress ${{ goal: 'Goal', cv: 'CV', career: 'Career', smart_calendar: 'Smart Calendar', ai: 'AI' }[k]}`, fp[k] === true)).join('')}
          </fieldset>
          <div class="finestra__azioni"><button type="submit" class="tasto" ${stato.reale ? '' : 'disabled'}>Salva le regole</button></div>
          <p class="finestra__nota" data-regole-msg role="status">Le modifiche valgono da adesso in poi: non cambiano incarichi già confermati né proposte già inviate. Ogni modifica viene registrata.</p>
        </form>
      </section>`
}

async function salvaRegole(f) {
  const im = impostazioni()
  const el = f.elements
  const num = (k) => Number(String(el[k].value).replace(',', '.'))
  const nuove = {
    free_monthly_job_limit_enabled: el.free_monthly_job_limit_enabled.checked,
    free_monthly_job_limit_demo: el.free_monthly_job_limit_demo.checked,
    free_monthly_job_limit: num('free_monthly_job_limit'),
    annullamenti_lavoratore_contano: el.annullamenti_lavoratore_contano.checked,
    max_candidature_sovrapposte: num('max_candidature_sovrapposte'),
    margine_spostamenti_minuti: num('margine_spostamenti_minuti'),
    tempi_conferma: im.tempi_conferma.map((t, i) => ({ ...t, minuti: num(`tempo_${i}`) })),
    prezzi: { plus: { mese: num('plus_mese'), anno: num('plus_anno') }, friends: { mese: num('friends_mese'), anno: num('friends_anno') } },
    prova_gratuita: { attiva: el.prova_attiva.checked, giorni: num('prova_giorni') },
    ai_richieste_mensili: num('ai_richieste_mensili'),
    funzioni_premium: Object.fromEntries(['goal', 'cv', 'career', 'smart_calendar', 'ai'].map((k) => [k, el[`fp_${k}`].checked])),
  }
  const msg = f.querySelector('[data-regole-msg]')
  const cambiate = Object.keys(nuove).filter((k) => JSON.stringify(nuove[k]) !== JSON.stringify(im[k]))
  if (!cambiate.length) { msg.textContent = 'Nessuna modifica da salvare.'; return }
  msg.textContent = 'Salvo…'
  const errori = []
  for (const k of cambiate) {
    try { await rpc('admin_imposta', { p_chiave: k, p_valore: nuove[k] }) } catch { errori.push(k) }
  }
  await caricaImpostazioni()
  registra(`Regole modificate: ${cambiate.join(', ')}`, { chiavi: cambiate })
  disegna()
  pannello.querySelector('[data-regole-msg]').textContent = errori.length
    ? `Non salvate (valore non valido o accesso scaduto): ${errori.join(', ')}.`
    : `Salvato: ${cambiate.length} ${cambiate.length === 1 ? 'regola' : 'regole'}. Valgono da adesso.`
}

function bloccoIncarichi() {
  const x = stato.incarichi
  if (!x) return ''
  const perc = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—')
  return `
      <section class="admin__blocco">
        <h3>Candidature e incarichi <span class="stato">dati reali</span></h3>
        <ul class="stat stat--sei">
          <li><strong>${x.annunci_pubblicati}</strong><span>Annunci pubblicati</span></li><li><strong>${x.candidature_inviate}</strong><span>Candidature</span></li>
          <li><strong>${x.incarichi_assegnati}</strong><span>Incarichi assegnati</span></li><li><strong>${x.incarichi_completati}</strong><span>Completati</span></li>
          <li><strong>${perc(x.proposte_confermate, x.proposte_totali)}</strong><span>Proposte confermate</span></li><li><strong>${perc(x.proposte_scadute, x.proposte_totali)}</strong><span>Proposte scadute</span></li>
          <li><strong>${x.ritirate_incompatibili}</strong><span>Ritirate per incompatibilità</span></li><li><strong>${x.minuti_medi_assegnazione == null ? '—' : `${n2(x.minuti_medi_assegnazione)} min`}</strong><span>Tempo medio di assegnazione</span></li>
        </ul>
        ${stato.ai ? `<p class="finestra__nota">JobExpress AI questo mese: ${stato.ai.richieste_mese} richieste da ${stato.ai.utenti_mese} persone · costo stimato ${n2(Number(stato.ai.costo_mese_eur).toFixed(2))} €.</p>` : ''}
        <p class="finestra__nota">Abbonamenti attivi: ${Object.entries(x.abbonamenti || {}).map(([k, v]) => `${esc(k)} ${v}`).join(' · ') || 'nessuno'}. Pagamenti reali: non ancora attivi (ricavi 0 €).</p>
      </section>`
}

function disegna() {
  const n = numeri()
  const seg = segnalazioni()
  const aperte = seg.filter((x) => x.stato === 'aperta')
  const st = stato.statistiche
  pannello.innerHTML = `
    <div class="area__interno">
      <header class="area__testa">
        <div><p class="area__data">Area riservata</p><h2>Admin JobExpress</h2>
          ${stato.reale ? '<p class="finestra__nota">Accesso verificato da Supabase.</p>' : '<p class="avviso-prova">Admin di prova: vedi solo i dati di questo dispositivo. Con il tuo account vero, Supabase controlla che tu sia amministratore.</p>'}</div>
        <button type="button" class="tasto tasto--chiaro" data-admin-chiudi>Chiudi</button>
      </header>

      <section class="admin__blocco">
        <h3>Utenti registrati ${stato.reale ? '<span class="stato">dati reali</span>' : ''}</h3>
        ${st ? `<ul class="stat stat--sei">
            <li><strong>${st.utenti}</strong><span>Utenti</span></li><li><strong>${st.nuovi_7_giorni}</strong><span>Nuovi in 7 giorni</span></li>
            <li><strong>${st.lavoratori}</strong><span>Lavoratori</span></li><li><strong>${st.aziende}</strong><span>Aziende</span></li>
            <li><strong>${st.privati}</strong><span>Privati</span></li><li><strong>${st.interesse_lavoratori + st.interesse_attivita + st.interesse_partner}</strong><span>Contatti dal vecchio modulo</span></li></ul>
            ${st.citta.length ? `<h4>Distribuzione per città</h4>${barre(st.citta.map((c) => [c.citta, c.utenti]), (k) => k)}` : ''}`
          : `<p>${stato.errore || 'I numeri reali degli utenti arrivano da Supabase quando entri con il tuo account da amministratore.'}</p>`}
      </section>

      ${bloccoIncarichi()}
      ${bloccoRegole()}

      <section class="admin__blocco">
        <h3>Piattaforma <span class="etichetta-esempio">dati dimostrativi</span></h3>
        <ul class="stat stat--sei">
          <li><strong>${n.annunci}</strong><span>Annunci in bacheca</span></li><li><strong>${n.candidature}</strong><span>Candidature</span></li>
          <li><strong>${n.confermati}</strong><span>Incarichi confermati</span></li><li><strong>${n.completati}</strong><span>Completati</span></li>
          <li><strong>${n.annullati}</strong><span>Annullati o rifiutati</span></li><li><strong>${aperte.length}</strong><span>Segnalazioni aperte</span></li>
        </ul>
        <div class="admin__due">
          <div><h4>Categorie più usate</h4>${barre(n.perCat, (k) => NOME_CAT[k] || k)}</div>
          <div><h4>Annunci per città</h4>${barre(n.perCitta, (k) => k)}</div>
        </div>
        <p class="finestra__nota">Abbonamenti e ricavi: nessun pagamento reale è attivo. Piano su questo dispositivo: ${esc(n.piano)}.</p>
      </section>

      <section class="admin__blocco">
        <h3>Annunci da rivedere (${n.revisione.length})</h3>
        ${n.revisione.length ? `<ul class="candidature">${n.revisione.map((a) => `<li class="candidatura"><div><strong>${esc(a.titolo)}</strong><p>${esc(NOME_CAT[a.cat])} · ${esc(a.citta)} · ${esc(a.chi)}</p><p>${esc(a.descrizione)}</p></div>
          <div class="pa-azioni-riga"><button type="button" class="tasto" data-admin-annuncio="${esc(a.id)}" data-ok="1">Approva</button><button type="button" class="tasto tasto--chiaro" data-admin-annuncio="${esc(a.id)}" data-ok="0">Rifiuta</button></div></li>`).join('')}</ul>`
          : '<p>Nessun annuncio in attesa. Qui arrivano le categorie che richiedono una verifica, come l’assistenza alla persona.</p>'}
      </section>

      <section class="admin__blocco">
        <h3>Segnalazioni (${aperte.length} aperte)</h3>
        ${seg.length ? `<ul class="candidature">${seg.map((x) => `<li class="candidatura"><div><strong>${esc(x.titolo)}</strong><p>${esc({ annuncio: 'Annuncio', persona: 'Persona', recensione: 'Recensione' }[x.tipo] || x.tipo)} · ${esc(x.motivo)} · ${new Date(x.il).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p></div>
          <div class="candidatura__lato"><span class="stato stato--${x.stato === 'aperta' ? 'revisione' : 'chiuso'}">${{ aperta: 'Aperta', risolta: 'Risolta', archiviata: 'Archiviata' }[x.stato]}</span></div>
          ${x.stato === 'aperta' ? `<div class="pa-azioni-riga"><button type="button" class="tasto" data-admin-seg="${x.id}" data-esito="risolta">Risolta</button><button type="button" class="tasto tasto--chiaro" data-admin-seg="${x.id}" data-esito="archiviata">Archivia</button></div>` : ''}</li>`).join('')}</ul>`
          : '<p>Nessuna segnalazione.</p>'}
        <p class="finestra__nota">Le chat private non si leggono da qui: per una segnalazione si vede solo ciò che è stato segnalato.</p>
      </section>

      <section class="admin__blocco">
        <h3>Registro delle azioni</h3>
        ${registro().length ? `<ul class="admin__registro">${registro().slice(0, 15).map((r) => `<li><span>${new Date(r.il).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>${esc(r.azione)}</li>`).join('')}</ul>` : '<p>Nessuna azione registrata.</p>'}
        <button type="button" class="tasto tasto--chiaro" data-admin-report>Copia il report aggregato (CSV)</button>
        <p class="finestra__nota" data-admin-msg role="status"></p>
      </section>
    </div>`
}

export async function apriAdmin() {
  const u = s.utente()
  if (!u) return
  pannello.hidden = false
  document.documentElement.classList.add('area-aperta')
  stato = { reale: false, statistiche: null, incarichi: null, errore: '' }
  caricaImpostazioni()
  if (!u.prova) {
    pannello.innerHTML = '<div class="area__interno"><p>Controllo l’accesso…</p></div>'
    try {
      if ((await rpc('sono_admin')) !== true) {
        pannello.innerHTML = `<div class="area__interno"><h2>Accesso riservato</h2><p>Questa area è solo per gli amministratori di JobExpress.</p><button type="button" class="tasto" data-admin-chiudi>Torna indietro</button></div>`
        return
      }
      stato.reale = true
      stato.statistiche = await rpc('admin_statistiche')
      stato.incarichi = await rpc('admin_statistiche_incarichi').catch(() => null)
      stato.ai = await rpc('admin_statistiche_ai').catch(() => null)
    } catch {
      stato.errore = 'Non riesco a collegarmi a Supabase per i numeri reali.'
    }
  }
  disegna()
}

function chiudi() {
  pannello.hidden = true
  if (document.querySelector('#area')?.hidden !== false) document.documentElement.classList.remove('area-aperta')
}

export function avviaAdmin(strumenti) {
  s = strumenti
  pannello = document.createElement('div')
  pannello.className = 'area admin'
  pannello.hidden = true
  pannello.setAttribute('role', 'region')
  pannello.setAttribute('aria-label', 'Area Admin')
  document.body.appendChild(pannello)
  pannello.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-admin-regole]')
    if (!f) return
    e.preventDefault()
    if (stato.reale) salvaRegole(f)
  })
  pannello.addEventListener('click', (e) => {
    const t = e.target
    if (t.closest('[data-admin-chiudi]')) return chiudi()
    const an = t.closest('[data-admin-annuncio]')
    if (an) {
      const a = moderaAnnuncio(an.dataset.adminAnnuncio, an.dataset.ok === '1')
      if (a) registra(`${an.dataset.ok === '1' ? 'Approvato' : 'Rifiutato'} annuncio «${a.titolo}»`, { annuncio: a.id })
      return disegna()
    }
    const sg = t.closest('[data-admin-seg]')
    if (sg) {
      const x = aggiornaSegnalazione(sg.dataset.adminSeg, sg.dataset.esito)
      if (x) registra(`Segnalazione ${sg.dataset.esito}: ${x.titolo}`, { segnalazione: x.id })
      return disegna()
    }
    if (t.closest('[data-admin-report]')) {
      const n = numeri()
      const righe = [['voce', 'valore'], ['annunci', n.annunci], ['candidature', n.candidature], ['confermati', n.confermati], ['completati', n.completati], ['annullati', n.annullati], ['segnalazioni', segnalazioni().length],
        ...n.perCat.map(([k, v]) => [`categoria ${NOME_CAT[k] || k}`, v]), ...(stato.statistiche ? [['utenti', stato.statistiche.utenti], ['nuovi 7 giorni', stato.statistiche.nuovi_7_giorni]] : [])]
      const csv = righe.map((r) => r.join(';')).join('\n')
      const m = pannello.querySelector('[data-admin-msg]')
      navigator.clipboard?.writeText(csv).then(() => { m.textContent = 'Report copiato.' }, () => { m.textContent = csv })
      registra('Esportato report aggregato', {})
    }
  })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pannello.hidden && !document.querySelector('dialog.finestra')?.open) chiudi() })
}
