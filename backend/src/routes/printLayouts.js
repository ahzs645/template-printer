import express from 'express'
import {
  listPrintLayouts,
  getPrintLayoutById,
  createPrintLayout,
  updatePrintLayout,
  deletePrintLayout
} from '../db.js'

const router = express.Router()

// GET /api/print-layouts - List all print layouts
router.get('/', (req, res, next) => {
  try {
    const layouts = listPrintLayouts()
    res.json(layouts)
  } catch (error) {
    next(error)
  }
})

// GET /api/print-layouts/:id - Get single print layout by ID
router.get('/:id', (req, res, next) => {
  try {
    const { id } = req.params
    const layout = getPrintLayoutById(id)
    if (!layout) {
      res.status(404).json({ error: 'Print layout not found.' })
      return
    }
    res.json(layout)
  } catch (error) {
    next(error)
  }
})

// POST /api/print-layouts - Create a new print layout
router.post('/', (req, res, next) => {
  try {
    const {
      name,
      pageWidth,
      pageHeight,
      orientation,
      cardsPerRow,
      cardsPerPage,
      pageMarginTop,
      pageMarginLeft,
      cardMarginRight,
      cardMarginBottom,
      cardWidth,
      cardHeight,
      bleedWidth,
      bleedHeight,
      paperSize,
      printMedia,
      instructions
    } = req.body

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Layout name is required.' })
      return
    }

    if (!pageWidth || !pageHeight) {
      res.status(400).json({ error: 'Page dimensions are required.' })
      return
    }

    if (!cardsPerRow || !cardsPerPage) {
      res.status(400).json({ error: 'Cards per row and page are required.' })
      return
    }

    if (!cardWidth || !cardHeight) {
      res.status(400).json({ error: 'Card dimensions are required.' })
      return
    }

    const layout = createPrintLayout({
      name,
      pageWidth,
      pageHeight,
      orientation,
      cardsPerRow,
      cardsPerPage,
      pageMarginTop: pageMarginTop ?? '0.0000',
      pageMarginLeft: pageMarginLeft ?? '0.0000',
      cardMarginRight: cardMarginRight ?? '0.0000',
      cardMarginBottom: cardMarginBottom ?? '0.0000',
      cardWidth,
      cardHeight,
      bleedWidth,
      bleedHeight,
      paperSize,
      printMedia,
      instructions
    })

    res.status(201).json(layout)
  } catch (error) {
    if (error.status === 400) {
      res.status(400).json({ error: error.message })
      return
    }
    next(error)
  }
})

// PUT /api/print-layouts/:id - Update a print layout
router.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params
    const updates = req.body

    const layout = updatePrintLayout(id, updates)
    if (!layout) {
      res.status(404).json({ error: 'Print layout not found.' })
      return
    }
    res.json(layout)
  } catch (error) {
    if (error.status === 400 || error.status === 403) {
      res.status(error.status).json({ error: error.message })
      return
    }
    next(error)
  }
})

// DELETE /api/print-layouts/:id - Delete a print layout
router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params
    const deleted = deletePrintLayout(id)

    if (!deleted) {
      res.status(404).json({ error: 'Print layout not found.' })
      return
    }

    res.json({ message: 'Print layout deleted successfully.', layout: deleted })
  } catch (error) {
    if (error.status === 403) {
      res.status(403).json({ error: error.message })
      return
    }
    next(error)
  }
})

export default router
