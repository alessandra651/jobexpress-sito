// JobExpress Career — come stai crescendo nel tempo.
// * Badge, livello e requisiti: GRATIS per tutti. Gli stessi criteri di sempre (reputazione.js):
//   l'abbonamento non cambia nulla nella reputazione.
// * Plus aggiunge le analisi: settori, competenze, andamento, suggerimenti.
// * Competenze in tre tipi: autodichiarate (CV), associate alle esperienze o alle recensioni,
//   verificate (per ora nessuna: arriveranno con le certificazioni verificate).
// * Suggerimenti prudenti: solo con abbastanza dati, mai giudizi assoluti.
import { NOME_CAT } from './incarichi.js'
import { intervallo, leggiCand, leggiRecensioni } from './lavori.js'
import { BADGE, LIVELLI, datiReputazione } from './reputazione.js'
import { haPlus } from './abbonamenti.js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const n1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',')
const leggiCvCompetenze = () => { try { return JSON.parse(localStorage.getItem('jobexpress-cv') || '{}').competenze || [] } catch { return [] } }
const CONTATTO_PUBBLICO = ['bar', 'ristorazione', 'camerieri', 'hotel', 'negozi', 'eventi', 'hostess']
const SQUADRA = ['ristorazione', 'camerieri', 'cucina', 'eventi', 'hotel', 'traslochi']

function dati() {
  const cand = leggiCand()
  const fatti = cand.filter((c) => c.stato === 'completato').map((c) => ({ ...c, quando: intervallo(c)?.inizio ?? c.il, ore: Math.max(0, c.fine - c.inizio) }))
  const annullatiDaMe = cand.filter((c) => c.stato === 'annullato' && c.annullatoDa === 'lavoratore').length
  const ric = leggiRecensioni().ricevute.filter((r) => r.lato !== 'pubblico')
  const perCat = {}
  fatti.forEach((c) => { const k = c.cat || 'altro'; (perCat[k] ||= { n: 0, ore: 0 }); perCat[k].n++; perCat[k].ore += c.ore })
  const media = (k) => { const l = ric.filter((r) => r.voti?.[k]); return l.length ? l.reduce((t, r) => t + r.voti[k], 0) / l.length : null }
  return {
    fatti, ric, perCat,
    ore: fatti.reduce((t, c) => t + c.ore, 0),
    committenti: new Set(fatti.map((c) => c.chi)).size,
    voto: ric.length ? ric.reduce((t, r) => t + r.media, 0) / ric.length : null,
    completamento: fatti.length + annullatiDaMe ? Math.round((fatti.length / (fatti.length + annullatiDaMe)) * 100) : null,
    comunicazione: media('comunicazione'), puntualita: media('puntualita'), professionalita: media('professionalita'),
  }
}

function mesi(lista, valore, n = 6) {
  const ora = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(ora.getFullYear(), ora.getMonth() - (n - 1 - i), 1)
    const f = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const dentro = lista.filter((x) => x.quando >= d.getTime() && x.quando < f.getTime())
    return { nome: d.toLocaleDateString('it-IT', { month: 'short' }), v: valore(dentro), n: dentro.length }
  })
}

function colonne(righe, fmt, etichetta) {
  const max = Math.max(1, ...righe.map((r) => r.v || 0))
  return `<div class="pc-grafico pc-grafico--basso" role="img" aria-label="${esc(etichetta)}">${righe.map((r, i) => `<div class="pc-colonna"><span class="pc-colonna__val">${r.v ? fmt(r.v) : ''}</span><i style="--h:${Math.round(((r.v || 0) / max) * 100)}%;--i:${i}"></i><span class="pc-colonna__nome">${esc(r.nome)}</span></div>`).join('')}</div>`
}

