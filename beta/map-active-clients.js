(()=>{
  const ACTIVE_CLIENTS={
    '19100':75,'19360':16,'19600':7,'19120':3,'19130':3,'19140':26,'19190':4,'19210':6,'19230':12,'19240':9,
    '19270':11,'19310':0,'19350':1,'19410':4,'19500':7,'19520':0,'19000':31,'19150':2,'19220':5,'19320':4,
    '19330':6,'19380':1,'19390':1,'19400':6,'19430':0,'19450':0,'19460':4,'19470':2,'19490':0,'19550':1,
    '19560':0,'19700':9,'19800':7,'19370':8,'19160':11,'19170':7,'19200':20,'19250':4,'19260':9,'19290':4,
    '19300':21,'19340':4,'19510':6,'19110':6
  };

  function countFor(cp){return Object.prototype.hasOwnProperty.call(ACTIVE_CLIENTS,String(cp))?Number(ACTIVE_CLIENTS[String(cp)]):null}
  function labelFor(cp){const n=countFor(cp);return n===null?`${cp} — donnée clients non renseignée`:`${cp} — ${n} client${n>1?'s':''} actif${n>1?'s':''}`}

  function addStyle(){
    if(document.getElementById('mapActiveClientsStyle'))return;
    const s=document.createElement('style');s.id='mapActiveClientsStyle';s.textContent=`
      #rexBetaMapAssign .map-ac-cps{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
      #rexBetaMapAssign .map-ac-cp{padding:7px 11px!important;border-radius:999px!important;background:#eef4ff!important;border:1px solid #bfd3f5!important;color:#0e2f68!important;font-size:12px!important}
      #rexBetaMapAssign .map-ac-cp:hover{background:#dfeaff!important}
      #rexBetaMapAssign .map-ac-count{margin-top:9px;padding:10px 12px;border-radius:10px;background:#0f172a;color:#fff;font-size:13px;display:none}
      #rexBetaMapAssign .map-ac-count strong{font-size:18px}
      #mapSectorActiveCount{display:none;margin:8px 0;padding:9px 11px;border-radius:10px;background:#0f172a;color:#fff;font-size:12px}
      #mapSectorActiveCount strong{font-size:17px}
    `;document.head.appendChild(s);
  }

  function enhanceAssignDialog(){
    const root=document.getElementById('rexBetaMapAssign'),sub=document.getElementById('rexAssignSub');
    if(!root||!sub)return;
    if(sub.querySelector('.map-ac-cp'))return;
    const text=sub.textContent||'';
    const cps=[...new Set(text.match(/\b19\d{3}\b/g)||[])];
    if(!cps.length)return;
    sub.innerHTML=`<div>Code${cps.length>1?'s':''} postal${cps.length>1?'aux':''} :</div><div class="map-ac-cps">${cps.map(cp=>`<button type="button" class="map-ac-cp" data-map-ac-cp="${cp}">${cp}</button>`).join('')}</div><div id="mapAcCount" class="map-ac-count"></div>`;
    sub.querySelectorAll('[data-map-ac-cp]').forEach(b=>b.onclick=e=>{
      e.preventDefault();e.stopPropagation();
      const cp=b.dataset.mapAcCp,n=countFor(cp),box=sub.querySelector('#mapAcCount');
      if(!box)return;
      box.style.display='block';
      box.innerHTML=n===null?`<b>${cp}</b><br>Donnée clients actifs non renseignée.`:`<b>${cp}</b><br><strong>${n}</strong> client${n>1?'s':''} actif${n>1?'s':''}`;
    });
  }

  function enhanceSectorChips(){
    const chips=document.getElementById('chips'),status=document.getElementById('companyStatus');
    if(!chips||!status)return;
    let box=document.getElementById('mapSectorActiveCount');
    if(!box){box=document.createElement('div');box.id='mapSectorActiveCount';status.parentNode.insertBefore(box,status)}
    chips.querySelectorAll('.chip[data-cp]').forEach(chip=>{
      if(chip.dataset.activeClientBound==='1')return;
      chip.dataset.activeClientBound='1';
      chip.addEventListener('click',()=>{
        const cp=chip.dataset.cp,n=countFor(cp);box.style.display='block';
        box.innerHTML=n===null?`<b>${cp}</b> — donnée clients actifs non renseignée`:`<b>${cp}</b> — <strong>${n}</strong> client${n>1?'s':''} actif${n>1?'s':''}`;
      },true);
    });
  }

  function refresh(){addStyle();enhanceAssignDialog();enhanceSectorChips()}
  const obs=new MutationObserver(()=>setTimeout(refresh,0));
  obs.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  let tries=0;const timer=setInterval(()=>{tries++;refresh();if(tries>120)clearInterval(timer)},250);
  window.addEventListener('load',()=>setTimeout(refresh,500));
})();
