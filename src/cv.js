// JobExpress CV — un curriculum che cresce con te (funzione Plus).
// * Ogni incarico completato su JobExpress viene proposto come nuova esperienza:
//   la persona sceglie se aggiungerla (nessun doppione: una voce per incarico).
// * Esperienze JobExpress = verificabili; esperienze esterne, competenze e certificazioni = autodichiarate.
//   Nessuna competenza viene "certificata" solo perché si è svolta una mansione.
// * Si sceglie cosa mostrare: niente dati economici o chat private nel CV.
// * Tre modelli (Minimal, Professional, Modern), ordine delle sezioni, sezioni nascoste,
//   anteprima, PDF (stampa del browser) e link condivisibile revocabile (Supabase, account vero).
import { NOME_CAT } from './incarichi.js'
import { intervallo, leggiCand, leggiRecensioni } from './lavori.js'
import { datiReputazione } from './reputazione.js'
import { haPlus } from './abbonamenti.js'
import { NOMI_SEZIONI, disegnaCV } from './cv-vista.js'
import { SUPABASE_KEY, SUPABASE_URL } from './config.js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const K = 'jobexpress-cv'
const ORDINE = ['presentazione', 'esperienze', 'studi', 'lingue', 'competenze', 'certificazioni', 'disponibilita', 'badge', 'valutazioni']
const MODELLI = [['minimal', 'Minimal'], ['professional', 'Professional'], ['modern', 'Modern']]

// Attività tipiche di ogni categoria: descrivono cosa si è fatto, NON sono certificazioni
const ATTIVITA = {
  bar: ['servizio al banco', 'preparazione bevande'], ristorazione: ['servizio in sala'], camerieri: ['servizio ai tavoli', 'presa delle comande'],
  cucina: ['aiuto in cucina', 'preparazioni di base'], hotel: ['accoglienza ospiti', 'riassetto camere'], negozi: ['assistenza alla vendita', 'riordino'],
  eventi: ['allestimento', 'supporto all’evento'], hostess: ['accoglienza del pubblico'], pulizie: ['pulizia degli ambienti'], babysitting: ['cura dei bambini'],
  petsitting: ['cura degli animali'], ripetizioni: ['spiegazione di materie scolastiche'], informatica: ['assistenza informatica di base'],
  giardinaggio: ['cura del verde'], traslochi: ['carico e scarico'], consegne: ['consegne in città'], domestico: ['aiuto in casa'],
  foto: ['foto e contenuti'], persona: ['assistenza alla persona'], commissioni: ['piccole commissioni'],
}

const vuoto = () => ({
  titolo: '', presentazione: '', foto: '', contatti: { email: '', telefono: '', citta: '' }, mostraContatti: { email: true, telefono: false, citta: true },
  esterne: [], studi: [], lingue: [], competenze: [], certificazioni: [], disponibilita: '',
  esperienze: {}, // per id incarico: { stato: 'aggiunta'|'ignorata', descrizione, mostra, mostraVoto }
  modello: 'minimal', ordine: [...ORDINE], nascoste: ['valutazioni'], valutazioni: [], link: null,
})
const leggi = () => { try { return { ...vuoto(), ...JSON.parse(localStorage.getItem(K) || 'null') } } catch { return vuoto() } }
let cv = leggi()
let s = { utente: () => null, token: async () => null }
let vista = 'modifica' // 'modifica' | 'anteprima'

function salva() {
  try { localStorage.setItem(K, JSON.stringify(cv)) } catch { /* non disponibile */ }
  const u = s.utente()
  // Account vero: copia anche su Supabase (solo il proprietario la vede)
  if (u && !u.prova && SUPABASE_KEY) {
    s.token().then((t) => t && fetch(`${SUPABASE_URL}/rest/v1/curricula`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: u.id, dati: cv, aggiornato_il: new Date().toISOString() }),
    })).catch(() => {})
  }
}
export const avviaCV = (strumenti) => { s = { ...s, ...strumenti } }

