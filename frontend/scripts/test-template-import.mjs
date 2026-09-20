/**
 * Regression test for the SVG template import pipeline.
 *
 * Runs the real importer, auto-mapper and renderer against the Illustrator
 * exports in docs/reference-templates/, which exercise the awkward parts of a
 * vector-editor export: styling declared in a <style> block, words split across
 * tspans for kerning, and text positioned by transform rather than x/y.
 *
 *   pnpm test:template-import
 *
 * The browser APIs the library needs are stubbed: linkedom supplies the DOM,
 * and text measurement uses a fixed character-width ratio so the results do not
 * depend on which fonts the machine has installed.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import { register } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The app's sources omit file extensions on relative imports; teach Node to
// fill them in before anything under src/ is loaded.
register('./ts-resolver.mjs', import.meta.url)

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REFERENCE_DIR = path.resolve(HERE, '../../docs/reference-templates')

// --- browser globals -------------------------------------------------------

const { DOMParser, parseHTML } = await import('linkedom')
const { document: htmlDocument } = parseHTML('<html><body></body></html>')

/**
 * Width of one character relative to the font size.
 *
 * The library measures text with a canvas. Rather than pull in node-canvas,
 * which measures against whatever fonts happen to be installed, this stands in
 * a fixed ratio: the numbers stop depending on the machine, so wrapping and
 * auto-shrink assertions mean the same thing here and in CI.
 */
const CHARACTER_WIDTH_RATIO = 0.55

function createMeasuringContext() {
  let fontSize = 16
  return {
    set font(value) {
      const match = /([0-9.]+)px/.exec(value)
      if (match) fontSize = Number.parseFloat(match[1])
    },
    measureText(text) {
      return { width: text.length * fontSize * CHARACTER_WIDTH_RATIO }
    },
  }
}

globalThis.DOMParser = DOMParser
globalThis.XMLSerializer = class {
  serializeToString(node) {
    return node.toString()
  }
}
globalThis.Blob = class {}
globalThis.URL.createObjectURL = () => 'blob:test'
// linkedom has no SVGElement; every element it produces behaves like one here.
globalThis.SVGElement = class {
  static [Symbol.hasInstance](value) {
    return Boolean(value) && typeof value.closest === 'function'
  }
}
globalThis.document = {
  createElement(tagName) {
    if (tagName === 'canvas') return { getContext: () => createMeasuringContext() }
    return htmlDocument.createElement(tagName)
  },
}

const { parseTemplateString, renderSvgWithData, scopeSvgMarkup } = await import('../src/lib/svgTemplate.ts')
const { generateAutoMappings } = await import('../src/lib/autoMapping.ts')
const { parseField } = await import('../src/lib/fieldParser.ts')
const { normalizeStandardFieldName, parseBarcodeLayerId } = await import('../src/lib/standardFields.ts')
const { generateBarcodeSvg, normalizeBarcodeText, validateBarcodeText } = await import('../src/lib/barcode.ts')
const { assignCardSides, readSideFromFileName, suggestDesignName } = await import('../src/lib/cardSides.ts')
const { TEST_CASES, countIssues, runTestCards } = await import('../src/lib/testCards.ts')
const { CARD_FORMATS, applyCardArea, detectTrimCandidates, isWorthSuggesting } = await import('../src/lib/cardTrim.ts')
const { calculateCardPositions, getSlotScale } = await import('../src/lib/exporter.ts')
const {
  ID1_HEIGHT_MM,
  ID1_WIDTH_MM,
  MAGNETIC_TRACKS_MM,
  createCardBlankSvg,
  getPunchRect,
  punchConflictsWithStripe,
} = await import('../src/lib/cardBlanks.ts')

// --- helpers ---------------------------------------------------------------

let failures = 0
let passes = 0
/** Async checks are collected here and settled before the summary. */
const pending = []

function pass(name) {
  passes += 1
  console.log(`  ok   ${name}`)
}

function fail(name, error) {
  failures += 1
  console.error(`  FAIL ${name}`)
  console.error(`       ${error.message}`)
}

/**
 * An async body returns a promise, which a plain try/catch would let float away
 * — the check would report a pass however it ended. Promises are held here and
 * awaited before anything is reported.
 */
function check(name, body) {
  let result
  try {
    result = body()
  } catch (error) {
    fail(name, error)
    return
  }

  if (result && typeof result.then === 'function') {
    pending.push(
      result.then(
        () => pass(name),
        (error) => fail(name, error),
      ),
    )
    return
  }

  pass(name)
}

function section(title) {
  console.log(`\n${title}`)
}

function readReference(name) {
  return fs.readFileSync(path.join(REFERENCE_DIR, name), 'utf8')
}

