import express from 'express'
import {
  listColorProfiles,
  getColorProfileById,
  createColorProfile,
  updateColorProfile,
  deleteColorProfile
} from '../db.js'

const router = express.Router()

// GET /api/color-profiles - List all color profiles
router.get('/', (req, res, next) => {
  try {
    const profiles = listColorProfiles()
    res.json(profiles)
  } catch (error) {
    next(error)
  }
})

// GET /api/color-profiles/:id - Get single color profile by ID
router.get('/:id', (req, res, next) => {
  try {
    const { id } = req.params
    const profile = getColorProfileById(id)
    if (!profile) {
      res.status(404).json({ error: 'Color profile not found.' })
      return
    }
    res.json(profile)
  } catch (error) {
    next(error)
  }
})

// POST /api/color-profiles - Create a new color profile
router.post('/', (req, res, next) => {
  try {
    const { name, device, adjustments } = req.body

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Profile name is required.' })
      return
    }

    if (!device || !device.trim()) {
      res.status(400).json({ error: 'Device name is required.' })
      return
    }

    const profile = createColorProfile({ name, device, adjustments })
    res.status(201).json(profile)
  } catch (error) {
    if (error.status === 400) {
      res.status(400).json({ error: error.message })
      return
    }
    next(error)
  }
})

// PUT /api/color-profiles/:id - Update a color profile
router.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params
    const updates = req.body

    const profile = updateColorProfile(id, updates)
    if (!profile) {
      res.status(404).json({ error: 'Color profile not found.' })
      return
    }
    res.json(profile)
  } catch (error) {
    if (error.status === 400) {
      res.status(400).json({ error: error.message })
      return
    }
    next(error)
  }
})

// DELETE /api/color-profiles/:id - Delete a color profile
router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params
    const deleted = deleteColorProfile(id)

    if (!deleted) {
      res.status(404).json({ error: 'Color profile not found.' })
      return
    }

    res.json({ message: 'Color profile deleted successfully.', profile: deleted })
  } catch (error) {
    next(error)
  }
})

export default router
