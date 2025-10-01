# User Database Fields

The Template Printer maintains a user database with comprehensive field support for ID card generation. This document describes all supported fields and their usage.

## Database Schema

Users are stored in the `users` table with the following fields:

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
  metadata TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## Required Fields

### firstName (TEXT, required)
The user's first name or given name.

**Examples**: "John", "Mary", "李"

**Validation**: Cannot be empty.

**Available in templates as**:
- `firstName` - As entered
- `firstName_AllCaps` - "JOHN"
- `firstName_TitleCase` - "John"
- `firstName_LowerCase` - "john"

### lastName (TEXT, required)
The user's last name or surname.

**Examples**: "Smith", "García", "王"

**Validation**: Cannot be empty.

**Available in templates as**:
- `lastName` - As entered
- `lastName_AllCaps` - "SMITH"
- `lastName_TitleCase` - "Smith"
- `lastName_LowerCase` - "smith"

## Optional Personal Information

### middleName (TEXT, optional)
The user's middle name.

**Examples**: "Allen", "Marie", "中"

**Available in templates as**:
- `middleName` - Full middle name
- `middleName_AllCaps` - "ALLEN"
- `middleName_TitleCase` - "Allen"
- `middleInitial` - First letter only: "A"
- `middleInitial_AllCaps` - "A"

### birthDate (TEXT, optional)
The user's date of birth.

**Format**: Any string format (commonly "YYYY-MM-DD" or "MM/DD/YYYY")

**Examples**: "1995-06-15", "06/15/1995", "June 15, 1995"

**Available in templates as**: `birthDate`

### photoPath (TEXT, optional)
Path or data URL to the user's photo.

**Storage formats**:
- File path: `/uploads/user-photo-123.jpg`
- Data URL: `data:image/jpeg;base64,/9j/4AAQSkZJRg...`

**Available in templates as**: `photo`

**Note**: When uploading via the UI, photos are stored as base64 data URLs directly in the database.

### signaturePath (TEXT, optional)
Path or data URL to the user's signature image.

**Storage formats**: Same as photoPath

**Available in templates as**: `signature`

## Organizational Fields

### studentId (TEXT, optional)
Student ID, employee ID, or member number.

**Examples**: "S12345678", "EMP-001", "2024-1001"

**Available in templates as**: `studentId`

**CSV Import Aliases**: Also recognized as `id` or `student_id`

### department (TEXT, optional)
Department, school, division, or organizational unit.

**Examples**: "Computer Science", "Marketing", "Grade 10-A"

**Available in templates as**:
- `department`
- `department_AllCaps`
- `department_TitleCase`

**CSV Import Aliases**: Also recognized as `dept`

### position (TEXT, optional)
Job title, role, or position within the organization.

**Examples**: "Student", "Teacher", "Senior Developer", "Manager"

**Available in templates as**:
- `position`
- `position_AllCaps`
- `position_TitleCase`

### grade (TEXT, optional)
Grade level, class, year, or academic standing.

**Examples**: "10", "Senior", "Year 3", "Freshman"

**Available in templates as**: `grade`

**CSV Import Aliases**: Also recognized as `class`

## Contact Information

### email (TEXT, optional)
Email address.

**Examples**: "john.smith@example.com", "user@university.edu"

**Available in templates as**: `email`

### phoneNumber (TEXT, optional)
Phone number or mobile number.

**Format**: Free-form text (no validation)

**Examples**: "+1-555-0100", "(555) 123-4567", "555-0100"

**Available in templates as**: `phoneNumber`

**CSV Import Aliases**: Also recognized as `phone`

### address (TEXT, optional)
Physical address or mailing address.

**Examples**: "123 Main St, City, State 12345", "Building A, Room 101"

**Available in templates as**: `address`

### emergencyContact (TEXT, optional)
Emergency contact information (name, relationship, phone).

**Examples**:
- "Jane Smith (Mother) - 555-0101"
- "Emergency: 555-0102"
- "Parent: John Smith Sr."

**Available in templates as**: `emergencyContact`

## Card Validity Fields

### issueDate (TEXT, optional)
Date the ID card was issued.

**Format**: Any string format (commonly "YYYY-MM-DD" or "MM/DD/YYYY")

**Examples**: "2024-01-01", "01/01/2024", "January 1, 2024"

**Available in templates as**: `issueDate`

### expiryDate (TEXT, optional)
Date the ID card expires.

**Format**: Any string format (commonly "YYYY-MM-DD" or "MM/DD/YYYY")

**Examples**: "2025-12-31", "12/31/2025", "December 31, 2025"

**Available in templates as**: `expiryDate`

## System Fields

### id (TEXT, primary key)
Unique identifier for the user record.

**Format**: Auto-generated as `user-{timestamp}-{random}`

