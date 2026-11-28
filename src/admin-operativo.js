// Area Admin · sezioni operative (Fase 5)
//   Live e Rescue · Annullamenti e mancate presentazioni · Safe (segnalazioni) · Recensioni · Contestazioni
//   Notifiche e processi programmati · Interruttori.
// Ogni dato arriva da funzioni del database riservate agli amministratori (admin_*).
// Nessuna decisione automatica: ogni intervento chiede una motivazione e finisce nel registro.
// Con l'account di prova si vede un'anteprima con dati di esempio, etichettata.

const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const data = (d) => d ? new Date(d).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
const n = (x) => x == null ? '—' : Number(x).toLocaleString('it-IT', { maximumFractionDigits: 2 })

const FASCE = { anticipato: 'anticipato (oltre 24 h)', tardivo: 'tardivo (6–24 h)', urgente: 'urgente (1–6 h)', ultimo_minuto: 'ultimo minuto (meno di 1 h)', dopo_inizio: 'dopo l’inizio' }
const TIPO_SEG = { molestie: 'Molestie', aggressivita: 'Aggressività', discriminazione: 'Discriminazione', condizioni_pericolose: 'Condizioni pericolose', accordi_non_rispettati: 'Accordi non rispettati',
  mancato_pagamento: 'Mancato pagamento', lavoro_irregolare: 'Lavoro irregolare', annuncio_fraudolento: 'Annuncio fraudolento', profilo_falso: 'Profilo falso', furto_identita: 'Furto d’identità',
  foto: 'Foto', recensione: 'Recensione', comportamento: 'Comportamento', annuncio: 'Annuncio', sicurezza: 'Sicurezza', altro: 'Altro' }
// interruttori operativi che si possono cambiare dal pannello (le funzioni vietate sono bloccate anche nel database)
const INTERRUTTORI = [
  ['live_enabled', 'JobExpress Live'], ['live_scheduled_availability_enabled', 'Live programmata'], ['rescue_enabled', 'JobExpress Rescue'], ['rescue_urgency_bonus_enabled', 'Bonus urgenza'],
  ['safe_basic_enabled', 'Safe essenziale (condivisione, segnalazioni)'], ['reciprocal_reviews_enabled', 'Recensioni reciproche'], ['double_blind_reviews_enabled', 'Doppio cieco'],
  ['modifica_condizioni_enabled', 'Richieste di modifica delle condizioni'], ['business_multi_position_enabled', 'Annunci con più posti'], ['business_dashboard_enabled', 'Panoramica e calendario Business'],
  ['business_templates_enabled', 'Modelli di annuncio'], ['business_recurring_enabled', 'Annunci ricorrenti'], ['free_monthly_job_limit_enabled', 'Limite Free di 2 lavori al mese'],
]
const BLOCCATI = [['biometric_verification_enabled', 'Verifica biometrica'], ['automatic_reputation_penalties_enabled', 'Penalità reputazionali automatiche'], ['employer_badge_enabled', 'Badge per le aziende'],
  ['spid_enabled', 'SPID'], ['cie_enabled', 'CIE'], ['business_pro_enabled', 'Business Pro'], ['safe_trusted_contacts_enabled', 'Contatti di fiducia'], ['safe_automatic_alerts_enabled', 'Avvisi automatici Safe'], ['minor_accounts_enabled', 'Account di minorenni']]

