/**
 * A hanging-badge simulation, for seeing how a card actually reads on a lanyard.
 *
 * Adapted from React Bits' Lanyard (https://reactbits.dev/components/lanyard),
 * which drives a GLB through Rapier. This version keeps the idea and drops both
 * dependencies: the rope is a short verlet chain, and the card is the template's
 * own artwork rasterised to a texture, with the punch cut out of the alpha so
 * you can see through the hole.
 *
 * The card hangs from the punch, not from its top edge, so moving the punch to
 * an end genuinely tips the card over — which is the thing worth simulating.
 */

import type * as THREE_NS from 'three'

import { getPunchRect, type PunchPosition, type PunchShape } from './cardBlanks'

type THREE = typeof THREE_NS

export type LanyardOptions = {
  /** Rendered front artwork. */
  frontSvg: string
  /** Rendered back artwork; the front is reused when absent. */
  backSvg?: string | null
  widthMm: number
  heightMm: number
  punch: PunchPosition
  punchShape: PunchShape
  strapColor: string
  strapText: string
  /** Higher swings faster and settles harder. */
  gravity: number
  strapWidth: number
}

export type LanyardHandle = {
  update(options: Partial<LanyardOptions>): void
  /** Re-hang the card from the start position. */
  drop(): void
  dispose(): void
}

/** The longest side of the card, in world units. */
const CARD_LONG_SIDE = 1.9
const SEGMENT = 0.55
const CHAIN_LENGTH = 5
const SUBSTEP = 1 / 120
const TEXTURE_LONG_EDGE = 1024
/** Card corner radius, ISO/IEC 7810: 3.18 mm. */
const CORNER_RADIUS_MM = 3.18

type Node = { x: number; y: number; px: number; py: number; pinned: boolean }

function rasterise(svg: string, widthPx: number, heightPx: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = widthPx
    canvas.height = heightPx
    const context = canvas.getContext('2d')
    if (!context) {
      reject(new Error('Could not get a 2D context'))
      return
    }

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      context.drawImage(image, 0, 0, widthPx, heightPx)
      URL.revokeObjectURL(url)
      resolve(canvas)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not rasterise the card artwork'))
    }
    image.src = url
  })
}

/**
 * Round the corners and cut the punch out of the alpha channel, so the card
 * silhouette is real geometry rather than a rectangle with a drawn-on hole.
 */
function cutCardShape(
  canvas: HTMLCanvasElement,
  options: Pick<LanyardOptions, 'widthMm' | 'heightMm' | 'punch' | 'punchShape'>,
): void {
  const context = canvas.getContext('2d')
  if (!context) return

  const scale = canvas.width / options.widthMm
  const radius = CORNER_RADIUS_MM * scale

  // Everything outside the rounded rectangle becomes transparent.
  context.globalCompositeOperation = 'destination-in'
  context.beginPath()
  context.roundRect(0, 0, canvas.width, canvas.height, radius)
  context.fill()

  const punchRect = getPunchRect({
    punch: options.punch,
    punchShape: options.punchShape,
    widthMm: options.widthMm,
    heightMm: options.heightMm,
  })

  if (punchRect) {
    context.globalCompositeOperation = 'destination-out'
    context.beginPath()
    const x = punchRect.x * scale
    const y = punchRect.y * scale
    const w = punchRect.width * scale
    const h = punchRect.height * scale
    if (options.punchShape === 'round') {
      context.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
    } else {
      context.roundRect(x, y, w, h, Math.min(w, h) / 2)
    }
    context.fill()
  }

  context.globalCompositeOperation = 'source-over'
}

function makeStrapCanvas(color: string, text: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (!context) return canvas
  context.fillStyle = color
  context.fillRect(0, 0, canvas.width, canvas.height)
  if (text.trim()) {
    context.fillStyle = 'rgba(255,255,255,0.92)'
    context.font = "700 54px 'Helvetica Neue', Helvetica, Arial, sans-serif"
    context.textBaseline = 'middle'
    context.fillText(text, 24, 66)
    context.fillText(text, 536, 66)
  }
  return canvas
}

/**
 * Where the card hangs from, and how far its centre sits from that point, in
 * card-local units (origin at the card's centre, +y up).
 */
