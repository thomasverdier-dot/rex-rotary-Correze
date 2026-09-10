
const APP_CACHE = "rex-correze-app-v1";
const DATA_CACHE = "rex-correze-data-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
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

self.addEventListener("fetch", event=>{
  const req = event.request;
  if(req.method !== "GET") return;

  const url = new URL(req.url);

  const isDataApi =
    url.hostname === "geo.api.gouv.fr" ||
    url.hostname === "recherche-entreprises.api.gouv.fr";

  if(isDataApi){
    event.respondWith(
      fetch(req).then(res=>{
        const copy = res.clone();
        caches.open(DATA_CACHE).then(cache=>cache.put(req, copy)).catch(()=>{});
        return res;
      }).catch(async ()=>{
        const cached = await caches.match(req);
        if(cached) return cached;
        throw new Error("offline");
      })
    );
    return;
  }

  if(url.origin === self.location.origin){
    event.respondWith(
      caches.match(req).then(cached=>{
        if(cached) return cached;
        return fetch(req).then(res=>{
          const copy = res.clone();
          caches.open(APP_CACHE).then(cache=>cache.put(req, copy)).catch(()=>{});
          return res;
        });
      })
    );
  }
});
