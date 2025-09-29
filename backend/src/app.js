import express from 'express'
import morgan from 'morgan'
import fs from 'fs'
import path from 'path'

import { getDatabase } from './db.js'
import { clientDistDir, publicDir } from './paths.js'
import templatesRouter from './routes/templates.js'
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

  const templatesPath = path.join(publicDir, 'templates')
  if (fs.existsSync(templatesPath)) {
    app.use('/templates', express.static(templatesPath))
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