// ---------- dati ----------
const periodo = (ms) => new Date(ms).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
function completati() {
  const voti = leggiRecensioni().ricevute
  return leggiCand().filter((c) => c.stato === 'completato').map((c) => {
    const iv = intervallo(c)
    const r = voti.find((x) => x.titolo === c.titolo && x.da === c.chi)
    return { id: String(c.id), titolo: c.titolo, chi: c.chi, cat: c.cat || 'altro', quando: iv ? iv.inizio : c.il, ore: Math.max(0, c.fine - c.inizio), voto: r?.media ?? null }
  })
}
// Incarichi completati non ancora decisi: «Nuove esperienze da aggiungere»
export const daAggiungere = () => completati().filter((x) => !cv.esperienze[x.id])

// Fotografia di ciò che si mostra (anteprima, PDF e link condiviso)
export function fotografia() {
  const u = s.utente() || {}
  const rep = datiReputazione(false)
  const voti = leggiRecensioni().ricevute
  const exp = completati().filter((x) => cv.esperienze[x.id]?.stato === 'aggiunta' && cv.esperienze[x.id].mostra !== false)
    .sort((a, b) => b.quando - a.quando)
    .map((x) => {
      const e = cv.esperienze[x.id]
      return { titolo: x.titolo, chi: x.chi, categoria: NOME_CAT[x.cat] || x.cat, periodo: periodo(x.quando), ore: String(Math.round(x.ore * 10) / 10).replace('.', ','),
        descrizione: e.descrizione || '', competenze: ATTIVITA[x.cat] || [], valutazione: e.mostraVoto && x.voto ? String(Math.round(x.voto * 10) / 10).replace('.', ',') : null }
    })
  const contatti = [cv.mostraContatti.email && (cv.contatti.email || u.email), cv.mostraContatti.telefono && cv.contatti.telefono, cv.mostraContatti.citta && (cv.contatti.citta || u.citta)].filter(Boolean)
  const sez = {
    presentazione: { k: 'presentazione', testo: cv.presentazione },
    esperienze: { k: 'esperienze', jobexpress: exp, esterne: cv.esterne },
    studi: { k: 'studi', voci: cv.studi },
    lingue: { k: 'lingue', voci: cv.lingue },
    competenze: { k: 'competenze', voci: cv.competenze },
    certificazioni: { k: 'certificazioni', voci: cv.certificazioni.map((c) => ({ ...c, verificata: false })) },
    disponibilita: { k: 'disponibilita', testo: cv.disponibilita },
    badge: { k: 'badge', n: rep.livello.n, livello: rep.livello.nome, incarichi: rep.incarichi },
    valutazioni: { k: 'valutazioni', voci: voti.filter((r) => cv.valutazioni.includes(String(r.il)) && r.commento).map((r) => ({ testo: r.commento, da: r.da, voto: Math.round(r.media) })) },
  }
  return {
    modello: cv.modello, nome: u.nome || '', titolo: cv.titolo, foto: cv.foto, contatti,
    sezioni: cv.ordine.filter((k) => !cv.nascoste.includes(k)).map((k) => sez[k]),
    generato: new Date().toLocaleDateString('it-IT'),
  }
}

// ---------- interfaccia ----------
const LISTE = {
  esterne: { titolo: 'Esperienze esterne (autodichiarate)', campi: [['ruolo', 'Ruolo', 'Es. Commessa'], ['dove', 'Dove', 'Es. Negozio Rossi, Forlì'], ['periodo', 'Periodo', 'Es. estate 2025'], ['descrizione', 'Cosa facevi', '']], riga: (x) => `${x.ruolo} · ${x.dove} · ${x.periodo}` },
  studi: { titolo: 'Istruzione', campi: [['titolo', 'Titolo di studio', 'Es. Diploma di liceo'], ['scuola', 'Scuola o università', ''], ['anno', 'Anno', 'Es. 2024']], riga: (x) => `${x.titolo} · ${x.scuola} · ${x.anno}` },
  lingue: { titolo: 'Lingue', campi: [['lingua', 'Lingua', 'Es. Inglese'], ['livello', 'Livello', 'Es. B2']], riga: (x) => `${x.lingua} ${x.livello}` },
  certificazioni: { titolo: 'Certificazioni (autodichiarate)', campi: [['nome', 'Nome', 'Es. HACCP'], ['ente', 'Ente', ''], ['anno', 'Anno', '']], riga: (x) => `${x.nome} · ${x.ente} · ${x.anno}` },
}

