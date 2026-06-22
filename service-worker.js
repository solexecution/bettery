/* Bettery service worker — app-shell cache for offline use */
const CACHE = "bettery-v1.6.2";
const ASSETS = [
  ".",
  "index.html",
  "css/style.css",
  "js/exercises.js",
  "js/app.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "img/clips/pushup.mp4",
  "img/exercises/standard/top.jpg", "img/exercises/standard/bottom.jpg",
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
  // video: serve from cache (with byte-range support) so the form clip plays offline
  if (/\.(mp4|webm|mov)(\?|$)/i.test(req.url)) {
    e.respondWith(serveVideo(req));
    return;
  }
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

/* Serve a (possibly range-requested) video from the cache. The clip is precached on install;
   if it isn't there yet we fetch the full file once, store it, then answer range requests by
   slicing the cached bytes into a 206 — that's what makes it work offline. */
async function serveVideo(req) {
  const cache = await caches.open(CACHE);
  let full = await cache.match(req.url, { ignoreSearch: true });
  if (!full) {
    try {
      const res = await fetch(req.url);                 // plain GET (no range) → full 200
      if (res.ok && res.status === 200) { cache.put(req.url, res.clone()); full = res; }
      else return fetch(req);                            // fall back to the network response
    } catch (_) {
      return new Response("", { status: 504 });          // offline and not cached
    }
  }

  const range = req.headers.get("range");
  if (!range) return full;

  const buf = await full.clone().arrayBuffer();
  const size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  let start = m && m[1] ? parseInt(m[1], 10) : 0;
  let end   = m && m[2] ? parseInt(m[2], 10) : size - 1;
  if (isNaN(start) || start < 0) start = 0;
  if (isNaN(end) || end >= size) end = size - 1;
  if (start > end) { start = 0; end = size - 1; }
  const chunk = buf.slice(start, end + 1);
  return new Response(chunk, {
    status: 206,
    headers: {
      "Content-Type": full.headers.get("Content-Type") || "video/mp4",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": String(chunk.byteLength)
    }
  });
}

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
