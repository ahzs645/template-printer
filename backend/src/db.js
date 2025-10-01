import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'

import { dataDir, dbPath, publicDir, templatesDir } from './paths.js'

let dbSingleton

export function getDatabase() {
  if (!dbSingleton) {
    dbSingleton = initializeDatabase()
  }
  return dbSingleton
}

export function listTemplates(type = null) {
  const db = getDatabase()
  let query = `SELECT id, name, description, svg_path AS svgPath, thumbnail_path AS thumbnailPath, template_type AS templateType, created_at AS createdAt
       FROM templates`

  if (type) {
    query += ` WHERE template_type = ?`
  }

  query += ` ORDER BY name`

  const stmt = type ? db.prepare(query) : db.prepare(query)
  const rows = type ? stmt.all(type) : stmt.all()

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    svgPath: row.svgPath,
    thumbnailPath: row.thumbnailPath ?? null,
    templateType: row.templateType ?? 'design',
    createdAt: row.createdAt ?? null,
  }))
}

function initializeDatabase() {
  ensureDataDirectory()
  ensureTemplatesDirectory()
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  createSchema(db)
  seedTemplates(db)
  return db
}

function ensureDataDirectory() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
}

function ensureTemplatesDirectory() {
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true })
  }
}

function createSchema(db) {
  const createTemplatesTable = `
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      svg_path TEXT NOT NULL,
      thumbnail_path TEXT,
      template_type TEXT DEFAULT 'design',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `

  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
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
    )
  `

  const createFieldMappingsTable = `
    CREATE TABLE IF NOT EXISTS template_field_mappings (
      id TEXT PRIMARY KEY,
      templateId TEXT NOT NULL,
      svgLayerId TEXT NOT NULL,
      standardFieldName TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (templateId) REFERENCES templates(id) ON DELETE CASCADE
    )
  `

  const createUniqueIndex = `
    CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_name ON templates(name)
  `

  const createFieldMappingIndex = `
    CREATE UNIQUE INDEX IF NOT EXISTS idx_field_mappings_template_layer
    ON template_field_mappings(templateId, svgLayerId)
  `

  db.exec(createTemplatesTable)
  db.exec(createUsersTable)
  db.exec(createFieldMappingsTable)
  db.exec(createUniqueIndex)
  db.exec(createFieldMappingIndex)

  // Migration: Add template_type column if it doesn't exist
  try {
    db.exec(`ALTER TABLE templates ADD COLUMN template_type TEXT DEFAULT 'design'`)
  } catch (error) {
    // Column already exists, ignore error
    if (!error.message.includes('duplicate column name')) {
      throw error
    }
  }
}

function seedTemplates(db) {
  const templates = loadTemplateSeeds()
  if (templates.length === 0) {
    return
  }

  const insert = db.prepare(`
    INSERT INTO templates (id, name, description, svg_path, thumbnail_path, template_type)
    VALUES (@id, @name, @description, @svgPath, @thumbnailPath, @templateType)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      svg_path = excluded.svg_path,
      thumbnail_path = excluded.thumbnail_path,
      template_type = excluded.template_type
  `)

  for (const template of templates) {
    const normalized = normalizeTemplatePaths(template)
    const svgAbsolute = path.join(templatesDir, normalized.svgPath.replace(/^\/templates\//, ''))

    if (!fs.existsSync(svgAbsolute)) {
      console.warn(`Skipping template seed '${template.id}': SVG missing at ${svgAbsolute}`)
      continue
    }

    const thumbnailAbsolute = normalized.thumbnailPath
      ? path.join(publicDir, normalized.thumbnailPath.slice(1))
      : null

    if (thumbnailAbsolute && !fs.existsSync(thumbnailAbsolute)) {
      console.warn(
        `Skipping thumbnail for template '${template.id}': file missing at ${thumbnailAbsolute}`,
      )
    }

    insert.run({
      id: template.id,
      name: template.name,
      description: template.description ?? null,
      svgPath: normalized.svgPath,
      thumbnailPath: thumbnailAbsolute ? normalized.thumbnailPath : null,
      templateType: template.templateType ?? 'design',
    })
  }
}

function loadTemplateSeeds() {
  const seedFile = path.join(dataDir, 'templates.json')
  if (!fs.existsSync(seedFile)) {
    return defaultTemplateSeeds()
  }

  try {
    const fileContents = fs.readFileSync(seedFile, 'utf-8')
    const parsed = JSON.parse(fileContents)
    if (!Array.isArray(parsed)) {
      throw new Error('Seed file must export an array of templates')
    }
    return parsed
  } catch (error) {
    console.error('Failed to load template seeds, falling back to defaults', error)
    return defaultTemplateSeeds()
  }
}

function defaultTemplateSeeds() {
  return [
    {
      id: 'canon-mp-tray',
      name: 'Canon MP Tray Layout',
      description: 'Dual-card tray layout for Canon MP tray printers.',
      svgPath: '/templates/canon-mp-tray.svg',
      thumbnailPath: null,
      templateType: 'print',
    },
    {
      id: 'libre-badge',
      name: 'LibreBadge Sample',
      description: 'LibreBadge badge template imported from the LibreBadge project.',
      svgPath: '/templates/libre-badge.svg',
      thumbnailPath: null,
      templateType: 'print',
    },
  ]
}

export function createTemplateRecord({ id, name, description, svgPath, thumbnailPath, templateType }) {
  const db = getDatabase()
  const cleaned = {
    id,
    name: name?.trim(),
    description: description?.trim() || null,
    svgPath,
    thumbnailPath: thumbnailPath ?? null,
    templateType: templateType ?? 'design',
  }

  if (!cleaned.id) {
    throw new Error('Template id is required')
  }
  if (!cleaned.name) {
    throw new Error('Template name is required')
  }
  if (!cleaned.svgPath) {
    throw new Error('Template svgPath is required')
  }

  const insert = db.prepare(`
    INSERT INTO templates (id, name, description, svg_path, thumbnail_path, template_type)
    VALUES (@id, @name, @description, @svgPath, @thumbnailPath, @templateType)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      svg_path = excluded.svg_path,
      thumbnail_path = excluded.thumbnail_path,
      template_type = excluded.template_type
  `)

  insert.run(cleaned)

  return getTemplateById(cleaned.id)
}

export function getTemplateById(id) {
  const db = getDatabase()
  const row = db
    .prepare(`
      SELECT id, name, description, svg_path AS svgPath, thumbnail_path AS thumbnailPath, template_type AS templateType, created_at AS createdAt
      FROM templates
      WHERE id = ?
    `)
    .get(id)

  if (!row) {
    return null
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    svgPath: row.svgPath,
    thumbnailPath: row.thumbnailPath ?? null,
    templateType: row.templateType ?? 'design',
    createdAt: row.createdAt ?? null,
  }
}

export function deleteTemplate(id) {
  const db = getDatabase()
  const template = getTemplateById(id)

  if (!template) {
    return null
  }

  const deleteStmt = db.prepare('DELETE FROM templates WHERE id = ?')
  deleteStmt.run(id)

  return template
}

function normalizeTemplatePaths(template) {
  const svgPath = normalizePublicPath(template.svgPath, { required: true })
  const thumbnailPath = normalizePublicPath(template.thumbnailPath, { required: false })

  return { svgPath, thumbnailPath }
}

function normalizePublicPath(value, { required }) {
  if (!value && !required) {
    return null
  }

  if (typeof value !== 'string') {
    throw new Error('Expected string value for public asset path')
  }

  const trimmed = value.trim()
  if (!trimmed) {
    if (required) {
      throw new Error('Asset path cannot be empty')
    }
    return null
  }

  const sanitized = trimmed.replace(/^\/+/, '')
  const withPrefix = sanitized.startsWith('templates/') ? sanitized : path.posix.join('templates', sanitized)
  return `/${withPrefix}`
}

// ============================================
// USER CRUD OPERATIONS
// ============================================

export function listUsers() {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT * FROM users ORDER BY lastName, firstName
  `)
  return stmt.all()
}

