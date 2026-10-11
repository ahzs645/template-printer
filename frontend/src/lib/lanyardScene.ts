/**
 * A hanging-badge simulation, for seeing how a card actually reads on a lanyard.
 *
 * Modelled on React Bits' Lanyard (https://reactbits.dev/components/lanyard):
 * the strap drops in from above the frame, the card is a glossy slab you can
 * grab, throw and spin, and it turns back to face you once it settles. That
 * component drives a GLB through Rapier; this one keeps the feel without either
 * dependency or a fixed card model:
 *
 * - The card is the template itself — its own size, orientation, corner radius
 *   and punch — extruded to the 0.76 mm of a real PVC card, with the hole cut
 *   through the geometry so the hardware visibly passes through it.
 * - The physics is position-based. The strap is a chain of particles held by
 *   maximum-distance constraints (a rope can slacken but not stretch, which is
 *   what Rapier's rope joint does), and the card is a rigid tetrahedron of four
 *   particles around its centre of mass, which gives it a true 3D orientation
 *   to swing, twist and tumble with. The strap is pinned to the card at the
 *   point where the hardware meets it.
 *
 * The card hangs from the punch, not from its top edge, so moving the punch to
 * an end genuinely tips the card over — which is the thing worth simulating.
 */

import type * as THREE_NS from 'three'

import { getPunchRect, type PunchPosition, type PunchShape } from './cardBlanks'
import { buildHardware, resolveAttachment, type Hardware, type LanyardAttachment } from './lanyardHardware'

type THREE = typeof THREE_NS
type Vec3 = THREE_NS.Vector3

/** How the card is meant to hang. 'auto' takes it from the artwork's shape. */
export type LanyardOrientation = 'auto' | 'portrait' | 'landscape'

export type LanyardOptions = {
  /** Rendered front artwork. */
  frontSvg: string
  /** Rendered back artwork; the front is reused when absent. */
  backSvg?: string | null
  /** Size of the whole artwork in millimetres, bleed included. */
  artworkWidthMm: number
  artworkHeightMm: number
  /** The card itself. Anything smaller than the artwork is bleed and is cut off. */
  widthMm: number
  heightMm: number
  /** Where the card starts inside the artwork, in millimetres. */
  cardOriginXMm: number
  cardOriginYMm: number
  /**
   * Hang the card as drawn, or turned a quarter: a portrait badge whose
   * artwork was laid out sideways, or the other way round. The punch is placed
   * on the card as it hangs.
   */
  orientation?: LanyardOrientation
  punch: PunchPosition
  punchShape: PunchShape
  strapColor: string
  strapText: string
  /** What joins the strap to the card; 'auto' picks one to suit the punch. */
  attachment?: LanyardAttachment
  /** Follow the punch from close up, to see the hardware go through it. */
  closeUp?: boolean
  /** Higher swings faster and settles harder. */
  gravity: number
  /** How quickly the swing dies away, per second. */
  damping?: number
  /** Strap width in world units (the card's long side is 2.25). */
  strapWidth: number
}

export type LanyardHandle = {
  update(options: Partial<LanyardOptions>): void
  /** Re-hang the card from the start position. */
  drop(): void
  /** Turn the card round, to see the other side; it settles facing that way. */
  flip(): void
  dispose(): void
}

/** The longest side of the card, in world units — the same as React Bits' card. */
const CARD_LONG_SIDE = 2.25
/** ISO/IEC 7810 ID-1 thickness. */
const CARD_THICKNESS_MM = 0.76
/** ISO/IEC 7810 corner radius. */
const CORNER_RADIUS_MM = 3.18
const ROPE_NODES = 9
const SUBSTEP = 1 / 120
const ITERATIONS = 14
const TEXTURE_LONG_EDGE = 1536
const FOV = 20
/** The strap is fixed just above the top of the frame, so it drops in from off-screen. */
const ANCHOR_Y = 4.2
/** Where the card's centre comes to rest. */
const REST_Y = -0.75
/** How hard the card turns back to face the camera, rad/s² per radian off. */
const FACE_SPRING = 14

