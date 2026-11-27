// Il percorso di un incarico per chi lavora:
// candidatura → selezione → PROPOSTA (con tempo per confermare) → conferma del lavoratore
// → completamento → compenso dichiarato → recensione.
// Regole (uguali per Free, Plus e Friends): massimo 3 candidature attive nella stessa fascia
// oraria; confermando un incarico, le candidature con orari incompatibili vengono ritirate.
// Poi: guadagni, obiettivo guadagno, preferiti e ricerche salvate.
// In questa versione di prova tutto resta su questo dispositivo; le risposte
// di chi pubblica (selezione, recensioni ricevute) sono di esempio.
// Per gli annunci veri le stesse regole le applica il database (vedi regole.js).
import { NOME_CAT, apriIncarico, descriviFiltri, impostaFiltri, leggiFiltri, scheda, tuttiIncarichi, corrisponde } from './incarichi.js'
import { compatCalendario, dataDi, dataIso } from './calendario.js'
import { notifica } from './notifiche.js'
import { haPlus, pianoAttivo } from './abbonamenti.js'
import { segnala } from './segnalazioni.js'
import { festaSeServe } from './percorso.js'
import { adesso, avvisiSpostamenti, impostazioni, meseDi, puoCandidarsi, restante, scadenzaProposta, sovrappone } from './regole.js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const num = (n) => String(Math.round(n * 100) / 100).replace('.', ',')
const leggi = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d } catch { return d } }
const scrivi = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* non disponibile */ } }
const K = { cand: 'jobexpress-candidature', guad: 'jobexpress-guadagni', rec: 'jobexpress-recensioni', ob: 'jobexpress-obiettivo', ric: 'jobexpress-ricerche', salv: 'jobexpress-salvati' }

let s = { apri: () => {}, ridisegna: () => {} }

// ================= CANDIDATURE =================
export const STATI = {
  inviata: 'Inviata', selezionato: 'In attesa di conferma', confermato: 'Confermata',
  completato: 'Incarico completato', non_selezionato: 'Rifiutata dal committente', ritirata: 'Ritirata',
  ritirata_incompatibile: 'Ritirata per incompatibilità', rifiutata: 'Rifiutata da te',
  scaduta: 'Proposta scaduta', annullato: 'Annullata',
}
const ATTIVE = ['inviata', 'selezionato', 'confermato']
export const leggiCand = () => leggi(K.cand, [])
export const scriviCand = (l) => scrivi(K.cand, l)

// Orari veri (in millisecondi) di una candidatura o di un incarico. Turni notturni: fine il giorno dopo.
export function intervallo(x) {
  const data = x.data || (dataDi(x) && dataIso(dataDi(x)))
  if (!data) return null
  const base = new Date(`${data}T00:00:00`).getTime()
  return { inizio: base + x.inizio * 3600000, fine: base + x.fine * 3600000 }
}
const conOrari = (l) => l.filter((c) => c.data).map((c) => ({ ...c, ...intervallo(c) }))
const quandoBreve = (c) => {
  const iv = c.inizio > 1e9 ? c : intervallo(c) // già in millisecondi oppure in ore
  if (!iv) return c.quando || ''
  const d = new Date(iv.inizio)
  const ora = (ms) => new Date(ms).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  return `${d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })} · ${ora(iv.inizio)}–${ora(iv.fine)}`
}

// Controllo prima di candidarsi (stesse regole del database)
export function verificaCandidatura(a) {
  const nuovo = intervallo(a)
  if (!nuovo) return { ok: true }
  const l = conOrari(leggiCand()).filter((c) => ATTIVE.includes(c.stato) && c.id !== a.id)
  const occupato = l.find((c) => c.stato === 'confermato' && sovrappone(c, nuovo))
  if (occupato) return { ok: false, confermato: occupato }
  const v = puoCandidarsi([nuovo], l)
  return { ...v, conflitti: l.filter((c) => v.conflitti.includes(c.id)) }
}

