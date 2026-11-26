// Reputazione JobExpress: 5 livelli, badge secondari e Professional Passport.
// Due indicatori separati:
//  - Experience Level: quanta esperienza hai accumulato (incarichi completati e recensioni)
//  - Reliability Score: quanto sei affidabile (valutazione media e puntualità)
// Per salire di livello servono TUTTI i requisiti, non solo il numero di incarichi.
// I badge non si comprano: l'abbonamento Plus dà solo il PDF del Passport e strumenti in più.
// In questa versione di prova i dati restano sul dispositivo (soglie ancora da confermare).
import { leggiCand, leggiRecensioni, guadagni } from './lavori.js'
import { NOME_CAT } from './incarichi.js'
import { gestisciAbbonamento, haPlus } from './abbonamenti.js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const num = (n, d = 1) => String(Math.round(n * 10 ** d) / 10 ** d).replace('.', ',')

// ================= LIVELLI (soglie ipotizzate, facili da cambiare qui) =================
export const LIVELLI = [
  { n: 1, nome: 'Starter', frase: 'Ingresso nella community JobExpress.', incarichi: 0, voto: 0, puntualita: 0, recensioni: 0 },
  { n: 2, nome: 'Explorer', frase: 'Prime esperienze lavorative verificate.', incarichi: 5, voto: 0, puntualita: 0, recensioni: 3 },
  { n: 3, nome: 'Skilled', frase: 'Esperienza consolidata e buona affidabilità.', incarichi: 15, voto: 4, puntualita: 85, recensioni: 8 },
  { n: 4, nome: 'Professional', frase: 'Elevata affidabilità e professionalità dimostrata.', incarichi: 30, voto: 4.5, puntualita: 95, recensioni: 15 },
  { n: 5, nome: 'Elite', frase: 'Massimo riconoscimento professionale della piattaforma.', incarichi: 60, voto: 4.7, puntualita: 98, recensioni: 30 },
]

// ================= BADGE SECONDARI (regole proposte, da confermare) =================
export const BADGE = [
  { id: 'first-job', nome: 'First Job', segno: '★', regola: 'Completa il tuo primo incarico.', ok: (d) => d.incarichi >= 1 },
  { id: 'on-time', nome: 'On Time', segno: '◷', regola: 'Puntualità almeno al 95% su 10 recensioni.', ok: (d) => d.recensioni >= 10 && d.puntualita >= 95 },
  { id: 'trusted', nome: 'Trusted', segno: '◆', regola: 'Media almeno 4,5 su 10 recensioni e nessun voto sotto 3.', ok: (d) => d.recensioni >= 10 && d.voto >= 4.5 && d.minimo >= 3 },
  { id: 'reliable', nome: 'Reliable', segno: '✓', regola: '20 incarichi completati e quasi nessun annullamento (massimo 1 su 20).', ok: (d) => d.incarichi >= 20 && d.annullati / Math.max(1, d.incarichi + d.annullati) <= 0.05 },
  { id: 'versatile', nome: 'Versatile', segno: '✦', regola: 'Incarichi completati in almeno 3 settori diversi.', ok: (d) => d.settori >= 3 },
  { id: 'team-player', nome: 'Team Player', segno: '◎', regola: 'Voto medio di comunicazione almeno 4,5 su 5 recensioni.', ok: (d) => d.recensioni >= 5 && d.comunicazione >= 4.5 },
  { id: 'specialist', nome: 'Specialist', segno: '▲', regola: '10 incarichi nello stesso settore.', ok: (d) => d.maxSettore >= 10 },
  { id: 'ore-100', nome: '100 Hours', segno: '100', regola: '100 ore di lavoro registrate.', ok: (d) => d.ore >= 100 },
  { id: 'ore-500', nome: '500 Hours', segno: '500', regola: '500 ore di lavoro registrate.', ok: (d) => d.ore >= 500 },
]

// Dati di esempio (come negli appunti: 42 incarichi, 4,9 su 5, 98%)
const ESEMPIO = {
  incarichi: 42, recensioni: 36, voto: 4.9, minimo: 4, puntualita: 98, comunicazione: 4.8, annullati: 0, ore: 168,
  perSettore: { camerieri: 18, eventi: 14, babysitting: 10 }, esempio: true,
}