function editorLista(k) {
  const d = LISTE[k]
  return `<details class="cv-ed" ${cv[k].length ? '' : ''}><summary>${d.titolo} <span class="cv-ed__n">${cv[k].length}</span></summary>
    ${cv[k].length ? `<ul class="cv-ed__lista">${cv[k].map((x, i) => `<li><span>${esc(d.riga(x))}</span><button type="button" class="cal-x" data-cv-togli="${k}" data-n="${i}" aria-label="Togli">×</button></li>`).join('')}</ul>` : ''}
    <form class="cv-ed__form" data-cv-aggiungi="${k}" novalidate>
      ${d.campi.map(([c, t, ph]) => `<label><span>${t}</span><input name="${c}" placeholder="${esc(ph)}" maxlength="${c === 'descrizione' ? 300 : 80}" /></label>`).join('')}
      <button type="submit" class="tasto tasto--chiaro">Aggiungi</button></form></details>`
}

function modifica() {
  const nuove = daAggiungere()
  const aggiunte = completati().filter((x) => cv.esperienze[x.id]?.stato === 'aggiunta')
  const voti = leggiRecensioni().ricevute.filter((r) => r.commento)
  return `
    ${nuove.length ? `<article class="pc-card cv-nuove"><span class="pc-etichetta">Nuove esperienze da aggiungere</span>
      <ul class="cv-ed__lista">${nuove.map((x) => `<li><div><strong>${esc(x.titolo)}</strong><p>${esc(x.chi)} · ${esc(NOME_CAT[x.cat] || x.cat)} · ${periodo(x.quando)}</p></div>
        <span class="cv-azioni"><button type="button" class="tasto" data-cv-esp="aggiungi" data-id="${esc(x.id)}">Aggiungi</button><button type="button" class="tasto tasto--chiaro" data-cv-esp="ignora" data-id="${esc(x.id)}">Ignora</button></span></li>`).join('')}</ul>
      <p class="pc-nota">Arrivano dagli incarichi completati su JobExpress: nel CV saranno segnati come verificabili.</p></article>` : ''}

    <form class="pc-card cv-dati" data-cv-dati novalidate>
      <span class="pc-etichetta">Chi sei</span>
      <label><span>Ruolo o titolo</span><input name="titolo" maxlength="80" value="${esc(cv.titolo)}" placeholder="Es. Studentessa di Economia, esperienza in sala" /></label>
      <label><span>Presentazione</span><textarea name="presentazione" rows="3" maxlength="600" placeholder="Due righe su di te: cosa sai fare, cosa cerchi.">${esc(cv.presentazione)}</textarea></label>
      <div class="cv-dati__tre">
        <label><span>Email</span><input name="email" type="email" value="${esc(cv.contatti.email)}" placeholder="${esc(s.utente()?.email || '')}" /></label>
        <label><span>Telefono</span><input name="telefono" type="tel" value="${esc(cv.contatti.telefono)}" /></label>
        <label><span>Città</span><input name="citta" value="${esc(cv.contatti.citta)}" placeholder="${esc(s.utente()?.citta || '')}" /></label>
      </div>
      <p class="cv-spunte"><span>Mostra nel CV:</span>${['email', 'telefono', 'citta'].map((k) => `<label><input type="checkbox" name="mostra_${k}" ${cv.mostraContatti[k] ? 'checked' : ''}/> ${{ email: 'email', telefono: 'telefono', citta: 'città' }[k]}</label>`).join('')}</p>
      <label><span>Disponibilità</span><input name="disponibilita" maxlength="160" value="${esc(cv.disponibilita)}" placeholder="Es. weekend e sere, da gennaio anche mattine" /></label>
      <label class="cv-foto-campo"><span>Foto (facoltativa)</span><input name="foto" type="file" accept="image/*" /></label>
      ${cv.foto ? '<button type="button" class="link-prova" data-cv-foto-via>Togli la foto</button>' : ''}
      <label><span>Competenze (separate da virgola)</span><input name="competenze" maxlength="300" value="${esc(cv.competenze.join(', '))}" placeholder="Es. lavoro di squadra, inglese, cassa" /></label>
      <button type="submit" class="tasto">Salva</button>
      <p class="pc-nota" data-cv-msg role="status"></p>
    </form>

    ${aggiunte.length ? `<article class="pc-card"><span class="pc-etichetta">Esperienze su JobExpress</span>
      <ul class="cv-ed__lista">${aggiunte.map((x) => { const e = cv.esperienze[x.id]; return `<li class="cv-esp"><div><strong>${esc(x.titolo)}</strong><p>${esc(x.chi)} · ${periodo(x.quando)}</p>
        <textarea data-cv-descr="${esc(x.id)}" rows="2" maxlength="300" placeholder="Descrivi in breve cosa hai fatto (facoltativo)">${esc(e.descrizione || '')}</textarea>
        <p class="cv-spunte"><label><input type="checkbox" data-cv-mostra="${esc(x.id)}" ${e.mostra !== false ? 'checked' : ''}/> nel CV</label>${x.voto ? `<label><input type="checkbox" data-cv-voto="${esc(x.id)}" ${e.mostraVoto ? 'checked' : ''}/> mostra la valutazione (${String(Math.round(x.voto * 10) / 10).replace('.', ',')}/5)</label>` : ''}</p></div></li>` }).join('')}</ul></article>` : ''}

    ${['esterne', 'studi', 'lingue', 'certificazioni'].map(editorLista).join('')}

    ${voti.length ? `<details class="cv-ed"><summary>Valutazioni da mostrare <span class="cv-ed__n">${cv.valutazioni.length}</span></summary>
      <ul class="cv-ed__lista">${voti.map((r) => `<li><label class="cv-scelta"><input type="checkbox" data-cv-val="${r.il}" ${cv.valutazioni.includes(String(r.il)) ? 'checked' : ''}/> «${esc(r.commento)}» · ${esc(r.da)}</label></li>`).join('')}</ul></details>` : ''}

    <article class="pc-card"><span class="pc-etichetta">Sezioni e ordine</span>
      <ul class="cv-ordine">${cv.ordine.map((k, i) => `<li class="${cv.nascoste.includes(k) ? 'nascosta' : ''}"><span>${esc(NOMI_SEZIONI[k])}</span>
        <span class="cv-azioni"><button type="button" class="cv-mini" data-cv-su="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Sposta su ${esc(NOMI_SEZIONI[k])}">↑</button><button type="button" class="cv-mini" data-cv-giu="${i}" ${i === cv.ordine.length - 1 ? 'disabled' : ''} aria-label="Sposta giù ${esc(NOMI_SEZIONI[k])}">↓</button>
        <button type="button" class="cv-mini cv-mini--testo" data-cv-occhio="${k}" aria-pressed="${!cv.nascoste.includes(k)}">${cv.nascoste.includes(k) ? 'Nascosta' : 'Visibile'}</button></span></li>`).join('')}</ul></article>`
}

