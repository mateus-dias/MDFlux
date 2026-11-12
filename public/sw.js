// Only static branding is cached. No API responses, documents, sessions or tenant data.
const CACHE='mdflux-brand-v3';
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/brand/md-flux.png','/icon-192.png','/icon-512.png'])))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('mdflux-brand-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method==='GET'&&u.origin===self.location.origin&&['/brand/md-flux.png','/icon-192.png','/icon-512.png'].includes(u.pathname))e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});
