# SVG Layer Naming & Auto-Mapping

The Template Printer supports automatic field mapping based on SVG layer IDs. When you upload a template, the system automatically detects standard field names and maps them to user database fields.

## Naming Convention

### Pattern

```
{fieldType}_{format}_{capitalization}
```

### Capitalization Suffixes

- `_AllCaps` or `_UPPER` → ALL UPPERCASE
- `_TitleCase` or `_Title` → Title Case
- `_LowerCase` or `_LOWER` → all lowercase
- (no suffix) → As stored in database

## Standard Field Names

### Individual Name Fields

These fields reference individual parts of a user's name:

```
firstName
firstName_AllCaps
firstName_TitleCase

lastName
lastName_AllCaps
lastName_TitleCase

middleName
middleName_AllCaps
middleName_TitleCase

middleInitial
middleInitial_AllCaps
```

**Example**: Layer ID `firstName_AllCaps` will display "JOHN" if the user's first name is "John".

### Composite Name Fields (First-Last Order)

These fields combine multiple name parts in first-last order:

```
fullName_First_Last
fullName_First_Last_AllCaps
fullName_First_MiddleInitial_Last
fullName_First_MiddleInitial_Last_AllCaps
fullName_First_Middle_Last
fullName_First_Middle_Last_AllCaps
```

**Examples**:
- `fullName_First_Last_AllCaps` → "JOHN SMITH"
- `fullName_First_MiddleInitial_Last_AllCaps` → "JOHN A. SMITH"
- `fullName_First_Middle_Last_AllCaps` → "JOHN ALLEN SMITH"

### Stacked Names (over two lines)

Add `_LineBreak_` between two parts to force a hard line break. Use this
whenever the artwork stacks the name, so the layout holds for every user
regardless of how long or short their name is:

```
fullName_First_LineBreak_Last
fullName_First_LineBreak_Last_AllCaps
fullName_First_LineBreak_Last_TitleCase
fullName_First_MiddleInitial_LineBreak_Last
fullName_First_MiddleInitial_LineBreak_Last_AllCaps
fullName_Last_LineBreak_First
fullName_Last_LineBreak_First_AllCaps
fullName_Last_Comma_LineBreak_First
fullName_Last_Comma_LineBreak_First_AllCaps
```

**Examples**:
- `fullName_First_LineBreak_Last` → "John" / "Smith"
- `fullName_First_MiddleInitial_LineBreak_Last` → "John A." / "Smith"
- `fullName_Last_Comma_LineBreak_First_AllCaps` → "SMITH," / "JOHN"

`_NewLine_` and `_Break_` are accepted as aliases for `_LineBreak_`.

**Why this matters**: a two-line text layer whose id is `fullName_First_Last`
gets a single line of text, "John Smith". It is then word-wrapped to fit the
width of the original artwork, which *usually* reproduces the two-line look —
but a short name such as "Jo Ng" fits on one line and drops to a single line,
collapsing the design. `_LineBreak_` removes the guesswork: the break is always
where you put it, and long lines are still wrapped after that.

The replacement text reuses the line spacing from the original artwork, so the
generated lines sit exactly where the designer's placeholder lines sat.

### Composite Name Fields (Last-First with Comma)

These fields combine name parts with last name first, separated by a comma:

```
fullName_Last_Comma_First
fullName_Last_Comma_First_AllCaps
fullName_Last_Comma_First_MiddleInitial
fullName_Last_Comma_First_MiddleInitial_AllCaps
fullName_Last_Comma_First_Middle
fullName_Last_Comma_First_Middle_AllCaps
```

**Examples**:
- `fullName_Last_Comma_First_AllCaps` → "SMITH, JOHN"
- `fullName_Last_Comma_First_MiddleInitial_AllCaps` → "SMITH, JOHN A."
- `fullName_Last_Comma_First_Middle_AllCaps` → "SMITH, JOHN ALLEN"

**Missing name parts are dropped cleanly.** A user with no middle name renders
`fullName_First_MiddleInitial_Last` as "John Smith", not "John  Smith", and a
comma with nothing after it is removed.

### Other Text Fields

```
studentId        - Student/Employee ID number
department       - Department name
position         - Job title or position
grade            - Grade level or class
email            - Email address
phoneNumber      - Phone number
address          - Physical address
emergencyContact - Emergency contact information
issueDate        - Date card was issued
expiryDate       - Date card expires
birthDate        - User's birth date
```

**Note**: These fields also support capitalization suffixes (e.g., `department_AllCaps`, `position_TitleCase`).

### Image Fields

```
photo       - User's photo
signature   - User's signature
logo        - Organization logo
```

**Note**: Image fields should be `<image>` elements in your SVG, not text elements.

### Barcodes

