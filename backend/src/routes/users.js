import express from 'express'
import { listUsers, getUserById, createUser, updateUser, deleteUser } from '../db.js'
import multer from 'multer'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

// GET /api/users - List all users
router.get('/', (req, res, next) => {
  try {
    const users = listUsers()
    res.json(users)
  } catch (error) {
    next(error)
  }
})

// GET /api/users/:id - Get single user
router.get('/:id', (req, res, next) => {
  try {
    const { id } = req.params
    const user = getUserById(id)
    if (!user) {
      res.status(404).json({ error: 'User not found.' })
      return
    }
    res.json(user)
  } catch (error) {
    next(error)
  }
})

// POST /api/users - Create new user
router.post('/', (req, res, next) => {
  try {
    const userData = req.body

    // Validate required fields
    if (!userData.firstName || !userData.lastName) {
      res.status(400).json({ error: 'firstName and lastName are required.' })
      return
    }

    const newUser = createUser(userData)
    res.status(201).json(newUser)
  } catch (error) {
    next(error)
  }
})

// PUT /api/users/:id - Update user
router.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params
    const userData = req.body

    const existing = getUserById(id)
    if (!existing) {
      res.status(404).json({ error: 'User not found.' })
      return
    }

    // Validate required fields if they are being updated
    const finalFirstName = userData.firstName ?? existing.firstName
    const finalLastName = userData.lastName ?? existing.lastName

    if (!finalFirstName || !finalLastName) {
      res.status(400).json({ error: 'firstName and lastName cannot be empty.' })
      return
    }

    const updated = updateUser(id, userData)
    res.json(updated)
  } catch (error) {
    next(error)
  }
})

// DELETE /api/users/:id - Delete user
router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params
    const deleted = deleteUser(id)

    if (!deleted) {
      res.status(404).json({ error: 'User not found.' })
      return
    }

    res.json({ message: 'User deleted successfully.', user: deleted })
  } catch (error) {
    next(error)
  }
})

// POST /api/users/import-csv - Import users from CSV
router.post('/import-csv', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' })
      return
    }

    const csvContent = req.file.buffer.toString('utf-8')
    const lines = csvContent.split('\n').filter(line => line.trim())

    if (lines.length === 0) {
      res.status(400).json({ error: 'CSV file is empty' })
      return
    }

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim())
    const results = { created: 0, errors: [] }

    // Process each row
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map(v => v.trim())
        const userData = {}

        headers.forEach((header, index) => {
          const value = values[index] || ''
          const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, '')

          // Map CSV headers to database fields
          const fieldMap = {
            firstname: 'firstName',
            firstname: 'firstName',
            lastname: 'lastName',
            surname: 'lastName',
            middlename: 'middleName',
            studentid: 'studentId',
            id: 'studentId',
            department: 'department',
            dept: 'department',
            position: 'position',
            grade: 'grade',
            class: 'grade',
            email: 'email',
            phonenumber: 'phoneNumber',
            phone: 'phoneNumber',
            address: 'address',
            emergencycontact: 'emergencyContact',
            issuedate: 'issueDate',
            expirydate: 'expiryDate',
            birthdate: 'birthDate'
          }

          const dbField = fieldMap[normalized]
          if (dbField) {
            userData[dbField] = value
          }
        })

        // Validate required fields
        if (!userData.firstName || !userData.lastName) {
          results.errors.push(`Row ${i + 1}: Missing firstName or lastName`)
          continue
        }

        createUser(userData)
        results.created++
      } catch (error) {
        results.errors.push(`Row ${i + 1}: ${error.message}`)
      }
    }

    res.json(results)
  } catch (error) {
    next(error)
  }
})

// POST /api/users/:id/upload-photo - Upload user photo
router.post('/:id/upload-photo', upload.single('photo'), (req, res, next) => {
  try {
    const { id } = req.params

    if (!req.file) {
      res.status(400).json({ error: 'No photo uploaded' })
      return
    }

    const user = getUserById(id)
    if (!user) {
      res.status(404).json({ error: 'User not found.' })
      return
    }

    // Convert buffer to base64 data URL
    const mimeType = req.file.mimetype
    const base64 = req.file.buffer.toString('base64')
    const dataUrl = `data:${mimeType};base64,${base64}`

    // Update user with photo data URL
    const updated = updateUser(id, { photoPath: dataUrl })
    res.json(updated)
  } catch (error) {
    next(error)
  }
})

// GET /api/users/export-csv - Export users to CSV
router.get('/export-csv', (req, res, next) => {
  try {
    const users = listUsers()

    // CSV headers
    const headers = [
      'firstName',
      'lastName',
      'middleName',
      'studentId',
      'department',
      'position',
      'grade',
      'email',
      'phoneNumber',
      'address',
      'emergencyContact',
      'issueDate',
      'expiryDate',
      'birthDate'
    ]

    // Build CSV content
    let csv = headers.join(',') + '\n'

    users.forEach(user => {
      const row = headers.map(header => {
        const value = user[header] || ''
        // Escape commas and quotes
        if (value.includes(',') || value.includes('"')) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      })
      csv += row.join(',') + '\n'
    })

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename=users.csv')
    res.send(csv)
  } catch (error) {
    next(error)
  }
})

export default router
