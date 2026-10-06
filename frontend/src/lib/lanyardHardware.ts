/**
 * The metal (and vinyl) that joins a lanyard to a card, modelled at real size so
 * it visibly passes through the punch.
 *
 * Each piece is built in its own frame: the origin is the centre of the punch,
 * +y points up along the strap, and +z comes out of the front of the card,
 * whose plane is z = 0. The piece reports how far above the punch the strap
 * attaches, so the simulation can hang the card that much lower.
 *
 * Sizes are the common retail ones:
 *
 * - J-hook: nickel-plated steel, 1.75 in (44 mm) overall, a crimped ferrule
 *   holding the strap and a wire hook that goes through a slot punch.
 * - Swivel hook: about 38 mm long and 14 mm across, an eye for the strap, a
 *   swivel barrel, and a snap hook through the slot or hole.
 * - Strap clip: a clear vinyl strap about 70 mm long threaded through a slot
 *   and closed with a 7/16 in (11 mm) snap, with a metal clip on top.
 * - Split ring: a steel ring about 25 mm across through a round hole.
 * - Bulldog clip: grips the top edge of a card with no punch.
 */

import type * as THREE_NS from 'three'

import type { PunchShape } from './cardBlanks'

type THREE = typeof THREE_NS

export type LanyardAttachment = 'auto' | 'j-hook' | 'swivel' | 'strap' | 'ring' | 'clamp' | 'none'

export const LANYARD_ATTACHMENTS: LanyardAttachment[] = ['auto', 'j-hook', 'swivel', 'strap', 'ring', 'clamp', 'none']

export const LANYARD_ATTACHMENT_LABELS: Record<LanyardAttachment, string> = {
  auto: 'To suit the punch',
  'j-hook': 'J-hook',
  swivel: 'Swivel hook',
  strap: 'Strap clip (vinyl)',
  ring: 'Split ring',
  clamp: 'Bulldog clip (no punch)',
  none: 'Strap only',
}

/** What actually hangs the card, given what was asked for and how it is punched. */
export function resolveAttachment(
  requested: LanyardAttachment,
  punched: boolean,
  shape: PunchShape,
): Exclude<LanyardAttachment, 'auto'> {
  if (!punched) return requested === 'none' ? 'none' : 'clamp'
  if (requested === 'clamp') return shape === 'round' ? 'ring' : 'j-hook'
  // A vinyl strap is made to thread a slot; a round hole takes a ring or hook.
  if (requested === 'strap' && shape === 'round') return 'ring'
  if (requested !== 'auto') return requested
  return shape === 'round' ? 'ring' : 'j-hook'
}

export type Hardware = {
  group: THREE_NS.Group
  /** Distance from the punch centre up to where the strap attaches, world units. */
  length: number
  dispose(): void
}

/**
 * Build one attachment.
 *
 * `mm` converts millimetres to world units. `hole` is the punch's height in
 * millimetres (in the direction the card hangs from it); the wire rests on the
 * top edge of the hole, as it would with the card's weight on it.
 */
