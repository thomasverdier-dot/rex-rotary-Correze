(function managerModule(){
  'use strict';
  const ROOT='rexManagerForecastReliability';
  const currency=new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2});
  const euros=c=>currency.format(Math.round(Number(c||0))/100);
  const integer=x=>new Intl.NumberFormat('fr-FR').format(x);
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const roundC=x=>Math.round(Number(x||0)*100);
  const planC=x=>Math.round(Number(x||0)*100000);
  const frac=p=>Number.isFinite(Number(p))?Math.min(1,Math.max(0,Number(p)/100)):0;
  const pad=n=>String(n).padStart(2,'0');
  const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const fromISO=s=>{const [y,m,d]=String(s).split('-').map(Number);return new Date(y,m-1,d,12)};
  const shift=(s,days)=>{const d=fromISO(s);d.setDate(d.getDate()+days);return iso(d)};
  const startMonday=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate(),12);x.setDate(x.getDate()-(x.getDay()+6)%7);return iso(x)};
  const now=new Date();
  const thisWeek=startMonday(now), nextWeek=shift(thisWeek,7);
  const monthOf=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}`;
  const monthAfter=m=>{const d=fromISO(m+'-01');d.setMonth(d.getMonth()+1);return iso(d)};
  const monthTitle=m=>fromISO(m+'-01').toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  const dateTitle=s=>fromISO(s).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});
  const sum=(arr,fn)=>arr.reduce((acc,r)=>acc+fn(r),0);
  const profileData=()=>{try{return profile||currentProfile||null}catch(e){return null}};
  const userData=()=>{try{return user||currentUser||null}catch(e){return null}};
  const db=()=>{try{return sb}catch(e){return null}};
  const isManager=()=>profileData()?.role==='admin';
  const page=()=>document.querySelector('.rex-page[data-page="dashboard"]');
  let month=monthOf(now),week=nextWeek,requesting=false,pending=false,started=false,lastRefresh=0,refreshTimeout=null,working=false,open=true,
    snapshots=[],source=null,error='',message='',historicalSigned=[],historyReady=false,lastSignature='';

  function weighted(rows){return sum(rows,r=>Math.round(planC(r.amount)*frac(r.probability)))}
  function summarizeMonth(deals,signed){
    const openDeals=deals.filter(r=>!r.sale_completed),ca=sum(signed,r=>roundC(r.signed_amount_eur));
    return {gross:sum(deals,r=>planC(r.amount)),openRaw:sum(openDeals,r=>planC(r.amount)),openExpected:weighted(openDeals),ca,
      expected:ca+weighted(openDeals),signedNumber:deals.filter(r=>r.sale_completed).length,count:deals.length,pending:openDeals.length,
      nc:sum(signed.filter(r=>r.client_type==='nouveau'),r=>roundC(r.signed_amount_eur))};
  }
  function summarizeWeek(deals){
    return {gross:sum(deals,r=>planC(r.amount)),expected:weighted(deals),count:deals.length};
  }
  function perSeller(people,monthDeals,monthSigned,weekDeals){
    return people.map(p=>{
      const m=monthDeals.filter(x=>x.user_id===p.user_id),a=monthSigned.filter(x=>x.user_id===p.user_id),w=weekDeals.filter(x=>x.user_id===p.user_id);
      return {user_id:p.user_id,name:p.display_name||'Commercial',sector:p.sector_id||'—',month:summarizeMonth(m,a),week:summarizeWeek(w),n:m.length,win:m.filter(x=>x.sale_completed).length};
    });
  }
  function isPast(snapshot){
    const end=snapshot.period_type==='week'?shift(snapshot.period_start,7):monthAfter(snapshot.period_start.slice(0,7));
    const today=iso(new Date());
    const taken=String(snapshot.created_at||'').slice(0,10);
    return end<=today&&(snapshot.period_type==='week'?taken<=snapshot.period_start:taken<end);
  }
  function realized(snapshot,signs){
    const from=snapshot.period_start,until=snapshot.period_type==='week'?shift(from,7):monthAfter(from.slice(0,7));
    return sum(signs.filter(x=>x.signature_date>=from&&x.signature_date<until),r=>roundC(r.signed_amount_eur));
  }
  function snapDetails(periodType,sellers){
    return sellers.map(s=>({
      user_id:s.user_id,display_name:s.name,sector_id:s.sector,
      estimated_cents:periodType==='month'?s.month.expected:s.week.expected,
      gross_cents:periodType==='month'?s.month.gross:s.week.gross,
      confirmed_cents:periodType==='month'?s.month.ca:0,
      count:periodType==='month'?s.month.count:s.week.count,
      signed_count:periodType==='month'?s.month.signedNumber:0
    }));
  }
  function historyAnalysis(allSnapshots,signs){
    const distinct=new Map();
    for(const s of allSnapshots){
      if(!isPast(s))continue;
      const key=s.period_type+'|'+s.period_start;
      if(!distinct.has(key))distinct.set(key,s); // ordre: dernier enregistrement d'abord
    }
    return [...distinct.values()].map(s=>{
      const actual=realized(s,signs),estimate=Number(s.estimated_cents||0);
      return {s,actual,estimate,diff:actual-estimate,ratio:estimate>0?actual/estimate:null};
    }).sort((a,b)=>b.s.period_start.localeCompare(a.s.period_start)).slice(0,12);
  }
  function sellerHistoricalRatio(userId,history,signs){
    const eligible=history.filter(row=>row.s.period_type==='week');
    let periods=0,predicted=0,actual=0;
    for(const row of eligible){
      const details=Array.isArray(row.s.seller_details)?row.s.seller_details:[];
      const seller=details.find(x=>x.user_id===userId);
      if(!seller||!Number(seller.estimated_cents))continue;
      periods++;
      predicted+=Number(seller.estimated_cents);
      actual+=realizedForUser(row.s,signs,userId);
    }
    // Ne pas calculer de coefficient sur un petit échantillon.
    return {periods,predicted,actual,ratio:periods>=4&&predicted>0?actual/predicted:null};
  }
  function realizedForUser(snapshot,signs,userId){
    const end=snapshot.period_type==='week'?shift(snapshot.period_start,7):monthAfter(snapshot.period_start.slice(0,7));
    return sum(signs.filter(r=>r.user_id===userId&&r.signature_date>=snapshot.period_start&&r.signature_date<end),r=>roundC(r.signed_amount_eur));
  }
  function style(){
    if(document.getElementById('rexManagerForecastStyle'))return;
    const el=document.createElement('style');el.id='rexManagerForecastStyle';el.textContent=`
      #${ROOT}{margin:0 0 18px;background:#fff;border:1px solid #e1e7ef;border-radius:14px;color:#233750;padding:16px 18px;box-shadow:none}
      #${ROOT} summary.mfr-head{display:flex;gap:12px;align-items:center;cursor:pointer;list-style:none}
      #${ROOT} summary.mfr-head::-webkit-details-marker{display:none}
      #${ROOT} summary.mfr-head h3{margin:0;font-size:17px;color:#193451;font-weight:850}
      #${ROOT} .mfr-chevron{margin-left:auto;color:#718199;font-size:23px}
      #${ROOT}[open] .mfr-chevron{transform:rotate(180deg)}
      #${ROOT} .mfr-intro{color:#758298;font-size:11px;line-height:1.6;margin:6px 0 12px}
      #${ROOT} .mfr-controls{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin:12px 0 17px}
      #${ROOT} .mfr-controls label{font-size:10px;font-weight:700;color:#8290a1;display:block;margin-bottom:5px}
      #${ROOT} input{min-height:34px;padding:7px 9px;background:#fff;border:1px solid #dbe3eb;border-radius:8px;color:#25415f;font-size:12px;box-sizing:border-box}
      #${ROOT} button{background:#f7f9fc;border:1px solid #dce4ed;border-radius:7px;color:#304f70;font-weight:790;font-size:11px;cursor:pointer;padding:9px 11px;min-height:34px}
      #${ROOT} button:hover{background:#ecf2f8}#${ROOT} button:disabled{opacity:.55;cursor:wait}
      #${ROOT} button.mfr-primary{background:#183d6b;color:#fff;border-color:#183d6b}#${ROOT} button.mfr-primary:hover{background:#285584}
      #${ROOT} .mfr-section{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:9px;border-top:1px solid #e9eef3;padding:13px 0 9px}
      #${ROOT} .mfr-section strong{font-size:13px;color:#1e3856}
      #${ROOT} .mfr-section span{font-size:11px;color:#728195}
      #${ROOT} .mfr-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));padding:8px 0}
      #${ROOT} .mfr-kpi{min-width:0;padding:6px 13px;border-right:1px solid #e8edf2}
      #${ROOT} .mfr-kpi:last-child{border-right:0}
      #${ROOT} .mfr-kpi small{display:block;color:#7a8999;font-size:10px;line-height:1.5}
      #${ROOT} .mfr-kpi b{display:block;margin-top:5px;font-size:19px;color:#19395f;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
      #${ROOT} .mfr-kpi .mfr-confirmed{color:#1b7a56}
      #${ROOT} .mfr-note{font-size:11px;line-height:1.55;color:#778495;margin:7px 0 12px}
      #${ROOT} .mfr-pending{color:#946724}
      #${ROOT} .mfr-actions{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin:10px 0 15px}
      #${ROOT} .mfr-actions span{font-size:10px;color:#7c8998}
      #${ROOT} .mfr-scroll{width:100%;overflow:auto}
      #${ROOT} table{border-collapse:collapse;width:100%;min-width:750px}
      #${ROOT} th,#${ROOT} td{padding:9px 10px;text-align:left;font-size:11px;border-bottom:1px solid #edf1f5;font-variant-numeric:tabular-nums;white-space:nowrap}
      #${ROOT} th{color:#758396;background:#fbfcfd;font-size:10px}
      #${ROOT} td.mfr-strong{font-weight:830;color:#24754f}
      #${ROOT} .mfr-warn{border-left:2px solid #d6a45a;background:#fffcf6;color:#956a2a;padding:9px 12px;font-size:11px;line-height:1.65;margin:12px 0}
      #${ROOT} .mfr-ok{font-size:11px;color:#18774c;margin:7px 0}
      #${ROOT} .mfr-error{font-size:11px;color:#ab2d2d;margin:7px 0}
      #${ROOT} details.mfr-sub{margin-top:8px}#${ROOT} details.mfr-sub summary{cursor:pointer;color:#315271;font-size:12px;font-weight:780;padding:5px 0}
      #${ROOT} .mfr-no-history{font-size:11px;color:#7f8da0;margin:7px 0}
      @media(max-width:800px){#${ROOT} .mfr-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
        #${ROOT} .mfr-kpi:nth-child(2){border-right:0}
        #${ROOT} .mfr-kpi:nth-child(-n+2){border-bottom:1px solid #edf1f5}}
      @media(max-width:450px){#${ROOT}{padding:13px 11px}#${ROOT} .mfr-kpi{padding:8px}#${ROOT} .mfr-kpi b{font-size:16px}}
    `;document.head.appendChild(el);
  }
  function mount(){
    if(!isManager()){
      document.getElementById(ROOT)?.remove();
      return null;
    }
    const p=page();if(!p)return null;
    style();
    let box=document.getElementById(ROOT);
    if(!box){
      box=document.createElement('details');box.id=ROOT;box.open=open;
      box.innerHTML='<summary class="mfr-head"><h3>📊 Fiabilité des prévisions · responsable</h3><span class="mfr-chevron" aria-hidden="true">⌄</span></summary><p>Préparation des chiffres…</p>';
      p.appendChild(box);
      box.addEventListener('toggle',()=>{open=box.open;if(box.open&&!source)load()});
    }
    const anchor=p.querySelector('#rexFridayCrmReport')||p.querySelector('#rexLiveSalesPerformance');
    if(anchor&&anchor.nextElementSibling!==box)anchor.insertAdjacentElement('afterend',box);
    return box;
  }
  function show(){
    const box=mount();if(!box||!source)return;
    const {people,months,monthSigned,weekly}=source,monthSum=summarizeMonth(months,monthSigned),
      weekSum=summarizeWeek(weekly),sellers=perSeller(people,months,monthSigned,weekly);
    const hist=historyReady?historyAnalysis(snapshots,historicalSigned):[];
    const historicalRatios=new Map(sellers.map(s=>[s.user_id,sellerHistoricalRatio(s.user_id,hist,historicalSigned)]));
    const atLeast4=sellers.some(s=>historicalRatios.get(s.user_id)?.ratio!==null);
    const changeStatus=source?.snapshotError||'';
    const signature=JSON.stringify([month,week,months,monthSigned,weekly,snapshots,historicalSigned,historyReady,working,error,message,changeStatus]);
    if(lastSignature===signature&&box.querySelector('#mfrFeedback'))return;
    const expandedDetails=[...box.querySelectorAll('details.mfr-sub')].map(el=>el.open);
    const snapshotCount=snapshots.filter(x=>x.period_start===month+'-01'&&x.period_type==='month').length;
    const weekSnapshotCount=snapshots.filter(x=>x.period_start===week&&x.period_type==='week').length;
    const monthlyRows=sellers.map(s=>`<tr><td>${escape(s.name)} · S${escape(s.sector)}</td>
      <td>${s.month.count}</td><td>${euros(s.month.gross)}</td><td class="mfr-strong">${euros(s.month.ca)}</td>
      <td>${euros(s.month.openRaw)}</td><td>${euros(s.month.openExpected)}</td>
      <td class="mfr-strong">${euros(s.month.expected)}</td>
      <td>${s.month.count?Math.round(100*s.month.signedNumber/s.month.count)+' %':'—'}</td>
      <td>${s.month.gross?Math.round(100*s.month.ca/s.month.gross)+' %':'—'}</td>
      <td>${historicalRatios.get(s.user_id)?.ratio===null?'En construction':Math.round(100*historicalRatios.get(s.user_id).ratio)+' %'}</td></tr>`).join('');
    const weeklyRows=sellers.map(s=>`<tr><td>${escape(s.name)} · S${escape(s.sector)}</td>
      <td>${s.week.count}</td><td>${euros(s.week.gross)}</td>
      <td class="mfr-strong">${euros(s.week.expected)}</td>
      <td>${s.week.count&&s.week.gross?Math.round(s.week.expected/s.week.gross*100)+' %':'—'}</td>
      <td>${historicalRatios.get(s.user_id)?.ratio===null?'En construction':Math.round(100*historicalRatios.get(s.user_id).ratio)+' %'}</td></tr>`).join('');
    const snapRows=hist.map(x=>`<tr><td>${x.s.period_type==='month'?'Mois':'S+1'}</td><td>${dateTitle(x.s.period_start)}</td>
      <td>${euros(x.estimate)}</td><td class="mfr-strong">${euros(x.actual)}</td>
      <td>${x.ratio===null?'—':Math.round(x.ratio*100)+' %'}</td>
      <td>${euros(x.diff)}</td></tr>`).join('');
    const anyDeals=months.length||weekly.length;
    box.innerHTML=`<summary class="mfr-head"><h3>📊 Fiabilité des prévisions · responsable</h3><span class="mfr-chevron" aria-hidden="true">⌄</span></summary>
      <div class="mfr-intro">Outil personnel de préparation des chiffres à transmettre à l'entreprise. Aucun impact sur le logiciel métier ni sur les prévisions saisies par les vendeurs.</div>
      <div class="mfr-controls">
        <div><label for="mfrMonth">Mois analysé</label><input id="mfrMonth" type="month" value="${month}"></div>
        <div><label for="mfrWeek">Semaine S+1 à annoncer (lundi)</label><input id="mfrWeek" type="date" value="${week}"></div>
        <button type="button" id="mfrRefresh">↻ Actualiser</button>
      </div>
      <div class="mfr-section"><strong>Mois · ${escape(monthTitle(month))}</strong><span>${monthSum.count} affaire${monthSum.count>1?'s':''} · ${monthSum.signedNumber} déjà validée${monthSum.signedNumber>1?'s':''}</span></div>
      <div class="mfr-kpis">
        <div class="mfr-kpi"><small>Prévision brute des vendeurs</small><b>${euros(monthSum.gross)}</b></div>
        <div class="mfr-kpi"><small>CA réellement signé ce mois</small><b class="mfr-confirmed">${euros(monthSum.ca)}</b></div>
        <div class="mfr-kpi"><small>Reste à signer pondéré</small><b>${euros(monthSum.openExpected)}</b></div>
        <div class="mfr-kpi"><small>Estimation indicative à annoncer</small><b>${euros(monthSum.expected)}</b></div>
      </div>
      <div class="mfr-note">Estimation du mois = CA signé (montant exact en €) + affaires non signées × probabilité renseignée par les vendeurs. Prévision brute inchangée dans le CRM. ${monthSum.pending} affaire${monthSum.pending!==1?'s':''} encore ouverte${monthSum.pending!==1?'s':''} (${euros(monthSum.openRaw)} non pondérés).</div>
      <details class="mfr-sub"><summary>Détail et ratios du mois par commercial</summary>
        <div class="mfr-scroll"><table><thead><tr><th>Commercial</th><th>Affaires</th><th>Prévision brute</th><th>CA signé</th><th>Non signé brut</th><th>Non signé pondéré</th><th>Estimation</th><th>Affaires validées à date</th><th>CA signé / prévision à date</th><th>Fiabilité S+1 historisée</th></tr></thead>
          <tbody>${monthlyRows||'<tr><td colspan="10">Aucun vendeur.</td></tr>'}</tbody></table></div>
        <p class="mfr-note">Les taux « affaires validées » et « CA signé / prévision » mesurent l'avancement du mois, pas la fiabilité historique du commercial.</p>
      </details>
      <div class="mfr-actions">
        <button class="mfr-primary" data-save="month" type="button" ${monthSum.count&&!working?'':'disabled'}>Figer ma prévision du mois</button>
        <button type="button" data-copy="month">Copier pour l'entreprise</button>
        <span>${snapshotCount} annonce${snapshotCount>1?'s':''} historisée${snapshotCount>1?'s':''} pour ce mois</span>
      </div>
      <div class="mfr-section"><strong>Prévision S+1 · semaine du ${dateTitle(week)}</strong><span>${weekSum.count} affaire${weekSum.count>1?'s':''} prévues</span></div>
      <div class="mfr-kpis">
        <div class="mfr-kpi"><small>Prévision brute S+1</small><b>${euros(weekSum.gross)}</b></div>
        <div class="mfr-kpi"><small>S+1 pondéré par probabilité</small><b>${euros(weekSum.expected)}</b></div>
        <div class="mfr-kpi"><small>Coefficient de pondération</small><b>${weekSum.gross?Math.round(weekSum.expected/weekSum.gross*100)+' %':'—'}</b></div>
        <div class="mfr-kpi"><small>Historique de fiabilité</small><b>${atLeast4?'Consultable ci-dessous':'Insuffisant'}</b></div>
      </div>
      <div class="mfr-note">La prévision pondérée S+1 n'est pas une garantie de signature : elle repose uniquement sur les probabilités saisies. Les ratios historiques par vendeur apparaîtront après au moins quatre semaines S+1 figées, terminées et comparables.</div>
      <details class="mfr-sub"><summary>Détail des prévisions S+1 par commercial</summary>
        <div class="mfr-scroll"><table><thead><tr><th>Commercial</th><th>Affaires S+1</th><th>Prévision brute</th><th>Montant pondéré</th><th>Pondération moyenne</th><th>Fiabilité S+1 historisée</th></tr></thead>
          <tbody>${weeklyRows||'<tr><td colspan="6">Aucun vendeur.</td></tr>'}</tbody></table></div>
      </details>
      <div class="mfr-actions">
        <button class="mfr-primary" data-save="week" type="button" ${weekSum.count&&!working?'':'disabled'}>Figer ma prévision S+1</button>
        <button type="button" data-copy="week">Copier S+1 pour l'entreprise</button>
        <span>${weekSnapshotCount} annonce${weekSnapshotCount>1?'s':''} historisée${weekSnapshotCount>1?'s':''} sur cette semaine</span>
      </div>
      <div class="mfr-section"><strong>Écart entre mes annonces et les signatures</strong><span>Historique privé du responsable</span></div>
      ${hist.length?`<div class="mfr-scroll"><table><thead><tr><th>Période</th><th>Début</th><th>Annonce figée</th><th>CA réellement signé</th><th>Réalisé / annoncé</th><th>Écart</th></tr></thead>
        <tbody>${snapRows}</tbody></table></div>`:
        '<p class="mfr-no-history">Pas encore de période terminée avec une prévision figée. Les ratios de fiabilité réels apparaîtront une fois les annonces et leurs résultats disponibles.</p>'}
      ${!atLeast4?'<div class="mfr-warn">Les données antérieures aux premières prévisions figées peuvent être incomplètes. Il faut au moins quatre semaines clôturées pour établir une fiabilité historique par vendeur.</div>':'<p class="mfr-note">Les ratios historiques comparent des prévisions figées avant la semaine au CA réellement signé. Ils restent indicatifs et ne sont pas appliqués automatiquement aux projections.</p>'}
      ${changeStatus?`<p class="mfr-error">${escape(changeStatus)}</p>`:''}
      <p id="mfrFeedback" class="${error?'mfr-error':'mfr-ok'}" role="status">${escape(error||message)}</p>
      <p class="mfr-note">Dernière actualisation : ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}. Le gel de prévision enregistre une photo privée de ton annonce ; il ne change aucune donnée de vente.</p>`;
    const control=box.querySelector('#mfrMonth');
    if(control)control.onchange=e=>{month=e.target.value||month;load()};
    const cweek=box.querySelector('#mfrWeek');
    if(cweek)cweek.onchange=e=>{week=startMonday(fromISO(e.target.value||week));load()};
    box.querySelector('#mfrRefresh').onclick=()=>load();
    box.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>copy(b.dataset.copy,monthSum,weekSum,sellers));
    box.querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>freeze(b.dataset.save,monthSum,weekSum,sellers));
    [...box.querySelectorAll('details.mfr-sub')].forEach((el,i)=>{el.open=!!expandedDetails[i]});
    lastSignature=signature;
  }
  function copyText(kind,m,w,people){
    if(kind==='month'){
      const lines=[`PRÉVISION RESPONSABLE — ${monthTitle(month).toUpperCase()}`,
        `CA signé confirmé : ${euros(m.ca)}`,
        `Affaires restantes (montant brut) : ${euros(m.openRaw)}`,
        `Reste pondéré par probabilités : ${euros(m.openExpected)}`,
        `ESTIMATION INDICATIVE DU MOIS : ${euros(m.expected)}`,
        `Prévision brute totale des commerciaux : ${euros(m.gross)}`,
        `Détail par commercial :`];
      people.forEach(x=>lines.push(`  ${x.name} (S${x.sector}) : signé ${euros(x.month.ca)} + reste pondéré ${euros(x.month.openExpected)} = estimation ${euros(x.month.expected)}`));
      return lines.concat(['Méthode : signé exact + affaires non signées pondérées par probabilités déclarées ; historique non calibré.']).join('\n');
    }
    const lines=[`PRÉVISION RESPONSABLE S+1 — SEMAINE DU ${dateTitle(week)}`,
      `Prévision brute : ${euros(w.gross)}`,`Prévision pondérée indicative : ${euros(w.expected)}`,
      `Détail par commercial :`];
    people.forEach(x=>lines.push(`  ${x.name} (S${x.sector}) : brut ${euros(x.week.gross)}, pondéré ${euros(x.week.expected)}`));
    return lines.concat(['Méthode : affaires S+1 × probabilités déclarées. Estimation indicative, non calibrée sur un historique suffisant.']).join('\n');
  }
  async function copy(kind,m,w,people){
    if(!isManager())return;
    const text=copyText(kind,m,w,people);
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
      else{
        const input=document.createElement('textarea');input.value=text;document.body.appendChild(input);input.select();
        const copied=document.execCommand('copy');input.remove();if(!copied)throw Error('Presse Ctrl+C pour copier');
      }
      error='';message='Prévision copiée. Tu peux la transmettre dans le logiciel de ton entreprise.';
    }catch(e){error='Impossible de copier automatiquement : '+String(e?.message||e);message=''}
    const box=document.getElementById(ROOT),node=box?.querySelector('#mfrFeedback');
    if(node){node.textContent=error||message;node.className=error?'mfr-error':'mfr-ok'}
  }
  async function freeze(kind,m,w,people){
    const client=db(),u=userData();if(!isManager()||!client||!u||working)return;
    const summary=kind==='month'?m:w,period=kind==='month'?month+'-01':week;
    if(!summary.count){error='Aucune affaire prévue : rien à enregistrer.';message='';show();return}
    const until=kind==='month'?monthAfter(month):shift(week,7);
    if(until<=iso(new Date())){error='Cette période est déjà terminée. Tu peux consulter l’historique, mais pas créer une nouvelle annonce après coup.';message='';show();return}
    if(kind==='week'&&period<iso(new Date())){error='Une prévision S+1 doit être figée avant le début de la semaine concernée, au plus tard le lundi.';message='';show();return}
    if(!confirm(`Conserver une copie privée de la prévision ${kind==='month'?'du mois':'S+1'} : ${euros(summary.expected)} ? Elle ne pourra pas être modifiée, afin de mesurer ensuite l'écart avec le CA réalisé.`))return;
    working=true;error='';message='Enregistrement de ta prévision…';show();
    try{
      const payload={
        manager_user_id:u.id,period_type:kind,period_start:period,
        estimated_cents:summary.expected,gross_cents:summary.gross,
        confirmed_cents:kind==='month'?summary.ca:0,deal_count:summary.count,
        seller_details:snapDetails(kind,people)
      };
      const q=await client.from('manager_forecast_snapshots').insert(payload).select('id').single();
      if(q.error)throw q.error;
      message='Prévision historisée pour ton compte responsable. Les données commerciales restent inchangées.';
      await load();
    }catch(e){error='Impossible de conserver ta prévision : '+String(e?.message||e);message=''}
    finally{working=false;show()}
  }
  async function load(){
    if(!isManager())return;
    const box=mount(),client=db(),u=userData();
    if(!box||!client||!u)return;
    if(requesting){pending=true;return}
    requesting=true;lastRefresh=Date.now();
    const monthKey=month,weekKey=week;
    try{
      const peopleReq=await client.from('profiles').select('user_id,display_name,sector_id').eq('role','seller').order('sector_id');
      if(peopleReq.error)throw peopleReq.error;
      const people=peopleReq.data||[],ids=people.map(x=>x.user_id);
      if(!ids.length){error='Aucun commercial renseigné.';source=null;return}
      const [mr,ar,wr,sr]=await Promise.all([
        client.from('monthly_forecasts').select('id,user_id,amount,probability,month_start,sale_completed,signed_amount_eur,signature_date')
          .eq('month_start',monthKey+'-01').in('user_id',ids),
        client.from('monthly_forecasts').select('id,user_id,signature_date,signed_amount_eur,client_type')
          .eq('sale_completed',true).gte('signature_date',monthKey+'-01').lt('signature_date',monthAfter(monthKey)).in('user_id',ids),
        client.from('weekly_forecasts').select('id,user_id,week_start,amount,probability')
          .eq('week_start',weekKey).in('user_id',ids),
        client.from('manager_forecast_snapshots')
          .select('id,period_type,period_start,created_at,estimated_cents,gross_cents,confirmed_cents,deal_count,seller_details')
          .eq('manager_user_id',u.id).order('created_at',{ascending:false}).limit(40)
      ]);
      for(const q of [mr,ar,wr])if(q.error)throw q.error;
      if(month!==monthKey||week!==weekKey){pending=true;return}
      snapshots=sr.error?[]:(sr.data||[]);
      let snapshotError=sr.error?'Historique des annonces indisponible : '+sr.error.message:'';
      historyReady=false;historicalSigned=[];
      const past=snapshots.filter(isPast);
      if(past.length){
        const begin=past.reduce((min,s)=>s.period_start<min?s.period_start:min,past[0].period_start);
        const end=iso(new Date());
        const q=await client.from('monthly_forecasts').select('user_id,signature_date,signed_amount_eur')
          .eq('sale_completed',true).gte('signature_date',begin).lt('signature_date',end).in('user_id',ids);
        if(q.error)snapshotError='Historique signé momentanément indisponible : '+q.error.message;
        else {historicalSigned=q.data||[];historyReady=true}
      }
      if(month!==monthKey||week!==weekKey){pending=true;return}
      source={people,months:mr.data||[],monthSigned:ar.data||[],weekly:wr.data||[],snapshotError};
      error='';show();
    }catch(e){source=null;const el=mount();if(el){
      el.innerHTML='<summary class="mfr-head"><h3>📊 Fiabilité des prévisions · responsable</h3></summary><div class="mfr-error">Données indisponibles : '+escape(e?.message||e)+'</div><button id="mfrRetry">Réessayer</button>';
      el.querySelector('#mfrRetry')?.addEventListener('click',()=>load())
    }}
    finally{requesting=false;if(pending){pending=false;load()}}
  }
  function refreshSoon(){
    if(!isManager()||!page()?.classList.contains('active'))return;
    if(document.activeElement?.closest?.('#'+ROOT+' .mfr-controls'))return;
    if(refreshTimeout!==null)clearTimeout(refreshTimeout);
    refreshTimeout=setTimeout(()=>{refreshTimeout=null;load()},950);
  }
  function start(){
    const p=profileData();
    if(!p)return false;
    if(p.role!=='admin')return true; // Module absent et aucune requête sur les comptes commerciaux.
    if(!db()||!userData()||!mount())return false;
    if(started)return true;
    started=true;load();
    return true;
  }
  window.addEventListener('rex:commercial-data-changed',refreshSoon);
  window.addEventListener('rex:monthly-sale-synced',refreshSoon);
  window.addEventListener('rex:weekly-forecast-synced',refreshSoon);
  window.addEventListener('focus',()=>{if(lastRefresh&&Date.now()-lastRefresh>45000)refreshSoon()});
  document.addEventListener('click',e=>{if(e.target?.closest?.('.rex-nav button[data-page="dashboard"]')&&lastRefresh&&Date.now()-lastRefresh>15000)setTimeout(refreshSoon,150)});
  let tries=0;
  const timer=setInterval(()=>{tries++;if(start()||tries>180)clearInterval(timer)},450);
  setInterval(()=>{if(started&&page()?.classList.contains('active')&&Date.now()-lastRefresh>45000)refreshSoon()},10000);
  window.addEventListener('load',()=>setTimeout(start,950));
})();