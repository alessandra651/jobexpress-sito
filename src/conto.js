// Finestre di accesso/registrazione e "La mia area" (area personale del lavoratore).
import {
  PROVIDER_ATTIVI, SenzaRete, accedi, avviaAuth, conProvider, eliminaAccount, entraInProva, esci, inRecupero,
  nuovaPassword, quandoCambiaUtente, recupera, registra, salvaProfilo, utente,
} from './auth.js'
import { leggiDisponibile, quandoCambia } from './disponibile.js'
import { avviaAnnunci, gestisciPubblicatore, haAnnunci, pannelloAnnunci, pannelloPubblicatoreHome } from './annunci.js'
import { collegaCandidature, dataDi, dataIso, gestisciCalendario, pannelloCalendario, sovrapposizioni } from './calendario.js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const MODALITA = [['lavoro', 'Voglio lavorare'], ['attivita', 'Cerco personale per la mia attività'], ['privato', 'Cerco qualcuno per un incarico privato']]
const CITTA = ['Forlì', 'Forlimpopoli', 'Bertinoro', 'Meldola', 'Castrocaro Terme', 'Predappio', 'Cesena', 'Ravenna', 'Faenza', 'Bologna']

let apri = () => {}
const finestra = () => document.querySelector('dialog.finestra')

// ================= ACCESSO E REGISTRAZIONE =================
const social = () => `
  <div class="finestra__azioni">
    <button class="social" type="button" data-provider="google">Continua con Google</button>
    <button class="social social--apple" type="button" data-provider="apple">Continua con Apple</button>
  </div>
  <p class="oppure"><span>oppure con l’email</span></p>`

function schedaAccedi() {
  return `
  <form class="conto-form" data-form="accedi" novalidate>
    <div class="campo"><label for="c-email">Email</label><input id="c-email" name="email" type="email" autocomplete="email" required /></div>
    <div class="campo"><label for="c-pw">Password</label><input id="c-pw" name="password" type="password" autocomplete="current-password" required minlength="6" /></div>
    <p class="conto-form__errore" data-errore role="alert"></p>
    <div class="finestra__azioni">
      <button class="tasto" type="submit">Accedi</button>
      <button class="tasto tasto--chiaro" type="button" data-vai="recupero">Password dimenticata?</button>
    </div>
  </form>`
}

function schedaRegistrati() {
  return `
  <form class="conto-form" data-form="registrati" novalidate>
    <div class="campo"><label for="r-nome">Nome</label><input id="r-nome" name="nome" autocomplete="given-name" required maxlength="120" /></div>
    <div class="campo"><label for="r-email">Email</label><input id="r-email" name="email" type="email" autocomplete="email" required /></div>
    <div class="campo"><label for="r-pw">Password <span class="facoltativo">almeno 8 caratteri</span></label><input id="r-pw" name="password" type="password" autocomplete="new-password" required minlength="8" /></div>
    <fieldset class="conto-form__gruppo">
      <legend>Come vuoi utilizzare JobExpress?</legend>
      ${MODALITA.map(([v, t], i) => `<label class="spunta"><input type="checkbox" name="modalita" value="${v}" ${i === 0 ? 'checked' : ''}/> ${t}</label>`).join('')}
      <p class="facoltativo">Puoi scegliere più modalità con lo stesso account e cambiarle quando vuoi.</p>
    </fieldset>
    <div class="campo"><label for="r-citta">Di dove sei?</label>
      <input id="r-citta" name="citta" list="r-citta-lista" value="Forlì" maxlength="80" required />
      <datalist id="r-citta-lista">${CITTA.map((c) => `<option value="${c}"></option>`).join('')}</datalist>
    </div>
    <label class="spunta"><input type="checkbox" name="automunito" /> Sono automunito/a</label>
    <label class="spunta"><input type="checkbox" name="maggiorenne" required /> Confermo di avere almeno 18 anni</label>
    <label class="spunta"><input type="checkbox" name="termini" required /> Accetto le condizioni del servizio e ho letto l’<a href="privacy.html" target="_blank" rel="noopener">informativa privacy</a></label>
    <p class="conto-form__errore" data-errore role="alert"></p>
    <div class="finestra__azioni"><button class="tasto" type="submit">Registrati gratuitamente</button></div>
  </form>`
}