const ESEMPIO = {
  op: { rescue_richieste: 12, rescue_attive: 1, rescue_coperte: 9, rescue_scoperte: 2, rescue_minuti_medi: 38, rescue_minuti_mediani: 25, rescue_avvisati: 64, rescue_risposte: 31, rescue_bonus_medio: 12.5,
    live_attive_ora: 7, live_programmate: 15, proposte_dirette: 22, proposte_accettate: 9, proposte_risposte: 17, annullamenti_per_fascia: { anticipato: 6, tardivo: 3, urgente: 1 }, mancate_presentazioni_aperte: 1, modifiche_in_attesa: 2,
    coda_mancate: [{ id: 'm1', stato: 'chiarimento_inviato', nota: 'Non si è presentato', chiarimento: 'Avevo la febbre, ho scritto in chat alle 7', creato_il: new Date(Date.now() - 864e5).toISOString(), lavoratore: 'Luca', committente: 'Osteria (esempio)', titolo: 'Cameriere' }] },
  safe: { segnalazioni_aperte: 3, urgenti: 1, condivisioni_attive: 4, blocchi: 6, recensioni_pubblicate: 40, recensioni_in_attesa: 5, recensioni_rimosse: 1, incarichi_recensiti_perc: 62,
    coda: [{ id: 1, tipo: 'molestie', priorita: 'urgente', stato: 'aperta', motivo: 'Commenti pesanti durante il turno', pericolo: true, allegati: [], segnalato: 'Utente di esempio', creato_il: new Date().toISOString() },
      { id: 2, tipo: 'mancato_pagamento', priorita: 'alta', stato: 'in_esame', motivo: 'Turno di sabato non pagato', pericolo: false, allegati: ['x/1.jpg'], segnalato: 'Bar (esempio)', creato_il: new Date(Date.now() - 2 * 864e5).toISOString() }] },
  rec: [{ id: 'r1', media: 2, commento: 'Orari cambiati all’ultimo, poco organizzati.', risposta: 'Ci scusiamo, è stato un imprevisto.', stato: 'pubblicata', ruolo_autore: 'lavoratore', autore: 'Sara', destinatario: 'Bar (esempio)', segnalata: true, pubblicata_il: new Date().toISOString() }],
  cont: [{ id: 'c1', motivo: 'Ore pagate inferiori a quelle concordate', stato: 'aperta', titolo: 'Inventario', da: 'lavoratore', creato_il: new Date().toISOString() }],
  mon: { cron: [{ nome: 'jobexpress-processi-operativi', pianificazione: '* * * * *', attivo: true, ultimo_esito: 'succeeded', ultima: new Date().toISOString(), riusciti_24h: 1440, falliti_24h: 0 }],
    errori_recenti: [], ultime_esecuzioni: [], notifiche_24h: { rescue: 12, recensione: 4, proposta_live: 3 }, notifiche_7g: 210,
    business: { modelli: 8, ricorrenze_attive: 3, date_da_confermare: 4, date_pubblicate: 11, annunci_multi_posto: 5 }, recensioni: { periodi_aperti: 6, pubblicate: 40, in_attesa: 5, rimosse: 1, con_risposta: 9, media_generale: 4.4 }, contestazioni_aperte: 1 },
}

export async function caricaOperativo(rpc) {
  const [op, safe, rec, cont, mon] = await Promise.all(['admin_operativo', 'admin_safe', 'admin_recensioni', 'admin_contestazioni', 'admin_monitoraggio'].map((f) => rpc(f).catch(() => null)))
  return { op, safe, rec, cont, mon }
}

