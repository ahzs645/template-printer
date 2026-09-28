import { ActiveSelection, Canvas, FabricImage, FabricObject, Group, Rect, Textbox, loadSVGFromString, util } from 'fabric'
import { isEmbeddedRaster, readEditorDocument, type ReferenceImage } from '../../../lib/editorDocument'
import { sanitizeSvgMarkup } from '../../../lib/svgSanitizer'
import type { BarcodeSymbology } from '../../../lib/barcode'

export type SceneNode = {
  elementType: string
  fieldId?: string
  isDynamic?: boolean
  required?: boolean
  assetId?: string
  name?: string
  locked?: boolean
  dynamicConfig?: {fieldId: string; defaultText: string}
  barcodeConfig?: {fieldId: string; barcodeType: BarcodeSymbology | 'qr'}
  imagePlaceholderConfig?: {fieldId: string; fitMode: 'cover' | 'contain' | 'fill'; scale?: number; offsetX?: number; offsetY?: number; sampleSrc?: string}
  layout?: {maxLines?: number; minFontSize?: number}
}
export const SCENE_PROPERTIES = ['id', 'data', 'name', 'selectable', 'evented', 'lockMovementX', 'lockMovementY', 'lockScalingX', 'lockScalingY', 'lockRotation']
FabricObject.customProperties = Array.from(new Set([...FabricObject.customProperties, ...SCENE_PROPERTIES]))
export function nodeData(object: FabricObject): SceneNode {
  return (object.get('data') as SceneNode | undefined) ?? {elementType: object.type}
}
export function objectId(object: FabricObject): string { return object.get('id') as string }
export function assignObjectIds(object: FabricObject, replace = false): void {
  if (replace || !object.get('id')) object.set('id', 'object-' + crypto.randomUUID())
  if (object instanceof Group) object.getObjects().forEach(child => assignObjectIds(child, replace))
}
export function isEditingText(event: KeyboardEvent, canvas?: Canvas): boolean {
  const target = event.target
  return Boolean(target instanceof HTMLElement && target.closest('input,textarea,select,[contenteditable="true"]')) || Boolean((canvas?.getActiveObject() as Textbox | undefined)?.isEditing)
}
export async function readRasterFile(file: File): Promise<string> {
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) throw new Error('Choose a PNG, JPEG, WebP or GIF image.')
  if (file.size > 8 * 1024 * 1024) throw new Error('Images must be 8 MB or smaller.')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('The image could not be read.'))
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('The image could not be read.'))
    reader.readAsDataURL(file)
  })
}