export function apriAccesso(titolo, scheda = 'registrati') {
  apri(`
    <h2>${esc(titolo || 'Benvenuto in JobExpress')}</h2>
    ${social()}
    <div class="scelta scelta--piena conto-schede" role="tablist" aria-label="Accedi o registrati">
      <button type="button" role="tab" data-scheda="registrati" aria-selected="${scheda === 'registrati'}">Registrati</button>
      <button type="button" role="tab" data-scheda="accedi" aria-selected="${scheda === 'accedi'}">Accedi</button>
    </div>
    <div data-pannello>${scheda === 'accedi' ? schedaAccedi() : schedaRegistrati()}</div>`)
  collega()
}

function schermata(html) {
  const f = finestra()
  f.querySelectorAll(':scope > :not(.finestra__chiudi)').forEach((n) => n.remove())
  f.insertAdjacentHTML('beforeend', html)
  collega()
}

function offriProva(form, dati) {
  const err = form.querySelector('[data-errore]')
  err.innerHTML = `Non riesco a collegarmi al server di JobExpress. Puoi continuare con un <strong>account di prova</strong>, che resta solo su questo dispositivo.
    <button type="button" class="tasto tasto--chiaro" data-prova>Continua in prova</button>`
  err.querySelector('[data-prova]').onclick = () => {
    entraInProva(dati)
    finestra().close()
    apriArea('home')
  }
}

function collega() {
  const f = finestra()
  f.querySelectorAll('[data-provider]').forEach((b) => (b.onclick = () => {
    const p = b.dataset.provider
    if (PROVIDER_ATTIVI.includes(p)) return conProvider(p)
    const nome = p === 'google' ? 'Google' : 'Apple'
    let nota = f.querySelector('[data-nota-provider]')
    if (!nota) {
      f.querySelector('.oppure').insertAdjacentHTML('beforebegin', '<p class="finestra__nota" data-nota-provider role="status"></p>')
      nota = f.querySelector('[data-nota-provider]')
    }
    nota.textContent = `L’accesso con ${nome} non è ancora configurato in questa versione. Registrati con l’email: ci vuole un minuto.`
  }))
  f.querySelectorAll('[data-scheda]').forEach((b) => (b.onclick = () => {
    f.querySelectorAll('[data-scheda]').forEach((x) => x.setAttribute('aria-selected', x === b))
    f.querySelector('[data-pannello]').innerHTML = b.dataset.scheda === 'accedi' ? schedaAccedi() : schedaRegistrati()
    collega()
  }))
  f.querySelector('[data-vai="recupero"]')?.addEventListener('click', () => schermata(`
    <h2>Recupera la password</h2>
    <p>Scrivi l’email del tuo account: ti mandiamo un link per sceglierne una nuova.</p>
    <form class="conto-form" data-form="recupero" novalidate>
      <div class="campo"><label for="p-email">Email</label><input id="p-email" name="email" type="email" autocomplete="email" required /></div>
      <p class="conto-form__errore" data-errore role="alert"></p>
      <div class="finestra__azioni"><button class="tasto" type="submit">Mandami il link</button></div>
    </form>`))

  f.querySelectorAll('form[data-form]').forEach((form) => (form.onsubmit = async (e) => {
    e.preventDefault()
    const err = form.querySelector('[data-errore]')
    err.textContent = ''
    if (!form.checkValidity()) {
      const primo = form.querySelector(':invalid')
      err.textContent = messaggioCampo(primo)
      primo?.focus()
      return
    }
    const tasto = form.querySelector('[type=submit]')
    const testo = tasto.textContent
    tasto.disabled = true
    tasto.textContent = 'Un momento…'
    const tipo = form.dataset.form
    const v = (n) => form.elements[n]?.value?.trim()
    const dati = tipo === 'registrati' ? {
      email: v('email'), password: form.elements.password.value, nome: v('nome'), citta: v('citta'),
      modalita: [...form.querySelectorAll('[name=modalita]:checked')].map((c) => c.value),
      automunito: form.elements.automunito.checked, maggiorenne: form.elements.maggiorenne.checked, termini: form.elements.termini.checked,
    } : { email: v('email'), password: form.elements.password?.value }
    try {
      if (tipo === 'registrati') {
        if (!dati.modalita.length) throw new Error('Scegli almeno un modo di usare JobExpress.')
        const { confermaEmail } = await registra(dati)
        if (confermaEmail) {
          return schermata(`<h2>Controlla la tua email</h2>
            <p>Ti abbiamo mandato un link a <strong>${esc(dati.email)}</strong>. Aprilo per attivare l’account: poi torni qui già dentro.</p>
            <p class="finestra__nota">Non la trovi? Guarda anche nella cartella spam.</p>`)
        }
        finestra().close()
        apriArea('home')
      } else if (tipo === 'accedi') {
        await accedi(dati.email, dati.password)
        finestra().close()
        apriArea('home')
      } else if (tipo === 'recupero') {
        await recupera(dati.email)
        schermata(`<h2>Controlla la tua email</h2><p>Se esiste un account con <strong>${esc(dati.email)}</strong>, ti abbiamo mandato un link per scegliere una nuova password.</p>`)
      } else if (tipo === 'nuova') {
        await nuovaPassword(form.elements.password.value)
        schermata('<h2>Password aggiornata</h2><p>Da ora accedi con la nuova password.</p>')
      }
    } catch (e) {
      if (e instanceof SenzaRete && tipo === 'registrati') offriProva(form, dati)
      else if (e instanceof SenzaRete && tipo === 'accedi') offriProva(form, { email: dati.email })
      else err.textContent = e instanceof SenzaRete ? 'Non riesco a collegarmi. Controlla la connessione e riprova.' : e.message
    } finally {
      if (tasto.isConnected) { tasto.disabled = false; tasto.textContent = testo }
    }
  }))
}

