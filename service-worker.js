const APP_CACHE = "rex-correze-app-v3";
const DATA_CACHE = "rex-correze-data-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./admin-seller.js"
];

self.addEventListener("install", event=>{
  event.waitUntil(caches.open(APP_CACHE).then(cache=>cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>![APP_CACHE,DATA_CACHE].includes(k)).map(k=>caches.delete(k))
    ))
  );
  self.clients.claim();
});

async function injectAdminModule(response){
  try{
    const type=response.headers.get('content-type')||'';
    if(!type.includes('text/html')) return response;
    let html=await response.text();
    if(!html.includes('admin-seller.js')) html=html.replace('</body>','<script src="./admin-seller.js"></script></body>');
    const headers=new Headers(response.headers);
    headers.delete('content-length');
    return new Response(html,{status:response.status,statusText:response.statusText,headers});
  }catch(e){return response;}
}

self.addEventListener("fetch", event=>{
  const req = event.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  const isDataApi = url.hostname === "geo.api.gouv.fr" || url.hostname === "recherche-entreprises.api.gouv.fr";

  if(isDataApi){
    event.respondWith(
      fetch(req).then(res=>{
        const copy=res.clone();
        caches.open(DATA_CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});
        return res;
      }).catch(async()=>{
        const cached=await caches.match(req);
        if(cached) return cached;
        throw new Error("offline");
      })
    );
    return;
  }

  if(req.mode==='navigate' && url.origin===self.location.origin){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(req,{cache:'no-store'});
        const copy=fresh.clone();
        caches.open(APP_CACHE).then(c=>c.put('./index.html',copy)).catch(()=>{});
        return injectAdminModule(fresh);
      }catch(e){
        const cached=await caches.match('./index.html') || await caches.match(req);
        return cached ? injectAdminModule(cached) : Response.error();
      }
    })());
    return;
  }

  if(url.origin===self.location.origin){
    event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{
      const copy=res.clone();
      caches.open(APP_CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});
      return res;
    })));
  }
});