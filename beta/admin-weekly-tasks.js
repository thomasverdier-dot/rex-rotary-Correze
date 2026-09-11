(()=>{
  const DAYS=['','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
  let tasks=[],doneMap=new Map(),busy=false,lastUser='';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function getProfile(){try{return profile||currentProfile||null}catch(e){return null}}
  function getUser(){try{return user||currentUser||null}catch(e){return null}}
  function getSb(){try{return sb}catch(e){return null}}
  function isAdmin(){return getProfile()?.role==='admin'}
  function monday(){const d=new Date();d.setHours(12,0,0,0);const n=d.getDay()||7;d.setDate(d.getDate()-n+1);return d.toISOString().slice(0,10)}
  function fmtTime(v){return v?String(v).slice(0,5):''}
  function addStyle(){
    if(document.getElementById('rexAdminTasksStyle'))return;
    const s=document.createElement('style');s.id='rexAdminTasksStyle';s.textContent=`
      .rawt-wrap{margin:0 0 14px;background:#fff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 12px 30px rgba(15,23,42,.06);overflow:hidden}.rawt-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid #eef2f6}.rawt-head h3{margin:0;color:#10233f;font-size:17px}.rawt-head small{display:block;margin-top:3px;color:#64748b;font-size:10px}.rawt-add{width:38px;height:38px;border:0;border-radius:50%;background:#d71920;color:#fff;font-size:24px;line-height:1;cursor:pointer;font-weight:700}.rawt-progress{font-size:10px;font-weight:900;color:#64748b;margin-left:auto}.rawt-list{padding:8px 12px}.rawt-item{display:grid;grid-template-columns:28px 90px 120px minmax(0,1fr) 34px;gap:9px;align-items:center;padding:10px 4px;border-bottom:1px solid #f1f5f9}.rawt-item:last-child{border-bottom:0}.rawt-item.done .rawt-title{text-decoration:line-through;color:#94a3b8}.rawt-check{width:20px;height:20px;accent-color:#16a34a;cursor:pointer}.rawt-day{font-size:11px;font-weight:900;color:#334155}.rawt-time{font-size:10px;color:#64748b}.rawt-title{font-size:12px;font-weight:800;color:#10233f}.rawt-del{border:0;background:transparent;color:#94a3b8;cursor:pointer;font-size:16px;border-radius:8px;padding:5px}.rawt-del:hover{background:#fee2e2;color:#991b1b}.rawt-empty{padding:18px;text-align:center;color:#64748b;font-size:11px}.rawt-form{display:none;grid-template-columns:140px 120px 120px minmax(220px,1fr) auto;gap:8px;align-items:end;padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0}.rawt-form.open{display:grid}.rawt-field label{display:block;font-size:9px;font-weight:900;color:#64748b;margin-bottom:4px}.rawt-field input,.rawt-field select{width:100%;box-sizing:border-box;padding:9px;border:1px solid #cbd5e1;border-radius:9px;background:#fff}.rawt-save{border:0;border-radius:9px;background:#10233f;color:#fff;padding:10px 14px;font-weight:900;cursor:pointer}.rawt-msg{padding:0 16px 10px;font-size:9px;color:#64748b;min-height:11px}@media(max-width:800px){.rawt-form{grid-template-columns:1fr 1fr}.rawt-field.title{grid-column:1/-1}.rawt-save{grid-column:1/-1}.rawt-item{grid-template-columns:26px 72px 95px minmax(0,1fr) 30px;gap:6px}.rawt-time{font-size:9px}}
    `;document.head.appendChild(s);
  }
  function ensureBox(){
    if(!isAdmin())return null;
    const page=document.querySelector('.rex-page[data-page="dashboard"]');if(!page)return null;
    let box=document.getElementById('rexAdminWeeklyTasks');if(box)return box;
    addStyle();box=document.createElement('div');box.id='rexAdminWeeklyTasks';box.className='rawt-wrap';
    box.innerHTML=`<div class="rawt-head"><div><h3>✅ Mes choses à faire cette semaine</h3><small>Checklist personnelle · les cases repartent à zéro chaque lundi.</small></div><span id="rawtProgress" class="rawt-progress"></span><button id="rawtAdd" class="rawt-add" type="button" title="Ajouter une tâche">+</button></div><div id="rawtForm" class="rawt-form"><div class="rawt-field"><label>Jour</label><select id="rawtDay">${DAYS.slice(1).map((d,i)=>`<option value="${i+1}">${d}</option>`).join('')}</select></div><div class="rawt-field"><label>Début</label><input id="rawtStart" type="time"></div><div class="rawt-field"><label>Fin</label><input id="rawtEnd" type="time"></div><div class="rawt-field title"><label>Chose à faire</label><input id="rawtTitle" type="text" placeholder="Ex. Préparation de réunion"></div><button id="rawtSave" class="rawt-save" type="button">Ajouter</button></div><div id="rawtList" class="rawt-list"><div class="rawt-empty">Chargement…</div></div><div id="rawtMsg" class="rawt-msg"></div>`;
    const head=page.querySelector('.rex-page-head');if(head)head.insertAdjacentElement('afterend',box);else page.prepend(box);
    box.querySelector('#rawtAdd').onclick=()=>box.querySelector('#rawtForm').classList.toggle('open');
    box.querySelector('#rawtSave').onclick=addTask;
    return box;
  }
  async function seedIfEmpty(){
    if(tasks.length)return;
    const client=getSb(),u=getUser();if(!client||!u)return;
    const r=await client.from('admin_weekly_tasks').insert({user_id:u.id,title:'Préparation de réunion',day_of_week:1,start_time:'09:00',end_time:'10:00',sort_order:10}).select('*').single();
    if(!r.error&&r.data)tasks=[r.data];
  }
  async function load(){
    if(!isAdmin())return;const box=ensureBox(),client=getSb(),u=getUser();if(!box||!client||!u||busy)return;
    busy=true;try{
      const w=monday();
      const [t,c]=await Promise.all([
        client.from('admin_weekly_tasks').select('*').eq('user_id',u.id).eq('is_active',true).order('day_of_week').order('start_time',{ascending:true,nullsFirst:false}).order('sort_order'),
        client.from('admin_weekly_task_completions').select('task_id,done').eq('user_id',u.id).eq('week_start',w)
      ]);
      if(t.error){setMsg('Erreur tâches : '+t.error.message);return}if(c.error){setMsg('Erreur suivi : '+c.error.message);return}
      tasks=t.data||[];doneMap=new Map((c.data||[]).map(x=>[x.task_id,!!x.done]));
      await seedIfEmpty();render();lastUser=u.id;
    }finally{busy=false}
  }
  function render(){
    const list=document.getElementById('rawtList'),prog=document.getElementById('rawtProgress');if(!list)return;
    const done=tasks.filter(t=>doneMap.get(t.id)).length;if(prog)prog.textContent=`${done} / ${tasks.length} fait${tasks.length>1?'s':''}`;
    if(!tasks.length){list.innerHTML='<div class="rawt-empty">Aucune tâche hebdomadaire. Clique sur + pour en ajouter.</div>';return}
    list.innerHTML=tasks.map(t=>{const ok=!!doneMap.get(t.id),st=fmtTime(t.start_time),et=fmtTime(t.end_time),time=st?(et?`${st} – ${et}`:st):'—';return `<div class="rawt-item ${ok?'done':''}" data-task="${t.id}"><input class="rawt-check" type="checkbox" ${ok?'checked':''}><div class="rawt-day">${DAYS[t.day_of_week]||''}</div><div class="rawt-time">${time}</div><div class="rawt-title">${esc(t.title)}</div><button class="rawt-del" type="button" title="Supprimer">✕</button></div>`}).join('');
    list.querySelectorAll('.rawt-check').forEach(x=>x.onchange=()=>toggleDone(x.closest('[data-task]').dataset.task,x.checked));
    list.querySelectorAll('.rawt-del').forEach(x=>x.onclick=()=>removeTask(x.closest('[data-task]').dataset.task));
  }
  async function addTask(){
    const client=getSb(),u=getUser();if(!client||!u)return;const title=document.getElementById('rawtTitle')?.value.trim()||'';if(!title){setMsg('Indique la chose à faire.');return}
    const row={user_id:u.id,title,day_of_week:Number(document.getElementById('rawtDay').value||1),start_time:document.getElementById('rawtStart').value||null,end_time:document.getElementById('rawtEnd').value||null,sort_order:tasks.length*10+10};
    const r=await client.from('admin_weekly_tasks').insert(row).select('*').single();if(r.error){setMsg('Erreur : '+r.error.message);return}
    document.getElementById('rawtTitle').value='';document.getElementById('rawtStart').value='';document.getElementById('rawtEnd').value='';document.getElementById('rawtForm').classList.remove('open');
    tasks.push(r.data);tasks.sort((a,b)=>(a.day_of_week-b.day_of_week)||String(a.start_time||'99:99').localeCompare(String(b.start_time||'99:99')));render();setMsg('Tâche ajoutée.');
  }
  async function toggleDone(id,done){
    const client=getSb(),u=getUser();if(!client||!u)return;setMsg('Enregistrement…');
    const row={task_id:id,user_id:u.id,week_start:monday(),done,updated_at:new Date().toISOString()};const r=await client.from('admin_weekly_task_completions').upsert(row,{onConflict:'task_id,user_id,week_start'});if(r.error){setMsg('Erreur : '+r.error.message);await load();return}doneMap.set(id,done);render();setMsg(done?'Fait enregistré.':'Tâche remise à faire.');
  }
  async function removeTask(id){
    const client=getSb();if(!client)return;if(!confirm('Supprimer cette tâche de la checklist hebdomadaire ?'))return;
    const r=await client.from('admin_weekly_tasks').delete().eq('id',id);if(r.error){setMsg('Erreur : '+r.error.message);return}tasks=tasks.filter(t=>t.id!==id);doneMap.delete(id);render();setMsg('Tâche supprimée.');
  }
  function setMsg(s){const el=document.getElementById('rawtMsg');if(el){el.textContent=s||'';if(s)setTimeout(()=>{if(el.textContent===s)el.textContent=''},1800)}}
  function tick(){
    if(!isAdmin())return;const box=ensureBox(),u=getUser();if(!box||!u)return;if(lastUser!==u.id||box.dataset.loaded!=='1'){box.dataset.loaded='1';load()}
  }
  setInterval(tick,1000);window.addEventListener('load',()=>setTimeout(tick,1200));
})();