function messaggioCampo(c) {
  if (!c) return 'Controlla i campi.'
  if (c.name === 'maggiorenne') return 'Per usare JobExpress devi avere almeno 18 anni.'
  if (c.name === 'termini') return 'Per registrarti devi accettare le condizioni e leggere l’informativa privacy.'
  if (c.type === 'email') return 'Scrivi un’email valida.'
  if (c.name === 'password') return c.validity.tooShort ? `La password deve avere almeno ${c.minLength} caratteri.` : 'Scrivi la password.'
  return `Compila il campo «${c.labels?.[0]?.textContent.trim() || c.name}».`
}

// ================= CANDIDATURE (simulate, su questo dispositivo) =================
const CHIAVE_CAND = 'jobexpress-candidature'
const leggiCand = () => { try { return JSON.parse(localStorage.getItem(CHIAVE_CAND) || '[]') } catch { return [] } }
const scriviCand = (l) => { try { localStorage.setItem(CHIAVE_CAND, JSON.stringify(l)) } catch { /* non disponibile */ } }
const STATI = { inviata: 'Candidatura inviata', valutazione: 'In valutazione', ritirata: 'Candidatura ritirata' }

// Restituisce un testo da mostrare, oppure null se serve prima accedere
export function candidati(a, quando) {
  if (!utente()) {
    apriAccesso('Per candidarti, registrati o accedi')
    return null
  }
  const lista = leggiCand()
  const gia = lista.find((c) => c.id === a.id && c.stato !== 'ritirata')
  if (gia) return 'Ti sei già candidato a questo incarico. Lo trovi in «La mia area» → Attività.'
  const altri = sovrapposizioni(a, a.id)
  if (altri.length) return `Non puoi candidarti: si sovrappone a «${altri[0].titolo}», a cui ti sei già candidato. Se vuoi, ritira prima l’altra candidatura.`
  const d = dataDi(a)
  lista.unshift({ id: a.id, titolo: a.titolo, chi: a.chi, luogo: `${a.citta}, ${a.zona}`, quando, euroOra: a.euroOra, totale: a.totale, stato: 'inviata', il: Date.now(),
    data: d ? dataIso(d) : null, inizio: a.inizio, fine: a.fine })
  scriviCand(lista)
  disegnaArea()
  return 'Candidatura inviata (simulata: in questa versione di prova non arriva a nessuno). La trovi in «La mia area» → Attività.'
}

