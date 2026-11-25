import { mostraIncarichi, scegliCategoria } from './incarichi.js'
import { apriAccesso, avviaConto, candidati } from './conto.js'
import { avviaDisponibile, leggiDisponibile, quandoCambia } from './disponibile.js'
document.documentElement.classList.add('js')
const testata=document.querySelector('.testata')
addEventListener('scroll',()=>testata?.classList.toggle('scesa',scrollY>12),{passive:true})
// nastro di categorie dopo l'apertura
const ap=document.querySelector('.apertura')
if(ap){const v=['Banco bar','Servizio in sala','Aiuto cucina','Hotel e colazioni','Eventi','Negozi','Lavapiatti','Accoglienza'];const f=[...v,...v].map(t=>`<span>${t}</span>`).join('');const n=document.createElement('div');n.className='nastro';n.setAttribute('aria-hidden','true');n.innerHTML=`<div class="nastro__fila">${f}${f}</div>`;ap.after(n)}
// rivelazione
const io=new IntersectionObserver((es)=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visto');io.unobserve(e.target)}}),{threshold:.12,rootMargin:'0px 0px -6% 0px'})
document.querySelectorAll('.sezione h2,.sezione .intro,.per-chi__lato,.passo,.categoria,.piano,.mappa,.impegni__riga,.modulo,.sezione--domande details').forEach((el,i)=>{el.classList.add('rivela');el.style.setProperty('--ritardo',`${(i%4)*.08}s`);io.observe(el)})
// bagliore che segue il mouse
document.querySelectorAll('.passo,.piano').forEach(el=>{el.classList.add('bagliore');el.addEventListener('pointermove',e=>{const r=el.getBoundingClientRect();el.style.setProperty('--mx',`${e.clientX-r.left}px`);el.style.setProperty('--my',`${e.clientY-r.top}px`)})})
// gradiente luminoso per il segno del logo
const segno=document.querySelector('.marchio__segno')
if(segno){segno.insertAdjacentHTML('afterbegin','<defs><linearGradient id="luce-logo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#47835b"/><stop offset=".6" stop-color="#8fc15a"/><stop offset="1" stop-color="#c4db94"/></linearGradient></defs>')}
// ===== finestre (popup), annunci di esempio, accesso =====
const dlg=document.createElement('dialog');dlg.className='finestra';document.body.appendChild(dlg)
dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()})
const apri=(html)=>{dlg.innerHTML=`<button class="finestra__chiudi" type="button" aria-label="Chiudi">×</button>${html}`;dlg.querySelector('.finestra__chiudi').onclick=()=>dlg.close();dlg.showModal()}
const accesso=(prima)=>apriAccesso(prima)
document.addEventListener('click',e=>{const t=e.target.closest('[data-accedi]');if(t){e.preventDefault();accesso();const p=t.dataset.accedi;if(p==='google'||p==='apple')dlg.querySelector(`[data-provider=${p}]`)?.click()}})
const ANN_PERSONE=[
{t:'Marco, disponibile oggi',c:'Sala, bar',d:'Forlì, centro',q:'Oggi 18:00–23:00',e:'Automunito',x:'Qualche stagione di esperienza in bar e ristoranti.',r:['Disponibile subito']},
{t:'Giulia, disponibile nel weekend',c:'Babysitting, ripetizioni',d:'Forlì, periferia',q:'Sabato e domenica',e:'Con referenze',x:'Studia all’università e ama stare con i bambini.',r:['Referenze disponibili']},
{t:'Luca, disponibile domani',c:'Traslochi, eventi',d:'Cesena',q:'Domani 9:00–17:00',e:'Automunito',x:'Abituato a lavori di fatica e a squadre piccole.',r:['Si sposta anche a Forlì']}]
const tab=document.querySelector('[data-tabellone]'),box=document.querySelector('[data-annunci]')
const disegna=()=>{if(!tab||!box)return;const lav=tab.dataset.modo!=='personale',L=ANN_PERSONE;if(lav){mostraIncarichi(box,{apri,accesso,candidati});return}
const mia=leggiDisponibile()
const tu=mia?`<div class="annuncio annuncio--tu"><h3>Tu, disponibile ora</h3><span class="annuncio__euro">fino alle ${new Date(mia.fino).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</span><p>Così ti vede chi cerca personale: zona di Forlì, entro ${mia.km} km. Mai la posizione esatta.</p></div>`:''
box.innerHTML=tu+`<div class="annunci__cta"><p><strong>Cerchi qualcuno?</strong> Pubblica un incarico gratis: le persone disponibili si candidano.</p><button type="button" class="tasto" data-pubblica>+ Pubblica un incarico</button></div><p class="annunci__nota">${lav?'Annunci di esempio, non offerte reali. Clicca per aprire.':'Persone di esempio, non reali. Clicca per aprire.'}</p>`+L.map((a,i)=>`<button type="button" class="annuncio" data-i="${i}"><h3>${a.t}</h3><span class="annuncio__euro">${a.e}</span><p>${a.c} · ${a.d} · ${a.q}</p></button>`).join('')
box.querySelectorAll('.annuncio').forEach(b=>b.onclick=()=>{const a=L[b.dataset.i];apri(`<h2>${a.t}</h2><p><strong>${a.c}</strong><br>${a.d} · ${a.q}</p><div class="etichette"><span>${a.e}</span>${a.r.map(x=>`<span>${x}</span>`).join('')}</div><p>${a.x}</p><div class="finestra__azioni"><button class="tasto" type="button" data-cand>${lav?'Candidati':'Contatta'}</button><button class="tasto tasto--chiaro" type="button" data-ch>Chiudi</button></div><p class="finestra__nota">Esempio dimostrativo.</p>`);dlg.querySelector('[data-ch]').onclick=()=>dlg.close();dlg.querySelector('[data-cand]').onclick=()=>accesso(lav?'Per candidarti, accedi':'Per contattare, accedi')})}
let ultimoModo=null
if(tab&&box){new MutationObserver(()=>{if(tab.dataset.modo!==ultimoModo){ultimoModo=tab.dataset.modo
disegna()}}).observe(tab,{attributes:true,attributeFilter:['data-modo']})
ultimoModo=tab.dataset.modo;disegna()
document.querySelectorAll('[data-vista-tasto]').forEach(b=>b.addEventListener('click',()=>{const v=b.dataset.vistaTasto;tab.dataset.vista=v;box.hidden=v!=='annunci';document.querySelectorAll('[data-vista-tasto]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))}))}
// ===== di dove sei =====
document.querySelectorAll('[data-dove] .chips').forEach(g=>g.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-multi'))b.setAttribute('aria-pressed',String(b.getAttribute('aria-pressed')!=='true'));else{g.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))}
const c=document.querySelector('[data-gruppo=citta] [aria-pressed=true]');const n=document.querySelector('[data-nota-citta]');if(n&&c)n.hidden=c.textContent==='Forlì'}))

// ===== categorie: un tocco apre la bacheca già filtrata =====
document.querySelectorAll('[data-categoria]').forEach(c=>c.addEventListener('click',()=>{scegliCategoria(c.dataset.categoria)
document.querySelector('[data-modo-tasto=lavoro]')?.click()
document.querySelector('[data-vista-tasto=annunci]')?.click()
if(box&&tab)mostraIncarichi(box,{apri,accesso,candidati})
document.querySelector('.apertura .tabellone')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})}))

// ===== disponibile ora =====
avviaDisponibile({apri})
quandoCambia(()=>{if(tab&&box&&tab.dataset.modo==='personale')disegna()})

// ===== account e area personale =====
avviaConto({apri})
