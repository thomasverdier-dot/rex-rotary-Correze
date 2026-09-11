(()=>{
  let tasks=[],completions=new Map(),sellers=[],loaded=false,busy=false;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function getProfile(){try{return profile||currentProfile||null}catch(e){return null}}
  function getUser(){try{return user||currentUser||null}catch(e){return null}}
  function getSb(){try{return sb}catch(e){return null}}
  function isAdmin(){return getProfile()?.role==='admin'}
  function frDate(v){return v?new Date(v+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}):''}
  function today(){return new Date().toISOString().slice(0,10)}
  function addStyle(){
    if(document.getElementById('sellerDashTasksStyle'))return;
    const s=document.createElement('style');s.id='sellerDashTasksStyle';s.textContent=`
      .sdt-wrap{margin:0 0 16px;background:#fff;border:1px solid #dfe6ee;border-radius:18px;box-shadow:0 10px 28px rgba(15,23,42,.055);overflow:hidden}.sdt-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid #eef2f6}.sdt-head h3{margin:0;color:#10233f;font-size:17px}.sdt-head small{display:block;margin-top:3px;color:#64748b;font-size:10px}.sdt-tools{display:flex;gap:7px;align-items:center}.sdt-btn,.sdt-add{border:0;border-radius:9px;padding:9px 12px;font-weight:900;cursor:pointer}.sdt-btn{background:#f1f5f9;color:#334155}.sdt-add{background:#d71920;color:#fff;font-size:18px;line-height:1;padding:9px 12px}.sdt-progress{font-size:10px;font-weight:900;color:#64748b}.sdt-form{display:none;grid-template-columns:220px minmax(260px,1fr) 160px auto;gap:8px;align-items:end;padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0}.sdt-form.open{display:grid}.sdt-field label{display:block;font-size:9px;font-weight:900;color:#64748b;margin-bottom:4px}.sdt-field input,.sdt-field select{width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:9px;background:#fff}.sdt-save{border:0;border-radius:9px;background:#10233f;color:#fff;padding:11px 14px;font-weight:900;cursor:pointer}.sdt-list{padding:8px 12px}.sdt-item{display:grid;grid-template-columns:28px minmax(0,1fr) 140px 105px 34px;gap:9px;align-items:center;padding:11px 4px;border-bottom:1px solid #f1f5f9}.sdt-item:last-child{border-bottom:0}.sdt-item.done .sdt-title{text-decoration:line-through;color:#94a3b8}.sdt-check{width:20px;height:20px;accent-color:#16a34a;cursor:pointer}.sdt-main{min-width:0}.sdt-title{font-size:12px;font-weight:850;color:#10233f;white-space:pre-wrap}.sdt-seller{font-size:9px;color:#64748b;margin-top:3px}.sdt-due{font-size:10px;color:#64748b}.sdt-due.overdue{color:#b91c1c;font-weight:900}.sdt-status{font-size:10px;font-weight:900}.sdt-status.done{color:#166534}.sdt-status.todo{color:#b45309}.sdt-del{border:0;background:transparent;color:#94a3b8;cursor:pointer;font-size:16px;padding:5px;border-radius:8px}.sdt-del:hover{background:#fee2e2;color:#991b1b}.sdt-empty{padding:18px;text-align:center;color:#64748b;font-size:11px}.sdt-msg{padding:0 16px 10px;font-size:9px;color:#64748b;min-height:12px}@media(max-width:850px){.sdt-form{grid-template-columns:1fr 1fr}.sdt-field.task{grid-column:1/-1}.sdt-save{grid-column:1/-1}.sdt-item{grid-template-columns:26px minmax(0,1fr) 100px}.sdt-status{grid-column:2}.sdt-del{grid-column:3;grid-row:1}.sdt-due{grid-column:3;grid-row:2}}
    `;document.head.appendChild(s)
  }
  function dashboard(){return document.querySelector('.rex-page[data-page="dashboard"]')}
  function ensureBox(){
    const page=dashboard();if(!page)return null;addStyle();let box=document.getElementById('sellerDashboardTasks');if(box)return box;
    box=document.createElement('div');box.id='sellerDashboardTasks';box.className='sdt-wrap';
    const admin=isAdmin();
    box.innerHTML=`<div class="sdt-head"><div><h3>${admin?'📌 Tâches de mes vendeurs':'📌 Mes tâches à faire'}</h3><small>${admin?'Assigne une tâche et suis son avancement depuis ton tableau de bord.':'Les tâches ajoutées par ton manager apparaissent ici.'}</small></div><div class="sdt-tools"><span id="sdtProgress" class="sdt-progress"></span><button id="sdtRefresh" class="sdt-btn" type="button">Actualiser</button>${admin?'<button id="sdtAdd" class="sdt-add" type="button" title="Ajouter une tâche">+</button>':''}</div></div>${admin?`<div id="sdtForm" class="sdt-form"><div class="sdt-field"><label>Vendeur</label><select id="sdtSeller"></select></div><div class="sdt-field task"><label>Tâche à faire</label><input id="sdtTitle" type="text" placeholder="Ex. Relancer les 10 comptes prioritaires"></div><div class="sdt-field"><label>Échéance</label><input id="sdtDue" type="date"></div><button id="sdtSave" class="sdt-save" type="button">Ajouter</button></div>`:''}<div id="sdtList" class="sdt-list"><div class="sdt-empty">Chargement…</div></div><div id="sdtMsg" class="sdt-msg"></div>`;
    const own=document.getElementById('rexAdminWeeklyTasks'),action=document.getElementById('sellerActionDashboard'),head=page.querySelector('.rex-page-head');
    if(admin&&own)own.insertAdjacentElement('afterend',box);else if(!admin&&action)action.insertAdjacentElement('afterend',box);else if(head)head.insertAdjacentElement('afterend',box);else page.prepend(box);
    box.querySelector('#sdtRefresh').onclick=()=>load(true);
    if(admin){box.querySelector('#sdtAdd').onclick=()=>box.querySelector('#sdtForm').classList.toggle('open');box.querySelector('#sdtSave').onclick=addTask}
    return box
  }
  async function load(force=false){
    const box=ensureBox(),client=getSb(),u=getUser(),p=getProfile();if(!box||!client||!u||!p||busy)return;if(loaded&&!force)return;
    busy=true;setMsg('Chargement…');
    try{
      if(isAdmin()){
        const [pr,tr]=await Promise.all([
          client.from('profiles').select('user_id,display_name,sector_id').eq('role','seller').order('sector_id'),
          client.from('seller_dashboard_tasks').select('*').eq('is_active',true).order('created_at',{ascending:false})
        ]);
        if(pr.error)throw pr.error;if(tr.error)throw tr.error;sellers=pr.data||[];tasks=tr.data||[];
        const ids=tasks.map(t=>t.id);let cr={data:[],error:null};if(ids.length)cr=await client.from('seller_dashboard_task_completions').select('task_id,seller_user_id,done,completed_at,updated_at').in('task_id',ids);if(cr.error)throw cr.error;completions=new Map((cr.data||[]).map(x=>[x.task_id,x]));fillSellerSelect();
      }else{
        const tr=await client.from('seller_dashboard_tasks').select('*').eq('seller_user_id',u.id).eq('is_active',true).order('created_at',{ascending:false});if(tr.error)throw tr.error;tasks=tr.data||[];const ids=tasks.map(t=>t.id);let cr={data:[],error:null};if(ids.length)cr=await client.from('seller_dashboard_task_completions').select('task_id,seller_user_id,done,completed_at,updated_at').eq('seller_user_id',u.id).in('task_id',ids);if(cr.error)throw cr.error;completions=new Map((cr.data||[]).map(x=>[x.task_id,x]));
      }
      loaded=true;render();setMsg('');
    }catch(e){setMsg('Erreur : '+(e?.message||e))}finally{busy=false}
  }
  function sellerName(uid){const s=sellers.find(x=>x.user_id===uid);return s?(s.display_name||'Vendeur')+(s.sector_id?' — S'+s.sector_id:''):'Vendeur'}
  function fillSellerSelect(){const sel=document.getElementById('sdtSeller');if(sel)sel.innerHTML=sellers.map(s=>`<option value="${s.user_id}">${esc(s.display_name||'Vendeur')}${s.sector_id?' — S'+esc(s.sector_id):''}</option>`).join('')}
  function render(){
    const list=document.getElementById('sdtList'),prog=document.getElementById('sdtProgress');if(!list)return;
    const sorted=[...tasks].sort((a,b)=>{const ad=!!completions.get(a.id)?.done,bd=!!completions.get(b.id)?.done;if(ad!==bd)return ad?1:-1;return String(a.due_date||'9999-12-31').localeCompare(String(b.due_date||'9999-12-31'))||String(b.created_at||'').localeCompare(String(a.created_at||''))});
    const done=sorted.filter(t=>completions.get(t.id)?.done).length;if(prog)prog.textContent=`${done} / ${sorted.length} fait${sorted.length>1?'s':''}`;
    if(!sorted.length){list.innerHTML=`<div class="sdt-empty">${isAdmin()?'Aucune tâche vendeur. Clique sur + pour en ajouter.':'Aucune tâche à faire pour le moment.'}</div>`;return}
    list.innerHTML=sorted.map(t=>{const c=completions.get(t.id),ok=!!c?.done,over=!ok&&t.due_date&&t.due_date<today();return `<div class="sdt-item ${ok?'done':''}" data-task="${t.id}"><input class="sdt-check" type="checkbox" ${ok?'checked':''} ${isAdmin()?'disabled':''}><div class="sdt-main"><div class="sdt-title">${esc(t.title)}</div>${isAdmin()?`<div class="sdt-seller">${esc(sellerName(t.seller_user_id))}</div>`:''}</div><div class="sdt-due ${over?'overdue':''}">${t.due_date?(over?'⚠ ':'')+'Échéance '+frDate(t.due_date):'Sans échéance'}</div><div class="sdt-status ${ok?'done':'todo'}">${ok?'✓ Fait':'À faire'}</div>${isAdmin()?'<button class="sdt-del" type="button" title="Supprimer">✕</button>':'<span></span>'}</div>`}).join('');
    if(!isAdmin())list.querySelectorAll('.sdt-check').forEach(x=>x.onchange=()=>toggleDone(x.closest('[data-task]').dataset.task,x.checked));
    else list.querySelectorAll('.sdt-del').forEach(x=>x.onclick=()=>removeTask(x.closest('[data-task]').dataset.task));
  }
  async function addTask(){
    const client=getSb(),u=getUser();if(!client||!u)return;const seller=document.getElementById('sdtSeller')?.value||'',title=document.getElementById('sdtTitle')?.value.trim()||'',due=document.getElementById('sdtDue')?.value||null;if(!seller){setMsg('Choisis un vendeur.');return}if(!title){setMsg('Indique la tâche à faire.');return}
    setMsg('Ajout…');const r=await client.from('seller_dashboard_tasks').insert({seller_user_id:seller,title,due_date:due,created_by:u.id,updated_at:new Date().toISOString()}).select('*').single();if(r.error){setMsg('Erreur : '+r.error.message);return}
    tasks.unshift(r.data);document.getElementById('sdtTitle').value='';document.getElementById('sdtDue').value='';document.getElementById('sdtForm').classList.remove('open');render();setMsg('Tâche ajoutée au tableau de bord du vendeur.')
  }
  async function toggleDone(id,done){
    const client=getSb(),u=getUser();if(!client||!u)return;const task=tasks.find(t=>t.id===id);if(!task)return;setMsg('Enregistrement…');
    const row={task_id:id,seller_user_id:u.id,done,completed_at:done?new Date().toISOString():null,updated_at:new Date().toISOString()};const r=await client.from('seller_dashboard_task_completions').upsert(row,{onConflict:'task_id'});if(r.error){setMsg('Erreur : '+r.error.message);await load(true);return}completions.set(id,row);render();setMsg(done?'Tâche marquée comme faite.':'Tâche remise à faire.')
  }
  async function removeTask(id){
    if(!confirm('Supprimer cette tâche du tableau de bord du vendeur ?'))return;const client=getSb();if(!client)return;setMsg('Suppression…');const r=await client.from('seller_dashboard_tasks').delete().eq('id',id);if(r.error){setMsg('Erreur : '+r.error.message);return}tasks=tasks.filter(t=>t.id!==id);completions.delete(id);render();setMsg('Tâche supprimée.')
  }
  function setMsg(s){const el=document.getElementById('sdtMsg');if(el){el.textContent=s||'';if(s&&!String(s).startsWith('Erreur'))setTimeout(()=>{if(el.textContent===s)el.textContent=''},2200)}}
  function boot(){const box=ensureBox(),p=getProfile(),u=getUser();if(box&&p&&u){load();return true}return false}
  let tries=0;const timer=setInterval(()=>{tries++;if(boot()||tries>120)clearInterval(timer)},500);window.addEventListener('load',()=>setTimeout(boot,1200));
})();