Name a text layer `barcode_<symbology>` and it is replaced with a generated
barcode. Add a field name to say what gets encoded:

```
barcode_codabar_studentId     - Codabar of the user's student/library number
barcode_code128_studentId     - same value, Code 128
barcode_code39_studentId
barcode_ean13
barcode_qrcode_email
barcode_codabar               - source field chosen in Map Fields
```

Supported symbologies: `codabar` (rationalized/ANSI), `code128`, `code39`,
`ean13`, `qrcode`.

**Put a `<text>` element where the barcode goes.** Its position and font size
set where the barcode sits and how tall it is; the value in it is placeholder
text and is discarded. To control the width — wider bars scan more reliably —
set Width in **Field Settings** after import.

**The data goes in the record, not the template.** Every card needs a different
barcode, so the layer names a field and the value comes from the user record at
export time. Generating a barcode image and placing it in the artwork would bake
one person's number into the template. Set **Default value** in Field Settings
for what to encode when a record has nothing — a blank barcode is worse than a
known placeholder.

**Reading an existing barcode**: **Read Barcode** in the ribbon decodes a photo
or scan of a card you already issue and reports the symbology and the value. With
a field selected it applies both, which is the quickest way to match an existing
system.

**Codabar start and stop characters** are added automatically (`A`…`B`) when the
value doesn't have them. Type your own (`A`, `B`, `C` or `D` at each end) to
override. This matters: Codabar is undecodable without them, which is the usual
reason a barcode that looks right doesn't scan.

#### Don't draw barcodes with a barcode font

A layer set in a barcode font (Codabar, Code 39, …) is flagged on import.
Generated barcodes are used instead because a font-drawn one:

- **prints as plain digits if the font is missing** — the browser falls back
  silently, and you find out after the cards are cut;
- **cannot enforce the symbology's rules**, so a value with no start/stop
  characters produces bars that no scanner accepts;
- **has no quiet zone** — the space glyph in most barcode fonts has zero
  advance, so you cannot type one;
- **gives no control over the narrow-bar width**, which is what a scanner
  actually measures;
- has to be embedded or outlined in every export.

## Auto-Mapping Rules

The auto-mapping system follows these rules in order:

### 1. Exact Match
If a layer ID exactly matches a standard field name, it's automatically mapped.

**Example**: Layer `firstName_AllCaps` → Auto-mapped to `firstName_AllCaps`

### 2. Case-Insensitive Match
If a layer ID matches a standard field when compared case-insensitively, it's mapped to the correct casing.

**Example**: Layer `FIRSTNAME_ALLCAPS` → Auto-mapped to `firstName_AllCaps`

### 3. Any Valid Combination
The lists above are the combinations offered in the mapping dropdown, not the
limit of what is understood. Any layer ID built from a known field type, the
name format tokens (`First`, `Last`, `Middle`, `MiddleName`, `MiddleInitial`,
`Comma`, `LineBreak`/`NewLine`/`Break`) and an optional capitalization suffix is
recognised and mapped.

**Example**: Layer `fullName_Last_Comma_LineBreak_First_TitleCase` maps even
though it isn't in the dropdown.

Image fields (`photo`, `signature`, `logo`) take no format or capitalization
tokens — `photo_AllCaps` is not a valid field name.

### 4. Common Variations
Some common variations are recognized:

| Layer ID | Auto-Mapped To |
|----------|---------------|
| `profilePhoto`, `profile`, `userPhoto` | `photo` |
| `studentid`, `student_id`, `id` | `studentId` |
| `fullname`, `name` | `fullName_Last_Comma_First_MiddleInitial_AllCaps` |

### 5. Custom Fields
Layers starting with "custom" are automatically mapped as custom static text:

**Example**: Layer `customSchoolName` → Auto-mapped to custom field with the layer's current text as the default value

## Creating SVG Templates for Auto-Mapping

### Best Practices

1. **Use descriptive layer IDs**: Name your layers exactly as shown in the standard field list
2. **Use text elements for text fields**: Ensure text fields use `<text>` or `<tspan>` elements
3. **Use image elements for photos**: Photo placeholders should use `<image>` elements
4. **Group related elements**: You can group elements under a layer, but the layer ID is what matters
5. **Name the line break when the artwork has one**: if a text layer is set over
   two lines, use a `_LineBreak_` field name rather than relying on word wrap