/** Render the front card for one user and return the markup. */
function renderFront(template, fields, mappings, user) {
  const byLayer = new Map(mappings.map((mapping) => [mapping.svgLayerId, mapping]))
  const cardData = {}
  for (const field of fields) {
    const mapping = byLayer.get(field.sourceId || field.id)
    if (mapping) {
      cardData[field.id] = parseField(mapping.standardFieldName, user, mapping.customValue)
    }
  }
  return renderSvgWithData(template, fields, cardData)
}

/** Pull the tspan lines of one text layer out of rendered markup. */
function linesForLayer(markup, layerId) {
  const element = new DOMParser()
    .parseFromString(markup, 'image/svg+xml')
    .getElementById(layerId)
  assert.ok(element, `layer "${layerId}" is missing from the rendered SVG`)
  const tspans = Array.from(element.querySelectorAll('tspan'))
  if (tspans.length === 0) return [element.textContent.trim()]
  return tspans.map((tspan) => tspan.textContent)
}

function attributeForLayer(markup, layerId, attribute) {
  const element = new DOMParser()
    .parseFromString(markup, 'image/svg+xml')
    .getElementById(layerId)
  assert.ok(element, `layer "${layerId}" is missing from the rendered SVG`)
  return element.getAttribute(attribute)
}

// --- the reference front card ----------------------------------------------

const NAME_LAYER = 'fullName_First_LineBreak_Last'
const POSITION_LAYER = 'position_AllCaps'

const front = await parseTemplateString(readReference('card-front.svg'), 'card-front.svg')
const frontMappings = generateAutoMappings(front.autoFields)

section('card-front.svg — import')

check('detects both text layers', () => {
  const ids = front.autoFields.map((field) => field.sourceId).sort()
  assert.deepEqual(ids, [NAME_LAYER, POSITION_LAYER])
})

check('rejoins tspans split for kerning', () => {
  const name = front.autoFields.find((field) => field.sourceId === NAME_LAYER)
  // Raw textContent would read "ParniyaPeykamiyan".
  assert.equal(name.label, 'Parniya Peykamiyan')
})

check('resolves font and fill from the <style> block', () => {
  const name = front.autoFields.find((field) => field.sourceId === NAME_LAYER)
  assert.equal(name.fontFamily, 'HelveticaNeue-Bold')
  assert.equal(name.fontWeight, 700)
  assert.equal(name.color, '#e3efcf', 'text must not fall back to black')
  assert.equal(name.fontSize, 15)
})

check('carries the line spacing from the artwork', () => {
  const name = front.autoFields.find((field) => field.sourceId === NAME_LAYER)
  assert.equal(name.lineHeight, 15)
})

check('auto-maps every layer', () => {
  const mapped = frontMappings.map((mapping) => mapping.standardFieldName).sort()
  assert.deepEqual(mapped, [NAME_LAYER, POSITION_LAYER])
})

section('card-front.svg — render')

const users = {
  long: { firstName: 'Parniya', lastName: 'Peykamiyan', position: 'Social Media Manager' },
  short: { firstName: 'Jo', lastName: 'Ng', position: 'Designer' },
  veryLong: { firstName: 'Maximilian', lastName: 'Vandersteenhoven', position: 'Head of Communications' },
}

check('keeps a short name on two lines', () => {
  const markup = renderFront(front.metadata, front.autoFields, frontMappings, users.short)
  assert.deepEqual(linesForLayer(markup, NAME_LAYER), ['Jo', 'Ng'])
})

check('keeps a long name on two lines', () => {
  const markup = renderFront(front.metadata, front.autoFields, frontMappings, users.long)
  assert.deepEqual(linesForLayer(markup, NAME_LAYER), ['Parniya', 'Peykamiyan'])
})

check('uppercases the position from the layer name', () => {
  const markup = renderFront(front.metadata, front.autoFields, frontMappings, users.long)
  assert.equal(linesForLayer(markup, POSITION_LAYER).join(' '), 'SOCIAL MEDIA MANAGER')
})

check('keeps the artwork fill on replaced text', () => {
  const markup = renderFront(front.metadata, front.autoFields, frontMappings, users.long)
  assert.equal(attributeForLayer(markup, NAME_LAYER, 'fill'), '#e3efcf')
})

check('shrinks a name too wide to wrap', () => {
  const markup = renderFront(front.metadata, front.autoFields, frontMappings, users.veryLong)
  const size = Number(attributeForLayer(markup, NAME_LAYER, 'font-size'))
  assert.ok(size < 15, `expected the font to shrink below 15, got ${size}`)
  assert.ok(size >= 9, `expected the font to stay legible, got ${size}`)
})

// --- the reference back card ------------------------------------------------

section('card-back.svg — import')

const back = await parseTemplateString(readReference('card-back.svg'), 'card-back.svg')

check('imports artwork-only templates with no fields', () => {
  assert.equal(back.autoFields.length, 0)
})

