(function comparisonModule(){
 'use strict';
 const ROOT='rexHistoryComparison';
 const MONTHS=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
 const currency=new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2});
 const fmt=c=>c==null?'Non renseigné':currency.format(c/100);
 const short=c=>c==null?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(c/100000)+' k€';
 const money=x=>Math.round(Number(x||0)*100);
 const kilo=x=>Math.round(Number(x||0)*100000);
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const iso=(y,m)=>`${y}-${String(m).padStart(2,'0')}`;
 const prev=(y,m)=>m===1?{year:y-1,month:12}:{year:y,month:m-1};
 const fiscal=(y,m)=>({fiscal_start_year:m>=4?y:y-1,month_index:m>=4?m-3:m+9});
 const getSb=()=>{try{return sb}catch(e){return null}};
 const getProfile=()=>{try{return profile||currentProfile||null}catch(e){return null}};
 const getUser=()=>{try{return user||currentUser||null}catch(e){return null}};
 const isAdmin=()=>getProfile()?.role==='admin';
 const page=()=>document.querySelector('.rex-page[data-page="dashboard"]');
 const now=new Date();
 let year=now.getFullYear(),month=now.getMonth()+1,people=[],selectedSeller='',metric='ca',
     rows=[],sales=[],loaded=false,busy=false,pending=false,saving=false,lastFetch=0,timer=null,
     message='',messageType='',editorOpen=false,historyOpen=true,active=false,lastOutput='';
 function rowKey(uid,y,m){return `${uid}|${iso(y,m)}`}
 function historyMap(records){
   const map=new Map();
   for(const r of records){
     const fy=Number(r.fiscal_start_year),idx=Number(r.month_index);
     if(idx<1||idx>12)continue;
     const cy=idx<=9?fy:fy+1, cm=idx<=9?idx+3:idx-9;
     map.set(rowKey(r.user_id,cy,cm),r);
   }
   return map;
 }
 function signedMap(deals){
   const map=new Map();
   for(const x of deals){
     const date=String(x.signature_date||'').slice(0,7),user=x.user_id;
     if(!/^\d{4}-\d{2}$/.test(date)||!user)continue;
     const k=`${user}|${date}`,v=map.get(k)||{ca:0,nc:0,upcross:0,count:0};
     const amount=money(x.signed_amount_eur);
     v.ca+=amount;
     if(x.client_type==='nouveau')v.nc+=amount;
     if(x.client_type==='acquis'&&['up_sell','cross_sell'].includes(x.sale_type))v.upcross+=amount;
     v.count++;
     map.set(k,v);
   }
   return map;
 }
 function compute(){
   const hist=historyMap(rows),current=signedMap(sales);
   const first=monthFirst(sales);
   function monthFirst(s){const sorted=s.filter(x=>x.signature_date).map(x=>String(x.signature_date).slice(0,7)).sort();return sorted[0]||null}
   // Avant la première signature enregistrée, les archives mensuelles sont incomplètes.
   const nowPeriod=iso(now.getFullYear(),now.getMonth()+1);
   const currentData=(uid,y,m,field)=>{
     if(iso(y,m)>nowPeriod||!first||iso(y,m)<first)return null;
     return current.get(rowKey(uid,y,m))?.[field]??0;
   };
   const historicalData=(uid,y,m,field)=>{
     const x=hist.get(rowKey(uid,y,m));return x? kilo(x[field]):null;
   };
   const sumMaybe=(items)=>{const entries=items.filter(x=>x!=null);return entries.length?entries.reduce((a,b)=>a+b,0):null};
   const actual=(uid,y,m,field)=>currentData(uid,y,m,field);
   const historic=(uid,y,m,field)=>historicalData(uid,y,m,field);
   // Un total agence n'est comparable que si chaque vendeur possède une ligne
   // d'historique N-1. Sinon, signaler clairement la donnée manquante.
   const totals=(y,m,field,source)=>{
     const entries=people.map(p=>source(p.user_id,y,m,field));
     return entries.length&&entries.every(v=>v!==null)?entries.reduce((a,b)=>a+b,0):null;
   };
   const before=prev(year,month);
   const totCur=totals(year,month,'ca',actual),totPrev=totals(before.year,before.month,'ca',actual),
      totLast=totals(year-1,month,'ca',historic);
   const data=people.map(p=>{
     const get=(y,m,field)=>actual(p.user_id,y,m,field);
     const histGet=(y,m,field)=>historic(p.user_id,y,m,field);
     return {person:p,ca:get(year,month,'ca'),nc:get(year,month,'nc'),uc:get(year,month,'upcross'),
       prev:get(before.year,before.month,'ca'),last:histGet(year-1,month,'ca'),
       lastNc:histGet(year-1,month,'nc'),lastUc:histGet(year-1,month,'upcross')};
   });
   return {hist,current,first,nowPeriod,currentData,historicalData,actual,historic,totals,before,totCur,totPrev,totLast,data};
 }
 function delta(value,base){
   if(value==null||base==null)return '<span class="rxh-muted">—</span>';
   if(base===0)return '<span class="rxh-muted">—</span>';
   const n=(value-base)/base*100;
   return `<span class="${n>=0?'rxh-plus':'rxh-minus'}">${n>=0?'↗ +':'↘ −'}${Math.abs(n).toFixed(1).replace('.',',')} %</span>`;
 }
 function mount(){
   if(!isAdmin()){document.getElementById(ROOT)?.remove();return null}
   const p=page();if(!p)return null;
   let el=document.getElementById(ROOT);
   if(!el){el=document.createElement('section');el.id=ROOT;el.className='rxh-root';el.innerHTML='<p>Chargement des comparaisons…</p>';p.appendChild(el);}
   const target=p.querySelector('#dashboardSalesKpis')||p.querySelector('.rex-page-head');
   if(target&&target.nextElementSibling!==el)target.insertAdjacentElement('afterend',el);
   return el;
 }
 function setMessage(text,type='ok'){
   message=text;messageType=type;
   const node=document.getElementById(ROOT)?.querySelector('#rxhMessage');
   if(node){node.textContent=text;node.className=type==='error'?'rxh-error':'rxh-ok'}
 }
 function draw(){
   const box=mount();if(!box||!loaded)return;
   if(box.querySelector('.rxh-history-editor input:focus'))return;
   const result=compute(),{hist,data,totCur,totPrev,totLast,before}=result;
   const mlabel=MONTHS[month-1],name=people.find(p=>p.user_id===selectedSeller)?.display_name||'Commercial';
   const years=[year,year-1],historyYear=year-1;
   const metricLabel=metric==='ca'?'CA':metric==='nc'?'NC':'UC';
   const chartPoints=MONTHS.map((m,i)=>{
     const cm=i+1;
     const curr=result.actual(selectedSeller,year,cm,metric);
     const last=result.historic(selectedSeller,year-1,cm,metric);
     return {name:m.slice(0,3)+'.',curr,last,cm};
   });
   const amounts=chartPoints.flatMap(x=>[x.curr,x.last]).filter(x=>x!=null);
   const maximum=Math.max(1,...amounts);
   const pct=(v)=>v==null?0:Math.max(1,Math.round(v/maximum*100));
   const historyRows=MONTHS.map((m,i)=>{
     const cm=i+1,x=hist.get(rowKey(selectedSeller,historyYear,cm));
     const input=(field)=>{
       const value=x?Number(x[field])*1000:null;
       return `<input class="rxh-input" type="number" inputmode="decimal" step="0.01" min="0" data-month="${cm}" data-field="${field}" aria-label="${safe(m)} ${field.toUpperCase()}" placeholder="—" value="${value===null?'':String(Math.round(value*100)/100)}">`;
     };
     return `<tr data-month="${cm}"><td>${safe(m)}</td><td>${input('ca')}</td><td>${input('nc')}</td><td>${input('upcross')}</td><td><span class="${x?'rxh-entered':'rxh-muted'}">${x?'Enregistré':'À saisir'}</span></td></tr>`;
   }).join('');
   const dataRows=data.map(d=>`<tr><th scope="row">${safe(d.person.display_name||'Commercial')} <small>S${safe(d.person.sector_id||'—')}</small></th>
        <td><strong>${fmt(d.ca)}</strong></td><td>${fmt(d.prev)}</td><td>${fmt(d.last)}</td>
        <td>${delta(d.ca,d.prev)}</td><td>${delta(d.ca,d.last)}</td>
        <td>${fmt(d.nc)}</td><td>${fmt(d.uc)}</td></tr>`).join('');
   const summary=`<tr class="rxh-total"><th>Agence Corrèze</th><td>${fmt(totCur)}</td><td>${fmt(totPrev)}</td><td>${fmt(totLast)}</td><td>${delta(totCur,totPrev)}</td><td>${delta(totCur,totLast)}</td>
        <td>${fmt(result.totals(year,month,'nc',result.actual))}</td><td>${fmt(result.totals(year,month,'upcross',result.actual))}</td></tr>`;
   const nonEntered=people.filter(p=>!hist.get(rowKey(p.user_id,historyYear,month))).length;
   const output=JSON.stringify([year,month,people,data,rows,sales,metric,selectedSeller,editorOpen,historyOpen,message,messageType]);
   if(lastOutput===output&&box.querySelector('#rxhMonth'))return;
   const layout=`<div class="rxh-heading">
      <div><div class="rxh-eyebrow">CRM REX-ROTARY CORRÈZE · VUE RESPONSABLE</div><h3>Analyse comparative des résultats</h3>
       <p>CA signé du CRM comparé aux chiffres N-1 saisis par le responsable.</p></div>
      <div class="rxh-controls"><label for="rxhMonth">Période</label><input type="month" id="rxhMonth" value="${iso(year,month)}"><button id="rxhReload" type="button">↻ Actualiser</button></div>
     </div>
     <div class="rxh-kpis">
       <article class="rxh-kpi"><span>CA réalisé · ${safe(mlabel)} ${year}</span><strong>${fmt(totCur)}</strong><small>${totCur==null?'Non disponible': 'Signatures validées en euros'}</small></article>
       <article class="rxh-kpi"><span>CA M-1 · ${safe(MONTHS[before.month-1])} ${before.year}</span><strong>${fmt(totPrev)}</strong><small>${delta(totCur,totPrev)} par rapport à M-1</small></article>
       <article class="rxh-kpi"><span>CA N-1 · ${safe(mlabel)} ${historyYear}</span><strong>${fmt(totLast)}</strong><small>${delta(totCur,totLast)} par rapport à N-1</small></article>
       <article class="rxh-kpi"><span>Écart € vs N-1</span><strong>${totCur==null||totLast==null?'—':fmt(totCur-totLast)}</strong><small>${totLast==null?`${nonEntered} vendeur(s) encore à renseigner`:'Comparaison des deux mêmes mois'}</small></article>
     </div>
     <div class="rxh-panel"><div class="rxh-panel-head"><div><h4>Performance des commerciaux</h4><p>Évolution CA individuel : mois actuel, M-1 et même mois l'année précédente</p></div></div>
     <div class="rxh-scroll"><table class="rxh-table"><thead><tr><th>Commercial</th><th>CA actuel</th><th>CA M-1</th><th>CA N-1</th><th>Vs M-1</th><th>Vs N-1</th><th>NC actuel</th><th>UC actuel</th></tr></thead><tbody>${dataRows}${summary}</tbody></table></div></div>
     <div class="rxh-panel"><div class="rxh-panel-head rxh-historic-head"><div><h4>Historique mensuel par vendeur</h4><p>${metricLabel} ${year} / ${historyYear} · seules les périodes renseignées sont représentées.</p></div>
       <div class="rxh-small-controls"><label for="rxhSeller">Commercial</label><select id="rxhSeller">${people.map(p=>`<option value="${safe(p.user_id)}" ${p.user_id===selectedSeller?'selected':''}>${safe(p.display_name||'Commercial')}</option>`).join('')}</select>
       <label for="rxhMetric">Indicateur</label><select id="rxhMetric"><option value="ca" ${metric==='ca'?'selected':''}>CA</option><option value="nc" ${metric==='nc'?'selected':''}>NC</option><option value="upcross" ${metric==='upcross'?'selected':''}>UC</option></select></div></div>
     <div class="rxh-legend"><i class="rxh-current-key"></i>${year} (signatures CRM) <i class="rxh-historic-key"></i>${historyYear} (historique saisi)</div>
     <div class="rxh-chart" role="img" aria-label="Comparaison ${metricLabel} par mois pour ${safe(name)} entre ${year} et ${historyYear}">
        ${chartPoints.map(x=>`<div class="rxh-chart-col"><div class="rxh-bars">
            <span class="rxh-bar rxh-bar-current ${x.curr==null?'rxh-no-data':''}" title="${safe(x.name)} ${year} : ${fmt(x.curr)}" style="height:${pct(x.curr)}%"></span>
            <span class="rxh-bar rxh-bar-last ${x.last==null?'rxh-no-data':''}" title="${safe(x.name)} ${historyYear} : ${fmt(x.last)}" style="height:${pct(x.last)}%"></span>
           </div><small>${safe(x.name)}</small></div>`).join('')}
     </div>
     <p class="rxh-note">Les ventes de l'année en cours proviennent des signatures validées dans « Prévisionnel mois ». Les archives N-1 proviennent de la saisie CA / NC / UC ci-dessous. Une cellule « Non renseigné » ne représente pas 0 €. Le total N-1 agence reste indisponible si un vendeur manque. Le NC et l'UC sont inclus dans le CA.</p></div>
     <details class="rxh-editor" id="rxhEditor" ${editorOpen?'open':''}>
       <summary>✎ Saisir ou corriger le CA, NC et UC de ${historyYear}, mois par mois et par vendeur</summary>
       <p>Uniquement visible et modifiable par le responsable. Montants à saisir en <b>euros</b> : ils sont enregistrés dans le suivi CA fiscal existant (qui utilise les k€).</p>
       <div class="rxh-editor-select"><label for="rxhEntrySeller">Vendeur à renseigner</label>
        <select id="rxhEntrySeller">${people.map(p=>`<option value="${safe(p.user_id)}" ${p.user_id===selectedSeller?'selected':''}>${safe(p.display_name||'Commercial')}</option>`).join('')}</select>
        <span>Année civile ${historyYear} · 12 mois</span>
       </div>
       <form id="rxhForm" class="rxh-history-editor"><div class="rxh-scroll"><table class="rxh-table rxh-entry-table"><thead><tr><th>Mois</th><th>CA (€)</th><th>NC (€)</th><th>UC (€)</th><th>État</th></tr></thead><tbody>${historyRows}</tbody></table></div>
       <div class="rxh-save-actions"><button class="rxh-primary" type="submit" id="rxhSave" ${saving?'disabled':''}>${saving?'Enregistrement…':'Enregistrer les 12 mois'}</button><span>Les lignes vides ne sont pas enregistrées. Une ligne commencée doit contenir les trois montants, y compris 0.</span></div></form>
     </details>
     <p class="rxh-${messageType==='error'?'error':'ok'}" id="rxhMessage" role="status">${safe(message)}</p>`;
   box.innerHTML=layout;
   const monthInput=box.querySelector('#rxhMonth');
   monthInput.onchange=e=>{
     if(box.querySelector('#rxhForm')?.dataset.dirty==='1'&&!confirm('Des chiffres historiques sont en cours de saisie. Changer de période sans les enregistrer ?')){
       e.target.value=iso(year,month);return;
     }
     const [y,m]=String(e.target.value).split('-').map(Number);
     if(y>=2020&&y<=2099&&m>=1&&m<=12){year=y;month=m;lastOutput='';load()}
   };
   box.querySelector('#rxhReload').onclick=()=>load();
   box.querySelector('#rxhSeller').onchange=e=>{selectedSeller=e.target.value;lastOutput='';draw()};
   box.querySelector('#rxhMetric').onchange=e=>{metric=e.target.value;lastOutput='';draw()};
   box.querySelector('#rxhEntrySeller').onchange=e=>{if(box.querySelector('#rxhForm')?.dataset.dirty==='1'&&!confirm('Les modifications en cours ne sont pas enregistrées. Changer de vendeur ?')){e.target.value=selectedSeller;return}selectedSeller=e.target.value;lastOutput='';draw()};
   const editor=box.querySelector('#rxhEditor');
   editor.addEventListener('toggle',()=>{editorOpen=editor.open});
   const form=box.querySelector('#rxhForm');
   form.addEventListener('input',()=>{form.dataset.dirty='1'});
   form.onsubmit=e=>{e.preventDefault();saveHistory(form)};
   lastOutput=output;
 }
 async function saveHistory(form){
   const client=getSb(),user=getUser();
   if(!isAdmin()||!client||!user||saving)return;
   const hist=historyMap(rows),periodYear=year-1,uid=selectedSeller;
   const changes=[];
   for(const tr of form.querySelectorAll('tbody tr[data-month]')){
     const m=Number(tr.dataset.month);
     const values={};
     let count=0;
     for(const field of ['ca','nc','upcross']){
       const v=tr.querySelector(`input[data-field="${field}"]`)?.value?.trim()||'';
       if(v!=='')count++;
       if(v&&!/^\d+(\.\d{1,2})?$/.test(v)){setMessage(`Montant ${field.toUpperCase()} incorrect pour ${MONTHS[m-1]} : deux décimales maximum.`,'error');return}
       values[field]=v===''?null:Number(v);
       if(values[field]!=null&&(!Number.isFinite(values[field])||values[field]>100000000)){setMessage('Montant trop important ou incorrect.','error');return}
     }
     const original=hist.get(rowKey(uid,periodYear,m));
     if(count===0){if(original){setMessage(`Pour ${MONTHS[m-1]}, les anciens chiffres sont enregistrés : ne vide pas toute la ligne pour les effacer. Saisis des zéros pour indiquer un mois nul.`,'error');return}continue}
     if(count!==3){setMessage(`${MONTHS[m-1]} : complète CA, NC et UC (mets 0 si nécessaire).`,'error');return}
     if(values.nc>values.ca||values.upcross>values.ca){setMessage(`${MONTHS[m-1]} : NC et UC ne doivent pas dépasser le CA.`,'error');return}
     const f=fiscal(periodYear,m);
     const change={fiscal_start_year:f.fiscal_start_year,month_index:f.month_index,user_id:uid,
       ca:Math.round(values.ca*100)/100/1000,
       nc:Math.round(values.nc*100)/100/1000,
       upcross:Math.round(values.upcross*100)/100/1000,
       sector_id:people.find(p=>p.user_id===uid)?.sector_id||null,
       updated_at:new Date().toISOString(),updated_by:user.id};
     if(original&&['ca','nc','upcross'].every(k=>Math.round(Number(original[k])*100000)===Math.round(Number(change[k])*100000)))continue;
     changes.push(change);
   }
   if(!changes.length){setMessage('Aucune nouvelle donnée à enregistrer.');return}
   saving=true;const btn=form.querySelector('#rxhSave');btn.disabled=true;btn.textContent='Enregistrement…';
   try{
     const result=await client.from('seller_monthly_sales').upsert(changes,{onConflict:'fiscal_start_year,user_id,month_index'});
     if(result.error)throw result.error;
     message=`${changes.length} mois enregistré${changes.length>1?'s':''} pour ${people.find(p=>p.user_id===uid)?.display_name||'le commercial'}.`;
     messageType='ok';lastOutput='';
     form.dataset.dirty='0';
     await load();
   }catch(e){setMessage('Impossible de sauvegarder les chiffres historiques : '+String(e?.message||e),'error')}
   finally{saving=false;btn.disabled=false;btn.textContent='Enregistrer les 12 mois'}
 }
 async function load(){
   if(!isAdmin())return;
   const client=getSb(),box=mount();if(!client||!box)return;
   if(busy){pending=true;return}
   if(box.querySelector('#rxhForm')?.dataset.dirty==='1'&&loaded){setMessage('Saisie en cours : enregistre les chiffres historiques avant d’actualiser.','error');return}
   busy=true;lastFetch=Date.now();
   const currentYear=year,prevYear=year-1;
   try{
     const [pr,sa,hi]=await Promise.all([
       client.from('profiles').select('user_id,display_name,role,sector_id').eq('role','seller').order('sector_id'),
       client.from('monthly_forecasts').select('user_id,signature_date,signed_amount_eur,client_type,sale_type')
         .eq('sale_completed',true).gte('signature_date',`${currentYear}-01-01`).lt('signature_date',`${currentYear+1}-01-01`),
       client.from('seller_monthly_sales').select('fiscal_start_year,month_index,user_id,ca,nc,upcross,sector_id')
         .gte('fiscal_start_year',prevYear-1).lte('fiscal_start_year',prevYear)
     ]);
     for(const v of [pr,sa,hi])if(v.error)throw v.error;
     if(year!==currentYear){pending=true;return}
     people=pr.data||[];
     sales=sa.data||[];
     rows=hi.data||[];
     if(!people.some(p=>p.user_id===selectedSeller))selectedSeller=people[0]?.user_id||'';
     loaded=true;lastOutput='';if(!message)messageType='ok';draw();
   }catch(e){box.innerHTML=`<div class="rxh-error">Impossible de charger les comparaisons : ${safe(e?.message||e)}</div><button type="button" id="rxhRetry">Réessayer</button>`;box.querySelector('#rxhRetry').onclick=load}
   finally{busy=false;if(pending){pending=false;load()}}
 }
 function refresh(){
   if(!active||!isAdmin()||!page()?.classList.contains('active'))return;
   if(document.getElementById(ROOT)?.querySelector('#rxhForm')?.dataset.dirty==='1')return;
   if(timer!==null)clearTimeout(timer);
   timer=setTimeout(()=>{timer=null;load()},800);
 }
 function start(){
   const p=getProfile();if(!p)return false;
   if(p.role!=='admin')return true;
   if(!getUser()||!getSb()||!mount())return false;
   if(active)return true;
   active=true;load();return true;
 }
 window.addEventListener('rex:commercial-data-changed',refresh);
 window.addEventListener('rex:monthly-sale-synced',refresh);
 document.addEventListener('click',e=>{if(e.target?.closest?.('.rex-nav button[data-page="dashboard"]'))setTimeout(refresh,160)});
 window.addEventListener('focus',()=>{if(lastFetch&&Date.now()-lastFetch>60000)refresh()});
 const t=setInterval(()=>{if(start())clearInterval(t)},500);
 window.addEventListener('load',()=>setTimeout(start,800));
})();