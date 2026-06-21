/* Bettery service worker — app-shell cache for offline use */
const CACHE = "bettery-v1.4.7";
const ASSETS = [
  ".",
  "index.html",
  "css/style.css",
  "js/exercises.js",
  "js/app.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "img/exercises/standard/top.jpg", "img/exercises/standard/bottom.jpg",
  "img/exercises/incline/top.jpg",  "img/exercises/incline/bottom.jpg",
  "img/exercises/decline/top.jpg",  "img/exercises/decline/bottom.jpg",
  "img/exercises/wide/top.jpg",     "img/exercises/wide/bottom.jpg",
  "img/exercises/diamond/top.jpg",  "img/exercises/diamond/bottom.jpg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  // stream video straight from the network — never cache partial / range responses
  if (req.headers.has("range") || /\.(mp4|webm|mov)(\?|$)/i.test(req.url)) return;
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        // cache same-origin successful responses for next time
        if (res.ok && new URL(req.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match("index.html"));
    })
  );
});

/* tapping a notification focuses/opens the app */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then(list => {
      for (const c of list) { if ("focus" in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow(".");
    })
  );
});
