/**
 * Round-trip test for template share links.
 *
 *   pnpm test:share-link
 *
 * Compresses the reference templates into share links, reads them back, and
 * checks the URL shapes the app hands to users.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import { register } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

register('./ts-resolver.mjs', import.meta.url)

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REFERENCE_DIR = path.resolve(HERE, '../../docs/reference-templates')
const APP_URL = 'https://projects.ahmadjalil.com/template-printer/'

const {
  SHARE_PAYLOAD_VERSION,
  SHARE_URL_MAX_LENGTH,
  buildShareUrl,
  buildSharedTemplatePayload,
  createShareLinks,
  decodeSharedTemplate,
  readShareTarget,
} = await import('../src/lib/shareLink.ts')

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

const frontSvg = fs.readFileSync(path.join(REFERENCE_DIR, 'card-front.svg'), 'utf8')
const backSvg = fs.readFileSync(path.join(REFERENCE_DIR, 'card-back.svg'), 'utf8')

const payload = buildSharedTemplatePayload({
  name: 'card-front.svg',
  svg: frontSvg,
  fields: [
    {
      id: 'fullname_1',
      sourceId: 'fullName_First_LineBreak_Last',
      label: 'Parniya Peykamiyan',
      type: 'text',
      x: 10.22,
      y: 67.75,
      fontSize: 15,
      color: '#e3efcf',
      align: 'left',
      fontFamily: 'HelveticaNeue-Bold',
      fontWeight: 700,
      lineHeight: 15,
    },
  ],
  mappings: [
    { svgLayerId: 'fullName_First_LineBreak_Last', standardFieldName: 'fullName_First_LineBreak_Last' },
  ],
  cardData: { fullname_1: 'Parniya\nPeykamiyan', photo_1: { src: 'data:image/png;base64,AAAA' } },
})

section('payload')

await check('drops image values so links stay small', () => {
  assert.deepEqual(payload.sampleData, { fullname_1: 'Parniya\nPeykamiyan' })
})

await check('stamps the payload version', () => {
  assert.equal(payload.v, SHARE_PAYLOAD_VERSION)
})

section('round trip')

const links = await createShareLinks(payload, APP_URL)

await check('compresses the front card to a usable link', () => {
  assert.ok(links.length < SHARE_URL_MAX_LENGTH, `link is ${links.length} characters`)
  assert.ok(
    links.length < frontSvg.length,
    `link (${links.length}) should be smaller than the raw SVG (${frontSvg.length})`,
  )
  assert.equal(links.isTooLong, false)
})

await check('restores the template exactly', async () => {
  const target = readShareTarget(new URL(links.edit).hash)
  assert.ok(target, 'the edit link should parse as a share target')
  const restored = await decodeSharedTemplate(target.payload)
  assert.equal(restored.svg, frontSvg)
  assert.equal(restored.name, 'card-front.svg')
  assert.deepEqual(restored.mappings, payload.mappings)
  assert.deepEqual(restored.fields, payload.fields)
  assert.deepEqual(restored.sampleData, payload.sampleData)
})

await check('view and edit links carry the same payload', () => {
  const view = readShareTarget(new URL(links.view).hash)
  const edit = readShareTarget(new URL(links.edit).hash)
  assert.equal(view.mode, 'view')
  assert.equal(edit.mode, 'edit')
  assert.equal(view.payload, edit.payload)
})

await check('handles a large artwork-only template', async () => {
  const large = await createShareLinks(
    buildSharedTemplatePayload({ name: 'card-back.svg', svg: backSvg, fields: [], mappings: [] }),
    APP_URL,
  )
  const target = readShareTarget(new URL(large.view).hash)
  const restored = await decodeSharedTemplate(target.payload)
  assert.equal(restored.svg, backSvg)
  assert.ok(large.isLong, 'a 55 KB artwork should be flagged as a long link')
})

section('url handling')

await check('ignores unrelated fragments', () => {
  assert.equal(readShareTarget(''), null)
  assert.equal(readShareTarget('#'), null)
  assert.equal(readShareTarget('#/settings'), null)
  assert.equal(readShareTarget('#/share/'), null)
  assert.equal(readShareTarget('#/share/view/'), null)
  assert.equal(readShareTarget('#/share/sideways/abc'), null, 'unknown modes must not open')
})

await check('never nests one share link inside another', () => {
  const nested = buildShareUrl('PAYLOAD', 'view', links.edit)
  assert.equal(nested, `${APP_URL}#/share/view/PAYLOAD`)
})

await check('rejects a truncated payload', async () => {
  await assert.rejects(() => decodeSharedTemplate(links.payload.slice(0, 40)))
})

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
