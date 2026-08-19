const CACHE = "safelight-shell-v2026-08-19-62";
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./css/local-fonts.css",
  "./css/navigation.css",
  "./css/visual-polish.css",
  "./css/theme-settings.css",
  "./css/theme-light-polish.css",
  "./css/theme-transition.css",
  "./css/app-shell.css",
  "./css/live-editor.css",
  "./css/direct-manipulation.css",
  "./css/editor-polish.css",
  "./css/favicon-tools.css",
  "./css/adjust-tools.css",
  "./css/canvas-tools.css",
  "./css/crop-tools.css",
  "./css/background-removal.css",
  "./css/apply-tools.css",
  "./css/inspector-motion.css",
  "./css/scrollbars.css",
  "./css/annotation-tools.css",
  "./css/ui-motion.css",
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
  "./js/theme-settings.js",
  "./js/theme-transition.js",
  "./js/visual-polish.js",
  "./js/advanced.js",
  "./js/ui-shell.js",
  "./js/background-removal.js",
  "./js/background-removal-shell.js",
  "./js/inspector-motion.js",
  "./js/ui-motion.js",
  "./js/custom-scrollbars.js",
  "./js/source-cleanup.js",
  "./js/live-editor.js",
  "./js/preview-render-guard.js",
  "./js/crop-tools.js",
  "./js/adjust-tools.js",
  "./js/canvas-tools.js",
  "./js/annotation-tools.js",
  "./js/annotation-ui.js",
  "./js/favicon-tools.js",
  "./js/favicon-background.js",
  "./js/direct-manipulation.js",
  "./js/editor-polish.js",
  "./js/apply-tools.js",
  "./js/metadata-tools.js",
  "./js/privacy-effects.js",
  "./js/palette-tools.js",
  "./js/pwa.js",
  "./assets/images/favicon-16x16.png",
  "./assets/images/favicon-32x32.png",
  "./assets/images/favicon-48x48.png",
  "./assets/images/favicon-64x64.png",
  "./assets/images/favicon-128x128.png",
  "./assets/images/android-chrome-192x192.png",
  "./assets/images/android-chrome-512x512.png",
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