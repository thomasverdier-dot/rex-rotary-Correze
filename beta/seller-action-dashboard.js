(()=>{
  let lastKey='',busy=false;
  function getSb(){try{return sb}catch(e){return null}}
  function getProfile(){try{return profile||currentProfile||null}catch(e){return null}}
  function getUser(){try{return user||currentUser||null}catch(e){return null}}
  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function dateLabel(v){if(!v)return'';return new Date(v+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'})}
  function addStyle(){
    if(document.getElementById('sellerActionDashStyle'))return;
    const s=document.createElement('style');s.id='sellerActionDashStyle';s.textContent=`
      .sad-card{margin:0 0 16px;background:#fff7ed;border:1px solid #fdba74;border-left:5px solid #ea580c;border-radius:16px;padding:16px 18px;box-shadow:0 10px 28px rgba(15,23,42,.06)}
      .sad-kicker{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:#c2410c;margin-bottom:5px}.sad-title{font-size:18px;font-weight:900;color:#7c2d12;margin-bottom:7px}.sad-action{font-size:15px;line-height:1.5;color:#431407;font-weight:700;white-space:pre-wrap}.sad-meta{margin-top:9px;font-size:10px;color:#9a3412}.sad-empty{background:#fff;border-color:#e2e8f0;border-left-color:#94a3b8}.sad-empty .sad-kicker,.sad-empty .sad-title,.sad-empty .sad-action,.sad-empty .sad-meta{color:#64748b}
      @media(max-width:700px){.sad-card{padding:14px}.sad-title{font-size:16px}.sad-action{font-size:14px}}
    `;document.head.appendChild(s)
  }
  function mount(){
    const page=document.querySelector('.rex-page[data-page="dashboard"]');if(!page)return null;
    addStyle();let box=document.getElementById('sellerActionDashboard');
    if(!box){box=document.createElement('div');box.id='sellerActionDashboard';const head=page.querySelector('.rex-page-head');if(head)head.insertAdjacentElement('afterend',box);else page.prepend(box)}
    return box
  }
  async function load(){
    if(busy)return;const p=getProfile(),u=getUser(),client=getSb();if(!p||!u||!client)return;
    const box=mount();if(!box)return;
    if(p.role==='admin'){box.style.display='none';return}
    box.style.display='block';busy=true;
    try{
      const r=await client.from('friday_activity').select('week_start,agreed_actions').eq('user_id',u.id).not('agreed_actions','is',null).order('week_start',{ascending:false}).limit(1);
      if(r.error){box.className='sad-card sad-empty';box.innerHTML='<div class="sad-kicker">Action à mener</div><div class="sad-action">Impossible de charger l’action pour le moment.</div>';return}
      const row=(r.data||[]).find(x=>(x.agreed_actions||'').trim());
      const key=row?(row.week_start+'|'+row.agreed_actions):'empty';if(key===lastKey)return;lastKey=key;
      if(!row){box.className='sad-card sad-empty';box.innerHTML='<div class="sad-kicker">Action à mener cette semaine</div><div class="sad-action">Aucune action particulière enregistrée lors du dernier point du vendredi.</div>';return}
      box.className='sad-card';box.innerHTML=`<div class="sad-kicker">🎯 Action à mener cette semaine</div><div class="sad-title">Priorité issue du dernier point du vendredi</div><div class="sad-action">${esc(row.agreed_actions)}</div><div class="sad-meta">Action décidée lors du point du ${dateLabel(row.week_start)}</div>`;
    }finally{busy=false}
  }
  function tick(){mount();load()}
  let tries=0;const fast=setInterval(()=>{tries++;tick();if((document.getElementById('sellerActionDashboard')&&getProfile()&&getUser())||tries>120)clearInterval(fast)},500);
  setInterval(load,30000);window.addEventListener('load',()=>setTimeout(tick,1200));
})();