export function bloccoOperativo(stato, impostazioni) {
  const prova = !stato.reale
  const x = prova ? ESEMPIO : (stato.operativo || {})
  const et = prova ? '<span class="etichetta-esempio">esempio</span>' : '<span class="stato">dati reali</span>'
  const o = x.op; const sf = x.safe; const mon = x.mon
  const perc = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—')
  return `
  <nav class="adm-indice" aria-label="Sezioni operative">${[['adm-live', 'Live e Rescue'], ['adm-annulli', 'Annullamenti'], ['adm-safe', 'Safe'], ['adm-rec', 'Recensioni'], ['adm-cont', 'Contestazioni'], ['adm-mon', 'Monitoraggio'], ['adm-flag', 'Interruttori']].map(([h, t]) => `<a href="#${h}">${t}</a>`).join('')}</nav>
  ${prova ? '<p class="avviso-prova">Anteprima con dati di esempio: con il tuo account da amministratrice qui vedi i dati reali.</p>' : ''}

  <section class="admin__blocco" id="adm-live"><h3>Live e Rescue ${et}</h3>
    ${o ? `<ul class="stat stat--sei">
      <li><strong>${o.live_attive_ora}</strong><span>Persone in Live ora</span></li><li><strong>${o.live_programmate}</strong><span>Disponibilità programmate</span></li>
      <li><strong>${o.proposte_dirette}</strong><span>Proposte dirette</span></li><li><strong>${perc(o.proposte_accettate, o.proposte_risposte)}</strong><span>Accettate (su risposte)</span></li>
      <li><strong>${o.rescue_attive}</strong><span>Rescue attive</span></li><li><strong>${perc(o.rescue_coperte, o.rescue_coperte + o.rescue_scoperte)}</strong><span>Rescue coperte</span></li>
      <li><strong>${o.rescue_minuti_mediani == null ? '—' : `${o.rescue_minuti_mediani} min`}</strong><span>Tempo mediano di copertura</span></li><li><strong>${perc(o.rescue_risposte, o.rescue_avvisati)}</strong><span>Risposte agli avvisi Rescue</span></li>
      <li><strong>${o.rescue_bonus_medio == null ? '—' : `${n(o.rescue_bonus_medio)} €`}</strong><span>Bonus medio</span></li><li><strong>${o.modifiche_in_attesa}</strong><span>Modifiche condizioni in attesa</span></li></ul>
      <p class="finestra__nota">Live e Rescue sono gratuiti e senza priorità per chi paga. Nessun tracciamento GPS: le zone sono dichiarate dalle persone.</p>` : '<p>Dati non disponibili.</p>'}
  </section>

  <section class="admin__blocco" id="adm-annulli"><h3>Annullamenti e mancate presentazioni ${et}</h3>
    ${o ? `<p>${Object.entries(o.annullamenti_per_fascia || {}).map(([k, v]) => `<span class="adm-pill">${esc(FASCE[k] || k)}: <strong>${v}</strong></span>`).join(' ') || 'Nessun annullamento.'}</p>
      <p class="finestra__nota">Nessuna penalità automatica: le fasce servono solo a capire, non a punire.</p>
      <h4>Mancate presentazioni da decidere (${(o.coda_mancate || []).length})</h4>
      ${(o.coda_mancate || []).length ? `<ul class="candidature">${o.coda_mancate.map((m) => `<li class="candidatura"><div><strong>${esc(m.titolo)}</strong>
        <p>${esc(m.committente)} segnala ${esc(m.lavoratore)} · ${data(m.creato_il)} · stato: ${esc(m.stato.replace(/_/g, ' '))}</p>
        ${m.nota ? `<p>Committente: «${esc(m.nota)}»</p>` : ''}${m.chiarimento ? `<p>Lavoratore: «${esc(m.chiarimento)}»</p>` : '<p><em>La persona non ha ancora dato la sua versione.</em></p>'}</div>
        <div class="pa-azioni-riga">${prova ? '' : `<button type="button" class="tasto tasto--chiaro" data-adm-o="mancata" data-id="${esc(m.id)}" data-v="in_revisione">In revisione</button>
          <button type="button" class="tasto" data-adm-o="mancata" data-id="${esc(m.id)}" data-v="non_confermata">Non confermata</button>
          <button type="button" class="tasto tasto--chiaro" data-adm-o="mancata" data-id="${esc(m.id)}" data-v="confermata">Confermata</button>`}</div></li>`).join('')}</ul>` : '<p>Nessuna segnalazione da decidere.</p>'}
      <p class="finestra__nota">Decidi solo dopo aver letto entrambe le versioni. La decisione non è pubblica e non abbassa nessun punteggio in automatico.</p>` : ''}
  </section>

  <section class="admin__blocco" id="adm-safe"><h3>JobExpress Safe ${et}</h3>
    ${sf ? `<ul class="stat stat--sei">
      <li><strong>${sf.segnalazioni_aperte}</strong><span>Segnalazioni aperte</span></li><li><strong>${sf.urgenti}</strong><span>Urgenti</span></li>
      <li><strong>${sf.condivisioni_attive}</strong><span>Link di condivisione attivi</span></li><li><strong>${sf.blocchi}</strong><span>Blocchi tra utenti</span></li></ul>
      <h4>Coda (prima le urgenti)</h4>
      ${(sf.coda || []).length ? `<ul class="candidature">${sf.coda.map((q) => `<li class="candidatura adm-seg adm-seg--${esc(q.priorita)}"><div>
        <strong>${esc(TIPO_SEG[q.tipo] || q.tipo)}</strong> <span class="stato ${q.priorita === 'urgente' ? 'stato--pericolo' : q.priorita === 'alta' ? 'stato--alta' : ''}">${esc(q.priorita)}</span>${q.pericolo ? ' <span class="stato stato--pericolo">pericolo dichiarato</span>' : ''}
        <p>Su: ${esc(q.segnalato)} · ${data(q.creato_il)} · ${esc(q.stato.replace(/_/g, ' '))}${q.allegati?.length ? ` · ${q.allegati.length} allegati` : ''}</p>
        <p>«${esc(q.motivo)}»</p>${q.contestazione ? `<p>Contestazione dell’esito: «${esc(q.contestazione)}»</p>` : ''}</div>
        ${prova ? '' : `<div class="pa-azioni-riga">
          ${(q.allegati || []).map((a, i) => `<button type="button" class="tasto tasto--chiaro tasto--piccolo" data-adm-o="allegato" data-p="${esc(a)}">Allegato ${i + 1}</button>`).join('')}
          <button type="button" class="tasto tasto--chiaro" data-adm-o="seg" data-id="${q.id}" data-v="in_esame">In esame</button>
          <button type="button" class="tasto tasto--chiaro" data-adm-o="seg" data-id="${q.id}" data-v="info_richieste">Chiedi informazioni</button>
          <button type="button" class="tasto" data-adm-o="seg" data-id="${q.id}" data-v="risolta">Risolta</button>
          <button type="button" class="tasto tasto--chiaro" data-adm-o="seg" data-id="${q.id}" data-v="archiviata">Archivia</button>
</div>`}</li>`).join('')}</ul>` : '<p>Nessuna segnalazione aperta.</p>'}
      <p class="finestra__nota">Per sospendere un account in via cautelativa cercalo per email nella sezione Trust qui sopra. Per un pericolo in corso la persona deve chiamare il 112: JobExpress non è un servizio di emergenza. Gli allegati si aprono con un link temporaneo di 2 minuti.</p>` : '<p>Dati non disponibili.</p>'}
  </section>

  <section class="admin__blocco" id="adm-rec"><h3>Recensioni ${et}</h3>
    ${mon?.recensioni ? `<ul class="stat stat--sei"><li><strong>${mon.recensioni.pubblicate}</strong><span>Pubblicate</span></li><li><strong>${mon.recensioni.in_attesa}</strong><span>In attesa (doppio cieco)</span></li>
      <li><strong>${mon.recensioni.periodi_aperti}</strong><span>Periodi aperti</span></li><li><strong>${mon.recensioni.rimosse}</strong><span>Rimosse</span></li>
      <li><strong>${n(mon.recensioni.media_generale)}</strong><span>Media generale</span></li><li><strong>${sf?.incarichi_recensiti_perc == null ? '—' : `${sf.incarichi_recensiti_perc}%`}</strong><span>Incarichi recensiti</span></li></ul>` : ''}
    <h4>Ultime recensioni con commento</h4>
    ${(x.rec || []).length ? `<ul class="candidature">${x.rec.map((r) => `<li class="candidatura"><div><strong>${esc(r.autore)} → ${esc(r.destinatario)}</strong> · ${n(r.media)}/5 ${r.segnalata ? '<span class="stato stato--pericolo">segnalata</span>' : ''}${r.stato === 'rimossa' ? ' <span class="stato">rimossa</span>' : ''}
      <p>«${esc(r.commento)}»</p>${r.risposta ? `<p>Risposta: «${esc(r.risposta)}»</p>` : ''}${r.rimossa_motivo ? `<p>Motivo della rimozione: ${esc(r.rimossa_motivo)}</p>` : ''}</div>
      ${!prova && r.stato === 'pubblicata' ? `<div class="pa-azioni-riga"><button type="button" class="tasto tasto--chiaro" data-adm-o="rimuovi-rec" data-id="${esc(r.id)}">Rimuovi con motivo</button></div>` : ''}</li>`).join('')}</ul>` : '<p>Nessuna recensione con commento.</p>'}
    <p class="finestra__nota">Si rimuove solo ciò che viola le regole (insulti, dati personali, discriminazione, contenuti falsi accertati). Un voto basso non è un motivo di rimozione.</p>
  </section>

  <section class="admin__blocco" id="adm-cont"><h3>Contestazioni sugli incarichi ${et}</h3>
    ${(x.cont || []).filter((c) => c.stato === 'aperta').length ? `<ul class="candidature">${x.cont.filter((c) => c.stato === 'aperta').map((c) => `<li class="candidatura"><div><strong>${esc(c.titolo)}</strong>
      <p>Aperta da: ${esc(c.da)} · ${data(c.creato_il)}</p><p>«${esc(c.motivo)}»</p></div>
      ${prova ? '' : `<div class="pa-azioni-riga"><button type="button" class="tasto" data-adm-o="cont" data-id="${esc(c.id)}" data-v="risolta">Risolta</button><button type="button" class="tasto tasto--chiaro" data-adm-o="cont" data-id="${esc(c.id)}" data-v="archiviata">Archivia</button></div>`}</li>`).join('')}</ul>` : '<p>Nessuna contestazione aperta.</p>'}
  </section>

  <section class="admin__blocco" id="adm-mon"><h3>Notifiche e processi programmati ${et}</h3>
    ${mon ? `<ul class="trust-flag">${(mon.cron || []).map((c) => `<li><span>${esc(c.nome)} <small>(${esc(c.pianificazione)})</small></span><strong class="${c.ultimo_esito === 'succeeded' && !c.falliti_24h ? 'acceso' : ''}">${c.attivo ? `${c.riusciti_24h} ok · ${c.falliti_24h} errori in 24 h` : 'fermo'}</strong></li>`).join('')}</ul>
      <p class="finestra__nota">Ultima esecuzione: ${data(mon.cron?.[0]?.ultima)}.</p>
      ${(mon.errori_recenti || []).length ? `<h4>Errori recenti</h4><ul class="admin__registro">${mon.errori_recenti.map((e) => `<li><span>${data(e.quando)}</span>${esc(e.nome)}: ${esc(e.dettagli?.errore || '')}</li>`).join('')}</ul>` : '<p>Nessun errore nei processi.</p>'}
      <h4>Notifiche inviate (24 h)</h4>
      <p>${Object.entries(mon.notifiche_24h || {}).map(([k, v]) => `<span class="adm-pill">${esc(k)}: <strong>${v}</strong></span>`).join(' ') || 'Nessuna.'} · ultimi 7 giorni: ${mon.notifiche_7g}</p>
      <h4>Business</h4>
      <p><span class="adm-pill">modelli: <strong>${mon.business.modelli}</strong></span> <span class="adm-pill">ricorrenze attive: <strong>${mon.business.ricorrenze_attive}</strong></span>
        <span class="adm-pill">date da confermare: <strong>${mon.business.date_da_confermare}</strong></span> <span class="adm-pill">annunci con più posti: <strong>${mon.business.annunci_multi_posto}</strong></span></p>` : '<p>Dati non disponibili.</p>'}
  </section>

  <section class="admin__blocco" id="adm-flag"><h3>Interruttori operativi</h3>
    <ul class="trust-flag adm-flag">${INTERRUTTORI.map(([k, t]) => { const on = impostazioni[k] === true
      return `<li><span>${esc(t)}</span>${prova ? `<strong class="${on ? 'acceso' : ''}">${on ? 'acceso' : 'spento'}</strong>` : `<button type="button" class="interruttore-btn ${on ? 'acceso' : ''}" data-adm-o="flag" data-k="${k}" data-v="${on ? 'false' : 'true'}" aria-pressed="${on}">${on ? 'Acceso' : 'Spento'}</button>`}</li>` }).join('')}</ul>
    <h4>Bloccati (non si accendono dal pannello)</h4>
    <ul class="trust-flag">${BLOCCATI.map(([k, t]) => `<li><span>${esc(t)}</span><strong>spento · bloccato</strong></li>`).join('')}</ul>
    <p class="finestra__nota">Questi restano spenti anche nel database: serve prima un’integrazione vera (SPID/CIE) o una valutazione legale. Biometria, penalità automatiche e badge per le aziende sono esclusi dalle regole del progetto.</p>
    <p class="finestra__nota" data-adm-o-msg role="status"></p>
  </section>`
}

