// Interruttore Mensile / Annuale nella sezione "Abbonamenti".
// I prezzi arrivano dalle regole della piattaforma (area Admin → tabella "impostazioni"),
// così si cambiano senza toccare il codice. Qui si calcolano solo i testi.
import { impostazioni, quandoCambianoImpostazioni } from './regole.js'

const eur = (n) => `${n.toFixed(2).replace('.', ',')} €`
const perc = (risparmio, intero) => Math.round((risparmio / intero) * 100)

function testi(periodo) {
  const { plus, friends } = impostazioni().prezzi
  if (periodo === 'mese') {
    const tre = plus.mese * 3
    return {
      plus: [eur(plus.mese), '/mese'],
      plusNota: 'Si rinnova ogni mese, disdici quando vuoi',
      friends: [eur(friends.mese), '/mese in tre'],
      friendsNota: 'Un solo abbonamento, si rinnova ogni mese',
      testa: [eur(friends.mese / 3), 'a testa al mese'],
      conto: `Tre Plus costerebbero ${eur(tre)}. Con Friends risparmiate ${eur(tre - friends.mese)} al mese, circa il ${perc(tre - friends.mese, tre)}%.`,
    }
  }
  const tre = plus.anno * 3
  return {
    plus: [eur(plus.anno), '/anno'],
    plusNota: `Circa ${eur(plus.anno / 12)} al mese. Risparmi ${eur(plus.mese * 12 - plus.anno)} rispetto al mensile (circa il ${perc(plus.mese * 12 - plus.anno, plus.mese * 12)}%)`,
    friends: [eur(friends.anno), '/anno in tre'],
    friendsNota: `Addebito unico di ${eur(friends.anno)} l’anno. Risparmiate ${eur(friends.mese * 12 - friends.anno)} rispetto al mensile`,
    testa: [eur(friends.anno / 36), 'a testa al mese, con il piano annuale'],
    conto: `Tre Plus annuali costerebbero ${eur(tre)}. Con Friends annuale pagate ${eur(friends.anno)} in tutto: risparmiate ${eur(tre - friends.anno)}.`,
  }
}

// Funzioni Plus già pronte nel sito: le altre mostrano «in arrivo»
export const FUNZIONI_PRONTE = ['goal', 'cv', 'career', 'smart_calendar', 'ai']

export function avviaPrezzi() {
  const tasti = document.querySelectorAll('[data-periodo]')
  if (!tasti.length) return
  let attuale = 'mese'
  const metti = (periodo, anima = true) => {
    attuale = periodo
    const p = testi(periodo)
    tasti.forEach((t) => t.setAttribute('aria-pressed', t.dataset.periodo === periodo))
    document.querySelectorAll('[data-prezzo]').forEach((el) => {
      const [cifra, dopo] = p[el.dataset.prezzo]
      if (anima) el.classList.add('cambia')
      setTimeout(() => {
        el.textContent = cifra + ' '
        const piccolo = document.createElement('small')
        piccolo.textContent = dopo
        el.append(piccolo)
        el.classList.remove('cambia')
      }, anima ? 160 : 0)
    })
    document.querySelectorAll('[data-nota]').forEach((el) => {
      el.textContent = p[el.dataset.nota + 'Nota'] ?? p[el.dataset.nota]
    })
  }
  const funzioni = () => {
    const imp = impostazioni()
    document.querySelectorAll('[data-ai-richieste]').forEach((el) => { el.textContent = imp.ai_richieste_mensili })
    document.querySelectorAll('[data-funzione]').forEach((li) => {
      const k = li.dataset.funzione
      li.querySelector('.in-arrivo')?.remove()
      if (!FUNZIONI_PRONTE.includes(k) || imp.funzioni_premium?.[k] === false) li.insertAdjacentHTML('beforeend', ' <small class="in-arrivo">in arrivo</small>')
    })
  }
  tasti.forEach((t) => t.addEventListener('click', () => metti(t.dataset.periodo)))
  quandoCambianoImpostazioni(() => { metti(attuale, false); funzioni() })
  metti('mese', false)
  funzioni()
}
