/**
 * Tests for the ?url= link pipeline.
 *
 *   pnpm test:package-url
 *
 * Covers which URLs are accepted, the fetch limits, and the record that stops a
 * repeat visit importing the same design twice.
 */

import assert from 'node:assert/strict'
import { register } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

register('./ts-resolver.mjs', import.meta.url)

const HERE = path.dirname(fileURLToPath(import.meta.url))
void HERE

// A minimal stand-in for the browser bits the module touches.
globalThis.window = { location: { href: 'https://example.com/template-printer/' } }
const store = new Map()
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
}

const {
  MAX_PACKAGE_BYTES,
  describePackageSource,
  fetchPackage,
  forgetOpenedPackage,
  readPackageUrl,
  recallOpenedPackage,
  rememberOpenedPackage,
} = await import('../src/lib/packageUrl.ts')

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

section('reading the link')

await check('accepts an https package url', () => {
  const url = readPackageUrl('?url=https%3A%2F%2Fexample.com%2Fbuilds%2Fcard.zip')
  assert.equal(url, 'https://example.com/builds/card.zip')
})

await check('accepts a relative url against the page', () => {
  assert.equal(readPackageUrl('?url=builds%2Fcard.zip'), 'https://example.com/template-printer/builds/card.zip')
})

await check('ignores a link with no package', () => {
  assert.equal(readPackageUrl(''), null)
  assert.equal(readPackageUrl('?other=1'), null)
  assert.equal(readPackageUrl('?url='), null)
})

await check('refuses a scheme that could smuggle content past the fetch', () => {
  assert.equal(readPackageUrl('?url=javascript%3Aalert(1)'), null)
  assert.equal(readPackageUrl('?url=data%3Aapplication%2Fzip%3Bbase64%2CUEsDBA'), null)
  assert.equal(readPackageUrl('?url=file%3A%2F%2F%2Fetc%2Fpasswd'), null)
})

await check('names the host for the person following the link', () => {
  assert.equal(describePackageSource('https://projects.ahmadjalil.com/builds/card.zip'), 'projects.ahmadjalil.com')
})

section('fetching')

const originalFetch = globalThis.fetch

await check('refuses a package past the size limit', async () => {
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: (name) => (name === 'content-length' ? String(MAX_PACKAGE_BYTES + 1) : null) },
    arrayBuffer: async () => new ArrayBuffer(0),
  })
  await assert.rejects(() => fetchPackage('https://example.com/big.zip'), /larger than/i)
})

await check('says so when the host refuses', async () => {
  globalThis.fetch = async () => ({
    ok: false,
    status: 404,
    statusText: 'Not Found',
    headers: { get: () => null },
    arrayBuffer: async () => new ArrayBuffer(0),
  })
  await assert.rejects(() => fetchPackage('https://example.com/missing.zip'), /404/)
})

await check('explains a cross-origin failure, which fetch does not', async () => {
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch')
  }
  await assert.rejects(() => fetchPackage('https://elsewhere.test/card.zip'), /cross-origin/i)
})

await check('hashes the bytes so the same package is recognised', async () => {
  const bytes = new Uint8Array([1, 2, 3, 4])
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => null },
    arrayBuffer: async () => bytes.buffer,
  })
  const first = await fetchPackage('https://example.com/card.zip')
  const second = await fetchPackage('https://example.com/copy.zip')
  assert.equal(first.hash.length, 64, 'SHA-256 hex')
  assert.equal(first.hash, second.hash, 'the same bytes hash the same whatever the url')
})

globalThis.fetch = originalFetch

section('a returning visitor')

await check('remembers a design already opened here', () => {
  const record = {
    hash: 'abc123',
    frontTemplateId: 'tpl-front',
    backTemplateId: 'tpl-back',
    designId: 'design-1',
    name: 'id-card',
    openedAt: new Date().toISOString(),
  }
  assert.equal(recallOpenedPackage('abc123'), null, 'nothing is remembered to begin with')
  rememberOpenedPackage(record)
  assert.deepEqual(recallOpenedPackage('abc123'), record)
})

await check('forgets one that has been removed', () => {
  forgetOpenedPackage('abc123')
  assert.equal(recallOpenedPackage('abc123'), null)
})

await check('survives storage being unavailable', () => {
  const saved = globalThis.localStorage
  globalThis.localStorage = {
    getItem() {
      throw new Error('blocked')
    },
    setItem() {
      throw new Error('blocked')
    },
    removeItem() {},
  }
  // Private browsing blocks storage; the link must still open, just without
  // recognising a repeat.
  assert.equal(recallOpenedPackage('xyz'), null)
  assert.doesNotThrow(() => rememberOpenedPackage({ hash: 'xyz', frontTemplateId: 't', name: 'n', openedAt: '' }))
  globalThis.localStorage = saved
})

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
