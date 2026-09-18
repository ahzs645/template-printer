# Reference Templates

Two Illustrator-exported SVGs used as the reference artwork for the template
import pipeline:

| File | Role | Field layers |
|------|------|--------------|
| `card-front.svg` | Card front | `fullName_First_Last`, `position` |
| `card-back.svg` | Card back | none (artwork only) |

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
