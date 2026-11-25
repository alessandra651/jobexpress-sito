import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import '@fontsource-variable/mona-sans/wdth.css'
import './stile.css'
import './design2026.css'
import './design2026.js'
import { avviaCalcolo } from './calcolo.js'
import { TITOLARE } from './config.js'
import { avviaModuli } from './moduli.js'
import { avviaTabellone } from './tabellone.js'
import { avviaPrezzi } from './prezzi.js'
import { impostaFascia } from './incarichi.js'

new Lenis({
  autoRaf: true,
  anchors: true,
  allowNestedScroll: true,
  stopInertiaOnNavigate: true,
})

// Menu su schermi piccoli
const menuTasto = document.querySelector('.menu-tasto')
const menu = document.querySelector('.menu')
const apriMenu = (aperto) => {
  menuTasto?.setAttribute('aria-expanded', aperto)
  menu?.classList.toggle('menu--aperto', aperto)
}
menuTasto?.addEventListener('click', () => apriMenu(menuTasto.getAttribute('aria-expanded') !== 'true'))
menu?.addEventListener('click', (e) => e.target.closest('a') && apriMenu(false))
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menuTasto?.getAttribute('aria-expanded') === 'true') {
    apriMenu(false)
    menuTasto.focus()
  }
})

// Dati del titolare nell'informativa privacy
for (const el of document.querySelectorAll('[data-titolare]')) {
  const valore = TITOLARE[el.dataset.titolare]
  if (valore) {
    el.textContent = valore
    el.classList.remove('da-completare')
  }
}

const tabellone = avviaTabellone()
impostaFascia(() => tabellone?.leggi())
avviaCalcolo()
avviaPrezzi()
avviaModuli({ leggiTabellone: () => tabellone?.leggi() })
