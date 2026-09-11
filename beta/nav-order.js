(()=>{
  function addStyle(){
    if(document.getElementById('betaNavOrderStyle'))return;
    const s=document.createElement('style');s.id='betaNavOrderStyle';s.textContent=`
      @media(min-width:1051px){
        .rex-side .rex-nav{flex:1}
        .rex-side .rex-nav #ticketNavBtn{margin-top:auto!important;border-top:1px solid rgba(255,255,255,.14);padding-top:16px}
      }
      @media(max-width:1050px){.rex-side .rex-nav #ticketNavBtn{margin-top:0!important}}
    `;document.head.appendChild(s)
  }
  let busy=false;
  function placeLast(){
    const nav=document.querySelector('#rexShellV3 .rex-nav'),btn=document.getElementById('ticketNavBtn');
    if(!nav||!btn)return false;
    addStyle();
    if(nav.lastElementChild!==btn){busy=true;nav.appendChild(btn);busy=false}
    return true
  }
  let obs=null,tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(placeLast()){
      const nav=document.querySelector('#rexShellV3 .rex-nav');
      if(nav&&!obs){obs=new MutationObserver(()=>{if(!busy)setTimeout(placeLast,0)});obs.observe(nav,{childList:true})}
      if(tries>40)clearInterval(timer)
    }
    if(tries>120)clearInterval(timer)
  },250);
  window.addEventListener('load',()=>setTimeout(placeLast,1500));
})();