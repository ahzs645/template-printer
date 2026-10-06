#!/usr/bin/env node
/**
 * List what a card template draws, in millimetres from its trim corner — the
 * coordinates a recipe in templates/sources/*.json is written in.
 *
 *   node templates/tools/describe-card.mjs <card.svg> [--text]
 */
import { openBrowser, describeCard } from './browser.mjs'

const [file, mode] = process.argv.slice(2)
const browser = await openBrowser()
try {
  const rows = await describeCard(browser, file)
  for (const row of rows) {
    if (mode === '--text' && row.tag !== 'text') continue
    console.log([row.tag.padEnd(8), JSON.stringify(row.box).padEnd(28), row.text ? `"${row.text}"` : '', row.font ?? '', row.fill, row.stroke ?? '', row.cls ?? '', row.id ?? ''].join(' '))
  }
} finally {
  await browser.close()
}
