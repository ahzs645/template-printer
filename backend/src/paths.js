import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const backendRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(backendRoot, '..')
const frontendRoot = path.join(repoRoot, 'frontend')
const publicDir = path.join(frontendRoot, 'public')
const clientDistDir = path.join(frontendRoot, 'dist')
const dataDir = path.join(backendRoot, 'data')
const dbPath = path.join(dataDir, 'templates.db')
const templatesDir = path.join(publicDir, 'templates')

export {
  backendRoot,
  clientDistDir,
  dataDir,
  dbPath,
  frontendRoot,
  publicDir,
  repoRoot,
  templatesDir,
}
