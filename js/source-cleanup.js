(function () {
  "use strict";

  const preview = document.getElementById("previewImg");
  if (!preview) return;

  function revokeLater(url) {
    if (!url || !url.startsWith("blob:")) return;
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch (_) {}
    }, 1000);
  }

  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const oldUrl = mutation.oldValue || "";
      const newUrl = preview.getAttribute("src") || "";
      if (oldUrl && oldUrl !== newUrl) revokeLater(oldUrl);
    }
  }).observe(preview, {
    attributes: true,
    attributeFilter: ["src"],
    attributeOldValue: true,
  });

  window.addEventListener("pagehide", () => {
    const current = preview.getAttribute("src") || "";
    if (current.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(current);
      } catch (_) {}
    }
  });
})();
