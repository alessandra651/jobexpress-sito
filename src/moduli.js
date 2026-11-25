import { VERSIONE_PRIVACY } from './config.js'
import { INIZIO_GIORNO, FINE_GIORNO, ora } from './ore.js'
import { inserisci, NonCollegato } from './supabase.js'

const TABELLE = {
  lavoro: 'interesse_lavoratori',
  attivita: 'interesse_attivita',
  partner: 'interesse_partner',
}

const CONFERME = {
  lavoro: 'Ti scriveremo quando JobExpress apre nella tua zona.',
  attivita: 'Ti ricontatteremo per capire meglio i turni che ti servono.',
  partner: 'Leggeremo il messaggio e ti risponderemo via email.',
}

const testo = (dati, nome) => (dati.get(nome) ?? '').toString().trim()
const oppureNullo = (v) => v || null

// Le righe rispecchiano le colonne della migrazione in supabase/migrations.
const RIGHE = {
  lavoro: (d) => ({
    nome: testo(d, 'nome'),
    email: testo(d, 'email').toLowerCase(),
    telefono: oppureNullo(testo(d, 'telefono')),
    comune: testo(d, 'comune'),
    mansioni: d.getAll('mansioni'),
    disponibilita: d.getAll('disponibilita'),
    dalle: testo(d, 'dalle'),
    alle: testo(d, 'alle'),
    esperienza: testo(d, 'esperienza'),
    maggiorenne: d.has('maggiorenne'),
    intervista: d.has('intervista'),
    privacy_letta: d.has('privacy'),
    versione_privacy: VERSIONE_PRIVACY,
  }),
  attivita: (d) => ({
    nome_attivita: testo(d, 'nome_attivita'),
    tipo: testo(d, 'tipo'),
    referente: testo(d, 'referente'),
    comune: testo(d, 'comune'),
    email: testo(d, 'email').toLowerCase(),
    telefono: oppureNullo(testo(d, 'telefono')),
    mansioni: d.getAll('mansioni'),
    frequenza: testo(d, 'frequenza'),
    opinione_commissione: testo(d, 'opinione_commissione'),
    esempio_turno: oppureNullo(testo(d, 'esempio_turno')),
    intervista: d.has('intervista'),
    privacy_letta: d.has('privacy'),
    versione_privacy: VERSIONE_PRIVACY,
  }),
  partner: (d) => ({
    nome: testo(d, 'nome'),
    email: testo(d, 'email').toLowerCase(),
    organizzazione: oppureNullo(testo(d, 'organizzazione')),
    tipo: testo(d, 'tipo'),
    messaggio: testo(d, 'messaggio'),
    privacy_letta: d.has('privacy'),
    versione_privacy: VERSIONE_PRIVACY,
  }),
}

/* ---------- Schede ---------- */

function avviaSchede() {
  const tabs = [...document.querySelectorAll('[data-moduli] [role="tab"]')]

  function apri(tab, { fuoco = false } = {}) {
    for (const t of tabs) {
      const attiva = t === tab
      t.setAttribute('aria-selected', attiva)
      t.tabIndex = attiva ? 0 : -1
      document.getElementById(t.getAttribute('aria-controls')).hidden = !attiva
    }
    if (fuoco) tab.focus()
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => apri(tab))
    tab.addEventListener('keydown', (e) => {
      const verso = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
      let nuovo
      if (verso) nuovo = tabs[(i + verso + tabs.length) % tabs.length]
      else if (e.key === 'Home') nuovo = tabs[0]
      else if (e.key === 'End') nuovo = tabs.at(-1)
      else return
      e.preventDefault()
      apri(nuovo, { fuoco: true })
    })
  })

  return (nome) => apri(document.getElementById(`tab-${nome}`))
}

/* ---------- Errori ---------- */

