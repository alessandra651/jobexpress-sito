// Account JobExpress con Supabase Auth, via API REST (nessuna libreria in più).
// La sessione resta nel browser. I dati del profilo sono nella tabella "profili",
// protetta da RLS: ognuno vede e modifica solo il proprio.
//
// Modalità prova: se Supabase non è raggiungibile (per esempio nell'anteprima),
// l'utente può scegliere un account simulato che resta solo su questo dispositivo.
import { SUPABASE_KEY, SUPABASE_URL, VERSIONE_PRIVACY } from './config.js'

// Accesso con Google/Apple: aggiungere 'google' e/o 'apple' DOPO averli attivati
// nel pannello Supabase (Authentication > Sign In / Providers).
export const PROVIDER_ATTIVI = []

const CHIAVE_SESSIONE = 'jobexpress-sessione'
const CHIAVE_PROVA = 'jobexpress-account-prova'

export class SenzaRete extends Error {}

let sessione = null
let profilo = null
let prova = null
const ascoltatori = []
let recuperoPassword = false
export const inRecupero = () => recuperoPassword

const memoria = {
  leggi: (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } },
  scrivi: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)) } catch { /* non disponibile */ } },
}

const avvisa = () => ascoltatori.forEach((f) => f(utente()))
export const quandoCambiaUtente = (f) => ascoltatori.push(f)

// Chi è collegato adesso (o null)
export function utente() {
  if (prova) return { ...prova, prova: true }
  if (!sessione) return null
  return {
    id: sessione.user?.id,
    email: sessione.user?.email,
    nome: profilo?.nome ?? sessione.user?.user_metadata?.nome ?? '',
    citta: profilo?.citta ?? '',
    modalita: profilo?.modalita ?? [],
    automunito: profilo?.automunito ?? false,
    maggiorenne: profilo?.maggiorenne ?? false,
    prova: false,
  }
}

// ---------- chiamate a Supabase ----------
const tornaQui = () => `${location.origin}${location.pathname}`

