/* Menu Prospection de la version beta : rassemble Carte, prospection physique et téléphonique sans modifier leurs pages. */
(()=>{
  const NAV='#rexShellV3 .rex-nav';
  const ID='rexProspectionMenu';

  function addStyle(){
    if(document.getElementById('rexProspectionMenuStyle'))return;
    const style=document.createElement('style');
    style.id='rexProspectionMenuStyle';
    style.textContent=`
      .rex-nav .rex-prospection-menu{display:flex;flex-direction:column;gap:3px;min-width:0}
      .rex-nav .rex-prospection-toggle{width:100%;justify-content:space-between;gap:8px}
      .rex-prospection-toggle .rex-prospection-arrow{margin-left:auto;font-size:12px;transition:transform .15s ease}
      .rex-prospection-menu.open .rex-prospection-arrow{transform:rotate(180deg)}
      .rex-nav .rex-prospection-menu.current>.rex-prospection-toggle{background:rgba(255,255,255,.12);color:#fff}
      .rex-nav .rex-prospection-submenu{display:none;flex-direction:column;gap:3px;margin-left:19px;padding-left:9px;border-left:1px solid rgba(255,255,255,.2)}
      .rex-nav .rex-prospection-menu.open .rex-prospection-submenu{display:flex}
      .rex-nav .rex-prospection-submenu button{width:100%;padding:10px 9px;font-size:12px;line-height:1.35;white-space:normal}
      @media(max-width:1050px){.rex-nav .rex-prospection-menu{flex:0 0 auto}.rex-nav .rex-prospection-submenu{min-width:200px}}
    `;
    document.head.appendChild(style);
  }

  function mount(){
    const nav=document.querySelector(NAV);
    if(!nav)return false;
    if(document.getElementById(ID))return true;
    const map=nav.querySelector('button[data-page="map"]');
    const physical=nav.querySelector('#physicalProspectionNav');
    const phone=nav.querySelector('button[data-page="phoning"]');
    if(!map||!physical||!phone||map.parentElement!==nav||physical.parentElement!==nav||phone.parentElement!==nav)return false;

    addStyle();
    const group=document.createElement('div');
    group.id=ID;
    group.className='rex-prospection-menu';
    const toggle=document.createElement('button');
    toggle.type='button';
    toggle.className='rex-prospection-toggle';
    toggle.innerHTML='<span>🎯 Prospection</span><span class="rex-prospection-arrow" aria-hidden="true">⌄</span>';
    toggle.setAttribute('aria-controls','rexProspectionSubmenu');
    toggle.setAttribute('aria-expanded','false');
    const submenu=document.createElement('div');
    submenu.id='rexProspectionSubmenu';
    submenu.className='rex-prospection-submenu';
    group.append(toggle,submenu);
    nav.insertBefore(group,physical);

    // Les vrais boutons et leurs événements sont conservés : aucune modification du métier.
    submenu.append(map,physical,phone);
    map.textContent='🗺️ Carte';
    physical.textContent='🚶 Prospection physique';
    phone.textContent='☎ Prospection téléphonique';

    function setOpen(open){
      group.classList.toggle('open',open);
      toggle.setAttribute('aria-expanded',String(open));
    }
    function sync(){
      const selected=map.classList.contains('active')||physical.classList.contains('active')||phone.classList.contains('active');
      group.classList.toggle('current',selected);
    }
    toggle.addEventListener('click',()=>setOpen(!group.classList.contains('open')));
    nav.addEventListener('click',event=>{
      if(group.contains(event.target))return;
      if(event.target.closest('button'))setOpen(false);
    },true);
    group.addEventListener('keydown',event=>{
      if(event.key==='Escape'){setOpen(false);toggle.focus();}
    });
    const watcher=new MutationObserver(sync);
    watcher.observe(map,{attributes:true,attributeFilter:['class']});
    watcher.observe(physical,{attributes:true,attributeFilter:['class']});
    watcher.observe(phone,{attributes:true,attributeFilter:['class']});
    sync();
    if(group.classList.contains('current'))setOpen(true);
    return true;
  }

  let attempts=0;
  const interval=setInterval(()=>{attempts++;if(mount()||attempts>=160)clearInterval(interval)},250);
  window.addEventListener('load',()=>setTimeout(mount,300));
})();