function messaggio(campo) {
  const v = campo.validity
  if (v.valueMissing && campo.dataset.errore) return campo.dataset.errore
  if (v.valueMissing) return campo.tagName === 'SELECT' ? 'Scegli una voce.' : 'Compila questo campo.'
  if (v.typeMismatch) return 'Scrivi un indirizzo email completo, per esempio nome@dominio.it.'
  if (v.tooLong) return 'Il testo è troppo lungo.'
  return campo.validationMessage
}

function mostraErrore(campo, contenitore, testoErrore) {
  let nota = contenitore.querySelector(':scope > .errore')
  if (!testoErrore) {
    nota?.remove()
    campo.removeAttribute('aria-invalid')
    campo.removeAttribute('aria-describedby')
    return
  }
  if (!nota) {
    nota = document.createElement('p')
    nota.className = 'errore'
    nota.id = `errore-${campo.form.dataset.modulo}-${campo.name}`
    contenitore.append(nota)
  }
  nota.textContent = testoErrore
  campo.setAttribute('aria-invalid', 'true')
  campo.setAttribute('aria-describedby', nota.id)
}

const EMAIL_COMPLETA = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/

function controllaCampo(campo) {
  const contenitore = campo.closest('.campo, .spunta')
  if (!contenitore) return true

  campo.setCustomValidity('')
  if (campo.required && campo.type !== 'checkbox' && campo.value && !campo.value.trim()) {
    campo.setCustomValidity('Compila questo campo.')
  } else if (campo.type === 'email' && campo.value && !EMAIL_COMPLETA.test(campo.value.trim())) {
    campo.setCustomValidity('Scrivi un indirizzo email completo, per esempio nome@dominio.it.')
  } else if (campo.type === 'tel' && campo.value && !/^\+?[\d\s().\-/]{6,}$/.test(campo.value.trim())) {
    campo.setCustomValidity('Scrivi solo cifre, per esempio 333 123 4567.')
  }

  const testoErrore = campo.validity.valid ? '' : messaggio(campo)
  mostraErrore(campo, contenitore, testoErrore)
  return !testoErrore
}

function controllaGruppo(gruppo) {
  const caselle = [...gruppo.querySelectorAll('input[type="checkbox"]')]
  const ok = caselle.some((c) => c.checked)
  mostraErrore(caselle[0], gruppo, ok ? '' : gruppo.dataset.almenoUno)
  return ok
}

function controllaOrari(modulo) {
  const { dalle, alle } = modulo.elements
  if (!dalle || !alle) return true
  const dopoMezzanotte = (v) => (v < '06:00' ? `3${v}` : v)
  const ok = dopoMezzanotte(dalle.value) < dopoMezzanotte(alle.value)
  mostraErrore(alle, alle.closest('.campo'), ok ? '' : 'La fine deve venire dopo l’inizio.')
  return ok
}

// Restituisce il primo campo da correggere, nell'ordine della pagina.
function controlla(modulo) {
  const falliti = []
  for (const campo of modulo.querySelectorAll('input, select, textarea')) {
    if (!controllaCampo(campo)) falliti.push(campo)
  }
  for (const gruppo of modulo.querySelectorAll('[data-almeno-uno]')) {
    if (!controllaGruppo(gruppo)) falliti.push(gruppo.querySelector('input'))
  }
  if (!controllaOrari(modulo)) falliti.push(modulo.elements.alle)
  falliti.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
  return falliti[0] ?? null
}

/* ---------- Invio ---------- */

function conferma(modulo, tipo) {
  const riquadro = document.createElement('div')
  riquadro.className = 'ricevuto'
  riquadro.tabIndex = -1
  const titolo = document.createElement('h3')
  titolo.textContent = tipo === 'partner' ? 'Messaggio ricevuto' : 'Registrazione ricevuta'
  const corpo = document.createElement('p')
  corpo.textContent = CONFERME[tipo]
  riquadro.append(titolo, corpo)
  modulo.replaceWith(riquadro)
  riquadro.focus({ preventScroll: true })
  document.getElementById('contatti').scrollIntoView({ block: 'start' })
}