// true se gestito. ricarica(): ricarica i dati e ridisegna
export async function gestisciOperativo(b, { rpc, ricarica, apriFirmato }) {
  const k = b.dataset.admO; const id = b.dataset.id; const v = b.dataset.v
  const msg = (t) => { const m = document.querySelector('[data-adm-o-msg]'); if (m) m.textContent = t }
  const motivo = (domanda) => { const r = window.prompt(domanda); return r && r.trim().length >= 3 ? r.trim() : null }
  try {
    if (k === 'mancata') { const m = motivo('Motivazione della decisione (la leggono entrambe le parti):'); if (!m) return; await rpc('admin_decidi_mancata_presentazione', { p_id: id, p_esito: v, p_motivo: m }) }
    if (k === 'seg') { const m = ['risolta', 'archiviata', 'info_richieste'].includes(v) ? motivo(v === 'info_richieste' ? 'Quali informazioni servono?' : 'Esito (lo vede chi ha segnalato):') : 'Presa in carico'; if (!m) return; await rpc('admin_gestisci_segnalazione', { p_id: Number(id), p_stato: v, p_esito: m }) }
    if (k === 'rimuovi-rec') { const m = motivo('Perché rimuovi questa recensione? (almeno 5 caratteri)'); if (!m || m.length < 5) return; await rpc('admin_rimuovi_recensione', { p_id: id, p_motivo: m }) }
    if (k === 'cont') await rpc('admin_chiudi_contestazione', { p_id: id, p_esito: v })
    if (k === 'flag') await rpc('admin_imposta', { p_chiave: b.dataset.k, p_valore: v === 'true' })
    if (k === 'allegato') return apriFirmato('segnalazioni', b.dataset.p)
    await ricarica()
  } catch (e) {
    msg(/bloccata/.test(String(e?.message)) ? 'Questa funzione è bloccata.' : 'Operazione non riuscita: riprova.')
  }
}
