(()=>{
'use strict';
const GROUPS=[
 {key:'results',title:'Résultats & santé commerciale',ids:['dashboardSalesKpis','rexHistoryComparison']},
 {key:'forecast',title:'Ventes & prévisions',ids:['rexLiveSalesPerformance','rexManagerForecastReliability']},
 {key:'friday',title:'Contrôle du vendredi',ids:['rexFridayCrmReport']}
];
const state={results:true,forecast:false,friday:false};
function manager(){try{return (profile||currentProfile)?.role==='admin'}catch(e){return false}}
function setup(){
 if(!manager())return false;
 const page=document.querySelector('.rex-page[data-page="dashboard"]');
 if(!page||!page.querySelector('#rexHistoryComparison'))return false;
 if(document.getElementById('rexManagerNavigation'))return true;
 const style=document.createElement('style');
 style.textContent='#rexManagerNavigation{margin:14px 0;padding:13px;border:1px solid #dce6f2;border-radius:12px;background:#fff}#rexManagerNavigation h3{font-size:17px;margin:0 0 10px;color:#123c68}#rexManagerNavigation .rmn-buttons{display:flex;flex-wrap:wrap;gap:8px}#rexManagerNavigation button{border:1px solid #cbdcec;border-radius:9px;padding:11px 13px;color:#154575;background:#f5f9ff;cursor:pointer}#rexManagerNavigation button[aria-expanded=true]{background:#deefff;border-color:#2b73b6}#rexManagerNavigation .rmn-explain{font-size:11px;color:#657e96;margin-top:9px}.rex-dashboard-folded{display:none!important}';
 document.head.appendChild(style);
 const nav=document.createElement('section');nav.id='rexManagerNavigation';
 nav.innerHTML='<h3>Pilotage de mon agence</h3><div class="rmn-buttons"></div><div class="rmn-explain">Ouvre uniquement les analyses utiles. Les affaires levées ne sont pas des signatures.</div>';
 const row=nav.querySelector('.rmn-buttons');
 for(const group of GROUPS){
  const btn=document.createElement('button');btn.type='button';btn.dataset.group=group.key;btn.textContent=group.title;
  btn.addEventListener('click',()=>{state[group.key]=!state[group.key];apply();});
  row.appendChild(btn);
 }
 const btn=document.createElement('button');btn.type='button';btn.textContent='Affaires créées · RNV / NC / UC';
 btn.addEventListener('click',()=>{
  state.results=true;apply();
  const d=document.getElementById('rxAgencyPortfolio');
  if(d){d.open=true;d.scrollIntoView({behavior:'smooth',block:'center'});}
 });
 row.appendChild(btn);
 const head=page.querySelector('.rex-page-head');
 if(head)head.insertAdjacentElement('afterend',nav);else page.prepend(nav);
 apply();
 return true;
}
function apply(){
 const nav=document.getElementById('rexManagerNavigation');if(!nav)return;
 for(const group of GROUPS){
  nav.querySelector('[data-group="'+group.key+'"]')?.setAttribute('aria-expanded',String(state[group.key]));
  for(const id of group.ids){const node=document.getElementById(id);if(node)node.classList.toggle('rex-dashboard-folded',!state[group.key]);}
 }
}
let attempts=0;
const timer=setInterval(()=>{attempts++;if(setup()||attempts>35)clearInterval(timer)},600);
})();
