(()=>{
  const euro=n=>new Intl.NumberFormat('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:1}).format(Number(n||0))+' k€';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const monday=d=>{const x=new Date(d);x.setHours(0,0,0,0);const day=x.getDay()||7;x.setDate(x.getDate()-day+1);return x.toISOString().slice(0,10)};
  let weekStart=monday(new Date()), sellers=[], deals=[];

  function getProfile(){try{return profile||currentProfile||null}catch(e){return null}}
  function getUser(){try{return user||currentUser||null}catch(e){return null}}
  function getSb(){try{return sb}catch(e){return null}}

  function mount(){
    if(document.getElementById('forecastNav')) return;
    const app=document.querySelector('.app'); if(!app) return;
    const style=document.createElement('style');
    style.textContent=`
      #forecastNav{position:sticky;top:0;z-index:7000;background:#0e2f68;color:white;padding:10px 16px;display:flex;gap:8px;align-items:center;box-shadow:0 2px 12px rgba(0,0,0,.14)}
      #forecastNav button{background:#fff;color:#17355f;border:0;padding:9px 14px;border-radius:9px;font-weight:800;cursor:pointer}#forecastNav button.active{background:#58a9ff;color:#10233f}
      #weeklyForecast{display:none;padding:18px;background:#edf2f7;min-height:calc(100vh - 56px)}#weeklyForecast.open{display:block}.wf-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:14px}.wf-head h1{margin:0;color:#0e2f68}.wf-week{display:flex;gap:8px;align-items:center}.wf-week input{padding:8px;border:1px solid #ccd5df;border-radius:8px}
      .wf-agency{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:10px;margin-bottom:14px}.wf-kpi{background:#fff;border:1px solid #d9e2ec;border-radius:12px;padding:12px}.wf-kpi span{display:block;font-size:11px;color:#667085}.wf-kpi strong{font-size:23px;color:#17355f}
      .wf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.wf-card{background:#fff;border:1px solid #d9e2ec;border-radius:14px;padding:13px;overflow:hidden}.wf-title{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px}.wf-title h2{font-size:16px;margin:0;color:#17355f}.wf-table-wrap{overflow:auto}.wf-table{width:100%;border-collapse:collapse;font-size:11px;min-width:760px}.wf-table th,.wf-table td{border-bottom:1px solid #edf1f5;padding:7px;text-align:left;vertical-align:middle}.wf-table th{color:#415066;background:#f8fafc}.wf-prob{font-weight:800}.wf-rdv{font-size:16px}.wf-del{border:0;background:#fff;color:#b42318;padding:4px 7px}.wf-form{display:grid;grid-template-columns:2fr 1fr 1.2fr 1.2fr 1fr 1fr auto;gap:6px;margin-top:10px}.wf-form input,.wf-form select{width:100%;padding:8px;border:1px solid #ccd5df;border-radius:8px}.wf-form .wf-check{display:flex;align-items:center;justify-content:center;border:1px solid #ccd5df;border-radius:8px;background:#fff}.wf-form button{background:#0f6b47;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:800}.wf-totals{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;font-size:11px}.wf-pill{background:#f4f7fb;border:1px solid #d7e0eb;border-radius:999px;padding:6px 9px}.wf-empty{padding:16px;color:#667085;text-align:center}
      @media(max-width:1100px){.wf-grid{grid-template-columns:1fr}.wf-agency{grid-template-columns:repeat(2,1fr)}}`;
    document.head.appendChild(style);
    const nav=document.createElement('div');nav.id='forecastNav';nav.innerHTML='<button id="navSectors" class="active">🗺️ Secteurs</button><button id="navWeekly">📅 Prévisions semaine</button>';
    document.body.insertBefore(nav,app);
    const sec=document.createElement('section');sec.id='weeklyForecast';sec.innerHTML=`<div class="wf-head"><div><h1>Prévisions semaine</h1><div style="font-size:12px;color:#667085">Affaires prévues à la signature — CL / NC / Up-Cross / probabilité / RDV négociation</div></div><div class="wf-week"><label>Semaine du</label><input id="wfWeek" type="date" value="${weekStart}"></div></div><div id="wfAgency" class="wf-agency"></div><div id="wfCards" class="wf-grid"></div>`;
    app.insertAdjacentElement('afterend',sec);
    navSectors.onclick=()=>switchView('sectors');navWeekly.onclick=()=>switchView('weekly');wfWeek.onchange=()=>{weekStart=monday(wfWeek.value);wfWeek.value=weekStart;load()};
  }

  function switchView(v){const app=document.querySelector('.app');const wf=document.getElementById('weeklyForecast');if(v==='weekly'){app.style.display='none';wf.classList.add('open');navWeekly.classList.add('active');navSectors.classList.remove('active');load()}else{app.style.display='grid';wf.classList.remove('open');navSectors.classList.add('active');navWeekly.classList.remove('active')}}

  async function load(){
    const client=getSb(),p=getProfile(),u=getUser();if(!client||!p||!u)return;
    if(p.role==='admin'){
      const q=await client.from('profiles').select('user_id,display_name,role,sector_id').eq('role','seller').order('sector_id');
      sellers=q.data||[];
    }else sellers=[{user_id:u.id,display_name:p.display_name||u.email,role:'seller',sector_id:p.sector_id}];
    const q=await client.from('weekly_forecasts').select('*').eq('week_start',weekStart).order('created_at');
    deals=q.data||[];render();
  }

  function sums(list){let cl=0,nc=0,upcross=0,total=0;list.forEach(d=>{const a=Number(d.amount||0);total+=a;if(d.client_type==='acquis')cl+=a;else nc+=a;if(d.sale_type==='up_sell'||d.sale_type==='cross_sell')upcross+=a});return{cl,nc,upcross,total}}
  function render(){
    const all=sums(deals);wfAgency.innerHTML=`<div class="wf-kpi"><span>Prévision CL agence</span><strong>${euro(all.cl)}</strong></div><div class="wf-kpi"><span>Prévision NC agence</span><strong>${euro(all.nc)}</strong></div><div class="wf-kpi"><span>Up / Cross agence</span><strong>${euro(all.upcross)}</strong></div><div class="wf-kpi"><span>Prévision totale agence</span><strong>${euro(all.total)}</strong></div>`;
    wfCards.innerHTML=sellers.length?sellers.map(s=>card(s)).join(''):'<div class="wf-empty">Aucun vendeur attribué pour le moment.</div>';
    document.querySelectorAll('.wf-add').forEach(b=>b.onclick=()=>addDeal(b.dataset.uid));document.querySelectorAll('.wf-del').forEach(b=>b.onclick=()=>delDeal(b.dataset.id));
  }
  function card(s){const list=deals.filter(d=>d.user_id===s.user_id),t=sums(list),id='f'+s.user_id.replaceAll('-','');return `<div class="wf-card"><div class="wf-title"><h2>${esc(s.display_name||'Vendeur')}</h2><span>Secteur ${esc(s.sector_id||'—')}</span></div><div class="wf-table-wrap"><table class="wf-table"><thead><tr><th>Entreprise</th><th>Montant</th><th>Client</th><th>Vente</th><th>Chance</th><th>RDV négo</th><th></th></tr></thead><tbody>${list.length?list.map(d=>`<tr><td><b>${esc(d.company_name)}</b></td><td>${euro(d.amount)}</td><td>${d.client_type==='nouveau'?'NC':'CL'}</td><td>${d.sale_type==='up_sell'?'Up-sell':d.sale_type==='cross_sell'?'Cross-sell':'Classique'}</td><td class="wf-prob">${d.probability}%</td><td class="wf-rdv">${d.negotiation_meeting_scheduled?'✅':'—'}</td><td><button class="wf-del" data-id="${d.id}">✕</button></td></tr>`).join(''):'<tr><td colspan="7" class="wf-empty">Aucune affaire prévue.</td></tr>'}</tbody></table></div><div class="wf-form" id="${id}"><input class="company" placeholder="Entreprise"><input class="amount" type="number" min="0" step="0.1" placeholder="Montant k€"><select class="client"><option value="acquis">Client acquis</option><option value="nouveau">Nouveau client</option></select><select class="sale"><option value="classique">Classique</option><option value="up_sell">Up-sell</option><option value="cross_sell">Cross-sell</option></select><input class="prob" type="number" min="0" max="100" value="50" title="Probabilité %"><label class="wf-check" title="RDV négociation calé"><input class="rdv" type="checkbox"> RDV</label><button class="wf-add" data-uid="${s.user_id}">Ajouter</button></div><div class="wf-totals"><span class="wf-pill">CL : <b>${euro(t.cl)}</b></span><span class="wf-pill">NC : <b>${euro(t.nc)}</b></span><span class="wf-pill">Up/Cross : <b>${euro(t.upcross)}</b></span><span class="wf-pill">Total : <b>${euro(t.total)}</b></span></div></div>`}

  async function addDeal(uid){const client=getSb(),box=document.getElementById('f'+uid.replaceAll('-',''));if(!client||!box)return;const company=box.querySelector('.company').value.trim(),amount=Number(box.querySelector('.amount').value),prob=Number(box.querySelector('.prob').value);if(!company||!Number.isFinite(amount)||amount<=0||prob<0||prob>100){alert('Renseigne l’entreprise, un montant supérieur à 0 et une probabilité entre 0 et 100 %.');return}const row={user_id:uid,week_start:weekStart,company_name:company,amount,client_type:box.querySelector('.client').value,sale_type:box.querySelector('.sale').value,probability:prob,negotiation_meeting_scheduled:box.querySelector('.rdv').checked};const r=await client.from('weekly_forecasts').insert(row);if(r.error){alert(r.error.message);return}await load()}
  async function delDeal(id){if(!confirm('Supprimer cette affaire de la prévision ?'))return;const r=await getSb().from('weekly_forecasts').delete().eq('id',id);if(r.error){alert(r.error.message);return}await load()}

  window.loadWeeklyForecast=load;
  let tries=0;const timer=setInterval(()=>{tries++;mount();if(document.getElementById('forecastNav')||tries>80)clearInterval(timer)},250);window.addEventListener('load',mount);
})();