function anteprima() {
  const u = s.utente()
  const reale = u && !u.prova
  return `
    <div class="cv-modelli scelta scelta--vista2" role="group" aria-label="Modello">${MODELLI.map(([k, t]) => `<button type="button" data-cv-modello="${k}" aria-pressed="${cv.modello === k}">${t}</button>`).join('')}</div>
    <div class="cv-foglio" data-cv-foglio>${disegnaCV(fotografia())}</div>
    <article class="pc-card cv-condividi">
      <div class="pc-report__azioni"><button type="button" class="tasto" data-cv-pdf>Scarica PDF</button>
        ${reale ? `<button type="button" class="tasto tasto--chiaro" data-cv-link>${cv.link ? 'Aggiorna il link' : 'Crea link condivisibile'}</button>${cv.link ? '<button type="button" class="tasto tasto--chiaro" data-cv-revoca>Revoca il link</button>' : ''}` : ''}</div>
      ${cv.link ? `<p class="cv-link"><span>Link attivo:</span> <code>${esc(`${location.origin}${location.pathname.replace(/[^/]*$/, '')}cv.html?t=${cv.link}`)}</code> <button type="button" class="link-prova" data-cv-copia>Copia</button></p>` : ''}
      <p class="pc-nota" data-cv-msg2 role="status">${reale ? 'Il link mostra solo ciò che vedi qui sopra, nel momento in cui lo crei. Puoi revocarlo quando vuoi.' : 'Con l’account di prova puoi scaricare il PDF; il link condivisibile funziona con un account vero.'}</p>
    </article>`
}

