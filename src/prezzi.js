// Interruttore Mensile / Annuale nella sezione "Quanto costa".
// I prezzi sono qui, in un posto solo, così si cambiano facilmente.
const PREZZI = {
  mese: {
    plus: ['4,99 €', '/mese'],
    plusNota: 'Si rinnova ogni mese, disdici quando vuoi',
    friends: ['9,99 €', '/mese in tre'],
    friendsNota: 'Un solo abbonamento, si rinnova ogni mese',
    testa: ['3,33 €', 'a testa al mese'],
    conto: 'Tre Plus costerebbero 14,97 €. Con Friends risparmiate 4,98 € al mese, circa il 33%.',
  },
  anno: {
    plus: ['39,99 €', '/anno'],
    plusNota: 'Circa 3,33 € al mese. Risparmi 19,89 € rispetto al mensile (circa il 33%)',
    friends: ['79,99 €', '/anno in tre'],
    friendsNota: 'Addebito unico di 79,99 € l’anno. Risparmiate 39,89 € rispetto al mensile',
    testa: ['2,22 €', 'a testa al mese, con il piano annuale'],
    conto: 'Tre Plus annuali costerebbero 119,97 €. Con Friends annuale pagate 79,99 € in tutto: risparmiate 39,98 €.',
  },
}

export function avviaPrezzi() {
  const tasti = document.querySelectorAll('[data-periodo]')
  if (!tasti.length) return
  const metti = (periodo) => {
    const p = PREZZI[periodo]
    tasti.forEach((t) => t.setAttribute('aria-pressed', t.dataset.periodo === periodo))
    document.querySelectorAll('[data-prezzo]').forEach((el) => {
      const [cifra, dopo] = p[el.dataset.prezzo]
      el.classList.add('cambia')
      setTimeout(() => {
        el.textContent = cifra + ' '
        const piccolo = document.createElement('small')
        piccolo.textContent = dopo
        el.append(piccolo)
        el.classList.remove('cambia')
      }, 160)
    })
    document.querySelectorAll('[data-nota]').forEach((el) => {
      el.textContent = p[el.dataset.nota + 'Nota'] ?? p[el.dataset.nota]
    })
  }
  tasti.forEach((t) => t.addEventListener('click', () => metti(t.dataset.periodo)))
}