check('does not mistake artwork layer ids for fields', () => {
  for (const id of ['Layer_2', 'Layer_1-2', 'New_Pattern_6']) {
    assert.equal(normalizeStandardFieldName(id), null, `${id} should not resolve to a field`)
  }
})

// --- scoping ----------------------------------------------------------------

section('scopeSvgMarkup')

check('renames classes and ids so two SVGs can share a document', () => {
  const scopedFront = scopeSvgMarkup(front.metadata.rawSvg, 'a-')
  const scopedBack = scopeSvgMarkup(back.metadata.rawSvg, 'b-')

  assert.ok(scopedFront.includes('a-cls-1'), 'front classes should be prefixed')
  assert.ok(scopedBack.includes('b-cls-1'), 'back classes should be prefixed')
  assert.ok(!scopedFront.includes('"cls-1"'), 'no unscoped class should remain')

  // Both files declare cls-1, and both name a layer Layer_2.
  assert.ok(scopedBack.includes('b-Layer_2'))
  assert.ok(!scopedBack.includes('"Layer_2"'))
})

check('rewrites url(#...) references to match the renamed ids', () => {
  const scopedBack = scopeSvgMarkup(back.metadata.rawSvg, 'b-')
  assert.ok(scopedBack.includes('url(#b-New_Pattern_6)'), 'pattern fill must follow its id')
  assert.ok(!/url\(#New_Pattern_6\)/.test(scopedBack), 'no reference should point at the old id')
})

check('leaves decimals in the stylesheet alone', () => {
  const scoped = scopeSvgMarkup(front.metadata.rawSvg, 'a-')
  assert.ok(scoped.includes('stroke-width: .26px'), 'a decimal is not a class selector')
})

// --- the name convention ----------------------------------------------------

section('name formats')

const person = { firstName: 'John', lastName: 'Smith', middleName: 'Allen' }
const noMiddle = { firstName: 'Jo', lastName: 'Ng' }

const nameCases = [
  ['fullName_First_Last', person, 'John Smith'],
  ['fullName_First_LineBreak_Last', person, 'John\nSmith'],
  ['fullName_First_LineBreak_Last_TitleCase', { firstName: 'JOHN', lastName: 'SMITH' }, 'John\nSmith'],
  ['fullName_Last_Comma_First', person, 'Smith, John'],
  ['fullName_Last_Comma_LineBreak_First', person, 'Smith,\nJohn'],
  ['fullName_First_Middle_Last', person, 'John Allen Smith'],
  ['fullName_First_MiddleInitial_Last', person, 'John A. Smith'],
  ['middleInitial', person, 'A.'],
  // Missing parts must not leave a double space or a dangling comma.
  ['fullName_First_MiddleInitial_Last', noMiddle, 'Jo Ng'],
  ['fullName_Last_Comma_First_MiddleInitial', noMiddle, 'Ng, Jo'],
  ['fullName_Last_Comma_First', { lastName: 'Ng' }, 'Ng'],
]

for (const [fieldName, user, expected] of nameCases) {
  check(`${fieldName} -> ${JSON.stringify(expected)}`, () => {
    assert.equal(parseField(fieldName, user), expected)
  })
}

section('layer id resolution')

const resolutionCases = [
  ['FULLNAME_FIRST_LINEBREAK_LAST', 'fullName_First_LineBreak_Last'],
  ['fullName_Last_Comma_LineBreak_First_AllCaps', 'fullName_Last_Comma_LineBreak_First_AllCaps'],
  ['FirstName_AllCaps', 'firstName_AllCaps'],
  ['position_AllCaps', 'position_AllCaps'],
  // Not field names.
  ['photo_AllCaps', null],
  ['fullName', null],
  ['customSchoolName', null],
  ['Layer_2', null],
  ['constructor', null],
]

for (const [layerId, expected] of resolutionCases) {
  check(`${layerId} -> ${expected}`, () => {
    assert.equal(normalizeStandardFieldName(layerId), expected)
  })
}

// --- the ID card pair -------------------------------------------------------

section('id-card-front.svg')

const idFront = await parseTemplateString(readReference('id-card-front.svg'), 'id-card-front.svg')
const idFrontMappings = generateAutoMappings(idFront.autoFields)

check('auto-maps the name, id and photo', () => {
  const mapped = idFrontMappings.map((mapping) => mapping.standardFieldName).sort()
  assert.deepEqual(mapped, ['fullName_First_Last', 'photo', 'studentId'])
})

check('finds a signature or logo placeholder, however it is drawn', async () => {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 252 162">',
    '  <g id="photo"><rect x="10" y="10" width="40" height="50"/></g>',
    '  <rect id="signature" x="60" y="10" width="60" height="20"/>',
    '  <image id="logo" x="140" y="10" width="30" height="30"/>',
    '</svg>',
  ].join('\n')
  const parsed = await parseTemplateString(svg, 'images.svg')
  const ids = parsed.autoFields.filter((field) => field.type === 'image').map((field) => field.sourceId).sort()
  assert.deepEqual(ids, ['logo', 'photo', 'signature'])
})

check('does not report the photo twice', () => {
  const images = idFront.autoFields.filter((field) => field.type === 'image')
  assert.equal(images.length, 1, `expected one image field, got ${images.map((f) => f.sourceId).join(', ')}`)
})

section('id-card-back.svg')

const idBack = await parseTemplateString(readReference('id-card-back.svg'), 'id-card-back.svg')
const idBackMappings = generateAutoMappings(idBack.autoFields)

check('recognises the barcode layer', () => {
  const barcode = idBack.autoFields.find((field) => field.sourceId === 'barcode_codabar_studentId')
  assert.ok(barcode, 'the barcode layer should be detected')
  assert.equal(barcode.type, 'barcode')
  assert.equal(barcode.barcodeSymbology, 'codabar')
})

check('maps the barcode to the field named in its layer id', () => {
  const mapping = idBackMappings.find((entry) => entry.svgLayerId === 'barcode_codabar_studentId')
  assert.ok(mapping, 'the barcode layer should auto-map')
  assert.equal(mapping.standardFieldName, 'studentId')
})

check('replaces the barcode layer with generated bars', () => {
  const byLayer = new Map(idBackMappings.map((mapping) => [mapping.svgLayerId, mapping]))
  const cardData = {}
  for (const field of idBack.autoFields) {
    const mapping = byLayer.get(field.sourceId || field.id)
    if (mapping) cardData[field.id] = parseField(mapping.standardFieldName, { studentId: '2002014682274023' })
  }
  const markup = renderSvgWithData(idBack.metadata, idBack.autoFields, cardData)

  const element = new DOMParser()
    .parseFromString(markup, 'image/svg+xml')
    .getElementById('barcode_codabar_studentId')
  assert.ok(element, 'the barcode layer should still be present')
  assert.equal(element.tagName.toLowerCase(), 'g', 'the <text> placeholder should become a group')
  assert.equal(element.getAttribute('data-idcard-barcode'), 'codabar')
  assert.ok(element.querySelector('path'), 'the group should contain drawn bars')
  assert.equal(element.querySelector('text'), null, 'the value must not survive as text in the barcode')
})

section('barcode fonts')

check('flags a template that draws barcodes with a font', async () => {
  // The artwork as supplied, before the barcode layer was named.
  const fontDrawn = readReference('id-card-back.svg').replace(
    'id="barcode_codabar_studentId" ',
    '',
  )
  const parsed = await parseTemplateString(fontDrawn, 'font-barcode.svg')
  assert.ok(parsed.metadata.warnings?.length, 'a font-drawn barcode should produce a warning')
  assert.match(parsed.metadata.warnings[0], /Codabarlarge/)
})

check('does not flag the named barcode layer', () => {
  assert.equal(idBack.metadata.warnings, undefined)
})

check('does not ask for a font the barcode layer no longer needs', () => {
  assert.ok(
    !idBack.metadata.fonts.some((font) => /codabar/i.test(font)),
    `Codabarlarge should not be required: ${idBack.metadata.fonts.join(', ')}`,
  )
  // The fonts the rest of the card genuinely uses are still listed.
  assert.ok(idBack.metadata.fonts.some((font) => /HelveticaNeue/i.test(font)))
})

check('previews a barcode from its placeholder value', () => {
  const markup = renderSvgWithData(idBack.metadata, idBack.autoFields, {})
  const element = new DOMParser()
    .parseFromString(markup, 'image/svg+xml')
    .getElementById('barcode_codabar_studentId')
  assert.equal(element.tagName.toLowerCase(), 'g', 'the placeholder should already render as bars')
})

// --- barcode encoding -------------------------------------------------------

section('barcode encoding')

check('supplies Codabar start and stop characters', () => {
  // The value on the supplied artwork has neither, which is why it does not scan.
  assert.equal(normalizeBarcodeText('codabar', '2002014682274023'), 'A2002014682274023B')
  // An explicit pair is left alone.
  assert.equal(normalizeBarcodeText('codabar', 'C123D'), 'C123D')
})

check('rejects characters Codabar cannot encode', () => {
  assert.equal(validateBarcodeText('codabar', 'ABC123').valid, false)
  assert.equal(validateBarcodeText('codabar', '1234').valid, true)
})

check('generates vector bars, not text', () => {
  const barcode = generateBarcodeSvg({ symbology: 'codabar', text: '2002014682274023' })
  assert.ok(barcode.width > 0 && barcode.height > 0)
  assert.ok(barcode.svg.includes('<path'), 'expected path geometry')
  assert.ok(!barcode.svg.includes('<text'), 'expected no text')
})

check('honours the layer colour', () => {
  const barcode = generateBarcodeSvg({ symbology: 'codabar', text: '1234', color: '#010101' })
  assert.ok(barcode.svg.includes('010101'), 'the bar colour should carry through')
})

check('parses barcode layer ids', () => {
  assert.deepEqual(parseBarcodeLayerId('barcode_codabar_studentId'), {
    symbology: 'codabar',
    standardFieldName: 'studentId',
  })
  assert.deepEqual(parseBarcodeLayerId('barcode_code128'), {
    symbology: 'code128',
    standardFieldName: null,
  })
  assert.equal(parseBarcodeLayerId('barcode_nonsense'), null)
  assert.equal(parseBarcodeLayerId('studentId'), null)
})

// --- front / back pairing ---------------------------------------------------

section('card sides')

check('reads a side out of a filename', () => {
  assert.equal(readSideFromFileName('id-card-front.svg'), 'front')
  assert.equal(readSideFromFileName('id-card-back.svg'), 'back')
  assert.equal(readSideFromFileName('badge_verso.svg'), 'back')
  assert.equal(readSideFromFileName('ID Card Back.svg'), 'back')
  assert.equal(readSideFromFileName('badge-side-b.svg'), 'back')
  assert.equal(readSideFromFileName('badge-f.svg'), 'front')
  assert.equal(readSideFromFileName('Asset 8.svg'), null)
  // Naming both sides in one filename says nothing about this file.
  assert.equal(readSideFromFileName('front-and-back.svg'), null)
})

check('uses the filename when it says which side is which', () => {
  const pair = assignCardSides([
    { fileName: 'id-card-back.svg', fields: idBack.autoFields },
    { fileName: 'id-card-front.svg', fields: idFront.autoFields },
  ])
  assert.equal(pair.front.fileName, 'id-card-front.svg')
  assert.equal(pair.back.fileName, 'id-card-back.svg')
})

check('falls back to which side carries the person', () => {
  // Illustrator's default names say nothing, so the photo and name decide.
  const pair = assignCardSides([
    { fileName: 'Asset 10.svg', fields: idBack.autoFields },
    { fileName: 'Asset 8.svg', fields: idFront.autoFields },
  ])
  assert.equal(pair.front.fileName, 'Asset 8.svg', 'the side with the photo and name is the front')
})

check('names the design after what the two files share', () => {
  assert.equal(suggestDesignName('id-card-front.svg', 'id-card-back.svg'), 'id-card')
  assert.equal(suggestDesignName('Asset 8.svg', 'Asset 10.svg'), 'Asset')
})

// --- card blanks ------------------------------------------------------------

section('card blanks')

check('generates an ID-1 card in millimetres', async () => {
  const svg = createCardBlankSvg({ side: 'front' })
  assert.match(svg, new RegExp(`width="${ID1_WIDTH_MM}mm"`))
  assert.match(svg, new RegExp(`height="${ID1_HEIGHT_MM}mm"`))
  // A blank must import as a working template, not just look like one.
  const parsed = await parseTemplateString(svg, 'card-front.svg')
  assert.equal(parsed.metadata.unit, 'mm')
  const ids = parsed.autoFields.map((field) => field.sourceId).sort()
  assert.deepEqual(ids, ['fullName_First_LineBreak_Last', 'photo', 'position_AllCaps', 'studentId'])
})

check('a barcode blank imports as a barcode field', async () => {
  const svg = createCardBlankSvg({ side: 'back', barcode: 'codabar', barcodeField: 'studentId' })
  const parsed = await parseTemplateString(svg, 'card-back.svg')
  const barcode = parsed.autoFields.find((field) => field.type === 'barcode')
  assert.ok(barcode, 'the blank should carry a barcode field')
  assert.equal(barcode.barcodeSymbology, 'codabar')
})

check('the stripe covers all three ISO tracks', () => {
  const svg = createCardBlankSvg({ side: 'back', magneticStripe: true })
  const stripe = /<g id="magneticStripe">\s*<rect x="0" y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/.exec(svg)
  assert.ok(stripe, 'the stripe should be drawn')
  const top = Number(stripe[1])
  const bottom = top + Number(stripe[2])
  assert.ok(top <= MAGNETIC_TRACKS_MM[0].top, `stripe starts at ${top}, above track 1 at ${MAGNETIC_TRACKS_MM[0].top}`)
  assert.ok(bottom >= MAGNETIC_TRACKS_MM[2].bottom, `stripe ends at ${bottom}, below track 3 at ${MAGNETIC_TRACKS_MM[2].bottom}`)
})

check('the stripe is only ever put on a back', () => {
  assert.ok(!createCardBlankSvg({ side: 'front', magneticStripe: true }).includes('magneticStripe'))
})

check('places the punch on the edge it names', () => {
  const left = getPunchRect({ punch: 'left-center', widthMm: ID1_WIDTH_MM, heightMm: ID1_HEIGHT_MM })
  assert.ok(left.x < ID1_WIDTH_MM / 4, 'a left punch belongs on the left')
  assert.ok(left.height > left.width, 'a slot on an end runs vertically')

  const top = getPunchRect({ punch: 'top-center', widthMm: ID1_WIDTH_MM, heightMm: ID1_HEIGHT_MM })
  assert.ok(top.width > top.height, 'a slot on the top runs horizontally')
  assert.equal(getPunchRect({ punch: 'none', widthMm: ID1_WIDTH_MM, heightMm: ID1_HEIGHT_MM }), null)
})

check('catches a punch that would cut the magnetic stripe', () => {
  assert.equal(punchConflictsWithStripe({ punch: 'top-center' }), true)
  assert.equal(punchConflictsWithStripe({ punch: 'left-center' }), false)
  assert.equal(punchConflictsWithStripe({ punch: 'bottom-center' }), false)
  assert.equal(punchConflictsWithStripe({ punch: 'none' }), false)
})

// --- test cards -------------------------------------------------------------

section('test cards')

function mappingMap(mappings) {
  return Object.fromEntries(mappings.map((mapping) => [mapping.svgLayerId, mapping.standardFieldName]))
}

const staffResults = runTestCards(front.metadata, front.autoFields, mappingMap(frontMappings))
const backResults = runTestCards(idBack.metadata, idBack.autoFields, mappingMap(idBackMappings))

check('runs every case', () => {
  assert.equal(staffResults.length, TEST_CASES.length)
  assert.ok(staffResults.every((result) => result.svg.length > 0))
})

check('passes a name that fits', () => {
  const typical = staffResults.find((result) => result.testCase.id === 'typical')
  assert.deepEqual(typical.issues, [], JSON.stringify(typical.issues))
})

check('reports text shrunk to fit', () => {
  const long = staffResults.find((result) => result.testCase.id === 'long-name')
  assert.ok(
    long.issues.some((issue) => issue.severity === 'warning' && /shrunk/i.test(issue.message)),
    JSON.stringify(long.issues),
  )
})

check('reports a word too wide even after shrinking', () => {
  const unbreakable = staffResults.find((result) => result.testCase.id === 'long-single-word')
  assert.ok(
    unbreakable.issues.some((issue) => issue.severity === 'error' && /wider than the space/i.test(issue.message)),
    JSON.stringify(unbreakable.issues),
  )
})

check('reports a barcode value the symbology cannot encode', () => {
  const letters = backResults.find((result) => result.testCase.id === 'non-numeric-id')
  assert.ok(
    letters.issues.some((issue) => issue.severity === 'error' && /Codabar accepts/i.test(issue.message)),
    JSON.stringify(letters.issues),
  )
})

check('reports a mapped field the record leaves empty', () => {
  const empty = backResults.find((result) => result.testCase.id === 'missing-optional')
  assert.ok(
    empty.issues.some((issue) => /no value/i.test(issue.message)),
    JSON.stringify(empty.issues),
  )
})

check('stays quiet about static artwork', () => {
  // The back card's university name and address are unmapped by design.
  const typical = backResults.find((result) => result.testCase.id === 'typical')
  assert.deepEqual(typical.issues, [], JSON.stringify(typical.issues))
})

check('counts issues across the run', () => {
  const totals = countIssues(backResults)
  assert.ok(totals.errors >= 2, `expected at least two errors, got ${totals.errors}`)
})

// --- card area --------------------------------------------------------------

section('card area')

const ID1 = CARD_FORMATS[0]
const idFrontCanvas = idFront.metadata.viewBox ?? {
  x: 0,
  y: 0,
  width: idFront.metadata.width,
  height: idFront.metadata.height,
}

check('finds the trim line in artwork drawn with bleed', () => {
  const candidates = idFront.metadata.trimCandidates ?? []
  assert.equal(candidates.length, 1, `expected one suggestion, got ${candidates.length}`)
  const [trim] = candidates
  assert.deepEqual(trim.box, { x: 4.5, y: 4.5, width: 243, height: 153 })
  assert.ok(trim.stroked, 'the trim line is drawn as a stroke')
  assert.ok(trim.evenInset, 'bleed is even on all four sides')
  assert.equal(trim.bestFormat.id, 'id-1')
  assert.ok(trim.aspectErrorPercent < 0.01, `aspect error ${trim.aspectErrorPercent}`)
})

check('suggests nothing when there is no trim line', () => {
  // The staff card is drawn at its finished size, with no bleed.
  assert.equal(front.metadata.trimCandidates, undefined)
})

check('never suggests a rectangle that is not card-shaped', () => {
  const canvas = { x: 0, y: 0, width: 400, height: 400 }
  const square = {
    id: 'x',
    box: { x: 10, y: 10, width: 380, height: 380 },
    inset: { top: 10, right: 10, bottom: 10, left: 10 },
    evenInset: true,
    stroked: true,
    bestFormat: ID1,
    aspectErrorPercent: 37,
  }
  assert.equal(isWorthSuggesting(square, canvas), false)
})

check('correcting the size keeps the artwork untouched', () => {
  const trim = idFront.metadata.trimCandidates[0]
  const applied = applyCardArea(idFront.metadata.rawSvg, idFrontCanvas, {
    box: trim.box,
    format: ID1,
    keepBleed: true,
  })

  // 252 x 162 points is 3.5 x 2.25 in; the trim inside it is exactly a CR80.
  assert.equal(applied.widthMm, 88.9)
  assert.equal(applied.heightMm, 57.15)
  // 1/16 inch of bleed on every side.
  assert.deepEqual(applied.bleedMm, { top: 1.5875, right: 1.5875, bottom: 1.5875, left: 1.5875 })
  assert.match(applied.svg, /viewBox="0 0 252 162"/, 'coordinates must not move')
})

check('recognises the trim line as a printer\'s mark, not artwork', () => {
  const trim = idFront.metadata.trimCandidates[0]
  // fill:none with a stroke — an outline, so it is safe to drop.
  assert.equal(trim.outlineOnly, true)
})

check('takes the trim line out once it has set the scale', () => {
  const trim = idFront.metadata.trimCandidates[0]
  const before = (idFront.metadata.rawSvg.match(/<rect[^>]*width="243"[^>]*>/g) || []).length
  assert.equal(before, 1, 'the artwork starts with the trim rectangle in it')

  const applied = applyCardArea(idFront.metadata.rawSvg, idFrontCanvas, {
    box: trim.box,
    format: ID1,
    keepBleed: true,
    removeTrimLine: true,
  })
  assert.equal(applied.trimLineRemoved, true)
  assert.equal((applied.svg.match(/<rect[^>]*width="243"[^>]*>/g) || []).length, 0)
  // Removing it must not disturb the size it was used to work out.
  assert.equal(applied.widthMm, 88.9)
  assert.equal(applied.heightMm, 57.15)
})

check('leaves the trim line alone unless asked', () => {
  const trim = idFront.metadata.trimCandidates[0]
  const applied = applyCardArea(idFront.metadata.rawSvg, idFrontCanvas, {
    box: trim.box,
    format: ID1,
    keepBleed: true,
  })
  assert.equal(applied.trimLineRemoved, false)
  assert.equal((applied.svg.match(/<rect[^>]*width="243"[^>]*>/g) || []).length, 1)
})

check('never removes a filled rectangle', () => {
  // A filled rectangle at the same geometry is a panel, not a printer's mark.
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 252 162">',
    '  <rect x="4.5" y="4.5" width="243" height="153" fill="#f0f0f0"/>',
    '</svg>',
  ].join('\n')
  const applied = applyCardArea(
    svg,
    { x: 0, y: 0, width: 252, height: 162 },
    { box: { x: 4.5, y: 4.5, width: 243, height: 153 }, format: ID1, keepBleed: true, removeTrimLine: true },
  )
  assert.equal(applied.trimLineRemoved, false, 'a filled rectangle is part of the design')
  assert.match(applied.svg, /width="243"/)
})

