import { useEffect, useMemo, useRef, useState } from 'react'

export type FontEntry = {
  name: string
  status: 'missing' | 'loaded'
  source: 'template' | 'uploaded'
  fileName?: string
  objectUrl?: string
}

type FontEntryMap = Record<string, FontEntry>

type UseFontManagerResult = {
  fontList: FontEntry[]
  missingFonts: string[]
  availableFontOptions: string[]
  registerTemplateFonts: (fonts: string[]) => void
  loadFontFile: (fontName: string, file: File) => Promise<void>
  entries: FontEntryMap
  setEntries: React.Dispatch<React.SetStateAction<FontEntryMap>>
}

export function useFontManager(): UseFontManagerResult {
  const [entries, setEntries] = useState<FontEntryMap>({})
  const [templateFonts, setTemplateFonts] = useState<string[]>([])
  const entriesRef = useRef(entries)

  useEffect(() => {
    entriesRef.current = entries
  }, [entries])

  useEffect(() => {
    return () => {
      Object.values(entriesRef.current).forEach((entry) => {
        if (entry.objectUrl) {
          URL.revokeObjectURL(entry.objectUrl)
        }
      })
    }
  }, [])

  const fontList = useMemo(() => {
    const names = new Set<string>([...templateFonts, ...Object.keys(entries)])
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => {
        const entry = entries[name]
        return (
          entry ?? {
            name,
            source: 'template' as const,
            status: 'missing' as const,
          }
        )
      })
  }, [templateFonts, entries])

  const missingFonts = useMemo(
    () => fontList.filter((font) => font.status !== 'loaded').map((font) => font.name),
    [fontList],
  )

  const availableFontOptions = useMemo(() => {
    const names = new Set<string>()
    fontList.forEach((font) => names.add(font.name))
    if (names.size === 0) {
      return ['Inter']
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [fontList])

  const registerTemplateFonts = (fonts: string[]) => {
    setTemplateFonts(fonts)
    setEntries((current) => {
      const next = { ...current }
      fonts.forEach((fontName) => {
        const existing = next[fontName]
        if (existing) {
          next[fontName] = {
            ...existing,
            source: existing.source === 'uploaded' ? 'uploaded' : 'template',
          }
        } else {
          next[fontName] = {
            name: fontName,
            status: 'missing',
            source: 'template',
          }
        }
      })
      return next
    })
  }

  const loadFontFile = async (fontName: string, file: File) => {
    const objectUrl = URL.createObjectURL(file)
    try {
      const fontFace = new FontFace(fontName, `url(${objectUrl})`)
      await fontFace.load()
      document.fonts.add(fontFace)
      setEntries((current) => {
        const previous = current[fontName]
        if (previous?.objectUrl) {
          URL.revokeObjectURL(previous.objectUrl)
        }
        return {
          ...current,
          [fontName]: {
            name: fontName,
            status: 'loaded',
            source: 'uploaded',
            fileName: file.name,
            objectUrl,
          },
        }
      })
    } catch (error) {
      URL.revokeObjectURL(objectUrl)
      throw error
    }
  }

  return {
    fontList,
    missingFonts,
    availableFontOptions,
    registerTemplateFonts,
    loadFontFile,
    entries,
    setEntries,
  }
}
