import { Router } from 'express'

import {
  listCardDesigns,
  getCardDesignById,
  createCardDesign,
  updateCardDesign,
  deleteCardDesign,
  getTemplateById,
} from '../db.js'

const router = Router()

router.get('/', (req, res, next) => {
  try {
    const designs = listCardDesigns()
    res.json(designs)
  } catch (error) {
    next(error)
  }
})

router.get('/:id', (req, res, next) => {
  try {
    const { id } = req.params
    const design = getCardDesignById(id)
    if (!design) {
      res.status(404).json({ error: 'Card design not found.' })
      return
    }
    res.json(design)
  } catch (error) {
    next(error)
  }
})

router.post('/', (req, res, next) => {
  try {
    const { name, description } = req.body ?? {}
    const frontTemplateId = normalizeTemplateId(req.body?.frontTemplateId)
    const backTemplateId = normalizeTemplateId(req.body?.backTemplateId)

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Card design name is required.' })
      return
    }

    if (frontTemplateId) {
      const frontTemplate = getTemplateById(frontTemplateId)
      if (!frontTemplate) {
        res.status(400).json({ error: 'Front template not found.' })
        return
      }
    }

    if (backTemplateId) {
      const backTemplate = getTemplateById(backTemplateId)
      if (!backTemplate) {
        res.status(400).json({ error: 'Back template not found.' })
        return
      }
    }

    const design = createCardDesign({
      name,
      description: typeof description === 'string' ? description : null,
      frontTemplateId,
      backTemplateId,
    })

    res.status(201).json(design)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ error: 'A card design with this name already exists.' })
      return
    }

    if (error && typeof error === 'object' && 'status' in error) {
      const status = typeof error.status === 'number' ? error.status : 400
      res.status(status).json({ error: error.message || 'Invalid request.' })
      return
    }

    next(error)
  }
})

router.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params
    const existing = getCardDesignById(id)
    if (!existing) {
      res.status(404).json({ error: 'Card design not found.' })
      return
    }

    const updates = {}
    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
      updates.name = typeof req.body.name === 'string' ? req.body.name : String(req.body.name ?? '')
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
      updates.description = typeof req.body.description === 'string' ? req.body.description : req.body.description ?? null
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'frontTemplateId')) {
      const frontTemplateId = normalizeTemplateId(req.body.frontTemplateId)
      if (frontTemplateId) {
        const frontTemplate = getTemplateById(frontTemplateId)
        if (!frontTemplate) {
          res.status(400).json({ error: 'Front template not found.' })
          return
        }
      }
      updates.frontTemplateId = frontTemplateId ?? null
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'backTemplateId')) {
      const backTemplateId = normalizeTemplateId(req.body.backTemplateId)
      if (backTemplateId) {
        const backTemplate = getTemplateById(backTemplateId)
        if (!backTemplate) {
          res.status(400).json({ error: 'Back template not found.' })
          return
        }
      }
      updates.backTemplateId = backTemplateId ?? null
    }

    const updated = updateCardDesign(id, updates)
    res.json(updated)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ error: 'A card design with this name already exists.' })
      return
    }

    if (error && typeof error === 'object' && 'status' in error) {
      const status = typeof error.status === 'number' ? error.status : 400
      res.status(status).json({ error: error.message || 'Invalid request.' })
      return
    }

    next(error)
  }
})

router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params
    const deleted = deleteCardDesign(id)
    if (!deleted) {
      res.status(404).json({ error: 'Card design not found.' })
      return
    }
    res.json({ message: 'Card design deleted successfully.', design: deleted })
  } catch (error) {
    next(error)
  }
})

export default router

function normalizeTemplateId(value) {
  if (value === undefined) return undefined
  if (value === null) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  return trimmed
}

function isUniqueConstraintError(error) {
  return Boolean(error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && error.code.startsWith('SQLITE_CONSTRAINT'))
}