check('cropping to the trim line gives the card size exactly', () => {
  const trim = idFront.metadata.trimCandidates[0]
  const applied = applyCardArea(idFront.metadata.rawSvg, idFrontCanvas, {
    box: trim.box,
    format: ID1,
    keepBleed: false,
  })
  assert.equal(applied.widthMm, ID1.widthMm)
  assert.equal(applied.heightMm, ID1.heightMm)
  assert.match(applied.svg, /viewBox="4.5 4.5 243 153"/)
  assert.equal(applied.bleedMm, undefined)
})

check('the corrected template imports at its real size', async () => {
  const trim = idFront.metadata.trimCandidates[0]
  const applied = applyCardArea(idFront.metadata.rawSvg, idFrontCanvas, {
    box: trim.box,
    format: ID1,
    keepBleed: true,
  })
  const reparsed = await parseTemplateString(applied.svg, 'id-card-front.svg')
  assert.equal(reparsed.metadata.unit, 'mm')
  assert.equal(reparsed.metadata.width, 88.9)
  // Reading the file's units as CSS pixels gave 66.68 mm, a third too small.
  const guessed = idFront.metadata.width / 3.779527559055
  assert.ok(Math.abs(guessed - 66.68) < 0.05, `guessed size was ${guessed}`)
})

