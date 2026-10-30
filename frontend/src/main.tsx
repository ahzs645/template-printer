import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { TemplatePrinter } from './embed'
import { convexUrlFromEnv, storageModeFromEnv } from './lib/storage'

// The standalone app is the same component a host embeds, given the whole page:
// it reads ?url= and #share/ links, and its storage comes from the build.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TemplatePrinter syncUrl storage={storageModeFromEnv()} convexUrl={convexUrlFromEnv()} />
  </StrictMode>,
)
