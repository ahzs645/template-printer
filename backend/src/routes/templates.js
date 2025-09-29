import { Router } from 'express'

import { listTemplates } from '../db.js'

const router = Router()

router.get('/', (req, res, next) => {
  try {
    const templates = listTemplates()
    res.json(templates)
  } catch (error) {
    next(error)
  }
})

export default router
