# Reference Templates

Two Illustrator-exported SVGs used as the reference artwork for the template
import pipeline:

| File | Role | Field layers |
|------|------|--------------|
| `card-front.svg` | Staff card front | `fullName_First_LineBreak_Last`, `position_AllCaps` |
| `card-back.svg` | Staff card back | none (artwork only) |
| `id-card-front.svg` | Student ID front | `fullName_First_Last`, `studentId`, `photo` |
| `id-card-back.svg` | Student ID back | `studentId`, `barcode_codabar_studentId`, `customLibraryNumberLabel` |

They are kept here as a realistic sample of what comes out of Illustrator's
"Export As → SVG", which is quite different from hand-written SVG. Use them when
changing `frontend/src/lib/svgTemplate.ts` to check that import still behaves.

## What makes an Illustrator export awkward

Both files exercise the parts of the importer that hand-written SVG never
reaches:

1. **Styling lives in a `<style>` block, not on the elements.**
   Font family, weight, size and fill are all declared as `.cls-N { ... }` rules.
   Anything reading `element.getAttribute('fill')` sees nothing, so the importer
   resolves CSS classes and bakes the result into inline attributes before the
   SVG is handed to the renderer or the PDF exporter.

2. **Words are split across tspans for kerning.**
   The front card's name layer is:

   ```xml
   <text id="fullName_First_Last" transform="translate(17.38 176.68)">
     <tspan x="0" y="0">Pa</tspan>
     <tspan class="cls-9" x="18.61" y="0">r</tspan>
     <tspan x="24.72" y="0">niya</tspan>
     <tspan x="0" y="15">Peykamiyan</tspan>
   </text>
   ```

   Reading `textContent` gives `ParniyaPeykamiyan`, and joining tspans with a
   space gives `Pa r niya Peykamiyan`. tspans have to be grouped by their
   effective `y` first, which yields the real lines: `Parniya` / `Peykamiyan`.

3. **Line spacing is set by the tspan geometry.**
   Line two sits at `y="15"` with a 15px font, i.e. tighter than the 1.2 ratio a
   renderer would assume. Replacement text reuses the template's own spacing.

4. **Position is carried by `transform="translate(...)"`**, with the tspans at
   `x="0" y="0"`, rather than by `x`/`y` on the `<text>` element.

5. **The card back has no text at all** — it is a single pattern-filled path.
   It imports with zero fields, which is correct; give it its own layer ids only
   if something on the back has to be personalised.

## Layer naming used by the front card

`card-front.svg` is shipped exactly as exported, including two naming choices
worth calling out:

- **`fullName_First_Last`** puts the whole name on one line. The artwork stacks
  it over two, and it only *looks* right because the placeholder name is long
  enough to be word-wrapped. A short name ("Jo Ng") collapses onto one line and
  breaks the layout. Rename the layer to **`fullName_First_LineBreak_Last`** to
  make the break explicit — see
  [SVG Layer Naming & Auto-Mapping](../svg-layer-naming.md#stacked-names-over-two-lines).

- **`position`** renders the database value as stored ("Social Media Manager"),
  while the artwork is set in caps. Rename it to **`position_AllCaps`** to match
  the design.

Neither rename changes the artwork — only the layer id in Illustrator's Layers
panel.


## The student ID pair (`id-card-front.svg` / `id-card-back.svg`)

A front and back that belong together, and the barcode case.

### What was changed from the supplied artwork

- **The back had no named layers at all**, so nothing auto-mapped. The library
  number is now split into a `customLibraryNumberLabel` layer (the static
  "Library Number: " text) and a `studentId` layer (the value).
- **The barcode was drawn with the `Codabarlarge` font**, as a text layer
  reading `2002014682274023`. That is not a scannable Codabar: the symbology
  requires a start and a stop character (`A`–`D`), and the value has neither —
  bwip-js rejects it outright with
  `Codabar start and stop characters must be one of A B C or D`. The layer is
  now named `barcode_codabar_studentId` and is generated as vector bars, with
  the start/stop characters supplied automatically. No font to embed, a real
  quiet zone, and it cannot silently degrade into printed digits.
- **The photo was detected twice**, once as the `photo` layer and once as the
  `Layeredphoto` group wrapping it. The wrapper is now `data-layer` instead of
  `id`, so only the real placeholder shows up as a field.

### What is worth knowing about the front

The name layer is `fullName_First_Last` on a single line, and the artwork gives
it a fixed strip beside the photo. Unlike the staff card it has no second line
to wrap into, so a long name runs to the edge. Set **Width** in Field Settings
if you need it bounded.