/** One mutation/history path for pointer actions, inspector edits, assets and reference settings. */
export class SceneSession {
  readonly canvas: Canvas
  busy = false
  reference?: ReferenceImage
  private history: string[] = []
  private index = -1
  private batchDepth = 0
  private timer?: ReturnType<typeof setTimeout>
  private disposed = false
  private listeners = new Set<() => void>()
  private readonly nativeChange = (event: {target?: FabricObject}) => {
    if (event.target?.excludeFromExport || this.busy || this.batchDepth) return
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.commit(), 80)
  }
  private readonly selectionChange = () => this.publish()

  constructor(canvas: Canvas) {
    this.canvas = canvas
    canvas.on('object:added', this.nativeChange)
    canvas.on('object:removed', this.nativeChange)
    canvas.on('object:modified', this.nativeChange)
    canvas.on('text:changed', this.nativeChange)
    canvas.on('selection:created', this.selectionChange)
    canvas.on('selection:updated', this.selectionChange)
    canvas.on('selection:cleared', this.selectionChange)
    this.commit()
  }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private publish(): void { if (!this.disposed) this.listeners.forEach(listener => listener()) }
  get canUndo(): boolean { return !this.busy && this.index > 0 }
  get canRedo(): boolean { return !this.busy && this.index < this.history.length - 1 }
  snapshot(includeReference = true): string {
    this.canvas.getObjects().forEach(object => assignObjectIds(object))
    return JSON.stringify({...this.canvas.toObject(SCENE_PROPERTIES), cardEditor: {version: 1, ...(includeReference && this.reference ? {reference: this.reference} : {})}})
  }
  private commit(): void {
    clearTimeout(this.timer)
    if (this.disposed || this.busy || this.batchDepth) return
    const next = this.snapshot()
    if (next !== this.history[this.index]) {
      this.history = this.history.slice(0, this.index + 1)
      this.history.push(next)
      if (this.history.length > 50) this.history.shift()
      this.index = this.history.length - 1
    }
    this.publish()
  }
  transact(change: () => void): void {
    if (this.busy || this.disposed) return
    this.batchDepth++
    try { change(); this.canvas.getObjects().forEach(object => object.setCoords()); this.canvas.requestRenderAll() }
    finally { this.batchDepth--; this.commit() }
  }
  update(object: FabricObject, changes: Record<string, unknown>): void {
    this.transact(() => { object.set(changes); object.setCoords() })
  }
  updateData(object: FabricObject, changes: Partial<SceneNode>): void {
    this.update(object, {data: {...nodeData(object), ...changes}})
  }
  async load(json: string | null | undefined, resetHistory = true): Promise<void> {
    if (this.busy || this.disposed) return
    clearTimeout(this.timer)
    const document = json && json !== '{}' ? readEditorDocument(json) : {objects: [], background: '#ffffff'}
    const metadata = 'cardEditor' in document ? document.cardEditor : undefined
    const data = {...document}
    delete data.cardEditor
    delete data.overlayImage
    this.busy = true; this.publish()
    try {
      await this.canvas.loadFromJSON(data)
      if (this.disposed) return
      this.canvas.overlayImage = undefined
      this.reference = undefined
      if (metadata?.reference) await this.applyReference(metadata.reference)
      this.canvas.getObjects().forEach(object => { assignObjectIds(object); object.setCoords() })
      this.canvas.requestRenderAll()
      if (resetHistory) { this.history = [this.snapshot()]; this.index = 0 }
    } finally { this.busy = false; this.publish() }
  }
  async undo(): Promise<void> {
    this.commit()
    if (!this.canUndo) return
    const next = this.index - 1
    await this.load(this.history[next], false)
    this.index = next; this.publish()
  }
  async redo(): Promise<void> {
    if (!this.canRedo) return
    const next = this.index + 1
    await this.load(this.history[next], false)
    this.index = next; this.publish()
  }
  add(object: FabricObject, data?: SceneNode): void {
    this.transact(() => {
      assignObjectIds(object)
      if (data) object.set('data', data)
      this.canvas.add(object); this.canvas.setActiveObject(object)
    })
  }
  removeSelection(): void {
    const selected = this.canvas.getActiveObjects().filter(object => !nodeData(object).locked)
    this.transact(() => { this.canvas.discardActiveObject(); this.canvas.remove(...selected) })
  }
  async duplicate(): Promise<void> {
    if (this.busy) return
    const originals = [...this.canvas.getActiveObjects()]
    const clones = await Promise.all(originals.map(object => object.clone(SCENE_PROPERTIES)))
    if (this.disposed) return
    this.transact(() => {
      this.canvas.discardActiveObject()
      clones.forEach((clone, index) => {
        const source = originals[index]
        // Clones made from an ActiveSelection use local coordinates; take the root transform.
        util.applyTransformToObject(clone, source.calcTransformMatrix())
        clone.set({left: clone.left + 8, top: clone.top + 8, selectable: true, evented: true})
        assignObjectIds(clone, true)
        clone.set('data', {...nodeData(clone), locked: false})
        this.canvas.add(clone)
      })
      if (clones.length === 1) this.canvas.setActiveObject(clones[0])
      else if (clones.length) this.canvas.setActiveObject(new ActiveSelection(clones, {canvas: this.canvas}))
    })
  }
  group(): void {
    const selected = this.canvas.getActiveObjects()
    if (selected.length < 2) return
    this.transact(() => {
      this.canvas.discardActiveObject()
      this.canvas.remove(...selected)
      const group = new Group(selected)
      assignObjectIds(group)
      group.set('data', {elementType: 'group', name: 'Group'})
      this.canvas.add(group); this.canvas.setActiveObject(group)
    })
  }
  ungroup(): void {
    const group = this.canvas.getActiveObject()
    if (!(group instanceof Group) || group instanceof ActiveSelection) return
    this.transact(() => {
      const index = this.canvas.getObjects().indexOf(group)
      this.canvas.discardActiveObject()
      const children = group.removeAll()
      this.canvas.remove(group); this.canvas.insertAt(index, ...children)
      this.canvas.setActiveObject(new ActiveSelection(children, {canvas: this.canvas}))
    })
  }
  moveLayer(object: FabricObject, delta: number): void {
    this.transact(() => this.canvas.moveObjectTo(object, Math.max(0, Math.min(this.canvas.getObjects().length - 1, this.canvas.getObjects().indexOf(object) + delta))))
  }
  lock(object: FabricObject, locked: boolean): void {
    this.update(object, {data: {...nodeData(object), locked}, lockMovementX: locked, lockMovementY: locked, lockScalingX: locked, lockScalingY: locked, lockRotation: locked, selectable: !locked, evented: !locked})
    if (locked) { this.canvas.discardActiveObject(); this.publish() }
  }
  align(mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distribute-x' | 'distribute-y'): void {
    const selected = [...this.canvas.getActiveObjects()].filter(object => !nodeData(object).locked)
    if (!selected.length) return
    this.transact(() => {
      this.canvas.discardActiveObject()
      const horizontal = mode === 'distribute-x'
      if (mode.startsWith('distribute-') && selected.length > 2) {
        const center = (object: FabricObject) => { const box = object.getBoundingRect(); return horizontal ? box.left + box.width / 2 : box.top + box.height / 2 }
        selected.sort((a,b) => center(a)-center(b))
        const first = center(selected[0]), step = (center(selected[selected.length-1])-first)/(selected.length-1)
        selected.forEach((object,index) => object.set(horizontal ? 'left' : 'top', (horizontal ? object.left : object.top) + first + index*step-center(object)))
      } else if (!mode.startsWith('distribute-')) {
        const bounds = selected.map(object => object.getBoundingRect())
        const left = selected.length === 1 ? 0 : Math.min(...bounds.map(box=>box.left))
        const top = selected.length === 1 ? 0 : Math.min(...bounds.map(box=>box.top))
        const right = selected.length === 1 ? this.canvas.width : Math.max(...bounds.map(box=>box.left+box.width))
        const bottom = selected.length === 1 ? this.canvas.height : Math.max(...bounds.map(box=>box.top+box.height))
        selected.forEach(object => {
          const box = object.getBoundingRect()
          if (mode === 'left') object.set('left', object.left + left-box.left)
          if (mode === 'right') object.set('left', object.left + right-box.left-box.width)
          if (mode === 'center') object.set('left', object.left + (left+right-box.width)/2-box.left)
          if (mode === 'top') object.set('top', object.top + top-box.top)
          if (mode === 'bottom') object.set('top', object.top + bottom-box.top-box.height)
          if (mode === 'middle') object.set('top', object.top + (top+bottom-box.height)/2-box.top)
        })
      }
      if (selected.length === 1) this.canvas.setActiveObject(selected[0])
      else this.canvas.setActiveObject(new ActiveSelection(selected, {canvas: this.canvas}))
    })
  }
  tint(object: FabricObject, color: string): void {
    this.transact(() => {
      const visit = (item: FabricObject) => {
        if (item instanceof Group) item.getObjects().forEach(visit)
        else if (typeof item.fill === 'string' && item.fill && item.fill !== 'none') item.set('fill', color)
      }
      visit(object); object.set('dirty', true)
    })
  }
  async importAsset(file: File): Promise<void> {
    if (file.size > 8*1024*1024) throw new Error('Artwork must be 8 MB or smaller.')
    let asset: FabricObject
    if (/\.svg$/i.test(file.name) || file.type === 'image/svg+xml') {
      const svg = sanitizeSvgMarkup(await file.text())
      const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
      for (const image of document.querySelectorAll('image')) {
        const src = image.getAttribute('href') || image.getAttribute('xlink:href') || ''
        if (src && !isEmbeddedRaster(src)) throw new Error('Embed raster images in the SVG before importing it.')
      }
      const parsed = await loadSVGFromString(svg)
      const objects = parsed.objects.filter((object): object is FabricObject => object !== null)
      if (!objects.length) throw new Error('No supported vector objects were found in this SVG.')
      asset = util.groupSVGElements(objects, parsed.options)
    } else asset = await FabricImage.fromURL(await readRasterFile(file))
    if (this.disposed) return
    const maximum = this.canvas.width * 0.45
    if (asset.getScaledWidth() > maximum) asset.scaleToWidth(maximum)
    asset.set({left: 16, top: 16, originX: 'left', originY: 'top'})
    this.add(asset, {elementType: 'asset', name: file.name, assetId: crypto.randomUUID()})
  }
  private async applyReference(reference?: ReferenceImage): Promise<void> {
    if (!reference) { this.reference = undefined; this.canvas.overlayImage = undefined; return }
    if (!isEmbeddedRaster(reference.src)) throw new Error('The reference must be an embedded raster image.')
    const image = this.canvas.overlayImage?.getSrc() === reference.src ? this.canvas.overlayImage : await FabricImage.fromURL(reference.src)
    if (this.disposed) return
    const next = {...reference, opacity: Math.max(0, Math.min(1, reference.opacity))}
    image.set({left: next.x, top: next.y, originX: 'left', originY: 'top', scaleX: next.width/image.width, scaleY: next.height/image.height, angle: next.angle, opacity: next.visible ? next.opacity : 0, selectable: false, evented: false, excludeFromExport: true})
    this.canvas.overlayImage = image; this.reference = next
  }
  async setReference(reference?: ReferenceImage): Promise<void> {
    if (this.busy || this.disposed) return
    this.busy = true; this.publish()
    try { await this.applyReference(reference); this.canvas.requestRenderAll() }
    finally { this.busy = false; this.commit() }
  }
  async importReference(file: File): Promise<void> {
    const src = await readRasterFile(file)
    await this.setReference({src, opacity: 0.35, visible: true, x: 0, y: 0, width: this.canvas.width, height: this.canvas.height, angle: 0})
  }
  addText(dynamic = false): void {
    const fieldId = dynamic ? 'fullName_First_Last' : undefined
    this.add(new Textbox(dynamic ? 'Sample Student' : 'Text', {left: 24, top: 24, width: 150, fontSize: 18, fontFamily: 'Arial', originX:'left', originY:'top'}),
      {elementType: dynamic ? 'dynamic-text' : 'text', fieldId, isDynamic: dynamic, ...(fieldId ? {dynamicConfig:{fieldId,defaultText:'Sample Student'}} : {})})
  }
  addPhoto(): void {
    this.add(new Rect({left:20,top:45,width:90,height:110,fill:'#e5e7eb',stroke:'#64748b',strokeWidth:1,originX:'left',originY:'top'}), {elementType:'image-placeholder',fieldId:'photo',imagePlaceholderConfig:{fieldId:'photo',fitMode:'cover',scale:1,offsetX:0,offsetY:0}})
  }
  addBarcode(symbology: BarcodeSymbology): void {
    this.add(new Rect({left:30,top:130,width:symbology==='qrcode'?65:140,height:65,fill:'#f1f5f9',stroke:'#64748b',strokeWidth:1,originX:'left',originY:'top'}),{elementType:'barcode',fieldId:'studentId',barcodeConfig:{fieldId:'studentId',barcodeType:symbology}})
  }
  dispose(): void {
    this.disposed = true; clearTimeout(this.timer); this.listeners.clear()
    this.canvas.off('object:added',this.nativeChange);this.canvas.off('object:removed',this.nativeChange);this.canvas.off('object:modified',this.nativeChange);this.canvas.off('text:changed',this.nativeChange)
    this.canvas.off('selection:created',this.selectionChange);this.canvas.off('selection:updated',this.selectionChange);this.canvas.off('selection:cleared',this.selectionChange)
  }
}
