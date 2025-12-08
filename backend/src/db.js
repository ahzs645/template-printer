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
      cardDesignId TEXT,
      photoPath TEXT,
      signaturePath TEXT,
      issueDate TEXT,
      expiryDate TEXT,
      birthDate TEXT,
      metadata TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cardDesignId) REFERENCES card_designs(id) ON DELETE SET NULL
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

  const createFontsTable = `
    CREATE TABLE IF NOT EXISTS fonts (
      id TEXT PRIMARY KEY,
      fontName TEXT NOT NULL UNIQUE,
      fileName TEXT NOT NULL,
      fontData TEXT NOT NULL,
      mimeType TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `

  const createColorProfilesTable = `
    CREATE TABLE IF NOT EXISTS color_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      device TEXT NOT NULL,
      adjustments TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `

  const createCardDesignsTable = `
    CREATE TABLE IF NOT EXISTS card_designs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      frontTemplateId TEXT,
      backTemplateId TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (frontTemplateId) REFERENCES templates(id) ON DELETE SET NULL,
      FOREIGN KEY (backTemplateId) REFERENCES templates(id) ON DELETE SET NULL
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
  db.exec(createFontsTable)
  db.exec(createColorProfilesTable)
  db.exec(createCardDesignsTable)
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

  // Migration: Add customValue column to template_field_mappings if it doesn't exist
  try {
    db.exec(`ALTER TABLE template_field_mappings ADD COLUMN customValue TEXT`)
  } catch (error) {
    // Column already exists, ignore error
    if (!error.message.includes('duplicate column name')) {
      throw error
    }
  }

  // Migration: Add cardDesignId column to users if it doesn't exist
  try {
    db.exec(`ALTER TABLE users ADD COLUMN cardDesignId TEXT`)
  } catch (error) {
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

export function updateTemplateRecord(id, updates) {
  const db = getDatabase()
  const existing = getTemplateById(id)

  if (!existing) {
    return null
  }

  const nextName =
    updates.name !== undefined
      ? String(updates.name ?? '').trim()
      : existing.name
  const nextDescription =
    updates.description !== undefined
      ? updates.description === null
        ? null
        : String(updates.description).trim() || null
      : existing.description

  if (!nextName) {
    const error = new Error('Template name is required')
    error.code = 'VALIDATION_ERROR'
    throw error
  }

  const updateStmt = db.prepare(`
    UPDATE templates
    SET name = ?, description = ?
    WHERE id = ?
  `)

  updateStmt.run(nextName, nextDescription, id)

  return getTemplateById(id)
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
// CARD DESIGN OPERATIONS
// ============================================

export function listCardDesigns() {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT
      cd.id,
      cd.name,
      cd.description,
      cd.frontTemplateId,
      cd.backTemplateId,
      cd.createdAt,
      cd.updatedAt,
      ft.name AS frontTemplateName,
      ft.description AS frontTemplateDescription,
      ft.svg_path AS frontTemplateSvgPath,
      ft.thumbnail_path AS frontTemplateThumbnailPath,
      ft.template_type AS frontTemplateType,
      ft.created_at AS frontTemplateCreatedAt,
      bt.name AS backTemplateName,
      bt.description AS backTemplateDescription,
      bt.svg_path AS backTemplateSvgPath,
      bt.thumbnail_path AS backTemplateThumbnailPath,
      bt.template_type AS backTemplateType,
      bt.created_at AS backTemplateCreatedAt
    FROM card_designs cd
    LEFT JOIN templates ft ON ft.id = cd.frontTemplateId
    LEFT JOIN templates bt ON bt.id = cd.backTemplateId
    ORDER BY cd.name
  `)

  return stmt.all().map(mapCardDesignRow)
}

