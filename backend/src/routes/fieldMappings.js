import express from 'express'
import { getFieldMappings, saveFieldMappings } from '../db.js'

const router = express.Router()

// GET /api/templates/:templateId/field-mappings - Get field mappings for a template
router.get('/:templateId/field-mappings', (req, res, next) => {
  try {
    const { templateId } = req.params
    const mappings = getFieldMappings(templateId)
    res.json(mappings)
  } catch (error) {
    next(error)
  }
})

// PUT /api/templates/:templateId/field-mappings - Save field mappings for a template
router.put('/:templateId/field-mappings', (req, res, next) => {
  try {
    const { templateId } = req.params
    const { mappings } = req.body

    if (!Array.isArray(mappings)) {
      res.status(400).json({ error: 'mappings must be an array' })
      return
    }

    const savedMappings = saveFieldMappings(templateId, mappings)
    res.json(savedMappings)
  } catch (error) {
    next(error)
  }
})

export default router