// Finestra «hai già tre candidature in questa fascia oraria»
export function mostraConflitti(a, conflitti) {
  s.apri(`
    <p class="dettaglio__cat">Fascia oraria piena</p>
    <h2>Hai già ${conflitti.length} candidature qui</h2>
    <p>Hai già tre candidature attive in questa fascia oraria. Per candidarti a questo incarico, ritira una delle candidature incompatibili.</p>
    <ul class="conflitti">${conflitti.map((c) => `
      <li class="conflitto" data-conflitto="${esc(c.id)}">
        <div><strong>${esc(c.titolo)}</strong><p>${esc(c.chi)}</p>
          <p class="conflitto__quando">${esc(quandoBreve(c))}</p>
          <p>${euro.format(c.euroOra)}/ora · circa ${euro.format(c.totale)} <span class="stato stato--${c.stato}">${STATI[c.stato]}</span></p></div>
        <div class="conflitto__azioni">
          <button type="button" class="tasto tasto--chiaro" data-conf-vedi="${esc(c.id)}">Vedi</button>
          <button type="button" class="tasto tasto--chiaro" data-conf-ritira="${esc(c.id)}">Ritira</button>
        </div>
      </li>`).join('')}</ul>
    <p class="finestra__nota" data-conf-esito aria-live="polite">Nessuna candidatura viene ritirata in automatico: scegli tu.</p>
    <div class="finestra__azioni"><button type="button" class="tasto" data-conf-torna>Torna all’incarico</button></div>`)
  const f = document.querySelector('dialog.finestra')
  f.querySelector('[data-conf-torna]').onclick = () => apriIncarico(a.id)
  f.querySelectorAll('[data-conf-vedi]').forEach((b) => { b.onclick = () => apriIncarico(b.dataset.confVedi) })
  f.querySelectorAll('[data-conf-ritira]').forEach((b) => {
    b.onclick = () => {
      const l = leggiCand()
      const c = l.find((x) => String(x.id) === b.dataset.confRitira && ['inviata', 'selezionato'].includes(x.stato))
      if (!c) return
      c.stato = 'ritirata'
      scriviCand(l)
      b.closest('li').classList.add('conflitto--ritirata')
      b.closest('.conflitto__azioni').innerHTML = '<span class="stato stato--ritirata">Ritirata</span>'
      f.querySelector('[data-conf-esito]').textContent = 'Candidatura ritirata. Ora puoi tornare all’incarico e candidarti.'
      s.ridisegna()
    }
  })
}

// Simulazione: dopo qualche secondo chi pubblica risponde (esempio).
// Se ti sceglie, ricevi una PROPOSTA con un tempo per confermare (come nel sito vero).
function evolvi() {
  const l = leggiCand()
  let cambiato = false
  const ora = adesso()
  l.forEach((c) => {
    if (c.stato === 'selezionato' && c.scade && ora >= c.scade) {
      // proposta scaduta: nessuna penalità per chi lavora
      c.stato = 'scaduta'
      cambiato = true
      notifica('selezione', `La proposta per «${c.titolo}» è scaduta. Nessun problema: non cambia nulla per il tuo profilo.`, { scheda: 'attivita', sotto: 'candidature' })
      return
    }
    if (c.stato !== 'inviata' || Date.now() - c.il < 8000) return
    const iv = intervallo(c)
    if (iv && iv.inizio <= ora) return
    const preso = (String(c.id).length + c.titolo.length) % 4 !== 0
    c.stato = preso ? 'selezionato' : 'non_selezionato'
    if (preso) c.scade = iv ? scadenzaProposta(iv.inizio, ora) : ora + 2 * 3600000
    c.esempio = true
    cambiato = true
    notifica('selezione', preso ? `${c.chi} ti propone «${c.titolo}» (esempio). Conferma entro le ${new Date(c.scade).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}.` : `Per «${c.titolo}» hanno scelto un’altra persona (esempio).`, { scheda: 'attivita', sotto: 'candidature' })
  })
  if (cambiato) { scriviCand(l); s.ridisegna() }
}

// Conto alla rovescia delle proposte, aggiornato ogni secondo (ora del server)
function aggiornaContiAllaRovescia() {
  document.querySelectorAll('[data-scade]').forEach((el) => {
    const resta = Number(el.dataset.scade) - adesso()
    el.textContent = resta > 0 ? restante(resta) : 'scaduta'
    el.closest('.proposta-tempo')?.classList.toggle('proposta-tempo--urgente', resta > 0 && resta < 5 * 60000)
  })
}