export function buildHardware(
  THREE: THREE,
  kind: Exclude<LanyardAttachment, 'auto'>,
  mm: number,
  hole: { height: number; width: number },
  envMap: THREE_NS.Texture | null,
): Hardware {
  const group = new THREE.Group()
  const disposables: Array<{ dispose(): void }> = []
  const steel = new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: 0.95, roughness: 0.28, envMap, envMapIntensity: 1.1 })
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, metalness: 0.9, roughness: 0.4, envMap })
  disposables.push(steel, darkSteel)

  const v = (x: number, y: number, z: number) => new THREE.Vector3(x * mm, y * mm, z * mm)
  const add = (geometry: THREE_NS.BufferGeometry, material: THREE_NS.Material, place?: (mesh: THREE_NS.Mesh) => void) => {
    disposables.push(geometry)
    const mesh = new THREE.Mesh(geometry, material)
    place?.(mesh)
    group.add(mesh)
    return mesh
  }
  const wire = (points: THREE_NS.Vector3[], radius: number, material = steel, closed = false) =>
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed, 'catmullrom', 0.5), 96, radius * mm, 12, closed), material)

  // Where a wire of radius r touches the top edge of the hole.
  const bearing = (r: number) => Math.max(0, hole.height / 2 - r)

  let length = 0

  switch (kind) {
    case 'j-hook': {
      const r = 0.8
      const y = bearing(r)
      // Down the front, through the slot, and up behind the card to the tip.
      wire(
        [v(0, 27, 0.6), v(0, 16, 2.4), v(0, 6, 2.6), v(0, y + 1.6, 1.9), v(0, y, 0), v(0, y + 1.6, -1.9), v(0, 6, -2.6), v(0, 10.5, -2.2), v(0, 12, -0.9)],
        r,
      )
      // The ferrule the strap is crimped into.
      add(new THREE.CylinderGeometry(2.3 * mm, 2.0 * mm, 9 * mm, 20), steel, (mesh) => mesh.position.copy(v(0, 31.5, 0.4)))
      length = 36 * mm
      break
    }

    case 'swivel': {
      const r = 1.0
      const y = bearing(r)
      // The snap hook: a loop through the hole, perpendicular to the card.
      wire([v(0, y, 0), v(0, y + 2, 4.2), v(0, y + 11, 4.6), v(0, y + 19, 2.4), v(0, y + 21, 0), v(0, y + 19, -2.4), v(0, y + 11, -4.6), v(0, y + 2, -4.2)], r, steel, true)
      // Its spring gate, a straight bar across the front of the loop.
      add(new THREE.CylinderGeometry(0.55 * mm, 0.55 * mm, 12 * mm, 10), darkSteel, (mesh) => mesh.position.copy(v(0, y + 10, 4.9)))
      // Swivel barrel and the eye the strap loops through.
      add(new THREE.CylinderGeometry(2.6 * mm, 2.6 * mm, 6 * mm, 20), steel, (mesh) => mesh.position.copy(v(0, y + 25, 0)))
      add(new THREE.TorusGeometry(4 * mm, 1.0 * mm, 12, 32), steel, (mesh) => mesh.position.copy(v(0, y + 32, 0)))
      length = (y + 36) * mm
      break
    }

    case 'strap': {
      const thickness = 0.5
      const width = Math.min(11, hole.width - 1)
      const y = bearing(thickness)
      const strapMaterial = new THREE.MeshStandardMaterial({
        color: 0xeaf4ff,
        transparent: true,
        opacity: 0.42,
        roughness: 0.15,
        metalness: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        envMap,
      })
      disposables.push(strapMaterial)
      const top = 34
      // Two layers of vinyl, one each side of the card, joined through the slot.
      for (const z of [1.2, -1.2]) {
        add(new THREE.BoxGeometry(width * mm, (top - y - 1.2) * mm, thickness * mm), strapMaterial, (mesh) =>
          mesh.position.copy(v(0, (top + y + 1.2) / 2, z)),
        )
      }
      add(new THREE.CylinderGeometry(1.2 * mm, 1.2 * mm, width * mm, 20, 1, true, 0, Math.PI), strapMaterial, (mesh) => {
        mesh.rotation.z = Math.PI / 2
        mesh.rotation.x = Math.PI
        mesh.position.copy(v(0, y + 1.2, 0))
      })
      // The snap that closes the loop, cap on the front and socket behind.
      add(new THREE.CylinderGeometry(5.5 * mm, 5.5 * mm, 1.6 * mm, 28), steel, (mesh) => {
        mesh.rotation.x = Math.PI / 2
        mesh.position.copy(v(0, 15, 2.2))
      })
      add(new THREE.CylinderGeometry(4.6 * mm, 4.6 * mm, 1.2 * mm, 24), darkSteel, (mesh) => {
        mesh.rotation.x = Math.PI / 2
        mesh.position.copy(v(0, 15, -2.0))
      })
      // The clip the strap ends in, and the loop the lanyard hooks onto.
      add(new THREE.BoxGeometry((width + 3) * mm, 9 * mm, 5 * mm), steel, (mesh) => mesh.position.copy(v(0, top + 3.5, 0)))
      add(new THREE.TorusGeometry(3.4 * mm, 0.9 * mm, 12, 28), steel, (mesh) => mesh.position.copy(v(0, top + 11, 0)))
      length = (top + 14.4) * mm
      break
    }

    case 'ring': {
      const r = 0.9
      const radius = 11.5
      const y = bearing(r)
      // A split ring is two turns; the second sits a wire's width alongside.
      for (const x of [-r * 0.6, r * 0.6]) {
        add(new THREE.TorusGeometry(radius * mm, r * mm, 14, 72), steel, (mesh) => {
          mesh.rotation.y = Math.PI / 2
          mesh.position.copy(v(x, y + radius, 0))
        })
      }
      length = (y + radius * 2 + r) * mm
      break
    }

    case 'clamp': {
      // Two jaws gripping the top edge, a spine over it, and a loop for the strap.
      for (const z of [1.4, -1.4]) {
        add(new THREE.BoxGeometry(15 * mm, 12 * mm, 0.9 * mm), steel, (mesh) => mesh.position.copy(v(0, -4, z)))
      }
      add(new THREE.CylinderGeometry(1.8 * mm, 1.8 * mm, 15 * mm, 16), darkSteel, (mesh) => {
        mesh.rotation.z = Math.PI / 2
        mesh.position.copy(v(0, 2.2, 0))
      })
      add(new THREE.TorusGeometry(3.6 * mm, 0.9 * mm, 12, 28), steel, (mesh) => mesh.position.copy(v(0, 8.5, 0)))
      length = 12 * mm
      break
    }

    case 'none':
      length = 0
      break
  }

  return {
    group,
    length,
    dispose() {
      for (const item of disposables) item.dispose()
    },
  }
}
