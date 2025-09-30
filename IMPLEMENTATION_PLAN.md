# User Database System Implementation Plan

## Overview
Transform the ID Card Maker from a single-card system to a multi-user database system with standardized fields, batch export, and shadcn/ui interface.

## Standardized Field Naming Convention

### Pattern
```
{fieldType}_{format}_{capitalization}
```

### Capitalization Suffixes
- `_AllCaps` or `_UPPER` → ALL UPPERCASE
- `_TitleCase` or `_Title` → Title Case
- `_LowerCase` or `_LOWER` → all lowercase
- (no suffix) → As stored in database

### Individual Name Fields
- `firstName`, `firstName_AllCaps`, `firstName_TitleCase`
- `lastName`, `lastName_AllCaps`, `lastName_TitleCase`
- `middleName`, `middleName_AllCaps`, `middleName_TitleCase`
- `middleInitial`, `middleInitial_AllCaps`

### Composite Name Fields (First-Last Order)
- `fullName_First_Last` → "TIMBER WOLVES"
- `fullName_First_MiddleInitial_Last` → "TIMBER J. WOLVES"
- `fullName_First_Middle_Last` → "TIMBER JAMES WOLVES"

### Composite Name Fields (Last-First with Comma)
- `fullName_Last_Comma_First` → "WOLVES, TIMBER"
- `fullName_Last_Comma_First_MiddleInitial` → "WOLVES, TIMBER J."
- `fullName_Last_Comma_First_Middle` → "WOLVES, TIMBER JAMES"

### Other Fields
- `studentId`, `department`, `position`, `grade`, `email`, `phoneNumber`
- `photo`, `signature`, `logo`
- `issueDate`, `expiryDate`, `birthDate`

---

## Database Schema

###users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL,
  middleName TEXT,
  studentId TEXT,
  department TEXT,
  position TEXT,
  grade TEXT,
  email TEXT,
  phoneNumber TEXT,
  address TEXT,
  emergencyContact TEXT,
  photoPath TEXT,
  signaturePath TEXT,
  issueDate TEXT,
  expiryDate TEXT,
  birthDate TEXT,
  metadata TEXT, -- JSON for custom fields
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### template_field_mappings Table
```sql
CREATE TABLE template_field_mappings (
  id TEXT PRIMARY KEY,
  templateId TEXT NOT NULL,
  svgLayerId TEXT NOT NULL,
  standardFieldName TEXT NOT NULL,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (templateId) REFERENCES templates(id) ON DELETE CASCADE
);
```

---

## New UI Structure

### Tab Navigation
1. **Design** - Template design and field mapping
2. **Users** - User database management (NEW)
3. **Export** - Batch export with user selection

---

## Phase 1: Backend Infrastructure

### Tasks:
1. Create `users` table in database
2. Create `template_field_mappings` table
3. Add API endpoints:
   - `GET /api/users` - List all users
   - `POST /api/users` - Create user
   - `GET /api/users/:id` - Get user
   - `PUT /api/users/:id` - Update user
   - `DELETE /api/users/:id` - Delete user
   - `POST /api/users/import-csv` - Bulk import from CSV
   - `GET /api/users/export-csv` - Export to CSV
   - `POST /api/users/:id/photo` - Upload user photo
   - `GET /api/templates/:id/field-mappings` - Get field mappings
   - `PUT /api/templates/:id/field-mappings` - Save field mappings

### Files to modify:
- `/backend/src/db.js` - Add new tables and CRUD functions
- `/backend/src/routes/users.js` - New routes file
- `/backend/src/app.js` - Register new routes

---

## Phase 2: Field Name Parser

### Create `/frontend/src/lib/fieldParser.ts`

Functions:
- `parseFieldName(layerId: string)` → Parse standardized field name
- `formatFieldValue(user, fieldName)` → Format user data according to field rules
- `detectStandardFields(svgDoc)` → Auto-detect standard fields in SVG
- `applyCasing(text, casing)` → Apply capitalization rules

Example:
```typescript
parseFieldName('fullName_Last_Comma_First_MiddleInitial_AllCaps')
// Returns: {
//   type: 'fullName',
//   format: ['Last', 'Comma', 'First', 'MiddleInitial'],
//   casing: 'AllCaps'
// }

formatFieldValue(user, 'fullName_Last_Comma_First_MiddleInitial_AllCaps')
// Returns: "WOLVES, TIMBER J."
```

---

## Phase 3: Users Tab UI (shadcn/ui)

### Components to create:
- `/frontend/src/components/ui/button.tsx` - shadcn Button
- `/frontend/src/components/ui/input.tsx` - shadcn Input
- `/frontend/src/components/ui/table.tsx` - shadcn Table
- `/frontend/src/components/ui/dialog.tsx` - shadcn Dialog
- `/frontend/src/components/ui/select.tsx` - shadcn Select
- `/frontend/src/components/UsersTab.tsx` - Main users management UI
- `/frontend/src/components/UserForm.tsx` - Add/Edit user form
- `/frontend/src/components/CSVImport.tsx` - CSV import dialog

### Features:
- User list table with search/filter
- Add/Edit/Delete users
- Photo upload
- CSV import/export
- Pagination

---

## Phase 4: Design Tab Updates

### Changes:
- Add field mapping UI after template upload
- Auto-detect standard field names from SVG layer IDs
- Manual mapping interface for unmapped fields
- Save mappings to database
- Preview with sample data

### New Components:
- `/frontend/src/components/FieldMappingDialog.tsx`
- Update `/frontend/src/components/TemplateSidebar.tsx`

---

## Phase 5: Export Tab Updates

### Changes:
- Add user selection (single/multiple/all)
- Show user list with checkboxes
- Preview selected users' cards
- Option: same user repeated OR different users on print layout
- Batch export to single PDF

### New Components:
- `/frontend/src/components/UserSelector.tsx`
- Update `/frontend/src/components/ExportPage.tsx`

---

## Phase 6: Quick Mode Toggle

### Feature:
- Toggle between "Quick Mode" (current single-user workflow) and "Database Mode"
- Quick Mode: Direct data entry, immediate export
- Database Mode: Select from users, batch export

---

## Implementation Order

### Session 1 (Current):
✅ Install shadcn/ui dependencies
✅ Configure Tailwind CSS
✅ Add `cn` utility function
- Create users database table
- Create basic user CRUD API endpoints

### Session 2:
- Create field parser library
- Build basic shadcn UI components (Button, Input, Table, Dialog)
- Create Users Tab skeleton

### Session 3:
- Complete Users Tab with CRUD operations
- Add photo upload
- Implement CSV import/export

### Session 4:
- Update Design Tab with field mapping
- Auto-detection of standard fields
- Field mapping UI

### Session 5:
- Update Export Tab for batch export
- User selection interface
- Multi-user preview

### Session 6:
- Add Quick Mode toggle
- Testing and bug fixes
- Documentation

---

## Questions & Decisions

1. **Field Mapping**: Auto-detect + manual override ✓
2. **Photo Storage**: File paths in database ✓
3. **CSV Format**: Custom headers, provide template download ✓
4. **Print Layout**: Support both same-user repeat and multi-user ✓
5. **Validation**: Optional (not required) ✓
6. **Quick Mode**: Keep alongside database mode ✓

---

## Next Steps

Ready to proceed? We'll start with:
1. Creating the users database table
2. Building basic user API endpoints
3. Testing the endpoints

After that, we'll move to the field parser and UI components.

Let me know if you want to adjust anything in this plan!
