(()=>{
  const ROOT='rexFridayCrmReport';
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const numeric=x=>{const n=Number(x);return Number.isFinite(n)?n:0};
  const centsEUR=x=>Math.round(numeric(x)*100);
  const centsK=x=>Math.round(numeric(x)*100000);
  const signedCents=x=>x.signed_amount_eur==null?centsK(x.amount):centsEUR(x.signed_amount_eur);
  const euro=x=>new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(x/100)+' €';
  const plain=x=>new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:false}).format(x/100);
  const dateText=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const parse=s=>{const [y,m,d]=String(s||'').split('-').map(Number);return new Date(y,m-1,d,12)};
  const shift=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return dateText(d)};
  const monday=v=>{const d=v instanceof Date?new Date(v.getFullYear(),v.getMonth(),v.getDate(),12):parse(v);d.setDate(d.getDate()-(d.getDay()+6)%7);return dateText(d)};
  const french=s=>parse(s).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});
  const supa=()=>{try{return sb}catch(e){return null}};
  const pf=()=>{try{return profile||currentProfile}catch(e){return null}};
  const auth=()=>{try{return user||currentUser}catch(e){return null}};
  const home=()=>document.querySelector('.rex-page[data-page="dashboard"]');
  let mondaySelected=monday(new Date()),busy=false,pending=false,lastLoad=0;
  const totals=(sales,forecast)=>({
    ca:sales.reduce((v,x)=>v+signedCents(x),0),
    nc:sales.reduce((v,x)=>v+(x.client_type==='nouveau'?signedCents(x):0),0),
    next:forecast.reduce((v,x)=>v+centsK(x.amount),0)
  });
  const tokens=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[^a-z0-9]/g,' ').split(/\s+/).filter(x=>x.length>=5&&!['mairie','societe','commune'].includes(x))
    .map(x=>x.endsWith('s')?x.slice(0,-1):x);
  function duplicateHints(sales){
    const flags=[];
    for(let i=0;i<sales.length;i++)for(let j=i+1;j<sales.length;j++){
      const a=sales[i],b=sales[j];
      if(a.user_id!==b.user_id||a.source_kind===b.source_kind||signedCents(a)!==signedCents(b))continue;
      const aa=tokens(a.company_name),bb=tokens(b.company_name);
      if(aa.some(x=>bb.includes(x)))flags.push(a.company_name+' / '+b.company_name);
    }
    return flags;
  }
  function style(){
    if(document.getElementById('fwrStyle'))return;
    const s=document.createElement('style');s.id='fwrStyle';s.textContent=`
      #${ROOT}{background:#fff;border:1px solid #dbe4ee;box-shadow:0 9px 28px rgba(15,23,42,.06);border-radius:17px;margin:0 0 16px;padding:17px;color:#1e293b}
      #${ROOT} .fwr-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}
      #${ROOT} h3{margin:0 0 4px;font-size:18px;color:#10233f}#${ROOT} .fwr-sub{font-size:11px;color:#64748b}
      #${ROOT} .fwr-controls{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
      #${ROOT} button{cursor:pointer;border:1px solid #cbd5e1;border-radius:9px;background:#fff;padding:8px 11px;font-size:11px;font-weight:800;color:#213653}
      #${ROOT} button.fwr-main{background:#102f68;color:#fff;border-color:#102f68}#${ROOT} button:disabled{opacity:.6}
      #${ROOT} input[type=date]{padding:7px 8px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#1e293b}
      #${ROOT} .fwr-period{background:#f3f6fa;padding:10px;border-radius:9px;font-size:12px;color:#475569;line-height:1.65;margin-bottom:12px}
      #${ROOT} .fwr-three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}
      #${ROOT} .fwr-card{background:#f8fafc;border:1px solid #dbe4ee;border-radius:13px;padding:14px;min-width:0}
      #${ROOT} .fwr-label{font-size:12px;font-weight:900;color:#334155}
      #${ROOT} .fwr-amount{font-size:26px;font-weight:900;color:#102f68;line-height:1.2;margin:9px 0;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
      #${ROOT} .fwr-note{font-size:11px;color:#64748b;margin-bottom:11px}
      #${ROOT} .fwr-foot{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:14px}
      #${ROOT} .fwr-status{font-size:11px;color:#64748b}
      #${ROOT} .fwr-warn{margin-top:12px;padding:10px;border:1px solid #fcd34d;border-radius:9px;background:#fffbeb;color:#92400e;font-size:11px}
      #${ROOT} .fwr-error{font-size:12px;color:#b42318;padding:10px;background:#fff1f2;border-radius:10px}
      #${ROOT} details{margin-top:15px;padding-top:12px;border-top:1px solid #e2e8f0}#${ROOT} summary{font-size:12px;font-weight:800;cursor:pointer}
      #${ROOT} .fwr-scroll{overflow-x:auto}#${ROOT} table{border-collapse:collapse;width:100%;min-width:490px;margin-top:10px;font-size:12px}
      #${ROOT} th,#${ROOT} td{text-align:left;border-bottom:1px solid #e2e8f0;padding:10px 8px}#${ROOT} th{color:#64748b;font-size:11px}
      @media(max-width:960px){#${ROOT} .fwr-three{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }
  function mount(){
    const p=home();if(!p)return null;
    style();let el=p.querySelector('#'+ROOT);
    if(!el){el=document.createElement('section');el.id=ROOT;el.innerHTML='<h3>Chiffres du vendredi</h3><p>Chargement…</p>';p.prepend(el)}
    const live=p.querySelector('#rexLiveSalesPerformance'),annual=p.querySelector('#dashboardSalesKpis'),head=p.querySelector('.rex-page-head');
    if(live&&live.nextElementSibling!==el)live.insertAdjacentElement('afterend',el);
    else if(!live&&annual&&annual.nextElementSibling!==el)annual.insertAdjacentElement('afterend',el);
    else if(!live&&!annual&&head&&head.nextElementSibling!==el)head.insertAdjacentElement('afterend',el);
    return el;
  }
  function card(label,value,note,key){
    return `<div class="fwr-card"><div class="fwr-label">${label}</div><div class="fwr-amount">${euro(value)}</div><div class="fwr-note">${note}</div><button type="button" data-fwr-copy="${key}">Copier ce chiffre</button></div>`;
  }
  function display(sales,forecast,people){
    const el=mount();if(!el)return;
    const isManager=pf()?.role==='admin';
    const sums=totals(sales,forecast),end=shift(mondaySelected,4),next=shift(mondaySelected,7),nextEnd=shift(mondaySelected,11);
    const detail=people.map(p=>{
      const a=sales.filter(x=>x.user_id===p.user_id),b=forecast.filter(x=>x.user_id===p.user_id);
      return {name:p.display_name||'Commercial',sector:p.sector_id,totals:totals(a,b)};
    });
    const suspects=[]; // Montants certifiés via les seules ventes mensuelles validées.
    el.innerHTML=`
      <div class="fwr-head"><div><h3>📋 Chiffres du vendredi — à reporter dans le CRM professionnel</h3>
        <div class="fwr-sub">${isManager?'Agence Corrèze':'Mon activité'} · calculs depuis les ventes validées (sans doublons) et le prévisionnel S+1</div></div>
        <div class="fwr-controls">
          <button type="button" data-fwr-week="-7">←</button>
          <label for="fwrDate" class="fwr-sub">Semaine du</label>
          <input id="fwrDate" type="date" value="${mondaySelected}">
          <button type="button" data-fwr-week="7">→</button>
          <button type="button" id="fwrRefresh">Actualiser</button>
        </div></div>
      <div class="fwr-period"><b>Semaine actuelle :</b> du lundi ${french(mondaySelected)} au vendredi ${french(end)}
        · <b>S+1 :</b> du lundi ${french(next)} au vendredi ${french(nextEnd)}</div>
      <div class="fwr-three">
        ${card('CA total réalisé — semaine actuelle',sums.ca,`${sales.length} signature${sales.length>1?'s':''} enregistrée${sales.length>1?'s':''} · CL + NC`,'ca')}
        ${card('Dont NC réalisé — semaine actuelle',sums.nc,'Déjà compris dans le CA total','nc')}
        ${card('Prévision S+1 — total',sums.next,`${forecast.length} affaire${forecast.length>1?'s':''} · CL + NC`,'next')}
      </div>
      <div class="fwr-foot"><button type="button" class="fwr-main" data-fwr-copy="all">Copier les trois chiffres</button>
        <span class="fwr-status" id="fwrStatus">Actualisé à ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})} · Montants en euros</span></div>
      ${suspects.length?`<div class="fwr-warn">⚠️ Signatures potentiellement en double à contrôler : ${esc(suspects.join(' ; '))}. Aucun montant n'a été retiré automatiquement.</div>`:''}
      ${isManager?`<details><summary>Détail par commercial</summary><div class="fwr-scroll"><table><thead><tr><th>Vendeur</th><th>CA réalisé</th><th>NC réalisé</th><th>Prévision S+1</th></tr></thead><tbody>${detail.map(p=>`<tr><td>${esc(p.name)}${p.sector?' — S'+esc(p.sector):''}</td><td>${euro(p.totals.ca)}</td><td>${euro(p.totals.nc)}</td><td>${euro(p.totals.next)}</td></tr>`).join('')}</tbody></table></div></details>`:''}`;
    el.querySelector('#fwrDate').onchange=e=>{mondaySelected=monday(e.target.value||new Date());load()};
    el.querySelectorAll('[data-fwr-week]').forEach(b=>b.onclick=()=>{mondaySelected=shift(mondaySelected,Number(b.dataset.fwrWeek));load()});
    el.querySelector('#fwrRefresh').onclick=()=>load();
    const clipboard={
      ca:plain(sums.ca),nc:plain(sums.nc),next:plain(sums.next),
      all:`Semaine du ${french(mondaySelected)} au ${french(end)}