function competenze(d) {
  const quanti = (cats) => d.fatti.filter((c) => cats.includes(c.cat)).length
  const daEsp = (n) => Math.min(100, n * 10) // 10 incarichi = barra piena (scala indicativa)
  const righe = [
    { nome: 'Comunicazione', tipo: 'recensioni', v: d.comunicazione != null ? d.comunicazione * 20 : null, nota: d.comunicazione != null ? `${n1(d.comunicazione)}/5 nelle recensioni` : 'servono recensioni' },
    { nome: 'Puntualità', tipo: 'recensioni', v: d.puntualita != null ? d.puntualita * 20 : null, nota: d.puntualita != null ? `${n1(d.puntualita)}/5 nelle recensioni` : 'servono recensioni' },
    { nome: 'Gestione del cliente', tipo: 'esperienze', v: quanti(CONTATTO_PUBBLICO) ? daEsp(quanti(CONTATTO_PUBBLICO)) : null, nota: `${quanti(CONTATTO_PUBBLICO)} incarichi a contatto con il pubblico` },
    { nome: 'Lavoro di squadra', tipo: 'esperienze', v: quanti(SQUADRA) ? daEsp(quanti(SQUADRA)) : null, nota: `${quanti(SQUADRA)} incarichi in squadra` },
    { nome: 'Organizzazione', tipo: 'recensioni', v: d.professionalita != null ? d.professionalita * 20 : null, nota: d.professionalita != null ? `professionalità ${n1(d.professionalita)}/5` : 'servono recensioni' },
    ...Object.entries(d.perCat).sort((a, b) => b[1].n - a[1].n).slice(0, 3).map(([k, v]) => ({ nome: NOME_CAT[k] || k, tipo: 'esperienze', v: daEsp(v.n), nota: `${v.n} incarichi · ${n1(v.ore)} h` })),
  ]
  const auto = leggiCvCompetenze()
  return { righe, auto }
}

function suggerimenti(d) {
  if (d.fatti.length < 3) return ['Servono almeno 3 incarichi completati per suggerimenti attendibili. Intanto ogni esperienza conta.']
  const out = []
  const top = Object.entries(d.perCat).sort((a, b) => b[1].n - a[1].n)[0]
  if (top && top[1].n / d.fatti.length >= 0.4) out.push(`Hai maturato maggiore esperienza nel settore ${(NOME_CAT[top[0]] || top[0]).toLowerCase()}.`)
  const pubblico = d.ric.filter((r) => CONTATTO_PUBBLICO.includes(d.fatti.find((c) => c.titolo === r.titolo)?.cat))
  if (pubblico.length >= 3 && pubblico.reduce((t, r) => t + r.media, 0) / pubblico.length >= 4.3) out.push('Hai ricevuto valutazioni positive nelle attività a contatto con il pubblico.')
  if (Object.keys(d.perCat).length < 3) out.push('Potresti ampliare le tue competenze attraverso nuove esperienze in altri settori.')
  if (d.ric.length < 3) out.push('Chiedere una recensione dopo ogni incarico aiuta a far crescere il tuo profilo.')
  return out.length ? out : ['Stai crescendo in modo equilibrato: continua così.']
}

// Traguardi raggiunti nel tempo (dalle date degli incarichi completati)
function storico(d) {
  const ord = [...d.fatti].sort((a, b) => a.quando - b.quando)
  const soglie = [...new Set([1, ...LIVELLI.map((l) => l.incarichi).filter((n) => n > 0)])]
  return soglie.filter((n) => ord.length >= n).map((n) => ({ testo: n === 1 ? 'Primo incarico completato' : `${n} incarichi completati`, quando: ord[n - 1].quando }))
}

