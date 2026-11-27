// Collegamenti a Google Maps e Apple Mappe.
// Si aprono nell'app di mappe del telefono (o nel browser), senza chiavi o account.
// Prima della conferma si mostra solo la ZONA; l'indirizzo preciso solo a chi ha l'incarico confermato.
const enc = (s) => encodeURIComponent(String(s || '').trim())
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export const urlGoogle = (q, percorso = false) => percorso
  ? `https://www.google.com/maps/dir/?api=1&destination=${enc(q)}`
  : `https://www.google.com/maps/search/?api=1&query=${enc(q)}`
export const urlApple = (q, percorso = false) => percorso
  ? `https://maps.apple.com/?daddr=${enc(q)}&dirflg=d`
  : `https://maps.apple.com/?q=${enc(q)}`

const PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6.1-6.5-11A6.5 6.5 0 0 1 18.5 10c0 4.9-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>'

// Pulsanti «Google Maps» e «Apple Mappe»
export function pulsantiMappe(luogo, { percorso = false, etichetta = '' } = {}) {
  if (!String(luogo || '').trim()) return ''
  return `<span class="mappe-link">${etichetta ? `<span class="mappe-link__testo">${esc(etichetta)}</span>` : ''}
    <a class="mappe-link__a" href="${esc(urlGoogle(luogo, percorso))}" target="_blank" rel="noopener">${PIN}Google Maps</a>
    <a class="mappe-link__a" href="${esc(urlApple(luogo, percorso))}" target="_blank" rel="noopener">${PIN}Apple Mappe</a></span>`
}
