#!/usr/bin/env node
/**
 * Package each design in sources/*.json — all its variants and its back — as a
 * template-printer package (.zip) that the app opens with Open or ?url=.
 *
 *   node templates/package.mjs [--fonts dir] [--out dir]
 *
 * --fonts  a folder of font files to include. A font is included when its file
 *          name (minus extension, ignoring case and punctuation) matches a
 *          font family the artwork uses, e.g. HelveticaNeue-Medium.otf for
 *          "HelveticaNeue-Medium". Fonts are not kept in this repository:
 *          check the licence before passing one in for a package you share.
 * --out    where the zips go (default templates/dist, which git ignores).
 *
 * The packages carry no field list or mappings: the layer names already say
 * what everything is, and the app works them out on import exactly as it
 * would for a hand-uploaded SVG.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(ROOT, '../frontend/package.json'))
const JSZip = require('jszip')

let fontsDir = null
let outDir = path.join(ROOT, 'dist')
const args = process.argv.slice(2)
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--fonts') fontsDir = path.resolve(args[++i])
  else if (args[i] === '--out') outDir = path.resolve(args[++i])
}

const normalise = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
const fontFiles = new Map()
if (fontsDir) {
  for (const file of fs.readdirSync(fontsDir)) {
    if (/\.(otf|ttf|woff2?)$/i.test(file)) fontFiles.set(normalise(file.replace(/\.[^.]+$/, '')), path.join(fontsDir, file))
  }
}

const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'helvetica', 'arial'])
/** The first family of every font-family the artwork declares. */
function fontsUsed(svg) {
  const families = new Set()
  for (const match of svg.matchAll(/font-family\s*(?::|=")\s*([^;,}"]+)/g)) {
    const family = match[1].trim().replace(/^['"]|['"]$/g, '')
    if (family && !GENERIC.has(family.toLowerCase())) families.add(family)
  }
  // Barcode placeholders are replaced by drawn bars; their font never renders.
  return families
}

const MIME = { otf: 'font/otf', ttf: 'font/ttf', woff: 'font/woff', woff2: 'font/woff2' }
const side = (file, name) => ({ file, name, fields: [], mappings: [] })

fs.mkdirSync(outDir, { recursive: true })
for (const sourceFile of fs.readdirSync(path.join(ROOT, 'sources')).filter((f) => f.endsWith('.json'))) {
  const source = JSON.parse(fs.readFileSync(path.join(ROOT, 'sources', sourceFile), 'utf8'))
  for (const design of source.designs) {
    const zip = new JSZip()
    const svgs = []
    const variants = []
    design.variants.forEach((variant, index) => {
      const svg = fs.readFileSync(path.join(ROOT, source.family, design.slug, `${variant.slug}.svg`), 'utf8')
      svgs.push(svg)
      const file = index === 0 ? 'front.svg' : `variants/${variant.slug}/front.svg`
      zip.file(file, svg)
      variants.push({ id: variant.slug, name: variant.name, front: side(file, `${design.slug}-${variant.slug}.svg`), ...(variant.match ? { match: variant.match } : {}) })
    })

    let back
    if (source.back) {
      const svg = fs.readFileSync(path.join(ROOT, source.back), 'utf8')
      svgs.push(svg)
      zip.file('back.svg', svg)
      back = side('back.svg', `${source.family}-back.svg`)
    }

    const fonts = []
    const missingFonts = []
    for (const family of new Set(svgs.flatMap((svg) => [...fontsUsed(svg)]))) {
      const file = fontFiles.get(normalise(family))
      if (!file) {
        missingFonts.push(family)
        continue
      }
      const extension = path.extname(file).slice(1).toLowerCase()
      const entry = `fonts/${family.replace(/[^a-zA-Z0-9._-]+/g, '-')}.${extension}`
      zip.file(entry, fs.readFileSync(file))
      fonts.push({ name: family, file: entry, fileName: path.basename(file), mimeType: MIME[extension] ?? 'font/ttf' })
    }

    const manifest = {
      format: 'template-printer-package',
      version: 1,
      createdAt: new Date().toISOString(),
      name: design.name,
      sides: { front: variants[0].front, ...(back ? { back } : {}) },
      ...(variants.length > 1 ? { variants } : {}),
      ...(design.variantField ? { variantField: design.variantField } : {}),
      fonts,
      ...(missingFonts.length ? { missingFonts } : {}),
    }
    zip.file('manifest.json', JSON.stringify(manifest, null, 2))

    const out = path.join(outDir, `${source.family}-${design.slug}.zip`)
    fs.writeFileSync(out, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
    const size = (fs.statSync(out).size / 1024).toFixed(0)
    console.log(`${path.relative(process.cwd(), out)}  ${variants.length} variant(s)${back ? ' + back' : ''}, ${fonts.length} font(s)${missingFonts.length ? `, missing: ${missingFonts.join(', ')}` : ''}  ${size} KB`)
  }
}
