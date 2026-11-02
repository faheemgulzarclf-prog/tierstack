/* TierStack offline cache: the app shell works without internet; fresh copy is fetched when online. */
const CACHE="tierstack-v1";
const SHELL=["./","./index.html","./vendor/supabase.js","./manifest.json","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install",e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())); });
self.addEventListener("activate",e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==location.origin) return; // sign-in and data calls go straight to the network
  if(/\.(mp4|jpg)$/.test(u.pathname)) return; // films are too big to keep offline
  e.respondWith(fetch(e.request).then(r=>{ if(r.ok){ const c=r.clone(); caches.open(CACHE).then(x=>x.put(e.request,c)); } return r; })
    .catch(()=>caches.match(e.request).then(m=>m||caches.match("./index.html"))));
});
