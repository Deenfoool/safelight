(function () {
  "use strict";
  if (window.safelightPwaLoaded) return;
  window.safelightPwaLoaded = true;

  let deferredPrompt = null;

  function installManifest() {
    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.href = "manifest.webmanifest?v=2";

    const metas = [
      ["apple-mobile-web-app-capable", "yes"],
      ["apple-mobile-web-app-status-bar-style", "black-translucent"],
      ["apple-mobile-web-app-title", "Safelight"]
    ];
    metas.forEach(([name, content]) => {
      if (document.querySelector('meta[name="' + name + '"]')) return;
      const meta = document.createElement("meta");
      meta.name = name;
      meta.content = content;
      document.head.appendChild(meta);
    });
  }

  function installCustomScrollbars() {
    const current = [...document.querySelectorAll('link[rel="stylesheet"]')].find((link) => /css\/scrollbars\.css(?:\?|$)/.test(link.getAttribute("href") || ""));
    if (current) current.href = "css/scrollbars.css?v=3";
    else {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "css/scrollbars.css?v=3";
      document.head.appendChild(link);
    }

    if (window.safelightCustomScrollbarsLoaded || document.querySelector('script[src*="custom-scrollbars.js"]')) return;
    const script = document.createElement("script");
    script.src = "js/custom-scrollbars.js?v=1";
    script.defer = true;
    document.body.appendChild(script);
  }

  function installSliceSelectionExtension() {
    if (!document.querySelector('link[href*="slice-selection.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "css/slice-selection.css?v=1";
      document.head.appendChild(link);
    }
    if (window.safelightSliceSelectionLoaded || document.querySelector('script[src*="slice-selection.js"]')) return;
    const script = document.createElement("script");
    script.src = "js/slice-selection.js?v=1";
    script.defer = true;
    document.body.appendChild(script);
  }

  function standalone() {
    return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
  }

  function ensureInstallUi() {
    if (standalone()) return null;
    const privacy = document.querySelector(".sl-privacy");
    if (!privacy) return null;
    let button = document.getElementById("sl-pwa-install");
    if (button) return button;

    button = document.createElement("button");
    button.type = "button";
    button.id = "sl-pwa-install";
    button.className = "sl-pwa-install";
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10m0 0-4-4m4 4 4-4M5 17v2h14v-2"/></svg><span>Установить Safelight</span>';
    const status = document.createElement("div");
    status.id = "sl-pwa-status";
    status.className = "sl-pwa-status";
    privacy.append(button, status);

    button.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      button.disabled = true;
      deferredPrompt.prompt();
      try {
        const choice = await deferredPrompt.userChoice;
        if (choice?.outcome === "accepted") {
          status.textContent = "Safelight устанавливается как приложение.";
          status.classList.add("show");
        }
      } catch (_) {}
      deferredPrompt = null;
      button.classList.remove("show");
      button.disabled = false;
    });
    return button;
  }

  installManifest();
  installCustomScrollbars();

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    const button = ensureInstallUi();
    if (button) button.classList.add("show");
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    document.getElementById("sl-pwa-install")?.classList.remove("show");
    const status = document.getElementById("sl-pwa-status");
    if (status) {
      status.textContent = "Safelight установлен.";
      status.classList.add("show");
    }
  });

  function watchShell() {
    if (document.querySelector(".sl-app")) {
      installSliceSelectionExtension();
      const button = ensureInstallUi();
      if (button && deferredPrompt) button.classList.add("show");
      return;
    }
    setTimeout(watchShell, 80);
  }
  watchShell();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch((error) => {
        console.warn("Safelight PWA: service worker registration failed", error);
      });
    });
  }
})();