// ================= CALCOLO =================
export function datiReputazione(esempio) {
  if (esempio) return completa({ ...ESEMPIO })
  const cand = leggiCand()
  const fatti = cand.filter((c) => c.stato === 'completato')
  // Contano solo le recensioni ricevute per il lavoro svolto (dal lato di chi pubblica)
  const ric = leggiRecensioni().ricevute.filter((r) => r.lato !== 'pubblico')
  const conPunt = ric.filter((r) => r.puntuale != null || r.voti?.puntualita)
  const puntuali = conPunt.filter((r) => r.puntuale ?? r.voti.puntualita >= 4).length
  const conCom = ric.filter((r) => r.voti?.comunicazione)
  const perSettore = {}
  fatti.forEach((c) => { const k = c.cat || 'altro'; perSettore[k] = (perSettore[k] || 0) + 1 })
  return completa({
    incarichi: fatti.length,
    recensioni: ric.length,
    voto: ric.length ? ric.reduce((t, r) => t + r.media, 0) / ric.length : 0,
    minimo: ric.length ? Math.min(...ric.map((r) => r.media)) : 0,
    puntualita: conPunt.length ? (puntuali / conPunt.length) * 100 : 0,
    comunicazione: conCom.length ? conCom.reduce((t, r) => t + r.voti.comunicazione, 0) / conCom.length : 0,
    annullati: cand.filter((c) => c.stato === 'annullato').length,
    ore: guadagni().reduce((t, g) => t + (g.ore || 0), 0),
    perSettore,
  })
}

const requisiti = (d, l) => [
  { nome: 'Incarichi', ha: d.incarichi, serve: l.incarichi, ok: d.incarichi >= l.incarichi, testo: `${d.incarichi}/${l.incarichi}` },
  { nome: 'Recensioni verificate', ha: d.recensioni, serve: l.recensioni, ok: d.recensioni >= l.recensioni, testo: `${d.recensioni}/${l.recensioni}` },
  ...(l.voto ? [{ nome: 'Valutazione minima', ok: d.voto >= l.voto, testo: `${d.recensioni ? num(d.voto) : '—'} / serve ${num(l.voto)}` }] : []),
  ...(l.puntualita ? [{ nome: 'Puntualità', ok: d.puntualita >= l.puntualita, testo: `${d.recensioni ? Math.round(d.puntualita) + '%' : '—'} / serve ${l.puntualita}%` }] : []),
]

function completa(d) {
  d.settori = Object.keys(d.perSettore).length
  d.maxSettore = Math.max(0, ...Object.values(d.perSettore))
  d.livello = [...LIVELLI].reverse().find((l) => requisiti(d, l).every((r) => r.ok)) || LIVELLI[0]
  d.prossimo = LIVELLI[d.livello.n] || null
  d.mancano = d.prossimo ? requisiti(d, d.prossimo) : []
  // Reliability Score da 0 a 100: metà valutazione, metà puntualità. Serve almeno 3 recensioni.
  d.affidabilita = d.recensioni >= 3 ? Math.round(((d.voto / 5) * 100 + d.puntualita) / 2) : null
  d.badge = BADGE.map((b) => ({ ...b, preso: b.ok(d) }))
  return d
}

function fraseMancano(d) {
  if (!d.prossimo) return 'Hai raggiunto il livello più alto. Continua così per mantenerlo.'
  const no = d.mancano.filter((r) => !r.ok)
  const inc = no.find((r) => r.nome === 'Incarichi')
  if (no.length === 1 && inc) return `Ti mancano ${inc.serve - inc.ha} incarichi per raggiungere la soglia ${d.prossimo.nome}.`
  return `Per diventare ${d.prossimo.nome} ti servono ancora: ${no.map((r) => r.nome.toLowerCase()).join(', ')}.`
}

// ================= RIQUADRO NEL PROFILO =================
let esempio = false

