/* Point du vendredi : presentation manager et vendeur, sans changer les donnees. */
(()=>{
 const ROOT='fpCards', STYLE='fridayReadabilityV1';
 const state={tab:new Map(),filter:'all',sort:'sector',pending:false};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const sellers=()=>[...document.querySelectorAll('#fpCards > .fp-seller')];
 function uid(card,i){return card.querySelector('.fp-manager[id^="fpm_"]')?.id.slice(4)||card.querySelector('.fp-form[id^="fp_"]')?.id.slice(3)||card.querySelector('[data-fpa]')?.dataset.fpa||card.querySelector('[data-fpc]')?.dataset.fpc||'seller-'+i}
 function addStyle(){
  if(document.getElementById(STYLE))return;
  let el=document.createElement('style');el.id=STYLE;
  el.textContent=`
   #rexFridayPage .fp-tools{display:flex;align-items:end;gap:12px;flex-wrap:wrap;margin:0 0 14px;padding:13px;background:#fff;border:1px solid #e2e8f0;border-radius:14px}
   #rexFridayPage .fp-tools label{font-weight:800;font-size:11px;color:#475569;display:flex;flex-direction:column;gap:5px}
   #rexFridayPage .fp-tools select{border:1px solid #cbd5e1;padding:9px;border-radius:9px;background:#fff;min-width:145px}
   #rexFridayPage .fp-tools-note{font-size:11px;color:#64748b;margin-left:auto}
   #rexFridayPage .fp-headline-stats{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
   #rexFridayPage .fp-headline-stats .fp-mini{background:#f1f5f9;border-radius:8px;padding:6px 9px;font-size:11px;color:#334155;font-weight:700}
   #rexFridayPage .fp-headline-stats .fp-mini b{color:#0f172a}
   #rexFridayPage .fp-headline-stats .fp-mini.low{background:#fee2e2;color:#991b1b}
   #rexFridayPage .fp-headline-stats .fp-mini.mid{background:#fef3c7;color:#92400e}
   #rexFridayPage .fp-headline-stats .fp-mini.high{background:#dcfce7;color:#166534}
   #rexFridayPage .fp-overview{flex-basis:100%;display:flex;flex-direction:column;gap:7px}
   #rexFridayPage .fp-overview-progress{background:#e2e8f0;border-radius:999px;height:6px;overflow:hidden;width:100%}
   #rexFridayPage .fp-overview-fill{height:100%;background:#d97706;border-radius:999px;transition:width .2s}
   #rexFridayPage .fp-overview-fill.high{background:#16a34a}
   #rexFridayPage .fp-overview-fill.low{background:#dc2626}
   #rexFridayPage .fp-seller-head{align-items:center}
   #rexFridayPage .fp-tabs{display:flex;gap:5px;padding:5px;margin-bottom:12px;border-radius:12px;background:#e8eef5;flex-wrap:wrap}
   #rexFridayPage .fp-tabs button{border:0;background:transparent;color:#475569;border-radius:9px;font-size:12px;padding:10px 14px;flex:1;min-width:125px;font-weight:800}
   #rexFridayPage .fp-tabs button.active{background:#fff;color:#10233f;box-shadow:0 2px 9px rgba(0,0,0,.09)}
   #rexFridayPage .fp-body[data-fp-view="activity"]>[data-fp-panel]:not([data-fp-panel="activity"]),
   #rexFridayPage .fp-body[data-fp-view="sales"]>[data-fp-panel]:not([data-fp-panel="sales"]),
   #rexFridayPage .fp-body[data-fp-view="report"]>[data-fp-panel]:not([data-fp-panel="report"]),
   #rexFridayPage .fp-body[data-fp-view="forecast"]>[data-fp-panel]:not([data-fp-panel="forecast"]),
   #rexFridayPage .fp-body[data-fp-view="comment"]>[data-fp-panel]:not([data-fp-panel="comment"]){display:none!important}
   #rexFridayPage .fp-workflow{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
   #rexFridayPage .fp-workflow span{font-size:10px;padding:5px 8px;background:#f1f5f9;border-radius:999px;color:#64748b}
   #rexFridayPage .fp-workflow span.done{background:#dcfce7;color:#166534}
   #rexFridayPage .fp-manager{margin-bottom:14px;padding:14px;border:1px solid #dbe5f1;border-radius:12px;background:#fff}
   #rexFridayPage .fp-manager .fp-copy{display:none!important}
   #rexFridayPage .fpr-box .fpr-text{max-height:300px;overflow:auto;font-size:12px;line-height:1.65}
   #rexFridayPage .fpr-box .fpr-actions{display:flex;flex-wrap:wrap;gap:8px}
   @media(max-width:700px){#rexFridayPage .fp-tabs button{min-width:calc(50% - 5px)}#rexFridayPage .fp-tools label{flex:1}#rexFridayPage .fp-tools select{min-width:0;width:100%}}
  `;document.head.appendChild(el);
 }
 const money=(v)=>{let t=String(v||'').replace(/[^\d,.-]/g,'').replace(',','.');let n=Number(t);return Number.isFinite(n)?n:0};
 function metric(card,name){const x=[...card.querySelectorAll('.fp-metric')].find(el=>el.querySelector('span')?.textContent?.toLowerCase().includes(name));return x?.querySelector('b')?.textContent?.trim()||'—'}
 function numPercent(card){let el=[...card.querySelectorAll('.fp-metric em')];let vals=el.map(e=>Number(e.textContent.match(/(\d+)%/)?.[1])).filter(Number.isFinite);return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):0}
 function signed(card){const x=card.querySelector('.fps-kpis');let t=[...x?.querySelectorAll('.fps-pill')||[]].find(x=>/total signé/i.test(x.textContent));return t?.querySelector('b')?.textContent?.trim()||'—'}
 function sector(card){let m=card.querySelector('.fp-seller-head span')?.textContent?.match(/Secteur\s*(\d+)/i);return m?Number(m[1]):99}
 function status(percent){return percent>=100?'high':percent>=80?'mid':'low'}
 function info(card){
  let p=numPercent(card),head=card.querySelector('.fp-seller-head');if(!head)return;
  let over=head.querySelector('.fp-overview');if(!over){over=document.createElement('div');over.className='fp-overview';head.append(over)}
  const sig=[p,signed(card),metric(card,'rendez-vous')].join('|');
  if(over.dataset.sig===sig)return;over.dataset.sig=sig;
  over.innerHTML=`<div class="fp-headline-stats"><span class="fp-mini">CA signé <b>${esc(signed(card))}</b></span><span class="fp-mini">RDV <b>${esc(metric(card,'rendez-vous'))}</b></span><span class="fp-mini ${status(p)}">Objectifs <b>${p}%</b></span></div><div class="fp-overview-progress"><div class="fp-overview-fill ${status(p)}" style="width:${Math.min(p,100)}%"></div></div>`;
 }
 function category(node){
   if(node.matches('.fp-metrics,.fp-month,.fp-analysis,.fp-form'))return 'activity';
   if(node.matches('.fps-box'))return 'sales';
   if(node.matches('.fp-nextweek,.fp-forecast,.fp-nextweek-editor'))return 'forecast';
   if(node.matches('.fp-week-comment'))return 'comment';
   if(node.matches('.fpa-box,.fpc-box'))return 'report';
   if(node.matches('.fp-manager,.fpr-box,.fp-summary-box'))return 'report';
   return null;
 }
 function stage(card){
   let a=card.querySelector('.fp-form')?.querySelector('.fp-main-save');
   let signedCount=card.querySelectorAll('.fps-table tbody tr').length;
   let checks=[...card.querySelectorAll('.fpc-check input')];
   let report=card.querySelector('.fpr-text')?.value?.trim();
   return [
    ['Activité',!a||false],
    ['Ventes',signedCount>0],
    ['Contrôles',checks.length>0&&checks.every(c=>c.checked)],
    ['Actions',!!card.querySelector('.mgr-actions')?.value?.trim()],
    ['Prévision S+1',card.querySelectorAll('.fp-nextweek-editor tbody tr[data-id]').length>0],
    ['Commentaire',!!card.querySelector('.fp-week-comment textarea')?.value?.trim()],
    ['Compte rendu',!!report]
   ];
 }
 function configure(card,i){
   const id=uid(card,i),body=card.querySelector(':scope > .fp-body');if(!body)return;
   info(card);
   let tabs=body.querySelector(':scope > .fp-tabs');
   if(tabs&&tabs.querySelector('[data-view="actions"]')){tabs.remove();tabs=null;}
   if(!tabs){
    tabs=document.createElement('div');tabs.className='fp-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Rubriques du Point vendredi');
    for(const [k,label] of [['activity','Activité'],['sales','Ventes réalisées'],['forecast','Prév. S+1'],['comment','Commentaire'],['report','Compte rendu']]){
      const btn=document.createElement('button');btn.type='button';btn.dataset.view=k;btn.textContent=label;btn.setAttribute('role','tab');
      btn.addEventListener('click',()=>{state.tab.set(id,k);configure(card,i)});
      tabs.append(btn);
    }
    body.prepend(tabs);
   }
   const manager=body.querySelector(':scope > .fp-manager');
   const checklist=body.querySelector(':scope > .fpc-box');
   const actions=body.querySelector(':scope > .fpa-box');
   if(manager){
     if(actions&&actions.nextElementSibling!==manager)body.insertBefore(actions,manager);
     if(checklist&&checklist.nextElementSibling!==actions&&checklist.nextElementSibling!==manager)body.insertBefore(checklist,actions||manager);
   }
   const report=body.querySelector(':scope > .fpr-box');
   if(manager){
     const heading=manager.querySelector(':scope > b');
     if(heading&&heading.textContent!=='Synthèse de l’entretien et actions convenues')heading.textContent='Synthèse de l’entretien et actions convenues';
     const save=manager.querySelector('.fp-summary-btn');
     if(save&&save.textContent!=='Enregistrer la synthèse et les actions')save.textContent='Enregistrer la synthèse et les actions';
   }
   if(manager&&report&&manager.nextElementSibling!==report)body.insertBefore(manager,report);
   for(const child of [...body.children]){
     if(child===tabs||child.classList.contains('fp-workflow'))continue;
     let cat=category(child);
     if(cat&&child.dataset.fpPanel!==cat)child.dataset.fpPanel=cat;
   }
   let workflow=body.querySelector(':scope > .fp-workflow');
   if(!workflow){workflow=document.createElement('div');workflow.className='fp-workflow';tabs.insertAdjacentElement('afterend',workflow)}
   const current=state.tab.get(id)||'activity';if(body.dataset.fpView!==current)body.dataset.fpView=current;
   tabs.querySelectorAll('button').forEach(b=>{let active=b.dataset.view===current;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active))});
   // Indicateurs visuels seulement : ne marquent jamais automatiquement une saisie comme enregistrée.
   const stages=stage(card);
   const sig=JSON.stringify(stages);
   if(workflow.dataset.sig!==sig){workflow.dataset.sig=sig;workflow.innerHTML=stages.map(([label,done])=>`<span class="${done?'done':''}">${done?'✓ ':'○ '}${label}</span>`).join('')}
 }
 function controls(){
  const page=document.getElementById('rexFridayPage'),grid=document.getElementById(ROOT);if(!page||!grid)return;
  let bar=page.querySelector('.fp-tools');if(bar)return;
  bar=document.createElement('div');bar.className='fp-tools';bar.innerHTML='<label>Afficher<select class="fp-filter"><option value="all">Tous les secteurs</option></select></label><label>Trier par<select class="fp-sort"><option value="sector">Secteur</option><option value="percent-low">Objectifs à travailler</option><option value="ca-high">CA signé décroissant</option></select></label><span class="fp-tools-note">Clique sur un vendeur pour afficher son point.</span>';
  grid.parentNode.insertBefore(bar,grid);
  bar.querySelector('.fp-filter').onchange=e=>{state.filter=e.target.value;applyFilter()};
  bar.querySelector('.fp-sort').onchange=e=>{state.sort=e.target.value;applyFilter()};
 }
 function applyFilter(){
  const items=sellers();
  const options=[...new Set(items.map(sector).filter(n=>n<99))].sort((a,b)=>a-b);
  const filter=document.querySelector('#rexFridayPage .fp-filter');
  if(filter){
   let current=filter.value,html='<option value="all">Tous les secteurs</option>'+options.map(n=>`<option value="${n}">Secteur ${n}</option>`).join('');
   if(filter.innerHTML!==html){filter.innerHTML=html;filter.value=options.some(n=>String(n)===current)?current:'all';state.filter=filter.value}
  }
  const sortValues=items.map((card,index)=>({card,index,sector:sector(card),pct:numPercent(card),ca:money(signed(card))}));
  sortValues.sort((a,b)=>state.sort==='percent-low'?a.pct-b.pct:state.sort==='ca-high'?b.ca-a.ca:a.sector-b.sector||a.index-b.index);
  sortValues.forEach(({card,sector},i)=>{card.style.order=String(i);const hidden=state.filter!=='all'&&String(sector)!==state.filter;if(card.hidden!==hidden)card.hidden=hidden});
  // CSS order conserve l'ordre du DOM, indispensable aux modules métier qui indexent les vendeurs.
 }
 function enhance(){
   const root=document.getElementById(ROOT);if(!root)return;
   addStyle();controls();
   sellers().forEach(configure);
   applyFilter();
 }
 function schedule(){if(state.pending)return;state.pending=true;setTimeout(()=>{state.pending=false;enhance()},60)}
 function setup(){
   const root=document.getElementById(ROOT);if(!root)return false;
   if(root.dataset.fridayUiEnhanced==='1')return true;
   root.dataset.fridayUiEnhanced='1';
   new MutationObserver(schedule).observe(root,{subtree:true,childList:true});
   document.getElementById('fpWeek')?.addEventListener('change',()=>{state.tab.clear();schedule()});
   enhance();return true;
 }
 let tries=0;const timer=setInterval(()=>{tries++;if(setup()||tries>120)clearInterval(timer)},250);
 window.addEventListener('load',()=>setTimeout(setup,500));
})();
