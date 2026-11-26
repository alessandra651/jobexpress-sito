// Service worker di JobExpress: rende il sito installabile e utilizzabile
// anche con una connessione debole.
// Regole: si salvano solo i file pubblici del sito (pagine, stili, script, icone).
// Mai i dati personali: le chiamate a Supabase e agli altri siti non passano da qui.
const VERSIONE = 'jobexpress-2026-11-26'
const BASE = ['./offline.html', './manifest.webmanifest', './icona-192.png', './icona-512.png', './favicon.svg']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSIONE).then((c) => c.addAll(BASE)))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((chiavi) => Promise.all(chiavi.filter((k) => k !== VERSIONE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

// Quando c'è una versione nuova, la pagina chiede di attivarla subito
self.addEventListener('message', (e) => {
  if (e.data === 'aggiorna') self.skipWaiting()
})

self.addEventListener('fetch', (e) => {
  const r = e.request
  const url = new URL(r.url)
  if (r.method !== 'GET' || url.origin !== self.location.origin) return

  // Pagine: prima la rete (contenuti sempre aggiornati), se manca la rete la copia salvata
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r)
        .then((risposta) => {
          const copia = risposta.clone()
          caches.open(VERSIONE).then((c) => c.put(r, copia))
          return risposta
        })
        .catch(() => caches.match(r).then((salvata) => salvata || caches.match('./offline.html'))),
    )
    return
  }

  // File del sito (stili, script, icone): subito dalla copia salvata, intanto si aggiorna
  e.respondWith(
    caches.match(r).then((salvata) => {
      const daRete = fetch(r)
        .then((risposta) => {
          if (risposta.ok) caches.open(VERSIONE).then((c) => c.put(r, risposta.clone()))
          return risposta
        })
        .catch(() => salvata)
      return salvata || daRete
    }),
  )
})
