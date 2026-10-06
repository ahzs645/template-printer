/**
 * Runs inside a browser page whose document is one card cut out of an artboard
 * by split-in-page.js. Turns the mockup into a print template:
 *
 * - drop shadows and other filters go (they are presentation, not print);
 * - the rounded card shape becomes a full-bleed background — the rounded
 *   corners are cut by the die, not printed;
 * - artwork that ran to the card's edge is carried on into the bleed;
 * - the canvas becomes the card plus bleed, sized in millimetres, and declares
 *   which rectangle is the card so the app prints it at the right size;
 * - definitions nothing uses any more are pruned, which is where most of the
 *   file size goes (each card would otherwise carry every embedded image).
 */
// eslint-disable-next-line no-unused-vars
function cleanupCard(info) {
  const svg = document.documentElement
  const { trim, canvas, rect } = info
  const card = { x: rect[0], y: rect[1], width: rect[2], height: rect[3] }
  const round = (n) => Math.round(n * 1000) / 1000

  // Measure in the artboard's coordinates: draw at viewBox scale with no offset.
  const vb = svg.viewBox.baseVal
  svg.setAttribute('width', vb.width)
  svg.setAttribute('height', vb.height)
  const origin = svg.getBoundingClientRect()
  const box = (el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x - origin.x + vb.x, y: r.y - origin.y + vb.y, width: r.width, height: r.height }
  }
  const near = (a, b, tolerance = 2) => Math.abs(a - b) <= tolerance
  const isCardShape = (b) => near(b.x, card.x) && near(b.y, card.y) && near(b.width, card.width) && near(b.height, card.height)

  svg.querySelectorAll('[data-split-k]').forEach((el) => el.removeAttribute('data-split-k'))

  // Filters: drop shadows only make sense on a mockup.
  svg.querySelectorAll('filter').forEach((el) => el.remove())
  svg.querySelectorAll('[filter]').forEach((el) => el.removeAttribute('filter'))
  svg.querySelectorAll('style').forEach((style) => {
    style.textContent = style.textContent.replace(/filter:\s*url\([^)]*\);?/g, '')
  })

  // Clip paths shaped like the card would cut the bleed off again.
  for (const clip of Array.from(svg.querySelectorAll('clipPath'))) {
    const shapes = Array.from(clip.children)
    if (shapes.length !== 1 || shapes[0].tagName !== 'rect') continue
    const r = shapes[0]
    const w = Number(r.getAttribute('width')), h = Number(r.getAttribute('height'))
    const rotated = /rotate\(\s*-?(?:90|270)\b/.test(r.getAttribute('transform') || '')
    const [bw, bh] = rotated ? [h, w] : [w, h]
    if (Number(r.getAttribute('rx')) >= 20 && near(bw, card.width, 3) && near(bh, card.height, 3)) {
      for (const [k, v] of Object.entries({ x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height })) r.setAttribute(k, round(v))
      ;['rx', 'ry', 'transform'].forEach((a) => r.removeAttribute(a))
    }
  }

  // The card shape: the first filled one becomes the background, the rest
  // (white strokes that fake rounded corners on the mockup) are removed.
  let background = null
  for (const el of Array.from(svg.querySelectorAll('rect'))) {
    if (el.closest('defs,clipPath,mask')) continue
    if (Number(el.getAttribute('rx')) < 20 || !isCardShape(box(el))) continue
    const style = getComputedStyle(el)
    const filled = style.fill !== 'none' && style.fill !== 'transparent'
    if (filled && !background) {
      background = el
      for (const [k, v] of Object.entries({ x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height })) el.setAttribute(k, round(v))
      ;['rx', 'ry', 'transform'].forEach((a) => el.removeAttribute(a))
      el.setAttribute('data-name', 'card background')
    } else {
      el.remove()
    }
  }

  // Bands and panels that ran to the card's edge carry on into the bleed.
  for (const el of Array.from(svg.querySelectorAll('rect'))) {
    if (el === background || el.closest('defs,clipPath,mask') || el.getAttribute('transform')) continue
    if (el.getAttribute('rx')) continue
    const b = box(el)
    let x = Number(el.getAttribute('x') || 0), y = Number(el.getAttribute('y') || 0)
    let w = Number(el.getAttribute('width')), h = Number(el.getAttribute('height'))
    if (!(w > 0 && h > 0)) continue
    const tol = 3
    const touchesLeft = b.x <= card.x + tol, touchesRight = b.x + b.width >= card.x + card.width - tol
    const touchesTop = b.y <= card.y + tol, touchesBottom = b.y + b.height >= card.y + card.height - tol
    // Only things that span most of an edge: a band, not a logo near a corner.
    const spansWidth = b.width >= card.width * 0.5, spansHeight = b.height >= card.height * 0.5
    // A full-width band touches both sides; a full-height bar touches top and bottom.
    const acrossX = touchesLeft && touchesRight, acrossY = touchesTop && touchesBottom
    if (touchesLeft && (spansHeight || acrossX)) { w += x - canvas.x; x = canvas.x }
    if (touchesRight && (spansHeight || acrossX)) { w = canvas.x + canvas.width - x }
    if (touchesTop && (spansWidth || acrossY)) { h += y - canvas.y; y = canvas.y }
    if (touchesBottom && (spansWidth || acrossY)) { h = canvas.y + canvas.height - y }
    el.setAttribute('x', round(x)); el.setAttribute('y', round(y))
    el.setAttribute('width', round(w)); el.setAttribute('height', round(h))
  }

  // Empty groups left behind by the split.
  let removed = true
  while (removed) {
    removed = false
    for (const g of Array.from(svg.querySelectorAll('g'))) {
      if (g.children.length === 0) { g.remove(); removed = true }
    }
  }

  const declaresCard = (root) => {
    root.setAttribute('viewBox', [canvas.x, canvas.y, canvas.width, canvas.height].map(round).join(' '))
    root.setAttribute('width', `${round(canvas.width / info.unitsPerMm)}mm`)
    root.setAttribute('height', `${round(canvas.height / info.unitsPerMm)}mm`)
    root.setAttribute('data-card-format', 'id-1')
    root.setAttribute('data-trim-box', [trim.x, trim.y, trim.width, trim.height].map(round).join(' '))
  }
  declaresCard(svg)
  return true
}

