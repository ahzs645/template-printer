/**
 * The browser side of the template tools: load an SVG as a document, run the
 * in-page helpers against it, and read the result back.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const IN_PAGE = ['split-in-page.js', 'cleanup-in-page.js', 'fields-in-page.js']
  .map((file) => path.join(HERE, file))
  .filter((file) => fs.existsSync(file))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n')

/** Playwright from the project, or from a global install. */
async function loadPlaywright() {
  try {
    return await import('playwright')
  } catch {
    const globalRoot = execSync('npm root -g').toString().trim()
    const require = createRequire(path.join(globalRoot, 'noop.js'))
    return require('playwright')
  }
}

export async function openBrowser() {
  const { chromium } = await loadPlaywright()
  return chromium.launch()
}

async function openSvg(browser, file) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  await page.goto('file://' + path.resolve(file))
  // An SVG document has no <head> to add a <script> to; global eval defines
  // the helpers' functions on the window just the same.
  await page.evaluate((code) => { (0, eval)(code) }, IN_PAGE)
  return page
}

/** Cut each card out of an artboard and clean it into a template. */
export async function splitAndClean(browser, artboard, options = {}) {
  const page = await openSvg(browser, artboard)
  const cards = await page.evaluate((opts) => splitArtboard(opts), options)
  await page.close()

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'card-split-'))
  const out = []
  try {
    for (const card of cards) {
      const file = path.join(tmp, `${card.id}.svg`)
      fs.writeFileSync(file, card.markup)
      const cardPage = await openSvg(browser, file)
      await cardPage.evaluate((info) => cleanupCard(info), card)
      await cardPage.evaluate(() => pruneDefinitions())
      const svg = await cardPage.evaluate(() => new XMLSerializer().serializeToString(document.documentElement))
      await cardPage.close()
      out.push({ ...card, markup: undefined, svg })
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
  return out
}

/** Apply a card's field recipe (see fields-in-page.js) to a cleaned card. */
export async function applyRecipe(browser, svgText, recipe) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'card-recipe-'))
  try {
    const file = path.join(tmp, 'card.svg')
    fs.writeFileSync(file, svgText)
    const page = await openSvg(browser, file)
    const report = await page.evaluate((r) => applyCardRecipe(r), recipe)
    await page.evaluate(() => pruneDefinitions())
    const svg = await page.evaluate(() => new XMLSerializer().serializeToString(document.documentElement))
    await page.close()
    return { svg, report }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

/** List what a card draws, with positions relative to its trim box. */
export async function describeCard(browser, file) {
  const page = await openSvg(browser, file)
  const result = await page.evaluate(() => describeCardElements())
  await page.close()
  return result
}

export async function renderPng(browser, svgFile, pngFile, width = 600) {
  const svg = fs.readFileSync(svgFile, 'utf8')
  const vb = /viewBox="([^"]+)"/.exec(svg)[1].split(/[\s,]+/).map(Number)
  const height = Math.round((width * vb[3]) / vb[2])
  const page = await browser.newPage({ viewport: { width, height } })
  await page.goto('file://' + path.resolve(svgFile))
  await page.evaluate(([w, h]) => {
    document.documentElement.setAttribute('width', w)
    document.documentElement.setAttribute('height', h)
  }, [width, height])
  await page.screenshot({ path: pngFile })
  await page.close()
}
