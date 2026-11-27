// Disegno del curriculum (usato nell'anteprima, nel PDF e nella pagina del link condiviso).
// Riceve solo i dati che la persona ha scelto di mostrare.
// Distingue sempre: esperienze verificabili su JobExpress, esperienze esterne autodichiarate,
// certificazioni autodichiarate o verificate.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export const NOMI_SEZIONI = {
  presentazione: 'Profilo',
  esperienze: 'Esperienze',
  studi: 'Istruzione',
  lingue: 'Lingue',
  competenze: 'Competenze',
  certificazioni: 'Certificazioni',
  disponibilita: 'Disponibilità',
  badge: 'Badge JobExpress',
  valutazioni: 'Valutazioni ricevute',
}

const tag = (tipo) => ({
  verificabile: '<span class="cv-tag cv-tag--ok">Verificabile su JobExpress</span>',
  autodichiarata: '<span class="cv-tag">Autodichiarata</span>',
  verificata: '<span class="cv-tag cv-tag--ok">Verificata</span>',
}[tipo] || '')

function sezione(s) {
  const titolo = `<h2 class="cv-h">${esc(NOMI_SEZIONI[s.k] || s.k)}</h2>`
  if (s.k === 'presentazione') return s.testo ? `<section class="cv-sez">${titolo}<p>${esc(s.testo)}</p></section>` : ''
  if (s.k === 'disponibilita') return s.testo ? `<section class="cv-sez">${titolo}<p>${esc(s.testo)}</p></section>` : ''
  if (s.k === 'esperienze') {
    const je = s.jobexpress || []
    const es = s.esterne || []
    if (!je.length && !es.length) return ''
    return `<section class="cv-sez">${titolo}
      ${je.map((x) => `<article class="cv-voce"><div class="cv-voce__testa"><strong>${esc(x.titolo)}</strong><span>${esc(x.periodo)}</span></div>
        <p class="cv-voce__dove">${esc(x.chi)} · ${esc(x.categoria)}${x.ore ? ` · ${esc(x.ore)} h` : ''} ${tag('verificabile')}</p>
        ${x.descrizione ? `<p>${esc(x.descrizione)}</p>` : ''}
        ${x.competenze?.length ? `<p class="cv-voce__comp">Attività svolte: ${x.competenze.map(esc).join(', ')}</p>` : ''}
        ${x.valutazione ? `<p class="cv-voce__voto">Valutazione ricevuta: ${esc(x.valutazione)}/5</p>` : ''}</article>`).join('')}
      ${es.map((x) => `<article class="cv-voce"><div class="cv-voce__testa"><strong>${esc(x.ruolo)}</strong><span>${esc(x.periodo)}</span></div>
        <p class="cv-voce__dove">${esc(x.dove)} ${tag('autodichiarata')}</p>${x.descrizione ? `<p>${esc(x.descrizione)}</p>` : ''}</article>`).join('')}
    </section>`
  }
  if (s.k === 'studi') return s.voci?.length ? `<section class="cv-sez">${titolo}${s.voci.map((x) => `<article class="cv-voce"><div class="cv-voce__testa"><strong>${esc(x.titolo)}</strong><span>${esc(x.anno)}</span></div><p class="cv-voce__dove">${esc(x.scuola)}</p></article>`).join('')}</section>` : ''
  if (s.k === 'lingue') return s.voci?.length ? `<section class="cv-sez">${titolo}<ul class="cv-chip">${s.voci.map((x) => `<li>${esc(x.lingua)}${x.livello ? ` · ${esc(x.livello)}` : ''}</li>`).join('')}</ul></section>` : ''
  if (s.k === 'competenze') return s.voci?.length ? `<section class="cv-sez">${titolo}<ul class="cv-chip">${s.voci.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><p class="cv-legenda">Competenze indicate dalla persona.</p></section>` : ''
  if (s.k === 'certificazioni') return s.voci?.length ? `<section class="cv-sez">${titolo}${s.voci.map((x) => `<article class="cv-voce"><div class="cv-voce__testa"><strong>${esc(x.nome)}</strong><span>${esc(x.anno)}</span></div><p class="cv-voce__dove">${esc(x.ente)} ${tag(x.verificata ? 'verificata' : 'autodichiarata')}</p></article>`).join('')}</section>` : ''
  if (s.k === 'badge') return s.livello ? `<section class="cv-sez">${titolo}<p class="cv-badge"><span>${esc(s.n)}</span><strong>${esc(s.livello)}</strong> · ${esc(s.incarichi)} incarichi completati su JobExpress</p></section>` : ''
  if (s.k === 'valutazioni') return s.voci?.length ? `<section class="cv-sez">${titolo}${s.voci.map((x) => `<blockquote class="cv-cit">«${esc(x.testo)}»<cite>${esc(x.da)} · ${esc(x.voto)}/5</cite></blockquote>`).join('')}</section>` : ''
  return ''
}

export function disegnaCV(d) {
  const iniziali = String(d.nome || '?').split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()
  return `<article class="cv cv--${esc(d.modello || 'minimal')}">
    <header class="cv-testa">
      ${d.foto ? `<img class="cv-foto" src="${esc(d.foto)}" alt="" />` : `<span class="cv-foto cv-foto--iniziali" aria-hidden="true">${esc(iniziali)}</span>`}
      <div><h1 class="cv-nome">${esc(d.nome || 'Il tuo nome')}</h1>${d.titolo ? `<p class="cv-ruolo">${esc(d.titolo)}</p>` : ''}
        ${d.contatti?.length ? `<p class="cv-contatti">${d.contatti.map(esc).join(' · ')}</p>` : ''}</div>
    </header>
    <div class="cv-corpo">${(d.sezioni || []).map(sezione).join('')}</div>
    <footer class="cv-piede">Curriculum creato con JobExpress${d.generato ? ` · aggiornato il ${esc(d.generato)}` : ''}</footer>
  </article>`
}
