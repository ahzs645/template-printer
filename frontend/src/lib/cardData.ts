import type { Dispatch, SetStateAction } from 'react'

import type { CardData, ImageValue } from './types'
import { isImageValue } from './utils'

export function setImageFieldValue(
  file: File,
  fieldId: string,
  setCardData: Dispatch<SetStateAction<CardData>>,
) {
  const reader = new FileReader()
  reader.onload = () => {
    const src = typeof reader.result === 'string' ? reader.result : ''
    if (!src) return
    setCardData((current) => ({
      ...current,
      [fieldId]: {
        src,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
      },
    }))
  }
  reader.readAsDataURL(file)
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
