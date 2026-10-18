// Jarvis service worker: caches the app shell. API calls (cross-origin Worker) are never cached.
const CACHE="jarvis-v3";
const SHELL=["./","index.html","style.css?v=3","app.js?v=3","manifest.json?v=3","apple-touch-icon.png?v=3","favicon.png?v=3","icons/icon-180.png","icons/icon-192.png","icons/icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{
  const req=e.request;const url=new URL(req.url);
  if(req.method!=="GET"||url.origin!==location.origin)return;
  if(req.mode==="navigate"){ // network first for the page, cached shell offline
    e.respondWith(fetch(req).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put("index.html",c));return r;}).catch(()=>caches.match("index.html")));
    return;
  }
  e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(req,c));}return r;})));
});
