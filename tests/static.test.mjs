import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("every service-worker shell entry exists", async () => {
  const source = await readFile(path.join(root, "sw.js"), "utf8");
  const coreSource = source.match(/const CORE = \[([\s\S]*?)\];/)?.[1];
  assert.ok(coreSource, "CORE cache list was not found");

  const entries = [...coreSource.matchAll(/"\.\/(.*?)"/g)].map((match) => match[1]);
  assert.ok(entries.length > 0, "CORE cache list is empty");
  await Promise.all(entries.filter(Boolean).map((entry) => access(path.join(root, entry))));
});

test("editor runtime scripts referenced by navigation exist", async () => {
  const source = await readFile(path.join(root, "js/navigation.js"), "utf8");
  const scripts = [...source.matchAll(/loadScript\('(js\/[^'?]+\.js)/g)].map((match) => match[1]);
  assert.ok(scripts.length >= 20, "expected the complete editor runtime manifest");
  await Promise.all(scripts.map((entry) => access(path.join(root, entry))));
});

test("offline install is atomic", async () => {
  const source = await readFile(path.join(root, "sw.js"), "utf8");
  assert.match(source, /cache\.addAll\(CORE\)/);
  assert.doesNotMatch(source, /Promise\.allSettled/);
});

test("the documented HEIC artifact checksum is current", async () => {
  const codec = await readFile(path.join(root, "vendor/elheif/elheif-wasm.js"));
  const notices = await readFile(path.join(root, "THIRD_PARTY_NOTICES.md"), "utf8");
  const digest = createHash("sha256").update(codec).digest("hex");
  assert.match(notices, new RegExp(digest));
});

