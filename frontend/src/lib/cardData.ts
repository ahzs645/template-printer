import type { Dispatch, SetStateAction } from 'react'

import type { CardData, ImageValue } from './types'
import { isImageValue } from './utils'

/**
 * Read a picked image file into a card value. Held as a data URL, so the photo
 * survives into an exported PDF rather than pointing at a blob that has gone.
 */
export function readImageFile(file: File): Promise<ImageValue | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      resolve(src ? { src, offsetX: 0, offsetY: 0, scale: 1 } : null)
    }
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

export function setImageFieldValue(
  file: File,
  fieldId: string,
  setCardData: Dispatch<SetStateAction<CardData>>,
) {
  void readImageFile(file).then((value) => {
    if (!value) return
    setCardData((current) => ({ ...current, [fieldId]: value }))
  })
}

export function updateImageFieldValue(
  fieldId: string,
  patch: Partial<ImageValue>,
  setCardData: Dispatch<SetStateAction<CardData>>,
) {
  setCardData((current) => {
    const existing = current[fieldId]
    if (!isImageValue(existing)) return current
    return {
      ...current,
      [fieldId]: {
        ...existing,
        ...patch,
      },
    }
  })
}

export function renameFieldInCardData(
  previousId: string,
  nextId: string,
  setCardData: Dispatch<SetStateAction<CardData>>,
) {
  setCardData((current) => {
    if (!(previousId in current)) return current
    const { [previousId]: existingValue, ...rest } = current
    return existingValue !== undefined ? { ...rest, [nextId]: existingValue } : rest
  })
}
