(()=>{
  function goFriday(){
    document.querySelectorAll('.rex-page').forEach(p=>p.classList.toggle('active',p.dataset.page==='friday'));
    document.querySelectorAll('.rex-nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='friday'));
    if(typeof window.loadFridayPoint==='function')window.loadFridayPoint();
    else document.getElementById('rexFridayPage')?.scrollIntoView({block:'start'});
  }
  function ensure(){
    const nav=document.querySelector('#rexShellV3 .rex-nav');
    if(!nav)return false;
    let btn=nav.querySelector('[data-page="friday"]');
    if(!btn){
      btn=document.createElement('button');
      btn.dataset.page='friday';
      btn.innerHTML='📊 Point vendredi';
      const improvements=nav.querySelector('[data-page="tickets"]')||document.getElementById('ticketNavBtn');
      if(improvements&&improvements.parentElement===nav)nav.insertBefore(btn,improvements);else nav.appendChild(btn);
    }
    btn.onclick=goFriday;
    return true;
  }
  let tries=0;const t=setInterval(()=>{tries++;if(ensure()||tries>120)clearInterval(t)},250);
  setInterval(ensure,2500);
  window.addEventListener('load',()=>setTimeout(ensure,1200));
})();