export function getUserById(id) {
  const db = getDatabase()
  const stmt = db.prepare(`SELECT * FROM users WHERE id = ?`)
  return stmt.get(id) || null
}

export function createUser(userData) {
  const db = getDatabase()
  const id = userData.id || `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

  const stmt = db.prepare(`
    INSERT INTO users (
      id, firstName, lastName, middleName, studentId, department,
      position, grade, email, phoneNumber, address, emergencyContact,
      photoPath, signaturePath, issueDate, expiryDate, birthDate, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    id,
    userData.firstName,
    userData.lastName,
    userData.middleName || null,
    userData.studentId || null,
    userData.department || null,
    userData.position || null,
    userData.grade || null,
    userData.email || null,
    userData.phoneNumber || null,
    userData.address || null,
    userData.emergencyContact || null,
    userData.photoPath || null,
    userData.signaturePath || null,
    userData.issueDate || null,
    userData.expiryDate || null,
    userData.birthDate || null,
    userData.metadata || null
  )

  return getUserById(id)
}

export function updateUser(id, userData) {
  const db = getDatabase()

  // Get existing user to merge with new data
  const existing = getUserById(id)
  if (!existing) return null

  const stmt = db.prepare(`
    UPDATE users SET
      firstName = ?,
      lastName = ?,
      middleName = ?,
      studentId = ?,
      department = ?,
      position = ?,
      grade = ?,
      email = ?,
      phoneNumber = ?,
      address = ?,
      emergencyContact = ?,
      photoPath = ?,
      signaturePath = ?,
      issueDate = ?,
      expiryDate = ?,
      birthDate = ?,
      metadata = ?,
      updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `)

  stmt.run(
    userData.firstName ?? existing.firstName,
    userData.lastName ?? existing.lastName,
    userData.middleName ?? existing.middleName,
    userData.studentId ?? existing.studentId,
    userData.department ?? existing.department,
    userData.position ?? existing.position,
    userData.grade ?? existing.grade,
    userData.email ?? existing.email,
    userData.phoneNumber ?? existing.phoneNumber,
    userData.address ?? existing.address,
    userData.emergencyContact ?? existing.emergencyContact,
    userData.photoPath ?? existing.photoPath,
    userData.signaturePath ?? existing.signaturePath,
    userData.issueDate ?? existing.issueDate,
    userData.expiryDate ?? existing.expiryDate,
    userData.birthDate ?? existing.birthDate,
    userData.metadata ?? existing.metadata,
    id
  )

  return getUserById(id)
}

