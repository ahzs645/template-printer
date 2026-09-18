/**
 * Round-trip test for card design packages.
 *
 *   pnpm test:package
 *
 * Builds a package from the reference templates and their fonts, reads it back,
 * and checks that everything needed to print the card survives — the artwork,
 * what each layer means, the card area, and the font files themselves.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import { register } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

register('./ts-resolver.mjs', import.meta.url)

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REFERENCE_DIR = path.resolve(HERE, '../../docs/reference-templates')

// --- browser globals -------------------------------------------------------

const { DOMParser, parseHTML } = await import('linkedom')
const { document: htmlDocument } = parseHTML('<html><body></body></html>')

globalThis.DOMParser = DOMParser
globalThis.XMLSerializer = class {
  serializeToString(node) {
    return node.toString()
  }
}
globalThis.URL.createObjectURL = () => 'blob:test'
globalThis.SVGElement = class {
  static [Symbol.hasInstance](value) {
    return Boolean(value) && typeof value.closest === 'function'
  }
}
globalThis.document = {
  createElement(tagName) {
    if (tagName === 'canvas') {
      return { getContext: () => ({ set font(v) {}, measureText: (text) => ({ width: text.length * 8 }) }) }
    }
    return htmlDocument.createElement(tagName)
  },
}
// atob is used to decode the base64 a font is stored as.
globalThis.atob = (value) => Buffer.from(value, 'base64').toString('binary')

// DOMPurify needs a real DOM, and refuses to run without one rather than
// passing untrusted markup through. jsdom gives the tests the genuine article,
// so what they exercise is the sanitiser itself, not a stub.
const { JSDOM } = await import('jsdom')
globalThis.window = new JSDOM('').window

const { parseTemplateString } = await import('../src/lib/svgTemplate.ts')
const { generateAutoMappings } = await import('../src/lib/autoMapping.ts')
const {
  createTemplatePackage,
  isTemplatePackage,
  packageFileName,
  readTemplatePackage,
} = await import('../src/lib/templatePackage.ts')

// --- helpers ---------------------------------------------------------------

let failures = 0
let passes = 0

async function check(name, body) {
  try {
    await body()
    passes += 1
    console.log(`  ok   ${name}`)
  } catch (error) {
    failures += 1
    console.error(`  FAIL ${name}`)
    console.error(`       ${error.message}`)
  }
}

function section(title) {
  console.log(`\n${title}`)
}

/** A font as storage holds it: base64, with the family the artwork asks for. */
function fakeFont(fontName, fileName, bytes) {
  return {
    id: fontName,
    fontName,
    fileName,
    fontData: Buffer.from(bytes).toString('base64'),
    // What a browser actually hands back for a .otf upload.
    mimeType: 'application/vnd.oasis.opendocument.formula-template',
    createdAt: new Date().toISOString(),
  }
}

async function loadSide(file) {
  const raw = fs.readFileSync(path.join(REFERENCE_DIR, file), 'utf8')
  const { metadata, autoFields } = await parseTemplateString(raw, file)
  return { template: metadata, fields: autoFields, mappings: generateAutoMappings(autoFields) }
}

const front = await loadSide('id-card-front.svg')
const back = await loadSide('id-card-back.svg')

// Two of the three families the artwork asks for are available, one is not.
const availableFonts = [
  fakeFont('HelveticaNeue-Medium', 'HelveticaNeueMedium.otf', [0x4f, 0x54, 0x54, 0x4f, 1, 2, 3]),
  fakeFont('HelveticaNeue-Bold', 'HelveticaNeueBold.otf', [0x4f, 0x54, 0x54, 0x4f, 4, 5, 6]),
]

section('building a package')

const built = await createTemplatePackage({
  name: 'id-card',
  front,
  back,
  availableFonts,
  sampleData: { 'fullname-first-last_1': 'Hyunseo Kim' },
})

await check('packages only the fonts the artwork asks for', () => {
  const packaged = built.manifest.fonts.map((font) => font.name).sort()
  assert.deepEqual(packaged, ['HelveticaNeue-Bold', 'HelveticaNeue-Medium'])
})

await check('records fonts it could not include rather than dropping them', () => {
  // The artwork also asks for plain HelveticaNeue, which is not loaded.
  assert.deepEqual(built.manifest.missingFonts, ['HelveticaNeue'])
})

await check('corrects the font type the browser guessed wrong', () => {
  // Browsers commonly report .otf as an OpenDocument type.
  assert.deepEqual(
    built.manifest.fonts.map((font) => font.mimeType),
    ['font/otf', 'font/otf'],
  )
})

await check('carries both sides', () => {
  assert.equal(built.manifest.sides.front.file, 'front.svg')
  assert.equal(built.manifest.sides.back.file, 'back.svg')
})