// ================= LA MIA AREA =================
// Incarichi svolti DI ESEMPIO, solo per far vedere grafici e statistiche
const ESEMPIO_SVOLTI = [
  { sett: 5, ore: 4.5, euro: 49.5 }, { sett: 5, ore: 3, euro: 30 }, { sett: 4, ore: 4, euro: 60 },
  { sett: 3, ore: 2, euro: 27 }, { sett: 3, ore: 5, euro: 62.5 }, { sett: 1, ore: 6, euro: 72 }, { sett: 0, ore: 4.5, euro: 49.5 },
]
let scheda = 'home'
let modo = null // 'lavoro' oppure 'pubblico'
let sottoAttivita = 'calendario'
let esempio = false
let area = null

function datiGuadagni() {
  const svolti = esempio ? ESEMPIO_SVOLTI : []
  const somma = (l, k) => l.reduce((t, x) => t + x[k], 0)
  const settimane = [5, 4, 3, 2, 1, 0].map((s) => somma(svolti.filter((x) => x.sett === s), 'euro'))
  const ore = somma(svolti, 'ore')
  const totale = somma(svolti, 'euro')
  return {
    settimane, ore, totale,
    settimana: settimane[5],
    mese: settimane.slice(2).reduce((a, b) => a + b, 0),
    media: ore ? totale / ore : 0,
    svolti: svolti.length,
  }
}

function pannelloHome(u) {
  const g = datiGuadagni()
  const obiettivo = 300
  const perc = Math.min(100, Math.round((g.mese / obiettivo) * 100))
  const max = Math.max(...g.settimane, 1)
  const cand = leggiCand().filter((c) => c.stato !== 'ritirata')
  const prossimo = cand[0]
  const d = leggiDisponibile()
  return `
    <div class="area__griglia">
      <article class="riquadro riquadro--dispo">
        <h3>Disponibilità</h3>
        ${d ? `<p class="grande">Disponibile ora</p><p>Fino alle ${new Date(d.fino).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}, entro ${d.km} km.</p>`
            : '<p class="grande">Non visibile</p><p>Attiva «Disponibile ora» quando hai qualche ora libera.</p>'}
        <button type="button" class="tasto tasto--chiaro" data-area-vai="dispo">${d ? 'Modifica' : 'Attiva'}</button>
      </article>
      <article class="riquadro">
        <h3>Prossimo incarico</h3>
        ${prossimo ? `<p class="grande">${esc(prossimo.titolo)}</p><p>${esc(prossimo.quando)} · ${esc(prossimo.luogo)}</p><p><span class="stato">${STATI[prossimo.stato]}</span> · ${euro.format(prossimo.euroOra)}/ora</p>
          <button type="button" class="tasto tasto--chiaro" data-area-scheda="attivita">Vedi le attività</button>`
          : `<p>Nessun incarico in programma.</p><button type="button" class="tasto" data-area-vai="esplora">Esplora gli incarichi</button>`}
      </article>
      <article class="riquadro riquadro--guadagni">
        <div class="riquadro__testa"><h3>Guadagni dichiarati</h3>
          <label class="interruttore"><input type="checkbox" data-esempio ${esempio ? 'checked' : ''}/> Dati di esempio</label></div>
        ${g.svolti ? '' : '<p class="finestra__nota">Qui vedrai quanto hai guadagnato con gli incarichi completati, come lo dichiari tu. Accendi «Dati di esempio» per vedere come apparirà.</p>'}
        <div class="cifre">
          <div><span>Questo mese</span><strong>${euro.format(g.mese)}</strong></div>
          <div><span>Questa settimana</span><strong>${euro.format(g.settimana)}</strong></div>
          <div><span>Ore lavorate in tutto</span><strong>${String(g.ore).replace('.', ',')}</strong></div>
          <div><span>Media all’ora</span><strong>${g.ore ? euro.format(g.media) : '—'}</strong></div>
        </div>
        <div class="barre" role="img" aria-label="Guadagni delle ultime sei settimane: ${g.settimane.map((x) => euro.format(x)).join(', ')}">
          ${g.settimane.map((x, i) => `<div class="barra"><span class="barra__val">${x ? Math.round(x) + ' €' : ''}</span><i style="height:${(x / max) * 100}%"></i><span class="barra__nome">${i === 5 ? 'Ora' : `−${5 - i}`}</span></div>`).join('')}
        </div>
        <div class="obiettivo">
          <div class="obiettivo__testo"><span>Obiettivo del mese</span><strong>${euro.format(g.mese)} di ${euro.format(obiettivo)}</strong></div>
          <div class="obiettivo__barra"><i style="width:${perc}%"></i></div>
          <p class="finestra__nota">${perc}% raggiunto. È una stima: dipende dagli incarichi che trovi e accetti.</p>
        </div>
        ${esempio ? '<p class="etichetta-esempio">Dati di esempio, non reali</p>' : ''}
      </article>
      <article class="riquadro">
        <h3>Le tue statistiche</h3>
        <ul class="stat">
          <li><strong>${g.svolti}</strong><span>Incarichi svolti</span></li>
          <li><strong>${leggiCand().length}</strong><span>Candidature inviate</span></li>
          <li><strong>0</strong><span>Incarichi confermati</span></li>
          <li><strong>0</strong><span>Recensioni</span></li>
        </ul>
      </article>
    </div>`
}

