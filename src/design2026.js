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