// --- print placement --------------------------------------------------------

section('print placement')

const POINTS_PER_INCH = 72
const MM_PER_INCH = 25.4
const PX_PER_MM = 3.779527559055

const printLayouts = JSON.parse(
  fs.readFileSync(path.resolve(HERE, '../../backend/data/print-layouts.json'), 'utf8'),
)
const canonTray = printLayouts.find((layout) => layout.id === 'layout-canon-j')

/** The exporter's own size conversion, mirrored so the test can predict it. */
function templateSizeInPoints(template) {
  const widthMm = template.unit === 'mm' ? template.width : template.width / PX_PER_MM
  const heightMm = template.unit === 'mm' ? template.height : template.height / PX_PER_MM
  return [(widthMm / MM_PER_INCH) * POINTS_PER_INCH, (heightMm / MM_PER_INCH) * POINTS_PER_INCH]
}

/** Where the trim line ends up, in inches, once the card is placed in a slot. */
function placedTrimInches(template, slot) {
  const [artworkW, artworkH] = templateSizeInPoints(template)
  const fractionX = template.cardArea ? template.cardArea.trimBox.width / template.viewBox.width : 243 / 252
  const fractionY = template.cardArea ? template.cardArea.trimBox.height / template.viewBox.height : 153 / 162
  const scale = getSlotScale(template, artworkW, artworkH, slot)
  return [
    (artworkW * fractionX * scale) / POINTS_PER_INCH,
    (artworkH * fractionY * scale) / POINTS_PER_INCH,
  ]
}