export function getCardDesignById(id) {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT
      cd.id,
      cd.name,
      cd.description,
      cd.frontTemplateId,
      cd.backTemplateId,
      cd.createdAt,
      cd.updatedAt,
      ft.name AS frontTemplateName,
      ft.description AS frontTemplateDescription,
      ft.svg_path AS frontTemplateSvgPath,
      ft.thumbnail_path AS frontTemplateThumbnailPath,
      ft.template_type AS frontTemplateType,
      ft.created_at AS frontTemplateCreatedAt,
      bt.name AS backTemplateName,
      bt.description AS backTemplateDescription,
      bt.svg_path AS backTemplateSvgPath,
      bt.thumbnail_path AS backTemplateThumbnailPath,
      bt.template_type AS backTemplateType,
      bt.created_at AS backTemplateCreatedAt
    FROM card_designs cd
    LEFT JOIN templates ft ON ft.id = cd.frontTemplateId
    LEFT JOIN templates bt ON bt.id = cd.backTemplateId
    WHERE cd.id = ?
  `)

  const row = stmt.get(id)
  return row ? mapCardDesignRow(row) : null
}

export function createCardDesign({ name, description, frontTemplateId, backTemplateId }) {
  const db = getDatabase()

  const cleanedName = (name ?? '').trim()
  if (!cleanedName) {
    throw Object.assign(new Error('Card design name is required'), { status: 400 })
  }

  const cleanedDescription = description ? description.trim() : null
  const frontId = frontTemplateId || null
  const backId = backTemplateId || null

  const id = `card-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  const stmt = db.prepare(`
    INSERT INTO card_designs (id, name, description, frontTemplateId, backTemplateId)
    VALUES (?, ?, ?, ?, ?)
  `)

  stmt.run(id, cleanedName, cleanedDescription, frontId, backId)

  return getCardDesignById(id)
}

export function updateCardDesign(id, updates) {
  const db = getDatabase()
  const existing = getCardDesignById(id)

  if (!existing) {
    return null
  }

  const hasNameUpdate = Object.prototype.hasOwnProperty.call(updates, 'name')
  const hasDescriptionUpdate = Object.prototype.hasOwnProperty.call(updates, 'description')
  const hasFrontUpdate = Object.prototype.hasOwnProperty.call(updates, 'frontTemplateId')
  const hasBackUpdate = Object.prototype.hasOwnProperty.call(updates, 'backTemplateId')

  const nextNameRaw = hasNameUpdate ? updates.name : existing.name
  const nextName = (nextNameRaw ?? '').toString().trim()
  if (!nextName) {
    throw Object.assign(new Error('Card design name is required'), { status: 400 })
  }

  const nextDescription = hasDescriptionUpdate
    ? (updates.description ? updates.description.toString().trim() : null)
    : existing.description

  const nextFront = hasFrontUpdate ? (updates.frontTemplateId || null) : existing.frontTemplateId
  const nextBack = hasBackUpdate ? (updates.backTemplateId || null) : existing.backTemplateId

  const stmt = db.prepare(`
    UPDATE card_designs
    SET name = ?, description = ?, frontTemplateId = ?, backTemplateId = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `)

  stmt.run(nextName, nextDescription, nextFront, nextBack, id)

  return getCardDesignById(id)
}

export function deleteCardDesign(id) {
  const db = getDatabase()
  const existing = getCardDesignById(id)
  if (!existing) {
    return null
  }

  const stmt = db.prepare(`DELETE FROM card_designs WHERE id = ?`)
  stmt.run(id)

  return existing
}

function mapCardDesignRow(row) {
  if (!row) return null

  const base = {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    frontTemplateId: row.frontTemplateId ?? null,
    backTemplateId: row.backTemplateId ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  }

  const frontTemplate = row.frontTemplateId
    ? {
        id: row.frontTemplateId,
        name: row.frontTemplateName ?? null,
        description: row.frontTemplateDescription ?? null,
        svgPath: row.frontTemplateSvgPath ?? null,
        thumbnailPath: row.frontTemplateThumbnailPath ?? null,
        templateType: row.frontTemplateType ?? null,
        createdAt: row.frontTemplateCreatedAt ?? null,
      }
    : null

  const backTemplate = row.backTemplateId
    ? {
        id: row.backTemplateId,
        name: row.backTemplateName ?? null,
        description: row.backTemplateDescription ?? null,
        svgPath: row.backTemplateSvgPath ?? null,
        thumbnailPath: row.backTemplateThumbnailPath ?? null,
        templateType: row.backTemplateType ?? null,
        createdAt: row.backTemplateCreatedAt ?? null,
      }
    : null

  return {
    ...base,
    frontTemplate,
    backTemplate,
  }
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
      cardDesignId, photoPath, signaturePath, issueDate, expiryDate, birthDate, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    userData.cardDesignId || null,
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
      cardDesignId = ?,
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
    Object.prototype.hasOwnProperty.call(userData, 'cardDesignId')
      ? userData.cardDesignId || null
      : existing.cardDesignId || null,
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
    SELECT id, templateId, svgLayerId, standardFieldName, customValue, createdAt
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
    INSERT INTO template_field_mappings (id, templateId, svgLayerId, standardFieldName, customValue)
    VALUES (?, ?, ?, ?, ?)
  `)

  const insertMany = db.transaction((mappingsToInsert) => {
    for (const mapping of mappingsToInsert) {
      const id = `mapping-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      insertStmt.run(id, templateId, mapping.svgLayerId, mapping.standardFieldName, mapping.customValue || null)
    }
  })

  insertMany(mappings)

  return getFieldMappings(templateId)
}