// Conferma di una proposta: SOLO adesso l'incarico è assegnato
function confermaProposta(i, forza = false) {
  const l = leggiCand()
  const c = l[i]
  if (!c || c.stato !== 'selezionato') return
  if (c.scade && adesso() >= c.scade) {
    c.stato = 'scaduta'
    scriviCand(l)
    s.ridisegna()
    s.apri('<h2>Proposta scaduta</h2><p>Il tempo per confermare è finito. Nessun problema: non cambia nulla per il tuo profilo, le tue recensioni o il tuo badge.</p>')
    return
  }
  const me = intervallo(c)
  const altri = conOrari(l).filter((x) => x.id !== c.id)
  const confermati = altri.filter((x) => x.stato === 'confermato')
  const sopra = me && confermati.find((x) => sovrappone(x, me))
  if (sopra) {
    s.apri(`<h2>Non puoi confermare</h2><p>Hai già un incarico confermato in questo orario: <strong>${esc(sopra.titolo)}</strong> (${esc(quandoBreve(sopra))}).</p><p class="finestra__nota">Due incarichi che si sovrappongono non si possono confermare insieme.</p>`)
    return
  }
  const imp = impostazioni()
  if (me && imp.free_monthly_job_limit_enabled && pianoAttivo() === 'free') {
    const mese = meseDi(me.inizio)
    const contano = altri.filter((x) => (['confermato', 'completato'].includes(x.stato) || (x.stato === 'annullato' && x.annullatoDa === 'lavoratore' && imp.annullamenti_lavoratore_contano)) && meseDi(x.inizio) === mese)
    if (contano.length >= Number(imp.free_monthly_job_limit)) {
      s.apri(`<p class="dettaglio__cat">Limite del piano Free</p><h2>Hai già ${contano.length} incarichi questo mese</h2>
        <p>Con il piano Free puoi confermare fino a ${Number(imp.free_monthly_job_limit)} incarichi per mese. Le candidature restano illimitate e il limite si rinnova il primo giorno del mese.</p>
        <div class="finestra__azioni"><button type="button" class="tasto" data-vai-plus>Scopri Plus</button></div>`)
      document.querySelector('[data-vai-plus]').onclick = () => { document.querySelector('dialog.finestra').close(); document.querySelector('#costi')?.scrollIntoView({ behavior: 'smooth' }) }
      return
    }
  }
  const avvisi = me ? avvisiSpostamenti([me], confermati) : []
  if (avvisi.length && !forza) {
    s.apri(`<p class="dettaglio__cat">Controlla gli spostamenti</p>
      <h2>Poco tempo tra due incarichi</h2>
      <p class="avviso-spostamenti">Attenzione: potresti non avere abbastanza tempo per raggiungere il prossimo luogo di lavoro. Verifica gli spostamenti prima di confermare.</p>
      <ul class="conflitti">${avvisi.map((x) => `<li class="conflitto"><div><strong>${esc(x.titolo)}</strong><p>${esc(x.luogo)}</p><p class="conflitto__quando">${esc(quandoBreve(x))} · ${x.minuti} minuti di margine</p></div></li>`).join('')}
        <li class="conflitto conflitto--nuovo"><div><strong>${esc(c.titolo)}</strong><p>${esc(c.luogo)}</p><p class="conflitto__quando">${esc(quandoBreve(c))}</p></div></li></ul>
      <p class="finestra__nota">Non è un blocco: se i due posti sono vicini, puoi confermare lo stesso.</p>
      <div class="finestra__azioni"><button type="button" class="tasto" data-conferma-comunque>Conferma comunque</button><button type="button" class="tasto tasto--chiaro" data-annulla-conferma>Torna indietro</button></div>`)
    const f = document.querySelector('dialog.finestra')
    f.querySelector('[data-conferma-comunque]').onclick = () => confermaProposta(i, true)
    f.querySelector('[data-annulla-conferma]').onclick = () => f.close()
    return
  }
  c.stato = 'confermato'
  c.confermatoIl = Date.now()
  // ritiro automatico delle candidature con orari incompatibili
  const ritirate = []
  if (me) {
    l.forEach((x) => {
      if (x === c || !['inviata', 'selezionato'].includes(x.stato)) return
      const iv = intervallo(x)
      if (iv && sovrappone(iv, me)) { x.stato = 'ritirata_incompatibile'; ritirate.push(x) }
    })
  }
  scriviCand(l)
  notifica('selezione', `Hai confermato «${c.titolo}». Ricordati di formalizzare il rapporto prima di iniziare.`, { scheda: 'attivita', sotto: 'calendario' })
  if (ritirate.length) notifica('candidatura', `Abbiamo ritirato ${ritirate.length} candidatur${ritirate.length === 1 ? 'a' : 'e'} con orari incompatibili.`, { scheda: 'attivita', sotto: 'candidature' })
  s.ridisegna()
  s.apri(`<p class="dettaglio__cat">Doppia conferma completata</p>
    <h2>Incarico confermato</h2>
    <p><strong>${esc(c.titolo)}</strong> · ${esc(c.chi)}<br>${esc(quandoBreve(c))} · ${esc(c.luogo)}</p>
    ${ritirate.length ? `<p>Abbiamo ritirato in automatico ${ritirate.length === 1 ? 'questa candidatura, che si sovrapponeva' : 'queste candidature, che si sovrapponevano'}:</p>
      <ul class="lista-semplice">${ritirate.map((x) => `<li>${esc(x.titolo)} · ${esc(quandoBreve(x))}</li>`).join('')}</ul>` : ''}
    <p class="finestra__nota">La conferma su JobExpress non sostituisce il contratto di lavoro né gli adempimenti obbligatori: prima di iniziare va formalizzato il rapporto.</p>`)
}

function rigaCandidatura(c, i) {
  const az = {
    inviata: [['ritira', 'Ritira', 'chiaro']],
    selezionato: [['conferma', 'Conferma', ''], ['rifiuta', 'Rifiuta', 'chiaro']],
    confermato: [['completa', 'Segna come completato', ''], ['annulla', 'Annulla', 'chiaro']],
    completato: [...(c.compenso == null ? [['compenso', 'Registra il compenso', '']] : []), ...(!c.recensito ? [['recensisci', 'Lascia una recensione', 'chiaro']] : [])],
  }[c.stato] || []
  return `
    <li class="candidatura">
      <div><strong>${esc(c.titolo)}</strong><p>${esc(c.chi)} · ${esc(c.luogo)}</p>
        <p>${esc(c.quando)} · ${euro.format(c.euroOra)}/ora · circa ${euro.format(c.totale)}${c.compenso != null ? ` · dichiarato ${euro.format(c.compenso)}` : ''}</p>
        ${c.stato === 'selezionato' ? `<p class="proposta-tempo">Hai <strong data-scade="${c.scade || 0}">${c.scade ? restante(c.scade - adesso()) : ''}</strong> per confermare</p>
          <p class="finestra__nota">Confermare non è ancora un contratto: prima di iniziare va formalizzato il rapporto.</p>` : ''}</div>
      <div class="candidatura__lato"><span class="stato stato--${c.stato}">${STATI[c.stato]}</span>${c.esempio && c.stato !== 'inviata' ? '<span class="etichetta-esempio">risposta di esempio</span>' : ''}</div>
      ${az.length ? `<div class="pa-azioni-riga">${az.map(([k, t, cl]) => `<button type="button" class="tasto ${cl ? 'tasto--chiaro' : ''}" data-lav="${k}" data-i="${i}">${t}</button>`).join('')}</div>` : ''}
    </li>`
}

