(function agencyMonthlyDashboard(){
  'use strict';
  const ID='rexHistoryComparison';
  const TABLE='manager_agency_monthly_results';
  const MONTHS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const euros=new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2});
  const format=x=>x==null?'—':euros.format(x/100);
  const editFormat=x=>x==null?'':new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(x/100);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const z=x=>String(x).padStart(2,'0');
  const dateISO=(y,m)=>y+'-'+z(m)+'-01';
  const selectISO=(y,m)=>y+'-'+z(m);
  const monthsFor=(y,m)=>Array.from({length:12},(_,i)=>{
    const d=new Date(y,m-12+i,15,12);
    return {year:d.getFullYear(),month:d.getMonth()+1,key:dateISO(d.getFullYear(),d.getMonth()+1)};
  });
  const current=new Date(),maxMonth=selectISO(current.getFullYear(),current.getMonth()+1);
  const getUser=()=>{try{return user||currentUser||null}catch(e){return null}};
  const getProfile=()=>{try{return profile||currentProfile||null}catch(e){return null}};
  const client=()=>{try{return sb}catch(e){return null}};
  const isAdmin=()=>getProfile()?.role==='admin';
  const page=()=>document.querySelector('.rex-page[data-page="dashboard"]');
  const section=()=>document.getElementById(ID);
  let year=current.getFullYear(),month=current.getMonth()+1,rows=[],loading=false,queue=false,editing=false,saving=false,
    metric='ca',showExtras=false,message='',messageType='ok',lastRequest=0,started=false,debounce=null,lastMarkup='';

  function parseEuro(value){
    const raw=String(value??'').trim().replace(/[\s\u00a0\u202f]/g,'').replace(',','.');
    if(!/^\d+(?:\.\d{1,2})?$/.test(raw))return null;
    const number=Number(raw);
    return Number.isFinite(number)&&number>=0&&number<=100000000?Math.round(number*100):null;
  }
  function metrics(){return ['ca','nc','uc']}
  function buildPeriod(data,y,m){
    const byMonth=new Map(data.map(row=>[String(row.month_start).slice(0,10),row]));
    let cumulative={ca:0,nc:0,uc:0},count=0,seenIncomplete=false;
    const monthly=monthsFor(y,m).map(date=>{
      const source=byMonth.get(date.key)||null;
      const values=source?{ca:Number(source.ca_cents),nc:Number(source.nc_cents),uc:Number(source.uc_cents)}:null;
      if(values){count++;for(const k of metrics())cumulative[k]+=values[k]}
      else seenIncomplete=true;
      return {...date,values,source,cumulative:{...cumulative},count,hasGaps:seenIncomplete};
    });
    return {monthly,count,complete:count===12,totals:count?{...cumulative}:null};
  }
  function mount(){
    if(!isAdmin()){section()?.remove();return null}
    const p=page();if(!p)return null;
    p.classList.add('rxh-simple-manager');
    p.classList.toggle('rxh-show-extras',showExtras);
    let el=section();
    if(!el){
      el=document.createElement('section');el.id=ID;el.className='rxh-root rxh-agency-root';
      el.innerHTML='<p>Chargement du suivi global agence…</p>';
      p.appendChild(el);
    }
    const anchor=p.querySelector('#dashboardSalesKpis')||p.querySelector('.rex-page-head');
    if(anchor&&anchor.nextElementSibling!==el)anchor.insertAdjacentElement('afterend',el);
    return el;
  }
  function notice(text,type='ok'){
    message=text;messageType=type;
    const node=section()?.querySelector('#rxAgencyNotice');
    if(node){node.textContent=text;node.className='rxag-'+(type==='error'?'error':'notice')}
  }
  function render(){
    const el=mount();if(!el)return;
    const result=buildPeriod(rows,year,month),selected=selectISO(year,month);
    const max=Math.max(1,...result.monthly.map(x=>x.values?.[metric]??0));
    const signature=JSON.stringify([rows,year,month,metric,editing,saving,showExtras,message,messageType]);
    if(signature===lastMarkup&&el.querySelector('#rxAgencyMonth'))return;
    const label=k=>({ca:'CA',nc:'NC',uc:'UC'}[k]);
    const tableRows=result.monthly.map(item=>{
      const original=item.values,stats=metrics().map(k=>{
        if(!editing)return '<td class="rxag-value">'+format(original?.[k]??null)+'</td>';
        return '<td><input type="text" class="rxag-amount" inputmode="decimal" data-field="'+k+
          '" value="'+esc(editFormat(original?.[k]??null))+'" aria-label="'+label(k)+' '+MONTHS[item.month-1]+' '+item.year+
          '" placeholder="—"></td>';
      }).join('');
      const total=(k)=>item.count?format(item.cumulative[k]):'—';
      return '<tr data-month="'+item.key+'"><th scope="row">'+MONTHS[item.month-1].slice(0,1).toUpperCase()+MONTHS[item.month-1].slice(1)+' '+item.year+
        '</th>'+stats+'<td class="rxag-running">'+total('ca')+'</td><td class="rxag-running">'+total('nc')+
        '</td><td class="rxag-running">'+total('uc')+'</td><td><span class="'+(original?'rxag-saved':'rxag-missing')+'">'+
        (original?'Saisi':'À renseigner')+'</span></td></tr>';
    }).join('');
    const final=result.totals;
    const points=result.monthly.map(item=>{
      const value=item.values?.[metric]??null,percent=value===null?0:Math.max(value===0?1:2,Math.round(value/max*100));
      return '<div class="rxag-column"><div class="rxag-plot"><span class="'+(value==null?'rxag-no-bar':'rxag-bar')+
        '" style="height:'+percent+'%" title="'+MONTHS[item.month-1]+' '+item.year+' : '+format(value)+'"></span></div>'+
        '<small>'+MONTHS[item.month-1].slice(0,3)+'<span> '+String(item.year).slice(-2)+'</span></small></div>';
    }).join('');
    el.innerHTML='<div class="rxag-header"><div><div class="rxh-eyebrow">PILOTAGE PERSONNEL · AGENCE CORRÈZE</div>'+
      '<h3>Résultats globaux sur 12 mois</h3><p>CA, NC et UC renseignés par toi, sans dépendance aux vendeurs et à leurs changements de secteur.</p></div>'+
      '<div class="rxag-filters"><label for="rxAgencyMonth">Dernier mois</label><input type="month" id="rxAgencyMonth" max="'+maxMonth+
      '" value="'+selected+'"><button type="button" id="rxAgencyReload">↻ Actualiser</button></div></div>'+
      '<div class="rxag-kpis">'+metrics().map(k=>'<div class="rxag-kpi"><small>'+label(k)+' cumulé</small><strong>'+
        format(final?.[k]??null)+'</strong><span>'+result.count+'/12 mois renseignés</span></div>').join('')+'</div>'+
      '<div class="rxag-status"><strong>'+result.count+'/12 mois renseignés</strong> · '+(result.complete?
        'Cumul complet sur douze mois.':'Cumul partiel : les mois non saisis ne sont jamais considérés comme 0 €.')+
        ' Les NC et UC sont compris dans le CA.</div>'+
      '<div class="rxag-graph-head"><h4>Évolution mois par mois</h4>'+
      '<div><label for="rxAgencyMetric">Indicateur</label><select id="rxAgencyMetric">'+metrics().map(k=>
        '<option value="'+k+'" '+(metric===k?'selected':'')+'>'+label(k)+'</option>').join('')+'</select></div></div>'+
      '<div class="rxag-chart" role="img" aria-label="Évolution du '+label(metric)+' sur douze mois">'+points+'</div>'+
      '<div class="rxag-table-head"><div><h4>Cumul et suivi mensuel</h4><p>Les mêmes 12 mois, avec cumul progressif après chaque mois.</p></div>'+
        '<button type="button" id="rxAgencyEdit">'+(editing?'Annuler la saisie':'✎ Saisir ou corriger les chiffres')+'</button></div>'+
      '<div class="rxag-table-wrap"><table class="rxag-table"><thead><tr><th>Mois</th><th>CA (€)</th><th>NC (€)</th><th>UC (€)</th>'+
        '<th>Cumul CA</th><th>Cumul NC</th><th>Cumul UC</th><th>État</th></tr></thead><tbody>'+tableRows+'</tbody></table></div>'+
      (editing?'<div class="rxag-actions"><button type="button" id="rxAgencySave" class="rxag-save" '+(saving?'disabled':'')+
        '>'+(saving?'Enregistrement…':'Enregistrer les mois modifiés')+'</button><span>Indique CA, NC et UC sur la même ligne, y compris 0 en cas de mois nul. En euros au centime près.</span></div>':'')+
      '<div id="rxAgencyNotice" class="rxag-'+(messageType==='error'?'error':'notice')+'" role="status">'+esc(message)+'</div>'+
      '<div class="rxag-footer"><span>Source unique : tes chiffres globaux saisis ici. Les chiffres des commerciaux ou des secteurs ne sont pas additionnés automatiquement.</span>'+
      '<button type="button" id="rxAgencyExtras" aria-expanded="'+String(showExtras)+'">'+
       (showExtras?'Masquer les analyses complémentaires':'Afficher les autres analyses (facultatif)')+'</button></div>';
    el.querySelector('#rxAgencyMonth').onchange=e=>{
      const input=e.target.value||'';
      if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(input)||input>maxMonth){e.target.value=selected;return}
      if(editing&&!confirm('Quitter la saisie sans enregistrer les modifications ?')){e.target.value=selected;return}
      const next=input.split('-').map(Number);year=next[0];month=next[1];editing=false;lastMarkup='';load();
    };
    el.querySelector('#rxAgencyMetric').onchange=e=>{
      if(editing&&el.querySelector('.rxag-amount')&&el.querySelector('.rxag-table-wrap')?.dataset.dirty==='1'){
        notice('Enregistre ou annule la saisie avant de modifier le graphique.','error');e.target.value=metric;return;
      }
      metric=e.target.value;lastMarkup='';render();
    };
    el.querySelector('#rxAgencyReload').onclick=()=>{
      if(editing){notice('Enregistre ou annule la saisie avant d’actualiser.','error');return}
      load();
    };
    el.querySelector('#rxAgencyEdit').onclick=()=>{
      if(editing&&el.querySelector('.rxag-table-wrap')?.dataset.dirty==='1'&&!confirm('Abandonner les chiffres non enregistrés ?'))return;
      editing=!editing;lastMarkup='';notice('');render();
    };
    el.querySelector('#rxAgencyExtras').onclick=e=>{
      // Changer la visibilité des analyses secondaires sans reconstruire le
      // tableau : une saisie CA / NC / UC en cours reste intacte.
      showExtras=!showExtras;
      page()?.classList.toggle('rxh-show-extras',showExtras);
      e.currentTarget.textContent=showExtras?'Masquer les analyses complémentaires':'Afficher les autres analyses (facultatif)';
      e.currentTarget.setAttribute('aria-expanded',String(showExtras));
      lastMarkup=''; // prochain rafraîchissement volontaire.
    };
    if(editing){
      const wrap=el.querySelector('.rxag-table-wrap');
      wrap.addEventListener('input',()=>{wrap.dataset.dirty='1'});
      el.querySelector('#rxAgencySave').onclick=()=>save();
    }
    lastMarkup=signature;
  }
  async function save(){
    if(!isAdmin()||saving||!editing)return;
    const db=client(),u=getUser(),el=section();
    if(!db||!u||!el)return;
    const currentRows=new Map(rows.map(r=>[String(r.month_start).slice(0,10),r]));
    const updates=[];
    for(const tr of el.querySelectorAll('tbody tr[data-month]')){
      const key=tr.dataset.month,fields={};let filled=0;
      for(const k of metrics()){
        const input=tr.querySelector('input[data-field="'+k+'"]');
        const text=String(input?.value??'').trim();
        if(text===''){fields[k]=null;continue}
        filled++;
        const parsed=parseEuro(text);
        if(parsed===null){notice('Montant '+k.toUpperCase()+' incorrect pour '+key+'. Utilise au maximum deux décimales.','error');return}
        fields[k]=parsed;
      }
      const existing=currentRows.get(key);
      if(!filled){
        if(existing){notice('Un mois déjà saisi ne peut pas être effacé en vidant les cases. Mets 0 pour un mois nul : '+key+'.','error');return}
        continue;
      }
      if(filled!==3){notice('Pour '+key+', renseigne les trois montants CA, NC et UC (0 accepté).','error');return}
      if(fields.nc>fields.ca||fields.uc>fields.ca){notice('Pour '+key+', le NC et l’UC ne peuvent pas dépasser le CA.','error');return}
      if(existing&&existing.ca_cents==fields.ca&&existing.nc_cents==fields.nc&&existing.uc_cents==fields.uc)continue;
      updates.push({manager_user_id:u.id,month_start:key,
        ca_cents:fields.ca,nc_cents:fields.nc,uc_cents:fields.uc,
        updated_at:new Date().toISOString(),updated_by:u.id});
    }
    if(!updates.length){notice('Aucun chiffre nouveau à enregistrer.');return}
    saving=true;el.querySelector('#rxAgencySave').disabled=true;
    el.querySelector('#rxAgencySave').textContent='Enregistrement…';
    try{
      // Relecture juste avant sauvegarde : ne pas effacer une correction effectuée
      // dans un autre onglet avec les anciennes valeurs affichées ici.
      const currentKeys=new Map(rows.map(r=>[String(r.month_start).slice(0,10),r]));
      const recent=await db.from(TABLE).select('month_start,ca_cents,nc_cents,uc_cents,updated_at')
        .eq('manager_user_id',u.id).gte('month_start',updates[0].month_start.slice(0,4)+'-01-01')
        .lte('month_start',dateISO(year,month));
      if(recent.error)throw recent.error;
      const freshKeys=new Map((recent.data||[]).map(r=>[String(r.month_start).slice(0,10),r]));
      for(const change of updates){
        const old=currentKeys.get(change.month_start),fresh=freshKeys.get(change.month_start);
        if((old?.updated_at||null)!==(fresh?.updated_at||null))
          throw new Error('Les chiffres de '+change.month_start+' ont été modifiés dans un autre onglet. Actualise la page avant de réenregistrer.');
      }
      const done=await db.from(TABLE).upsert(updates,{onConflict:'manager_user_id,month_start'})
        .select('month_start');
      if(done.error)throw done.error;
      if((done.data||[]).length!==updates.length)throw new Error('Tous les mois n’ont pas été confirmés par la base. Vérifie les chiffres.');
      editing=false;
      message=updates.length+' mois enregistré'+(updates.length>1?'s':'')+' avec succès. Les autres données du CRM restent inchangées.';
      messageType='ok';lastMarkup='';await load();
    }catch(error){
      notice('Impossible d’enregistrer : '+(error?.message||error),'error');
    }finally{saving=false;const btn=section()?.querySelector('#rxAgencySave');if(btn){btn.disabled=false;btn.textContent='Enregistrer les mois modifiés'}}
  }
  async function load(){
    if(!isAdmin())return;
    const db=client(),u=getUser();if(!db||!u||!mount())return;
    if(loading){queue=true;return}
    if(editing){notice('Termine ou annule la saisie avant de recharger les données.','error');return}
    loading=true;lastRequest=Date.now();
    const requestMonth=selectISO(year,month),range=monthsFor(year,month);
    try{
      const result=await db.from(TABLE).select('month_start,ca_cents,nc_cents,uc_cents,updated_at')
        .eq('manager_user_id',u.id).gte('month_start',range[0].key).lte('month_start',range[11].key)
        .order('month_start');
      if(result.error)throw result.error;
      if(selectISO(year,month)!==requestMonth){queue=true;return}
      rows=result.data||[];lastMarkup='';if(messageType==='error'){message='';messageType='ok'}render();
    }catch(error){notice('Erreur de chargement des résultats agence : '+(error?.message||error),'error');render()}
    finally{loading=false;if(queue){queue=false;load()}}
  }
  function tryStart(){
    const p=getProfile();
    if(!p)return false;
    if(p.role!=='admin')return true;
    if(!getUser()||!client()||!mount())return false;
    if(started)return true;
    started=true;load();return true;
  }
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('button[data-page="dashboard"]')&&started&&!editing)
      setTimeout(()=>{if(Date.now()-lastRequest>20000)load()},160);
  });
  window.addEventListener('focus',()=>{if(started&&!editing&&Date.now()-lastRequest>90000)load()});
  let attempts=0;
  const timer=setInterval(()=>{attempts++;if(tryStart()||attempts>160)clearInterval(timer)},450);
  window.addEventListener('load',()=>setTimeout(tryStart,900));
})();