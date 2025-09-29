import { createApp } from './app.js'

const port = Number.parseInt(process.env.PORT ?? '3000', 10)
const host = process.env.HOST ?? '0.0.0.0'

const app = createApp()

app.listen(port, host, () => {
  console.log(`Server running on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`)
})