function pannelloAttivita() {
  const l = leggiCand()
  if (!l.length) {
    return `<div class="vuoto"><strong>Nessuna candidatura.</strong><p>Quando ti candidi a un incarico, qui segui lo stato passo per passo.</p>
      <button type="button" class="tasto" data-area-vai="esplora">Esplora gli incarichi</button></div>`
  }
  return `<ul class="candidature">${l.map((c, i) => `
    <li class="candidatura">
      <div><strong>${esc(c.titolo)}</strong><p>${esc(c.chi)} · ${esc(c.luogo)}</p><p>${esc(c.quando)} · ${euro.format(c.euroOra)}/ora · circa ${euro.format(c.totale)}</p></div>
      <div class="candidatura__lato"><span class="stato stato--${c.stato}">${STATI[c.stato]}</span>
        ${c.stato !== 'ritirata' ? `<button type="button" class="tasto tasto--chiaro" data-ritira="${i}">Ritira</button>` : ''}</div>
    </li>`).join('')}</ul>
    <p class="finestra__nota">Versione di prova: le candidature restano su questo dispositivo e non arrivano a nessuno.</p>`
}

const pannelloChat = () => `<div class="vuoto"><strong>Nessun messaggio.</strong>
  <p>Quando chi pubblica risponde a una tua candidatura, la conversazione compare qui. Numero di telefono ed email restano privati.</p></div>`

