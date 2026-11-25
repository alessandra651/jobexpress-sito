// Segnalazioni di annunci, persone e recensioni, gestite poi dall'area Admin.
// In questa versione di prova restano su questo dispositivo.
const CHIAVE = 'jobexpress-segnalazioni'
const leggi = () => { try { return JSON.parse(localStorage.getItem(CHIAVE) || '[]') } catch { return [] } }
const scrivi = (l) => { try { localStorage.setItem(CHIAVE, JSON.stringify(l)) } catch { /* non disponibile */ } }

export const MOTIVI = ['Informazioni false o ingannevoli', 'Compenso non corretto', 'Comportamento scorretto', 'Spam o pubblicità', 'Attività non consentita', 'Altro']

export function segnala({ tipo, riferimento, titolo, motivo = 'Altro', nota = '' }) {
  const l = leggi()
  l.unshift({ id: `s-${Date.now()}`, tipo, riferimento: String(riferimento), titolo, motivo, nota: nota.slice(0, 500), stato: 'aperta', il: Date.now() })
  scrivi(l)
}
export const segnalazioni = leggi
export function aggiornaSegnalazione(id, stato) {
  const l = leggi()
  const s = l.find((x) => x.id === id)
  if (s) { s.stato = stato; s.chiusa = Date.now() }
  scrivi(l)
  return s
}