export function deleteUser(id) {
  const db = getDatabase()
  const user = getUserById(id)
  if (!user) return null

  const stmt = db.prepare(`DELETE FROM users WHERE id = ?`)
  stmt.run(id)

  return user
}

// ============================================
// FIELD MAPPING OPERATIONS
// ============================================

export function getFieldMappings(templateId) {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, templateId, svgLayerId, standardFieldName, createdAt
    FROM template_field_mappings
    WHERE templateId = ?
  `)
  return stmt.all(templateId)
}

export function saveFieldMappings(templateId, mappings) {
  const db = getDatabase()

  // Delete existing mappings for this template
  const deleteStmt = db.prepare(`DELETE FROM template_field_mappings WHERE templateId = ?`)
  deleteStmt.run(templateId)

  // Insert new mappings
  if (mappings.length === 0) return []

  const insertStmt = db.prepare(`
    INSERT INTO template_field_mappings (id, templateId, svgLayerId, standardFieldName)
    VALUES (?, ?, ?, ?)
  `)

  const insertMany = db.transaction((mappingsToInsert) => {
    for (const mapping of mappingsToInsert) {
      const id = `mapping-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      insertStmt.run(id, templateId, mapping.svgLayerId, mapping.standardFieldName)
    }
  })

  insertMany(mappings)

  return getFieldMappings(templateId)
}