6. **Use a `barcode_` layer rather than a barcode font**: see
   [Barcodes](#barcodes)

### Exporting from Illustrator

Illustrator's **Export As → SVG** output is fully supported, including the parts
that differ from hand-written SVG:

- **Styling in a `<style>` block.** Illustrator writes font family, weight, size
  and fill as `.cls-N { ... }` rules rather than attributes. These are resolved
  on import and baked into the elements, so colours and fonts survive into the
  preview and the exported PDF. Keep the `<style>` block in the export — do not
  strip it.
- **Words split across tspans.** Illustrator breaks a word into several tspans to
  apply kerning. tspans are regrouped by their vertical position, so the field
  list shows "Parniya Peykamiyan" rather than "ParniyaPeykamiyan".
- **Line spacing.** The spacing between the tspan lines in the artwork is reused
  for the replacement text, so generated lines land where the placeholder lines
  were.
- **Layer ids.** Illustrator uses the Layers panel name as the SVG `id`, and
  replaces characters it does not allow. Stick to the exact field names above —
  spaces and punctuation get mangled.

There is a worked example in
[`reference-templates/`](./reference-templates/README.md).

### Example SVG Structure

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600">
  <!-- Photo (image element) -->
  <image id="photo" x="50" y="50" width="100" height="100" />

  <!-- Name (text element with standard field ID) -->
  <text id="fullName_Last_Comma_First_MiddleInitial_AllCaps" x="200" y="100">
    SAMPLE, USER A.
  </text>

  <!-- Student ID -->
  <text id="studentId" x="200" y="130">
    12345
  </text>

  <!-- Department with title case -->
  <text id="department_TitleCase" x="200" y="160">
    Computer Science
  </text>

  <!-- Custom static text (school name) -->
  <text id="customSchoolName" x="200" y="30">
    Example University
  </text>
</svg>
```

## Manual Mapping

If a layer isn't auto-mapped or you want to change the mapping:

1. Upload your template in the **Design** tab
2. Click **Map Fields** in the template sidebar
3. For each unmapped field, select the desired mapping from the dropdown
4. For custom fields, choose "Custom Static Text" and enter your text
5. Click **Save Mappings**

## Troubleshooting

### Layer Not Auto-Mapping

**Problem**: Your layer isn't being automatically mapped.

**Solutions**:
- Check the layer ID against the field names above (matching is case-insensitive,
  but the tokens themselves have to be spelled correctly — `fullName_First_Last`,
  not `fullName_FirstLast`)
- Ensure the layer is a `<text>` element (for text fields) or `<image>` element (for photos)
- Illustrator rewrites layer names containing spaces or punctuation; check the
  exported `id` attribute, not just the Layers panel
- Use the manual mapping dialog to map it manually

### Name Renders on One Line Instead of Two

**Problem**: The artwork stacks the first and last name, but short names come
out on a single line.

**Solution**: The layer is probably named `fullName_First_Last`, which produces
one line that only wraps when it is too wide to fit. Rename it to
`fullName_First_LineBreak_Last` so the break is explicit — see
[Stacked Names](#stacked-names-over-two-lines).

### Wrong Capitalization

**Problem**: Text is showing in the wrong case.

**Solutions**:
- Check the capitalization suffix in your layer ID
- Add `_AllCaps`, `_TitleCase`, or `_LowerCase` to control output
- Example: Change `firstName` to `firstName_AllCaps` for uppercase

### Custom Text Not Showing

**Problem**: Custom static text isn't appearing.

**Solutions**:
- Ensure your layer ID starts with "custom"
- Check the field mapping dialog and set a value for "Custom Static Text"
- The system uses the existing text in the layer as the default

## Advanced: Understanding the Field Parser

Two modules implement this convention:

- [`standardFields.ts`](../frontend/src/lib/standardFields.ts) owns the list of
  field names offered in the UI and resolves a layer ID to its canonical field
  name.
- [`fieldParser.ts`](../frontend/src/lib/fieldParser.ts) turns a field name plus
  a user record into the string that gets drawn.

```typescript
// The dropdown list is a curated subset...
export const STANDARD_FIELDS = [
  'firstName', 'firstName_AllCaps', 'firstName_TitleCase',
  'fullName_First_Last', 'fullName_First_LineBreak_Last',
  // ... etc
]

// ...but any well-formed combination resolves, case-insensitively
normalizeStandardFieldName('FULLNAME_FIRST_LINEBREAK_LAST')
// -> 'fullName_First_LineBreak_Last'

normalizeStandardFieldName('Layer_2')
// -> null
```

[`autoMapping.ts`](../frontend/src/lib/autoMapping.ts) then adds the common
variations and the `custom` prefix rule on top:

```typescript
// Special variations are recognized
if (normalizedId === 'profilephoto') {
  mapping = { svgLayerId: fieldId, standardFieldName: 'photo' }
}

// Custom fields (starting with "custom")
if (normalizedId.startsWith('custom')) {
  mapping = {
    svgLayerId: fieldId,
    standardFieldName: '__custom__',
    customValue: field.label || ''
  }
}
```

This system allows you to create templates that work immediately without manual configuration, while still providing flexibility for custom needs.
