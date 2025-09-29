import type { CardDataValue, ImageValue } from './types'

export function isImageValue(value: CardDataValue | undefined): value is ImageValue {
  return Boolean(value && typeof value === 'object' && 'src' in value)
}
