export const INIZIO_GIORNO = 6
export const FINE_GIORNO = 26 // le 02:00 del giorno dopo

export function ora(valore) {
  const h = Math.floor(valore) % 24
  const m = Math.round((valore % 1) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export const limita = (v, min, max) => Math.min(max, Math.max(min, v))
