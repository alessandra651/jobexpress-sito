// Configurazione pubblica del sito.
// La chiave "publishable" di Supabase è pensata per stare nel browser:
// la protezione dei dati è nelle regole RLS (vedi supabase/migrations).
// Non inserire mai qui la chiave "secret" o "service_role".
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://lpwpigtknyarfiiqocfp.supabase.co'
export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_I9GQBZkvMPSB0NwAa86Z1w_OTO325DD'

// Titolare del trattamento: compilare prima di pubblicare il sito.
export const TITOLARE = {
  nome: 'Alessandra Mihai',
  email: 'alessandramihai59@gmail.com',
}

// Cambiare a ogni modifica sostanziale di privacy.html.
// Viene salvata insieme a ogni contatto.
export const VERSIONE_PRIVACY = '2026-11-25'

export const COMMISSIONE = 0.12
export const IVA = 0.22

// Funzioni pronte ma non ancora mostrate sul sito.
// Per lanciarne una basta cambiare false in true.
export const FUNZIONI = {
  // Livelli, badge e Professional Passport (src/reputazione.js): aggiornamento futuro
  reputazione: false,
}
