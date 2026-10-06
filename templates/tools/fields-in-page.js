/**
 * Runs inside a browser page whose document is a cleaned card template.
 * Turns the placeholders a designer drew into layers the app understands.
 *
 * Positions in a recipe are millimetres from the card's top-left trim corner,
 * which is how describeCardElements() reports them, so a recipe can be written
 * by reading that listing.
 */

function cardGeometry() {
  const svg = document.documentElement
  const vb = svg.viewBox.baseVal
  svg.setAttribute('width', vb.width)
  svg.setAttribute('height', vb.height)
  const origin = svg.getBoundingClientRect()
  const trim = svg.getAttribute('data-trim-box').split(/\s+/).map(Number)
  const portrait = trim[3] > trim[2]
  const unitsPerMm = trim[2] / (portrait ? 53.975 : 85.725)
  /** Artboard units of an element's drawn box. */
  const units = (el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x - origin.x + vb.x, y: r.y - origin.y + vb.y, width: r.width, height: r.height }
  }
  /** The same box in millimetres from the trim corner. */
  const mm = (b) => ({
    x: (b.x - trim[0]) / unitsPerMm,
    y: (b.y - trim[1]) / unitsPerMm,
    width: b.width / unitsPerMm,
    height: b.height / unitsPerMm,
  })
  const toUnits = (m) => ({
    x: trim[0] + m.x * unitsPerMm,
    y: trim[1] + m.y * unitsPerMm,
    width: m.width * unitsPerMm,
    height: m.height * unitsPerMm,
  })
  return { svg, units, mm, toUnits, unitsPerMm, trim }
}

const LEAF_SELECTOR = 'path,rect,circle,ellipse,line,polyline,polygon,text,image,use'
const r2 = (n) => Math.round(n * 100) / 100
const r3 = (n) => Math.round(n * 1000) / 1000
const normalise = (s) => s.replace(/\s+/g, ' ').trim()

// eslint-disable-next-line no-unused-vars
function describeCardElements() {
  const { svg, units, mm } = cardGeometry()
  return Array.from(svg.querySelectorAll(LEAF_SELECTOR))
    .filter((el) => !el.closest('defs,clipPath,mask,symbol,text') || el.tagName === 'text')
    .filter((el) => !el.closest('defs,clipPath,mask,symbol'))
    .map((el) => {
      const b = mm(units(el))
      const style = getComputedStyle(el)
      return {
        tag: el.tagName,
        id: el.id || undefined,
        cls: el.getAttribute('class') || undefined,
        box: [r2(b.x), r2(b.y), r2(b.width), r2(b.height)],
        fill: style.fill,
        stroke: style.stroke !== 'none' ? `${style.stroke} ${style.strokeWidth}` : undefined,
        text: el.tagName === 'text' ? normalise(el.textContent) : undefined,
        font: el.tagName === 'text' ? `${style.fontFamily} ${style.fontWeight} ${style.fontSize}` : undefined,
      }
    })
}

/** Elements whose drawn box matches `box` (mm) within `tolerance` mm. */
function findByBox(geometry, box, tolerance = 1, tags = LEAF_SELECTOR) {
  const { svg, units, mm } = geometry
  const [x, y, w, h] = box
  return Array.from(svg.querySelectorAll(tags))
    .filter((el) => !el.closest('defs,clipPath,mask,symbol'))
    .filter((el) => {
      const b = mm(units(el))
      return Math.abs(b.x - x) <= tolerance && Math.abs(b.y - y) <= tolerance &&
        Math.abs(b.width - w) <= tolerance && Math.abs(b.height - h) <= tolerance
    })
}

/** Elements drawn entirely inside `box` (mm). */
function findInside(geometry, box, tags = LEAF_SELECTOR) {
  const { svg, units, mm } = geometry
  const [x, y, w, h] = box
  return Array.from(svg.querySelectorAll(tags))
    .filter((el) => !el.closest('defs,clipPath,mask,symbol'))
    .filter((el) => {
      const b = mm(units(el))
      return b.x >= x - 0.05 && b.y >= y - 0.05 && b.x + b.width <= x + w + 0.05 && b.y + b.height <= y + h + 0.05
    })
}

function svgEl(name, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', name)
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) el.setAttribute(k, String(v))
  return el
}

/**
 * Apply a recipe:
 *
 *   texts:    [{ match: 'WOLVES, TIMBER J.', id: 'fullName_…', text?: 'new sample' }]
 *             The first text reading `match` gets the layer id; copies of it
 *             drawn in the same place (mockups often stack two) are removed.
 *   photo:    { box: [x, y, w, h], tolerance?, rx? } — the frame drawn where the
 *             photo goes. A photo slot is put underneath it and the frame is kept.
 *             `circle: true` makes a round photo.
 *   punch:    { box, id: 'punch_slot_top_center' } — a hole drawn as ink becomes
 *             a punch guide, which is never printed.
 *   remove:   [{ box, tolerance? } | { inside: box }] — sample content to drop,
 *             such as a real person's photo.
 *   addTexts: [{ id, text, x, y, font, size, weight, fill, anchor, lines? }]
 *             new live text, for names a mockup had converted to outlines.
 *   staticText: true — every other text is fixed artwork, not a field.
 */
