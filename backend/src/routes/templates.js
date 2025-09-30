import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { Router } from 'express'
import multer from 'multer'

import { createTemplateRecord, deleteTemplate, listTemplates } from '../db.js'
import { templatesDir } from '../paths.js'

const ACCEPTED_MIME_TYPES = new Set(['image/svg+xml', 'application/xml', 'text/xml'])

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    fs.mkdirSync(templatesDir, { recursive: true })
    callback(null, templatesDir)
  },
  filename: (_req, file, callback) => {
    const unique = crypto.randomUUID().slice(0, 8)
    const extension = (path.extname(file.originalname) || '.svg').toLowerCase()
    const baseName = slugify(path.basename(file.originalname, extension)) || 'template'
    callback(null, `${baseName}-${unique}${extension}`)
  },
})

const upload = multer({
  storage,
  fileFilter: (_req, file, callback) => {
    const mimetype = (file.mimetype || '').toLowerCase()
    const isSvg = ACCEPTED_MIME_TYPES.has(mimetype) || file.originalname.toLowerCase().endsWith('.svg')
    if (!isSvg) {
      const error = new Error('Only SVG template uploads are supported.')
      error.status = 400
      callback(error)
      return
    }
    callback(null, true)
  },
})

const router = Router()

router.get('/', (req, res, next) => {
  try {
    const { type } = req.query
    const templates = listTemplates(type || null)
    res.json(templates)
  } catch (error) {
    next(error)
  }
})

router.post('/', upload.single('file'), (req, res, next) => {
  if (!req.file) {
    res.status(400).json({ error: 'Template file is required.' })
    return
  }

  const description = typeof req.body?.description === 'string' ? req.body.description.trim() || null : null
  const providedName = typeof req.body?.name === 'string' ? req.body.name.trim() : null
  const templateType = typeof req.body?.templateType === 'string' ? req.body.templateType : 'design'

  const fallbackName = path.basename(req.file.originalname, path.extname(req.file.originalname))
  const name = (providedName || fallbackName).trim()

  if (!name) {
    cleanupUploadedFile(req.file.path)
    res.status(400).json({ error: 'Template name is required.' })
    return
  }

  const templateRecord = {
    id: crypto.randomUUID(),
    name,
    description,
    svgPath: `/templates/${req.file.filename}`,
    thumbnailPath: null,
    templateType,
  }

  try {
    const record = createTemplateRecord(templateRecord)
    res.status(201).json(record)
  } catch (error) {
    cleanupUploadedFile(req.file.path)
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ error: 'A template with this name already exists. Choose a different name.' })
      return
    }
    next(error)
  }
})

router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params
    const deleted = deleteTemplate(id)

    if (!deleted) {
      res.status(404).json({ error: 'Template not found.' })
      return
    }

    // Clean up the SVG file
    const svgFilename = deleted.svgPath.replace(/^\/templates\//, '')
    const svgPath = path.join(templatesDir, svgFilename)
    cleanupUploadedFile(svgPath)

    res.status(200).json({ message: 'Template deleted successfully.' })
  } catch (error) {
    next(error)
  }
})

export default router

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function cleanupUploadedFile(filePath) {
  if (!filePath) return
  try {
    fs.unlinkSync(filePath)
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      console.warn('Failed to remove uploaded template after error', error)
    }
  }
}

function isUniqueConstraintError(error) {
  return error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && error.code.startsWith('SQLITE_CONSTRAINT')
}
