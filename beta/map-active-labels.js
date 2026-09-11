(()=>{
  const ACTIVE_CLIENTS={
    '19100':75,'19360':16,'19600':7,'19120':3,'19130':3,'19140':26,'19190':4,'19210':6,'19230':12,'19240':9,
    '19270':11,'19310':0,'19350':1,'19410':4,'19500':7,'19520':0,'19000':31,'19150':2,'19220':5,'19320':4,
    '19330':6,'19380':1,'19390':1,'19400':6,'19430':0,'19450':0,'19460':4,'19470':2,'19490':0,'19550':1,
    '19560':0,'19700':9,'19800':7,'19370':8,'19160':11,'19170':7,'19200':20,'19250':4,'19260':9,'19290':4,
    '19300':21,'19340':4,'19510':6,'19110':6
  };
  const NS='http://www.w3.org/2000/svg';

  function countFor(cp){return Object.prototype.hasOwnProperty.call(ACTIVE_CLIENTS,String(cp))?Number(ACTIVE_CLIENTS[String(cp)]):null}
  function own(cp){try{return typeof ownCp==='function'?ownCp(String(cp)):true}catch(e){return true}}

  function style(){
    if(document.getElementById('rexMapActiveLabelsStyle'))return;
    const s=document.createElement('style');s.id='rexMapActiveLabelsStyle';s.textContent=`
      #mapSvg .rex-ac-map-label{font-size:7.4px;font-weight:900;fill:#10233f;text-anchor:middle;paint-order:stroke;stroke:#fff;stroke-width:2.8px;stroke-linejoin:round;pointer-events:none}
      #mapSvg .rex-ac-map-dot{fill:#fff;stroke:#10233f;stroke-width:.7px;vector-effect:non-scaling-stroke;pointer-events:none}
      #rexSelectedActiveClients{margin-top:8px;padding:8px 10px;border-radius:9px;background:#0f172a;color:#fff;font-weight:800}
      #rexSelectedActiveClients strong{font-size:17px}
    `;document.head.appendChild(s);
  }

  function cpCenter(cp,P){
    try{
      const fs=(groups?.[String(cp)]||[]);if(!fs.length)return null;
      let sx=0,sy=0,n=0;
      for(const f of fs){const c=centroid(f),p=P(c);if(!p||!Number.isFinite(p[0])||!Number.isFinite(p[1]))continue;sx+=p[0];sy+=p[1];n++}
      return n?[sx/n,sy/n]:null;
    }catch(e){return null}
  }

  function draw(){
    try{
      style();
      if(typeof mapSvg==='undefined'||!mapSvg||typeof geo==='undefined'||!geo?.features?.length||typeof groups==='undefined')return false;
      if(mapSvg.querySelector('#rexActiveClientLabels'))return true;
      const P=project(bounds(geo.features));
      const layer=document.createElementNS(NS,'g');layer.id='rexActiveClientLabels';layer.setAttribute('pointer-events','none');
      for(const [cp,n] of Object.entries(ACTIVE_CLIENTS)){
        if(!own(cp))continue;
        const c=cpCenter(cp,P);if(!c)continue;
        const g=document.createElementNS(NS,'g');g.setAttribute('class','rex-ac-map-item');g.setAttribute('transform',`translate(${c[0].toFixed(1)} ${(c[1]+11).toFixed(1)})`);
        const dot=document.createElementNS(NS,'circle');dot.setAttribute('class','rex-ac-map-dot');dot.setAttribute('r','3.4');dot.setAttribute('cy','-2.1');
        const tiny=document.createElementNS(NS,'text');tiny.setAttribute('class','rex-ac-map-label');tiny.setAttribute('y','0.4');tiny.textContent=String(n);
        const cpText=document.createElementNS(NS,'text');cpText.setAttribute('class','rex-ac-map-label');cpText.setAttribute('y','7.8');cpText.textContent=cp;
        g.append(dot,tiny,cpText);layer.appendChild(g);
      }
      mapSvg.appendChild(layer);return true;
    }catch(e){return false}
  }

  function updateSelected(){
    try{
      if(typeof selected==='undefined'||!selected)return;
      const cp=String(selected),box=document.getElementById('selected');if(!box)return;
      const n=countFor(cp);let badge=document.getElementById('rexSelectedActiveClients');
      if(!badge){badge=document.createElement('div');badge.id='rexSelectedActiveClients';box.appendChild(badge)}
      badge.innerHTML=n===null?`Clients actifs : donnée non renseignée`:`Clients actifs : <strong>${n}</strong>`;
    }catch(e){}
  }

  let lastSelected='';
  function refresh(){
    draw();
    try{const cp=typeof selected!=='undefined'&&selected?String(selected):'';if(cp&&cp!==lastSelected){lastSelected=cp;setTimeout(updateSelected,0)}else if(cp&&!document.getElementById('rexSelectedActiveClients'))updateSelected()}catch(e){}
  }

  let tries=0;const boot=setInterval(()=>{tries++;refresh();if(tries>120)clearInterval(boot)},250);
  setInterval(refresh,850);
  window.addEventListener('load',()=>setTimeout(refresh,700));
})();
