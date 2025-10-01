import { useEffect, useMemo, useRef, useState } from 'react'
import { listFonts, uploadFont, type FontData } from '../lib/api'

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

  // Load fonts from backend on mount
  useEffect(() => {
    const loadSavedFonts = async () => {
      try {
        const savedFonts = await listFonts()

        // Load each font into the browser
        for (const fontData of savedFonts) {
          try {
            await loadFontFromData(fontData)
          } catch (error) {
            console.error(`Failed to load saved font ${fontData.fontName}:`, error)
          }
        }

      } catch (error) {
        console.error('Failed to load saved fonts:', error)
      }
    }

    loadSavedFonts()
  }, [])

  const loadFontFromData = async (fontData: FontData) => {
    // Convert base64 to blob
    const binaryString = atob(fontData.fontData)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: fontData.mimeType })
    const objectUrl = URL.createObjectURL(blob)

    try {
      const fontFace = new FontFace(fontData.fontName, `url(${objectUrl})`)
      await fontFace.load()
      document.fonts.add(fontFace)

      setEntries((current) => ({
        ...current,
        [fontData.fontName]: {
          name: fontData.fontName,
          status: 'loaded',
          source: 'uploaded',
          fileName: fontData.fileName,
          objectUrl,
        },
      }))
    } catch (error) {
      URL.revokeObjectURL(objectUrl)
      throw error
    }
  }

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
      // Load font into browser
      const fontFace = new FontFace(fontName, `url(${objectUrl})`)
      await fontFace.load()
      document.fonts.add(fontFace)

      // Update local state
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

      // Save to backend for persistence
      try {
        await uploadFont(fontName, file)
      } catch (error) {
        console.error('Failed to save font to backend:', error)
        // Don't throw - font is still loaded in browser for this session
      }
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
