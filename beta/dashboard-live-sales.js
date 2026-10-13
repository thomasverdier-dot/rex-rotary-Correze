(function dashboardModule(){
  const ROOT='rexLiveSalesPerformance';
  const fmtEUR=c=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(c/100);
  const centsE=x=>Math.round(Number(x||0)*100);
  const centsK=x=>Math.round(Number(x||0)*100000);
  const pad=x=>String(x).padStart(2,'0');
  const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const fromISO=s=>{const [y,m,d]=String(s).split('-').map(Number);return new Date(y,m-1,d,12)};
  const advance=(s,days)=>{const d=fromISO(s);d.setDate(d.getDate()+days);return iso(d)};
  const mon=s=>{const d=fromISO(s);d.setDate(d.getDate()-(d.getDay()+6)%7);return iso(d)};
  const monthISO=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}`;
  const dateLabel=s=>fromISO(s).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'});
  const monthLabel=m=>new Date(Number(m.slice(0,4)),Number(m.slice(5,7))-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sbClient=()=>{try{return sb}catch(e){return null}};
  const profileData=()=>{try{return profile||currentProfile||null}catch(e){return null}};
  const authUser=()=>{try{return user||currentUser||null}catch(e){return null}};
  const page=()=>document.querySelector('.rex-page[data-page="dashboard"]');
  const now=new Date();
  let month=monthISO(now),week=mon(iso(now)),loading=false,again=false,lastRun=0,lastAttempt=0,channel=null,subscribedFor='',showSellers=false,started=false,refreshTimer=null,refreshAfterInput=false,lastRenderSignature='';

  function monthRange(m){
    const first=m+'-01',date=fromISO(first),end=new Date(date.getFullYear(),date.getMonth()+1,1,12),last=new Date(end);
    last.setDate(last.getDate()-1);
    return {first,next:iso(end),begin:mon(first),last:mon(iso(last))};
  }
  function amount(r){return centsE(r.signed_amount_eur);}
  function sumBy(rows,extract){return rows.reduce((sum,x)=>sum+extract(x),0);}
  function weekly(rows,start){return rows.filter(x=>x.signature_date>=start&&x.signature_date<advance(start,7));}
  function forecastWeek(rows,start){return rows.filter(x=>x.week_start===start);}
  function summarize(actual,monthForecast,weeklyForecast){
    return {
      actual:sumBy(actual,amount),nc:sumBy(actual.filter(x=>x.client_type==='nouveau'),amount),
      predicted:sumBy(monthForecast,x=>centsK(x.amount)),
      weekPlan:sumBy(weeklyForecast,x=>centsK(x.amount)),
      signedCount:actual.length,forecastCount:monthForecast.length
    };
  }
  function updateStyle(){
    if(document.getElementById('rexLivePerformanceStyle'))return;
    const s=document.createElement('style');s.id='rexLivePerformanceStyle';
    s.textContent=`
      #${ROOT}{margin:0 0 16px;background:#fff;border:1px solid #e0e6ed;border-radius:14px;padding:18px;color:#26374c}
      #${ROOT} .lsp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:16px}
      #${ROOT} .lsp-head h3{font-size:18px;margin:0 0 4px;color:#132d4f;font-weight:800}
      #${ROOT} .lsp-desc{font-size:11px;color:#718095;line-height:1.5}
      #${ROOT} .lsp-controls{display:flex;gap:8px;align-items:end;flex-wrap:wrap}
      #${ROOT} label{display:block;margin-bottom:4px;color:#7b8898;font-weight:700;font-size:10px}
      #${ROOT} input{border:1px solid #d9e1e9;background:#fff;padding:8px;border-radius:8px;font:inherit;min-height:35px;color:#26374c}
      #${ROOT} button{border:1px solid #dbe3ec;border-radius:8px;background:#f8fafc;color:#23405f;font-size:11px;font-weight:800;padding:9px 11px;cursor:pointer}
      #${ROOT} button:hover{background:#edf3f8}
      #${ROOT} .lsp-annotation{font-size:11px;color:#64748b;line-height:1.5;margin:0 0 10px}
      #${ROOT} .lsp-month{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid #e9edf2;border-bottom:1px solid #e9edf2;margin:8px 0 17px}
      #${ROOT} .lsp-number{padding:14px 12px 13px;border-right:1px solid #edf1f5;min-width:0}
      #${ROOT} .lsp-number:last-child{border-right:0}
      #${ROOT} .lsp-number span{display:block;color:#718095;font-size:11px;font-weight:650;margin-bottom:6px}
      #${ROOT} .lsp-number b{display:block;font-size:22px;line-height:1.2;letter-spacing:-.4px;color:#17375d;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
      #${ROOT} .lsp-number b.lsp-real{color:#14744e}
      #${ROOT} .lsp-section{margin:18px 0 10px;font-size:13px;font-weight:850;color:#243d5a}
      #${ROOT} .lsp-week-flex{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;padding:12px 2px;border-top:1px solid #e9eef3;border-bottom:1px solid #e9eef3}
      #${ROOT} .lsp-week-flex span{font-size:11px;color:#79879a}
      #${ROOT} .lsp-week-flex b{font-size:20px;color:#223d5e;display:block;margin-top:5px;font-variant-numeric:tabular-nums}
      #${ROOT} .lsp-week-flex b.lsp-real{color:#14744e}
      #${ROOT} .lsp-meta{margin:8px 0 0;color:#8a95a6;font-size:10px;line-height:1.5}
      #${ROOT} .lsp-scroll{overflow:auto}
      #${ROOT} table{border-collapse:collapse;width:100%;min-width:600px;font-size:12px}
      #${ROOT} th,#${ROOT} td{padding:10px 9px;text-align:left;border-bottom:1px solid #edf0f3;font-variant-numeric:tabular-nums}
      #${ROOT} th{color:#78879a;font-weight:750;font-size:10px;background:#fbfcfe}
      #${ROOT} .lsp-strong{font-weight:850;color:#1e7554}
      #${ROOT} .lsp-current{background:#f2faf6}
      #${ROOT} .lsp-caption{font-size:10px;color:#8d99a7;margin:10px 0 0;line-height:1.5}
      #${ROOT} .lsp-warning{color:#996f2b;background:#fffaf0;padding:9px 11px;font-size:11px;border-left:2px solid #e8ba64;margin-top:10px}
      #${ROOT} .lsp-error{color:#a53637;font-size:12px;padding:11px;border-left:2px solid #cf5f5f;background:#fff8f8}
      #${ROOT} details{margin-top:15px}#${ROOT} summary{font-size:12px;color:#324b68;font-weight:800;cursor:pointer}
      @media(max-width:970px){#${ROOT} .lsp-month{grid-template-columns:repeat(2,minmax(0,1fr))}
        #${ROOT} .lsp-number:nth-child(2){border-right:0}#${ROOT} .lsp-number:nth-child(-n+2){border-bottom:1px solid #edf1f5}}
      @media(max-width:620px){#${ROOT} .lsp-week-flex{grid-template-columns:1fr}
        #${ROOT} .lsp-number b{font-size:18px}#${ROOT} input{font-size:12px}}
    `;document.head.appendChild(s);
  }
  function mount(){
    const p=page();if(!p)return null;
    updateStyle();let node=p.querySelector('#'+ROOT);
    if(!node){node=document.createElement('section');node.id=ROOT;node.innerHTML='<p>Chargement du suivi des ventes…</p>';p.appendChild(node)}
    const comparison=p.querySelector('#rexHistoryComparison'),annual=p.querySelector('#dashboardSalesKpis'),head=p.querySelector('.rex-page-head');
    const anchor=comparison||annual||head;
    if(anchor&&anchor.nextElementSibling!==node)anchor.insertAdjacentElement('afterend',node);
    return node;
  }
  // Ne pas détruire les panneaux et sélections du tableau de bord si les données sont inchangées.
  function fingerprint(data){
    const records=xs=>xs.map(x=>JSON.stringify(Object.keys(x).sort().map(k=>[k,x[k]]))).sort();
    return JSON.stringify([month,week,records(data.people),records(data.months),records(data.actuals),records(data.previsions)]);
  }
  function show(data){
    const el=mount();if(!el)return;
    const fingerprintNow=fingerprint(data);
    if(lastRenderSignature===fingerprintNow&&el.querySelector('#lspUpdated')){
      lastRun=Date.now();
      el.querySelector('#lspUpdated').textContent='Chiffres vérifiés à '+new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})+' · À jour';
      return;
    }
    const {people,months,actuals,previsions}=data;
    const range=monthRange(month),currentWeek=week,weekEnd=advance(week,4),nextWeek=advance(week,7);
    const inMonth=actuals.filter(x=>x.signature_date>=range.first&&x.signature_date<range.next);
    const current=weekly(actuals,currentWeek),thisPlan=forecastWeek(previsions,currentWeek),upcoming=forecastWeek(previsions,nextWeek);
    const monthTotals=summarize(inMonth,months,[]);
    const curTotals=summarize(current,[],thisPlan);
    const nextValue=sumBy(upcoming,x=>centsK(x.amount));
    const delta=monthTotals.predicted-monthTotals.actual;
    const weeks=[];
    for(let w=range.begin;w<=range.last;w=advance(w,7)){
      const signed=weekly(inMonth,w);
      const planned=forecastWeek(previsions,w);
      weeks.push({date:w,signed:signed.length,actual:sumBy(signed,amount),plan:sumBy(planned,x=>centsK(x.amount)),planCount:planned.length});
    }
    const sellerRows=people.map(person=>{
      const mine=inMonth.filter(x=>x.user_id===person.user_id),forecast=months.filter(x=>x.user_id===person.user_id);
      return {person,ca:sumBy(mine,amount),nc:sumBy(mine.filter(x=>x.client_type==='nouveau'),amount),prev:sumBy(forecast,x=>centsK(x.amount))};
    }).sort((a,b)=>Number(a.person.sector_id||999)-Number(b.person.sector_id||999));
    const undone=months.filter(x=>x.sale_completed&&!x.signature_date).length;
    el.innerHTML=`
      <div class="lsp-head">
        <div><h3>📈 Suivi des ventes · réalisé & prévisionnel</h3><div class="lsp-desc">${profileData()?.role==='admin'?'Agence Corrèze':'Mon activité'} · chiffres issus des ventes validées par les commerciaux</div></div>
        <div class="lsp-controls">
          <div><label for="lspMonth">Mois</label><input type="month" id="lspMonth" value="${month}"></div>
          <div><label for="lspWeek">Semaine du</label><input type="date" id="lspWeek" value="${week}"></div>
          <button type="button" id="lspRefresh">↻ Actualiser</button>
        </div>
      </div>
      <div class="lsp-section">Récapitulatif · ${escape(monthLabel(month))}</div>
      <div class="lsp-month">
        <div class="lsp-number"><span>CA réalisé</span><b class="lsp-real">${fmtEUR(monthTotals.actual)}</b></div>
        <div class="lsp-number"><span>Dont nouveaux clients (NC)</span><b>${fmtEUR(monthTotals.nc)}</b></div>
        <div class="lsp-number"><span>Prévision du mois (actualisée)</span><b>${fmtEUR(monthTotals.predicted)}</b></div>
        <div class="lsp-number"><span>Écart prévision − réalisé</span><b>${fmtEUR(delta)}</b></div>
      </div>
      <div class="lsp-section">Semaine du ${dateLabel(week)} au ${dateLabel(weekEnd)}</div>
      <div class="lsp-week-flex">
        <div><span>Prévision S+1 prévue pour cette semaine</span><b>${thisPlan.length?fmtEUR(curTotals.weekPlan):'—'}</b></div>
        <div><span>CA réellement signé</span><b class="lsp-real">${fmtEUR(curTotals.actual)}</b></div>
        <div><span>NC signé cette semaine</span><b>${fmtEUR(curTotals.nc)}</b></div>
      </div>
      <p class="lsp-meta">${current.length} vente${current.length!==1?'s':''} validée${current.length!==1?'s':''} ·
        ${thisPlan.length?'Écart semaine (prévision − réalisé) : '+fmtEUR(curTotals.weekPlan-curTotals.actual):'Aucune prévision S+1 enregistrée pour cette semaine'} ·
        Prévision S+1 suivante (du ${dateLabel(nextWeek)}) : ${upcoming.length?fmtEUR(nextValue):'non renseignée'}</p>
      <div class="lsp-section">Évolution hebdomadaire · ${escape(monthLabel(month))}</div>
      <div class="lsp-scroll"><table><thead><tr><th>Semaine du</th><th>Prévision</th><th>CA signé dans le mois</th><th>Écart</th></tr></thead><tbody>
        ${weeks.map(r=>`<tr ${r.date===week?'class="lsp-current"':''}><td>${dateLabel(r.date)}</td><td>${r.planCount?fmtEUR(r.plan):'—'}</td><td class="lsp-strong">${fmtEUR(r.actual)}</td><td>${r.planCount?fmtEUR(r.plan-r.actual):'—'}</td></tr>`).join('')}
      </tbody></table></div>
      ${profileData()?.role==='admin'?`<details id="lspSellers" ${showSellers?'open':''}><summary>Détail mensuel par commercial</summary>
        <div class="lsp-scroll"><table><thead><tr><th>Vendeur</th><th>CA réalisé</th><th>Dont NC</th><th>Prévision du mois</th></tr></thead><tbody>
          ${sellerRows.map(row=>`<tr><td>${escape(row.person.display_name||'Commercial')} · S${escape(row.person.sector_id||'—')}</td><td class="lsp-strong">${fmtEUR(row.ca)}</td><td>${fmtEUR(row.nc)}</td><td>${fmtEUR(row.prev)}</td></tr>`).join('')}
        </tbody></table></div></details>`:''}
      ${undone?`<div class="lsp-warning">${undone} vente${undone>1?'s':''} validée${undone>1?'s':''} sans date de signature : renseigner la date dans Prévisionnel mois pour qu'elle soit comptée au réalisé.</div>`:''}
      <p class="lsp-caption">La prévision mensuelle conserve toutes les affaires, même signées. Le CA réalisé utilise exclusivement les ventes cochées « Vente réalisée », leur montant exact en € et leur date. Les signatures uniquement saisies dans « Point vendredi » ne sont pas ajoutées automatiquement, afin d'éviter les doublons.</p>
      <p class="lsp-caption" id="lspUpdated" role="status">Mis à jour à ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})} · Actualisation automatique activée</p>
    `;
    el.querySelector('#lspMonth').onchange=e=>{month=e.target.value||monthISO(new Date());load()};
    el.querySelector('#lspWeek').onchange=e=>{week=mon(e.target.value||iso(new Date()));load()};
    el.querySelector('#lspRefresh').onclick=load;
    const details=el.querySelector('#lspSellers');
    if(details)details.addEventListener('toggle',()=>{showSellers=details.open});
    lastRenderSignature=fingerprintNow;
    lastRun=Date.now();
  }
  async function load(){
    const el=mount(),client=sbClient(),p=profileData(),u=authUser();
    if(!el||!client||!p||!u)return;
    if(loading){again=true;return}
    loading=true;lastAttempt=Date.now();const scopedMonth=month,scopedWeek=week;
    try{
      let people=[];
      if(p.role==='admin'){
        const q=await client.from('profiles').select('user_id,display_name,sector_id').eq('role','seller').order('sector_id');
        if(q.error)throw q.error;people=q.data||[];
      }else people=[{user_id:u.id,display_name:p.display_name||u.email,sector_id:p.sector_id}];
      const ids=people.map(x=>x.user_id);
      if(!ids.length)throw Error('Aucun commercial disponible.');
      const range=monthRange(scopedMonth);
      const min=range.begin<scopedWeek?range.begin:scopedWeek;
      const maxCandidates=[advance(range.last,7),advance(scopedWeek,14)];
      const max=maxCandidates[0]>maxCandidates[1]?maxCandidates[0]:maxCandidates[1];
      const [mr,ar,wr]=await Promise.all([
        client.from('monthly_forecasts').select('id,user_id,amount,month_start,sale_completed,signature_date,signed_amount_eur')
          .eq('month_start',range.first).in('user_id',ids),
        client.from('monthly_forecasts').select('id,user_id,company_name,client_type,sale_completed,signature_date,signed_amount_eur')
          .eq('sale_completed',true).gte('signature_date',min).lt('signature_date',max).in('user_id',ids),
        client.from('weekly_forecasts').select('id,user_id,week_start,amount,client_type')
          .gte('week_start',min).lt('week_start',max).in('user_id',ids)
      ]);
      if(mr.error)throw mr.error;if(ar.error)throw ar.error;if(wr.error)throw wr.error;
      if(month!==scopedMonth||week!==scopedWeek){again=true;return}
      show({people,months:mr.data||[],actuals:ar.data||[],previsions:wr.data||[]});
    }catch(e){
      lastRenderSignature='';
      el.innerHTML=`<div class="lsp-error">Impossible de charger le suivi commercial : ${escape(e?.message||e)}</div><button type="button" id="lspRetry">Réessayer</button>`;
      el.querySelector('#lspRetry').onclick=load;
    }finally{
      loading=false;
      if(again){again=false;load()}
    }
  }
  // Grouper les notifications Supabase et les événements locaux : une seule
  // relecture pour plusieurs changements très rapprochés.
  function queueRefresh(){
    if(!page()?.classList.contains('active'))return;
    if(document.activeElement?.closest?.('#'+ROOT+' .lsp-controls')){
      refreshAfterInput=true;
      return;
    }
    if(refreshTimer!==null)clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>{refreshTimer=null;load()},500);
  }
  function attachRealtime(){
    const client=sbClient(),p=profileData(),u=authUser();
    if(!client||!p||!u||!client.channel)return;
    const key=u.id+':'+p.role;
    if(subscribedFor===key)return;
    if(channel){try{client.removeChannel(channel)}catch(e){}}
    subscribedFor=key;
    const filter=p.role==='admin'?{}:{filter:'user_id=eq.'+u.id};
    channel=client.channel('rex-live-sales-'+u.id)
      .on('postgres_changes',{event:'*',schema:'public',table:'monthly_forecasts',...filter},()=>{queueRefresh();window.dispatchEvent(new Event('rex:commercial-data-changed'))})
      .on('postgres_changes',{event:'*',schema:'public',table:'weekly_forecasts',...filter},()=>{queueRefresh();window.dispatchEvent(new Event('rex:commercial-data-changed'))});
    channel.subscribe();
  }
  function start(){
    if(!mount()||!sbClient()||!profileData()||!authUser())return false;
    if(started)return true;
    started=true;load();attachRealtime();return true;
  }
  window.addEventListener('rex:monthly-sale-synced',queueRefresh);
  window.addEventListener('rex:weekly-forecast-synced',queueRefresh);
  document.addEventListener('click',e=>{if(e.target?.closest?.('.rex-nav button[data-page="dashboard"]'))setTimeout(queueRefresh,150)});
  document.addEventListener('focusout',e=>{
    if(e.target?.closest?.('#'+ROOT+' .lsp-controls')&&refreshAfterInput){
      refreshAfterInput=false;setTimeout(queueRefresh,150);
    }
  },true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&page()?.classList.contains('active'))load()});
  window.addEventListener('focus',queueRefresh);
  let attempts=0;const timer=setInterval(()=>{attempts++;if(start()||attempts>150)clearInterval(timer)},400);
  setInterval(()=>{if(page()?.classList.contains('active')&&lastAttempt&&Date.now()-lastAttempt>30000)queueRefresh()},5000);
  window.addEventListener('load',()=>setTimeout(start,950));
})();