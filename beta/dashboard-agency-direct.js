(function agencyMonthlyDashboard(){
  'use strict';
  const ID='rexHistoryComparison';
  const TABLE='manager_agency_monthly_results';
  const MONTHS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  // La base garde les centimes d'euros. L'interface utilise EXCLUSIVEMENT les k€ :
  // 1 k€ = 100 000 centimes, soit 102,68 k€ pour 10 268 000 centimes.
  const kilo=new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const format=x=>x==null?'—':kilo.format(Number(x)/100000)+' k€';
  const editFormat=x=>x==null?'':kilo.format(Number(x)/100000);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const z=x=>String(x).padStart(2,'0');
  const dateISO=(y,m)=>y+'-'+z(m)+'-01';
  const selectISO=(y,m)=>y+'-'+z(m);
  const fiscalStart=(y,m)=>m>=4?y:y-1;
  const yearLabel=fy=>'FY'+String(fy).slice(-2)+'-'+String(fy+1).slice(-2);
  const centsFromK=x=>Math.round(Number(x||0)*100000);
  function goalProgress(monthly,goal,fy,untilYear,untilMonth){
    const cutoff=selectISO(untilYear,untilMonth),from=selectISO(fy,4);
    const selected=monthly.filter(x=>selectISO(x.year,x.month)>=from&&selectISO(x.year,x.month)<=cutoff);
    const entered=selected.filter(x=>!!x.values);
    const totals=entered.length?{
      ca:entered.reduce((a,x)=>a+x.values.ca,0),
      nc:entered.reduce((a,x)=>a+x.values.nc,0),
      uc:entered.reduce((a,x)=>a+x.values.uc,0)
    }:null;
    const targets=goal?{
      ca:centsFromK(goal.ca_target),
      nc:centsFromK(goal.nc_target),
      uc:centsFromK(goal.upcross_target)
    }:null;
    const ca=totals?.ca??null,target=targets?.ca??null;
    return {fy,expected:selected.length,count:entered.length,totals,targets,
      ratio:ca!==null&&target>0?ca/target*100:null,
      remaining:ca!==null&&target!==null?Math.max(0,target-ca):null};
  }
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
    showExtras=false,message='',messageType='ok',annualGoal=null,annualGoalError='',lastRequest=0,started=false,debounce=null,lastMarkup='';

  function parseKeuro(value){
    const raw=String(value??'').trim().replace(/[\s\u00a0\u202f]/g,'').replace(',','.');
    if(!/^\d+(?:\.\d{1,2})?$/.test(raw))return null;
    const number=Number(raw);
    return Number.isFinite(number)&&number>=0&&number<=1000000?Math.round(number*100000):null;
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

  // Le cumul est nécessairement croissant ; la tendance en +/- % compare
  // le CA signé/déclaré du mois avec celui du mois précédent, jamais le cumul.
  function monthlyCATrends(monthly){
    return monthly.map((m,i)=>{
      const prev=monthly[i-1];
      if(!m.values||!prev?.values||prev.values.ca===0)return null;
      return (m.values.ca-prev.values.ca)/prev.values.ca*100;
    });
  }
  function trendLabel(value){
    if(value===null)return '—';
    const rounded=Math.round(Math.abs(value)*10)/10;
    const pct=new Intl.NumberFormat('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1}).format(rounded);
    return value>0?'↗ +'+pct+' %':value<0?'↘ −'+pct+' %':'→ 0,0 %';
  }
  function cumulativeArrowChart(monthly){
    const W=1200,H=297,left=77,right=66,top=37,bottom=246;
    const width=W-left-right,height=bottom-top;
    const entries=monthly.map((m,index)=>({m,index})).filter(v=>v.m.values!==null);
    const trends=monthlyCATrends(monthly);
    const trendItems=monthly.map((m,i)=>{
      const t=trends[i],cls=t==null?'missing':t>0?'up':t<0?'down':'steady';
      let title='Évolution indisponible : premier mois, mois absent ou CA précédent nul.';
      if(t!=null)title=MONTHS[m.month-1]+' '+m.year+' : '+trendLabel(t)+' de CA mensuel par rapport à '+MONTHS[monthly[i-1].month-1]+'.';
      return '<div class="rxag-trend-item '+cls+'" title="'+esc(title)+'">'+
        '<span class="rxag-trend-value">'+esc(trendLabel(t))+'</span></div>';
    }).join('');
    if(!entries.length)return {
      svg:'<div class="rxag-cum-empty">Aucun CA global renseigné pour cette période. La courbe se construira lors de tes saisies.</div>',
      trends:'',latest:null,monthTrend:null,recorded:0,gaps:monthly.length
    };
    const highest=Math.max(1,...entries.map(e=>e.m.cumulative.ca)),ceiling=highest*1.12;
    const x=i=>Math.round((left+i*width/11)*100)/100;
    const y=v=>Math.round((bottom-v/ceiling*height)*100)/100;
    const pts=entries.map(e=>({x:x(e.index),y:y(e.m.cumulative.ca),index:e.index,m:e.m}));
    const curve=(a,b)=>{
      const dx=b.x-a.x;
      return 'M '+a.x+' '+a.y+' C '+(a.x+dx*.37).toFixed(2)+' '+a.y+
        ' '+(b.x-dx*.37).toFixed(2)+' '+b.y+' '+b.x+' '+b.y;
    };
    const grid=[0,.5,1].map(frac=>{
      const yGrid=Math.round((bottom-frac*height)*100)/100;
      return '<line class="rxag-cum-grid" x1="'+left+'" y1="'+yGrid+'" x2="'+(W-right)+'" y2="'+yGrid+'"/>'+
        '<text class="rxag-cum-y" x="'+(left-12)+'" y="'+(yGrid+4)+'" text-anchor="end">'+
        esc(new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(ceiling*frac/100000))+'</text>';
    }).join('');
    const groups=[];let contiguous=[];
    pts.forEach(p=>{
      if(contiguous.length&&p.index!==contiguous[contiguous.length-1].index+1){groups.push(contiguous);contiguous=[]}
      contiguous.push(p);
    });
    if(contiguous.length)groups.push(contiguous);
    const areas=groups.filter(group=>group.length>1).map(group=>{
      const steps=group.slice(1).map((p,i)=>curve(group[i],p).replace(/^M [\d.]+ [\d.]+ /,'')).join(' ');
      return '<path class="rxag-cum-area" d="M '+group[0].x+' '+bottom+' L '+group[0].x+' '+group[0].y+' '+
        steps+' L '+group[group.length-1].x+' '+bottom+' Z"/>';
    }).join('');
    const links=pts.slice(1).map((p,i)=>{
      const prior=pts[i],gap=p.index!==prior.index+1,last=i===pts.length-2;
      return '<path class="'+(gap?'rxag-cum-dashed':'rxag-cum-line')+'" d="'+curve(prior,p)+'"'+
        (last?' marker-end="url(#rxagArrowhead)"':'')+'/>';
    }).join('');
    const circles=pts.map((p,i)=>{
      const last=i===pts.length-1;
      const trend=trends[p.index];
      const tip=MONTHS[p.m.month-1]+' '+p.m.year+' · CA cumulé '+format(p.m.cumulative.ca)+
        ' · CA mensuel '+format(p.m.values.ca)+' · Variation du CA mensuel : '+trendLabel(trend);
      return '<circle class="'+(last?'rxag-cum-dot rxag-cum-latest':'rxag-cum-dot')+
        '" cx="'+p.x+'" cy="'+p.y+'" r="'+(last?7:4.8)+'"><title>'+esc(tip)+'</title></circle>';
    }).join('');
    const dates=monthly.map((m,i)=>
      '<text class="rxag-cum-month'+(m.values?'':' rxag-cum-month-absent')+
      '" x="'+x(i)+'" y="'+(bottom+27)+'" text-anchor="middle">'+
      esc(MONTHS[m.month-1].slice(0,3))+' '+String(m.year).slice(-2)+'</text>'
    ).join('');
    const latest=pts[pts.length-1];
    const monthTrend=trends[latest.index];
    const svg='<svg class="rxag-cum-svg" viewBox="0 0 '+W+' '+H+
      '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+
      esc('Courbe du CA cumulé sur douze mois en k€, dernier cumul '+format(latest.m.cumulative.ca)+
        '. La variation mensuelle en pourcentage est présentée sous le graphique.')+
      '" xmlns="http://www.w3.org/2000/svg">'+
      '<defs><linearGradient id="rxagCumulativeShade" x1="0" y1="0" x2="0" y2="1">'+
      '<stop offset="0%" stop-color="#2879c7" stop-opacity=".22"/>'+
      '<stop offset="100%" stop-color="#2879c7" stop-opacity=".015"/></linearGradient>'+
      '<marker id="rxagArrowhead" viewBox="0 0 10 10" markerWidth="13" markerHeight="13" refX="9" refY="5" orient="auto">'+
      '<path d="M 0 0 L 9 5 L 0 10 z" fill="#1764aa"/></marker></defs>'+
      '<text class="rxag-cum-axis-title" x="'+left+'" y="18">CA CUMULÉ (k€)</text>'+
      grid+areas+links+circles+dates+'</svg>';
    return {svg,trends:trendItems,latest:latest.m.cumulative.ca,monthTrend,recorded:entries.length,
      gaps:monthly.length-entries.length};
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
    const fiscal=fiscalStart(year,month),annual=goalProgress(result.monthly,annualGoal,fiscal,year,month);
    const percentage=annual.ratio==null?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(annual.ratio)+' %';
    const chart=cumulativeArrowChart(result.monthly);
    const signature=JSON.stringify([rows,year,month,editing,saving,showExtras,message,messageType,annualGoal,annualGoalError]);
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
    el.innerHTML='<div class="rxag-header"><div><div class="rxh-eyebrow">PILOTAGE PERSONNEL · AGENCE CORRÈZE</div>'+
      '<h3>Résultats globaux sur 12 mois · k€</h3><p>CA, NC et UC en milliers d’euros (k€), saisis par toi, indépendamment des vendeurs et des secteurs.</p></div>'+
      '<div class="rxag-filters"><label for="rxAgencyMonth">Dernier mois</label><input type="month" id="rxAgencyMonth" max="'+maxMonth+
      '" value="'+selected+'"><button type="button" id="rxAgencyReload">↻ Actualiser</button></div></div>'+
      '<section class="rxag-goal" aria-label="Avancement de l’objectif annuel agence">'+
        '<div class="rxag-goal-head"><div><h4>🎯 Objectif annuel d’agence · '+yearLabel(fiscal)+' · k€</h4>'+
          '<p>Exercice avril '+fiscal+' → mars '+(fiscal+1)+' · résultats globaux saisis par toi.</p></div>'+
          '<span class="rxag-goal-period">'+annual.count+'/'+annual.expected+' mois saisis à date</span></div>'+
        '<div class="rxag-goal-metrics">'+
          '<div><small>Objectif annuel CA</small><strong>'+format(annual.targets?.ca??null)+'</strong></div>'+
          '<div><small>CA réalisé déclaré</small><strong>'+format(annual.totals?.ca??null)+'</strong></div>'+
          '<div><small>Objectif atteint</small><strong>'+percentage+'</strong></div>'+
          '<div><small>Reste à réaliser</small><strong>'+format(annual.remaining)+'</strong></div>'+
        '</div>'+
        '<div class="rxag-goal-track" role="progressbar" aria-label="Progression vers l’objectif annuel" aria-valuemin="0" aria-valuemax="100"'+
          (annual.ratio==null?'':' aria-valuenow="'+Math.min(100,Math.max(0,Math.round(annual.ratio)))+'"')+'>'+
          '<span style="width:'+(annual.ratio==null?0:Math.min(100,Math.max(0,annual.ratio)))+'%"></span></div>'+
        '<div class="rxag-goal-foot">'+
          (annualGoalError?'<span class="rxag-goal-error">'+esc(annualGoalError)+'</span>':
            (!annual.targets?'<span>Objectif non renseigné pour cet exercice dans Suivi CA fiscal.</span>':
              (!annual.count?'<span>Le CA global de l’exercice n’a pas encore été renseigné : progression indisponible.</span>':
                '<span>Avancement sur les mois déclarés'+(annual.count<annual.expected?' (suivi partiel)':'')+'.</span>')))+
          (annual.targets?'<span>Objectif NC : '+format(annual.targets.nc)+' · Objectif UC : '+format(annual.targets.uc)+'</span>':'')+
        '</div></section>'+
      '<div class="rxag-kpis">'+metrics().map(k=>'<div class="rxag-kpi"><small>'+label(k)+' cumulé</small><strong>'+
        format(final?.[k]??null)+'</strong><span>'+result.count+'/12 mois renseignés</span></div>').join('')+'</div>'+
      '<div class="rxag-status"><strong>'+result.count+'/12 mois renseignés</strong> · '+(result.complete?
        'Cumul complet sur douze mois.':'Cumul partiel : les mois non saisis ne sont jamais considérés comme 0 €.')+
        ' Les NC et UC sont compris dans le CA.</div>'+
      '<div class="rxag-graph-head rxag-cum-header"><div><h4>↗ Progression du CA cumulé</h4>'+
        '<p>Courbe du cumul en k€ ; sous chaque mois, l’évolution du CA mensuel par rapport au précédent.</p></div>'+
        '<div class="rxag-cum-summary"><strong>'+(chart.latest==null?'—':format(chart.latest))+'</strong>'+
        '<span class="'+(chart.monthTrend==null?'neutral':chart.monthTrend>0?'up':chart.monthTrend<0?'down':'steady')+'">'+
          (chart.monthTrend==null?'Tendance mensuelle indisponible':trendLabel(chart.monthTrend)+' de CA mensuel')+
        '</span></div></div>'+
      '<div class="rxag-cum-panel">'+chart.svg+
        (chart.trends?'<div class="rxag-trends" aria-label="Évolution du CA mensuel en pourcentage">'+chart.trends+'</div>':'')+
      '</div>'+
      '<div class="rxag-cum-explanation">La courbe bleue représente le <b>CA cumulé</b> : elle monte même quand l’activité ralentit. '+
        'Les flèches <b>vertes ou rouges</b> indiquent une hausse ou baisse du <b>CA mensuel vs mois précédent</b>.'+
        (chart.gaps?' <span>Les segments pointillés traversent des mois non renseignés : le cumul est partiel.</span>':'')+
      '</div>'+
      '<div class="rxag-table-head"><div><h4>Cumul et suivi mensuel</h4><p>Les mêmes 12 mois, avec cumul progressif après chaque mois.</p></div>'+
        '<button type="button" id="rxAgencyEdit">'+(editing?'Annuler la saisie':'✎ Saisir ou corriger les chiffres')+'</button></div>'+
      '<div class="rxag-table-wrap"><table class="rxag-table"><thead><tr><th>Mois</th><th>CA (k€)</th><th>NC (k€)</th><th>UC (k€)</th>'+
        '<th>Cumul CA</th><th>Cumul NC</th><th>Cumul UC</th><th>État</th></tr></thead><tbody>'+tableRows+'</tbody></table></div>'+
      (editing?'<div class="rxag-actions"><button type="button" id="rxAgencySave" class="rxag-save" '+(saving?'disabled':'')+
        '>'+(saving?'Enregistrement…':'Enregistrer les mois modifiés')+'</button><span>Saisis les montants en k€ (exemple : 102,68 = 102 680 €). Complète CA, NC et UC, avec 0 si besoin.</span></div>':'')+
      '<div id="rxAgencyNotice" class="rxag-'+(messageType==='error'?'error':'notice')+'" role="status">'+esc(message)+'</div>'+
      '<div class="rxag-footer"><span>Tous les montants affichés sont en k€. Source : tes chiffres globaux ; aucune addition automatique des chiffres vendeurs ou secteurs.</span>'+
      '<button type="button" id="rxAgencyExtras" aria-expanded="'+String(showExtras)+'">'+
       (showExtras?'Masquer les analyses complémentaires':'Afficher les autres analyses (facultatif)')+'</button></div>';
    el.querySelector('#rxAgencyMonth').onchange=e=>{
      const input=e.target.value||'';
      if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(input)||input>maxMonth){e.target.value=selected;return}
      if(editing&&!confirm('Quitter la saisie sans enregistrer les modifications ?')){e.target.value=selected;return}
      const next=input.split('-').map(Number);year=next[0];month=next[1];editing=false;lastMarkup='';load();
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
        const parsed=parseKeuro(text);
        if(parsed===null){notice('Montant '+k.toUpperCase()+' incorrect pour '+key+'. Saisis des k€ avec au maximum deux décimales.','error');return}
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
      const fy=fiscalStart(year,month);
      const [result,goalResult]=await Promise.all([
        db.from(TABLE).select('month_start,ca_cents,nc_cents,uc_cents,updated_at')
          .eq('manager_user_id',u.id).gte('month_start',range[0].key).lte('month_start',range[11].key)
          .order('month_start'),
        db.from('agency_sales_targets').select('fiscal_start_year,ca_target,nc_target,upcross_target')
          .eq('fiscal_start_year',fy).maybeSingle()
      ]);
      if(result.error)throw result.error;
      if(selectISO(year,month)!==requestMonth){queue=true;return}
      rows=result.data||[];
      annualGoal=goalResult.error?null:(goalResult.data||null);
      annualGoalError=goalResult.error?'Objectif annuel indisponible : '+goalResult.error.message:'';
      lastMarkup='';if(messageType==='error'){message='';messageType='ok'}render();
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