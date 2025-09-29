# ID Card Maker

A browser-based tool for laying out and exporting ID cards from Illustrator SVG templates. Upload an exported template, map editable fields, preview changes in real time, and generate a single-card PDF that is ready for print alignment testing.

## Quick Start

```bash
pnpm install
pnpm dev
```

The dev server runs on <http://localhost:5173>. Production builds are generated with `pnpm build` and output to `dist/`.

## Workflow

1. **Prepare an Illustrator template**
   - Name editable layers using the pattern `{{field:name}}`, `{{image:photo}}`, `{{barcode:id}}`, or `{{date:valid_until}}`.
   - Export as SVG. If possible, keep the artboard at the real card dimensions (e.g. 86 × 54 mm for CR80).
2. **Upload the SVG**
   - The app parses placeholder IDs and creates starter fields. If no placeholders are found you can add fields manually.
   - The Fonts panel lists every font family referenced in the SVG so you can upload the matching `.ttf`, `.otf`, `.woff`, or `.woff2` files.
3. **Adjust fields**
   - Select any field to edit its label, type, colour, font size, and position (as a percentage of the card size).
   - For image slots choose the crop area size via width/height percentages.
   - Text edits rewrite the original SVG nodes, so the preview aligns with the Illustrator layout.
4. **Enter card data**
   - Fill text, date, barcode, or upload an image for each field. The preview updates instantly.
5. **Export a PDF**
   - Click **Export PDF** to generate a 300 DPI single-card PDF. The export flattens the template + data into one page for downstream layout on printer templates.

## Field Types

| Type    | Notes |
|---------|-------|
| `text`  | Single or multi-line text with configurable colour, alignment, and font size. |
| `image` | Accepts an uploaded image per card and places it in the defined region. |
| `date`  | Uses native date inputs for capture; renders as plain text in the preview/export. |
| `barcode` | Captured as text today; plug in a barcode renderer later during export. |

## Fonts

- When you import an Illustrator SVG, the sidebar lists the required font families and shows whether each one is loaded.
- Upload the matching font files to ensure the live preview and exported PDF render exactly like the template.
- Fonts are registered locally in the browser via the [`FontFace`](https://developer.mozilla.org/docs/Web/API/FontFace) API; files never leave your machine.
- You can replace a font at any time—handy if you need to switch weights or refresh an outdated file.

## Export Details

- Renders the SVG background to an off-screen canvas at 300 DPI.
- Applies field positions as percentages of the template size to maintain accuracy across card sizes.
- Uses [`pdf-lib`](https://pdf-lib.js.org/) to flatten the rendered canvas into a single-page PDF.
- Output filename: `<template-name>-preview.pdf`.

> **Heads up:** the bundled app includes `pdf-lib`, which can trigger Vite's 500 kB warning when building. This is expected for the current MVP and can be addressed with code-splitting when the project grows.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start the Vite development server with HMR. |
| `pnpm build` | Type-check and generate a production build. |
| `pnpm preview` | Preview the production build locally. |

## Next Steps

- Extend export logic to place two cards per sheet for the Canon MP tray layout.
- Hook up a barcode renderer (e.g. `JsBarcode`) during PDF generation.
- Add batch mode support (CSV import + multi-card export).
- Persist templates and field definitions in local storage or IndexedDB.
