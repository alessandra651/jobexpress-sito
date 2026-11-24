import { INCARICHI, PERSONE } from './esempi.js'
import { INIZIO_GIORNO as A, FINE_GIORNO as B, limita, ora } from './ore.js'

const PASSO = 0.5
const MINIMO = 1
const NOME_GIORNO = { oggi: 'oggi', domani: 'domani', weekend: 'nel weekend' }

export function avviaTabellone() {
  const radice = document.querySelector('[data-tabellone]')
  if (!radice) return null

  const q = (s) => radice.querySelector(s)
  const griglia = q('[data-griglia]')
  const fascia = q('[data-fascia]')
  const lista = q('[data-turni]')
  const maniglie = {
    inizio: q('[data-maniglia="inizio"]'),
    fine: q('[data-maniglia="fine"]'),
  }

  const stato = { modo: 'lavoro', giorno: 'oggi', inizio: 18, fine: 23 }
  const perc = (h) => ((h - A) / (B - A)) * 100

  // Asse delle ore
  for (let h = A; h <= B; h += 1) {
    const linea = document.createElement('i')
    linea.style.left = `${perc(h)}%`
    if (h % 2) linea.className = 'dispari'
    q('[data-linee]').append(linea)
    if (h % 2 === 0) {
      const testo = document.createElement('span')
      testo.style.left = `${perc(h)}%`
      if ((h - A) % 4) testo.className = 'secondaria'
      testo.textContent = String(h % 24).padStart(2, '0')
      q('[data-ore]').append(testo)
    }
  }

  const righe = () => (stato.modo === 'lavoro' ? INCARICHI : PERSONE)[stato.giorno]

  // Lavoro: l'incarico deve stare dentro la fascia.
  // Personale: la disponibilità deve coprire tutta la fascia.
  const combacia = ([, , i, f]) =>
    stato.modo === 'lavoro' ? i >= stato.inizio && f <= stato.fine : i <= stato.inizio && f >= stato.fine

  function disegnaRighe() {
    lista.replaceChildren(
      ...righe().map(([nome, dettaglio, i, f]) => {
        const li = document.createElement('li')
        li.className = 'turno'
        li.style.setProperty('--da', `${perc(i)}%`)
        li.style.setProperty('--largo', `${perc(f) - perc(i)}%`)
        // La larghezza del carattere segue la durata del turno.
        li.style.setProperty('--wdth', `${Math.round(limita(72 + (f - i) * 5.5, 80, 118))}%`)
        if ((i + f) / 2 > (A + B) / 2) li.classList.add('turno--destra')

        const barra = document.createElement('span')
        barra.className = 'turno__barra'
        const testo = document.createElement('span')
        testo.className = 'turno__testo'
        const forte = document.createElement('b')
        forte.textContent = nome
        const orario = document.createElement('span')
        orario.className = 'solo-lettori'
        orario.textContent = ` dalle ${ora(i)} alle ${ora(f)}`
        testo.append(forte, `, ${dettaglio}`, orario)
        li.append(barra, testo)
        return li
      }),
    )
  }

  function aggiorna() {
    const { modo, giorno, inizio, fine } = stato
    radice.dataset.modo = modo
    fascia.style.setProperty('--da', `${perc(inizio)}%`)
    fascia.style.setProperty('--largo', `${perc(fine) - perc(inizio)}%`)

    for (const [lato, el] of Object.entries(maniglie)) {
      el.dataset.ora = ora(stato[lato])
      el.setAttribute('aria-valuenow', stato[lato])
      el.setAttribute('aria-valuetext', ora(stato[lato]))
    }
    maniglie.inizio.setAttribute('aria-valuemax', fine - MINIMO)
    maniglie.fine.setAttribute('aria-valuemin', inizio + MINIMO)

    // Vicino ai margini l'etichetta dell'ora entra nella fascia.
    const largo = griglia.clientWidth
    maniglie.inizio.classList.toggle('dentro', (largo * perc(inizio)) / 100 < 52)
    maniglie.fine.classList.toggle('dentro', (largo * (100 - perc(fine))) / 100 < 52)

    const soggetto = modo === 'lavoro' ? 'Posso lavorare' : 'Mi serve una persona'
    q('[data-frase]').textContent = `${soggetto} ${NOME_GIORNO[giorno]} dalle ${ora(inizio)} alle ${ora(fine)}.`

    let n = 0
    righe().forEach((r, idx) => {
      const ok = combacia(r)
      if (ok) n += 1
      lista.children[idx]?.classList.toggle('turno--ok', ok)
    })

    const tot = righe().length
    let testo
    if (modo === 'lavoro') {
      if (n === 0) testo = 'Nessun turno rientra nei tuoi orari. Prova ad allargare la fascia.'
      else if (n === 1) testo = `1 turno su ${tot} rientra nei tuoi orari.`
      else testo = `${n} turni su ${tot} rientrano nei tuoi orari.`
    } else {
      if (n === 0) testo = 'Nessuno copre tutto il turno. Prova a stringere la fascia.'
      else if (n === 1) testo = `1 persona su ${tot} copre tutto il turno.`
      else testo = `${n} persone su ${tot} coprono tutto il turno.`
    }
    const conto = q('[data-conto]')
    if (conto.textContent !== testo) conto.textContent = testo
  }

  const premi = (attr, valore) =>
    radice.querySelectorAll(`[${attr}]`).forEach((b) => b.setAttribute('aria-pressed', b.getAttribute(attr) === valore))

  function collegaScelta(attr, chiave) {
    radice.querySelectorAll(`[${attr}]`).forEach((b) =>
      b.addEventListener('click', () => {
        fermaIngresso()
        stato[chiave] = b.getAttribute(attr)
        premi(attr, stato[chiave])
        disegnaRighe()
        aggiorna()
      }),
    )
  }
  collegaScelta('data-modo-tasto', 'modo')
  collegaScelta('data-giorno-tasto', 'giorno')

  function imposta(lato, valore) {
    const v = Math.round(valore / PASSO) * PASSO
    if (lato === 'inizio') stato.inizio = limita(v, A, stato.fine - MINIMO)
    else stato.fine = limita(v, stato.inizio + MINIMO, B)
    aggiorna()
  }

  // Trascinamento: bordi (maniglie) oppure tutta la fascia.
  griglia.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    const maniglia = e.target.closest('[data-maniglia]')
    if (!maniglia && !e.target.closest('[data-fascia]')) return
    fermaIngresso()

    const larghezza = griglia.clientWidth
    const x0 = e.clientX
    const prima = { inizio: stato.inizio, fine: stato.fine }
    const durata = prima.fine - prima.inizio
    griglia.setPointerCapture(e.pointerId)
    radice.classList.add('in-trascinamento')
    if (maniglia) maniglia.focus({ preventScroll: true })

    const muovi = (ev) => {
      const d = ((ev.clientX - x0) / larghezza) * (B - A)
      if (maniglia) {
        const lato = maniglia.dataset.maniglia
        imposta(lato, prima[lato] + d)
      } else {
        stato.inizio = limita(Math.round((prima.inizio + d) / PASSO) * PASSO, A, B - durata)
        stato.fine = stato.inizio + durata
        aggiorna()
      }
    }
    const smetti = () => {
      radice.classList.remove('in-trascinamento')
      griglia.removeEventListener('pointermove', muovi)
      griglia.removeEventListener('pointerup', smetti)
      griglia.removeEventListener('pointercancel', smetti)
    }
    griglia.addEventListener('pointermove', muovi)
    griglia.addEventListener('pointerup', smetti)
    griglia.addEventListener('pointercancel', smetti)
  })

  for (const [lato, el] of Object.entries(maniglie)) {
    el.addEventListener('keydown', (e) => {
      const salto = { ArrowRight: PASSO, ArrowUp: PASSO, ArrowLeft: -PASSO, ArrowDown: -PASSO, PageUp: 2, PageDown: -2 }
      if (!(e.key in salto) && e.key !== 'Home' && e.key !== 'End') return
      e.preventDefault()
      fermaIngresso()
      if (e.key === 'Home') imposta(lato, A)
      else if (e.key === 'End') imposta(lato, B)
      else imposta(lato, stato[lato] + salto[e.key])
    })
  }

  // Unico movimento automatico della pagina: la fascia si apre da sola.
  let fotogramma = 0
  let inIngresso = false
  function fermaIngresso() {
    if (!inIngresso) return
    inIngresso = false
    cancelAnimationFrame(fotogramma)
    stato.fine = 23
    aggiorna()
  }
  function ingresso() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden) return
    inIngresso = true
    const t0 = performance.now() + 450
    stato.fine = stato.inizio + MINIMO
    aggiorna()
    const passo = (t) => {
      const p = limita((t - t0) / 1300, 0, 1)
      if (p === 1) return fermaIngresso()
      const fine = 19 + 4 * (1 - (1 - p) ** 3)
      const scatto = Math.floor(fine / PASSO) * PASSO
      if (scatto !== stato.fine) {
        stato.fine = scatto
        aggiorna()
      }
      fascia.style.setProperty('--largo', `${perc(fine) - perc(stato.inizio)}%`)
      fotogramma = requestAnimationFrame(passo)
    }
    fotogramma = requestAnimationFrame(passo)
  }

  disegnaRighe()
  aggiorna()
  ingresso()
  new ResizeObserver(() => aggiorna()).observe(griglia)

  return { leggi: () => ({ ...stato }) }
}
