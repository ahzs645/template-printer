# Card recreation workflow

This workflow adds editable vector/raster artwork, explicit record bindings, portable scene state and regression specimens to the existing Template Printer application. It does not replace the SVG-template workflow, printer calibration or the configured storage adapter.

## Try the three specimens

Open **Design → Card Designer** and choose **MIT specimen**, **Stanford specimen** or **Harvard specimen** in the left panel. The same original packages are available in `frontend/public/card-specimens/` and can be opened with **Open editable package**.

These are anonymous, visibly labelled layout test specimens with fictional identifiers and schematic logos. They are not official credentials or verified reproductions of the photographed cards. The reference photographs partly cover the Stanford and Harvard layouts; covered regions are not ground truth. The examples use an explicit 85.6 × 53.98 mm test size. No font files or original personal portraits are supplied in the specimen packages.

| Package | Declared fields |
|---|---:|
| `mit-specimen.template-printer.zip` | 5 |
| `stanford-specimen.template-printer.zip` | 4 |
| `harvard-specimen.template-printer.zip` | 3 |

The browser regression verifies the exact specimen ZIP checksums before converting the SVG, saving/reopening the scene, remapping fields and replacing sample values. The original SVG-only packages are converted on import. Packages subsequently downloaded from the designer also carry editable scene JSON.

## Authoring and review

Use **Import artwork** for a static SVG logo, watermark, or embedded raster image. Use **Photo frame** for a record-backed portrait. Static artwork and dynamic fields are intentionally different object types.

Select a layer to edit its physical position, dimensions, rotation, opacity, text, typography or data binding. Standard fields and name-format tokens are offered in the binding control. Custom field names require mapping before record export. Mark essential fields **Required for production export**.

Use groups, duplicate, layer ordering, visibility, locks, alignment and distribution to arrange the design. Duplicates receive new object IDs while retaining an artwork asset identity. Their tint and opacity are independent; these are not linked master-symbol instances. Grid and 1 mm snapping are available.

The reference-image panel provides a nonprinting overlay with translation, size, rotation, visibility and opacity. A reference is saved with the design in its configured storage library; this is not necessarily device-local when a server-backed adapter is selected. References are excluded from rendered SVG/PDF and from portable packages by default. Four-corner perspective correction is not part of this implementation.

**Data preview** uses the actual SVG renderer with sample text, generated barcode values and cropped sample photos. The edit canvas shows a photo frame; the data preview shows the sample portrait with cover/contain/stretch, zoom and offsets. Font choices reuse the app's font manager. Load the intended fonts before evaluating typography or exporting production records.

## Saving and moving a design

**Save Design** stores both sides' editable state and dimensions through the existing app storage interface. **Download editable package** writes a version-1 template package containing front/back SVG fallbacks, fields, mappings and an optional versioned editor section. The editor section points to `editor/front.json` and, when present, `editor/back.json`. Existing user-managed fonts are packaged using the app's established mechanism; reference overlays are omitted.

**Open editable package** restores a saved scene directly. An older SVG-only package is converted to Fabric objects while retaining declared field mappings. Arbitrary SVG-to-Fabric conversion is not guaranteed lossless: complex masks, filters, nested viewports, paint servers, grouping and advanced text layout need visual review. Keep the original SVG. For bleed/trim artwork requiring exact source preservation, continue using the SVG-template workflow and Card Area rather than assuming conversion preserves every authoring convention.

## Reliability changes

Physical dimensions, SVG viewBox coordinates and object-local transforms are treated separately. Absolute `mm`, `cm`, `in`, `pt`, `pc` and `px` lengths are handled explicitly. Field positions normalize against the viewBox, including a nonzero origin; zero and intentional off-card positions are not replaced by fallback coordinates.

Explicit `data-field-*` metadata is merged with legacy placeholders and layer naming. A metadata-bearing text child supersedes the legacy placeholder on its wrapper, avoiding duplicate fields. Imported canvas objects receive opaque IDs; logical record bindings live in object metadata. Groups and save/reopen operations retain that metadata.

The active designer uses one SceneSession mutation/history path for inspector edits and canvas actions. Opacity is displayed in percent and stored as a fraction. Object coordinates and selection geometry are refreshed after changes. Undo/redo is scoped to the active side and ignores text-entry keyboard shortcuts.

Production rendering rejects missing required values and invalid barcode values. Explicitly empty optional fields clear instead of retaining sample content. Preview still permits intentional template examples. Image placeholders are replaced with clipped images, and QR symbols use a uniform scale even when their containing frame is nonsquare.

Embedded raster assets and editable scene JSON have size/structure checks; executable SVG content is sanitized. This is defense in depth, not a claim of a complete security audit of every import, storage or deployment route.

## Verification

`pnpm test` runs the existing template-import, share-link, package and package-URL suites plus `test:card-recreation`. The added importer/renderer tests include a regression for a metadata text node inside a legacy placeholder wrapper.

`frontend/scripts/test-card-browser.py` launches the real local-storage React application in Chromium. It checks inspector editing, native ZIP download/reimport, all three built-in specimens, library persistence through reload and a narrow viewport. It also loads `card-browser-checks.mjs` for real Fabric scene, grouping, metadata, reference, image, barcode and package roundtrips. The actual raster and vector PDF exporters are exercised, page dimensions are checked, and PDFium renders each result for a nonblank-content check.

The normal **Card recreation verification** workflow is read-only. It neither rewrites source code nor pushes commits, merges branches, deploys the app or changes repository settings. It uploads `results.json`, UI/card screenshots and exported PDF examples as a 14-day Actions artifact. Initial implementation verification passed on run `36394740161`; use the latest PR check for the final committed revision.

Automated nonblank PDF rendering is not a visual comparison with the original photographs, glyph-coverage proof, barcode scanner certification or physical printer calibration. Chromium/local-storage coverage does not establish Safari/Firefox, production API/Convex or actual printer behaviour.

## Run locally

```bash
git fetch origin
git switch codex/card-recreation-workflow
cd frontend
pnpm install --frozen-lockfile
pnpm exec tsc -b
pnpm lint
pnpm test
pnpm build:local
pnpm dev:local
```

The development app is under `http://localhost:5173/template-printer/`.

For the browser/PDF suite, install the pinned Python dependencies shown in `.github/workflows/card-recreation.yml`, install Playwright Chromium, then run `python frontend/scripts/test-card-browser.py` from the repository root.

## Recommended next acceptance work

1. Review specimen imports and exported PDFs at actual size with intended fonts, then print a front/back calibration sample on the intended stock and printer. Check registration, bleed, safe area, scaling and colour.
2. Exercise production storage adapters and access controls in staging. Do not infer these from local-library tests.
3. Extend the reference workflow with four-corner rectification, occlusion masks and calibrated comparison metrics. Do not score hidden photograph regions as known artwork.
4. Consolidate physical-format presets without silently resizing saved designs. Add dedicated multilingual shaping/glyph-coverage fixtures, variable-font controls, and a provenance-aware reusable asset catalog when those capabilities are needed.
