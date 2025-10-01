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

## Auto-Mapping Rules

The auto-mapping system follows these rules in order:

### 1. Exact Match
If a layer ID exactly matches a standard field name, it's automatically mapped.

**Example**: Layer `firstName_AllCaps` → Auto-mapped to `firstName_AllCaps`

### 2. Case-Insensitive Match
If a layer ID matches a standard field when compared case-insensitively, it's mapped to the correct casing.

**Example**: Layer `FIRSTNAME_ALLCAPS` → Auto-mapped to `firstName_AllCaps`

### 3. Common Variations
Some common variations are recognized:

| Layer ID | Auto-Mapped To |
|----------|---------------|
| `profilePhoto`, `profile`, `userPhoto` | `photo` |
| `studentid`, `student_id`, `id` | `studentId` |
| `fullname`, `name` | `fullName_Last_Comma_First_MiddleInitial_AllCaps` |

### 4. Custom Fields
Layers starting with "custom" are automatically mapped as custom static text:

**Example**: Layer `customSchoolName` → Auto-mapped to custom field with the layer's current text as the default value

## Creating SVG Templates for Auto-Mapping

### Best Practices

1. **Use descriptive layer IDs**: Name your layers exactly as shown in the standard field list
2. **Use text elements for text fields**: Ensure text fields use `<text>` or `<tspan>` elements
3. **Use image elements for photos**: Photo placeholders should use `<image>` elements
4. **Group related elements**: You can group elements under a layer, but the layer ID is what matters

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
- Check that the layer ID matches exactly (case-sensitive)
- Ensure the layer is a `<text>` element (for text fields) or `<image>` element (for photos)
- Use the manual mapping dialog to map it manually

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

The field parser ([autoMapping.ts](../frontend/src/lib/autoMapping.ts)) handles the automatic mapping logic:

```typescript
// Standard fields are checked first
const STANDARD_FIELDS = [
  'firstName', 'firstName_AllCaps', 'firstName_TitleCase',
  'lastName', 'lastName_AllCaps', 'lastName_TitleCase',
  // ... etc
]

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
