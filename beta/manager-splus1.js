(()=>{
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const money=v=>num(v).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' k€';
const monday=d=>{const a=new Date(d.getFullYear(),d.getMonth(),d.getDate(),12);a.setDate(a.getDate()-(a.getDay()+6)%7);return [a.getFullYear(),String(a.getMonth()+1).padStart(2,'0'),String(a.getDate()).padStart(2,'0')].join('-')};
const addDays=(iso,n)=>{const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const dateFr=iso=>new Date(iso+'T12:00:00').toLocaleDateString('fr-FR');
let week=addDays(monday(new Date()),7),busy=false,loaded=false;
const profileNow=()=>{try{return profile||currentProfile||null}catch(e){return null}};
const db=()=>{try{return sb}catch(e){return null}};
function mount(){
 const p=profileNow(),shell=document.getElementById('rexShellV3');
 if(!p||!shell)return false;
 if(p.role!=='admin')return true;
 if(document.getElementById('rexSplus1Page'))return true;
 const nav=shell.querySelector('.rex-nav'),main=shell.querySelector('.rex-content');if(!nav||!main)return false;
 const style=document.createElement('style');style.textContent=`
 #rexSplus1Page{padding:0 0 28px;color:#173252}
 #rexSplus1Page .s1-head{display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:15px}
 #rexSplus1Page .s1-head h2{margin:0;color:#12345c}
 #rexSplus1Page .s1-head p{font-size:12px;color:#64748b;margin:5px 0}
 #rexSplus1Page .s1-panel{background:white;border:1px solid #dce6f1;border-radius:13px;padding:17px;margin:12px 0}
 #rexSplus1Page .s1-totals{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px}
 #rexSplus1Page .s1-stat{background:#f2f7fd;border-radius:10px;padding:12px}
 #rexSplus1Page .s1-stat small{color:#66809e;font-weight:700}
 #rexSplus1Page .s1-stat strong{display:block;font-size:21px;margin-top:6px;color:#123e70}
 #rexSplus1Page .s1-scroll{overflow:auto}
 #rexSplus1Page table{width:100%;border-collapse:collapse;min-width:780px;font-size:12px}
 #rexSplus1Page th,#rexSplus1Page td{padding:10px;text-align:left;border-bottom:1px solid #e6edf4}
 #rexSplus1Page th{background:#f5f8fc;color:#456584}
 #rexSplus1Page .s1-muted{font-size:12px;color:#64748b}
 #rexSplus1Page .s1-error{color:#b42318;font-weight:700}
 `;document.head.appendChild(style);
 const button=document.createElement('button');button.type='button';button.dataset.page='splus1';button.textContent='📅 Prévisions S+1';nav.appendChild(button);
 const page=document.createElement('section');page.className='rex-page';page.id='rexSplus1Page';page.dataset.page='splus1';
 page.innerHTML='<div class="s1-head"><div><h2>Prévisions commerciales S+1</h2><p>Projets annoncés par les vendeurs dans leur Point du vendredi — pas des signatures.</p></div><div><label for="rexS1Week">Semaine du </label><input type="date" id="rexS1Week"><button id="rexS1Reload" type="button">Actualiser</button></div></div><div id="rexS1Output" class="s1-panel">Ouvre cet onglet pour charger les prévisions.</div>';
 main.appendChild(page);
 const input=page.querySelector('#rexS1Week');input.value=week;
 const show=()=>{shell.querySelectorAll('.rex-page').forEach(el=>el.classList.toggle('active',el===page));shell.querySelectorAll('.rex-nav button').forEach(el=>el.classList.toggle('active',el===button));load()};
 button.addEventListener('click',show);
 input.addEventListener('change',()=>{if(!input.value)return;week=monday(new Date(input.value+'T12:00:00'));input.value=week;load()});
 page.querySelector('#rexS1Reload').addEventListener('click',load);
 return true;
}
async function load(){
 if(busy)return;const out=document.getElementById('rexS1Output'),client=db();if(!out||!client)return;
 busy=true;out.textContent='Chargement des prévisions S+1…';
 try{
  const [people,plans]=await Promise.all([
   client.from('profiles').select('user_id,display_name,sector_id').eq('role','seller').order('sector_id'),
   client.from('weekly_forecasts').select('id,user_id,week_start,company_name,amount,client_type,sale_type,probability,negotiation_meeting_scheduled').eq('week_start',week)
  ]);
  if(people.error)throw people.error;if(plans.error)throw plans.error;
  const sellers=people.data||[],rows=plans.data||[];
  const total=rows.reduce((a,r)=>a+num(r.amount),0),nc=rows.filter(r=>r.client_type==='nouveau').reduce((a,r)=>a+num(r.amount),0);
  const stat=(name,value)=>'<div class="s1-stat"><small>'+esc(name)+'</small><strong>'+esc(value)+'</strong></div>';
  let html='<div class="s1-totals">'+stat('Affaires prévues',String(rows.length))+stat('Potentiel total',money(total))+stat('NC',money(nc))+stat('Clients existants',money(total-nc))+'</div>';
  html+='<p class="s1-muted">Semaine du '+esc(dateFr(week))+' au '+esc(dateFr(addDays(week,6)))+'. Données lues directement dans les prévisions renseignées par les vendeurs, sans double saisie.</p>';
  html+='<div class="s1-scroll"><table><thead><tr><th>Commercial</th><th>Affaires</th><th>NC</th><th>RNV / UC</th><th>Total</th></tr></thead><tbody>';
  for(const seller of sellers){
   const mine=rows.filter(r=>r.user_id===seller.user_id),n=mine.filter(r=>r.client_type==='nouveau').reduce((a,r)=>a+num(r.amount),0),t=mine.reduce((a,r)=>a+num(r.amount),0);
   html+='<tr><td><b>'+esc(seller.display_name||'Commercial')+'</b></td><td>'+mine.length+'</td><td>'+money(n)+'</td><td>'+money(t-n)+'</td><td><b>'+money(t)+'</b></td></tr>';
  }
  html+='</tbody></table></div>';
  html+='<details style="margin-top:16px"><summary style="cursor:pointer;font-weight:800">Voir toutes les affaires ('+rows.length+')</summary><div class="s1-scroll"><table><thead><tr><th>Commercial</th><th>Entreprise</th><th>Type</th><th>Montant</th><th>Probabilité</th><th>RDV négo</th></tr></thead><tbody>';
  const names=new Map(sellers.map(s=>[s.user_id,s.display_name||'Commercial']));
  for(const row of rows){
   const typ=row.client_type==='nouveau'?'NC':row.sale_type==='up_sell'||row.sale_type==='cross_sell'?'UC':'RNV';
   html+='<tr><td>'+esc(names.get(row.user_id)||'—')+'</td><td>'+esc(row.company_name||'—')+'</td><td>'+typ+'</td><td>'+money(row.amount)+'</td><td>'+esc(String(num(row.probability)))+' %</td><td>'+(row.negotiation_meeting_scheduled?'Oui':'Non')+'</td></tr>';
  }
  html+='</tbody></table></div></details>';
  out.innerHTML=html;loaded=true;
 }catch(e){out.innerHTML='<p class="s1-error">Impossible de charger les prévisions : '+esc(e?.message||e)+'</p>';}
 finally{busy=false}
}
let tries=0;const timer=setInterval(()=>{tries++;if(mount()||tries>=30)clearInterval(timer)},600);
})();