export function pannelloCandidature() {
  const l = leggiCand()
  if (!l.length) {
    return `<div class="vuoto"><strong>Nessuna candidatura.</strong><p>Quando ti candidi a un incarico, qui segui lo stato passo per passo.</p>
      <button type="button" class="tasto" data-area-vai="esplora">Esplora gli incarichi</button></div>`
  }
  const att = l.map((c, i) => [c, i]).filter(([c]) => ATTIVE.includes(c.stato) || (c.stato === 'completato' && (c.compenso == null || !c.recensito)))
  const storico = l.map((c, i) => [c, i]).filter(([c]) => !att.some(([x]) => x === c))
  return `
    ${att.length ? `<h3 class="area__sotto-titolo">In corso</h3><ul class="candidature">${att.map(([c, i]) => rigaCandidatura(c, i)).join('')}</ul>` : ''}
    ${storico.length ? `<details class="storico" ${att.length ? '' : 'open'}><summary>Storico (${storico.length})</summary><ul class="candidature">${storico.map(([c, i]) => rigaCandidatura(c, i)).join('')}</ul></details>` : ''}
    <p class="finestra__nota">Versione di prova: le candidature restano su questo dispositivo e le risposte di chi pubblica sono di esempio.</p>`
}

// ================= COMPENSO E GUADAGNI =================
export const guadagni = () => leggi(K.guad, [])

function chiediCompenso(i) {
  const l = leggiCand()
  const c = l[i]
  s.apri(`
    <p class="dettaglio__cat">Incarico completato</p>
    <h2>Quanto hai ricevuto?</h2>
    <p>${esc(c.titolo)} · ${esc(c.quando)}</p>
    <form class="conto-form" data-form-compenso novalidate>
      <div class="pa-due">
        <div class="campo"><label for="cp-euro">Importo ricevuto (€)</label><input id="cp-euro" name="euro" type="number" inputmode="decimal" min="0" max="5000" step="0.5" value="${c.totale}" required /></div>
        <div class="campo"><label for="cp-ore">Ore lavorate</label><input id="cp-ore" name="ore" type="number" inputmode="decimal" min="0.5" max="24" step="0.5" value="${c.fine - c.inizio}" required /></div>
      </div>
      <p class="finestra__nota">È l’importo che dichiari tu, per i tuoi conti: JobExpress non riceve e non trattiene soldi.</p>
      <p class="conto-form__errore" data-errore role="alert"></p>
      <div class="finestra__azioni"><button type="submit" class="tasto">Salva</button><button type="button" class="tasto tasto--chiaro" data-salta>Più tardi</button></div>
    </form>`)
  const f = document.querySelector('[data-form-compenso]')
  // dopo compenso e recensione: per Free, al 2° incarico del mese, la schermata «Il tuo percorso è appena iniziato!»
  const dopo = () => {
    if (!c.recensito) apriRecensione({ i, a: c.chi, incaricoId: c.id, titolo: c.titolo, lato: 'lavoro', dopo: () => setTimeout(() => festaSeServe(() => {}), 1600) })
    else festaSeServe()
  }
  f.querySelector('[data-salta]').onclick = dopo
  f.onsubmit = (e) => {
    e.preventDefault()
    const eur = Number(f.elements.euro.value), ore = Number(f.elements.ore.value)
    if (!(eur >= 0) || !(ore > 0)) { f.querySelector('[data-errore]').textContent = 'Controlla importo e ore.'; return }
    const lc = leggiCand()
    lc[i].compenso = eur
    scriviCand(lc)
    const g = guadagni()
    g.unshift({ id: c.id, titolo: c.titolo, cat: c.cat || 'altro', euro: eur, ore, il: Date.now() })
    scrivi(K.guad, g)
    s.ridisegna()
    dopo()
  }
}