/** Remove definitions nothing refers to, repeatedly, since defs refer to defs. */
// eslint-disable-next-line no-unused-vars
function pruneDefinitions() {
  const svg = document.documentElement
  const XLINK = 'http://www.w3.org/1999/xlink'
  let changed = true
  while (changed) {
    changed = false
    const referenced = new Set()
    const scan = (text) => {
      for (const m of text.matchAll(/url\(\s*['"]?#([^'")\s]+)/g)) referenced.add(m[1])
    }
    for (const el of Array.from(svg.querySelectorAll('*'))) {
      for (const attr of Array.from(el.attributes)) {
        if (attr.name === 'href' || attr.name === 'xlink:href' || attr.namespaceURI === XLINK) {
          if (attr.value.startsWith('#')) referenced.add(attr.value.slice(1))
        } else scan(attr.value)
      }
    }
    // Styles only count where some element still uses the class.
    for (const style of Array.from(svg.querySelectorAll('style'))) {
      for (const rule of style.textContent.split('}')) {
        const [selectors, body] = rule.split('{')
        if (!body) continue
        const used = selectors.split(',').some((s) => {
          const m = s.trim().match(/^\.([\w-]+)$/)
          return !m || svg.getElementsByClassName(m[1]).length > 0
        })
        if (used) scan(body)
      }
    }
    for (const def of Array.from(svg.querySelectorAll('defs > [id], clipPath[id], mask[id], symbol[id], image[id], linearGradient[id], radialGradient[id], pattern[id]'))) {
      if (def.closest('style')) continue
      const inDefs = def.parentElement?.tagName === 'defs' || ['clipPath', 'mask', 'symbol', 'linearGradient', 'radialGradient', 'pattern'].includes(def.tagName)
      if (!inDefs) continue
      if (!referenced.has(def.id)) { def.remove(); changed = true }
    }
  }
  // Drop CSS rules for classes nothing uses.
  for (const style of Array.from(svg.querySelectorAll('style'))) {
    const kept = []
    for (const rule of style.textContent.split('}')) {
      const [selectors, body] = rule.split('{')
      if (!body) continue
      const live = selectors.split(',').map((s) => s.trim()).filter((s) => {
        const m = s.match(/^\.([\w-]+)$/)
        return !m || svg.getElementsByClassName(m[1]).length > 0
      })
      if (live.length) kept.push(`      ${live.join(', ')} {${body.replace(/\s+/g, ' ').trimEnd()} }`)
    }
    style.textContent = `\n${kept.join('\n\n')}\n    `
  }
  return true
}