async function invia(modulo) {
  const tipo = modulo.dataset.modulo
  const esito = modulo.querySelector('.modulo__esito')
  const tasto = modulo.querySelector('[type="submit"]')
  esito.textContent = ''

  const primoErrore = controlla(modulo)
  if (primoErrore) {
    primoErrore.focus()
    return
  }

  const dati = new FormData(modulo)
  if (testo(dati, 'sito_web')) return conferma(modulo, tipo) // compilato da un bot

  const testoTasto = tasto.textContent
  tasto.disabled = true
  tasto.textContent = 'Invio in corso'
  try {
    await inserisci(TABELLE[tipo], RIGHE[tipo](dati))
    conferma(modulo, tipo)
  } catch (errore) {
    console.error(errore)
    esito.textContent =
      errore instanceof NonCollegato
        ? 'Il modulo non è collegato. Il messaggio non è stato inviato.'
        : 'Il messaggio non è stato inviato. Controlla la connessione e riprova: quello che hai scritto è ancora qui.'
    tasto.disabled = false
    tasto.textContent = testoTasto
  }
}

/* ---------- Avvio ---------- */

export function avviaModuli({ leggiTabellone }) {
  if (!document.querySelector('[data-moduli]')) return
  const apriScheda = avviaSchede()

  for (const select of document.querySelectorAll('[data-ore-select]')) {
    const inizio = select.dataset.oreSelect === 'inizio'
    const [da, a] = inizio ? [INIZIO_GIORNO, FINE_GIORNO - 1] : [INIZIO_GIORNO + 1, FINE_GIORNO]
    for (let h = da; h <= a; h += 0.5) select.add(new Option(ora(h), ora(h)))
    select.value = ora(inizio ? 18 : 23)
  }

  document.querySelectorAll('[data-apri-modulo]').forEach((link) =>
    link.addEventListener('click', () => apriScheda(link.dataset.apriModulo)),
  )

  // Dal tabellone al modulo: gli orari scelti arrivano già compilati.
  document.querySelector('[data-usa-orari]')?.addEventListener('click', () => {
    const s = leggiTabellone()
    if (!s) return
    const tipo = s.modo === 'lavoro' ? 'lavoro' : 'attivita'
    apriScheda(tipo)
    const campi = document.querySelector(`[data-modulo="${tipo}"]`)?.elements
    if (!campi) return // modulo già inviato

    if (tipo === 'lavoro') {
      campi.dalle.value = ora(s.inizio)
      campi.alle.value = ora(s.fine)
      const valore = s.giorno === 'weekend' ? 'weekend' : 'ultimo_minuto'
      for (const casella of campi.disponibilita) if (casella.value === valore) casella.checked = true
    } else if (!campi.esempio_turno.value || campi.esempio_turno.dataset.auto) {
      const quando = { oggi: 'In giornata', domani: 'Da un giorno all’altro', weekend: 'Nel weekend' }[s.giorno]
      campi.esempio_turno.value = `${quando}, dalle ${ora(s.inizio)} alle ${ora(s.fine)}`
      campi.esempio_turno.dataset.auto = '1'
    }
  })

  for (const modulo of document.querySelectorAll('[data-modulo]')) {
    modulo.addEventListener('submit', (e) => {
      e.preventDefault()
      invia(modulo)
    })
    // Dopo il primo errore, il messaggio sparisce appena il campo è corretto.
    modulo.addEventListener('input', (e) => {
      const campo = e.target
      delete campo.dataset.auto
      const gruppo = campo.closest('[data-almeno-uno]')
      if (gruppo) {
        if (gruppo.querySelector('.errore')) controllaGruppo(gruppo)
      } else if (campo.name === 'dalle' || campo.name === 'alle') {
        controllaOrari(modulo)
      } else if (campo.getAttribute('aria-invalid')) {
        controllaCampo(campo)
      }
    })
    modulo.addEventListener('focusout', (e) => {
      if (e.target.matches?.('input[type="email"]') && e.target.value) controllaCampo(e.target)
    })
  }
}