async function chiama(percorso, { metodo = 'POST', corpo, token, prefer } = {}) {
  let risposta
  try {
    risposta = await fetch(`${SUPABASE_URL}${percorso}`, {
      method: metodo,
      headers: {
        apikey: SUPABASE_KEY,
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(prefer ? { Prefer: prefer } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    throw new SenzaRete('Supabase non raggiungibile')
  }
  const testo = await risposta.text()
  const dati = testo ? JSON.parse(testo) : null
  if (!risposta.ok) throw new Error(traduci(dati, risposta.status))
  return dati
}

function traduci(d, stato) {
  const codice = d?.error_code || d?.code || d?.error || ''
  const msg = String(d?.msg || d?.message || d?.error_description || '').toLowerCase()
  if (codice === 'invalid_credentials' || msg.includes('invalid login')) return 'Email o password non corretti.'
  if (codice === 'email_not_confirmed' || msg.includes('not confirmed')) return 'Devi prima confermare l’email: apri il link che ti abbiamo mandato.'
  if (codice === 'user_already_exists' || msg.includes('already registered')) return 'Esiste già un account con questa email. Prova ad accedere.'
  if (codice === 'weak_password' || msg.includes('password should')) return 'La password è troppo debole: usa almeno 8 caratteri, con lettere e numeri.'
  if (codice.includes('rate_limit') || stato === 429) return 'Troppi tentativi o troppe email inviate. Riprova tra qualche minuto.'
  if (codice === 'email_address_invalid' || msg.includes('invalid format')) return 'Questa email non sembra valida.'
  if (codice === 'same_password') return 'La nuova password deve essere diversa da quella vecchia.'
  if (stato === 401 || stato === 403) return 'La sessione è scaduta: accedi di nuovo.'
  return 'Qualcosa non ha funzionato. Riprova tra poco.'
}

function salvaSessione(d) {
  if (!d?.access_token) return
  sessione = {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: d.expires_at || Math.floor(Date.now() / 1000) + Number(d.expires_in || 3600),
    user: d.user || sessione?.user,
  }
  memoria.scrivi(CHIAVE_SESSIONE, sessione)
}

async function token() {
  if (!sessione) return null
  if (sessione.expires_at - 60 < Date.now() / 1000) {
    try {
      salvaSessione(await chiama('/auth/v1/token?grant_type=refresh_token', { corpo: { refresh_token: sessione.refresh_token } }))
    } catch (e) {
      if (!(e instanceof SenzaRete)) esciLocale()
      throw e
    }
  }
  return sessione?.access_token
}

// Token valido (rinnovato se serve), per le chiamate protette come l'area Admin
export const tokenValido = () => token()

async function caricaProfilo() {
  if (!sessione) return
  const righe = await chiama(`/rest/v1/profili?select=*&id=eq.${sessione.user.id}`, { metodo: 'GET', token: await token() })
  profilo = righe?.[0] || null
}

function esciLocale() {
  sessione = null
  profilo = null
  memoria.scrivi(CHIAVE_SESSIONE, null)
}

// ---------- azioni ----------
export async function registra({ email, password, nome, citta, modalita, automunito, maggiorenne, termini }) {
  const d = await chiama(`/auth/v1/signup?redirect_to=${encodeURIComponent(tornaQui())}`, {
    corpo: {
      email, password,
      data: { nome, citta, modalita, automunito, maggiorenne, termini, versione_privacy: VERSIONE_PRIVACY },
    },
  })
  if (d?.access_token) {
    salvaSessione(d)
    await caricaProfilo().catch(() => {})
    avvisa()
    return { confermaEmail: false }
  }
  return { confermaEmail: true }
}

export async function accedi(email, password) {
  salvaSessione(await chiama('/auth/v1/token?grant_type=password', { corpo: { email, password } }))
  await caricaProfilo().catch(() => {})
  avvisa()
}

export const recupera = (email) => chiama(`/auth/v1/recover?redirect_to=${encodeURIComponent(tornaQui())}`, { corpo: { email } })

export async function nuovaPassword(password) {
  await chiama('/auth/v1/user', { metodo: 'PUT', corpo: { password }, token: await token() })
  recuperoPassword = false
}

export function conProvider(provider) {
  location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(tornaQui())}`
}

export async function esci() {
  if (prova) {
    prova = null
    memoria.scrivi(CHIAVE_PROVA, null)
  } else if (sessione) {
    try { await chiama('/auth/v1/logout', { token: sessione.access_token }) } catch { /* si esce comunque */ }
    esciLocale()
  }
  avvisa()
}

export async function salvaProfilo(campi) {
  if (prova) {
    prova = { ...prova, ...campi }
    memoria.scrivi(CHIAVE_PROVA, prova)
    return avvisa()
  }
  const righe = await chiama(`/rest/v1/profili?id=eq.${sessione.user.id}`, {
    metodo: 'PATCH', corpo: campi, token: await token(), prefer: 'return=representation',
  })
  profilo = righe?.[0] || profilo
  avvisa()
}

export async function eliminaAccount() {
  if (prova) return esci()
  await chiama('/rest/v1/rpc/elimina_mio_account', { corpo: {}, token: await token() })
  esciLocale()
  avvisa()
}

// Account simulato, solo su questo dispositivo
export function entraInProva(dati) {
  prova = { id: 'prova', email: dati.email || 'prova@jobexpress.test', nome: dati.nome || 'Ospite', citta: dati.citta || 'Forlì',
    modalita: dati.modalita?.length ? dati.modalita : ['lavoro'], automunito: !!dati.automunito, maggiorenne: true }
  memoria.scrivi(CHIAVE_PROVA, prova)
  avvisa()
}

// ---------- avvio ----------
export async function avviaAuth() {
  let entrato = false
  prova = memoria.leggi(CHIAVE_PROVA)
  sessione = memoria.leggi(CHIAVE_SESSIONE)
  // Ritorno da un link email (conferma, recupero password) o da Google/Apple
  if (location.hash.includes('access_token=') || location.hash.includes('error_description=')) {
    const p = new URLSearchParams(location.hash.slice(1))
    history.replaceState(null, '', location.pathname + location.search)
    if (p.get('access_token')) {
      salvaSessione({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: p.get('expires_in'), expires_at: Number(p.get('expires_at')) || undefined })
      try {
        sessione.user = await chiama('/auth/v1/user', { metodo: 'GET', token: sessione.access_token })
        memoria.scrivi(CHIAVE_SESSIONE, sessione)
      } catch { esciLocale() }
      recuperoPassword = p.get('type') === 'recovery'
      entrato = !!sessione && !recuperoPassword
    }
  }
  if (sessione) {
    try { await caricaProfilo() } catch { /* senza rete si resta collegati con i dati salvati */ }
  }
  avvisa()
  return entrato
}
