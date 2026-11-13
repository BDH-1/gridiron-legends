const CACHE = "gl-2026-v3.8b";
const PRECACHE = ["./", "./index.html", "./app.js", "./manifest.json", "./icon-192.png", "./icon-512.png", "./icon-180.png", "./apple-touch-icon.png", "./favicon.png", "./icon-192-maskable.png", "./icon-512-maskable.png"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isDocument(req) {
  if (req.mode === "navigate") return true;
  const url = new URL(req.url);
  return url.pathname.endsWith("/") || url.pathname.endsWith("/index.html") || url.pathname.endsWith("index.html");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isDocument(req)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE);
          await cache.put("./index.html", fresh.clone());
        }
        return fresh;
      } catch {
        return (await caches.match("./index.html")) || (await caches.match(req)) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) await cache.put(req, fresh.clone());
      return fresh;
    } catch {
      const hit = await cache.match(req);
      if (hit) return hit;
      throw new Error("offline");
    }
  })());
});
