# Safelight

**Privacy-first image tools that run entirely in your browser.**

Compress, convert, resize, crop, blur, inspect metadata, extract palettes and more — without uploading your images to a server.

[**Open Safelight**](https://deenfoool.github.io/safelight/) · [Roadmap](ROADMAP.md) · [Report a bug](https://github.com/Deenfoool/safelight/issues) · [Attribution License](LICENSE)

![Safelight interface](portfolio.png)

---

## Why Safelight?

Most online image tools ask you to upload a file before doing something as simple as converting it to WebP or removing metadata.

Safelight takes a different approach: **your image stays on your device**. Processing happens locally with browser APIs, Canvas and bundled WebAssembly codecs.

- No account
- No backend upload
- No tracking-dependent workflow
- Works as an installable PWA
- Mobile editor with a one-row tool rail, touch-sized controls and a fixed export action
- Paste screenshots and copied images directly with `Ctrl+V` / `Cmd+V`
- Zoom only while the pointer is over the image, then pan with `Space` + drag or the middle mouse button
- Core runtime is bundled locally — no Google Fonts or CDN dependency at runtime
- Original files stay untouched until you explicitly export a result

## Try it

**Live app:** https://deenfoool.github.io/safelight/

Drop in an image and start editing immediately. There is no signup screen and no upload step.

## Features

### Image editing
- Compress PNG, JPEG and WebP
- Convert between PNG / JPEG / WebP / HEIC
- Decode `.heic` / `.heif` locally through the bundled `elheif` WebAssembly codec
- Encode PNG / JPEG / WebP back to a real HEIC file locally through WebAssembly
- Export images to PDF
- Render the first page of supported PDFs to an image
- Resize and crop
- Brightness, contrast and saturation controls
- Rotate and flip
- Watermarks with draggable positioning
- Advanced censorship with multiple rectangular, elliptical and freeform masks
- Blur, pixelation or solid black fill per mask, with optional local face detection
- Background removal with color key, Magic Wand, brush masks, feathering and color-halo cleanup
- Bounded interactive previews for large images; Apply and Export rebuild the full-resolution result

### Utilities
- Reusable local export profiles for format, quality, maximum side, background and filename rules
- Batch queue with shared resize, format, quality and transparency-background settings
- PNG / JPEG / WebP / HEIC batch export to one local ZIP archive
- Batch filename prefixes and suffixes, duplicate-safe names and per-file error reporting
- Metadata-free batch output created by re-encoding images locally
- Image slicing with draggable guides and ZIP export
- Dominant color palette extraction: 3 / 5 / 8 / 12 colors
- Eyedropper with HEX / RGB / HSL values
- Palette export to CSS variables, JSON, TXT and PNG
- Favicon package generation

### Privacy tools
- Inspect EXIF / XMP metadata locally
- Detect camera, lens, date, author and GPS data when available
- Warn when location data is present
- Export cleaned image copies without the original metadata

## Local-first by design

Safelight does not send the image you open to a Safelight backend.

Image operations are performed locally in the browser. Metadata inspection, palette analysis, blur regions and other working state remain on the device while you use the app.

The application ships its ZIP/PDF runtime and HEIC WebAssembly runtime inside the repository and uses local system fonts instead of Google Fonts.

HEIC import and export do not depend on the browser exposing a native HEIC codec. Safelight loads `vendor/elheif/elheif-wasm.js` inside a dedicated Web Worker, decodes HEIC/HEIF into RGBA pixels locally and can encode RGBA pixels back into a real HEIC container.

> Note: the built-in PDF renderer is intentionally lightweight and optimized for the first page and image-oriented PDFs. Complex PDFs with unusual fonts or heavy vector content may render in a simplified form.

## Install as an app

Safelight is a PWA. After opening it in a supported browser, you can install it and use the cached core interface offline. The bundled HEIC worker and codec are included in the application cache.

## Run locally

No build step or backend is required.

```bash
git clone https://github.com/Deenfoool/safelight.git
cd safelight
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Tech

- Vanilla JavaScript
- HTML5 / CSS3
- Canvas API
- Web Workers
- WebAssembly
- Service Worker
- Web App Manifest
- Local ZIP runtime
- Local PDF runtime
- `elheif` HEIC codec (`libheif` + `libde265` + `kvazaar` build)

## Project status

Safelight currently includes:

- [x] Compression
- [x] Slicing
- [x] Format conversion
- [x] HEIC / HEIF selection and local WASM decoding
- [x] Real HEIC export through local WASM
- [x] PDF conversion
- [x] Resize / crop
- [x] Color adjustment
- [x] Transform tools
- [x] Watermarks
- [x] Batch processing
- [x] Metadata inspector / cleaner
- [x] Favicon generator
- [x] Advanced censorship: multiple masks, freeform lasso, face detection, blur / pixelation / black fill
- [x] Background removal with defringe / color-halo cleanup
- [x] Local export profiles for individual and batch workflows
- [x] Clipboard image import, pointer-scoped zoom and desktop panning
- [x] Downscaled large-image preview with full-resolution Apply / Export
- [x] Palette extraction / eyedropper
- [x] PWA support
- [x] Local fonts
- [x] Mobile-first editor layout and touch controls
- [x] Offline vendor runtime

## Feedback and contributions

If Safelight is useful to you, **a GitHub star helps other people discover the project.**

Found a bug or have an idea for a useful image tool? Open an [issue](https://github.com/Deenfoool/safelight/issues).

Contributions and practical feedback are welcome.

## License

Safelight is released under the custom [Safelight Attribution License 1.0](LICENSE). Public use, deployment, redistribution, modified versions and derivative products that use Safelight or a substantial portion of it must provide clear attribution to the original project and a working link to https://github.com/Deenfoool/safelight.

Minimum attribution:

> Based on Safelight — https://github.com/Deenfoool/safelight

Private/internal use does not require a user-facing notice, but copies must retain the license and original project reference. Commercial use is permitted as long as the attribution requirements are followed.

The bundled HEIC codec and other third-party components retain their own licenses; see [Third-party notices](THIRD_PARTY_NOTICES.md).