test("batch processing ships a local queue and ZIP pipeline", async () => {
  const panel = await readFile(path.join(root, "js/advanced.js"), "utf8");
  const runtime = await readFile(path.join(root, "js/batch-tools.js"), "utf8");
  const navigation = await readFile(path.join(root, "js/navigation.js"), "utf8");

  for (const id of ["batch-files", "b-queue", "b-format", "b-resize-mode", "b-background", "b-bg-color", "b-prefix", "b-suffix", "b-download"]) {
    assert.match(panel, new RegExp(`id=["']${id}["']`), `missing batch control ${id}`);
  }
  assert.match(runtime, /new JSZip\(\)/);
  assert.match(runtime, /safelightHeicCodec\?\.decodeFile/);
  assert.match(runtime, /safelight-errors\.txt/);
  assert.match(runtime, /options\.background === "custom"/);
  assert.match(runtime, /zip\.generateAsync\(\{ type: "blob" \}/);
  assert.match(navigation, /loadScript\('js\/batch-tools\.js/);
  assert.match(navigation, /css\/batch-tools\.css/);
});

test("advanced censorship supports multiple modes, shapes and face detection fallback", async () => {
  const runtime = await readFile(path.join(root, "js/privacy-effects.js"), "utf8");
  const styles = await readFile(path.join(root, "css/privacy-effects.css"), "utf8");

  for (const mode of ["blur", "pixelate", "black"]) assert.match(runtime, new RegExp(`data-pe-mode=["']${mode}["']`));
  for (const shape of ["rect", "ellipse", "free"]) assert.match(runtime, new RegExp(`data-pe-shape=["']${shape}["']`));
  assert.match(runtime, /window\.FaceDetector/);
  assert.match(runtime, /FaceDetector !== "function"/);
  assert.match(runtime, /data-pe-resize/);
  assert.match(runtime, /safelightPrivacyEffects = Object\.freeze/);
  assert.match(styles, /\.sl-pe-area\.shape-free/);
  assert.match(styles, /\.sl-pe-resize\.nw/);
});

test("preview zoom only consumes the wheel over the rendered image", async () => {
  const runtime = await readFile(path.join(root, "js/preview-zoom.js"), "utf8");
  const styles = await readFile(path.join(root, "css/preview-zoom.css"), "utf8");
  const navigation = await readFile(path.join(root, "js/navigation.js"), "utf8");

  assert.match(runtime, /pointIsOnSurface\(event, surface\)/);
  assert.match(runtime, /event\.preventDefault\(\)/);
  assert.match(runtime, /addEventListener\("wheel", onWheel, \{ passive: false \}\)/);
  assert.match(runtime, /MIN_ZOOM = 0\.25/);
  assert.match(runtime, /MAX_ZOOM = 4/);
  assert.match(runtime, /safelight:zoomchange/);
  assert.match(runtime, /event\.button === 1/);
  assert.match(runtime, /event\.code !== "Space"/);
  assert.match(runtime, /data-zoom-action="fit"/);
  assert.match(runtime, /setPointerCapture/);
  assert.match(styles, /--sl-preview-zoom/);
  assert.match(navigation, /loadScript\('js\/preview-zoom\.js/);
  assert.match(navigation, /css\/preview-zoom\.css/);
});

test("clipboard import, export profiles and large-image preview are wired into the local workflow", async () => {
  const app = await readFile(path.join(root, "js/app.js"), "utf8");
  const profiles = await readFile(path.join(root, "js/export-profiles.js"), "utf8");
  const live = await readFile(path.join(root, "js/live-editor.js"), "utf8");
  const adjust = await readFile(path.join(root, "js/adjust-tools.js"), "utf8");
  const canvas = await readFile(path.join(root, "js/canvas-tools.js"), "utf8");
  const privacy = await readFile(path.join(root, "js/privacy-effects.js"), "utf8");
  const navigation = await readFile(path.join(root, "js/navigation.js"), "utf8");
  const worker = await readFile(path.join(root, "sw.js"), "utf8");

  assert.match(app, /addEventListener\("paste"/);
  assert.match(app, /clipboardData\?\.items/);
  assert.match(app, /safelight-paste-/);
  for (const id of ["web", "share", "lossless"]) assert.match(profiles, new RegExp(`id: ["']${id}["']`));
  assert.match(profiles, /localStorage\.setItem\(STORAGE_KEY/);
  assert.match(profiles, /safelightLiveEditor\?\.renderFull/);
  assert.match(profiles, /applyToBatch/);
  assert.match(live, /PREVIEW_MAX_SIDE = 1800/);
  assert.match(live, /PREVIEW_MAX_PIXELS = 2200000/);
  assert.match(live, /renderFull:/);
  for (const runtime of [adjust, canvas, privacy]) {
    assert.match(runtime, /PREVIEW_MAX_SIDE/);
    assert.match(runtime, /preview:true|preview: true/);
    assert.match(runtime, /preview:false|preview: false/);
  }
  assert.match(navigation, /loadScript\('js\/export-profiles\.js/);
  assert.match(worker, /\.\/js\/export-profiles\.js/);
  assert.match(worker, /\.\/css\/export-profiles\.css/);
});

test("background removal includes defringe and a bounded working mask", async () => {
  const runtime = await readFile(path.join(root, "js/background-removal.js"), "utf8");

  assert.match(runtime, /slider\('bg-defringe'/);
  assert.match(runtime, /MAX_WORKING_SIDE=2800/);
  assert.match(runtime, /MAX_WORKING_PIXELS=4000000/);
  assert.match(runtime, /buildMaskCanvas/);
  assert.match(runtime, /Готовлю полноразмерный край без цветного ореола/);
  assert.match(runtime, /sourceImage\.naturalWidth===canvas\.width/);
});

test("mobile editor keeps tools and export within thumb reach", async () => {
  const html = await readFile(path.join(root, "index.html"), "utf8");
  const shell = await readFile(path.join(root, "css/app-shell.css"), "utf8");
  const ui = await readFile(path.join(root, "js/ui-shell.js"), "utf8");

  assert.match(html, /viewport-fit=cover/);
  assert.match(shell, /scroll-snap-type:x proximity/);
  assert.match(shell, /\.sl-inspector-export\s*\{[\s\S]*?position:fixed!important/);
  assert.match(shell, /font-size:16px/);
  assert.match(ui, /aria-current/);
  assert.match(ui, /scrollTo\(\{/);
});
