const CACHE_NAME = "blog-pwa-v1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./login.html",
  "./signup.html",
  "./account.html",
  "./my-blog.html",
  "./materials.html",
  "./trash.html",
  "./materials-trash.html",
  "./editor.html",
  "./viewer.html",
  "./styles.css",
  "./session.js",
  "./auth.js",
  "./app.js",
  "./account.js",
  "./my-blog.js",
  "./materials.js",
  "./trash.js",
  "./materials-trash.js",
  "./editor.js",
  "./viewer.js",
  "./manifest.webmanifest",
  "./app-icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fresh = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || fresh;
    })
  );
});
