# Card library

Print-ready templates converted from the designers' artboards, and the tools
that convert them.

Each template is one side of one card. It sits at the ID-1 / CR80 size (85.725 ×
53.975 mm) with 1/16 in of bleed, and declares that size in the file
(`data-card-format`, `data-trim-box`), so it prints at the right size with no
Card Area step. Every layer that changes per person has a standard field name, so
it maps itself on import. Fixed labels are artwork, not fields. The lanyard slot
is a `punch_…` guide, never ink.

## What is here

| Design | Variants | Back | Fields |
|---|---|---|---|
| `unbc/landscape` | 13: raven (grey and colour, three placements each), crest (×2), crest without the validity line, shield (×3), shield outline | `unbc/back.svg` | `fullName_Last_Comma_First_MiddleInitial_AllCaps`, `studentId`, `customValidYears`, `photo` |
| `unbc/portrait` | 6: shield badge (two logo positions), crest, raven (×2), shield outline | `unbc/back.svg` | same as landscape |
| `unbc/id-card` | 1: the green "Identification Card" | `unbc/back.svg` | `fullName_First_MiddleInitial_Last`, `studentId`, `customValidYears`, `photo` |
| `northern-health/portrait-bar` | 2: no punch, slot punch | – | `fullName_First_Last`, `position`, `photo` |
| `northern-health/portrait-framed` | 1 | – | `fullName_First_LastInitial`, `position`, `photo` |
| `northern-health/portrait-round-photo` | 1 (round photo) | – | `fullName_First_LastInitial`, `position`, `photo` |
| `northern-health/landscape` | 2: with tagline, without | – | `fullName_First_LastInitial`, `position`, `photo` |

The UNBC back carries `barcode_codabar_studentId`, a Codabar barcode generated
from the record's student number. It is drawn as bars, not set in a barcode
font. The back also has `studentId`, and a `guide_magnetic_stripe` marking where
the card stock's stripe sits; the stripe is not printed.

`customValidYears` is the "202X-202X" after VALID:. Set it once in **Map Fields**
(for example to `2025-2029`); the change applies to every variant.

### Changes from the source artwork

- Drop shadows, sample photos and duplicated text were removed. The rounded
  mockup card became a full-bleed background, since the die cuts the corners.
- Names and job titles that had been converted to outlines were set as live text
  in the same font, size and position.
- The black lanyard-slot shapes became punch guides. They are shown in the
  editor and the Lanyard preview, and are never printed.
- The magnetic stripe on the UNBC back is now a guide rather than a printed black
  band.
- The back text "NONTRANFERABLE" now reads "NON-TRANSFERABLE".
- Positions on the artboards were drawn at a 1.627 aspect ratio; ID-1 is 1.588.
  Each card keeps its full drawn width, and the trim box gains about 0.6 mm top
  and bottom. Nothing is stretched. Bands that ran to the edge now carry on into
  the bleed.

## Opening them in the app

Each design and its variants is one package. To build the packages:

```bash
node templates/package.mjs --fonts path/to/fonts   # → templates/dist/*.zip
```

Open a zip with **Open**, or host it and link to the app with
`?url=https://…/unbc-landscape.zip`. The variants appear under **Variants** in
the Design tab.

Fonts are not kept in this repository. `--fonts` takes a folder of font files and
includes the ones whose file names match a family the artwork uses, such as
`HelveticaNeue-Medium.otf`. Check the font licence before you share a package
that contains one.

## Rebuilding from the artboards

```bash
node templates/build.mjs \
  --artboard unbc=path/to/unbc-artboard.svg \
  --artboard northern-health=path/to/northern-health-artboard.svg \
  --previews /tmp/previews        # optional PNG of every card
```

`sources/<family>.json` lists, for each design:

- the cards on the artboard that are its variants;
- a recipe for those cards: which text is which field, where the photo frame is,
  what to remove, and where the punch is.

The artboards are not committed. They are large, contain sample photos, and are
the designers' working files.

The tools need Playwright with Chromium, because splitting an artboard measures
what is actually drawn. They pick up a global Playwright install if the project
does not have one.

### Adding a new artboard

1. Split it and look at the result:

   ```bash
   node templates/tools/split-artboard.mjs artboard.svg /tmp/cards --png
   ```

   Cards are found as the large rounded rectangles each mockup is drawn on. Pass
   `--aspect` if yours are not about 1.6:1.
2. List what one card draws, in millimetres from its top-left trim corner:

   ```bash
   node templates/tools/describe-card.mjs /tmp/cards/card-1.svg
   ```

3. Write `sources/<family>.json`. Use the measured boxes for the photo frame,
   the punch and anything to remove. Then run `build.mjs`. Recipe steps the
   build cannot apply are reported, and it exits non-zero.

For a new design it is usually easier to start from the designer starter kit:
**New Blank → Designer starter kit** in the app. Artwork drawn on it needs none
of this.
