import express from 'express'
import { listFonts, getFontByName, saveFont, deleteFont } from '../db.js'
import multer from 'multer'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

// GET /api/fonts - List all fonts
router.get('/', (req, res, next) => {
  try {
    const fonts = listFonts()
    res.json(fonts)
  } catch (error) {
    next(error)
  }
})

// GET /api/fonts/:fontName - Get single font by name
router.get('/:fontName', (req, res, next) => {
  try {
    const { fontName } = req.params
    const font = getFontByName(fontName)
    if (!font) {
      res.status(404).json({ error: 'Font not found.' })
      return
    }
    res.json(font)
  } catch (error) {
    next(error)
  }
})

// POST /api/fonts - Upload and save a font
router.post('/', upload.single('font'), (req, res, next) => {
  try {
    const { fontName } = req.body

    if (!req.file) {
      res.status(400).json({ error: 'No font file uploaded' })
      return
    }

    if (!fontName) {
      res.status(400).json({ error: 'fontName is required' })
      return
    }

    // Convert buffer to base64
    const base64Data = req.file.buffer.toString('base64')

    const fontData = {
      fontName,
      fileName: req.file.originalname,
      fontData: base64Data,
      mimeType: req.file.mimetype,
    }

    const savedFont = saveFont(fontData)
    res.json(savedFont)
  } catch (error) {
    next(error)
  }
})

// DELETE /api/fonts/:fontName - Delete a font
router.delete('/:fontName', (req, res, next) => {
  try {
    const { fontName } = req.params
    const deleted = deleteFont(fontName)

    if (!deleted) {
      res.status(404).json({ error: 'Font not found.' })
      return
    }

    res.json({ message: 'Font deleted successfully.', font: deleted })
  } catch (error) {
    next(error)
  }
})

export default router
