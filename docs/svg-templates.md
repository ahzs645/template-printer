# SVG Template Usage

This guide explains how to create, upload, and use SVG templates in the Template Printer application.

## Template Types

There are two types of templates in the system:

### Design Templates
Individual ID card designs that contain editable fields.

**Characteristics**:
- Single card layout
- Contains user-specific fields (name, photo, etc.)
- Used in the Design tab for field mapping
- Exported with user data

### Print Layout Templates
Physical printer tray layouts that contain multiple card positions.

**Characteristics**:
- Multiple card positions on a single page
- Designed to match printer tray dimensions
- Contains placeholder slots for design templates
- Used in the Export tab for batch printing

## Creating Design Templates

### Requirements

1. **SVG Format**: Save your design as an SVG file
2. **Text Elements**: Use `<text>` or `<tspan>` elements for editable text
3. **Image Elements**: Use `<image>` elements for photos/signatures
4. **Layer IDs**: Give meaningful IDs to editable elements

### Design Process

#### 1. Create Your Design in a Vector Editor

Use tools like:
- Inkscape (free, open-source)
- Adobe Illustrator
- Figma (export as SVG)
- Affinity Designer

#### 2. Set Up Editable Fields

For each field you want to be editable:

1. Create a text element
2. Set its ID/layer name to a standard field name (see [SVG Layer Naming](./svg-layer-naming.md))
3. Add placeholder text

**Example in Inkscape**:
- Right-click text → Object Properties
- Set ID to `fullName_Last_Comma_First_MiddleInitial_AllCaps`

#### 3. Add Image Placeholders

For photos and signatures:

1. Insert a placeholder image (any image will do)
2. Set its ID to `photo`, `signature`, or `logo`
3. Size and position it appropriately

#### 4. Optimize Your SVG

Before uploading:

1. Convert all text to paths if using custom fonts (or upload fonts separately)
2. Remove unnecessary metadata
3. Save as "Plain SVG" or "Optimized SVG"

### Example Design Template

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg width="400" height="600" xmlns="http://www.w3.org/2000/svg">
  <!-- Background card -->
  <rect width="400" height="600" fill="#ffffff" stroke="#000000" stroke-width="2"/>

  <!-- Header with school name (custom static text) -->
  <text id="customSchoolName" x="200" y="40"
        text-anchor="middle" font-size="24" font-weight="bold">
    EXAMPLE UNIVERSITY
  </text>

  <!-- Photo placeholder -->
  <image id="photo" x="150" y="80" width="100" height="120"
         href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"/>

  <!-- Name field -->
  <text id="fullName_Last_Comma_First_MiddleInitial_AllCaps"
        x="200" y="230" text-anchor="middle" font-size="18" font-weight="bold">
    SAMPLE, USER A.
  </text>

  <!-- Student ID -->
  <text id="studentId" x="200" y="260"
        text-anchor="middle" font-size="14">
    123456
  </text>

  <!-- Department -->
  <text id="department_TitleCase" x="200" y="290"
        text-anchor="middle" font-size="14">
    Computer Science
  </text>

  <!-- Position -->
  <text id="position" x="200" y="320"
        text-anchor="middle" font-size="14">
    Student
  </text>

  <!-- Issue/Expiry dates -->
  <text x="50" y="550" font-size="10">Issue:</text>
  <text id="issueDate" x="90" y="550" font-size="10">01/01/2024</text>

  <text x="250" y="550" font-size="10">Expires:</text>
  <text id="expiryDate" x="300" y="550" font-size="10">12/31/2024</text>
</svg>
```

## Creating Print Layout Templates

Print layout templates define where design templates should be positioned on a printed page.

### Requirements

1. **Correct dimensions**: Match your printer's paper/tray size
2. **Placeholder groups**: Use `<g>` elements with ID pattern `slot-{number}`
3. **Correct positioning**: Position slots to match physical card positions

### Common Printer Layouts

#### Canon MP Tray (Dual Card)

```xml
<svg width="215.9mm" height="279.4mm" viewBox="0 0 2159 2794" xmlns="http://www.w3.org/2000/svg">
  <!-- Slot 1 (Top position) -->
  <g id="slot-1" transform="translate(790, 600)">
    <!-- Design template will be inserted here -->
  </g>

  <!-- Slot 2 (Bottom position) -->
  <g id="slot-2" transform="translate(790, 1700)">
    <!-- Design template will be inserted here -->
  </g>
</svg>
```

#### Standard A4 Layout (4 cards)

```xml
<svg width="210mm" height="297mm" viewBox="0 0 2100 2970" xmlns="http://www.w3.org/2000/svg">
  <g id="slot-1" transform="translate(100, 100)"/>
  <g id="slot-2" transform="translate(1150, 100)"/>
  <g id="slot-3" transform="translate(100, 1535)"/>
  <g id="slot-4" transform="translate(1150, 1535)"/>