export function pannelloCV() {
  const indietro = '<button type="button" class="pc-indietro" data-pc-vai="panoramica">← Il tuo percorso</button>'
  const testa = '<header class="pc-testa"><h3>JobExpress CV</h3><p>Un curriculum che cresce con te.</p></header>'
  if (!haPlus()) {
    const n = daAggiungere().length + completati().length
    return `<div class="pc">${indietro}${testa}
      <article class="pc-card pc-promo"><span class="pc-plus">Plus</span><h4>Con JobExpress CV puoi…</h4>
        <ul class="pc-lista-check"><li>trasformare ogni incarico completato in un’esperienza verificabile</li><li>aggiungere studi, lingue, esperienze esterne e certificazioni</li><li>scegliere tra 3 modelli e l’ordine delle sezioni</li><li>scaricare il PDF e condividere un link che puoi revocare</li></ul>
        ${n ? '' : '<p class="pc-nota">Dopo il tuo primo incarico completato, il CV si arricchisce da solo.</p>'}
        <button type="button" class="tasto" data-abbonati="plus">Scopri Plus</button></article></div>`
  }
  return `<div class="pc">${indietro}${testa}
    <div class="scelta scelta--vista2" role="group" aria-label="Vista"><button type="button" data-cv-vista="modifica" aria-pressed="${vista === 'modifica'}">Modifica</button><button type="button" data-cv-vista="anteprima" aria-pressed="${vista === 'anteprima'}">Anteprima</button></div>
    ${vista === 'modifica' ? modifica() : anteprima()}</div>`
}

async function rpc(nome, corpo) {
  const t = await s.token()
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
  if (!r.ok) throw new Error(await r.text())
  const x = await r.text()
  return x ? JSON.parse(x) : null
}

function stampa() {
  const box = document.createElement('div')
  box.id = 'cv-stampa'
  box.innerHTML = disegnaCV(fotografia())
  document.body.appendChild(box)
  document.documentElement.classList.add('stampa-cv')
  const fine = () => { box.remove(); document.documentElement.classList.remove('stampa-cv'); window.removeEventListener('afterprint', fine) }
  window.addEventListener('afterprint', fine)
  try { window.print() } catch { /* stampa non disponibile */ }
  setTimeout(fine, 60000)
}

