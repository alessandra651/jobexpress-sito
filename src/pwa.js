// JobExpress come app sul telefono (PWA): installazione, aggiornamenti, offline.
let apri = () => {}
let richiesta = null // l'invito di installazione del browser (Android, Chrome, Edge)

const giaInstallata = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
const iPhone = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)

function mostraInstalla() {
  document.querySelectorAll('[data-installa]').forEach((b) => { b.hidden = giaInstallata() })
}

async function installa() {
  if (richiesta) {
    richiesta.prompt()
    const { outcome } = await richiesta.userChoice
    richiesta = null
    if (outcome === 'accepted') apri('<h2>JobExpress è installata</h2><p>La trovi tra le app del telefono, con la sua icona.</p>')
    return
  }
  apri(`<h2>Installa JobExpress</h2>
    <p>Così la apri con un tocco, come un’app, senza passare dal browser.</p>
    ${iPhone() ? `<ol class="passi-installa"><li>Tocca il pulsante <strong>Condividi</strong> in basso (il quadrato con la freccia verso l’alto).</li>
      <li>Scorri e tocca <strong>Aggiungi alla schermata Home</strong>.</li><li>Tocca <strong>Aggiungi</strong>, in alto a destra.</li></ol>`
      : `<ol class="passi-installa"><li>Apri il menu del browser (i tre puntini).</li>
      <li>Tocca <strong>Installa app</strong> oppure <strong>Aggiungi a schermata Home</strong>.</li><li>Conferma.</li></ol>`}
    <p class="finestra__nota">L’installazione funziona quando il sito è online con un indirizzo sicuro (https). App Store e Google Play arriveranno più avanti.</p>`)
}

function avvisoAggiornamento(sw) {
  const barra = document.createElement('div')
  barra.className = 'avviso-versione'
  barra.setAttribute('role', 'status')
  barra.innerHTML = '<span>È pronta una nuova versione di JobExpress.</span><button type="button" class="tasto">Aggiorna</button>'
  barra.querySelector('button').onclick = () => sw.postMessage('aggiorna')
  document.body.appendChild(barra)
}

export function avviaPwa(strumenti) {
  apri = strumenti.apri
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    richiesta = e
    mostraInstalla()
  })
  window.addEventListener('appinstalled', mostraInstalla)
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-installa]')) { e.preventDefault(); installa() }
  })
  mostraInstalla()

  // Il service worker funziona solo su https (o in prova sul proprio computer)
  const sicuro = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname)
  if (!('serviceWorker' in navigator) || !sicuro) return
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js')
      const controlla = (sw) => sw?.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) avvisoAggiornamento(sw)
      })
      if (reg.waiting && navigator.serviceWorker.controller) avvisoAggiornamento(reg.waiting)
      reg.addEventListener('updatefound', () => controlla(reg.installing))
      let ricaricata = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (ricaricata) return
        ricaricata = true
        location.reload()
      })
    } catch { /* il sito funziona anche senza */ }
  })
}
