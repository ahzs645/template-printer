import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { CardDataValue, ImageValue } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isImageValue(value: CardDataValue | undefined): value is ImageValue {
  return Boolean(value && typeof value === 'object' && 'src' in value)
}
