import { COMMISSIONE, IVA } from './config.js'

const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const euroTondo = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const centesimi = (n) => Math.round((n + Number.EPSILON) * 100) / 100

export function avviaCalcolo() {
  const radice = document.querySelector('[data-calcolo]')
  if (!radice) return
  const cursore = radice.querySelector('input[type="range"]')
  const scrivi = (nome, testo) => {
    radice.querySelector(`[data-c-${nome}]`).textContent = testo
  }

  function aggiorna() {
    const compenso = Number(cursore.value)
    const commissione = centesimi(compenso * COMMISSIONE)
    const iva = centesimi(commissione * IVA)
    scrivi('compenso', euroTondo.format(compenso))
    scrivi('lavoro', euro.format(compenso))
    scrivi('commissione', euro.format(commissione))
    scrivi('iva', euro.format(iva))
    scrivi('totale', euro.format(centesimi(commissione + iva)))
    cursore.setAttribute('aria-valuetext', euroTondo.format(compenso))
    const { min, max } = cursore
    cursore.style.setProperty('--pieno', `${((compenso - min) / (max - min)) * 100}%`)
    // Le tre parti della barra sono in proporzione reale fra loro
    // e la barra si allunga con il compenso.
    radice.style.setProperty('--scala', compenso / max)
  }
  cursore.addEventListener('input', aggiorna)
  aggiorna()
}