// ============================================
// FONT OPERATIONS
// ============================================

export function listFonts() {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, fontName, fileName, fontData, mimeType, createdAt
    FROM fonts
    ORDER BY fontName
  `)
  return stmt.all()
}

export function getFontByName(fontName) {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, fontName, fileName, fontData, mimeType, createdAt
    FROM fonts
    WHERE fontName = ?
  `)
  return stmt.get(fontName) || null
}

export function saveFont(fontData) {
  const db = getDatabase()

  // Check if font already exists
  const existing = getFontByName(fontData.fontName)

  if (existing) {
    // Update existing font
    const stmt = db.prepare(`
      UPDATE fonts
      SET fileName = ?, fontData = ?, mimeType = ?
      WHERE fontName = ?
    `)
    stmt.run(fontData.fileName, fontData.fontData, fontData.mimeType, fontData.fontName)
    return getFontByName(fontData.fontName)
  } else {
    // Insert new font
    const id = `font-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const stmt = db.prepare(`
      INSERT INTO fonts (id, fontName, fileName, fontData, mimeType)
      VALUES (?, ?, ?, ?, ?)
    `)
    stmt.run(id, fontData.fontName, fontData.fileName, fontData.fontData, fontData.mimeType)
    return getFontByName(fontData.fontName)
  }
}

export function deleteFont(fontName) {
  const db = getDatabase()
  const font = getFontByName(fontName)
  if (!font) return null

  const stmt = db.prepare(`DELETE FROM fonts WHERE fontName = ?`)
  stmt.run(fontName)

  return font
}

// ============================================
// COLOR PROFILE OPERATIONS
// ============================================

export function listColorProfiles() {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, name, device, adjustments, createdAt, updatedAt
    FROM color_profiles
    ORDER BY name
  `)
  return stmt.all().map(row => ({
    ...row,
    adjustments: JSON.parse(row.adjustments)
  }))
}

export function getColorProfileById(id) {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, name, device, adjustments, createdAt, updatedAt
    FROM color_profiles
    WHERE id = ?
  `)
  const row = stmt.get(id)
  if (!row) return null
  return {
    ...row,
    adjustments: JSON.parse(row.adjustments)
  }
}

export function createColorProfile({ name, device, adjustments }) {
  const db = getDatabase()
  const id = `profile-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

  const cleanedName = (name ?? '').trim()
  if (!cleanedName) {
    throw Object.assign(new Error('Profile name is required'), { status: 400 })
  }

  const cleanedDevice = (device ?? '').trim()
  if (!cleanedDevice) {
    throw Object.assign(new Error('Device name is required'), { status: 400 })
  }

  const stmt = db.prepare(`
    INSERT INTO color_profiles (id, name, device, adjustments)
    VALUES (?, ?, ?, ?)
  `)

  stmt.run(id, cleanedName, cleanedDevice, JSON.stringify(adjustments || {}))

  return getColorProfileById(id)
}

export function updateColorProfile(id, updates) {
  const db = getDatabase()
  const existing = getColorProfileById(id)
  if (!existing) return null

  const hasNameUpdate = Object.prototype.hasOwnProperty.call(updates, 'name')
  const hasDeviceUpdate = Object.prototype.hasOwnProperty.call(updates, 'device')
  const hasAdjustmentsUpdate = Object.prototype.hasOwnProperty.call(updates, 'adjustments')

  const nextName = hasNameUpdate ? (updates.name ?? '').toString().trim() : existing.name
  if (!nextName) {
    throw Object.assign(new Error('Profile name is required'), { status: 400 })
  }

  const nextDevice = hasDeviceUpdate ? (updates.device ?? '').toString().trim() : existing.device
  if (!nextDevice) {
    throw Object.assign(new Error('Device name is required'), { status: 400 })
  }

  const nextAdjustments = hasAdjustmentsUpdate ? updates.adjustments : existing.adjustments

  const stmt = db.prepare(`
    UPDATE color_profiles
    SET name = ?, device = ?, adjustments = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `)

  stmt.run(nextName, nextDevice, JSON.stringify(nextAdjustments), id)

  return getColorProfileById(id)
}

export function deleteColorProfile(id) {
  const db = getDatabase()
  const existing = getColorProfileById(id)
  if (!existing) return null

  const stmt = db.prepare(`DELETE FROM color_profiles WHERE id = ?`)
  stmt.run(id)

  return existing
}