check('a tray slot reserves the card rectangle and the bleed separately', () => {
  const [slot] = calculateCardPositions(canonTray, 2)
  assert.ok(Math.abs(slot.trimWidth / POINTS_PER_INCH - 3.375) < 1e-9, 'the card is 3.375 in')
  assert.ok(Math.abs(slot.trimHeight / POINTS_PER_INCH - 2.125) < 1e-9, 'the card is 2.125 in')
  // The slot is the card plus the layout's bleed allowance.
  assert.ok(Math.abs(slot.width / POINTS_PER_INCH - 3.45) < 1e-9)
  assert.ok(Math.abs(slot.height / POINTS_PER_INCH - 2.2) < 1e-9)
})

check('artwork with bleed prints undersized until a card area is set', () => {
  const [slot] = calculateCardPositions(canonTray, 2)
  const [width, height] = placedTrimInches(idFront.metadata, slot)
  // Fitting the whole artwork to the slot puts the trim line 2.2% short.
  assert.ok(width < 3.375 * 0.99, `trim printed at ${width.toFixed(4)} in, expected well under 3.375`)
  assert.ok(Math.abs(width / 3.375 - height / 2.125) < 0.001, 'both axes are off by the same amount')
})

check('artwork with no card area is fitted to the whole slot', () => {
  const [slot] = calculateCardPositions(canonTray, 2)
  const [artworkW, artworkH] = templateSizeInPoints(idFront.metadata)
  const scale = getSlotScale({ ...idFront.metadata, cardArea: undefined }, artworkW, artworkH, slot)
  const fitted = Math.min(slot.width / artworkW, slot.height / artworkH)
  assert.ok(Math.abs(scale - fitted) < 1e-12, `scale was ${scale}, expected the fit-to-slot ${fitted}`)
})