CA total réalisé : ${plain(sums.ca)} €
Dont NC réalisé : ${plain(sums.nc)} €
Prévision S+1 (${french(next)} au ${french(nextEnd)}) : ${plain(sums.next)} €`
    };
    el.querySelectorAll('[data-fwr-copy]').forEach(b=>b.onclick=()=>copy(clipboard[b.dataset.fwrCopy]));
    lastLoad=Date.now();
  }
  async function copy(text){
    const msg=document.getElementById('fwrStatus');
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
      else{
        const a=document.createElement('textarea');a.value=text;a.style.position='fixed';a.style.opacity='0';
        document.body.appendChild(a);a.select();const ok=document.execCommand('copy');a.remove();if(!ok)throw Error('Copie non autorisée');
      }
      if(msg)msg.textContent='✓ Copié, prêt à coller dans ton CRM professionnel.';
    }catch(e){if(msg)msg.textContent='Copie impossible : '+(e.message||e)}
  }
  async function load(){
    const el=mount(),client=supa(),p=pf(),u=auth();
    if(!el||!client||!p||!u)return;
    if(busy){pending=true;return}
    busy=true;const selected=mondaySelected;
    try{
      let people=[];
      if(p.role==='admin'){
        const q=await client.from('profiles').select('user_id,display_name,sector_id').eq('role','seller').order('sector_id');
        if(q.error)throw q.error;people=q.data||[];
      }else people=[{user_id:u.id,display_name:p.display_name||u.email||'Commercial',sector_id:p.sector_id}];
      if(!people.length){el.innerHTML='<div class="fwr-error">Aucun vendeur trouvé.</div>';return}
      const users=people.map(x=>x.user_id);
      const [sr,fr]=await Promise.all([
        client.from('monthly_forecasts').select('id,user_id,company_name,client_type,amount,signed_amount_eur,signature_date')
          .eq('sale_completed',true).gte('signature_date',selected).lt('signature_date',shift(selected,7)).in('user_id',users),
        client.from('weekly_forecasts').select('id,user_id,company_name,client_type,amount')
          .eq('week_start',shift(selected,7)).in('user_id',users)
      ]);
      if(sr.error)throw sr.error;if(fr.error)throw fr.error;
      if(selected!==mondaySelected){pending=true;return}
      display(sr.data||[],fr.data||[],people);
    }catch(e){
      el.innerHTML=`<div class="fwr-error">Impossible de charger les trois chiffres : ${esc(e?.message||e)}</div><button id="fwrRetry">Réessayer</button>`;
      el.querySelector('#fwrRetry').onclick=()=>load();
    }finally{
      busy=false;
      if(pending){pending=false;load()}
    }
  }
  function boot(){if(mount()&&supa()&&pf()&&auth()){load();return true}return false}
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.rex-nav button[data-page="dashboard"]'))setTimeout(()=>load(),160);
  });
  window.addEventListener('rex:monthly-sale-synced',()=>{if(home()?.classList.contains('active'))setTimeout(load,200)});
  window.addEventListener('rex:weekly-forecast-synced',()=>{if(home()?.classList.contains('active'))setTimeout(load,200)});
  window.addEventListener('rex:commercial-data-changed',()=>{if(home()?.classList.contains('active'))setTimeout(load,200)});
  let n=0;const t=setInterval(()=>{n++;if(boot()||n>160)clearInterval(t)},400);
  setInterval(()=>{if(home()?.classList.contains('active')&&lastLoad&&Date.now()-lastLoad>60000)load()},10000);
  window.addEventListener('load',()=>setTimeout(boot,900));
})();