function pannelloProfilo(u) {
  return `
    <form class="conto-form profilo-form" data-profilo novalidate>
      <div class="profilo-testa">
        <span class="avatar" aria-hidden="true">${esc((u.nome || u.email || '?').trim().charAt(0).toUpperCase())}</span>
        <div><strong>${esc(u.nome || 'Senza nome')}</strong><p>${esc(u.email || '')}</p>
          <div class="etichette">${u.automunito ? '<span>Automunito/a</span>' : ''}${u.citta ? `<span>${esc(u.citta)}</span>` : ''}${u.prova ? '<span>Account di prova</span>' : ''}</div></div>
      </div>
      <div class="campo"><label for="pr-nome">Nome</label><input id="pr-nome" name="nome" value="${esc(u.nome)}" maxlength="120" required /></div>
      <div class="campo"><label for="pr-citta">Città</label><input id="pr-citta" name="citta" value="${esc(u.citta)}" list="pr-citta-lista" maxlength="80" />
        <datalist id="pr-citta-lista">${CITTA.map((c) => `<option value="${c}"></option>`).join('')}</datalist></div>
      <fieldset class="conto-form__gruppo"><legend>Come usi JobExpress</legend>
        ${MODALITA.map(([v, t]) => `<label class="spunta"><input type="checkbox" name="modalita" value="${v}" ${u.modalita?.includes(v) ? 'checked' : ''}/> ${t}</label>`).join('')}
      </fieldset>
      <label class="spunta"><input type="checkbox" name="automunito" ${u.automunito ? 'checked' : ''}/> Sono automunito/a</label>
      <p class="conto-form__errore" data-errore role="status"></p>
      <div class="finestra__azioni">
        <button class="tasto" type="submit">Salva il profilo</button>
        <button class="tasto tasto--chiaro" type="button" data-esci>Esci</button>
      </div>
    </form>
    <div class="zona-rischio">
      <h3>Elimina l’account</h3>
      <p>Cancella per sempre il tuo account e il tuo profilo.</p>
      <button type="button" class="tasto tasto--pericolo" data-elimina>Elimina il mio account</button>
    </div>`
}

const SCHEDE = [['home', 'Home'], ['esplora', 'Esplora'], ['attivita', 'Attività'], ['chat', 'Chat'], ['profilo', 'Profilo']]
const ICONE = {
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  esplora: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  attivita: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  chat: '<path d="M4 6h16v10H9l-5 4z"/>',
  profilo: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
}

function disegnaArea() {
  const u = utente()
  if (!area || area.hidden || !u) return
  const oggi = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
  const pubblica = u.modalita?.some((m) => m === 'attivita' || m === 'privato') || haAnnunci()
  const lavora = u.modalita?.includes('lavoro') || !pubblica
  if (!modo || (modo === 'pubblico' && !pubblica) || (modo === 'lavoro' && !lavora)) modo = lavora ? 'lavoro' : 'pubblico'
  const attivitaLavoro = () => `
    <div class="scelta scelta--vista2 area__sotto" role="group" aria-label="Cosa vuoi vedere">
      <button type="button" data-sotto="calendario" aria-pressed="${sottoAttivita === 'calendario'}">Calendario</button>
      <button type="button" data-sotto="candidature" aria-pressed="${sottoAttivita === 'candidature'}">Candidature</button>
    </div>${sottoAttivita === 'calendario' ? pannelloCalendario() : pannelloAttivita()}`
  const pann = (modo === 'pubblico'
    ? { home: pannelloPubblicatoreHome, attivita: pannelloAnnunci, chat: pannelloChat, profilo: pannelloProfilo }
    : { home: pannelloHome, attivita: attivitaLavoro, chat: pannelloChat, profilo: pannelloProfilo })[scheda] || pannelloHome
  const scambio = lavora && pubblica ? `
    <div class="scelta area__modo" role="group" aria-label="Modalità">
      <button type="button" data-modo-area="lavoro" aria-pressed="${modo === 'lavoro'}">Cerco lavoro</button>
      <button type="button" data-modo-area="pubblico" aria-pressed="${modo === 'pubblico'}">Cerco personale</button>
    </div>` : ''
  area.innerHTML = `
    <div class="area__interno">
      <header class="area__testa">
        <div><p class="area__data">${oggi}</p><h2>Ciao${u.nome ? `, ${esc(u.nome)}` : ''}</h2>
          ${u.prova ? '<p class="finestra__nota">Account di prova: i dati restano solo su questo dispositivo.</p>' : ''}${scambio}</div>
        <button type="button" class="tasto tasto--chiaro" data-area-chiudi>Torna al sito</button>
      </header>
      <section class="area__pannello" aria-label="${SCHEDE.find((s) => s[0] === scheda)?.[1]}">${pann(u)}</section>
    </div>
    <nav class="area__nav" aria-label="Navigazione dell’area personale">
      ${SCHEDE.map(([k, t]) => `<button type="button" data-area-scheda="${k}" ${k === scheda ? 'aria-current="page"' : ''}>
        <svg viewBox="0 0 24 24" aria-hidden="true">${ICONE[k]}</svg><span>${t}</span></button>`).join('')}
    </nav>`
}