// Dati per grafici e statistiche (con "esempio" si vedono dati finti, segnalati come tali)
const ESEMPIO = [
  { sett: 5, ore: 4.5, euro: 49.5, cat: 'camerieri' }, { sett: 5, ore: 3, euro: 30, cat: 'babysitting' }, { sett: 4, ore: 4, euro: 60, cat: 'traslochi' },
  { sett: 3, ore: 2, euro: 27, cat: 'ripetizioni' }, { sett: 3, ore: 5, euro: 62.5, cat: 'hostess' }, { sett: 1, ore: 6, euro: 72, cat: 'eventi' }, { sett: 0, ore: 4.5, euro: 49.5, cat: 'camerieri' },
]
export function datiGuadagni(esempio) {
  const sett = (t) => Math.floor((Date.now() - t) / (7 * 864e5))
  const svolti = esempio ? ESEMPIO : guadagni().map((g) => ({ ...g, sett: sett(g.il) }))
  const somma = (l, k) => l.reduce((t, x) => t + x[k], 0)
  const settimane = [5, 4, 3, 2, 1, 0].map((w) => somma(svolti.filter((x) => x.sett === w), 'euro'))
  const ore = somma(svolti, 'ore')
  const totale = somma(svolti, 'euro')
  const stimati = leggiCand().filter((c) => c.stato === 'confermato').reduce((t, c) => t + c.totale, 0)
  const perCat = {}
  svolti.forEach((x) => { perCat[x.cat] = perCat[x.cat] || { euro: 0, ore: 0, n: 0 }; perCat[x.cat].euro += x.euro; perCat[x.cat].ore += x.ore; perCat[x.cat].n++ })
  return { settimane, ore, totale, settimana: settimane[5], mese: svolti.filter((x) => x.sett < 4).reduce((t, x) => t + x.euro, 0), media: ore ? totale / ore : 0, svolti: svolti.length, stimati, perCat, lista: svolti }
}

export function statistiche() {
  const l = leggiCand()
  const r = recensioni()
  return {
    candidature: l.length,
    confermati: l.filter((c) => ['confermato', 'completato'].includes(c.stato)).length,
    completati: l.filter((c) => c.stato === 'completato').length,
    recensioni: r.ricevute.length,
    media: r.ricevute.length ? r.ricevute.reduce((t, x) => t + x.media, 0) / r.ricevute.length : 0,
  }
}

// Statistiche dettagliate e report: strumenti del piano Plus
export function riquadroPlus(esempio) {
  if (!haPlus()) {
    return `<article class="riquadro riquadro--plus-chiuso">
      <h3>Statistiche dettagliate</h3><p class="grande">Con Plus</p>
      <p>Guadagni e ore per categoria, compenso medio e report da esportare. Cercare e candidarsi resta gratis per tutti.</p>
      <button type="button" class="tasto tasto--chiaro" data-abbonati="plus">Scopri Plus</button></article>`
  }
  const g = datiGuadagni(esempio)
  const righe = Object.entries(g.perCat).sort((a, b) => b[1].euro - a[1].euro)
  const max = Math.max(1, ...righe.map(([, v]) => v.euro))
  return `<article class="riquadro">
    <div class="riquadro__testa"><h3>Statistiche dettagliate</h3><span class="abb__piano abb__piano--plus">Plus</span></div>
    ${righe.length ? `<ul class="percat">${righe.map(([k, v]) => `<li><span>${esc(NOME_CAT[k] || k)}</span><span class="percat__barra"><i style="width:${(v.euro / max) * 100}%"></i></span><strong>${euro.format(v.euro)}</strong><small>${num(v.ore)} h · ${euro.format(v.euro / v.ore)}/h</small></li>`).join('')}</ul>
      <button type="button" class="tasto tasto--chiaro" data-lav="report">Copia il report (CSV)</button><p class="finestra__nota" data-report-msg role="status"></p>`
      : '<p>Le statistiche compaiono quando registri il compenso del tuo primo incarico.</p>'}
  </article>`
}

// ================= OBIETTIVO GUADAGNO =================
const PERIODI = { oggi: 'oggi', weekend: 'questo weekend', settimana: 'nei prossimi 7 giorni', mese: 'entro fine mese' }
const obiettivo = () => leggi(K.ob, { importo: 100, periodo: 'weekend' })

function finestraPeriodo(p) {
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0)
  const fine = new Date(oggi)
  if (p === 'oggi') fine.setDate(fine.getDate() + 1)
  else if (p === 'weekend') { const g = oggi.getDay(); const alSab = g === 0 ? -1 : 6 - g; fine.setDate(fine.getDate() + alSab + 2) }
  else if (p === 'settimana') fine.setDate(fine.getDate() + 7)
  else { fine.setMonth(fine.getMonth() + 1, 1) }
  const inizio = new Date(oggi)
  if (p === 'weekend') { const g = oggi.getDay(); if (g !== 0 && g !== 6) inizio.setDate(inizio.getDate() + (6 - g)); if (g === 0) inizio.setDate(inizio.getDate() - 1) }
  return [inizio, fine]
}

