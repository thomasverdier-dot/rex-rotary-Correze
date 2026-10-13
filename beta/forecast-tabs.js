/* L'onglet Prévisions du menu principal ouvre uniquement le prévisionnel mensuel. */
(()=>{
  function monthly(){
    document.querySelectorAll('.rex-page').forEach(page=>page.classList.toggle('active',page.dataset.page==='monthly'));
    document.querySelectorAll('#rexShellV3 .rex-nav button').forEach(btn=>btn.classList.toggle('active',btn.dataset.page==='forecasts'));
    if(typeof window.loadMonthlyForecast==='function')setTimeout(()=>window.loadMonthlyForecast(),0);
  }
  function ensure(){
    const shell=document.getElementById('rexShellV3'),nav=shell?.querySelector('.rex-nav');
    if(!shell||!nav)return false;
    const month=nav.querySelector('[data-page="monthly"]'),week=nav.querySelector('[data-page="weekly"]');
    let group=nav.querySelector('[data-page="forecasts"]');
    if(!group){group=document.createElement('button');group.dataset.page='forecasts';nav.insertBefore(group,week||month||nav.querySelector('[data-page="admin"]')||null)}
    group.textContent='📈 Prévisionnel mois';group.onclick=monthly;
    week?.remove();month?.remove();
    document.querySelectorAll('.rex-page[data-page="weekly"] .forecast-tabs,.rex-page[data-page="monthly"] .forecast-tabs').forEach(x=>x.remove());
    return true;
  }
  let tries=0;const timer=setInterval(()=>{tries++;if(ensure()||tries>160)clearInterval(timer)},250);
  window.addEventListener('load',()=>setTimeout(ensure,700));
})();
