import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type Theme = 'light' | 'dark'

type ThemeContextType = {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

function readStoredTheme(storageKey: string): Theme | null {
  try {
    const saved = localStorage.getItem(storageKey)
    return saved === 'light' || saved === 'dark' ? saved : null
  } catch {
    return null
  }
}

type ThemeProviderProps = {
  children: ReactNode
  /** Where the chosen theme is remembered in localStorage. */
  storageKey?: string
  /** A theme the host decides. The in-app switch still works until it changes. */
  theme?: Theme
  /**
   * Also put the theme class on <html>. Only the standalone app, which owns the
   * page, does this; the printer's own root carries the class either way.
   */
  applyToDocument?: boolean
}

export function ThemeProvider({ children, storageKey = 'theme', theme: hostTheme, applyToDocument = false }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (hostTheme) return hostTheme
    if (typeof window !== 'undefined') {
      const saved = readStoredTheme(storageKey)
      if (saved) return saved
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'light'
  })

  // Follow the host when it changes its mind.
  useEffect(() => {
    if (hostTheme) setThemeState(hostTheme)
  }, [hostTheme])

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, theme)
    } catch {
      // Blocked storage only costs remembering the choice.
    }
    if (!applyToDocument) return
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(theme)
  }, [theme, storageKey, applyToDocument])

  const toggleTheme = () => {
    setThemeState(prev => prev === 'light' ? 'dark' : 'light')
  }

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