export function pannelloCareer() {
  const d = dati()
  const rep = datiReputazione(false)
  const plus = haPlus()
  const p = rep.prossimo
  const indietro = '<button type="button" class="pc-indietro" data-pc-vai="panoramica">← Il tuo percorso</button>'
  const badge = `<article class="pc-card pc-badge">
      <span class="pc-etichetta">Badge professionale · gratis per tutti</span>
      <p class="pc-badge__nome"><span class="pc-badge__n">${rep.livello.n}</span>${esc(rep.livello.nome)}</p>
      <p class="pc-nota">${esc(rep.livello.frase)}</p>
      ${p ? `<p class="pc-sotto-titolo">Per diventare <strong>${esc(p.nome)}</strong></p>
        <ul class="cr-req">${rep.mancano.map((r) => `<li class="${r.ok ? 'ok' : ''}"><span>${r.ok ? '✓' : '○'}</span>${esc(r.nome)}<strong>${esc(r.testo)}</strong></li>`).join('')}</ul>` : '<p class="pc-nota">Hai raggiunto il livello più alto.</p>'}
      <p class="pc-sotto-titolo">Traguardi</p>
      <ul class="cr-badge">${BADGE.map((b) => { const preso = rep.badge.find((x) => x.id === b.id)?.preso; return `<li class="${preso ? 'preso' : ''}" title="${esc(b.regola)}"><span>${esc(b.segno)}</span>${esc(b.nome)}</li>` }).join('')}</ul>
      ${storico(d).length ? `<p class="pc-sotto-titolo">Storico</p><ol class="cr-storia">${storico(d).map((x) => `<li><span>${new Date(x.quando).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</span>${esc(x.testo)}</li>`).join('')}</ol>` : ''}
      <p class="pc-nota">I criteri sono uguali per tutti i piani: la reputazione non si compra.</p>
    </article>`
  const testa = '<header class="pc-testa"><h3>JobExpress Career</h3><p>Guarda come stai crescendo.</p></header>'
  if (!plus) {
    return `<div class="pc">${indietro}${testa}${badge}
      <article class="pc-card pc-promo"><span class="pc-plus">Plus</span><h4>Con Career scopri…</h4>
        <ul class="pc-lista-check"><li>in quali settori hai più esperienza</li><li>quali competenze stai sviluppando</li><li>come vanno le tue valutazioni nel tempo</li><li>suggerimenti basati sulle tue esperienze vere</li></ul>
        <button type="button" class="tasto" data-abbonati="plus">Scopri Plus</button></article></div>`
  }
  const cats = Object.entries(d.perCat).sort((a, b) => b[1].n - a[1].n)
  const maxC = Math.max(1, ...cats.map(([, v]) => v.n))
  const comp = competenze(d)
  const recMesi = mesi(d.ric.map((r) => ({ ...r, quando: r.il })), (l) => (l.length ? l.reduce((t, r) => t + r.media, 0) / l.length : 0))
  const incMesi = mesi(d.fatti, (l) => l.length)
  return `<div class="pc">${indietro}${testa}
    <ul class="pc-cifre pc-cifre--chiaro">
      <li><span>Incarichi completati</span><strong>${d.fatti.length}</strong></li>
      <li><span>Ore lavorate</span><strong>${n1(d.ore)}</strong></li>
      <li><span>Committenti diversi</span><strong>${d.committenti}</strong></li>
      <li><span>Valutazione media</span><strong>${d.voto != null ? `${n1(d.voto)}/5` : '—'}</strong></li>
      <li><span>Recensioni</span><strong>${d.ric.length}</strong></li>
      <li><span>Completamento</span><strong>${d.completamento != null ? `${d.completamento}%` : '—'}</strong></li>
    </ul>
    <article class="pc-card"><span class="pc-etichetta">Suggerimenti</span><ul class="cr-sugg">${suggerimenti(d).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <p class="pc-nota">Basati solo sulle tue esperienze e recensioni: sono spunti, non giudizi.</p></article>
    <div class="pc-due">
      <article class="pc-card"><span class="pc-etichetta">Esperienze per settore</span>
        ${cats.length ? `<ul class="pc-cat">${cats.map(([k, v]) => `<li><span>${esc(NOME_CAT[k] || k)}</span><strong>${v.n}</strong><span class="pc-cat__barra"><i style="width:${(v.n / maxC) * 100}%"></i></span><small>${n1(v.ore)} h</small></li>`).join('')}</ul>` : '<p class="pc-nota">Ancora nessun incarico completato.</p>'}
      </article>
      <article class="pc-card"><span class="pc-etichetta">Incarichi nel tempo</span>${colonne(incMesi, (v) => v, 'Incarichi completati per mese')}</article>
    </div>
    <article class="pc-card"><span class="pc-etichetta">Mappa delle competenze</span>
      <ul class="cr-comp">${comp.righe.map((r) => `<li><span class="cr-comp__nome">${esc(r.nome)}</span><span class="cr-tipo cr-tipo--${r.tipo}">${r.tipo === 'recensioni' ? 'dalle recensioni' : 'dalle esperienze'}</span>
        <span class="pc-cat__barra"><i style="width:${r.v ?? 0}%"></i></span><small>${esc(r.nota)}</small></li>`).join('')}</ul>
      ${comp.auto.length ? `<p class="pc-sotto-titolo">Autodichiarate nel CV</p><ul class="cv-chip cv-chip--chiaro">${comp.auto.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <p class="pc-sotto-titolo">Verificate</p><p class="pc-nota">Nessuna per ora: arriveranno con le certificazioni verificate. Svolgere una mansione non equivale a una certificazione.</p>
    </article>
    <article class="pc-card"><span class="pc-etichetta">Andamento delle recensioni</span>
      ${d.ric.length ? colonne(recMesi, (v) => n1(v), 'Valutazione media per mese') : '<p class="pc-nota">Il grafico compare con le prime recensioni.</p>'}</article>
    ${badge}
  </div>`
}
