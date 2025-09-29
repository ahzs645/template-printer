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

export function listTemplates() {
  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT id, name, description, svg_path AS svgPath, thumbnail_path AS thumbnailPath
       FROM templates ORDER BY name`
    )
    .all()
  return rows.map((row) => ({
    ...row,
    thumbnailPath: row.thumbnailPath ?? null,
  }))
}

function initializeDatabase() {
  ensureDataDirectory()
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

function createSchema(db) {
  const createTemplatesTable = `
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      svg_path TEXT NOT NULL,
      thumbnail_path TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `

  const createUniqueIndex = `
    CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_name ON templates(name)
  `

  db.exec(createTemplatesTable)
  db.exec(createUniqueIndex)
}

function seedTemplates(db) {
  const templates = loadTemplateSeeds()
  if (templates.length === 0) {
    return
  }

  const insert = db.prepare(`
    INSERT INTO templates (id, name, description, svg_path, thumbnail_path)
    VALUES (@id, @name, @description, @svgPath, @thumbnailPath)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      svg_path = excluded.svg_path,
      thumbnail_path = excluded.thumbnail_path
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
    },
    {
      id: 'libre-badge',
      name: 'LibreBadge Sample',
      description: 'LibreBadge badge template imported from the LibreBadge project.',
      svgPath: '/templates/libre-badge.svg',
      thumbnailPath: null,
    },
  ]
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
