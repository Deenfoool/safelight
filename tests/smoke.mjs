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

  await page.locator(".sl-sidebar [data-page='crop']").click();
  await page.waitForFunction(() => document.getElementById("sl-inspector-title")?.textContent === "Обрезка");
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

  assert.deepEqual(errors, [], errors.join("\n"));
  console.log("Smoke test passed: lazy load, image flow, layout, tools, accessibility, history, export.");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
