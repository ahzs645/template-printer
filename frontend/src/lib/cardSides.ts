/**
 * Working out which of two templates is the front of a card and which is the
 * back, so importing a pair does not have to ask.
 */

import type { FieldDefinition } from './types'
import { isAutoMappable } from './autoMapping'

export type CardSide = 'front' | 'back'

/** Filename words that name a side outright. */
const FRONT_WORDS = new Set(['front', 'recto', 'obverse'])
const BACK_WORDS = new Set(['back', 'verso', 'rear', 'reverse'])

/**
 * Read a side out of a filename, or null when it doesn't say.
 *
 * The name is split on the separators editors use (`-`, `_`, spaces, dots) so
 * "id-card-back", "id_card_back" and "ID Card Back" all read the same.
 */
export function readSideFromFileName(fileName: string): CardSide | null {
  const stem = fileName.replace(/\.svg$/i, '')
  const tokens = stem
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  if (tokens.length === 0) return null

  const hasFrontWord = tokens.some((token) => FRONT_WORDS.has(token))
  const hasBackWord = tokens.some((token) => BACK_WORDS.has(token))
  if (hasFrontWord && !hasBackWord) return 'front'
  if (hasBackWord && !hasFrontWord) return 'back'
  if (hasFrontWord && hasBackWord) return null

  // "side a" / "side b"
  const sideIndex = tokens.indexOf('side')
  if (sideIndex >= 0 && sideIndex + 1 < tokens.length) {
    const marker = tokens[sideIndex + 1]
    if (marker === 'a' || marker === '1') return 'front'
    if (marker === 'b' || marker === '2') return 'back'
  }

  // A trailing single letter, as in "badge-f" / "badge-b".
  const last = tokens[tokens.length - 1]
  if (tokens.length > 1) {
    if (last === 'f') return 'front'
    if (last === 'b') return 'back'
  }

  return null
}

/**
 * How much personalised content a template carries. The front of a card is the
 * side with the name and photo on it; a back is usually fixed artwork.
 */
function personalisationScore(fields: FieldDefinition[]): number {
  let score = 0
  for (const field of fields) {
    if (!isAutoMappable(field)) continue
    const id = (field.sourceId || field.id).toLowerCase()
    // A photo is the strongest signal of a front.
    if (field.type === 'image') score += 3
    else if (id.includes('fullname') || id.includes('firstname') || id.includes('lastname')) score += 3
    else score += 1
  }
  return score
}

export type SideCandidate = {
  fileName: string
  fields: FieldDefinition[]
}

/**
 * Decide which of two imported templates is the front.
 *
 * Filenames win when they say. Otherwise the side carrying more personalised
 * fields is the front, and a tie keeps the order they were given in.
 */
export function assignCardSides<T extends SideCandidate>(
  candidates: [T, T],
): { front: T; back: T } {
  const [first, second] = candidates

  const firstNamed = readSideFromFileName(first.fileName)
  const secondNamed = readSideFromFileName(second.fileName)

  if (firstNamed === 'front' || secondNamed === 'back') return { front: first, back: second }
  if (firstNamed === 'back' || secondNamed === 'front') return { front: second, back: first }

  const firstScore = personalisationScore(first.fields)
  const secondScore = personalisationScore(second.fields)
  if (secondScore > firstScore) return { front: second, back: first }
  return { front: first, back: second }
}

/**
 * A name for the card design built from a pair of filenames, e.g.
 * "id-card-front.svg" + "id-card-back.svg" -> "id-card".
 */
export function suggestDesignName(frontFileName: string, backFileName: string): string {
  const stem = (value: string) => value.replace(/\.svg$/i, '')
  const front = stem(frontFileName)
  const back = stem(backFileName)

  // Longest common prefix, trimmed of the separator it broke on.
  let shared = ''
  for (let i = 0; i < Math.min(front.length, back.length); i += 1) {
    if (front[i].toLowerCase() !== back[i].toLowerCase()) break
    shared += front[i]
  }
  const trimmed = shared.replace(/[-_\s]+$/, '').trim()
  return trimmed || front
}
