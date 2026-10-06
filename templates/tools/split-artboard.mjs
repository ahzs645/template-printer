#!/usr/bin/env node
/**
 * Split an artboard of card mockups into one print template per card.
 *
 *   node templates/tools/split-artboard.mjs <artboard.svg> <out-dir> [--aspect 1.627] [--png]
 *
 * Cards are found as the large rounded rectangles each mockup card is drawn on.
 * Each one is written to <out-dir>/card-N.svg (and card-N.png with --png), with
 * a cards.json listing where each was found, for writing a recipe against.
 *
 * Needs Playwright with a Chromium build: the split measures what is actually
 * drawn, which only a browser can do reliably for Illustrator output.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { openBrowser, splitAndClean, renderPng } from './browser.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  if (i < 0) return undefined
  const value = args[i + 1]
  args.splice(i, 2)
  return value
}
const png = args.includes('--png')
if (png) args.splice(args.indexOf('--png'), 1)
const aspect = Number(flag('--aspect') ?? 1.627)
const [input, outDir] = args
if (!input || !outDir) {
  console.error('usage: split-artboard.mjs <artboard.svg> <out-dir> [--aspect 1.627] [--png]')
  process.exit(1)
}

fs.mkdirSync(outDir, { recursive: true })
const browser = await openBrowser()
try {
  const cards = await splitAndClean(browser, path.resolve(input), { aspect })
  const listing = []
  for (const card of cards) {
    const file = path.join(outDir, `${card.id}.svg`)
    fs.writeFileSync(file, card.svg)
    if (png) await renderPng(browser, file, file.replace(/\.svg$/, '.png'), 600)
    listing.push({ id: card.id, rect: card.rect.map((n) => Math.round(n * 100) / 100), portrait: card.portrait, bytes: card.svg.length })
  }
  fs.writeFileSync(path.join(outDir, 'cards.json'), JSON.stringify(listing, null, 2))
  console.log(`${cards.length} cards written to ${outDir}`)
} finally {
  await browser.close()
}
void HERE