check('a card area lands the trim line exactly on the tray slot', async () => {
  const trim = idFront.metadata.trimCandidates[0]
  const applied = applyCardArea(idFront.metadata.rawSvg, idFrontCanvas, {
    box: trim.box,
    format: ID1,
    keepBleed: true,
  })
  const reparsed = await parseTemplateString(applied.svg, 'id-card-front.svg')
  reparsed.metadata.cardArea = {
    formatId: 'id-1',
    keepBleed: true,
    bleedMm: applied.bleedMm,
    trimBox: applied.trimBox,
    trimWidthMm: applied.trimWidthMm,
    trimHeightMm: applied.trimHeightMm,
  }

  const [slot] = calculateCardPositions(canonTray, 2)
  const [width, height] = placedTrimInches(reparsed.metadata, slot)
  assert.ok(Math.abs(width - 3.375) < 0.0005, `trim printed at ${width.toFixed(4)} in`)
  assert.ok(Math.abs(height - 2.125) < 0.0005, `trim printed at ${height.toFixed(4)} in`)
})

check('every tray layout in the seed agrees on the card size', () => {
  const sizes = new Set(printLayouts.map((layout) => `${layout.cardWidth}x${layout.cardHeight}`))
  assert.deepEqual([...sizes], ['3.3750x2.1250'], 'all layouts target a CR80 card')
})

// --- result -----------------------------------------------------------------

await Promise.all(pending)

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
