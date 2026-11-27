import { defineConfig } from 'vite'

// base relativa: il sito funziona su un dominio proprio, su Vercel/Netlify
// e in una sottocartella (per esempio GitHub Pages) senza modifiche.
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        index: 'index.html',
        privacy: 'privacy.html',
        cookie: 'cookie.html',
        condizioni: 'condizioni.html',
        sicurezza: 'sicurezza.html',
        'chi-siamo': 'chi-siamo.html',
        cv: 'cv.html',
      },
    },
  },
})