/** The four corners of the rigid tetrahedron that stands in for the card's mass. */
const TETRA = [
  [1, 1, 1],
  [1, -1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
] as const

type Particle = { p: Vec3; prev: Vec3; w: number }

/** The card as it hangs, in millimetres: turned a quarter if asked. */
type HangGeometry = {
  widthMm: number
  heightMm: number
  artworkWidthMm: number
  artworkHeightMm: number
  originXMm: number
  originYMm: number
  /** The artwork is drawn turned a quarter clockwise onto the card. */
  turned: boolean
}

export function naturalOrientation(widthMm: number, heightMm: number): Exclude<LanyardOrientation, 'auto'> {
  return heightMm > widthMm ? 'portrait' : 'landscape'
}

function hangGeometry(options: LanyardOptions): HangGeometry {
  const natural = naturalOrientation(options.widthMm, options.heightMm)
  const wanted = !options.orientation || options.orientation === 'auto' ? natural : options.orientation
  if (wanted === natural || options.widthMm === options.heightMm) {
    return {
      widthMm: options.widthMm,
      heightMm: options.heightMm,
      artworkWidthMm: options.artworkWidthMm,
      artworkHeightMm: options.artworkHeightMm,
      originXMm: options.cardOriginXMm,
      originYMm: options.cardOriginYMm,
      turned: false,
    }
  }
  // A quarter turn clockwise takes (x, y) in a W × H artwork to (H − y, x).
  return {
    widthMm: options.heightMm,
    heightMm: options.widthMm,
    artworkWidthMm: options.artworkHeightMm,
    artworkHeightMm: options.artworkWidthMm,
    originXMm: options.artworkHeightMm - options.cardOriginYMm - options.heightMm,
    originYMm: options.cardOriginXMm,
    turned: true,
  }
}

function rasterise(svg: string, widthPx: number, heightPx: number, turned: boolean): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = turned ? heightPx : widthPx
    canvas.height = turned ? widthPx : heightPx
    const context = canvas.getContext('2d')
    if (!context) {
      reject(new Error('Could not get a 2D context'))
      return
    }

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      // PVC is white under the ink, which matters for artwork with no background.
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      if (turned) {
        context.translate(canvas.width, 0)
        context.rotate(Math.PI / 2)
      }
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

function makeStrapCanvas(color: string, text: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (!context) return canvas
  context.fillStyle = color
  context.fillRect(0, 0, canvas.width, canvas.height)
  // Woven edges, as on a printed polyester strap.
  context.fillStyle = 'rgba(0,0,0,0.18)'
  context.fillRect(0, 0, canvas.width, 7)
  context.fillRect(0, canvas.height - 7, canvas.width, 7)
  if (text.trim()) {
    context.fillStyle = 'rgba(255,255,255,0.94)'
    context.font = "700 58px 'Helvetica Neue', Helvetica, Arial, sans-serif"
    context.textBaseline = 'middle'
    const label = text.trim()
    const spacing = Math.max(context.measureText(label).width + 80, 256)
    for (let x = 32; x < canvas.width; x += spacing) context.fillText(label, x, 68)
  }
  return canvas
}

/**
 * Studio lighting in the manner of drei's <Lightformer>s: long bright strips on
 * black, so the clearcoat and the metal pick up crisp streaks as they turn.
 */
function buildStudio(THREE: THREE) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0b0b0e)
  const disposables: Array<{ dispose(): void }> = []
  const strip = (intensity: number, position: [number, number, number], rotation: [number, number, number], scale: [number, number]) => {
    const geometry = new THREE.PlaneGeometry(1, 1)
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity), side: THREE.DoubleSide })
    disposables.push(geometry, material)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(...position)
    mesh.rotation.set(...rotation)
    mesh.scale.set(scale[0], scale[1], 1)
    scene.add(mesh)
  }
  strip(2, [0, -1, 5], [0, 0, Math.PI / 3], [100, 0.1])
  strip(3, [-1, -1, 1], [0, 0, Math.PI / 3], [100, 0.1])
  strip(3, [1, 1, 1], [0, 0, Math.PI / 3], [100, 0.1])
  strip(10, [-10, 0, 14], [0, Math.PI / 2, Math.PI / 3], [100, 10])
  strip(1.5, [8, 6, 6], [0, 0, 0], [6, 30])
  return {
    scene,
    dispose() {
      for (const item of disposables) item.dispose()
    },
  }
}

