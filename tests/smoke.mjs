import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const playwright = await import(process.env.SAFELIGHT_PLAYWRIGHT_MODULE || "playwright");
const { chromium } = playwright;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function startServer() {
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
      const file = path.resolve(root, requested);
      if (file !== root && !file.startsWith(root + path.sep)) throw new Error("invalid path");
      const info = await stat(file);
      if (!info.isFile()) throw new Error("not a file");
      response.writeHead(200, { "content-type": mimeTypes[path.extname(file)] || "application/octet-stream" });
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8Dwn4GBgYGJAQoAHgQCAf7F2cYAAAAASUVORK5CYII=",
  "base64",
);
const largeSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2600" height="1800"><rect width="2600" height="1800" fill="#4ade80"/><circle cx="1300" cy="900" r="520" fill="#17202a"/></svg>');

const server = await startServer();
const address = server.address();
const baseURL = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 936 }, acceptDownloads: true });
const errors = [];
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});

try {
  await page.goto(baseURL, { waitUntil: "networkidle" });
  assert.equal(await page.locator("body").getAttribute("class").then((value) => value?.includes("page-home")), true);
  assert.equal(await page.locator("script[src*='advanced.js']").count(), 0, "editor should be lazy-loaded");

  const chooserPromise = page.waitForEvent("filechooser");
  await page.locator("#hero-cta").click();
  const chooser = await chooserPromise;
  await page.locator(".sl-app").waitFor({ state: "visible" });
  assert.equal(await page.locator("#previewWrap").isVisible(), false, "empty preview must stay hidden");
  assert.equal(await page.locator("#previewImg").isVisible(), false, "broken image placeholder must not render");

  await chooser.setFiles({ name: "smoke.png", mimeType: "image/png", buffer: image });
  await page.waitForFunction(() => {
    const preview = document.getElementById("previewImg");
    return preview?.complete && preview.naturalWidth === 2 && preview.naturalHeight === 2;
  });
  await page.waitForFunction(() => window.safelightApplyTools?.history().items.length === 1);

  const pastePrevented = await page.evaluate(() => {
    const bytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8Dwn4GBgYGJAQoAHgQCAf7F2cYAAAAASUVORK5CYII="), (char) => char.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], "image.png", { type: "image/png", lastModified: Date.now() }));
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: transfer });
    document.dispatchEvent(event);
    return event.defaultPrevented;
  });
  assert.equal(pastePrevented, true, "an image paste should be consumed by the editor");
  await page.waitForFunction(() => document.getElementById("meta-name")?.textContent.startsWith("safelight-paste-"));
  assert.ok(await page.locator("#sl-filmstrip .sl-thumb").count() >= 2, "pasted images should join the local file tray");

  const layout = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    viewport: innerHeight,
    previewVisible: getComputedStyle(document.getElementById("previewWrap")).display !== "none",
    rails: [...document.querySelectorAll(".sl-cscroll")].map((rail) => getComputedStyle(rail).position),
  }));
  assert.equal(layout.previewVisible, true);
  assert.ok(layout.height <= layout.viewport + 2, `unexpected page overflow: ${layout.height}px > ${layout.viewport}px`);
  assert.ok(layout.rails.length > 0, "custom scrollbar rails were not installed");
  assert.ok(layout.rails.every((position) => position === "fixed"), "scrollbar rails must be fixed");

  const wheelZoom = await page.evaluate(() => {
    const wrap = document.getElementById("previewWrap");
    const surface = [document.getElementById("sl-live-canvas"), document.getElementById("previewImg")]
      .find((node) => node && getComputedStyle(node).display !== "none" && node.getBoundingClientRect().width);
    const imageRect = surface.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const inside = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: imageRect.left + imageRect.width / 2,
      clientY: imageRect.top + imageRect.height / 2,
      deltaY: -120,
    });
    wrap.dispatchEvent(inside);
    const afterInside = window.safelightPreviewZoom.get().zoom;
    const outside = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: wrapRect.left + 4,
      clientY: wrapRect.top + 4,
      deltaY: -120,
    });
    wrap.dispatchEvent(outside);
    return {
      insidePrevented: inside.defaultPrevented,
      outsidePrevented: outside.defaultPrevented,
      afterInside,
      afterOutside: window.safelightPreviewZoom.get().zoom,
    };
  });
  assert.equal(wheelZoom.insidePrevented, true, "wheel over the image should control zoom");
  assert.equal(wheelZoom.outsidePrevented, false, "wheel outside the image must keep its native scroll behavior");
  assert.ok(wheelZoom.afterInside > 1, "wheel up over the image should zoom in");
  assert.equal(wheelZoom.afterOutside, wheelZoom.afterInside, "wheel outside the image must not change zoom");
  await page.locator(".sl-preview-zoom-hud [data-zoom-action='reset']").click();
  assert.equal(await page.evaluate(() => window.safelightPreviewZoom.get().zoom), 1);

  await page.locator(".sl-sidebar [data-page='crop']").click();
  await page.waitForFunction(() => document.getElementById("sl-inspector-title")?.textContent === "Обрезка");
  await page.evaluate(() => window.safelightPreviewZoom.set(1.5));
  await page.waitForFunction(() => {
    const source = document.getElementById("sl-crop-source")?.getBoundingClientRect();
    const preview = document.getElementById("previewImg")?.getBoundingClientRect();
    return source && preview && Math.abs(source.left - preview.left) < 1 && Math.abs(source.top - preview.top) < 1
      && Math.abs(source.width - preview.width) < 1 && Math.abs(source.height - preview.height) < 1;
  });
  await page.evaluate(() => window.safelightPreviewZoom.reset());
  await page.locator(".sl-sidebar [data-page='canvas']").click();
  await page.waitForFunction(() => document.getElementById("sl-inspector-title")?.textContent === "Холст / рамки / поля");

  const unnamedControls = await page.evaluate(() => [...document.querySelectorAll(".sl-app input:not([type='hidden']), .sl-app select, .sl-app textarea")]
    .filter((control) => {
      if (control.getAttribute("aria-label") || control.getAttribute("aria-labelledby")) return false;
      if (control.id && document.querySelector(`label[for="${CSS.escape(control.id)}"]`)) return false;
      return !control.closest("label");
    })
    .map((control) => control.id || control.outerHTML.slice(0, 80)));
  assert.deepEqual(unnamedControls, [], `controls without accessible names: ${unnamedControls.join(", ")}`);

  await page.locator(".sl-sidebar [data-page='resize']").click();
  await page.locator("#r-lock").selectOption("free");
  await page.locator("#r-width").fill("1");
  await page.locator("#r-height").fill("1");
  await page.locator("#sl-apply").click();
  await page.waitForFunction(() => window.safelightApplyTools?.history().items.length === 2);
  assert.equal((await page.evaluate(() => window.safelightApplyTools.history())).index, 1);

  await page.locator("#sl-history-undo").click();
  await page.waitForFunction(() => window.safelightApplyTools?.history().index === 0);
  await page.locator("#sl-history-redo").click();
  await page.waitForFunction(() => window.safelightApplyTools?.history().index === 1);

  await page.locator("#sl-export").click();
  const pngExport = page.locator(".sl-export-menu [data-export='png']");
  await pngExport.waitFor({ state: "visible" });
  const downloadPromise = page.waitForEvent("download");
  await pngExport.click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  assert.ok(download.suggestedFilename().endsWith(".png"));
  assert.ok(downloadPath && (await stat(downloadPath)).size > 0, "exported PNG is empty");

  await page.locator("#sl-export").click();
  const profileRun = page.locator("[data-export-profile-run]");
  await profileRun.waitFor({ state: "visible" });
  assert.equal(await page.locator(".sl-export-profile-copy b").textContent(), "Веб");
  const profileDownloadPromise = page.waitForEvent("download");
  await profileRun.click();
  const profileDownload = await profileDownloadPromise;
  const profileDownloadPath = await profileDownload.path();
  assert.ok(profileDownload.suggestedFilename().endsWith("-web.webp"));
  assert.ok(profileDownloadPath && (await stat(profileDownloadPath)).size > 0, "profile export is empty");
  await page.waitForFunction(() => !document.getElementById("sl-export")?.disabled);
  await page.locator("#sl-export").click();
  await page.locator("[data-export-profile-open]").click();
  await page.locator(".sl-profile-dialog").waitFor({ state: "visible" });
  assert.equal(await page.locator("#sl-profile-select option").count(), 3);
  await page.locator(".sl-profile-dialog [data-profile-close]").first().click();

  await page.locator(".sl-sidebar [data-page='privacy']").click();
  await page.waitForFunction(() => document.getElementById("sl-inspector-title")?.textContent === "Продвинутая цензура");
  await page.evaluate(() => window.safelightPrivacyEffects.addArea({ x: 0, y: 0, w: 1, h: 1, mode: "black", shape: "ellipse" }));
  await page.waitForFunction(() => window.safelightPrivacyEffects?.getAreas().length === 1);
  assert.equal(await page.locator("#pe-count").textContent(), "1");
  assert.equal(await page.locator("#sl-privacy-surface .sl-pe-area.mode-black.shape-ellipse").count(), 1);
  await page.locator("#pe-duplicate").click();
  await page.waitForFunction(() => window.safelightPrivacyEffects?.getAreas().length === 2);
  await page.locator("[data-pe-shape='free']").click();
  assert.equal((await page.evaluate(() => window.safelightPrivacyEffects.getAreas().at(-1).shape)), "free");
  const censoredPixel = await page.evaluate(async () => {
    const canvas = await window.safelightPrivacyEffects.render();
    return [...canvas.getContext("2d").getImageData(0, 0, 1, 1).data];
  });
  assert.ok(censoredPixel[0] < 16 && censoredPixel[1] < 16 && censoredPixel[2] < 16, "black censorship should affect exported pixels");

  await page.locator(".sl-sidebar [data-page='background']").click();
  await page.waitForFunction(() => document.getElementById("sl-inspector-title")?.textContent === "Удаление фона");
  await page.waitForFunction(() => document.getElementById("bg-status")?.textContent.includes("Маска готова"));
  await page.locator("#bg-defringe").fill("60");
  assert.equal((await page.evaluate(() => window.safelightBackgroundRemovalTools.state().defringe)), 60);
  const backgroundResult = await page.evaluate(async () => {
    const canvas = await window.safelightBackgroundRemovalTools.render();
    return { width: canvas.width, height: canvas.height };
  });
  assert.deepEqual(backgroundResult, { width: 1, height: 1 }, "background export should keep the working source dimensions");

  await page.locator(".sl-sidebar [data-page='batch']").click();
  await page.waitForFunction(() => document.getElementById("sl-inspector-title")?.textContent === "Пакетная обработка");
  await page.locator("#batch-files").setInputFiles([
    { name: "batch-one.png", mimeType: "image/png", buffer: image },
    { name: "batch-two.png", mimeType: "image/png", buffer: image },
  ]);
  await page.waitForFunction(() => window.safelightBatchTools?.state().count === 2);
  assert.equal(await page.locator("#b-count").textContent(), "2");
  assert.equal(await page.locator("#sl-export").isDisabled(), false, "batch export should be available when the queue has files");

  await page.locator("#b-profile").selectOption("share");
  await page.locator("[data-b-profile-apply]").click();
  assert.equal(await page.locator("#b-format").inputValue(), "jpeg");
  assert.equal(await page.locator("#b-resize-mode").inputValue(), "longest");
  assert.equal(await page.locator("#b-size").inputValue(), "1600");
  assert.equal(await page.locator("#b-background").inputValue(), "white");
  assert.equal(await page.locator("#b-suffix").inputValue(), "-share");

  await page.locator("#b-format").selectOption("png");
  await page.locator("#b-resize-mode").selectOption("width");
  await page.locator("#b-size").fill("1");
  await page.locator("#b-prefix").fill("ready-");
  await page.locator("#b-suffix").fill("-clean");
  const batchDownloadPromise = page.waitForEvent("download");
  await page.locator("#b-download").click();
  const batchDownload = await batchDownloadPromise;
  const batchDownloadPath = await batchDownload.path();
  assert.equal(batchDownload.suggestedFilename(), "safelight-batch-2.zip");
  assert.ok(batchDownloadPath && (await stat(batchDownloadPath)).size > 0, "batch ZIP is empty");
  await page.waitForFunction(() => document.querySelectorAll("#b-queue .sl-batch-item.done").length === 2);
  assert.match(await page.locator("#b-status").textContent(), /Готово: 2 из 2/);

  await page.locator("#fileInput").setInputFiles({ name: "large.svg", mimeType: "image/svg+xml", buffer: largeSvg });
  await page.waitForFunction(() => document.getElementById("previewImg")?.naturalWidth === 2600);
  await page.waitForFunction(() => window.safelightLiveEditor?.performance().optimized === true);
  const performance = await page.evaluate(async () => {
    const metrics = window.safelightLiveEditor.performance();
    const full = await window.safelightLiveEditor.renderFull("convert");
    return { ...metrics, fullWidth: full.width, fullHeight: full.height };
  });
  assert.ok(performance.previewWidth <= 1800 && performance.previewWidth * performance.previewHeight <= 2200000, "interactive preview should be bounded");
  assert.deepEqual([performance.fullWidth, performance.fullHeight], [2600, 1800], "full render must preserve source resolution");

  assert.equal(await page.locator(".sl-preview-zoom-hud [data-zoom-action]").count(), 4);
  await page.evaluate(() => window.safelightPreviewZoom.set(2));
  const zoomSurface = page.locator("#previewImg");
  const zoomBox = await zoomSurface.boundingBox();
  assert.ok(zoomBox, "large preview surface is missing");
  await page.keyboard.down("Space");
  await page.mouse.move(zoomBox.x + zoomBox.width / 2, zoomBox.y + zoomBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(zoomBox.x + zoomBox.width / 2 + 70, zoomBox.y + zoomBox.height / 2 + 35);
  await page.mouse.up();
  await page.keyboard.up("Space");
  const panned = await page.evaluate(() => window.safelightPreviewZoom.get());
  assert.ok(Math.abs(panned.panX) > 1 || Math.abs(panned.panY) > 1, "Space + drag should pan a zoomed image");
  await page.locator("[data-zoom-action='fit']").click();
  assert.deepEqual(await page.evaluate(() => window.safelightPreviewZoom.get()), { zoom: 1, panX: 0, panY: 0 });

  await page.locator(".sl-sidebar [data-page='adjust']").click();
  await page.waitForFunction(() => document.getElementById("sl-inspector-title")?.textContent === "Расширенная коррекция"
    && document.getElementById("previewWrap")?.classList.contains("sl-live-ready")
    && document.getElementById("sl-live-canvas")?.width < 2600);
  const adjustedFull = await page.evaluate(async () => {
    const canvas = await window.safelightAdjustTools.render();
    return [canvas.width, canvas.height];
  });
  assert.deepEqual(adjustedFull, [2600, 1800], "advanced adjustment Apply API must stay full-resolution");

  await page.locator(".sl-sidebar [data-page='privacy']").click();
  await page.waitForFunction(() => document.getElementById("sl-inspector-title")?.textContent === "Продвинутая цензура"
    && document.getElementById("ro-format")?.textContent === "CENSORED"
    && document.getElementById("sl-live-canvas")?.width < 2600);
  const privacyFull = await page.evaluate(async () => {
    const canvas = await window.safelightPrivacyEffects.render();
    return [canvas.width, canvas.height];
  });
  assert.deepEqual(privacyFull, [2600, 1800], "censorship Apply API must stay full-resolution");

  assert.deepEqual(errors, [], errors.join("\n"));

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
  const mobileErrors = [];
  mobile.on("pageerror", (error) => mobileErrors.push(`pageerror: ${error.message}`));
  mobile.on("console", (message) => {
    if (message.type() === "error") mobileErrors.push(`console: ${message.text()}`);
  });
  await mobile.goto(baseURL, { waitUntil: "networkidle" });
  const mobileChooserPromise = mobile.waitForEvent("filechooser");
  await mobile.locator("#hero-cta").click();
  const mobileChooser = await mobileChooserPromise;
  await mobile.locator(".sl-app").waitFor({ state: "visible" });
  await mobileChooser.setFiles({ name: "mobile.png", mimeType: "image/png", buffer: image });
  await mobile.waitForFunction(() => document.getElementById("previewImg")?.naturalWidth === 2);
  await mobile.locator(".sl-inspector-export").waitFor({ state: "visible" });

  const mobileLayout = await mobile.evaluate(() => {
    const box = (selector) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return rect ? { top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height } : null;
    };
    const tools = [...document.querySelectorAll(".sl-sidebar .sl-tool")].map((node) => node.getBoundingClientRect());
    const rail = document.querySelector(".sl-sidebar");
    const exportWrap = document.querySelector(".sl-inspector-export");
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      toolbar: box(".sl-topbar"),
      toolRail: box(".sl-sidebar"),
      stage: box(".sl-stage-host"),
      inspector: box(".sl-inspector"),
      exportAction: box(".sl-inspector-export"),
      exportPosition: getComputedStyle(exportWrap).position,
      toolRailScrollable: rail.scrollWidth > rail.clientWidth,
      minToolWidth: Math.min(...tools.map((rect) => rect.width)),
      minToolHeight: Math.min(...tools.map((rect) => rect.height)),
    };
  });
  assert.ok(mobileLayout.documentWidth <= mobileLayout.viewport.width, "mobile editor must not overflow horizontally");
  assert.ok(mobileLayout.toolbar.height <= 64, `mobile toolbar is too tall: ${mobileLayout.toolbar.height}px`);
  assert.ok(mobileLayout.toolRail.height <= 82, `mobile tool rail is too tall: ${mobileLayout.toolRail.height}px`);
  assert.equal(mobileLayout.toolRailScrollable, true, "mobile tools should use one horizontally scrollable rail");
  assert.ok(mobileLayout.minToolWidth >= 64 && mobileLayout.minToolHeight >= 44, "mobile tool targets are too small");
  assert.ok(mobileLayout.stage.height >= 260 && mobileLayout.stage.height <= 360, `mobile preview height is unexpected: ${mobileLayout.stage.height}px`);
  assert.ok(mobileLayout.inspector.top < mobileLayout.viewport.height, "mobile settings should begin inside the first viewport");
  assert.equal(mobileLayout.exportPosition, "fixed", "mobile export must remain reachable");
  assert.ok(mobileLayout.exportAction.top >= 0 && mobileLayout.exportAction.bottom <= mobileLayout.viewport.height, "mobile export must stay in the viewport");

  await mobile.locator(".sl-sidebar [data-page='resize']").click();
  await mobile.waitForFunction(() => document.getElementById("sl-inspector-title")?.textContent === "Размер");
  assert.equal(await mobile.locator(".sl-sidebar [data-page='resize']").getAttribute("aria-current"), "page");
  const inputFontSize = await mobile.locator("#r-width").evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  assert.ok(inputFontSize >= 16, `mobile input font size can trigger Safari zoom: ${inputFontSize}px`);
  assert.deepEqual(mobileErrors, [], mobileErrors.join("\n"));
  await mobile.close();

  console.log("Smoke test passed: desktop workflow plus mobile layout, touch targets, navigation and export.");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