// eslint-disable-next-line no-unused-vars
function applyCardRecipe(recipe) {
  // Measuring draws the card at its viewBox size; its physical size goes back
  // on afterwards, or the template would lose its millimetres.
  const root = document.documentElement
  const physical = { width: root.getAttribute('width'), height: root.getAttribute('height') }
  try {
    return applyRecipeSteps(recipe)
  } finally {
    root.setAttribute('width', physical.width)
    root.setAttribute('height', physical.height)
  }
}

function applyRecipeSteps(recipe) {
  const geometry = cardGeometry()
  const { svg, units, toUnits, unitsPerMm } = geometry
  const report = []

  for (const rule of recipe.remove ?? []) {
    const doomed = rule.inside ? findInside(geometry, rule.inside, rule.tags) : findByBox(geometry, rule.box, rule.tolerance ?? 1, rule.tags)
    if (!doomed.length) report.push(`remove: nothing at ${JSON.stringify(rule)}`)
    doomed.forEach((el) => el.remove())
  }

  for (const rule of recipe.texts ?? []) {
    const matches = Array.from(svg.querySelectorAll('text')).filter((t) => normalise(t.textContent) === rule.match)
    if (!matches.length) {
      report.push(`text: "${rule.match}" not found`)
      continue
    }
    const [first, ...rest] = matches
    const fb = units(first)
    for (const other of rest) {
      const ob = units(other)
      if (Math.abs(ob.x - fb.x) < 2 && Math.abs(ob.y - fb.y) < 2) other.remove()
      else report.push(`text: another "${rule.match}" elsewhere, left as artwork`)
    }
    first.setAttribute('id', rule.id)
    first.removeAttribute('data-name')
    for (const [name, value] of Object.entries(rule.attributes ?? {})) {
      first.setAttribute(name, value)
      first.querySelectorAll('tspan').forEach((span) => span.removeAttribute('class'))
    }
    if (rule.text !== undefined) {
      const spans = first.querySelectorAll('tspan')
      if (spans.length) {
        spans.forEach((s, i) => { if (i > 0) s.remove() })
        spans[0].textContent = rule.text
      } else first.textContent = rule.text
    }
  }

  // A label and its value set as one line of text ("VALID: 202X-202X") are
  // split so the label stays artwork and only the value becomes a field.
  for (const rule of recipe.splits ?? []) {
    const text = Array.from(svg.querySelectorAll('text')).find((t) => normalise(t.textContent) === rule.match)
    if (!text) {
      if (!rule.optional) report.push(`split: "${rule.match}" not found`)
      continue
    }
    const spans = Array.from(text.querySelectorAll('tspan')).filter((span) => !span.querySelector('tspan'))
    const host = spans.find((span) => span.textContent.includes(rule.value))
    if (!host) {
      report.push(`split: "${rule.value}" is not inside one tspan of "${rule.match}"`)
      continue
    }
    const index = host.textContent.indexOf(rule.value)
    const x = Number(host.getAttribute('x') || 0) + (index > 0 ? host.getSubStringLength(0, index) : 0)
    const y = Number(host.getAttribute('y') || 0)
    const classes = [text.getAttribute('class'), host.getAttribute('class'), host.parentElement !== text ? host.parentElement.getAttribute('class') : null]
      .filter(Boolean).join(' ')
    // The offset goes into the transform, so the value's position does not
    // depend on a tspan that is replaced when the field is filled in.
    const transform = [text.getAttribute('transform'), `translate(${r3(x)} ${r3(y)})`].filter(Boolean).join(' ')
    const value = svgEl('text', { id: rule.id, class: classes || undefined, transform })
    value.appendChild(svgEl('tspan', { x: 0, y: 0 })).textContent = rule.sample ?? rule.value
    text.parentNode.insertBefore(value, text.nextSibling)
    host.textContent = host.textContent.slice(0, index).replace(/\s+$/, ' ')
    if (!host.textContent.trim()) host.remove()
    text.setAttribute('data-static', 'true')
  }

  if (recipe.photo?.clipOf) {
    // The mockup shows a sample photo cut to shape by a clip path: the slot
    // takes that shape, and the sample goes.
    const [sample] = findByBox(geometry, recipe.photo.clipOf, recipe.photo.tolerance ?? 1, 'image,use')
    let clipped = sample
    while (clipped && clipped !== svg && getComputedStyle(clipped).clipPath === 'none') clipped = clipped.parentElement
    if (!sample) report.push('photo: no sample photo found')
    else if (!clipped || clipped === svg) {
      // Not clipped: the photo is shown whole, so the slot is its own box.
      const b = units(sample)
      const group = svgEl('g', { id: 'photo' })
      group.appendChild(svgEl('rect', { x: r3(b.x), y: r3(b.y), width: r3(b.width), height: r3(b.height), fill: recipe.photo.fill ?? '#ffffff' }))
      sample.parentNode.insertBefore(group, sample)
      sample.remove()
    } else {
      const id = /#([^")]+)/.exec(getComputedStyle(clipped).clipPath)[1]
      const shape = document.getElementById(id).firstElementChild
      const local = shape.getBBox()
      const own = shape.transform.baseVal.consolidate()?.matrix ?? svg.createSVGMatrix()
      const m = svg.getScreenCTM().inverse().multiply(clipped.getScreenCTM()).multiply(own)
      const corners = [[local.x, local.y], [local.x + local.width, local.y], [local.x, local.y + local.height], [local.x + local.width, local.y + local.height]]
        .map(([x, y]) => { const p = svg.createSVGPoint(); p.x = x; p.y = y; return p.matrixTransform(m) })
      // The root's inverse screen matrix lands these in the artboard's own units.
      const xs = corners.map((p) => p.x), ys = corners.map((p) => p.y)
      const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys)
      const round = recipe.photo.circle || shape.tagName === 'circle' || shape.tagName === 'ellipse'
      const radius = round ? r3(Math.min(w, h) / 2) : recipe.photo.rx
      const group = svgEl('g', { id: 'photo' })
      group.appendChild(svgEl('rect', { x: r3(x), y: r3(y), width: r3(w), height: r3(h), rx: radius, ry: radius, fill: recipe.photo.fill ?? '#ffffff' }))
      clipped.parentNode.insertBefore(group, clipped)
      clipped.remove()
    }
  } else if (recipe.photo) {
    const frames = findByBox(geometry, recipe.photo.box, recipe.photo.tolerance ?? 1, recipe.photo.tags ?? 'rect,path,circle,ellipse,image')
    const frame = frames[frames.length - 1]
    if (!frame) report.push('photo: no frame found')
    else {
      const style = getComputedStyle(frame)
      const stroke = style.stroke !== 'none' ? parseFloat(style.strokeWidth) || 0 : 0
      const b = units(frame)
      const inset = (recipe.photo.insetMm ?? 0) * unitsPerMm + stroke / 2
      const round = recipe.photo.circle
      const group = svgEl('g', { id: 'photo' })
      const w = b.width - inset * 2, h = b.height - inset * 2
      const radius = round ? r3(Math.min(w, h) / 2) : recipe.photo.rx
      group.appendChild(svgEl('rect', {
        x: r3(b.x + inset), y: r3(b.y + inset), width: r3(w), height: r3(h),
        rx: radius, ry: radius,
        fill: recipe.photo.fill ?? '#ffffff',
      }))
      frame.parentNode.insertBefore(group, frame)
      if (recipe.photo.replace) {
        // The placeholder was a solid box (or a sample photo): the slot replaces it.
        frame.remove()
      } else if (stroke > 0 && style.fill !== 'none') {
        // A stroked frame stays on top as the photo's border, without its fill.
        frame.setAttribute('style', `${frame.getAttribute('style') || ''};fill:none`)
      }
      // A filled frame with no stroke is an outline drawn as a ring: it already
      // has a hole where the photo shows through, so it stays as it is.
    }
  }

  if (recipe.punch) {
    const holes = findByBox(geometry, recipe.punch.box, recipe.punch.tolerance ?? 1)
    if (!holes.length) report.push('punch: nothing found')
    for (const hole of holes) {
      const b = units(hole)
      const group = svgEl('g', { id: recipe.punch.id ?? 'punch_slot_top_center', fill: 'none', stroke: '#ff2d55', 'stroke-width': r3(0.2 * unitsPerMm), 'stroke-dasharray': `${r3(0.8 * unitsPerMm)} ${r3(0.6 * unitsPerMm)}` })
      const radius = Math.min(b.width, b.height) / 2
      group.appendChild(svgEl('rect', { x: r3(b.x), y: r3(b.y), width: r3(b.width), height: r3(b.height), rx: r3(radius), ry: r3(radius) }))
      hole.parentNode.insertBefore(group, hole)
      hole.remove()
    }
  }

  for (const add of recipe.addTexts ?? []) {
    const at = toUnits({ x: add.x, y: add.y, width: 0, height: 0 })
    const size = add.size * unitsPerMm
    const text = svgEl('text', {
      id: add.id,
      x: r3(at.x), y: r3(at.y),
      'font-family': add.font, 'font-size': r3(size), 'font-weight': add.weight, fill: add.fill,
      'text-anchor': add.anchor,
    })
    const lines = add.lines ?? [add.text]
    lines.forEach((line, i) => {
      text.appendChild(svgEl('tspan', { x: r3(at.x), y: r3(at.y + i * (add.lineHeight ?? 1.15) * size) })).textContent = line
    })
    const anchor = add.after ? svg.querySelector(add.after) : null
    ;(anchor?.parentNode ?? svg).appendChild(text)
  }

  if (recipe.staticText) {
    for (const t of Array.from(svg.querySelectorAll('text'))) {
      if (t.closest('defs')) continue
      if (!t.id || /^text-field|^Layer/i.test(t.id)) t.setAttribute('data-static', 'true')
    }
  }

  if (recipe.punchDeclared) {
    svg.setAttribute('data-punch', recipe.punchDeclared)
  }

  return report
}
