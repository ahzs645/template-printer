import {
  createCardDesign,
  createUser,
  getDatabase,
  getUserById,
  listCardDesigns,
  listTemplates,
  updateUser,
} from '../src/db.js'

const SAMPLE_CARD_DESIGNS = [
  {
    name: 'Demo Canon Layout',
    description: 'Front/back example that links the Canon tray layout to the LibreBadge back.',
    frontTemplateId: 'canon-mp-tray',
    backTemplateId: 'libre-badge',
  },
  {
    name: 'Demo LibreBadge',
    description: 'Single-sided badge example based on the LibreBadge template.',
    frontTemplateId: 'libre-badge',
    backTemplateId: null,
  },
]

const SAMPLE_USERS = [
  {
    id: 'demo-user-1',
    firstName: 'Jamie',
    lastName: 'Reyes',
    studentId: 'S123456',
    department: 'Engineering',
    position: 'Student',
    grade: '11',
    email: 'jamie.reyes@example.edu',
    phoneNumber: '(555) 010-1001',
    address: '123 Campus Way',
    emergencyContact: 'Alex Reyes (555) 010-1002',
    issueDate: '2024-09-01',
    expiryDate: '2025-09-01',
    cardDesignName: 'Demo Canon Layout',
  },
  {
    id: 'demo-user-2',
    firstName: 'Priya',
    lastName: 'Patel',
    studentId: 'LIB-2024-02',
    department: 'Library',
    position: 'Staff',
    email: 'priya.patel@example.edu',
    phoneNumber: '(555) 010-2002',
    address: '200 Library Loop',
    emergencyContact: 'Sanjay Patel (555) 010-2003',
    issueDate: '2024-01-15',
    expiryDate: '2026-01-15',
    cardDesignName: 'Demo LibreBadge',
  },
]

function main() {
  getDatabase() // Ensures schema + default template seeds exist

  const templatesById = indexTemplates()
  const { cardDesignsByName, createdCardDesigns } = ensureCardDesigns(templatesById)
  const { insertedUsers, updatedUsers } = ensureUsers(cardDesignsByName)

  logSummary({ templatesById, createdCardDesigns, insertedUsers, updatedUsers })
}

function indexTemplates() {
  const templates = listTemplates()
  const map = new Map(templates.map((template) => [template.id, template]))
  return map
}

function ensureCardDesigns(templatesById) {
  const existingDesigns = listCardDesigns()
  const cardDesignsByName = new Map(existingDesigns.map((design) => [design.name.toLowerCase(), design]))
  const createdCardDesigns = []

  for (const designSeed of SAMPLE_CARD_DESIGNS) {
    const normalizedName = designSeed.name.toLowerCase()
    if (cardDesignsByName.has(normalizedName)) {
      continue
    }

    const missingTemplateIds = [designSeed.frontTemplateId, designSeed.backTemplateId].filter(
      (id) => id && !templatesById.has(id),
    )

    if (missingTemplateIds.length > 0) {
      console.warn(
        `Skipping "${designSeed.name}" because required templates are missing: ${missingTemplateIds.join(', ')}`,
      )
      continue
    }

    const created = createCardDesign(designSeed)
    cardDesignsByName.set(normalizedName, created)
    createdCardDesigns.push(created.name)
  }

  return { cardDesignsByName, createdCardDesigns }
}

function ensureUsers(cardDesignsByName) {
  const insertedUsers = []
  const updatedUsers = []

  for (const userSeed of SAMPLE_USERS) {
    const { cardDesignName, ...userData } = userSeed
    const normalizedDesignName = cardDesignName?.toLowerCase() ?? null
    const designId = normalizedDesignName ? cardDesignsByName.get(normalizedDesignName)?.id ?? null : null
    const payload = { ...userData, cardDesignId: designId }

    const existing = getUserById(userSeed.id)
    if (existing) {
      updateUser(userSeed.id, payload)
      updatedUsers.push(userSeed.id)
    } else {
      createUser(payload)
      insertedUsers.push(userSeed.id)
    }
  }

  return { insertedUsers, updatedUsers }
}

function logSummary({ templatesById, createdCardDesigns, insertedUsers, updatedUsers }) {
  const availableTemplates = Array.from(templatesById.keys())
  console.log('Demo data ready:')
  console.log(`- Templates available: ${availableTemplates.join(', ') || 'none'}`)
  console.log(
    `- Card designs: ${createdCardDesigns.length === 0 ? 'reused existing' : `added ${createdCardDesigns.length}`}`,
  )
  console.log(`- Users inserted: ${insertedUsers.length}, updated: ${updatedUsers.length}`)
}

main()
