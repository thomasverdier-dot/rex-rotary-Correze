(()=>{
  let sellers=[],busy=false;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function getProfile(){try{return profile||currentProfile||null}catch(e){return null}}
  function getSb(){try{return sb}catch(e){return null}}
  function isAdmin(){return getProfile()?.role==='admin'}

  async function readableFunctionError(error){
    try{
      if(error?.context&&typeof error.context.json==='function'){
        const body=await error.context.clone().json();
        if(body?.error)return body.error;
        if(body?.message)return body.message;
      }
    }catch(e){}
    return error?.message||'Opération impossible.';
  }

  function addStyle(){
    if(document.getElementById('adminSellerMgmtStyle'))return;
    const s=document.createElement('style');s.id='adminSellerMgmtStyle';s.textContent=`
      .asm-grid{display:grid;grid-template-columns:minmax(320px,.9fr) minmax(480px,1.4fr);gap:14px;align-items:start}.asm-card{background:#fff;border:1px solid #dfe6ee;border-radius:18px;padding:16px;box-shadow:0 10px 28px rgba(15,23,42,.055)}.asm-card h3{margin:0 0 5px;color:#10233f;font-size:18px}.asm-sub{font-size:10px;color:#64748b;margin-bottom:14px}.asm-field{margin-bottom:9px}.asm-field label{display:block;font-size:9px;font-weight:900;color:#64748b;margin-bottom:4px}.asm-field input,.asm-field select,.asm-sector{width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:9px;background:#fff}.asm-create,.asm-save,.asm-refresh{border:0;border-radius:9px;font-weight:900;cursor:pointer}.asm-create{width:100%;padding:11px 14px;background:#0f6b47;color:#fff}.asm-save{padding:8px 11px;background:#10233f;color:#fff;font-size:10px}.asm-refresh{padding:8px 11px;background:#f1f5f9;color:#334155;font-size:10px}.asm-msg{font-size:10px;min-height:14px;margin-top:8px;color:#64748b}.asm-ok{color:#166534}.asm-error{color:#b42318}.asm-list-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}.asm-table-wrap{overflow:auto}.asm-table{width:100%;border-collapse:collapse;min-width:520px;font-size:11px}.asm-table th,.asm-table td{padding:9px;border-bottom:1px solid #edf2f7;text-align:left;vertical-align:middle}.asm-table th{background:#f8fafc;color:#475569;font-weight:900}.asm-name{font-weight:900;color:#10233f}.asm-empty{padding:18px;text-align:center;color:#64748b;font-size:11px}@media(max-width:900px){.asm-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(s)
  }

  function adminPage(){return document.querySelector('.rex-page[data-page="admin"]')}
  function ensure(){
    if(!isAdmin())return null;
    const page=adminPage();if(!page)return null;addStyle();
    let root=document.getElementById('adminSellerManagement');if(root)return root;
    [...page.querySelectorAll('.rex-placeholder')].forEach(x=>x.style.display='none');
    root=document.createElement('div');root.id='adminSellerManagement';root.className='asm-grid';
    root.innerHTML=`
      <div class="asm-card">
        <h3>➕ Créer un vendeur</h3>
        <div class="asm-sub">Création du compte vendeur et affectation immédiate à un secteur.</div>
        <div class="asm-field"><label>Nom du vendeur</label><input id="asmName" type="text" placeholder="Prénom Nom"></div>
        <div class="asm-field"><label>Adresse e-mail</label><input id="asmEmail" type="email" placeholder="vendeur@entreprise.fr"></div>
        <div class="asm-field"><label>Mot de passe temporaire</label><input id="asmPassword" type="password" placeholder="8 caractères minimum"></div>
        <div class="asm-field"><label>Secteur</label><select id="asmSector"><option value="">Choisir le secteur</option><option value="1">Secteur 1</option><option value="2">Secteur 2</option><option value="3">Secteur 3</option><option value="4">Secteur 4</option></select></div>
        <button id="asmCreate" class="asm-create" type="button">Créer le vendeur</button>
        <div id="asmCreateMsg" class="asm-msg"></div>
      </div>
      <div class="asm-card">
        <div class="asm-list-head"><div><h3>👥 Vendeurs existants</h3><div class="asm-sub" style="margin:0">Modifie ici l’affectation S1 à S4. Les objectifs et le tableau de bord suivront automatiquement le secteur.</div></div><button id="asmRefresh" class="asm-refresh" type="button">Actualiser</button></div>
        <div class="asm-table-wrap"><table class="asm-table"><thead><tr><th>Vendeur</th><th>Secteur</th><th></th></tr></thead><tbody id="asmSellerBody"><tr><td colspan="3" class="asm-empty">Chargement…</td></tr></tbody></table></div>
        <div id="asmListMsg" class="asm-msg"></div>
      </div>`;
    page.appendChild(root);
    root.querySelector('#asmCreate').onclick=createSeller;
    root.querySelector('#asmRefresh').onclick=()=>load(true);
    return root;
  }

  function render(){
    const body=document.getElementById('asmSellerBody');if(!body)return;
    if(!sellers.length){body.innerHTML='<tr><td colspan="3" class="asm-empty">Aucun vendeur.</td></tr>';return}
    body.innerHTML=sellers.map(s=>`<tr data-user="${s.user_id}"><td><div class="asm-name">${esc(s.display_name||'Vendeur')}</div></td><td><select class="asm-sector"><option value="1" ${Number(s.sector_id)===1?'selected':''}>Secteur 1</option><option value="2" ${Number(s.sector_id)===2?'selected':''}>Secteur 2</option><option value="3" ${Number(s.sector_id)===3?'selected':''}>Secteur 3</option><option value="4" ${Number(s.sector_id)===4?'selected':''}>Secteur 4</option></select></td><td><button class="asm-save" type="button">Enregistrer</button></td></tr>`).join('');
    body.querySelectorAll('.asm-save').forEach(btn=>btn.onclick=()=>saveSector(btn.closest('tr')));
  }

  async function load(force=false){
    const root=ensure(),client=getSb();if(!root||!client||busy)return;busy=true;setListMsg('Chargement…');
    try{
      const r=await client.from('profiles').select('user_id,display_name,sector_id').eq('role','seller').order('display_name');
      if(r.error)throw r.error;sellers=r.data||[];render();setListMsg('');
    }catch(e){setListMsg('Erreur : '+(e?.message||e),true)}finally{busy=false}
  }

  async function createSeller(){
    const client=getSb();if(!client)return;
    const name=document.getElementById('asmName')?.value.trim()||'';
    const email=document.getElementById('asmEmail')?.value.trim()||'';
    const password=document.getElementById('asmPassword')?.value||'';
    const sector_id=Number(document.getElementById('asmSector')?.value||0);
    if(!name||!email||password.length<8||![1,2,3,4].includes(sector_id)){setCreateMsg('Renseigne le nom, l’e-mail, un mot de passe de 8 caractères minimum et le secteur.',true);return}
    const btn=document.getElementById('asmCreate');if(btn)btn.disabled=true;setCreateMsg('Création du vendeur…');
    try{
      const {data,error}=await client.functions.invoke('admin-create-seller',{body:{display_name:name,email,password,sector_id}});
      if(error)throw error;if(data?.error)throw new Error(data.error);
      document.getElementById('asmName').value='';document.getElementById('asmEmail').value='';document.getElementById('asmPassword').value='';document.getElementById('asmSector').value='';
      setCreateMsg(`✓ ${name} créé — Secteur ${sector_id}.`,false,true);await load(true);
    }catch(e){setCreateMsg(await readableFunctionError(e),true)}finally{if(btn)btn.disabled=false}
  }

  async function saveSector(tr){
    const client=getSb();if(!client||!tr)return;const uid=tr.dataset.user,sector_id=Number(tr.querySelector('.asm-sector')?.value||0);if(!uid||![1,2,3,4].includes(sector_id))return;
    const btn=tr.querySelector('.asm-save');if(btn){btn.disabled=true;btn.textContent='…'}setListMsg('Enregistrement…');
    try{
      const r=await client.from('profiles').update({sector_id,updated_at:new Date().toISOString()}).eq('user_id',uid).eq('role','seller');if(r.error)throw r.error;
      const s=sellers.find(x=>x.user_id===uid);if(s)s.sector_id=sector_id;setListMsg(`Affectation enregistrée : Secteur ${sector_id}.`,false,true);
    }catch(e){setListMsg('Erreur : '+(e?.message||e),true)}finally{if(btn){btn.disabled=false;btn.textContent='Enregistrer'}}
  }

  function setCreateMsg(text,error=false,ok=false){const el=document.getElementById('asmCreateMsg');if(!el)return;el.className='asm-msg '+(error?'asm-error':ok?'asm-ok':'');el.textContent=text||''}
  function setListMsg(text,error=false,ok=false){const el=document.getElementById('asmListMsg');if(!el)return;el.className='asm-msg '+(error?'asm-error':ok?'asm-ok':'');el.textContent=text||''}
  function boot(){const root=ensure();if(root){load();return true}return false}
  document.addEventListener('click',e=>{if(e.target?.closest?.('button[data-page="admin"]'))setTimeout(()=>load(true),120)});
  let tries=0;const t=setInterval(()=>{tries++;if(boot()||tries>120)clearInterval(t)},500);window.addEventListener('load',()=>setTimeout(boot,1200));
})();