section('reading it back')

const file = new File([built.blob], packageFileName('id-card'), { type: 'application/zip' })

await check('is recognised as a package', () => {
  assert.equal(isTemplatePackage(file), true)
  assert.equal(isTemplatePackage(new File(['x'], 'card.svg', { type: 'image/svg+xml' })), false)
})

const loaded = await readTemplatePackage(file)

await check('restores the artwork', () => {
  // Package contents are sanitised on the way in, which rewrites the
  // serialisation, so the content is what has to survive.
  const countIn = (markup, pattern) => (markup.match(pattern) || []).length
  for (const pattern of [/<text/g, /<tspan/g, /<rect/g, /<path/g, /id=/g, /\.cls-\d+[\s,{]/g]) {
    assert.equal(countIn(loaded.front.svg, pattern), countIn(front.template.rawSvg, pattern))
  }
  assert.match(loaded.front.svg, /viewBox="0 0 252 162"/)
  assert.match(loaded.back.svg, /id="barcode_codabar_studentId"/)
})

await check('strips anything executable out of a package', async () => {
  // A package can be fetched from any url a link points at.
  const hostile = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><script>alert(1)</script><rect width="9" height="9" onload="alert(2)"/><text id="studentId">1</text></svg>'
  const parsed = await parseTemplateString(hostile, 'hostile.svg')
  const built = await createTemplatePackage({
    name: 'hostile',
    front: { template: parsed.metadata, fields: parsed.autoFields, mappings: [] },
    availableFonts: [],
  })
  const reopened = await readTemplatePackage(new File([built.blob], 'hostile.zip', { type: 'application/zip' }))
  assert.doesNotMatch(reopened.front.svg, /<script/i)
  assert.doesNotMatch(reopened.front.svg, /\son\w+\s*=/i)
  assert.match(reopened.front.svg, /id="studentId"/)
})

await check('restores what each layer means', () => {
  assert.deepEqual(loaded.front.mappings, front.mappings)
  assert.deepEqual(loaded.back.mappings, back.mappings)
  assert.deepEqual(
    loaded.front.fields.map((field) => field.sourceId),
    front.fields.map((field) => field.sourceId),
  )
})

await check('restores the font files under the name the artwork asks for', async () => {
  const names = loaded.fonts.map((font) => font.name).sort()
  assert.deepEqual(names, ['HelveticaNeue-Bold', 'HelveticaNeue-Medium'])

  const bold = loaded.fonts.find((font) => font.name === 'HelveticaNeue-Bold')
  const bytes = new Uint8Array(await bold.file.arrayBuffer())
  assert.deepEqual([...bytes], [0x4f, 0x54, 0x54, 0x4f, 4, 5, 6], 'the font file comes back byte for byte')
  assert.equal(bold.file.name, 'HelveticaNeueBold.otf')
})

await check('restores the sample values', () => {
  assert.deepEqual(loaded.manifest.sampleData, { 'fullname-first-last_1': 'Hyunseo Kim' })
})

await check('keeps the card area, so the card still prints at its real size', async () => {
  const { CARD_FORMATS, applyCardArea } = await import('../src/lib/cardTrim.ts')
  const canvas = front.template.viewBox
  const applied = applyCardArea(front.template.rawSvg, canvas, {
    box: front.template.trimCandidates[0].box,
    format: CARD_FORMATS[0],
    keepBleed: true,
  })
  const sized = await parseTemplateString(applied.svg, 'id-card-front.svg')
  sized.metadata.cardArea = {
    formatId: 'id-1',
    keepBleed: true,
    bleedMm: applied.bleedMm,
    trimBox: applied.trimBox,
    trimWidthMm: applied.trimWidthMm,
    trimHeightMm: applied.trimHeightMm,
  }

  const withArea = await createTemplatePackage({
    name: 'id-card',
    front: { template: sized.metadata, fields: sized.autoFields, mappings: front.mappings },
    availableFonts,
  })
  const reopened = await readTemplatePackage(
    new File([withArea.blob], 'id-card.zip', { type: 'application/zip' }),
  )
  assert.equal(reopened.front.cardArea.trimWidthMm, 85.725)
  assert.equal(reopened.front.cardArea.keepBleed, true)
})

section('rejecting what is not a package')

await check('a bare zip is refused', async () => {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  zip.file('notes.txt', 'hello')
  const blob = await zip.generateAsync({ type: 'blob' })
  await assert.rejects(
    () => readTemplatePackage(new File([blob], 'other.zip', { type: 'application/zip' })),
    /not a template package/i,
  )
})

await check('a file that is not a zip is refused', async () => {
  await assert.rejects(
    () => readTemplatePackage(new File(['<svg/>'], 'card.zip', { type: 'application/zip' })),
    /not a template package/i,
  )
})

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