/** A capsule or circle traced as a hole path, centred on (x, y). */
function holePath(THREE: THREE, x: number, y: number, w: number, h: number, round: boolean) {
  const path = new THREE.Path()
  if (round) {
    path.absarc(x, y, Math.min(w, h) / 2, 0, Math.PI * 2, true)
    return path
  }
  const r = Math.min(w, h) / 2
  const left = x - w / 2
  const right = x + w / 2
  const bottom = y - h / 2
  const top = y + h / 2
  path.moveTo(left + r, bottom)
  path.lineTo(right - r, bottom)
  path.absarc(right - r, y, r, -Math.PI / 2, Math.PI / 2, false)
  path.lineTo(left + r, top)
  path.absarc(left + r, y, r, Math.PI / 2, (Math.PI * 3) / 2, false)
  return path
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

  let options: LanyardOptions = { damping: 2.6, orientation: 'auto', ...initial }

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200)

  // Physically based lights: an ambient of π returns a diffuse surface's own
  // colour, so the artwork reads true and the studio adds only the gloss.
  scene.add(new THREE.AmbientLight(0xffffff, Math.PI * 0.82))
  const key = new THREE.DirectionalLight(0xffffff, 0.9)
  key.position.set(3, 5, 6)
  scene.add(key)

  const pmrem = new THREE.PMREMGenerator(renderer)
  const studio = buildStudio(THREE)
  const environment = pmrem.fromScene(studio.scene, 0.04).texture
  studio.dispose()
  scene.environment = environment

  const faceMaterial = () =>
    new THREE.MeshPhysicalMaterial({
      roughness: 0.55,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      envMapIntensity: 0.9,
    })
  const frontMaterial = faceMaterial()
  const backMaterial = faceMaterial()
  const edgeMaterial = new THREE.MeshPhysicalMaterial({ color: 0xf3f3ef, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.2 })

  const cardGroup = new THREE.Group()
  scene.add(cardGroup)
  const frontMesh = new THREE.Mesh(new THREE.BufferGeometry(), frontMaterial)
  const backMesh = new THREE.Mesh(new THREE.BufferGeometry(), backMaterial)
  const edgeMesh = new THREE.Mesh(new THREE.BufferGeometry(), edgeMaterial)
  cardGroup.add(frontMesh, backMesh, edgeMesh)

  // --- the card's shape -----------------------------------------------------

  let geometry = hangGeometry(options)
  /** World units per millimetre. */
  let mm = CARD_LONG_SIDE / Math.max(geometry.widthMm, geometry.heightMm)
  /** Card-local position of the punch centre (or the top edge's middle), +y up. */
  const punchLocal = new THREE.Vector3()
  /** Card-local position of the point where the strap meets the hardware. */
  const attachLocal = new THREE.Vector3()
  /** Barycentric weights of the attach point over the tetrahedron. */
  const attachWeights = [0, 0, 0, 0]
  let tetraSize = 0.8
  let hardware: Hardware | null = null
  let ropeLength = 3
  let segment = ropeLength / (ROPE_NODES - 1)

  function punchRectMm() {
    return getPunchRect({ punch: options.punch, punchShape: options.punchShape, widthMm: geometry.widthMm, heightMm: geometry.heightMm })
  }

  function rebuildCardGeometry() {
    const w = geometry.widthMm * mm
    const h = geometry.heightMm * mm
    const radius = CORNER_RADIUS_MM * mm
    const shape = new THREE.Shape()
    shape.moveTo(-w / 2 + radius, -h / 2)
    shape.lineTo(w / 2 - radius, -h / 2)
    shape.absarc(w / 2 - radius, -h / 2 + radius, radius, -Math.PI / 2, 0, false)
    shape.lineTo(w / 2, h / 2 - radius)
    shape.absarc(w / 2 - radius, h / 2 - radius, radius, 0, Math.PI / 2, false)
    shape.lineTo(-w / 2 + radius, h / 2)
    shape.absarc(-w / 2 + radius, h / 2 - radius, radius, Math.PI / 2, Math.PI, false)
    shape.lineTo(-w / 2, -h / 2 + radius)
    shape.absarc(-w / 2 + radius, -h / 2 + radius, radius, Math.PI, (Math.PI * 3) / 2, false)

    const rect = punchRectMm()
    if (rect) {
      const x = (rect.x + rect.width / 2 - geometry.widthMm / 2) * mm
      const y = (geometry.heightMm / 2 - (rect.y + rect.height / 2)) * mm
      shape.holes.push(holePath(THREE, x, y, rect.width * mm, rect.height * mm, options.punchShape === 'round'))
      punchLocal.set(x, y, 0)
    } else {
      punchLocal.set(0, h / 2, 0)
    }

    const thickness = CARD_THICKNESS_MM * mm
    // Each face samples its own artwork across the card, bleed and all, so
    // the texture lines up with the trim however much bleed there is.
    const faceUv = (target: THREE_NS.BufferGeometry, mirrored: boolean) => {
      const position = target.getAttribute('position')
      const uv = target.getAttribute('uv')
      for (let i = 0; i < position.count; i += 1) {
        const xMm = position.getX(i) / mm
        const yMm = position.getY(i) / mm
        const ax = geometry.originXMm + geometry.widthMm / 2 + (mirrored ? -xMm : xMm)
        const ay = geometry.originYMm + geometry.heightMm / 2 - yMm
        uv.setXY(i, ax / geometry.artworkWidthMm, 1 - ay / geometry.artworkHeightMm)
      }
      uv.needsUpdate = true
    }

    const front = new THREE.ShapeGeometry(shape, 24)
    faceUv(front, false)
    front.translate(0, 0, thickness / 2)
    // The back is the same outline facing the other way. It is not rotated:
    // that would move an off-centre hole to the other side. Its artwork is
    // mirrored in the UVs instead, and its triangles wound to face -z.
    const back = new THREE.ShapeGeometry(shape, 24)
    faceUv(back, true)
    const index = back.getIndex()
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const second = index.getX(i + 1)
        index.setX(i + 1, index.getX(i + 2))
        index.setX(i + 2, second)
      }
    }
    const backNormals = back.getAttribute('normal')
    for (let i = 0; i < backNormals.count; i += 1) backNormals.setXYZ(i, 0, 0, -1)
    back.translate(0, 0, -thickness / 2)
    // The edge, and the walls of the hole: the caps sit just inside the faces.
    const edge = new THREE.ExtrudeGeometry(shape, { depth: thickness * 0.96, bevelEnabled: false, curveSegments: 24 })
    edge.translate(0, 0, -thickness * 0.48)

    frontMesh.geometry.dispose()
    backMesh.geometry.dispose()
    edgeMesh.geometry.dispose()
    frontMesh.geometry = front
    backMesh.geometry = back
    edgeMesh.geometry = edge
  }

  function rebuildHardware() {
    if (hardware) {
      cardGroup.remove(hardware.group)
      hardware.dispose()
      hardware = null
    }
    const rect = punchRectMm()
    const kind = resolveAttachment(options.attachment ?? 'auto', Boolean(rect), options.punchShape)
    // Hardware hangs along the line from the card's centre out through the punch.
    const up = punchLocal.clone()
    if (up.lengthSq() < 1e-9) up.set(0, 1, 0)
    up.normalize()
    const along = rect ? Math.abs(up.y) * rect.height + Math.abs(up.x) * rect.width : 0
    const across = rect ? Math.abs(up.y) * rect.width + Math.abs(up.x) * rect.height : 0
    hardware = buildHardware(THREE, kind, mm, { height: along, width: across || 12 }, environment)
    hardware.group.position.copy(punchLocal)
    hardware.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up)
    cardGroup.add(hardware.group)

    attachLocal.copy(punchLocal).addScaledVector(up, hardware.length)
    // Affine weights over a regular tetrahedron centred on the origin:
    // b_i = 1/4 + x·v_i / (4 s²).
    tetraSize = Math.max(geometry.widthMm, geometry.heightMm) * mm * 0.36
    for (let i = 0; i < 4; i += 1) {
      const [vx, vy, vz] = TETRA[i]
      const dot = (attachLocal.x * vx + attachLocal.y * vy + attachLocal.z * vz) * tetraSize
      attachWeights[i] = 0.25 + dot / (4 * tetraSize * tetraSize)
    }

    // The strap is as long as it needs to be to bring the card to rest in the
    // same place, however long the hardware or wherever the punch.
    ropeLength = Math.max(1.2, ANCHOR_Y - REST_Y - attachLocal.length())
    segment = ropeLength / (ROPE_NODES - 1)
  }

  function rebuildAll() {
    geometry = hangGeometry(options)
    mm = CARD_LONG_SIDE / Math.max(geometry.widthMm, geometry.heightMm)
    rebuildCardGeometry()
    rebuildHardware()
  }
  rebuildAll()

  // --- physics --------------------------------------------------------------

  const anchor = new THREE.Vector3(0, ANCHOR_Y, 0)
  const rope: Particle[] = []
  const body: Particle[] = []
  const ROPE_INVERSE_MASS = 30
  const BODY_INVERSE_MASS = 4
  for (let i = 0; i < ROPE_NODES; i += 1) rope.push({ p: new THREE.Vector3(), prev: new THREE.Vector3(), w: i === 0 ? 0 : ROPE_INVERSE_MASS })
  for (let i = 0; i < 4; i += 1) body.push({ p: new THREE.Vector3(), prev: new THREE.Vector3(), w: BODY_INVERSE_MASS })

  const centre = new THREE.Vector3()
  const axisX = new THREE.Vector3()
  const axisY = new THREE.Vector3()
  const axisZ = new THREE.Vector3()
  const basis = new THREE.Matrix4()
  const orientation = new THREE.Quaternion()
  const scratch = new THREE.Vector3()
  const scratch2 = new THREE.Vector3()
  let targetYaw = 0

  /** Place the rigid body at a position and orientation. */
  function placeBody(position: Vec3, rotation: THREE_NS.Quaternion) {
    for (let i = 0; i < 4; i += 1) {
      const [vx, vy, vz] = TETRA[i]
      body[i].p.set(vx, vy, vz).multiplyScalar(tetraSize).applyQuaternion(rotation).add(position)
      body[i].prev.copy(body[i].p)
    }
  }

  /** Read the body's pose back off its particles. */
  function readPose() {
    centre.set(0, 0, 0)
    for (const particle of body) centre.add(particle.p)
    centre.multiplyScalar(0.25)
    const [a, b, c, d] = body.map((particle) => particle.p)
    // With the corners at (±1, ±1, ±1), sums and differences give the axes.
    axisX.copy(a).add(b).sub(c).sub(d).normalize()
    axisY.copy(a).sub(b).add(c).sub(d)
    axisY.addScaledVector(axisX, -axisY.dot(axisX)).normalize()
    axisZ.crossVectors(axisX, axisY)
    basis.makeBasis(axisX, axisY, axisZ)
    orientation.setFromRotationMatrix(basis)
  }

  function attachWorld(target: Vec3) {
    target.set(0, 0, 0)
    for (let i = 0; i < 4; i += 1) target.addScaledVector(body[i].p, attachWeights[i])
    return target
  }

  function resetChain() {
    // Start with the strap held out to one side and let go, as React Bits does,
    // so the card swings in rather than appearing still.
    const direction = new THREE.Vector3(Math.cos(-0.5), Math.sin(-0.5), 0)
    for (let i = 0; i < ROPE_NODES; i += 1) {
      rope[i].p.copy(anchor).addScaledVector(direction, i * segment * 0.98)
      rope[i].prev.copy(rope[i].p)
    }
    const attach = rope[ROPE_NODES - 1].p
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetYaw + 0.6)
    const offset = attachLocal.clone().applyQuaternion(rotation)
    placeBody(attach.clone().sub(offset), rotation)
  }

  function solveDistance(a: Particle, b: Particle, length: number, ropeOnly: boolean) {
    const dx = b.p.x - a.p.x
    const dy = b.p.y - a.p.y
    const dz = b.p.z - a.p.z
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9
    if (ropeOnly && distance <= length) return
    const total = a.w + b.w
    if (total === 0) return
    const k = (distance - length) / distance / total
    a.p.x += dx * k * a.w
    a.p.y += dy * k * a.w
    a.p.z += dz * k * a.w
    b.p.x -= dx * k * b.w
    b.p.y -= dy * k * b.w
    b.p.z -= dz * k * b.w
  }

  const restEdges: Array<[number, number, number]> = []
  function rememberRestShape() {
    restEdges.length = 0
    for (let i = 0; i < 4; i += 1) {
      for (let j = i + 1; j < 4; j += 1) restEdges.push([i, j, body[i].p.distanceTo(body[j].p)])
    }
  }

  // --- dragging -------------------------------------------------------------

  let dragging = false
  const dragTarget = new THREE.Vector3()
  const grabOffset = new THREE.Vector3()

  function step(dt: number) {
    const damping = Math.max(0, 1 - (options.damping ?? 2.6) * dt)
    const drop = options.gravity * dt * dt

    for (const particle of rope) {
      if (particle.w === 0) continue
      scratch.copy(particle.p).sub(particle.prev).multiplyScalar(damping)
      particle.prev.copy(particle.p)
      particle.p.add(scratch)
      particle.p.y -= drop
    }

    if (dragging) {
      // Held, the card follows the pointer rigidly, as a kinematic body would;
      // the velocity it is moving at when let go is what throws it.
      readPose()
      scratch2.copy(dragTarget).sub(centre).multiplyScalar(0.35)
      for (const particle of body) {
        particle.prev.copy(particle.p)
        particle.p.add(scratch2)
      }
    } else {
      for (const particle of body) {
        scratch.copy(particle.p).sub(particle.prev).multiplyScalar(damping)
        particle.prev.copy(particle.p)
        particle.p.add(scratch)
        particle.p.y -= drop
      }
    }

    const attach = new THREE.Vector3()
    const last = rope[ROPE_NODES - 1]
    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      for (let i = 0; i < ROPE_NODES - 1; i += 1) solveDistance(rope[i], rope[i + 1], segment, true)

      // The strap's end is pinned to the hardware: a ball joint, solved
      // against the virtual point the four body particles carry between them.
      attachWorld(attach)
      const dx = attach.x - last.p.x
      const dy = attach.y - last.p.y
      const dz = attach.z - last.p.z
      let bodyWeight = 0
      if (!dragging) for (let i = 0; i < 4; i += 1) bodyWeight += attachWeights[i] * attachWeights[i] * body[i].w
      const total = last.w + bodyWeight
      if (total > 0) {
        const k = 1 / total
        last.p.x += dx * k * last.w
        last.p.y += dy * k * last.w
        last.p.z += dz * k * last.w
        if (!dragging) {
          for (let i = 0; i < 4; i += 1) {
            const share = k * attachWeights[i] * body[i].w
            body[i].p.x -= dx * share
            body[i].p.y -= dy * share
            body[i].p.z -= dz * share
          }
        }
      }

      if (!dragging) for (const [a, b, length] of restEdges) solveDistance(body[a], body[b], length, false)
      rope[0].p.copy(anchor)
    }

    if (!dragging) {
      // Turn back to face the camera, the way React Bits trims the card's spin:
      // a spring on the yaw, applied as a nudge to position so it shows up as
      // angular velocity and the damping above settles it.
      readPose()
      let yaw = Math.atan2(axisZ.x, axisZ.z) - targetYaw
      yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw))
      const angle = -FACE_SPRING * yaw * dt * dt
      if (Math.abs(angle) > 1e-7) {
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        for (const particle of body) {
          const x = particle.p.x - centre.x
          const z = particle.p.z - centre.z
          particle.p.x = centre.x + x * cos + z * sin
          particle.p.z = centre.z - x * sin + z * cos
        }
      }
    }
  }

  // --- drawing --------------------------------------------------------------

  const RIBBON_POINTS = 72
  const ribbonGeometry = new THREE.BufferGeometry()
  ribbonGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RIBBON_POINTS * 2 * 3), 3))
  ribbonGeometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(RIBBON_POINTS * 2 * 3), 3))
  ribbonGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(RIBBON_POINTS * 2 * 2), 2))
  const indices: number[] = []
  for (let i = 0; i < RIBBON_POINTS - 1; i += 1) {
    const a = i * 2
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  ribbonGeometry.setIndex(indices)
  const strapMaterial = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.92, metalness: 0, envMapIntensity: 0.12 })
  const ribbon = new THREE.Mesh(ribbonGeometry, strapMaterial)
  ribbon.frustumCulled = false
  scene.add(ribbon)

  const curvePoints = Array.from({ length: ROPE_NODES + 1 }, () => new THREE.Vector3())
  const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'centripetal')
  const tangent = new THREE.Vector3()
  const across = new THREE.Vector3()
  const facing = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const toCamera = new THREE.Vector3(0, 0, 1)

  const cameraBase = new THREE.Vector3()
  const lookBase = new THREE.Vector3()
  const cameraGoal = new THREE.Vector3()
  const lookGoal = new THREE.Vector3()
  const look = new THREE.Vector3()
  const focus = new THREE.Vector3()
  let firstFrame = true

  function frameCamera() {
    // Far enough back to fit the card across a narrow stage, and aimed so the
    // anchor sits just above the top of the frame.
    const halfTan = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    const distance = Math.max(20, 1.9 / (halfTan * camera.aspect))
    const lookY = ANCHOR_Y - 0.25 - distance * halfTan
    cameraBase.set(0, lookY, distance)
    lookBase.set(0, lookY, 0)
  }

  function sync() {
    readPose()
    cardGroup.position.copy(centre)
    cardGroup.quaternion.copy(orientation)
    cardGroup.updateMatrixWorld()

    const attach = attachWorld(scratch)
    if (options.closeUp) {
      // Frame the whole piece of hardware: halfway between the punch and
      // where the strap ends, from far enough back to fit it.
      focus.copy(punchLocal).applyMatrix4(cardGroup.matrixWorld).add(attach).multiplyScalar(0.5)
      const reach = hardware?.length ?? 0
      cameraGoal.set(focus.x + 0.2, focus.y - 0.12, focus.z + 2.6 + reach * 3.2)
      lookGoal.copy(focus)
    } else {
      cameraGoal.copy(cameraBase)
      lookGoal.copy(lookBase)
    }
    if (firstFrame) {
      camera.position.copy(cameraGoal)
      look.copy(lookGoal)
      firstFrame = false
    } else {
      camera.position.lerp(cameraGoal, 0.08)
      look.lerp(lookGoal, 0.08)
    }
    camera.lookAt(look)

    for (let i = 0; i < ROPE_NODES; i += 1) curvePoints[i].copy(rope[i].p)
    curvePoints[ROPE_NODES].copy(attach)
    // The last node and the attach point coincide once solved; keep the spline
    // from kinking on a near-zero span.
    curvePoints[ROPE_NODES - 1].lerpVectors(rope[ROPE_NODES - 2].p, attach, 0.5)
    const points = curve.getSpacedPoints(RIBBON_POINTS - 1)
    const position = ribbonGeometry.getAttribute('position') as THREE_NS.BufferAttribute
    const normals = ribbonGeometry.getAttribute('normal') as THREE_NS.BufferAttribute
    const uv = ribbonGeometry.getAttribute('uv') as THREE_NS.BufferAttribute

    let total = 0
    for (let i = 1; i < RIBBON_POINTS; i += 1) total += points[i].distanceTo(points[i - 1])
    const tiles = total / (options.strapWidth * 8)
    const halfWidth = options.strapWidth / 2
    // The strap lies flat to the viewer where it hangs, and turns to lie flat
    // to the card where it meets the hardware.
    const cardFacing = axisZ.dot(toCamera) >= 0 ? axisZ : scratch2.copy(axisZ).negate()

    let arc = 0
    for (let i = 0; i < RIBBON_POINTS; i += 1) {
      const point = points[i]
      if (i > 0) arc += point.distanceTo(points[i - 1])
      tangent.copy(points[Math.min(i + 1, RIBBON_POINTS - 1)]).sub(points[Math.max(i - 1, 0)]).normalize()
      const t = i / (RIBBON_POINTS - 1)
      const blend = THREE.MathUtils.smoothstep(t, 0.55, 1)
      facing.copy(toCamera).lerp(cardFacing, blend)
      across.crossVectors(tangent, facing)
      if (across.lengthSq() < 1e-8) across.set(1, 0, 0)
      across.normalize()
      normal.crossVectors(across, tangent).normalize()
      position.setXYZ(i * 2, point.x + across.x * halfWidth, point.y + across.y * halfWidth, point.z + across.z * halfWidth)
      position.setXYZ(i * 2 + 1, point.x - across.x * halfWidth, point.y - across.y * halfWidth, point.z - across.z * halfWidth)
      normals.setXYZ(i * 2, normal.x, normal.y, normal.z)
      normals.setXYZ(i * 2 + 1, normal.x, normal.y, normal.z)
      const u = -(arc / (total || 1)) * tiles
      uv.setXY(i * 2, u, 1)
      uv.setXY(i * 2 + 1, u, 0)
    }
    position.needsUpdate = true
    normals.needsUpdate = true
    uv.needsUpdate = true
  }

  // --- textures -------------------------------------------------------------

  let textureGeneration = 0
  async function refreshCardTextures() {
    const generation = ++textureGeneration
    // Rasterise the artwork as drawn; the quarter turn, if any, happens on the canvas.
    const aspect = options.artworkWidthMm / options.artworkHeightMm
    const widthPx = aspect >= 1 ? TEXTURE_LONG_EDGE : Math.round(TEXTURE_LONG_EDGE * aspect)
    const heightPx = aspect >= 1 ? Math.round(TEXTURE_LONG_EDGE / aspect) : TEXTURE_LONG_EDGE
    const anisotropy = renderer.capabilities.getMaxAnisotropy()

    const apply = async (svg: string, material: THREE_NS.MeshPhysicalMaterial) => {
      try {
        const rendered = await rasterise(svg, widthPx, heightPx, geometry.turned)
        if (generation !== textureGeneration) return
        const texture = new THREE.CanvasTexture(rendered)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = anisotropy
        material.map?.dispose()
        material.map = texture
        material.needsUpdate = true
      } catch (error) {
        console.error('Could not build the card texture', error)
      }
    }

    await Promise.all([apply(options.frontSvg, frontMaterial), apply(options.backSvg || options.frontSvg, backMaterial)])
  }

  function refreshStrapTexture() {
    const texture = new THREE.CanvasTexture(makeStrapCanvas(options.strapColor, options.strapText))
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
    strapMaterial.map?.dispose()
    strapMaterial.map = texture
    strapMaterial.needsUpdate = true
  }

  // --- pointer --------------------------------------------------------------

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const dragPlane = new THREE.Plane()
  const planePoint = new THREE.Vector3()
  const cameraDirection = new THREE.Vector3()

  function toPointer(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
  }

  function clampDrag() {
    // The strap cannot stretch, so the card cannot be pulled further from the
    // anchor than the strap reaches.
    const reach = attachWorld(scratch).sub(centre)
    const attachTarget = scratch2.copy(dragTarget).add(reach).sub(anchor)
    const limit = ropeLength * 0.995
    if (attachTarget.length() > limit) {
      attachTarget.setLength(limit)
      dragTarget.copy(anchor).add(attachTarget).sub(reach)
    }
  }

  function onPointerDown(event: PointerEvent) {
    toPointer(event)
    const hit = raycaster.intersectObject(cardGroup, true)[0]
    if (!hit) return
    readPose()
    camera.getWorldDirection(cameraDirection)
    dragPlane.setFromNormalAndCoplanarPoint(cameraDirection.negate(), hit.point)
    grabOffset.copy(centre).sub(hit.point)
    dragTarget.copy(centre)
    dragging = true
    canvas.setPointerCapture(event.pointerId)
    canvas.style.cursor = 'grabbing'
  }

  function onPointerMove(event: PointerEvent) {
    toPointer(event)
    if (dragging) {
      if (raycaster.ray.intersectPlane(dragPlane, planePoint)) {
        dragTarget.copy(planePoint).add(grabOffset)
        clampDrag()
      }
      return
    }
    canvas.style.cursor = raycaster.intersectObject(cardGroup, true).length > 0 ? 'grab' : ''
  }

  function onPointerUp(event: PointerEvent) {
    if (!dragging) return
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
    frameCamera()
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
    while (accumulator >= SUBSTEP) {
      step(SUBSTEP)
      accumulator -= SUBSTEP
    }
    sync()
    renderer.render(scene, camera)
    frame = requestAnimationFrame(loop)
  }

  function rehang() {
    resetChain()
    rememberRestShape()
  }

  rehang()
  resize()
  refreshStrapTexture()
  await refreshCardTextures()
  last = performance.now()
  frame = requestAnimationFrame(loop)

  return {
    update(next) {
      const previous = options
      options = { ...options, ...next }

      const shapeChanged =
        next.widthMm !== undefined ||
        next.heightMm !== undefined ||
        next.artworkWidthMm !== undefined ||
        next.artworkHeightMm !== undefined ||
        next.cardOriginXMm !== undefined ||
        next.cardOriginYMm !== undefined ||
        next.orientation !== undefined ||
        next.punch !== undefined ||
        next.punchShape !== undefined
      const turnedBefore = geometry.turned

      if (shapeChanged || next.attachment !== undefined) {
        if (shapeChanged) rebuildAll()
        else rebuildHardware()
        rehang()
      }

      if (next.strapColor !== undefined || next.strapText !== undefined) refreshStrapTexture()

      if (
        previous.frontSvg !== options.frontSvg ||
        previous.backSvg !== options.backSvg ||
        geometry.turned !== turnedBefore ||
        next.artworkWidthMm !== undefined ||
        next.artworkHeightMm !== undefined
      ) {
        void refreshCardTextures()
      }
    },
    drop() {
      rehang()
    },
    flip() {
      targetYaw = targetYaw === 0 ? Math.PI : 0
      // A flick, so it turns over with some life rather than drifting round.
      readPose()
      for (const particle of body) {
        const x = particle.p.x - centre.x
        const z = particle.p.z - centre.z
        const spin = 0.06
        particle.prev.x = particle.p.x - z * spin
        particle.prev.z = particle.p.z + x * spin
      }
    },
    dispose() {
      running = false
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      frontMaterial.map?.dispose()
      backMaterial.map?.dispose()
      frontMaterial.dispose()
      backMaterial.dispose()
      edgeMaterial.dispose()
      frontMesh.geometry.dispose()
      backMesh.geometry.dispose()
      edgeMesh.geometry.dispose()
      strapMaterial.map?.dispose()
      strapMaterial.dispose()
      hardware?.dispose()
      environment.dispose()
      pmrem.dispose()
      ribbonGeometry.dispose()
      renderer.dispose()
    },
  }
}
