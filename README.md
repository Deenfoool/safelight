# Safelight

**Privacy-first image tools that run entirely in your browser.**

Compress, convert, resize, crop, blur, inspect metadata, extract palettes and more — without uploading your images to a server.

[**Open Safelight**](https://deenfoool.github.io/safelight/) · [Report a bug](https://github.com/Deenfoool/safelight/issues) · [MIT License](LICENSE)

![Safelight interface](portfolio.png)

---

## Why Safelight?

Most online image tools ask you to upload a file before doing something as simple as converting it to WebP or removing metadata.

Safelight takes a different approach: **your image stays on your device**. Processing happens locally with browser APIs and Canvas.

- No account
- No backend upload
- No tracking-dependent workflow
- Works as an installable PWA
- Core runtime is bundled locally — no Google Fonts or CDN dependency
- Original files stay untouched until you explicitly export a result

## Try it

**Live app:** https://deenfoool.github.io/safelight/

Drop in an image and start editing immediately. There is no signup screen and no upload step.

## Features

### Image editing
- Compress PNG, JPEG and WebP
- Convert between PNG / JPEG / WebP / HEIC
- Open `.heic` / `.heif` files when the browser or operating system exposes a native HEIC decoder
- Export HEIC only when the browser provides a real HEIC encoder; Safelight verifies the resulting MIME type and never renames a fallback PNG to `.heic`
- Export images to PDF
- Render the first page of supported PDFs to an image
- Resize and crop
- Brightness, contrast and saturation controls
- Rotate and flip
- Watermarks with draggable positioning
- Blur or pixelate selected regions

### Utilities
- Batch processing
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

The application also ships its ZIP/PDF runtime inside the repository and uses local system fonts instead of Google Fonts.

HEIC is capability-detected instead of faked. Import works only if the current browser/OS can decode HEIC locally, and HEIC export is enabled through the same local browser codec path only when the browser actually returns an `image/heic` or `image/heif` blob.

> Note: the built-in PDF renderer is intentionally lightweight and optimized for the first page and image-oriented PDFs. Complex PDFs with unusual fonts or heavy vector content may render in a simplified form.

## Install as an app

Safelight is a PWA. After opening it in a supported browser, you can install it and use the cached core interface offline.

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
- Service Worker
- Web App Manifest
- Local ZIP runtime
- Local PDF runtime
- Native browser image codecs, including capability-detected HEIC

## Project status

Safelight currently includes:

- [x] Compression
- [x] Slicing
- [x] Format conversion
- [x] HEIC / HEIF file selection and native-codec conversion path
- [x] Verified HEIC export without fake file extensions
- [x] PDF conversion
- [x] Resize / crop
- [x] Color adjustment
- [x] Transform tools
- [x] Watermarks
- [x] Batch processing
- [x] Metadata inspector / cleaner
- [x] Favicon generator
- [x] Region blur / pixelation
- [x] Palette extraction / eyedropper
- [x] PWA support
- [x] Local fonts
- [x] Offline vendor runtime

## Feedback and contributions

If Safelight is useful to you, **a GitHub star helps other people discover the project.**

Found a bug or have an idea for a useful image tool? Open an [issue](https://github.com/Deenfoool/safelight/issues).

Contributions and practical feedback are welcome.

## License

[MIT](LICENSE)