(function managerStrategy(){
  'use strict';
  const ROOT='rexManagerStrategicPanel', START='2025-10-01', TABLE='manager_seller_pipeline_monthly';
  const MN=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const fmt=new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const pct=new Intl.NumberFormat('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1});
  const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ke=x=>x==null?'—':fmt.format(Number(x)/100000)+' k€';
  const num=x=>new Intl.NumberFormat('fr-FR').format(Number(x)||0);
  const percentage=x=>x==null?'—':(x>0?'+':'')+pct.format(x)+' %';
  const z=n=>String(n).padStart(2,'0');
  const monthKey=(y,m)=>y+'-'+z(m)+'-01';
  const fromDate=x=>String(x||'').slice(0,10);
  const owner=()=>{try{return user||currentUser||null}catch(e){return null}};
  const pf=()=>{try{return profile||currentProfile||null}catch(e){return null}};
  const db=()=>{try{return sb}catch(e){return null}};
  const isAdmin=()=>pf()?.role==='admin';
  const page=()=>document.querySelector('.rex-page[data-page="dashboard"]');
  const element=()=>document.getElementById(ROOT);
  const now=new Date();
  const thisMonth=monthKey(now.getFullYear(),now.getMonth()+1);
  let tab='agency',agencyView='summary',metric='ca',periodSelect=thisMonth,
      agencyRows=[],pipelineRows=[],crmRows=[],sellerProfiles=[],funnelDraft=false,loaded={agency:false,sellers:false},
      loading=false,pending=false,saveBusy=false,message='',error='',initialized=false,lastLoad=0;
  const sourceMonths=()=>{
    const dates=[];
    for(let y=2025,m=10;y*12+m<=now.getFullYear()*12+now.getMonth()+1;){
      dates.push(monthKey(y,m));m++;if(m===13){m=1;y++}
    }
    return dates;
  };
  function parseK(v){
    const str=String(v??'').trim().replace(/[\s\u00a0\u202f]/g,'').replace(',','.');
    if(!/^\d+(\.\d{1,2})?$/.test(str))return null;
    const n=Number(str);return Number.isFinite(n)&&n<=1e7?Math.round(n*100000):null;
  }
  const parseCount=v=>/^\d+$/.test(String(v??'').trim())&&Number(v)<=100000?Number(v):null;
  const identity=name=>String(name||'').trim().toLocaleLowerCase('fr-FR').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120);
  function sellerKey(name,profiles){
    const match=profiles.find(p=>p.display_name?.trim().toLowerCase()===name.trim().toLowerCase());
    return match?'user:'+match.user_id:'former:'+identity(name);
  }
  const sum=(arr,field)=>arr.reduce((s,r)=>s+Number(r[field]||0),0);
  const difference=(a,b)=>a!=null&&b!=null&&b>0?(a/b-1)*100:null;
  const status=x=>x==null?'rms-na':x<0?'rms-down':x>0?'rms-up':'rms-flat';
  function monthRange(from,n){const [yy,mm]=from.split('-').map(Number);return Array.from({length:n},(_,i)=>{
    const d=new Date(yy,mm-1+i,15,12);
    return monthKey(d.getFullYear(),d.getMonth()+1);
  })}
  const monthTitle=x=>MN[Number(x.slice(5,7))-1]+' '+x.slice(0,4);
  function agencyAnalysis(records,currentDate){
    const by=new Map(records.map(r=>[fromDate(r.month_start),r]));
    // Comparaison de 12 mois calendaires complets identiques, sans le mois en cours.
    const prior=monthRange('2024-10-01',12),after=monthRange('2025-10-01',12);
    const collect=dates=>({
      months:dates,
      count:dates.filter(m=>by.has(m)).length,
      totals:Object.fromEntries(['ca','nc','uc'].map(k=>[k,dates.every(m=>by.has(m))?
        dates.reduce((acc,m)=>acc+Number(by.get(m)[k+'_cents']),0):null]))
    });
    const pre=collect(prior),post=collect(after);
    const mostRecentYear=Math.max(now.getFullYear(),...records.map(r=>Number(fromDate(r.month_start).slice(0,4))));
    const years=Array.from({length:mostRecentYear-2023+1},(_,i)=>2023+i).map(y=>{
      const months=records.filter(r=>Number(fromDate(r.month_start).slice(0,4))===y);
      return {year:y,count:months.length,ca:sum(months,'ca_cents'),nc:sum(months,'nc_cents'),uc:sum(months,'uc_cents')};
    });
    const seasonal=Array.from({length:12},(_,i)=>{
      const rows=records.filter(r=>Number(fromDate(r.month_start).slice(5,7))===i+1);
      return {month:i+1,count:rows.length,ca:rows.length?sum(rows,'ca_cents')/rows.length:null,
        nc:rows.length?sum(rows,'nc_cents')/rows.length:null,
        uc:rows.length?sum(rows,'uc_cents')/rows.length:null};
    });
    const sortedDates=records.map(r=>fromDate(r.month_start)).filter(m=>m<thisMonth).sort();
    const latest=sortedDates[sortedDates.length-1]||null;
    const yoyYear=latest?Number(latest.slice(0,4)):now.getFullYear();
    const yoyMonth=latest?Number(latest.slice(5,7)):0;
    const fiscalMonths=yoyMonth?monthRange(yoyYear+'-01-01',yoyMonth):[];
    const oldFY=yoyMonth?monthRange((yoyYear-1)+'-01-01',yoyMonth):[];
    const yoy={year:yoyYear,months:yoyMonth,current:collect(fiscalMonths),previous:collect(oldFY)};
    return {pre,post,years,seasonal,yoy,by};
  }
  function funnelAnalysis(rows){
    const sellers=new Map();
    for(const r of rows){
      const key=r.seller_key||'unknown';
      if(!sellers.has(key))sellers.set(key,{key,name:r.seller_name,months:0,raised_count:0,signed_count:0,lost_count:0,
        raised_cents:0,signed_cents:0,lost_cents:0});
      const p=sellers.get(key);p.months++;
      for(const k of ['raised_count','signed_count','lost_count','raised_cents','signed_cents','lost_cents'])
        p[k]+=Number(r[k]||0);
    }
    return [...sellers.values()].map(p=>({...p,
      pending_count:p.raised_count-p.signed_count-p.lost_count,
      sign_rate:p.raised_count?p.signed_count/p.raised_count*100:null,
      loss_rate:p.raised_count?p.lost_count/p.raised_count*100:null,
      closed_sign_rate:p.signed_count+p.lost_count?p.signed_count/(p.signed_count+p.lost_count)*100:null
    })).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  }
  function root(){
    if(!isAdmin())return null;
    const p=page();if(!p)return null;
    let el=element();
    if(!el){el=document.createElement('section');el.id=ROOT;el.className='rms-root';
      el.innerHTML='<details class="rms-accordion"><summary>📊 Analyse stratégique · agence et commerciaux <span>Ouvrir le diagnostic</span></summary><div id="rmsContent"></div></details>';
      p.appendChild(el);
      const details=el.querySelector('details');
      details.addEventListener('toggle',()=>{
        if(details.open){if(!loaded[tab])load();else render()}
      });
    }
    const anchor=p.querySelector('#rexHistoryComparison');
    if(anchor&&anchor.nextElementSibling!==el)anchor.insertAdjacentElement('afterend',el);
    return el;
  }
  const header=()=>'<div class="rms-tabs"><button type="button" data-rms-tab="agency" class="'+(tab==='agency'?'selected':'')+
    '">Agence · depuis juillet 2023</button><button type="button" data-rms-tab="sellers" class="'+(tab==='sellers'?'selected':'')+
    '">Vendeurs · depuis octobre 2025</button></div>';
  const delta=(a,b)=>'<span class="'+status(difference(a,b))+'">'+percentage(difference(a,b))+'</span>';
  const info=x=>'<div class="rms-info">'+x+'</div>';
  function agencyViewHTML(){
    const a=agencyAnalysis(agencyRows);
    const totals=k=>'<div class="rms-compare-row"><span>'+k.toUpperCase()+'</span>'+
      '<strong>'+ke(a.pre.totals[k])+'</strong><strong>'+ke(a.post.totals[k])+'</strong>'+
      delta(a.post.totals[k],a.pre.totals[k])+'</div>';
    let content='<div class="rms-view-nav">'+[
      ['summary','Diagnostic'],['months','Mois difficiles'],['annual','Bilan annuel']
    ].map(([id,title])=>'<button type="button" data-rms-sub="'+id+'" class="'+(agencyView===id?'selected':'')+'">'+title+'</button>').join('')+'</div>';
    if(agencyView==='summary'){
      const cmp=k=>difference(a.post.totals[k],a.pre.totals[k]);
      content+='<h3>Depuis ta prise de poste en octobre 2025</h3>'+
        '<p class="rms-help">Comparaison de deux périodes identiques de 12 mois : octobre 2024–septembre 2025 contre octobre 2025–septembre 2026. Les variations ne démontrent pas une causalité.</p>'+
        '<div class="rms-compare"><div class="rms-compare-row head"><span>Indicateur</span><span>Avant ton arrivée</span><span>Depuis octobre 2025</span><span>Évolution</span></div>'+
        ['ca','nc','uc'].map(totals).join('')+'</div>';
      const allComplete=a.pre.count===12&&a.post.count===12;
      content+=info(allComplete?'12 mois complets dans chaque période.':
        'Comparaison indisponible ou partielle : '+a.pre.count+'/12 mois avant, '+a.post.count+'/12 mois après.');
      if(allComplete){
        let suggestions=[];
        if(cmp('nc')<-10)suggestions.push('**NC** : recul de '+percentage(cmp('nc'))+
          ' ; revoir le volume et la qualité des nouvelles opportunités, les rendez-vous NC et leur transformation.');
        if(cmp('uc')<-10)suggestions.push('**UC** : recul de '+percentage(cmp('uc'))+
          ' ; organiser des revues ciblées du parc clients et des occasions de montée en gamme.');
        if(cmp('ca')<0)suggestions.push('**CA** : progression négative de '+percentage(cmp('ca'))+
          ' ; analyser l’écart de volume, de panier moyen et de saisonnalité avant d’ajuster l’objectif.');
        if(!suggestions.length)suggestions.push('Les trois indicateurs progressent ou restent proches de la période précédente : vérifier leur régularité chaque mois.');
        const weak=[...a.seasonal].filter(x=>x.ca!==null).sort((x,y)=>x.ca-y.ca).slice(0,3);
        content+='<h4>Axes de travail suggérés par les chiffres</h4><div class="rms-actions">'+
          suggestions.map(s=>'<p>'+safe(s).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')+'</p>').join('')+
          '<p><b>Saisonnalité :</b> anticiper '+weak.map(x=>MN[x.month-1].toLowerCase()).join(', ')+
          ' : ce sont les mois au CA moyen le plus faible depuis la création.</p></div>';
      }
    }
    if(agencyView==='months'){
      const sorted=[...a.seasonal].filter(x=>x[metric]!==null).sort((x,y)=>x[metric]-y[metric]);
      const metricLabel={ca:'CA',nc:'NC',uc:'UC'}[metric];
      content+='<h3>Mois les plus difficiles · '+metricLabel+'</h3>'+
        '<p class="rms-help">Moyenne observée par mois du calendrier depuis juillet 2023, avec le nombre d’années disponibles. Les moyennes ne permettent pas de garantir les résultats futurs.</p>'+
        '<label for="rmsAgencyMetric">Indicateur</label><select id="rmsAgencyMetric">'+
        [['ca','CA'],['nc','NC'],['uc','UC']].map(([id,label])=>'<option value="'+id+'" '+(id===metric?'selected':'')+'>'+label+'</option>').join('')+'</select>'+
        '<div class="rms-season-cards">'+sorted.slice(0,3).map((r,i)=>'<div><small>Point de vigilance '+(i+1)+'</small><b>'+MN[r.month-1]+'</b>'+
        '<strong>'+ke(r[metric])+'</strong><small>Moyenne sur '+r.count+' année(s)</small></div>').join('')+'</div>'+
        '<div class="rms-scroll"><table class="rms-table"><thead><tr><th>Mois</th><th>2023</th><th>2024</th><th>2025</th><th>2026</th><th>Moyenne</th><th>2026 vs 2025</th></tr></thead><tbody>'+
        a.seasonal.map(r=>{
          const v=y=>a.by.get(monthKey(y,r.month))?.[metric+'_cents']??null;
          return '<tr><th>'+MN[r.month-1]+'</th>'+[2023,2024,2025,2026].map(y=>'<td>'+ke(v(y))+'</td>').join('')+
          '<td>'+ke(r[metric])+'</td><td>'+delta(v(2026),v(2025))+'</td></tr>';
        }).join('')+'</tbody></table></div>';
    }
    if(agencyView==='annual'){
      content+='<h3>Évolution par année civile</h3>'+
        '<p class="rms-help">2023 démarre en juillet ; 2026 n’est renseignée que jusqu’en septembre. Ne pas comparer ces deux années partielles directement à une année complète.</p>'+
        '<div class="rms-scroll"><table class="rms-table"><thead><tr><th>Année</th><th>Mois connus</th><th>CA (k€)</th><th>NC (k€)</th><th>UC (k€)</th><th>Évolution CA vs année précédente</th></tr></thead><tbody>'+
        a.years.map((y,i)=>{
          const old=a.years[i-1],comparable=old?.count===12&&y.count===12;
          return '<tr><th>'+y.year+'</th><td>'+y.count+'/12'+(y.count!==12?' · partiel':'')+'</td>'+
           '<td>'+ke(y.ca)+'</td><td>'+ke(y.nc)+'</td><td>'+ke(y.uc)+'</td>'+
           '<td>'+(comparable?delta(y.ca,old.ca):'—')+'</td></tr>';
        }).join('')+'</tbody></table></div>';
      const j=a.yoy;
      content+='<h4>'+j.year+' contre '+(j.year-1)+' à période comparable · janvier à '+
        (j.months?MN[j.months-1].toLowerCase():'aucun mois clôturé')+'</h4>'+
        '<div class="rms-compare"><div class="rms-compare-row head"><span></span><span>Jan.–sept. 2025</span><span>Jan.–sept. 2026</span><span>Évolution</span></div>'+
        ['ca','nc','uc'].map(k=>'<div class="rms-compare-row"><span>'+k.toUpperCase()+'</span><strong>'+ke(j.previous.totals[k])+
          '</strong><strong>'+ke(j.current.totals[k])+'</strong>'+delta(j.current.totals[k],j.previous.totals[k])+'</div>').join('')+'</div>';
    }
    return content;
  }
  function crmSummary(){
    const by=new Map();
    for(const r of crmRows){
      if(fromDate(r.month_start)<START)continue;
      const key=r.user_id;
      const cur=by.get(key)||{count:0,planned:0,signed:0,signedCents:0,start:null};
      cur.count++;cur.planned+=Math.round(Number(r.amount||0)*100000);
      if(r.sale_completed){cur.signed++;cur.signedCents+=Math.round(Number(r.signed_amount_eur||0)*100)}
      if(!cur.start||r.month_start<cur.start)cur.start=r.month_start;
      by.set(key,cur);
    }
    if(!by.size)return info('Aucune affaire disponible dans les prévisions mensuelles pour cette période.');
    return '<details class="rms-crm-observed"><summary>Voir aussi les affaires réellement renseignées dans le CRM (données partielles)</summary>'+
      '<p class="rms-help">Ce nombre est celui des lignes du Prévisionnel mensuel depuis septembre 2026, et non de toutes les affaires réellement levées depuis 2025. Une affaire non signée n’est pas forcément perdue. Aucun taux de casse fiable ne peut être calculé avec ces seules données.</p>'+
      '<div class="rms-scroll"><table class="rms-table"><thead><tr><th>Vendeur</th><th>Affaires présentes</th><th>Montant prévu</th><th>Signées dans ces lignes</th><th>Montant signé</th><th>Source</th></tr></thead><tbody>'+
      [...by].map(([uid,r])=>{
        const p=sellerProfiles.find(s=>s.user_id===uid);
        return '<tr><th>'+safe(p?.display_name||'Compte '+uid.slice(0,6))+'</th>'+
          '<td>'+num(r.count)+'</td><td>'+ke(r.planned)+'</td><td>'+num(r.signed)+'</td>'+
          '<td>'+ke(r.signedCents)+'</td><td>CRM incomplet depuis '+safe(monthTitle(r.start))+'</td></tr>';
      }).join('')+'</tbody></table></div></details>';
  }
  function sellersViewHTML(){
    const summary=funnelAnalysis(pipelineRows);
    const observed=crmRows.length?crmSummary():'';
    const options=[...new Set([...sellerProfiles.map(x=>x.display_name),...pipelineRows.map(x=>x.seller_name)])]
      .filter(Boolean).sort((a,b)=>a.localeCompare(b,'fr'));
    const selection=periodSelect<=thisMonth?periodSelect:thisMonth;
    let view='<h3>Pilotage individuel des affaires depuis octobre 2025</h3>'+
      '<p class="rms-help">Mesure par <b>cohorte d’affaires levées</b> : signées / levées = taux de concrétisation, cassées ou perdues / levées = taux de casse. Le reste correspond aux affaires encore en cours. Une signature obtenue plus tard reste attachée au mois où l’affaire a été levée. Un vendeur parti conserve son historique.</p>';
    view+='<div class="rms-scroll"><table class="rms-table rms-funnel"><thead><tr>'+
      '<th>Commercial</th><th>Mois saisis</th><th>Affaires levées</th><th>Montant levé k€</th><th>Signées</th><th>Montant signé k€</th>'+
      '<th>Cassées/perdues</th><th>En cours</th><th>Concrétisation</th><th>Casse</th></tr></thead><tbody>'+
      (summary.length?summary.map(s=>'<tr><th>'+safe(s.name)+'</th><td>'+s.months+'</td><td>'+num(s.raised_count)+'</td>'+
        '<td>'+ke(s.raised_cents)+'</td><td>'+num(s.signed_count)+'</td><td>'+ke(s.signed_cents)+'</td>'+
        '<td>'+num(s.lost_count)+'</td><td>'+num(s.pending_count)+'</td>'+
        '<td><b class="'+status(s.sign_rate)+'">'+(s.sign_rate==null?'—':pct.format(s.sign_rate)+' %')+'</b></td>'+
        '<td><b class="rms-loss">'+(s.loss_rate==null?'—':pct.format(s.loss_rate)+' %')+'</b></td></tr>').join(''):
        '<tr><td colspan="10" class="rms-empty">Aucun bilan vendeur renseigné. Utilise la saisie ci-dessous pour constituer l’historique depuis octobre 2025.</td></tr>')+
      '</tbody></table></div>';
    view+=info('Ces taux ne représentent que les mois renseignés manuellement, jamais l’ensemble des affaires historiques non enregistrées. Un mois inconnu ne compte pas pour zéro.');
    view+='<details class="rms-entry" '+(funnelDraft?'open':'')+'><summary>✎ Saisir ou corriger un mois et un vendeur</summary>'+
      '<div class="rms-entry-fields"><label>Commercial (actuel ou ancien)<input id="rmsSellerName" list="rmsSellerNames" placeholder="Nom du vendeur" maxlength="180"></label>'+
      '<datalist id="rmsSellerNames">'+options.map(x=>'<option value="'+safe(x)+'"></option>').join('')+'</datalist>'+
      '<label>Mois des affaires levées<input id="rmsSellerMonth" type="month" min="2025-10" max="'+thisMonth.slice(0,7)+'" value="'+selection.slice(0,7)+'"></label></div>'+
      '<div class="rms-entry-fields rms-entry-numbers">'+[
        ['raised_count','Affaires levées (nombre)'],['raised_amount','Montant levé (k€)'],
        ['signed_count','Affaires signées (nombre)'],['signed_amount','Montant signé (k€)'],
        ['lost_count','Affaires cassées/perdues (nombre)'],['lost_amount','Montant cassé/perdu (k€)']
      ].map(([key,label])=>'<label>'+label+'<input data-rms-field="'+key+'" type="text" inputmode="decimal" value="" placeholder="0"></label>').join('')+'</div>'+
      '<div class="rms-savebar"><button id="rmsSellerSave" type="button">Enregistrer le suivi vendeur</button>'+
      '<span>CA et montants en k€, valeurs à deux décimales. Un vendeur absent du CRM peut être ajouté par son nom.</span></div>'+
      '<p class="rms-help">Sélectionne un vendeur et un mois existants pour corriger ses chiffres. Attention : ne confonds pas une affaire non signée avec une casse.</p></details>'+
      '<p id="rmsSellerMessage" role="status" class="rms-message">'+safe(message)+'</p>';
    return view+observed;
  }
  function render(){
    const el=element(),dest=el?.querySelector('#rmsContent');if(!dest)return;
    dest.innerHTML=header()+(error?'<p class="rms-error">'+safe(error)+'</p>':'')+
      (tab==='agency'?agencyViewHTML():sellersViewHTML());
    dest.querySelectorAll('[data-rms-tab]').forEach(b=>b.onclick=()=>{
      if(saveBusy)return;tab=b.dataset.rmsTab;message='';if(!loaded[tab])load();else render();
    });
    dest.querySelectorAll('[data-rms-sub]').forEach(b=>b.onclick=()=>{agencyView=b.dataset.rmsSub;render()});
    if(tab==='agency'){
      const sel=dest.querySelector('#rmsAgencyMetric');
      if(sel)sel.onchange=e=>{metric=e.target.value;render()}
    }else{
      const fields=dest.querySelector('.rms-entry');
      if(fields){
        fields.addEventListener('toggle',()=>funnelDraft=fields.open);
        const name=dest.querySelector('#rmsSellerName'),mon=dest.querySelector('#rmsSellerMonth');
        const fill=()=>{
          const key=sellerKey(name.value,sellerProfiles),period=(mon.value||'')+'-01';
          const found=pipelineRows.find(r=>r.seller_key===key&&fromDate(r.month_start)===period);
          for(const [inputField,column] of [
            ['raised_count','raised_count'],['raised_amount','raised_cents'],
            ['signed_count','signed_count'],['signed_amount','signed_cents'],
            ['lost_count','lost_count'],['lost_amount','lost_cents']
          ]){
            const input=fields.querySelector('[data-rms-field="'+inputField+'"]');
            if(input)input.value=found?(column.endsWith('_cents')?fmt.format(Number(found[column])/100000):String(found[column])):'';
          }
        };
        name.onchange=fill;mon.onchange=fill;
        const button=dest.querySelector('#rmsSellerSave');if(button)button.onclick=saveSeller;
      }
    }
  }
  async function saveSeller(){
    if(saveBusy||!isAdmin())return;
    const dbClient=db(),u=owner(),pane=element()?.querySelector('#rmsContent');
    if(!dbClient||!u||!pane)return;
    const name=pane.querySelector('#rmsSellerName')?.value.trim().replace(/\s+/g,' ');
    const ym=pane.querySelector('#rmsSellerMonth')?.value;
    const feedback=pane.querySelector('#rmsSellerMessage');
    const fail=x=>{if(feedback){feedback.textContent=x;feedback.className='rms-error'}};
    if(!name||name.length<2){fail('Indique le nom du vendeur, y compris s’il a quitté l’agence.');return}
    const key=sellerKey(name,sellerProfiles);
    if(key.length<2){fail('Nom du vendeur incorrect.');return}
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym||'')||ym+'-01'<START||ym+'-01'>thisMonth){
      fail('Choisis un mois valide à partir d’octobre 2025.');return;
    }
    const take=(x)=>pane.querySelector('[data-rms-field="'+x+'"]')?.value.trim()||'';
    const rc=parseCount(take('raised_count')),sc=parseCount(take('signed_count')),lc=parseCount(take('lost_count'));
    const ra=parseK(take('raised_amount')),sa=parseK(take('signed_amount')),la=parseK(take('lost_amount'));
    if([rc,sc,lc,ra,sa,la].some(v=>v==null)){fail('Renseigne les six champs correctement (saisis 0 si besoin ; montants en k€).');return}
    if(sc+lc>rc){fail('Le nombre d’affaires signées et cassées ne peut pas dépasser le nombre levé.');return}
    const row={manager_user_id:u.id,seller_key:key,seller_name:name,month_start:ym+'-01',
      raised_count:rc,raised_cents:ra,signed_count:sc,signed_cents:sa,
      lost_count:lc,lost_cents:la,updated_at:new Date().toISOString()};
    saveBusy=true;
    const button=pane.querySelector('#rmsSellerSave');button.disabled=true;
    try{
      const res=await dbClient.from(TABLE).upsert(row,{onConflict:'manager_user_id,seller_key,month_start'});
      if(res.error)throw res.error;
      message='Chiffres enregistrés pour '+name+' · '+monthTitle(row.month_start)+'.';
      periodSelect=row.month_start;loaded.sellers=false;await load();
    }catch(e){fail('Enregistrement impossible : '+String(e?.message||e))}
    finally{saveBusy=false;button.disabled=false}
  }
  async function load(){
    if(!isAdmin())return;
    if(loading){pending=true;return}
    const dbClient=db(),u=owner();if(!dbClient||!u)return;
    loading=true;error='';
    const currentTab=tab;
    const node=element()?.querySelector('#rmsContent');if(node)node.innerHTML=header()+info('Calcul des indicateurs…');
    try{
      if(currentTab==='agency'){
        const res=await dbClient.from('manager_agency_monthly_results').select('month_start,ca_cents,nc_cents,uc_cents')
          .eq('manager_user_id',u.id).gte('month_start','2023-07-01').order('month_start');
        if(res.error)throw res.error;agencyRows=res.data||[];
      }else{
        const [a,b,c]=await Promise.all([
          dbClient.from(TABLE).select('*').eq('manager_user_id',u.id).gte('month_start',START).order('month_start'),
          dbClient.from('profiles').select('user_id,display_name,role').eq('role','seller'),
          dbClient.from('monthly_forecasts').select('user_id,month_start,amount,sale_completed,signed_amount_eur')
            .gte('month_start',START)
        ]);
        for(const r of [a,b,c])if(r.error)throw r.error;
        pipelineRows=a.data||[];sellerProfiles=b.data||[];crmRows=c.data||[];
      }
      loaded[currentTab]=true;lastLoad=Date.now();
      if(currentTab===tab)render();
    }catch(e){error='Données indisponibles : '+String(e?.message||e);if(currentTab===tab)render()}
    finally{
      loading=false;
      // Retenter UNIQUEMENT lorsqu'un changement d'onglet a demandé une
      // seconde requête pendant la première. En cas d'erreur SQL/RLS/réseau,
      // ne jamais rappeler load() indéfiniment : cela bloquait le navigateur.
      if(pending){pending=false;load()}
    }
  }
  function begin(){
    const current=pf();
    if(!current)return false;
    if(current.role!=='admin')return true;
    if(!owner()||!db()||!page()||!page().querySelector('#rexHistoryComparison'))return false;
    if(initialized)return true;
    root();initialized=true;return true;
  }
  window.addEventListener('focus',()=>{if(!initialized||!element()?.querySelector('.rms-accordion')?.open)return;
    if(Date.now()-lastLoad>120000&&!saveBusy){loaded[tab]=false;load()}
  });
  // Chargement EXCLUSIVEMENT à la demande du responsable depuis le tableau
  // de bord. Ne plus lancer de timers au démarrage de l'application.
  window.rexOpenManagerStrategy=function(){
    try{
      if(!isAdmin()||!begin())return false;
      const panel=element(),details=panel?.querySelector('details.rms-accordion');
      if(!details)return false;
      if(!details.open)details.open=true;
      else if(!loaded[tab]&&!loading)load();
      else if(loaded[tab])render();
      if(typeof panel.scrollIntoView==='function')
        panel.scrollIntoView({behavior:'smooth',block:'start'});
      return true;
    }catch(e){
      console.error('[Rex] Impossible d’ouvrir l’analyse stratégique',e);
      return false;
    }
  };
})();