**Example**: "user-1672531200000-abc123"

**Note**: Not typically used in templates.

### metadata (TEXT, optional)
JSON string for storing additional custom fields not covered by the schema.

**Format**: JSON string

**Example**: `{"customField1": "value1", "customField2": "value2"}`

**Note**: Currently not exposed in the template system but available for future expansion.

### createdAt (TEXT, auto-generated)
Timestamp when the user record was created.

**Format**: SQLite CURRENT_TIMESTAMP (ISO 8601)

**Example**: "2024-01-01 12:00:00"

### updatedAt (TEXT, auto-generated)
Timestamp when the user record was last updated.

**Format**: SQLite CURRENT_TIMESTAMP (ISO 8601)

**Example**: "2024-01-15 14:30:00"

**Note**: Automatically updated on each UPDATE operation.

## Composite Name Fields

In addition to individual name fields, several composite formats are available in templates:

### First-Last Order

```
fullName_First_Last
  → "John Smith"

fullName_First_Last_AllCaps
  → "JOHN SMITH"

fullName_First_MiddleInitial_Last
  → "John A. Smith"

fullName_First_MiddleInitial_Last_AllCaps
  → "JOHN A. SMITH"

fullName_First_Middle_Last
  → "John Allen Smith"

fullName_First_Middle_Last_AllCaps
  → "JOHN ALLEN SMITH"
```

### Last-First Order (with Comma)

```
fullName_Last_Comma_First
  → "Smith, John"

fullName_Last_Comma_First_AllCaps
  → "SMITH, JOHN"

fullName_Last_Comma_First_MiddleInitial
  → "Smith, John A."

fullName_Last_Comma_First_MiddleInitial_AllCaps
  → "SMITH, JOHN A."

fullName_Last_Comma_First_Middle
  → "Smith, John Allen"

fullName_Last_Comma_First_Middle_AllCaps
  → "SMITH, JOHN ALLEN"
```

**See Also**: [SVG Layer Naming](./svg-layer-naming.md) for complete field naming documentation.

## CSV Import/Export

### CSV Import Format

The system supports CSV import with flexible header mapping. Here are the recognized headers:

| CSV Header | Maps To Field |
|------------|---------------|
| `firstName`, `firstname`, `First Name` | `firstName` |
| `lastName`, `lastname`, `surname`, `Surname`, `Last Name` | `lastName` |
| `middleName`, `middlename`, `Middle Name` | `middleName` |
| `studentId`, `studentid`, `id`, `ID`, `Student ID` | `studentId` |
| `department`, `dept`, `Department` | `department` |
| `position`, `Position` | `position` |
| `grade`, `class`, `Grade`, `Class` | `grade` |
| `email`, `Email` | `email` |
| `phoneNumber`, `phonenumber`, `phone`, `Phone` | `phoneNumber` |
| `address`, `Address` | `address` |
| `emergencyContact`, `emergencycontact`, `Emergency Contact` | `emergencyContact` |
| `issueDate`, `issuedate`, `Issue Date` | `issueDate` |
| `expiryDate`, `expirydate`, `Expiry Date` | `expiryDate` |
| `birthDate`, `birthdate`, `Birth Date` | `birthDate` |

**Implementation**: See [users.js:127-148](../backend/src/routes/users.js#L127) for the complete field mapping logic.

### CSV Import Process

1. Navigate to the **Users** tab
2. Click **Import CSV**
3. Select your CSV file
4. The system will:
   - Parse headers (first row)
   - Map columns to database fields
   - Validate required fields (firstName, lastName)
   - Create user records
   - Report success count and any errors

### CSV Export Format

The system exports all user fields (except photos and signatures) in this order:

```csv
firstName,lastName,middleName,studentId,department,position,grade,email,phoneNumber,address,emergencyContact,issueDate,expiryDate,birthDate
John,Smith,Allen,S12345,Computer Science,Student,Senior,john@example.com,555-0100,123 Main St,Jane Smith - 555-0101,01/01/2024,12/31/2024,06/15/1995
```

**Note**: Photos and signatures are not included in CSV export as they are binary data.

### Example CSV Template

```csv
firstName,lastName,middleName,studentId,department,position,grade,email
John,Smith,Allen,S12345,Computer Science,Student,12,john.smith@example.com
Mary,Johnson,,S12346,Mathematics,Student,11,mary.johnson@example.com
Robert,Williams,James,S12347,Physics,Student,12,robert.williams@example.com
```

## Working with User Data

### Adding Users

**Via UI**:
1. Go to **Users** tab
2. Click **Add User**
3. Fill in firstName and lastName (required)
4. Fill in optional fields as needed
5. Click **Save**

**Via API**:
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Smith",
    "studentId": "S12345",
    "department": "Computer Science"
  }'
