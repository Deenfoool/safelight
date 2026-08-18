const CACHE = "safelight-shell-v2026-08-18-24";
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./css/local-fonts.css",
  "./css/navigation.css",
  "./css/visual-polish.css",
  "./css/app-shell.css",
  "./css/live-editor.css",
  "./css/direct-manipulation.css",
  "./css/editor-polish.css",
  "./css/favicon-tools.css",
  "./css/adjust-tools.css",
  "./css/canvas-tools.css",
  "./css/crop-tools.css",
  "./css/metadata-tools.css",
  "./css/privacy-effects.css",
  "./css/palette-tools.css",
  "./css/pwa.css",
  "./vendor/jszip.min.js",
  "./vendor/pdf.min.js",
  "./vendor/jspdf.umd.min.js",
  "./vendor/elheif/elheif-wasm.js",
  "./js/app.js",
  "./js/heic-support.js",
  "./js/heic-codec-worker.js",
  "./js/navigation.js",
  "./js/visual-polish.js",
  "./js/advanced.js",
  "./js/ui-shell.js",
  "./js/source-cleanup.js",
  "./js/live-editor.js",
  "./js/crop-tools.js",
  "./js/adjust-tools.js",
  "./js/canvas-tools.js",
  "./js/favicon-tools.js",
  "./js/favicon-background.js",
  "./js/direct-manipulation.js",
  "./js/editor-polish.js",
  "./js/metadata-tools.js",
  "./js/privacy-effects.js",
  "./js/palette-tools.js",
  "./js/pwa.js",
  "./assets/images/favicon-16.png",
  "./assets/images/favicon-32.png",
  "./assets/images/favicon-180.png",
  "./assets/images/favicon-192.png",
  "./assets/images/favicon-512.png",
  "./assets/images/logo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.allSettled(CORE.map((url) => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function cacheable(response) {
  return response && response.ok;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-cache" })
        .then((response) => {
          if (cacheable(response)) caches.open(CACHE).then((cache) => cache.put("./index.html", response.clone()));
          return response;
        })
        .catch(async () => (await caches.match("./index.html")) || (await caches.match("./")))
    );
    return;
  }

  const isCode = request.destination === "script" || request.destination === "style" || /\.(?:js|css)$/i.test(url.pathname);
  if (isCode) {
    event.respondWith(
      fetch(request, { cache: "no-cache" })
        .then((response) => {
          if (cacheable(response)) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(url.pathname.replace(self.location.pathname, "./"))))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (cacheable(response)) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});