export function riquadroReputazione() {
  const d = datiReputazione(esempio)
  const l = d.livello
  const p = d.prossimo
  const perc = p ? Math.min(100, (d.incarichi / p.incarichi) * 100) : 100
  const presi = d.badge.filter((b) => b.preso)
  return `
  <section class="reputazione" aria-labelledby="rep-titolo">
    <div class="riquadro__testa">
      <p class="reputazione__sopra">JobExpress · Level ${String(l.n).padStart(2, '0')}</p>
      <label class="interruttore"><input type="checkbox" data-rep-esempio ${esempio ? 'checked' : ''}/> Dati di esempio</label>
    </div>
    <h3 id="rep-titolo" class="reputazione__nome">${l.nome}</h3>
    <p class="reputazione__frase">${l.frase}</p>
    <ul class="reputazione__cifre">
      <li><span>Incarichi</span><strong>${d.incarichi}</strong></li>
      <li><span>Valutazione</span><strong>${d.recensioni ? `${num(d.voto)}/5` : '—'}</strong></li>
      <li><span>Puntualità</span><strong>${d.recensioni ? `${Math.round(d.puntualita)}%` : '—'}</strong></li>
      <li><span>Affidabilità</span><strong>${d.affidabilita ?? '—'}${d.affidabilita != null ? '<small>/100</small>' : ''}</strong></li>
    </ul>
    ${p ? `<div class="reputazione__prossimo">
      <div class="reputazione__riga"><strong>Prossimo livello: ${p.nome}</strong><span>${d.incarichi}/${p.incarichi}</span></div>
      <div class="reputazione__barra" role="progressbar" aria-valuemin="0" aria-valuemax="${p.incarichi}" aria-valuenow="${d.incarichi}" aria-label="Incarichi verso ${p.nome}"><i style="width:${perc}%"></i></div>
      <p>${fraseMancano(d)}</p>
      <details class="reputazione__requisiti"><summary>Cosa serve per ${p.nome}</summary>
        <ul>${d.mancano.map((r) => `<li class="${r.ok ? 'fatto' : ''}"><span>${r.ok ? '✓' : '○'}</span>${r.nome}<em>${r.testo}</em></li>`).join('')}</ul>
      </details>
    </div>` : `<p class="reputazione__prossimo">${fraseMancano(d)}</p>`}

    <h4 class="reputazione__sottotitolo">I tuoi badge <span>${presi.length} su ${d.badge.length}</span></h4>
    <ul class="badge-griglia">
      ${d.badge.map((b) => `<li class="badge ${b.preso ? 'badge--preso' : ''}" title="${esc(b.regola)}">
        <span class="badge__segno" aria-hidden="true">${b.segno}</span>
        <strong>${b.nome}</strong><small>${b.preso ? 'Ottenuto' : esc(b.regola)}</small></li>`).join('')}
    </ul>

    <div class="reputazione__passport">
      <div><strong>Professional Passport</strong><p>Le tue esperienze, in un unico profilo.</p></div>
      <button type="button" class="tasto" data-apri-passport>Apri il Passport</button>
    </div>
    <p class="finestra__nota">Il livello si guadagna solo lavorando: non si può comprare né accelerare. Una recensione ingiusta? Puoi contestarla qui sotto, nelle tue recensioni.</p>
    ${d.esempio ? '<p class="etichetta-esempio">Dati di esempio, non reali</p>' : ''}
  </section>`
}

// ================= PROFESSIONAL PASSPORT =================
// Codice di verifica: per ora è solo un'anteprima. La verifica vera (link e QR che
// chiunque può aprire) arriva quando il sito è online e i dati sono su Supabase.
const codice = (nome) => {
  let h = 0
  for (const c of `${nome}jobexpress`) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return `JX-${h.toString(36).toUpperCase().padStart(7, '0').slice(0, 4)}-${(h % 9973).toString().padStart(4, '0')}`
}