```

### Uploading Photos

**Via UI**:
1. In the **Users** tab, click on a user
2. Click **Upload Photo**
3. Select an image file (JPG, PNG, etc.)
4. Photo is stored as base64 data URL in `photoPath`

**Via API**:
```bash
curl -X POST http://localhost:3000/api/users/{userId}/upload-photo \
  -F "photo=@/path/to/photo.jpg"
```

### Updating Users

**Via UI**:
1. In the **Users** tab, click the edit icon
2. Modify fields
3. Click **Save**

**Note**: The `updatedAt` timestamp is automatically updated.

### Deleting Users

**Via UI**:
1. In the **Users** tab, click the delete icon
2. Confirm deletion

**Warning**: Deletion is permanent and cannot be undone.

## API Reference

### List All Users
```
GET /api/users
```

Returns array of all users sorted by lastName, firstName.

### Get Single User
```
GET /api/users/:id
```

Returns user object or 404 if not found.

### Create User
```
POST /api/users
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Smith",
  "middleName": "Allen",
  "studentId": "S12345",
  "department": "Computer Science",
  "position": "Student",
  "grade": "12",
  "email": "john.smith@example.com",
  "phoneNumber": "555-0100",
  "address": "123 Main St",
  "emergencyContact": "Jane Smith - 555-0101",
  "issueDate": "01/01/2024",
  "expiryDate": "12/31/2024",
  "birthDate": "06/15/1995"
}
```

Returns created user object with generated ID.

### Update User
```
PUT /api/users/:id
Content-Type: application/json

{
  "email": "newemail@example.com",
  "phoneNumber": "555-9999"
}
```

Partial update supported. Returns updated user object.

### Delete User
```
DELETE /api/users/:id
```

Returns deleted user object or 404 if not found.

### Import CSV
```
POST /api/users/import-csv
Content-Type: multipart/form-data

file: [CSV file]
```

Returns `{ created: number, errors: string[] }`.

### Export CSV
```
GET /api/users/export-csv
```

Returns CSV file download.

### Upload Photo
```
POST /api/users/:id/upload-photo
Content-Type: multipart/form-data

photo: [image file]
```

Returns updated user object with photoPath set to data URL.

## Best Practices

### Data Entry

1. **Use consistent formats**: Establish date/phone formats and stick to them
2. **Validate before import**: Check CSV files for completeness
3. **Use meaningful IDs**: StudentId should follow your organization's format
4. **Keep photos optimized**: Use reasonable image sizes (< 500KB recommended)

### Data Management

1. **Regular backups**: The database is stored in `/backend/data/database.db`
2. **Export to CSV periodically**: Keep external backups of user data
3. **Clean up expired records**: Delete users whose cards have expired
4. **Test with sample data**: Create test users before bulk import

### Privacy Considerations

1. **Secure the database**: Restrict access to the backend/data directory
2. **Use HTTPS in production**: Protect data in transit
3. **Limit photo resolution**: Don't store unnecessarily high-resolution photos
4. **Follow local regulations**: Comply with data protection laws (GDPR, etc.)

## Extending the Schema

The `metadata` field is provided for future expansion. To add custom fields:

1. Store as JSON in the metadata field:
   ```javascript
   {
     "metadata": JSON.stringify({
       "customField1": "value1",
       "customField2": "value2"
     })
   }
   ```

2. For permanent custom fields, consider adding a database migration to alter the table:
   ```sql
   ALTER TABLE users ADD COLUMN customField TEXT;
   ```

3. Update the API endpoints in [users.js](../backend/src/routes/users.js) to handle the new field

4. Add the field to CSV import/export mappings

## Troubleshooting

### Import Fails with "Missing firstName or lastName"

**Problem**: CSV import reports rows missing required fields.

**Solutions**:
- Check that your CSV has columns named `firstName` and `lastName`
- Ensure rows have values in these columns (not empty)
- Check for extra commas or formatting issues

### Photo Not Displaying

**Problem**: Uploaded photo doesn't show in export.

**Solutions**:
- Verify photo was uploaded successfully (check user record)
- Ensure template has an `<image>` element with id="photo"
- Check that the photo field is mapped correctly

### Date Fields Showing Incorrectly

**Problem**: Dates appear in wrong format in exported cards.

**Solutions**:
- Date fields are stored and displayed as-is (no automatic formatting)
- Format dates before import or entry
- Consider using a consistent format (e.g., "MM/DD/YYYY")

## See Also

- [SVG Layer Naming](./svg-layer-naming.md) - How to reference user fields in templates
- [SVG Template Usage](./svg-templates.md) - Creating templates that use user data
- [Backend Routes](../backend/src/routes/users.js) - User API implementation
- [Database Schema](../backend/src/db.js) - Database table definitions