// Combinazione di incarichi disponibili nel periodo, senza sovrapposizioni
function combinazione(ob, giaGuadagnato) {
  const [da, a] = finestraPeriodo(ob.periodo)
  const occupati = leggiCand().filter((c) => ATTIVE.includes(c.stato) && c.data).map((c) => [c.data, c.inizio, c.fine])
  const conCal = (x) => { const c = compatCalendario(x); return c ? c.ok : true }
  const candidati = tuttiIncarichi()
    .filter((x) => !x.mio)
    .map((x) => ({ x, d: dataDi(x) }))
    .filter(({ x, d }) => d && d >= da && d < a && conCal(x) && !leggiCand().some((c) => c.id === x.id))
    .sort((p, q) => q.x.totale - p.x.totale)
  const scelti = []
  let somma = 0
  for (const { x, d } of candidati) {
    if (giaGuadagnato + somma >= ob.importo) break
    const k = dataIso(d)
    const sovrapposto = [...occupati, ...scelti.map((y) => [dataIso(dataDi(y)), y.inizio, y.fine])].some(([dd, i, f]) => dd === k && x.inizio < f && i < x.fine)
    if (sovrapposto) continue
    scelti.push(x)
    somma += x.totale
  }
  return { scelti, somma }
}

export function riquadroObiettivo() {
  const ob = obiettivo()
  const [da] = finestraPeriodo(ob.periodo)
  const fatto = guadagni().filter((g) => g.il >= da.getTime()).reduce((t, g) => t + g.euro, 0)
  const { scelti, somma } = combinazione(ob, fatto)
  const perc = Math.min(100, Math.round((fatto / ob.importo) * 100))
  const possibile = Math.min(100, Math.round(((fatto + somma) / ob.importo) * 100))
  return `<article class="riquadro riquadro--largo obiettivo-box">
    <div class="riquadro__testa"><h3>Obiettivo guadagno</h3></div>
    <form class="obiettivo-form" data-obiettivo>
      <label>Voglio guadagnare <input type="number" name="importo" min="5" max="5000" step="5" value="${ob.importo}" inputmode="numeric" aria-label="Importo dell’obiettivo in euro" /> €</label>
      <select name="periodo" aria-label="Entro quando">${Object.entries(PERIODI).map(([k, t]) => `<option value="${k}" ${k === ob.periodo ? 'selected' : ''}>${t}</option>`).join('')}</select>
    </form>
    <div class="obiettivo__barra obiettivo__barra--doppia" role="img" aria-label="${perc}% già guadagnato, ${possibile}% possibile con gli incarichi suggeriti"><i style="width:${perc}%"></i><b style="width:${Math.max(0, possibile - perc)}%"></b></div>
    <p><strong>${euro.format(fatto)}</strong> già dichiarati ${PERIODI[ob.periodo]}${somma ? ` · con gli incarichi qui sotto arriveresti a circa <strong>${euro.format(fatto + somma)}</strong>` : ''}.</p>
    ${fatto >= ob.importo ? '<p class="grande">Obiettivo raggiunto!</p>'
      : scelti.length ? `<ul class="sugg">${scelti.map((x) => `<li><div><strong>${esc(x.titolo)}</strong><p>${new Date(dataDi(x)).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric' })}, ${String(Math.floor(x.inizio)).padStart(2, '0')}:${String(Math.round((x.inizio % 1) * 60)).padStart(2, '0')} · ${esc(x.citta)} · circa ${euro.format(x.totale)}</p></div>
          <button type="button" class="tasto tasto--chiaro" data-cal-vedi="${esc(x.id)}">Vedi</button></li>`).join('')}</ul>`
      : '<p>In questo periodo non ci sono incarichi compatibili con il tuo calendario. Prova un periodo più lungo o aggiungi disponibilità.</p>'}
    <p class="finestra__nota">È una stima basata sugli incarichi disponibili adesso: non è garantita. Gli incarichi seguono la tua disponibilità e non si sovrappongono.</p>
  </article>`
}

// ================= RECENSIONI =================
const recensioni = () => leggi(K.rec, { date: [], ricevute: [] })
export const leggiRecensioni = recensioni
const CRITERI = {
  lavoro: [['chiarezza', 'Chiarezza delle informazioni'], ['accordi', 'Rispetto degli accordi'], ['comunicazione', 'Comunicazione']],
  pubblico: [['puntualita', 'Puntualità'], ['professionalita', 'Professionalità'], ['comunicazione', 'Comunicazione']],
}
const RICEVUTE_ESEMPIO = ['Puntuale e molto disponibile, la richiamerei volentieri.', 'Tutto come concordato, grazie!', 'Gentile e precisa, ottimo lavoro.']
const stelle = (n) => `<span class="stelle" aria-label="${num(n)} su 5">${'★'.repeat(Math.round(n))}${'☆'.repeat(5 - Math.round(n))}</span>`

