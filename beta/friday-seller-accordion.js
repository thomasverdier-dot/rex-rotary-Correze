/*
 * Point du vendredi : un accordéon par vendeur.
 * Ne recrée pas les fiches ni les formulaires : masque uniquement leur corps.
 */
(()=>{
  const ROOT_ID='fpCards';
  const STYLE_ID='rexFridaySellerAccordionStyle';
  let activeKey=null;
  let initialized=false;
  let watchedRoot=null;

  function sellerMode(){
    try{if(typeof profile!=='undefined'&&profile)return profile.role==='seller'}catch(e){}
    return document.body.classList.contains('seller');
  }

  function key(card,index){
    const manager=card.querySelector('.fp-manager[id^="fpm_"]');
    const activity=card.querySelector('.fp-form[id^="fp_"]');
    const action=card.querySelector('[data-fpa]');
    const checklist=card.querySelector('[data-fpc]');
    return manager?.id.slice(4)||activity?.id.slice(3)||action?.dataset.fpa||checklist?.dataset.fpc||'position-'+index;
  }

  function addStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #rexFridayPage #fpCards{grid-template-columns:minmax(0,1fr)!important}
      #rexFridayPage #fpCards .fp-seller{width:100%;max-width:none}
      #rexFridayPage #fpCards .fp-seller-head{
        cursor:pointer;flex-wrap:wrap;gap:10px;background:#fff;transition:background .15s ease
      }
      #rexFridayPage #fpCards .fp-seller-head:hover{background:#f7faff}
      #rexFridayPage #fpCards .fp-seller-head .fp-menu-toggle{
        margin-left:auto;border:1px solid #d8e3f0;border-radius:9px;
        background:#edf4ff;color:#10233f;font-weight:800;font-size:12px;
        padding:9px 12px;min-height:36px;white-space:nowrap;cursor:pointer
      }
      #rexFridayPage #fpCards .fp-seller-head .fp-menu-toggle:hover{background:#daeaff}
      #rexFridayPage #fpCards .fp-seller-head .fp-menu-toggle:focus-visible{
        outline:3px solid #60a5fa;outline-offset:2px
      }
      #rexFridayPage #fpCards .fp-seller.fp-collapsed>.fp-body{display:none!important}
      #rexFridayPage #fpCards .fp-seller.fp-collapsed .fp-seller-head{border-bottom:0}
      @media(max-width:560px){
        #rexFridayPage #fpCards .fp-seller-head .fp-menu-toggle{margin-left:0}
      }
    `;
    document.head.appendChild(style);
  }

  function cards(root){
    return Array.from(root.children).filter(el=>el.classList?.contains('fp-seller'));
  }

  function apply(root){
    const items=cards(root);
    if(!items.length)return;
    if(!initialized){
      initialized=true;
      activeKey=sellerMode()?key(items[0],0):null;
    }
    if(activeKey&&!items.some((card,i)=>key(card,i)===activeKey))activeKey=null;

    items.forEach((card,index)=>{
      const head=card.querySelector(':scope > .fp-seller-head');
      const body=card.querySelector(':scope > .fp-body');
      if(!head||!body)return;

      let toggle=head.querySelector('.fp-menu-toggle');
      if(!toggle){
        toggle=document.createElement('button');
        toggle.type='button';
        toggle.className='fp-menu-toggle';
        head.appendChild(toggle);
      }
      if(!body.id)body.id='rexFridayVendorBody'+index;
      const open=key(card,index)===activeKey;
      card.classList.toggle('fp-collapsed',!open);
      body.hidden=!open;
      toggle.setAttribute('aria-controls',body.id);
      toggle.setAttribute('aria-expanded',String(open));
      const name=card.querySelector('.fp-seller-head h3')?.textContent?.trim()||'ce vendeur';
      toggle.setAttribute('aria-label',(open?'Refermer':'Ouvrir')+' le point du vendredi de '+name);
      toggle.textContent=open?'Réduire ▲':'Ouvrir ▼';
    });
  }

  function listen(root){
    root.addEventListener('click',event=>{
      const head=event.target.closest?.('.fp-seller-head');
      if(!head||!root.contains(head))return;
      // Ne pas capter d'éventuels contrôles ajoutés ensuite dans l'en-tête.
      if(event.target.closest('a,input,select,textarea,button:not(.fp-menu-toggle)'))return;
      const card=head.closest('.fp-seller');
      if(!card)return;
      const items=cards(root),selected=key(card,items.indexOf(card));
      activeKey=activeKey===selected?null:selected;
      apply(root);
    });
    root.addEventListener('keydown',event=>{
      if(event.key!=='Escape')return;
      const card=event.target.closest?.('.fp-seller');
      if(!card||!root.contains(card))return;
      if(activeKey!==null){
        activeKey=null;
        apply(root);
        card.querySelector('.fp-menu-toggle')?.focus();
        event.preventDefault();
      }
    });
    new MutationObserver(()=>apply(root)).observe(root,{childList:true});
  }

  function mount(){
    const root=document.getElementById(ROOT_ID);
    if(!root)return false;
    addStyle();
    if(watchedRoot!==root){watchedRoot=root;initialized=false;activeKey=null;listen(root)}
    apply(root);
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{tries++;if(mount()||tries>160)clearInterval(timer)},250);
  window.addEventListener('load',()=>setTimeout(mount,500));
})();