export function apriArea(qualeScheda = 'home') {
  if (!utente()) return apriAccesso()
  scheda = qualeScheda
  area.hidden = false
  document.documentElement.classList.add('area-aperta')
  if (location.hash !== '#area') history.replaceState(null, '', '#area')
  disegnaArea()
  area.querySelector('h2')?.focus?.()
  area.scrollTop = 0
}

function chiudiArea() {
  area.hidden = true
  document.documentElement.classList.remove('area-aperta')
  if (location.hash === '#area') history.replaceState(null, '', location.pathname + location.search)
}

function esplora() {
  chiudiArea()
  document.querySelector('[data-modo-tasto=lavoro]')?.click()
  document.querySelector('[data-vista-tasto=annunci]')?.click()
  document.querySelector('.apertura .tabellone')?.scrollIntoView({ block: 'start' })
}

function collegaArea() {
  area.addEventListener('click', async (e) => {
    const t = e.target
    if (gestisciCalendario(e) || gestisciPubblicatore(e)) return disegnaArea()
    const m = t.closest('[data-modo-area]')
    if (m) { modo = m.dataset.modoArea; scheda = 'home'; return disegnaArea() }
    const so = t.closest('[data-sotto]')
    if (so) { sottoAttivita = so.dataset.sotto; return disegnaArea() }
    const s = t.closest('[data-area-scheda]')
    if (s) {
      if (s.dataset.areaScheda === 'esplora') return esplora()
      scheda = s.dataset.areaScheda
      disegnaArea()
      return area.scrollTo?.(0, 0)
    }
    if (t.closest('[data-area-chiudi]')) return chiudiArea()
    const vai = t.closest('[data-area-vai]')
    if (vai?.dataset.areaVai === 'esplora') return esplora()
    if (vai?.dataset.areaVai === 'dispo') {
      chiudiArea()
      document.querySelector('[data-modo-tasto=lavoro]')?.click()
      const b = document.querySelector('[data-dispo-attiva], [data-dispo-modifica]')
      b?.scrollIntoView({ block: 'center' })
      return b?.click()
    }
    const r = t.closest('[data-ritira]')
    if (r) {
      const l = leggiCand()
      l[Number(r.dataset.ritira)].stato = 'ritirata'
      scriviCand(l)
      return disegnaArea()
    }
    if (t.closest('[data-esci]')) {
      await esci()
      return chiudiArea()
    }
    const el = t.closest('[data-elimina]')
    if (el) {
      if (el.dataset.conferma !== 'si') {
        el.dataset.conferma = 'si'
        el.textContent = 'Sei sicuro? Tocca di nuovo per eliminare per sempre'
        return
      }
      el.disabled = true
      try {
        await eliminaAccount()
        chiudiArea()
        apri('<h2>Account eliminato</h2><p>Il tuo account e il tuo profilo sono stati cancellati.</p>')
      } catch (err) {
        el.disabled = false
        el.textContent = err instanceof SenzaRete ? 'Nessuna connessione: riprova' : err.message
      }
    }
  })
  area.addEventListener('change', (e) => {
    if (gestisciCalendario(e)) return disegnaArea()
    if (e.target.matches('[data-esempio]')) {
      esempio = e.target.checked
      disegnaArea()
    }
  })
  area.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-profilo]')
    if (!f) return
    e.preventDefault()
    const msg = f.querySelector('[data-errore]')
    const modalita = [...f.querySelectorAll('[name=modalita]:checked')].map((c) => c.value)
    if (!f.elements.nome.value.trim()) { msg.textContent = 'Scrivi il tuo nome.'; return }
    if (!modalita.length) { msg.textContent = 'Scegli almeno un modo di usare JobExpress.'; return }
    try {
      await salvaProfilo({ nome: f.elements.nome.value.trim(), citta: f.elements.citta.value.trim() || null, modalita, automunito: f.elements.automunito.checked })
      disegnaArea()
      area.querySelector('[data-errore]').textContent = 'Profilo salvato.'
    } catch (err) {
      msg.textContent = err instanceof SenzaRete ? 'Nessuna connessione: riprova.' : err.message
    }
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !area.hidden && !finestra()?.open) chiudiArea()
  })
}

