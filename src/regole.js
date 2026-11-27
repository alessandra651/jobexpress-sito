// Regole di candidatura e assegnazione: sono le STESSE che il database applica
// (supabase/migrations/20261127120000_candidature_proposte_incarichi.sql).
// Qui servono per mostrare subito gli avvisi giusti; per gli annunci veri
// la decisione finale la prende sempre il database, non il sito.
import { SUPABASE_KEY, SUPABASE_URL } from './config.js'

export const PREDEFINITE = {
  free_monthly_job_limit_enabled: false, // SPENTO per gli account veri finché non c'è la verifica legale
  free_monthly_job_limit_demo: true, // nel prototipo (account di prova) il limite si vede e si applica
  free_monthly_job_limit: 2,
  max_candidature_sovrapposte: 3,
  tempi_conferma: [
    { meno_di_minuti: 60, minuti: 5 },
    { meno_di_minuti: 180, minuti: 10 },
    { meno_di_minuti: 1440, minuti: 30 },
    { meno_di_minuti: null, minuti: 120 },
  ],
  margine_spostamenti_minuti: 30,
  ai_richieste_mensili: 20,
  prezzi: { plus: { mese: 4.99, anno: 39.99 }, friends: { mese: 9.99, anno: 79.99 } },
  prova_gratuita: { attiva: false, giorni: 7 },
  promozione: { attiva: false, fine: null },
  funzioni_premium: { goal: true, cv: true, career: true, smart_calendar: true, ai: false },
  annullamenti_lavoratore_contano: true,
}

let imp = structuredClone(PREDEFINITE)
let scarto = 0 // differenza tra l'orologio del server e quello del telefono (ms)
let dalServer = false
const ascoltatori = []

export const impostazioni = () => imp
// Il limite Free vale nel prototipo (account di prova) se acceso per la demo,
// e per gli account veri solo con l'interruttore di produzione.
export const limiteFreeAttivo = (prova = true) => imp.free_monthly_job_limit_enabled === true || (prova && imp.free_monthly_job_limit_demo === true)
export const impostazioniDalServer = () => dalServer
export const quandoCambianoImpostazioni = (f) => ascoltatori.push(f)
// Ora "vera" del server: il conto alla rovescia non dipende dall'orologio del telefono
export const adesso = () => Date.now() + scarto

export async function caricaImpostazioni() {
  if (!SUPABASE_KEY) return imp
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/impostazioni?select=chiave,valore`, {
      headers: { apikey: SUPABASE_KEY }, signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) return imp
    const data = r.headers.get('date')
    if (data) scarto = new Date(data).getTime() - Date.now()
    for (const { chiave, valore } of await r.json()) if (chiave in PREDEFINITE) imp[chiave] = valore
    dalServer = true
    ascoltatori.forEach((f) => f(imp))
  } catch { /* senza rete restano le regole predefinite */ }
  return imp
}

// ---------- intervalli ----------
// Un intervallo è { inizio, fine } in millisecondi. I turni notturni hanno fine il giorno dopo.
export const sovrappone = (a, b) => a.inizio < b.fine && b.inizio < a.fine

// Picco di candidature attive insieme, aggiungendo i turni "nuovi".
// esistenti: [{ id, inizio, fine }] (una candidatura può avere più turni: stesso id).
// Conta istante per istante le candidature DIVERSE: non basta "si sovrappone a qualcosa".
export function picco(nuovi, esistenti) {
  let max = 0
  let conflitti = []
  for (const n of nuovi) {
    const punti = [n.inizio, ...esistenti.filter((e) => e.inizio > n.inizio && e.inizio < n.fine).map((e) => e.inizio)]
    for (const p of punti) {
      const ids = [...new Set(esistenti.filter((e) => e.inizio <= p && e.fine > p).map((e) => e.id))]
      if (ids.length > max) { max = ids.length; conflitti = ids }
      else if (ids.length === max) conflitti = [...new Set([...conflitti, ...ids])]
    }
  }
  return { picco: max, conflitti }
}

// Si può aggiungere una candidatura con questi turni?
export function puoCandidarsi(nuovi, esistenti) {
  const { picco: p, conflitti } = picco(nuovi, esistenti)
  const limite = Number(imp.max_candidature_sovrapposte) || 3
  return { ok: p + 1 <= limite, limite, conflitti }
}

// Minuti per confermare una proposta, in base a quanto manca all'inizio
export function minutiConferma(minutiMancanti) {
  for (const r of imp.tempi_conferma || PREDEFINITE.tempi_conferma) {
    if (r.meno_di_minuti == null || minutiMancanti < r.meno_di_minuti) return Number(r.minuti)
  }
  return 120
}

// Scadenza di una proposta: mai oltre l'inizio dell'incarico
export function scadenzaProposta(inizioMs, ora = adesso()) {
  const min = minutiConferma((inizioMs - ora) / 60000)
  return Math.min(ora + min * 60000, inizioMs)
}

// Incarichi confermati troppo vicini (meno del margine) ma che non si sovrappongono
export function avvisiSpostamenti(nuovi, confermati) {
  const margine = Number(imp.margine_spostamenti_minuti ?? 30) * 60000
  const fuori = []
  for (const c of confermati) {
    for (const n of nuovi) {
      if (sovrappone(n, c)) continue
      const pausa = Math.max(n.inizio - c.fine, c.inizio - n.fine)
      if (pausa < margine) fuori.push({ ...c, minuti: Math.floor(pausa / 60000) })
    }
  }
  return fuori
}

// Mese di conteggio (Europe/Rome) di un incarico: quello del primo turno
const fmtMese = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit' })
export const meseDi = (ms) => fmtMese.format(new Date(ms))

// Testo del conto alla rovescia (es. «9:41» o «1 h 05 min»)
export function restante(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m}:${String(sec).padStart(2, '0')}`
}
