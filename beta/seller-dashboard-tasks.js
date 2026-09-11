(()=>{
  let tasks=[],sellers=[],loaded=false,busy=false;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function getProfile(){try{return profile||currentProfile||null}catch(e){return null}}
  function getUser(){try{return user||currentUser||null}catch(e){return null}}
  function getSb(){try{return sb}catch(e){return null}}
  function isAdmin(){return getProfile()?.role==='admin'}
  function addStyle(){
    if(document.getElementById('sellerDashTasksStyle'))return;
    const s=document.createElement('style');s.id='sellerDashTasksStyle';s.textContent=`
      .sdt-wrap{margin:0 0 16px;background:#fff;border:1px solid #dfe6ee;border-radius:18px;box-shadow:0 10px 28px rgba(15,23,42,.055);overflow:hidden}.sdt-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 17px;border-bottom:1px solid #eef2f6}.sdt-head h3{margin:0;color:#10233f;font-size:18px}.sdt-head small{display:block;margin-top:4px;color:#64748b;font-size:10px}.sdt-tools{display:flex;gap:7px;align-items:center}.sdt-btn,.sdt-add{border:0;border-radius:9px;padding:9px 12px;font-weight:900;cursor:pointer}.sdt-btn{background:#f1f5f9;color:#334155}.sdt-add{background:#d71920;color:#fff;font-size:18px;line-height:1}.sdt-form{display:none;grid-template-columns:230px minmax(280px,1fr) auto;gap:8px;align-items:end;padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0}.sdt-form.open{display:grid}.sdt-field label{display:block;font-size:9px;font-weight:900;color:#64748b;margin-bottom:4px}.sdt-field input,.sdt-field select{width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:9px;background:#fff}.sdt-save{border:0;border-radius:9px;background:#10233f;color:#fff;padding:11px 14px;font-weight:900;cursor:pointer}.sdt-list{padding:10px 12px}.sdt-seller-block{border:1px solid #e5eaf0;border-radius:14px;margin-bottom:10px;overflow:hidden}.sdt-seller-block:last-child{margin-bottom:0}.sdt-seller-head{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:11px 12px;background:#f8fafc;border-bottom:1px solid #edf1f5}.sdt-seller-name{font-size:12px;font-weight:900;color:#10233f}.sdt-count{font-size:10px;font-weight:800;color:#64748b}.sdt-items{padding:6px 11px}.sdt-item{display:grid;grid-template-columns:28px minmax(0,1fr) 34px;gap:9px;align-items:center;padding:10px 2px;border-bottom:1px solid #f1f5f9}.sdt-item:last-child{border-bottom:0}.sdt-bullet{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#eff6ff;color:#0e2f68;font-size:12px;font-weight:900}.sdt-title{font-size:12px;font-weight:800;color:#10233f;white-space:pre-wrap}.sdt-del{border:0;background:transparent;color:#94a3b8;cursor:pointer;font-size:16px;padding:5px;border-radius:8px}.sdt-del:hover{background:#fee2e2;color:#991b1b}.sdt-empty{padding:18px;text-align:center;color:#64748b;font-size:11px}.sdt-note{padding:10px 16px;background:#eff6ff;border-top:1px solid #bfdbfe;color:#1d4ed8;font-size:10px;font-weight:800}.sdt-msg{padding:0 16px 10px;font-size:9px;color:#64748b;min-height:12px}@media(max-width:850px){.sdt-form{grid-template-columns:1fr}.sdt-item{grid-template-columns:28px minmax(0,1fr) 30px}}
    `;document.head.appendChild(s)
  }
  function dashboard(){return document.querySelector('.rex-page[data-page="dashboard"]')}
  function ensureBox(){
    const page=dashboard();if(!page)return null;addStyle();let box=document.getElementById('sellerDashboardTasks');if(box)return box;
    box=document.createElement('div');box.id='sellerDashboardTasks';box.className='sdt-wrap';const admin=isAdmin();
    box.innerHTML=`<div class="sdt-head"><div><h3>${admin?'🧠 Pense-bête quotidien des vendeurs':'🧠 Pense-bête commercial quotidien'}</h3><small>${admin?'Les rappels affichés en permanence sur le tableau de bord de chaque vendeur.':'À relire chaque jour pour ne rien oublier dans ton organisation commerciale.'}</small></div><div class="sdt-tools"><button id="sdtRefresh" class="sdt-btn" type="button">Actualiser</button>${admin?'<button id="sdtAdd" class="sdt-add" type="button" title="Ajouter un rappel">+</button>':''}</div></div>${admin?`<div id="sdtForm" class="sdt-form"><div class="sdt-field"><label>Vendeur</label><select id="sdtSeller"></select></div><div class="sdt-field"><label>Rappel à afficher</label><input id="sdtTitle" type="text" placeholder="Ex. Vérifier les affaires du portefeuille"></div><button id="sdtSave" class="sdt-save" type="button">Ajouter</button></div>`:''}<div id="sdtList" class="sdt-list"><div class="sdt-empty">Chargement…</div></div><div class="sdt-note">💡 Pense-bête permanent : ces rappels restent visibles tous les jours, sans case à cocher.</div><div id="sdtMsg" class="sdt-msg"></div>`;
    const own=document.getElementById('rexAdminWeeklyTasks'),action=document.getElementById('sellerActionDashboard'),head=page.querySelector('.rex-page-head');
    if(admin&&own)own.insertAdjacentElement('afterend',box);else if(!admin&&action)action.insertAdjacentElement('afterend',box);else if(head)head.insertAdjacentElement('afterend',box);else page.prepend(box);
    box.querySelector('#sdtRefresh').onclick=()=>load(true);if(admin){box.querySelector('#sdtAdd').onclick=()=>box.querySelector('#sdtForm').classList.toggle('open');box.querySelector('#sdtSave').onclick=addTask}
    return box
  }
  async function load(force=false){
    const box=ensureBox(),client=getSb(),u=getUser(),p=getProfile();if(!box||!client||!u||!p||busy)return;if(loaded&&!force)return;busy=true;setMsg('Chargement…');
    try{
      if(isAdmin()){
        const [pr,tr]=await Promise.all([client.from('profiles').select('user_id,display_name,sector_id').eq('role','seller').order('sector_id'),client.from('seller_dashboard_tasks').select('*').eq('is_active',true).order('created_at',{ascending:true})]);
        if(pr.error)throw pr.error;if(tr.error)throw tr.error;sellers=pr.data||[];tasks=tr.data||[];fillSellerSelect();
      }else{
        const tr=await client.from('seller_dashboard_tasks').select('*').eq('seller_user_id',u.id).eq('is_active',true).order('created_at',{ascending:true});if(tr.error)throw tr.error;tasks=tr.data||[];sellers=[{user_id:u.id,display_name:p.display_name||u.email,sector_id:p.sector_id}];
      }
      loaded=true;render();setMsg('');
    }catch(e){setMsg('Erreur : '+(e?.message||e))}finally{busy=false}
  }
  function sellerName(s){return (s?.display_name||'Vendeur')+(s?.sector_id?' — S'+s.sector_id:'')}
  function fillSellerSelect(){const sel=document.getElementById('sdtSeller');if(sel)sel.innerHTML=sellers.map(s=>`<option value="${s.user_id}">${esc(sellerName(s))}</option>`).join('')}
  function sellerBlock(s){
    const list=tasks.filter(t=>t.seller_user_id===s.user_id);
    const rows=list.length?list.map((t,i)=>`<div class="sdt-item" data-task="${t.id}"><div class="sdt-bullet">${i+1}</div><div class="sdt-title">${esc(t.title)}</div>${isAdmin()?'<button class="sdt-del" type="button" title="Supprimer ce rappel">✕</button>':'<span></span>'}</div>`).join(''):`<div class="sdt-empty">${isAdmin()?'Aucun rappel assigné.':'Aucun rappel pour le moment.'}</div>`;
    return `<div class="sdt-seller-block" data-seller="${s.user_id}"><div class="sdt-seller-head"><div class="sdt-seller-name">${esc(sellerName(s))}</div><div class="sdt-count">${list.length} rappel${list.length>1?'s':''}</div></div><div class="sdt-items">${rows}</div></div>`
  }
  function render(){const list=document.getElementById('sdtList');if(!list)return;const visible=isAdmin()?sellers:sellers.slice(0,1);list.innerHTML=visible.map(sellerBlock).join('')||'<div class="sdt-empty">Aucun vendeur.</div>';if(isAdmin())list.querySelectorAll('.sdt-del').forEach(x=>x.onclick=()=>removeTask(x.closest('[data-task]').dataset.task))}
  async function addTask(){const client=getSb(),u=getUser();if(!client||!u)return;const seller=document.getElementById('sdtSeller')?.value||'',title=document.getElementById('sdtTitle')?.value.trim()||'';if(!seller){setMsg('Choisis un vendeur.');return}if(!title){setMsg('Indique le rappel.');return}setMsg('Ajout…');const r=await client.from('seller_dashboard_tasks').insert({seller_user_id:seller,title,due_date:null,created_by:u.id,updated_at:new Date().toISOString()}).select('*').single();if(r.error){setMsg('Erreur : '+r.error.message);return}tasks.push(r.data);document.getElementById('sdtTitle').value='';document.getElementById('sdtForm').classList.remove('open');render();setMsg('Rappel ajouté au tableau de bord du vendeur.')}
  async function removeTask(id){if(!confirm('Supprimer ce rappel du tableau de bord du vendeur ?'))return;const client=getSb();if(!client)return;setMsg('Suppression…');const r=await client.from('seller_dashboard_tasks').delete().eq('id',id);if(r.error){setMsg('Erreur : '+r.error.message);return}tasks=tasks.filter(t=>t.id!==id);render();setMsg('Rappel supprimé.')}
  function setMsg(s){const el=document.getElementById('sdtMsg');if(el){el.textContent=s||'';if(s&&!String(s).startsWith('Erreur'))setTimeout(()=>{if(el.textContent===s)el.textContent=''},2200)}}
  function boot(){const box=ensureBox(),p=getProfile(),u=getUser();if(box&&p&&u){load();return true}return false}
  let tries=0;const timer=setInterval(()=>{tries++;if(boot()||tries>120)clearInterval(timer)},500);window.addEventListener('load',()=>setTimeout(boot,1200));
})();