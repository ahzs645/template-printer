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
const { normalizeStandardFieldName } = await import('../src/lib/standardFields.ts')

// --- helpers ---------------------------------------------------------------

let failures = 0
let passes = 0

function check(name, body) {
  try {
    body()
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

// --- result -----------------------------------------------------------------

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