// true = ridisegna
export function gestisciCV(e) {
  const t = e.target
  if (e.type === 'change') {
    if (t.matches('[data-cv-dati] input[name=foto]') && t.files?.[0]) {
      const f = t.files[0]
      if (f.size > 5e6) return false
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        const lato = 320
        const sc = Math.max(lato / img.width, lato / img.height)
        c.width = lato; c.height = lato
        c.getContext('2d').drawImage(img, (lato - img.width * sc) / 2, (lato - img.height * sc) / 2, img.width * sc, img.height * sc)
        cv.foto = c.toDataURL('image/jpeg', 0.82)
        salva()
        URL.revokeObjectURL(img.src)
        document.dispatchEvent(new CustomEvent('cv-cambiato'))
      }
      img.src = URL.createObjectURL(f)
      return false
    }
    const id = t.dataset.cvMostra || t.dataset.cvVoto
    if (t.dataset.cvMostra) { cv.esperienze[id].mostra = t.checked; salva(); return false }
    if (t.dataset.cvVoto) { cv.esperienze[id].mostraVoto = t.checked; salva(); return false }
    if (t.dataset.cvVal) { const v = t.dataset.cvVal; cv.valutazioni = t.checked ? [...new Set([...cv.valutazioni, v])] : cv.valutazioni.filter((x) => x !== v); salva(); return false }
    if (t.dataset.cvDescr) { cv.esperienze[t.dataset.cvDescr].descrizione = t.value.trim().slice(0, 300); salva(); return false }
    return false
  }
  if (e.type === 'submit') {
    const f = t.closest('[data-cv-dati]')
    if (f) {
      e.preventDefault()
      const el = f.elements
      cv.titolo = el.titolo.value.trim()
      cv.presentazione = el.presentazione.value.trim()
      cv.contatti = { email: el.email.value.trim(), telefono: el.telefono.value.trim(), citta: el.citta.value.trim() }
      cv.mostraContatti = { email: el.mostra_email.checked, telefono: el.mostra_telefono.checked, citta: el.mostra_citta.checked }
      cv.disponibilita = el.disponibilita.value.trim()
      cv.competenze = [...new Set(el.competenze.value.split(',').map((x) => x.trim()).filter(Boolean))].slice(0, 25)
      salva()
      f.querySelector('[data-cv-msg]').textContent = 'Salvato.'
      return false
    }
    const a = t.closest('[data-cv-aggiungi]')
    if (a) {
      e.preventDefault()
      const k = a.dataset.cvAggiungi
      const voce = Object.fromEntries(LISTE[k].campi.map(([c]) => [c, a.elements[c].value.trim()]))
      if (!voce[LISTE[k].campi[0][0]]) return false
      cv[k].push(voce)
      salva()
      return true
    }
    return false
  }
  if (e.type !== 'click') return false
  const esp = t.closest('[data-cv-esp]')
  if (esp) { cv.esperienze[esp.dataset.id] = esp.dataset.cvEsp === 'aggiungi' ? { stato: 'aggiunta', mostra: true } : { stato: 'ignorata' }; salva(); return true }
  const tg = t.closest('[data-cv-togli]')
  if (tg) { cv[tg.dataset.cvTogli].splice(Number(tg.dataset.n), 1); salva(); return true }
  const vi = t.closest('[data-cv-vista]')
  if (vi) { vista = vi.dataset.cvVista; return true }
  const mo = t.closest('[data-cv-modello]')
  if (mo) { cv.modello = mo.dataset.cvModello; salva(); return true }
  const su = t.closest('[data-cv-su]'); const giu = t.closest('[data-cv-giu]')
  if (su || giu) {
    const i = Number((su || giu).dataset[su ? 'cvSu' : 'cvGiu'])
    const j = su ? i - 1 : i + 1
    ;[cv.ordine[i], cv.ordine[j]] = [cv.ordine[j], cv.ordine[i]]
    salva(); return true
  }
  const oc = t.closest('[data-cv-occhio]')
  if (oc) { const k = oc.dataset.cvOcchio; cv.nascoste = cv.nascoste.includes(k) ? cv.nascoste.filter((x) => x !== k) : [...cv.nascoste, k]; salva(); return true }
  if (t.closest('[data-cv-foto-via]')) { cv.foto = ''; salva(); return true }
  if (t.closest('[data-cv-pdf]')) { stampa(); return false }
  const msg = () => document.querySelector('[data-cv-msg2]')
  if (t.closest('[data-cv-link]')) {
    rpc('cv_pubblica', { p_contenuto: fotografia() })
      .then((tok) => { cv.link = tok; salva(); document.dispatchEvent(new CustomEvent('cv-cambiato')) })
      .catch(() => { if (msg()) msg().textContent = 'Non sono riuscita a creare il link: serve un abbonamento Plus attivo sull’account vero.' })
    return false
  }
  if (t.closest('[data-cv-revoca]')) {
    rpc('cv_revoca', {}).then(() => { cv.link = null; salva(); document.dispatchEvent(new CustomEvent('cv-cambiato')) }).catch(() => { if (msg()) msg().textContent = 'Revoca non riuscita, riprova.' })
    return false
  }
  if (t.closest('[data-cv-copia]')) { navigator.clipboard?.writeText(document.querySelector('.cv-link code')?.textContent || '').then(() => { if (msg()) msg().textContent = 'Link copiato.' }, () => {}); return false }
  return false
}