export function apriRecensione({ i, a, incaricoId, titolo, lato, dopo }) {
  s.apri(`
    <p class="dettaglio__cat">Recensione · ${esc(titolo)}</p>
    <h2>Com’è andata con ${esc(a)}?</h2>
    <form class="conto-form" data-form-recensione novalidate>
      ${CRITERI[lato].map(([k, t]) => `<fieldset class="voto"><legend>${t}</legend><div class="voto__stelle">
        ${[5, 4, 3, 2, 1].map((n) => `<input type="radio" id="v-${k}-${n}" name="${k}" value="${n}" /><label for="v-${k}-${n}" title="${n} su 5">★<span class="sr">${n} su 5</span></label>`).join('')}
      </div></fieldset>`).join('')}
      <div class="campo"><label for="rc-testo">Commento <span class="facoltativo">facoltativo</span></label><textarea id="rc-testo" name="commento" rows="3" maxlength="500"></textarea></div>
      <p class="finestra__nota">Si può recensire solo un incarico completato. Le recensioni false o offensive vengono rimosse.</p>
      <p class="conto-form__errore" data-errore role="alert"></p>
      <div class="finestra__azioni"><button type="submit" class="tasto">Pubblica la recensione</button></div>
    </form>`)
  const f = document.querySelector('[data-form-recensione]')
  f.onsubmit = (e) => {
    e.preventDefault()
    const voti = Object.fromEntries(CRITERI[lato].map(([k]) => [k, Number(f.querySelector(`[name=${k}]:checked`)?.value || 0)]))
    if (Object.values(voti).some((v) => !v)) { f.querySelector('[data-errore]').textContent = 'Dai un voto a tutte le voci.'; return }
    const media = Object.values(voti).reduce((t, v) => t + v, 0) / Object.keys(voti).length
    const r = recensioni()
    r.date.unshift({ incaricoId, a, titolo, voti, media, commento: f.elements.commento.value.trim(), il: Date.now(), lato })
    scrivi(K.rec, r)
    if (lato === 'lavoro' && i != null) { const lc = leggiCand(); lc[i].recensito = true; scriviCand(lc) }
    // Recensione reciproca di esempio, dopo qualche secondo
    setTimeout(() => {
      const r2 = recensioni()
      const voto = 4 + (titolo.length % 2)
      // Chi pubblica valuta anche la puntualità (serve per livelli e badge)
      const puntuale = titolo.length % 7 !== 0
      r2.ricevute.unshift({ da: a, titolo, media: voto, voti: { puntualita: puntuale ? 5 : 3, professionalita: voto, comunicazione: voto }, puntuale, commento: RICEVUTE_ESEMPIO[titolo.length % 3], il: Date.now(), esempio: true, lato })
      scrivi(K.rec, r2)
      notifica('recensione', `${a} ti ha lasciato una recensione: ${voto} su 5 (esempio).`, { scheda: 'profilo' })
      s.ridisegna()
    }, 2500)
    s.apri(`<h2>Grazie!</h2><p>La tua recensione per ${esc(a)} è pubblicata. Quando anche l’altra persona ti recensisce, la trovi nel tuo profilo.</p>`)
    s.ridisegna()
    dopo?.()
  }
}

export function riquadroRecensioni() {
  const r = recensioni()
  const st = statistiche()
  return `<div class="recensioni">
    <h3>Le tue recensioni</h3>
    ${r.ricevute.length ? `<p class="recensioni__media">${stelle(st.media)} <strong>${num(st.media)}</strong> su 5 · ${r.ricevute.length} ${r.ricevute.length === 1 ? 'recensione' : 'recensioni'}</p>
      <ul class="recensioni__lista">${r.ricevute.map((x, n) => `<li><div><strong>${esc(x.da)}</strong> ${stelle(x.media)} ${x.esempio ? '<span class="etichetta-esempio">esempio</span>' : ''}
        <p>${esc(x.commento)}</p><small>${esc(x.titolo)} · ${new Date(x.il).toLocaleDateString('it-IT')}</small></div>
        ${x.segnalata ? '<span class="stato stato--revisione">In verifica</span>' : `<button type="button" class="tasto tasto--chiaro" data-lav="contesta" data-n="${n}">Contesta</button>`}</li>`).join('')}</ul>`
      : '<p>Nessuna recensione ancora. Arrivano solo dopo un incarico completato, e solo da chi ha lavorato con te.</p>'}
    ${r.date.length ? `<details class="storico"><summary>Recensioni che hai scritto (${r.date.length})</summary><ul class="recensioni__lista">${r.date.map((x) => `<li><div><strong>${esc(x.a)}</strong> ${stelle(x.media)}<p>${esc(x.commento || 'Nessun commento')}</p><small>${esc(x.titolo)}</small></div></li>`).join('')}</ul></details>` : ''}
  </div>`
}

// ================= PREFERITI E RICERCHE SALVATE =================
const ricerche = () => leggi(K.ric, [])
export function salvaRicercaCorrente() {
  const f = leggiFiltri()
  const l = ricerche()
  const nome = descriviFiltri(f)
  if (l.some((r) => r.nome === nome)) return 'Hai già salvato questa ricerca.'
  l.unshift({ id: `r-${Date.now()}`, nome, filtri: f, il: Date.now(), visti: tuttiIncarichi().filter((a) => corrisponde(a, f)).map((a) => String(a.id)) })
  scrivi(K.ric, l)
  return 'Ricerca salvata: ti avvisiamo con una notifica quando esce un incarico nuovo che le corrisponde.'
}

