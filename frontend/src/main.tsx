import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './contexts/ThemeContext'
import { StorageProviderRoot } from './lib/storage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StorageProviderRoot>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StorageProviderRoot>
  </StrictMode>,
)
