/**
 * Runs inside a browser page that has the artboard SVG loaded as its document.
 * Kept free of imports so it can be handed to page.evaluate() as-is.
 *
 * Splits an Illustrator "presentation" artboard — many cards laid out side by
 * side, often with drop shadows and clipping groups — into one SVG per card.
 *
 * Elements are assigned to a card by where they are drawn, not by which layer
 * they sit in: a mockup's layers rarely follow card boundaries.
 */
// eslint-disable-next-line no-unused-vars
function splitArtboard(options) {
  const SVG_NS = 'http://www.w3.org/2000/svg'
  const XLINK_NS = 'http://www.w3.org/1999/xlink'
  const svg = document.documentElement
  const vb = svg.viewBox.baseVal
  svg.setAttribute('width', vb.width)
  svg.setAttribute('height', vb.height)
  const origin = svg.getBoundingClientRect()

  const box = (el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x - origin.x + vb.x, y: r.y - origin.y + vb.y, width: r.width, height: r.height }
  }
  const area = (b) => Math.max(0, b.width) * Math.max(0, b.height)
  const intersect = (a, b) => {
    const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y)
    const r = Math.min(a.x + a.width, b.x + b.width), t = Math.min(a.y + a.height, b.y + b.height)
    return { x, y, width: r - x, height: t - y }
  }

  // --- find the cards: the rounded rectangle each mockup card is drawn as.
  const LEAF = 'path,rect,circle,ellipse,line,polyline,polygon,text,image,use'
  const leaves = Array.from(svg.querySelectorAll(LEAF)).filter((el) => !el.closest('defs,clipPath,mask,symbol,pattern'))
  leaves.forEach((el, i) => el.setAttribute('data-split-k', String(i)))
  const boxes = leaves.map(box)

  let cards = options.cards
  if (!cards) {
    const found = []
    for (const el of leaves) {
      if (el.tagName !== 'rect' || Number(el.getAttribute('rx')) < (options.minCornerRadius ?? 20)) continue
      const b = box(el)
      const aspect = Math.max(b.width, b.height) / Math.min(b.width, b.height)
      if (Math.abs(aspect - (options.aspect ?? 1.6)) > 0.08 || Math.max(b.width, b.height) < 200) continue
      if (found.some((f) => Math.abs(f.x - b.x) < 3 && Math.abs(f.y - b.y) < 3)) continue
      found.push(b)
    }
    // A card's inner border is a smaller rounded rectangle of the same shape.
    const inside = (a, b) => a !== b && a.x >= b.x - 1 && a.y >= b.y - 1 && a.x + a.width <= b.x + b.width + 1 && a.y + a.height <= b.y + b.height + 1
    const outer = found.filter((a) => !found.some((b) => inside(a, b)))
    found.length = 0
    found.push(...outer)
    found.sort((a, b) => (Math.abs(a.y - b.y) > 50 ? a.y - b.y : a.x - b.x))
    cards = found.map((b, i) => ({ id: `card-${i + 1}`, rect: [b.x, b.y, b.width, b.height] }))
  }

  const serializer = new XMLSerializer()
  const results = []

  for (const card of cards) {
    const [cx, cy, cw, ch] = card.rect
    const cardBox = { x: cx, y: cy, width: cw, height: ch }
    const portrait = ch > cw
    // Trim to the card format's aspect, keeping the drawn width (landscape) or
    // height (portrait) and growing the other side: a mockup card is rarely
    // drawn at exactly 85.725 × 53.975, and growing keeps every bit of artwork.
    const fmtLong = options.formatWidthMm ?? 85.725, fmtShort = options.formatHeightMm ?? 53.975
    const trimW = portrait ? (cw) : cw
    const trimH = portrait ? cw * (fmtLong / fmtShort) : cw * (fmtShort / fmtLong)
    const trim = { x: cx + (cw - trimW) / 2, y: cy + (ch - trimH) / 2, width: trimW, height: trimH }
    const unitsPerMm = trim.width / (portrait ? fmtShort : fmtLong)
    const bleed = (options.bleedMm ?? 1.5875) * unitsPerMm
    const canvas = { x: trim.x - bleed, y: trim.y - bleed, width: trim.width + 2 * bleed, height: trim.height + 2 * bleed }

    const keep = new Set()
    leaves.forEach((el, i) => {
      const b = boxes[i]
      if (area(b) === 0 && el.tagName !== 'line') return
      const overlap = intersect(b, cardBox)
      const centreInside = b.x + b.width / 2 >= cx && b.x + b.width / 2 <= cx + cw && b.y + b.height / 2 >= cy && b.y + b.height / 2 <= cy + ch
      const mostlyInside = area(overlap) > 0.6 * Math.max(area(b), 1e-6)
      if (centreInside || mostlyInside) keep.add(String(i))
    })

    const clone = svg.cloneNode(true)
    clone.removeAttribute('width')
    clone.removeAttribute('height')
    for (const el of Array.from(clone.querySelectorAll('[data-split-k]'))) {
      if (!keep.has(el.getAttribute('data-split-k'))) el.remove()
    }

    results.push({ id: card.id, rect: card.rect, portrait, trim, canvas, unitsPerMm, markup: serializer.serializeToString(clone) })
  }

  leaves.forEach((el) => el.removeAttribute('data-split-k'))
  return results
}
