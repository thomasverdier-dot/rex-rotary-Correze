const APP_CACHE = "rex-correze-app-v12";
const DATA_CACHE = "rex-correze-data-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./admin-seller.js",
  "./weekly-forecast.js",
  "./ui-v3.js",
  "./map-companies.js",
  "./prospection.js",
  "./tickets.js"
];

self.addEventListener("install", event=>{
  event.waitUntil(caches.open(APP_CACHE).then(cache=>cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(k=>![APP_CACHE,DATA_CACHE].includes(k)).map(k=>caches.delete(k))
  )));
  self.clients.claim();
});

async function injectModules(response){
  try{
    const type=response.headers.get('content-type')||'';
    if(!type.includes('text/html')) return response;
    let html=await response.text();
    const tags=[];
    if(!html.includes('admin-seller.js')) tags.push('<script src="./admin-seller.js?v=9"></script>');
    if(!html.includes('weekly-forecast.js')) tags.push('<script src="./weekly-forecast.js?v=3"></script>');
    if(!html.includes('ui-v3.js')) tags.push('<script src="./ui-v3.js?v=1"></script>');
    if(!html.includes('map-companies.js')) tags.push('<script src="./map-companies.js?v=2"></script>');
    if(!html.includes('prospection.js')) tags.push('<script src="./prospection.js?v=1"></script>');
    if(!html.includes('tickets.js')) tags.push('<script src="./tickets.js?v=1"></script>');
    if(tags.length) html=html.replace('</body>',tags.join('')+'</body>');
    const headers=new Headers(response.headers);
    headers.delete('content-length');
    return new Response(html,{status:response.status,statusText:response.statusText,headers});
  }catch(e){return response;}
}

self.addEventListener("fetch", event=>{
  const req=event.request;
  if(req.method!=="GET") return;
  const url=new URL(req.url);
  const isDataApi=url.hostname==="geo.api.gouv.fr"||url.hostname==="recherche-entreprises.api.gouv.fr";
  if(isDataApi){
    event.respondWith(fetch(req).then(res=>{
      const copy=res.clone();caches.open(DATA_CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});return res;
    }).catch(async()=>{const cached=await caches.match(req);if(cached)return cached;throw new Error("offline");}));
    return;
  }
  if(req.mode==='navigate'&&url.origin===self.location.origin){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(req,{cache:'no-store'});
        const copy=fresh.clone();caches.open(APP_CACHE).then(c=>c.put('./index.html',copy)).catch(()=>{});
        return injectModules(fresh);
      }catch(e){
        const cached=await caches.match('./index.html')||await caches.match(req);
        return cached?injectModules(cached):Response.error();
      }
    })());
    return;
  }
  if(url.origin===self.location.origin){
    event.respondWith(fetch(req,{cache:'no-store'}).then(res=>{
      const copy=res.clone();caches.open(APP_CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});return res;
    }).catch(()=>caches.match(req)));
  }
});