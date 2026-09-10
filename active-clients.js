(()=>{
  const ACTIVE_CLIENTS={
    '19100':75,'19360':16,'19600':7,'19120':3,'19130':3,'19140':26,'19190':4,'19210':6,'19230':12,'19240':9,
    '19270':11,'19310':0,'19350':1,'19410':4,'19500':7,'19520':0,'19000':31,'19150':2,'19220':5,'19320':4,
    '19330':6,'19380':1,'19390':1,'19400':6,'19430':0,'19450':0,'19460':4,'19470':2,'19490':0,'19550':1,
    '19560':0,'19700':9,'19800':7,'19370':8,'19160':11,'19170':7,'19200':20,'19250':4,'19260':9,'19290':4,
    '19300':21,'19340':4,'19510':6,'19110':6
  };
  const SECTOR_COLORS={1:'#58a9ff',2:'#67c26f',3:'#f6a04d',4:'#b06adf'};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let lastSignature='';

  function getProfile(){try{return profile}catch(e){return null}}
  function getAssign(){try{return assign||{}}catch(e){return {}}}
  function getSectorData(){try{return sectorData||{}}catch(e){return {}}}

  function addStyle(){
    if(document.getElementById('activeClientsStyle'))return;
    const s=document.createElement('style');s.id='activeClientsStyle';s.textContent=`
      .ac-headline{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px}
      .ac-headline h2{margin:0;font-size:24px;color:#0f172a}.ac-headline p{margin:5px 0 0;font-size:12px;color:#64748b}
      .ac-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}.ac-card{background:#fff;border:1px solid #e2e8f0;border-radius:17px;padding:15px;box-shadow:0 12px 28px rgba(15,23,42,.05);border-top:5px solid var(--ac-color)}
      .ac-card small{display:block;color:#64748b;font-size:10px}.ac-card strong{display:block;font-size:28px;color:#0f172a;margin:3px 0}.ac-card b{font-size:12px;color:#334155}.ac-card .ac-sub{font-size:10px;color:#64748b;margin-top:5px}
      .ac-total{background:#0f172a;color:white;border-radius:17px;padding:16px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;gap:10px;box-shadow:0 12px 28px rgba(15,23,42,.14)}.ac-total strong{font-size:30px}.ac-total span{font-size:11px;color:#cbd5e1}
      .ac-table-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:16px;box-shadow:0 12px 28px rgba(15,23,42,.05)}.ac-toolbar{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap}.ac-toolbar input{padding:9px 11px;border:1px solid #cbd5e1;border-radius:9px;min-width:230px}.ac-wrap{overflow:auto}.ac-table{width:100%;border-collapse:collapse;font-size:12px}.ac-table th,.ac-table td{padding:10px;border-bottom:1px solid #edf2f7;text-align:left}.ac-table th{background:#f8fafc;color:#475569}.ac-badge{display:inline-block;color:#fff;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:900}.ac-num{font-weight:900;font-size:15px}.ac-muted{color:#94a3b8}.ac-empty{text-align:center;padding:26px!important;color:#64748b}.ac-note{margin-top:10px;font-size:10px;color:#64748b;line-height:1.45}
      @media(max-width:1000px){.ac-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.ac-grid{grid-template-columns:1fr}.ac-total{align-items:flex-start;flex-direction:column}}
    `;document.head.appendChild(s);
  }

  function switchTo(){
    document.querySelectorAll('.rex-page').forEach(p=>p.classList.toggle('active',p.dataset.page==='activeclients'));
    document.querySelectorAll('.rex-nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='activeclients'));
    render(true);
  }

  function mount(){
    const shell=document.getElementById('rexShellV3'),nav=shell?.querySelector('.rex-nav'),content=shell?.querySelector('.rex-content');
    if(!shell||!nav||!content)return false;
    if(document.getElementById('rexActiveClientsPage'))return true;
    addStyle();
    const btn=document.createElement('button');btn.dataset.page='activeclients';btn.innerHTML='👥 Clients actifs';btn.onclick=switchTo;
    const prospection=nav.querySelector('[data-page="prospection"]');
    if(prospection)nav.insertBefore(btn,prospection);else nav.appendChild(btn);
    const page=document.createElement('section');page.className='rex-page';page.dataset.page='activeclients';page.id='rexActiveClientsPage';page.innerHTML=`
      <div class="ac-headline"><div><h2>Clients actifs</h2><p>Photographie figée du parc clients par code postal. Les totaux suivent automatiquement l'affectation commerciale des codes postaux.</p></div></div>
      <div id="acSummary"></div>
      <div class="ac-table-card">
        <div class="ac-toolbar"><div><b>Détail par code postal</b><div style="font-size:10px;color:#64748b">Un code postal change de secteur dès que tu modifies son affectation.</div></div><input id="acSearch" placeholder="Rechercher un code postal"></div>
        <div class="ac-wrap"><table class="ac-table"><thead><tr><th>Code postal</th><th>Secteur</th><th>Vendeur</th><th>Clients actifs</th></tr></thead><tbody id="acBody"></tbody></table></div>
        <div class="ac-note">Source : décompte clients actifs fourni et figé à la date de référence actuelle. Un code postal présent dans le décompte mais non encore affecté reste visible côté administrateur comme « Non affecté » et n'entre dans aucun total secteur.</div>
      </div>`;
    content.appendChild(page);
    page.querySelector('#acSearch').addEventListener('input',()=>renderTable());
    render(true);
    return true;
  }

  function rows(){
    const a=getAssign(),p=getProfile(),sd=getSectorData();
    return Object.entries(ACTIVE_CLIENTS).map(([cp,clients])=>{
      const sector=Number(a[cp]||0);
      const seller=sector?sd?.[sector]?.seller||`Secteur ${sector}`:'Non affecté';
      return {cp,clients,sector,seller};
    }).filter(r=>p?.role!=='seller'||r.sector===Number(p.sector_id));
  }

  function totals(all){
    const t={1:0,2:0,3:0,4:0,unassigned:0,total:0};
    all.forEach(r=>{t.total+=r.clients;if(r.sector>=1&&r.sector<=4)t[r.sector]+=r.clients;else t.unassigned+=r.clients});return t;
  }

  function renderSummary(){
    const box=document.getElementById('acSummary');if(!box)return;
    const p=getProfile(),all=rows(),t=totals(all),sd=getSectorData();
    if(p?.role==='seller'){
      const s=Number(p.sector_id),count=all.length;
      box.innerHTML=`<div class="ac-total"><div><b>${esc(p.display_name||'Vendeur')} — Secteur ${s}</b><br><span>${count} code${count>1?'s':''} postal${count>1?'aux':''} avec une donnée clients actifs</span></div><strong>${t.total} clients actifs</strong></div>`;
      return;
    }
    const cards=[1,2,3,4].map(s=>{
      const count=all.filter(r=>r.sector===s).length,seller=sd?.[s]?.seller||'Non attribué';
      return `<div class="ac-card" style="--ac-color:${SECTOR_COLORS[s]}"><small>Secteur ${s}</small><strong>${t[s]}</strong><b>clients actifs</b><div class="ac-sub">${esc(seller)} · ${count} CP renseigné${count>1?'s':''}</div></div>`;
    }).join('');
    box.innerHTML=`<div class="ac-total"><div><b>Agence Corrèze</b><br><span>Clients actifs issus du décompte figé communiqué</span></div><strong>${t.total} clients actifs</strong></div><div class="ac-grid">${cards}</div>${t.unassigned?`<div style="margin:-3px 0 13px;font-size:11px;color:#64748b"><b>${t.unassigned}</b> clients actifs sont encore rattachés à des codes postaux non affectés.</div>`:''}`;
  }

  function renderTable(){
    const body=document.getElementById('acBody');if(!body)return;
    const q=(document.getElementById('acSearch')?.value||'').trim();
    let all=rows().filter(r=>!q||r.cp.includes(q));
    all.sort((a,b)=>(a.sector||9)-(b.sector||9)||b.clients-a.clients||a.cp.localeCompare(b.cp));
    body.innerHTML=all.length?all.map(r=>`<tr><td><b>${r.cp}</b></td><td>${r.sector?`<span class="ac-badge" style="background:${SECTOR_COLORS[r.sector]}">S${r.sector}</span>`:'<span class="ac-muted">Non affecté</span>'}</td><td>${esc(r.seller)}</td><td class="ac-num">${r.clients}</td></tr>`).join(''):'<tr><td colspan="4" class="ac-empty">Aucun code postal correspondant.</td></tr>';
  }

  function signature(){
    const a=getAssign(),p=getProfile(),sd=getSectorData();
    return JSON.stringify([a,p?.role,p?.sector_id,sd]);
  }
  function render(force=false){const sig=signature();if(!force&&sig===lastSignature)return;lastSignature=sig;renderSummary();renderTable()}

  let tries=0;const timer=setInterval(()=>{tries++;if(mount()||tries>120)clearInterval(timer)},250);
  setInterval(()=>{if(document.getElementById('rexActiveClientsPage'))render()},700);
  window.addEventListener('load',()=>setTimeout(mount,900));
})();