</svg>
```

### How Slots Work

During export:
1. The system finds all `<g>` elements with IDs starting with `slot-`
2. For each slot, it inserts a copy of the design template
3. User data is applied to each inserted template
4. The complete page is rendered to PDF

## Uploading Templates

### Upload a Design Template

1. Go to the **Design** tab
2. Click **Upload Template**
3. Select your SVG file
4. Enter template name and description
5. Click **Upload**
6. Map fields using the field mapping dialog

### Upload a Print Layout Template

1. Go to the **Export** tab
2. Under "Print Layout", click **Upload New Layout**
3. Select your SVG file
4. Enter layout name (e.g., "Canon MP Tray")
5. Click **Upload**

## Working with Fonts

If your template uses custom fonts:

### Option 1: Convert Text to Paths
Before exporting your SVG, convert all text to paths. This embeds the font shapes directly in the SVG.

**Pros**: No font upload needed
**Cons**: Text is no longer editable in the template

### Option 2: Upload Fonts to the System

1. Go to the **Design** tab
2. Scroll to the **Fonts** section in the sidebar
3. Click **Upload Font**
4. Select a `.ttf` or `.otf` font file
5. The font will be embedded in all exported PDFs

**Pros**: Text remains editable
**Cons**: Must upload fonts separately

## Template Management

### Viewing Templates

**Design Templates**:
- View in the **Design** tab sidebar
- Click a template to load it for editing
- Shows mapped fields and status

**Print Layouts**:
- View in the **Export** tab
- Select from the "Print Layout" dropdown

### Deleting Templates

1. Hover over the template in the list
2. Click the delete icon (trash can)
3. Confirm deletion

**Warning**: Deleting a template also deletes its field mappings.

## Best Practices

### Design Templates

1. **Use standard dimensions**: Common ID card size is 85.6mm × 53.98mm (CR80)
2. **Leave margins**: Add 2-3mm margins for safe printing areas
3. **Use standard field names**: Follow the naming convention for auto-mapping
4. **Test with sample data**: Use the preview to check field positioning
5. **Consider both orientations**: Portrait for vertical cards, landscape for horizontal

### Print Layout Templates

1. **Measure your printer tray**: Use exact dimensions for best results
2. **Account for margins**: Printers often can't print to the edge
3. **Test with one card first**: Print a single card to verify positioning
4. **Mark slot numbers**: Add visual indicators in your template (optional)
5. **Use transforms for positioning**: The `transform` attribute is the easiest way to position slots

### General Tips

1. **Keep file sizes small**: Optimize images and remove unnecessary elements
2. **Use viewBox**: Set a viewBox for better scaling
3. **Avoid external resources**: Embed images as data URLs or upload them separately
4. **Test across different users**: Check that fields work with varying data lengths
5. **Document custom fields**: Add comments in your SVG for future reference

## Troubleshooting

### Text Not Showing Correctly

**Problem**: Text appears cut off or in wrong position.

**Solutions**:
- Check text-anchor attribute (start, middle, end)
- Increase text element's bounding box
- Verify font-size is appropriate

### Images Not Displaying

**Problem**: Photo placeholder not showing user photos.

**Solutions**:
- Ensure element is `<image>`, not `<rect>` or `<circle>`
- Check that ID is set to `photo`, `signature`, or `logo`
- Verify image dimensions are reasonable (not too small)

### Print Layout Misaligned

**Problem**: Cards don't line up with printer tray.

**Solutions**:
- Verify SVG dimensions match paper size
- Check slot transform values
- Print a test page with alignment marks
- Adjust margins in printer settings

### Fields Not Auto-Mapping

**Problem**: Uploaded template shows all fields as unmapped.

**Solutions**:
- Check layer IDs match standard field names
- Ensure IDs don't have spaces or special characters
- Use the manual mapping dialog to map fields
- See [SVG Layer Naming](./svg-layer-naming.md) for naming rules

## Examples

The application includes example templates in `/backend/data/templates.json`:

- **Canon MP Tray Layout**: Dual-card printer tray for Canon printers
- **LibreBadge Sample**: Sample badge template from the LibreBadge project

You can examine these templates as reference when creating your own.

## Advanced Topics

### Dynamic Field Sizing

Currently, text doesn't automatically resize to fit. Consider these approaches:

1. **Use appropriate font sizes**: Test with longest expected text
2. **Abbreviate long text**: Use middle initial instead of full middle name
3. **Design for overflow**: Position elements so overflow is less noticeable

### Multi-Page Exports

To export multiple pages in a single PDF:

1. Use a print layout template
2. Select multiple users in Export mode
3. The system automatically creates multiple pages (one per layout)

### Custom Field Formatting

For special formatting needs:

1. Use custom static text for unchanging values
2. Use field variants (e.g., `firstName_AllCaps` vs `firstName`)
3. Combine multiple fields creatively (use both `firstName` and `lastName` separately)

## Next Steps

- Review [SVG Layer Naming](./svg-layer-naming.md) for field naming conventions
- Check [User Database Fields](./user-database.md) for available data fields
- Create your first template and test it with sample users
