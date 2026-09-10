(()=>{
  function getProfile(){
    try{ if(typeof currentProfile!=='undefined' && currentProfile) return currentProfile; }catch(e){}
    try{ if(typeof profile!=='undefined' && profile) return profile; }catch(e){}
    return null;
  }
  function getClient(){ try{ if(typeof sb!=='undefined' && sb) return sb; }catch(e){} return null; }
  function mount(){
    if(document.getElementById('rexSellerAdmin')) return;
    const p=getProfile();
    if(!p || p.role!=='admin') return;
    const panel=document.querySelector('.panel');
    if(!panel) return;
    const userBar=document.getElementById('userbar')||document.getElementById('userBar');
    const box=document.createElement('div');
    box.id='rexSellerAdmin';
    box.innerHTML=`
      <style>
        #rexSellerAdmin{border:1px solid #cfe0f7;background:#f7fbff;border-radius:12px;padding:10px;margin:0 0 10px}
        #rexSellerAdmin button,#rexSellerAdmin input,#rexSellerAdmin select{font:inherit}
        #rexSellerAdmin .rex-add{width:100%;background:#17355f;color:#fff;border:1px solid #17355f;border-radius:9px;padding:10px;font-weight:800;cursor:pointer}
        #rexSellerAdmin .rex-form{display:block;margin-top:9px}
        #rexSellerAdmin .rex-form.closed{display:none}
        #rexSellerAdmin input,#rexSellerAdmin select{width:100%;border:1px solid #ccd5df;border-radius:8px;padding:9px;margin-top:7px;background:#fff}
        #rexSellerAdmin .rex-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}
        #rexSellerAdmin .rex-create{width:100%;margin-top:8px;background:#0f6b47;color:#fff;border:1px solid #0f6b47;border-radius:9px;padding:10px;font-weight:800;cursor:pointer}
        #rexSellerAdmin .rex-msg{font-size:11px;line-height:1.4;margin-top:7px;min-height:16px}.rex-ok{color:#16794b}.rex-error{color:#b42318}
      </style>
      <button type="button" class="rex-add" id="rexToggleSeller">＋ Ajouter un vendeur</button>
      <div class="rex-form" id="rexSellerForm">
        <input id="rexSellerName" type="text" placeholder="Nom du vendeur">
        <input id="rexSellerEmail" type="email" placeholder="Adresse e-mail">
        <div class="rex-grid">
          <input id="rexSellerPassword" type="password" placeholder="Mot de passe temporaire">
          <select id="rexSellerSector"><option value="">Choisir le secteur</option><option value="1">Secteur 1</option><option value="2">Secteur 2</option><option value="3">Secteur 3</option><option value="4">Secteur 4</option></select>
        </div>
        <button type="button" class="rex-create" id="rexCreateSeller">Créer et attribuer le secteur</button>
        <div class="rex-msg" id="rexSellerMsg"></div>
      </div>`;
    if(userBar && userBar.parentNode===panel) panel.insertBefore(box,userBar.nextSibling); else panel.insertBefore(box,panel.firstChild);
    const form=box.querySelector('#rexSellerForm');
    const toggle=box.querySelector('#rexToggleSeller');
    toggle.addEventListener('click',(e)=>{e.preventDefault();e.stopPropagation();form.classList.toggle('closed');});
    const msg=box.querySelector('#rexSellerMsg'),btn=box.querySelector('#rexCreateSeller');
    btn.addEventListener('click',async(e)=>{
      e.preventDefault();e.stopPropagation();
      const display_name=box.querySelector('#rexSellerName').value.trim();
      const email=box.querySelector('#rexSellerEmail').value.trim();
      const password=box.querySelector('#rexSellerPassword').value;
      const sector_id=Number(box.querySelector('#rexSellerSector').value);
      if(!display_name||!email||password.length<8||![1,2,3,4].includes(sector_id)){
        msg.className='rex-msg rex-error';msg.textContent='Renseigne le nom, l’e-mail, un mot de passe de 8 caractères minimum et le secteur.';return;
      }
      const client=getClient();
      if(!client){msg.className='rex-msg rex-error';msg.textContent='Connexion Supabase indisponible.';return;}
      btn.disabled=true;msg.className='rex-msg';msg.textContent='Création du vendeur…';
      try{
        const {data,error}=await client.functions.invoke('admin-create-seller',{body:{display_name,email,password,sector_id}});
        if(error) throw error;if(data?.error) throw new Error(data.error);
        msg.className='rex-msg rex-ok';msg.textContent='✓ '+display_name+' créé — Secteur '+sector_id+'.';
        box.querySelector('#rexSellerName').value='';box.querySelector('#rexSellerEmail').value='';box.querySelector('#rexSellerPassword').value='';box.querySelector('#rexSellerSector').value='';
      }catch(e){msg.className='rex-msg rex-error';msg.textContent=e?.message||'Impossible de créer le vendeur.';}finally{btn.disabled=false;}
    });
  }
  let tries=0;const timer=setInterval(()=>{tries++;mount();if(document.getElementById('rexSellerAdmin')||tries>80)clearInterval(timer)},250);
  window.addEventListener('load',mount);
})();