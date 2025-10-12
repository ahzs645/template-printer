import express from 'express'
import morgan from 'morgan'
import fs from 'fs'
import path from 'path'

import { getDatabase } from './db.js'
import { clientDistDir, templatesDir } from './paths.js'
import templatesRouter from './routes/templates.js'
import cardDesignsRouter from './routes/cardDesigns.js'
import usersRouter from './routes/users.js'
import fieldMappingsRouter from './routes/fieldMappings.js'
import fontsRouter from './routes/fonts.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'

export function createApp() {
  // Initialise database on startup so seeding occurs before handling requests
  getDatabase()

  const app = express()
  app.use(morgan('dev'))
  app.use(express.json())

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/api/templates', templatesRouter)
  app.use('/api/templates', fieldMappingsRouter)
  app.use('/api/card-designs', cardDesignsRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/fonts', fontsRouter)

  if (fs.existsSync(templatesDir)) {
    app.use('/templates', express.static(templatesDir))
  }

  if (fs.existsSync(clientDistDir)) {
    app.use(express.static(clientDistDir))
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next()
      }
      res.sendFile(path.join(clientDistDir, 'index.html'))
    })
  }

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