// Barra in basso anche sul sito, sul telefono, quando sei collegato
let barraSito = null
function disegnaBarraSito(u) {
  if (!barraSito) {
    barraSito = document.createElement('nav')
    barraSito.className = 'area__nav sito-nav'
    barraSito.setAttribute('aria-label', 'Navigazione rapida')
    barraSito.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sito-scheda]')
      if (!b) return
      const k = b.dataset.sitoScheda
      if (k === 'esplora') return esplora()
      apriArea(k)
    })
    document.body.appendChild(barraSito)
  }
  barraSito.hidden = !u
  barraSito.innerHTML = SCHEDE.map(([k, t]) => `<button type="button" data-sito-scheda="${k}" ${k === 'esplora' ? 'aria-current="page"' : ''}>
    <svg viewBox="0 0 24 24" aria-hidden="true">${ICONE[k]}</svg><span>${t}</span></button>`).join('')
  document.documentElement.classList.toggle('con-barra', !!u)
}

// Pulsanti del sito che cambiano se sei collegato
function aggiornaSito(u) {
  disegnaBarraSito(u)
  document.querySelectorAll('.testata [data-accedi], .testata [data-apri-area]').forEach((b) => {
    if (u) { b.removeAttribute('data-accedi'); b.setAttribute('data-apri-area', ''); b.textContent = 'La mia area' }
    else { b.removeAttribute('data-apri-area'); b.setAttribute('data-accedi', 'email'); b.textContent = 'Accedi o registrati' }
  })
  const blocco = document.querySelector('.accesso')
  if (blocco) {
    blocco.querySelectorAll('[data-saluto]').forEach((n) => n.remove())
    blocco.classList.toggle('accesso--dentro', !!u)
    if (u) blocco.insertAdjacentHTML('beforeend', `<p class="accesso__saluto" data-saluto>Ciao${u.nome ? ` ${esc(u.nome)}` : ''}! <button type="button" class="tasto" data-apri-area>Vai alla tua area</button></p>`)
  }
  disegnaArea()
}

// ================= AVVIO =================
export async function avviaConto(strumenti) {
  apri = strumenti.apri
  area = document.createElement('div')
  area.className = 'area'
  area.id = 'area'
  area.hidden = true
  area.setAttribute('role', 'region')
  area.setAttribute('aria-label', 'La mia area')
  document.body.appendChild(area)
  collegaArea()

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-apri-area]')
    if (a) { e.preventDefault(); apriArea('home') }
  })
  collegaCandidature(leggiCand)
  avviaAnnunci({ apri, utente, apriAccesso, dopo: () => { modo = 'pubblico'; apriArea('attivita') } })
  quandoCambiaUtente(aggiornaSito)
  quandoCambia(disegnaArea)
  const entrato = await avviaAuth()
  if (inRecupero()) {
    apri(`<h2>Scegli una nuova password</h2>
      <form class="conto-form" data-form="nuova" novalidate>
        <div class="campo"><label for="n-pw">Nuova password <span class="facoltativo">almeno 8 caratteri</span></label><input id="n-pw" name="password" type="password" autocomplete="new-password" required minlength="8" /></div>
        <p class="conto-form__errore" data-errore role="alert"></p>
        <div class="finestra__azioni"><button class="tasto" type="submit">Salva la password</button></div>
      </form>`)
    collega()
  } else if ((entrato || location.hash === '#area') && utente()) {
    apriArea('home')
  }
}
