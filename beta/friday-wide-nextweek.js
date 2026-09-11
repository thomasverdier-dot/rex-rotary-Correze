(()=>{
  let busy=false,lastSig='',sellers=[],rows=[];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const euro=n=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(Number(n||0))+' k€';
  function getSb(){try{return sb}catch(e){return null}}
  function getProfile(){try{return profile||currentProfile||null}catch(e){return null}}
  function getUser(){try{return user||currentUser||null}catch(e){return null}}
  function addDays(iso,n){if(!iso)return'';const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
  function frDate(iso){if(!iso)return'';return new Date(iso+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'})}
  function addStyle(){
    if(document.getElementById('fridayWideNextStyle'))return;
    const s=document.createElement('style');s.id='fridayWideNextStyle';s.textContent=`
      #rexFridayPage{width:100%;max-width:none!important}
      #rexFridayPage #fpCards.fp-grid{grid-template-columns:1fr!important;width:100%;max-width:none!important}
      #rexFridayPage .fp-seller{width:100%;max-width:none!important}
      #rexFridayPage .fp-body{padding:18px 20px!important}
      #rexFridayPage .fp-metrics{grid-template-columns:repeat(5,minmax(0,1fr))!important}
      #rexFridayPage .fp-form-grid{grid-template-columns:repeat(6,minmax(120px,1fr))!important}
      #rexFridayPage .fp-forecast{display:none!important}
      .fp-nextweek{margin-top:14px;border-top:1px solid #e5eaf0;padding-top:14px}
      .fp-nextweek-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:10px}
      .fp-nextweek h4{margin:0;color:#10233f;font-size:15px}.fp-nextweek-date{font-size:10px;color:#64748b;font-weight:800}
      .fp-nextweek-kpis{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.fp-nextweek-pill{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:999px;padding:6px 10px;font-size:10px;color:#334155}.fp-nextweek-pill b{color:#10233f}
      .fp-nextweek-table{width:100%;border-collapse:collapse;font-size:11px}.fp-nextweek-table th,.fp-nextweek-table td{padding:9px 8px;border-bottom:1px solid #edf1f5;text-align:left}.fp-nextweek-table th{color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:.03em}.fp-nextweek-empty{padding:16px;border:1px dashed #cbd5e1;border-radius:12px;color:#64748b;font-size:11px;background:#f8fafc}
      @media(max-width:1100px){#rexFridayPage .fp-metrics{grid-template-columns:repeat(3,1fr)!important}#rexFridayPage .fp-form-grid{grid-template-columns:repeat(3,1fr)!important}}
      @media(max-width:700px){#rexFridayPage .fp-metrics,#rexFridayPage .fp-form-grid{grid-template-columns:1fr 1fr!important}.fp-nextweek-table{font-size:10px}}
    `;document.head.appendChild(s);
  }
  async function load(){
    const client=getSb(),p=getProfile(),u=getUser(),week=document.getElementById('fpWeek')?.value||'';if(!client||!p||!u||!week)return;
    const next=addDays(week,7);
    if(p.role==='admin'){
      const q=await client.from('profiles').select('user_id,display_name,sector_id').eq('role','seller').order('sector_id');sellers=q.data||[];
    }else sellers=[{user_id:u.id,display_name:p.display_name||u.email,sector_id:p.sector_id}];
    const ids=sellers.map(x=>x.user_id);if(!ids.length){rows=[];render(next);return}
    const q=await client.from('weekly_forecasts').select('user_id,week_start,company_name,amount,client_type,sale_type,probability,negotiation_meeting_scheduled,created_at').eq('week_start',next).in('user_id',ids).order('created_at');
    rows=q.data||[];render(next);
  }
  function render(next){
    addStyle();
    const cards=[...document.querySelectorAll('#fpCards .fp-seller')];if(!cards.length)return;
    cards.forEach((card,i)=>{
      const s=sellers[i];if(!s)return;
      card.querySelector('.fp-nextweek')?.remove();
      const list=rows.filter(r=>r.user_id===s.user_id);let cl=0,nc=0,total=0;
      list.forEach(r=>{const a=Number(r.amount||0);total+=a;if(r.client_type==='nouveau')nc+=a;else cl+=a});
      const html=`<div class="fp-nextweek"><div class="fp-nextweek-head"><div><h4>📅 Prévisionnel semaine prochaine</h4><div class="fp-nextweek-date">Semaine du ${frDate(next)}</div></div></div><div class="fp-nextweek-kpis"><span class="fp-nextweek-pill">CL <b>${euro(cl)}</b></span><span class="fp-nextweek-pill">NC <b>${euro(nc)}</b></span><span class="fp-nextweek-pill">Total <b>${euro(total)}</b></span><span class="fp-nextweek-pill"><b>${list.length}</b> affaire${list.length>1?'s':''}</span></div>${list.length?`<table class="fp-nextweek-table"><thead><tr><th>Entreprise</th><th>Montant</th><th>Client</th><th>Vente</th><th>Chance</th><th>RDV négo</th></tr></thead><tbody>${list.map(r=>`<tr><td><b>${esc(r.company_name||'—')}</b></td><td>${euro(r.amount)}</td><td>${r.client_type==='nouveau'?'NC':'CL'}</td><td>${esc(r.sale_type||'Classique')}</td><td>${Number(r.probability||0)}%</td><td>${r.negotiation_meeting_scheduled?'✅ Oui':'—'}</td></tr>`).join('')}</tbody></table>`:`<div class="fp-nextweek-empty">Aucune affaire renseignée pour la semaine prochaine.</div>`}</div>`;
      const anchor=card.querySelector('.fp-form')||card.querySelector('[data-fpc]')||card.querySelector('[data-fpa]')||card.querySelector('.fp-analysis');
      if(anchor)anchor.insertAdjacentHTML('afterend',html);else card.querySelector('.fp-body')?.insertAdjacentHTML('beforeend',html);
    });
  }
  async function tick(){
    const page=document.getElementById('rexFridayPage');if(!page)return;
    const week=document.getElementById('fpWeek')?.value||'',cards=document.querySelectorAll('#fpCards .fp-seller').length,role=getProfile()?.role||'',sig=week+'|'+cards+'|'+role;
    if(!busy&&(sig!==lastSig||!document.querySelector('.fp-nextweek'))){
      busy=true;try{await load();lastSig=sig}finally{busy=false}
    }
  }
  setInterval(tick,1000);window.addEventListener('load',()=>setTimeout(tick,1800));
})();