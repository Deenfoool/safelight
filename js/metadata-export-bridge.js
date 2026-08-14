(function () {
  "use strict";
  if (window.safelightMetadataExportBridgeLoaded) return;
  window.safelightMetadataExportBridgeLoaded = true;

  function metadataActive() {
    return !!document.querySelector("#sl-inspector-panels #panel-metadata.active");
  }

  function patchMenu() {
    if (!metadataActive()) return;
    const menu = document.querySelector(".sl-export-menu");
    if (!menu) return;
    const items = typeof window.safelightMetadataExportItems === "function"
      ? window.safelightMetadataExportItems()
      : [
          { value: "jpeg", label: "JPEG", meta: "выборочная очистка" },
          { value: "webp", label: "WebP", meta: "чистый файл" },
          { value: "png", label: "PNG", meta: "чистый файл" }
        ];
    menu.innerHTML = '<div class="sl-export-menu-title">Экспорт без лишних данных</div>' +
      items.map((item) => '<button class="sl-export-option" type="button" data-export="' + item.value + '"><span>' + item.label + '</span><span>' + item.meta + '</span></button>').join("") +
      '<div class="sl-export-sep"></div><div class="sl-export-menu-note">JPEG учитывает выбранные категории очистки. PNG и WebP создаются без исходных метаданных.</div>';
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("#sl-export") && metadataActive()) {
      setTimeout(patchMenu, 0);
      return;
    }

    const option = event.target.closest(".sl-export-option[data-export]");
    if (!option || !metadataActive() || typeof window.safelightMetadataExport !== "function") return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    option.closest(".sl-export-wrap")?.classList.remove("open");
    const button = document.getElementById("sl-export");
    if (button) button.disabled = true;
    Promise.resolve(window.safelightMetadataExport(option.dataset.export))
      .then(() => showHint("Метаданные обработаны. Экспорт готов."))
      .catch((error) => {
        console.error("Safelight metadata export:", error);
        showHint(error?.message || "Не удалось экспортировать файл");
      })
      .finally(() => { if (button) button.disabled = false; });
  }, true);

  function showHint(text) {
    const hint = document.getElementById("sl-export-hint");
    if (!hint) return;
    hint.textContent = text;
    hint.classList.add("show");
    clearTimeout(showHint.timer);
    showHint.timer = setTimeout(() => hint.classList.remove("show"), 3200);
  }

  window.addEventListener("safelight:toolchange", () => {
    document.querySelector(".sl-export-wrap")?.classList.remove("open");
  });
})();