// Da chiamare quando cambiano gli incarichi (per esempio un annuncio nuovo)
export function controllaRicerche() {
  const l = ricerche()
  let cambiato = false
  l.forEach((r) => {
    const nuovi = tuttiIncarichi().filter((a) => corrisponde(a, r.filtri) && !r.visti.includes(String(a.id)))
    nuovi.forEach((a) => { notifica('ricerca', `Nuovo incarico per «${r.nome}»: ${a.titolo}.`, { scheda: 'attivita', sotto: 'salvati' }); r.visti.push(String(a.id)); cambiato = true })
  })
  if (cambiato) scrivi(K.ric, l)
}

export function pannelloSalvati() {
  const ids = new Set(leggi(K.salv, []).map(String))
  const salvati = tuttiIncarichi().filter((a) => ids.has(String(a.id)))
  const r = ricerche()
  return `
    <h3 class="area__sotto-titolo">Incarichi salvati</h3>
    ${salvati.length ? `<div class="schede schede--area">${salvati.map((a) => scheda(a, true)).join('')}</div>`
      : '<p class="vuoto">Nessun incarico salvato. Tocca il cuore su una scheda per ritrovarla qui.</p>'}
    <h3 class="area__sotto-titolo">Ricerche salvate</h3>
    ${r.length ? `<ul class="candidature">${r.map((x, n) => `<li class="candidatura"><div><strong>${esc(x.nome)}</strong><p>Salvata il ${new Date(x.il).toLocaleDateString('it-IT')} · ${tuttiIncarichi().filter((a) => corrisponde(a, x.filtri)).length} incarichi adesso</p></div>
        <div class="pa-azioni-riga"><button type="button" class="tasto" data-lav="applica" data-n="${n}">Apri</button><button type="button" class="tasto tasto--chiaro" data-lav="toglir" data-n="${n}">Elimina</button></div></li>`).join('')}</ul>`
      : '<p class="vuoto">Nessuna ricerca salvata. Nella bacheca, imposta i filtri e tocca «Salva questa ricerca».</p>'}`
}

// ================= EVENTI =================
// Restituisce true se l'area va ridisegnata, 'esplora' per andare alla bacheca
export function gestisciLavori(e) {
  const t = e.target
  if (e.type === 'change' && t.closest('[data-obiettivo]')) {
    const f = t.closest('[data-obiettivo]')
    const imp = Math.max(5, Math.min(5000, Number(f.elements.importo.value) || 100))
    scrivi(K.ob, { importo: imp, periodo: f.elements.periodo.value })
    return true
  }
  if (e.type !== 'click') return false
  const b = t.closest('[data-lav]')
  if (b?.closest('.scheda')) return false
  if (!b) {
    // schede dei salvati: dettagli e cuore
    const d = t.closest('.schede--area [data-dettagli]')
    if (d) { apriIncarico(d.dataset.dettagli); return false }
    const cuore = t.closest('.schede--area [data-salva]')
    if (cuore) {
      const l = leggi(K.salv, []).filter((x) => String(x) !== cuore.dataset.salva)
      scrivi(K.salv, l)
      return true
    }
    return false
  }
  const k = b.dataset.lav
  const i = Number(b.dataset.i)
  const n = Number(b.dataset.n)
  const l = leggiCand()
  if (k === 'ritira') l[i].stato = 'ritirata'
  if (k === 'rifiuta') l[i].stato = 'rifiutata'
  if (k === 'annulla') { l[i].stato = 'annullato'; l[i].annullatoDa = 'lavoratore' }
  if (k === 'conferma') { confermaProposta(i); return false }
  if (k === 'completa') { l[i].stato = 'completato'; scriviCand(l); chiediCompenso(i); return true }
  if (k === 'compenso') { chiediCompenso(i); return false }
  if (k === 'recensisci') { apriRecensione({ i, a: l[i].chi, incaricoId: l[i].id, titolo: l[i].titolo, lato: 'lavoro' }); return false }
  if (k === 'contesta') {
    const r = recensioni()
    r.ricevute[n].segnalata = true
    scrivi(K.rec, r)
    segnala({ tipo: 'recensione', riferimento: r.ricevute[n].il, titolo: `Recensione di ${r.ricevute[n].da}`, motivo: 'Contestazione di una recensione' })
    return true
  }
  if (k === 'applica') { impostaFiltri(ricerche()[n].filtri); return 'esplora' }
  if (k === 'toglir') { const r = ricerche(); r.splice(n, 1); scrivi(K.ric, r); return true }
  if (k === 'report') {
    const g = datiGuadagni(false)
    const csv = ['data;incarico;categoria;ore;euro', ...g.lista.map((x) => [new Date(x.il).toLocaleDateString('it-IT'), `"${x.titolo.replace(/"/g, '""')}"`, NOME_CAT[x.cat] || x.cat, num(x.ore), num(x.euro)].join(';'))].join('\n')
    const msg = document.querySelector('[data-report-msg]')
    navigator.clipboard?.writeText(csv).then(() => { if (msg) msg.textContent = 'Report copiato: incollalo in un foglio di calcolo.' }, () => { if (msg) msg.textContent = csv })
    return false
  }
  scriviCand(l)
  return true
}

export function avviaLavori(strumenti) {
  s = strumenti
  setInterval(evolvi, 3000)
  setInterval(aggiornaContiAllaRovescia, 1000)
}