function getHangGeometry(options: LanyardOptions, cardW: number, cardH: number) {
  const punchRect = getPunchRect({
    punch: options.punch,
    punchShape: options.punchShape,
    widthMm: options.widthMm,
    heightMm: options.heightMm,
  })

  if (!punchRect) {
    // No punch: hang from the middle of the top edge, as a clip would.
    return { offsetX: 0, offsetY: cardH / 2, distance: cardH / 2 }
  }

  const scaleX = cardW / options.widthMm
  const scaleY = cardH / options.heightMm
  const centreX = (punchRect.x + punchRect.width / 2) * scaleX - cardW / 2
  // SVG y runs down, the scene's runs up.
  const centreY = cardH / 2 - (punchRect.y + punchRect.height / 2) * scaleY

  return {
    offsetX: centreX,
    offsetY: centreY,
    distance: Math.hypot(centreX, centreY) || cardH / 2,
  }
}

/**
 * Build the scene into a canvas and start it running.
 */
export async function createLanyardScene(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  initial: LanyardOptions,
): Promise<LanyardHandle> {
  const THREE = (await import('three')) as THREE

  let options = { ...initial }

  const aspect = options.widthMm / options.heightMm
  let cardW = aspect >= 1 ? CARD_LONG_SIDE : CARD_LONG_SIDE * aspect
  let cardH = aspect >= 1 ? CARD_LONG_SIDE / aspect : CARD_LONG_SIDE

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
  camera.position.set(0, 0.4, 9.5)
  camera.lookAt(0, 0.4, 0)

  scene.add(new THREE.AmbientLight(0xffffff, 1.1))
  const key = new THREE.DirectionalLight(0xffffff, 1.3)
  key.position.set(2, 4, 5)
  scene.add(key)

  const cardMaterial = {
    front: new THREE.MeshStandardMaterial({ transparent: true, alphaTest: 0.35, roughness: 0.75, metalness: 0.05, side: THREE.FrontSide }),
    back: new THREE.MeshStandardMaterial({ transparent: true, alphaTest: 0.35, roughness: 0.75, metalness: 0.05, side: THREE.FrontSide }),
  }

  const cardGroup = new THREE.Group()
  let plane = new THREE.PlaneGeometry(cardW, cardH)
  const frontMesh = new THREE.Mesh(plane, cardMaterial.front)
  frontMesh.position.z = 0.008
  const backMesh = new THREE.Mesh(plane, cardMaterial.back)
  backMesh.rotation.y = Math.PI
  backMesh.position.z = -0.008
  cardGroup.add(frontMesh, backMesh)
  scene.add(cardGroup)

  // The strap, rebuilt from the chain every frame.
  const RIBBON_POINTS = 48
  const ribbonGeometry = new THREE.BufferGeometry()
  ribbonGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RIBBON_POINTS * 2 * 3), 3))
  ribbonGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(RIBBON_POINTS * 2 * 2), 2))
  const indices: number[] = []
  for (let i = 0; i < RIBBON_POINTS - 1; i += 1) {
    const a = i * 2
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  ribbonGeometry.setIndex(indices)
  const strapMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, depthTest: false })
  const ribbon = new THREE.Mesh(ribbonGeometry, strapMaterial)
  ribbon.renderOrder = -1
  scene.add(ribbon)

  const curve = new THREE.CatmullRomCurve3(
    Array.from({ length: CHAIN_LENGTH }, () => new THREE.Vector3()),
    false,
    'chordal',
  )

  const anchor = new THREE.Vector3(0, 3.4, 0)
  let hang = getHangGeometry(options, cardW, cardH)
  let nodes: Node[] = []

  function resetChain() {
    nodes = []
    for (let i = 0; i < CHAIN_LENGTH + 1; i += 1) {
      // Start off to one side so the card swings in rather than appearing still.
      const x = anchor.x + Math.min(i, CHAIN_LENGTH - 1) * SEGMENT
      const y = i === CHAIN_LENGTH ? anchor.y - hang.distance : anchor.y
      nodes.push({ x, y, px: x, py: y, pinned: i === 0 })
    }
  }

  function step(dt: number) {
    for (const node of nodes) {
      if (node.pinned) continue
      const vx = (node.x - node.px) * 0.985
      const vy = (node.y - node.py) * 0.985
      node.px = node.x
      node.py = node.y
      node.x += vx
      node.y += vy - options.gravity * dt * dt
    }

    const constraints: Array<[number, number, number]> = []
    for (let i = 0; i < CHAIN_LENGTH - 1; i += 1) constraints.push([i, i + 1, SEGMENT])
    // The last link is the card itself: punch point to centre of mass.
    constraints.push([CHAIN_LENGTH - 1, CHAIN_LENGTH, hang.distance])

    for (let iteration = 0; iteration < 32; iteration += 1) {
      for (const [a, b, length] of constraints) {
        const na = nodes[a]
        const nb = nodes[b]
        const dx = nb.x - na.x
        const dy = nb.y - na.y
        const distance = Math.hypot(dx, dy) || 1e-6
        const difference = (distance - length) / distance
        const wa = na.pinned ? 0 : 0.5
        const wb = nb.pinned ? 0 : 0.5
        const total = wa + wb || 1
        na.x += dx * difference * (wa / total)
        na.y += dy * difference * (wa / total)
        nb.x -= dx * difference * (wb / total)
        nb.y -= dy * difference * (wb / total)
      }

      if (dragging) {
        nodes[CHAIN_LENGTH - 1].x = dragTarget.x
        nodes[CHAIN_LENGTH - 1].y = dragTarget.y
        nodes[CHAIN_LENGTH - 1].px = dragTarget.x
        nodes[CHAIN_LENGTH - 1].py = dragTarget.y
      }

      nodes[0].x = anchor.x
      nodes[0].y = anchor.y
    }
  }

  const tangent = new THREE.Vector3()
  const perpendicular = new THREE.Vector3()
  const Z = new THREE.Vector3(0, 0, 1)
  const Y = new THREE.Vector3(0, 1, 0)
  const hangVector = new THREE.Vector3()
  const yawQuaternion = new THREE.Quaternion()
  let yaw = 0

  function sync() {
    const attach = nodes[CHAIN_LENGTH - 1]
    const centre = nodes[CHAIN_LENGTH]

    // Orient the card so its punch-to-centre vector follows the chain.
    hangVector.set(centre.x - attach.x, centre.y - attach.y, 0).normalize()
    const rest = new THREE.Vector3(-hang.offsetX, -hang.offsetY, 0).normalize()
    cardGroup.quaternion.setFromUnitVectors(rest, hangVector)
    cardGroup.position.set(centre.x, centre.y, 0)

    // Sideways movement tilts the card, which reads as a swing in depth.
    const vx = attach.x - attach.px
    yaw += (Math.max(-0.6, Math.min(0.6, -vx * 10)) - yaw) * 0.1
    yawQuaternion.setFromAxisAngle(Y, yaw)
    cardGroup.quaternion.multiply(yawQuaternion)

    for (let i = 0; i < CHAIN_LENGTH; i += 1) curve.points[i].set(nodes[i].x, nodes[i].y, 0)
    const points = curve.getPoints(RIBBON_POINTS - 1)
    const position = ribbonGeometry.getAttribute('position') as THREE_NS.BufferAttribute
    const uv = ribbonGeometry.getAttribute('uv') as THREE_NS.BufferAttribute

    let total = 0
    const arcs = new Float32Array(RIBBON_POINTS)
    for (let i = 1; i < RIBBON_POINTS; i += 1) {
      total += points[i].distanceTo(points[i - 1])
      arcs[i] = total
    }
    const restLength = (CHAIN_LENGTH - 1) * SEGMENT
    const tiles = restLength / (options.strapWidth * 8)
    const halfWidth = (options.strapWidth / 2) * Math.max(0.5, Math.min(1, Math.sqrt(restLength / (total || restLength))))

    for (let i = 0; i < RIBBON_POINTS; i += 1) {
      const point = points[i]
      tangent.copy(points[Math.min(i + 1, RIBBON_POINTS - 1)]).sub(points[Math.max(i - 1, 0)]).normalize()
      perpendicular.crossVectors(tangent, Z).normalize()
      position.setXYZ(i * 2, point.x + perpendicular.x * halfWidth, point.y + perpendicular.y * halfWidth, point.z)
      position.setXYZ(i * 2 + 1, point.x - perpendicular.x * halfWidth, point.y - perpendicular.y * halfWidth, point.z)
      const u = -(arcs[i] / (total || 1)) * tiles
      uv.setXY(i * 2, u, 1)
      uv.setXY(i * 2 + 1, u, 0)
    }
    position.needsUpdate = true
    uv.needsUpdate = true
    ribbonGeometry.computeBoundingSphere()
  }

  // --- textures -------------------------------------------------------------

  async function refreshCardTextures() {
    const longEdge = TEXTURE_LONG_EDGE
    const widthPx = options.widthMm >= options.heightMm ? longEdge : Math.round(longEdge * aspect)
    const heightPx = options.widthMm >= options.heightMm ? Math.round(longEdge / aspect) : longEdge

    const apply = async (svg: string, material: THREE_NS.MeshStandardMaterial) => {
      try {
        const rendered = await rasterise(svg, widthPx, heightPx)
        cutCardShape(rendered, options)
        const texture = new THREE.CanvasTexture(rendered)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = 8
        material.map?.dispose()
        material.map = texture
        material.needsUpdate = true
      } catch (error) {
        console.error('Could not build the card texture', error)
      }
    }

    await apply(options.frontSvg, cardMaterial.front)
    await apply(options.backSvg || options.frontSvg, cardMaterial.back)
  }

  function refreshStrapTexture() {
    const texture = new THREE.CanvasTexture(makeStrapCanvas(options.strapColor, options.strapText))
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    strapMaterial.map?.dispose()
    strapMaterial.map = texture
    strapMaterial.needsUpdate = true
  }

  // --- pointer --------------------------------------------------------------

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
  const planePoint = new THREE.Vector3()
  const grabOffset = new THREE.Vector3()
  const dragTarget = new THREE.Vector3()
  let dragging = false

  function toPointer(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }

  function onPointerDown(event: PointerEvent) {
    toPointer(event)
    raycaster.setFromCamera(pointer, camera)
    if (raycaster.intersectObject(cardGroup, true).length === 0) return
    raycaster.ray.intersectPlane(dragPlane, planePoint)
    const attach = nodes[CHAIN_LENGTH - 1]
    grabOffset.set(attach.x - planePoint.x, attach.y - planePoint.y, 0)
    dragTarget.set(attach.x, attach.y, 0)
    dragging = true
    canvas.setPointerCapture(event.pointerId)
    canvas.style.cursor = 'grabbing'
  }

  function onPointerMove(event: PointerEvent) {
    toPointer(event)
    raycaster.setFromCamera(pointer, camera)
    if (dragging) {
      raycaster.ray.intersectPlane(dragPlane, planePoint)
      dragTarget.set(planePoint.x + grabOffset.x, planePoint.y + grabOffset.y, 0)
      return
    }
    canvas.style.cursor = raycaster.intersectObject(cardGroup, true).length > 0 ? 'grab' : ''
  }

  function onPointerUp(event: PointerEvent) {
    dragging = false
    try {
      canvas.releasePointerCapture(event.pointerId)
    } catch {
      // The pointer may already be gone.
    }
    canvas.style.cursor = ''
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)

  // --- loop -----------------------------------------------------------------

  function resize() {
    const width = container.clientWidth
    const height = container.clientHeight
    if (!width || !height) return
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)

  let frame = 0
  let last = performance.now()
  let accumulator = 0
  let running = true

  function loop(now: number) {
    if (!running) return
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    accumulator += dt
    while (accumulator > SUBSTEP) {
      step(SUBSTEP)
      accumulator -= SUBSTEP
    }
    sync()
    renderer.render(scene, camera)
    frame = requestAnimationFrame(loop)
  }

  resetChain()
  resize()
  refreshStrapTexture()
  await refreshCardTextures()
  frame = requestAnimationFrame(loop)

  return {
    update(next) {
      const previous = options
      options = { ...options, ...next }

      const geometryChanged =
        next.widthMm !== undefined ||
        next.heightMm !== undefined ||
        next.punch !== undefined ||
        next.punchShape !== undefined

      if (next.widthMm !== undefined || next.heightMm !== undefined) {
        const nextAspect = options.widthMm / options.heightMm
        cardW = nextAspect >= 1 ? CARD_LONG_SIDE : CARD_LONG_SIDE * nextAspect
        cardH = nextAspect >= 1 ? CARD_LONG_SIDE / nextAspect : CARD_LONG_SIDE
        plane.dispose()
        plane = new THREE.PlaneGeometry(cardW, cardH)
        frontMesh.geometry = plane
        backMesh.geometry = plane
      }

      if (geometryChanged) {
        hang = getHangGeometry(options, cardW, cardH)
        resetChain()
      }

      if (next.strapColor !== undefined || next.strapText !== undefined) refreshStrapTexture()

      if (
        next.frontSvg !== undefined ||
        next.backSvg !== undefined ||
        geometryChanged ||
        previous.frontSvg !== options.frontSvg
      ) {
        void refreshCardTextures()
      }
    },
    drop() {
      resetChain()
    },
    dispose() {
      running = false
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      cardMaterial.front.map?.dispose()
      cardMaterial.back.map?.dispose()
      strapMaterial.map?.dispose()
      plane.dispose()
      ribbonGeometry.dispose()
      renderer.dispose()
    },
  }
}
