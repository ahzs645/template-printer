export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found' })
}

export function errorHandler(err, req, res, next) {
  console.error(err)
  const status = err?.status ?? 500
  const message = err?.message ?? 'Internal server error'

  if (res.headersSent) {
    return next(err)
  }

  res.status(status).json({ error: message })
}