function passport(u, d) {
  const nome = d.esempio ? 'Giulia Rossi' : (u?.nome || 'Il tuo nome')
  const settori = Object.entries(d.perSettore).sort((a, b) => b[1] - a[1])
  const presi = d.badge.filter((b) => b.preso)
  return `
  <article class="passport" aria-label="Professional Passport di ${esc(nome)}">
    <header class="passport__testa"><span class="passport__marchio">JobExpress.</span><span>Professional Passport</span></header>
    <h2 class="passport__nome">${esc(nome)}</h2>
    <p class="passport__livello">◆ ${d.livello.nome} · Level ${String(d.livello.n).padStart(2, '0')}</p>
    <dl class="passport__cifre">
      <div><dt>Esperienze completate</dt><dd>${d.incarichi}</dd></div>
      <div><dt>Valutazione media</dt><dd>${d.recensioni ? `${num(d.voto)}/5` : '—'}</dd></div>
      <div><dt>Indice di puntualità</dt><dd>${d.recensioni ? `${Math.round(d.puntualita)}%` : '—'}</dd></div>
      <div><dt>Settori di esperienza</dt><dd>${d.settori}</dd></div>
    </dl>
    ${settori.length ? `<p class="passport__settori">${settori.map(([k, n]) => `<span>${esc(NOME_CAT[k] || k)} · ${n}</span>`).join('')}</p>` : ''}
    ${presi.length ? `<p class="passport__badge">${presi.map((b) => `<span>${/^\d/.test(b.segno) ? '' : b.segno + ' '}${b.nome}</span>`).join('')}</p>` : ''}
    <footer class="passport__verifica">
      <div class="passport__qr" aria-hidden="true"><span>QR</span></div>
      <div><strong>Verifica del profilo</strong><p>Codice ${codice(nome)}</p>
        <small>Il link e il QR di verifica si attivano con il lancio del sito.</small></div>
    </footer>
    <p class="passport__nota">Attestazione privata delle esperienze registrate su JobExpress. Non è una qualifica professionale riconosciuta dallo Stato.${d.esempio ? ' Dati di esempio.' : ''}</p>
  </article>`
}

export function apriPassport(apri, u) {
  const d = datiReputazione(esempio)
  apri(`
    ${passport(u, d)}
    <div class="finestra__azioni passport__azioni">
      ${haPlus()
        ? '<button type="button" class="tasto" data-passport-pdf>Scarica in PDF</button>'
        : '<button type="button" class="tasto" data-abbonati="plus">Scarica in PDF · con Plus</button>'}
      <button type="button" class="tasto tasto--chiaro" data-passport-copia>Copia il riepilogo</button>
    </div>
    <p class="finestra__nota" data-passport-msg role="status">${haPlus() ? 'Nella finestra di stampa scegli «Salva come PDF».' : 'Livello, badge e verifica restano gratis per tutti. Con Plus scarichi il Passport in PDF per il curriculum.'}</p>`)
  const f = document.querySelector('dialog.finestra')
  const msg = f.querySelector('[data-passport-msg]')
  f.querySelector('[data-passport-pdf]')?.addEventListener('click', () => {
    document.body.classList.add('stampa-passport')
    const fine = () => { document.body.classList.remove('stampa-passport'); removeEventListener('afterprint', fine) }
    addEventListener('afterprint', fine)
    print()
  })
  // Il pulsante Plus è dentro la finestra: apre direttamente la pagina di abbonamento
  f.querySelector('.passport__azioni [data-abbonati]')?.addEventListener('click', (e) => gestisciAbbonamento({ type: 'click', target: e.currentTarget }))
  f.querySelector('[data-passport-copia]')?.addEventListener('click', () => {
    const nome = d.esempio ? 'Giulia Rossi' : (u?.nome || '')
    const testo = `JobExpress Professional Passport · ${nome}\nLivello: ${d.livello.nome} (Level ${d.livello.n})\nEsperienze completate: ${d.incarichi}\nValutazione media: ${d.recensioni ? num(d.voto) + '/5' : '—'}\nPuntualità: ${d.recensioni ? Math.round(d.puntualita) + '%' : '—'}\nBadge: ${d.badge.filter((b) => b.preso).map((b) => b.nome).join(', ') || 'nessuno'}\nCodice di verifica: ${codice(nome)}`
    navigator.clipboard?.writeText(testo).then(() => { msg.textContent = 'Riepilogo copiato: puoi incollarlo nel curriculum o su LinkedIn.' }, () => { msg.textContent = testo })
  })
}

// Click e interruttori dentro La mia area. Restituisce true se va ridisegnata.
export function gestisciReputazione(e, apri, u) {
  if (e.type === 'change' && e.target.matches('[data-rep-esempio]')) { esempio = e.target.checked; return true }
  if (e.type === 'click' && e.target.closest('[data-apri-passport]')) { apriPassport(apri, u); return false }
  return false
}
