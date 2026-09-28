import { Canvas, FabricObject, Group } from 'fabric'
import { readEditorDocument } from '../../../lib/editorDocument'
import { normalizeSymbology } from '../../../lib/barcode'
import { assignObjectIds, nodeData, SCENE_PROPERTIES } from './sceneSession'

const SVG_NS = 'http://www.w3.org/2000/svg'
const PX_PER_MM = 96/25.4

/** SVG is derived from canonical Fabric state; binding IDs survive groups and roundtrips. */
export function fabricCanvasToSvg(canvas: Canvas, cardWidthMm: number, cardHeightMm: number): string {
  canvas.getObjects().forEach(object=>assignObjectIds(object))
  const raw = canvas.toSVG({width:cardWidthMm+'mm',height:cardHeightMm+'mm',viewBox:{x:0,y:0,width:cardWidthMm*PX_PER_MM,height:cardHeightMm*PX_PER_MM}})
  const doc = new DOMParser().parseFromString(raw,'image/svg+xml')
  const visit = (object: FabricObject): void => {
    if (object.excludeFromExport) return
    const node = doc.getElementById(object.get('id') as string)
    const data = nodeData(object)
    if (node && data.fieldId && ['dynamic-text','image-placeholder','barcode'].includes(data.elementType)) {
      let target: Element = node
      let type = 'text'
      if (data.elementType === 'dynamic-text') {
        target = node.tagName.toLowerCase()==='text'?node:node.querySelector('text')??node
        if(target!==node)target.setAttribute('id',(object.get('id') as string)+'-field')
      } else if (data.elementType === 'image-placeholder') {
        type='image'
        const config=data.imagePlaceholderConfig
        if(config){target.setAttribute('data-photo-fit',config.fitMode);target.setAttribute('data-photo-scale',String(config.scale??1));target.setAttribute('data-photo-x',String(config.offsetX??0));target.setAttribute('data-photo-y',String(config.offsetY??0))}
      } else {
        type='barcode'
        const sample=doc.createElementNS(SVG_NS,'text')
        sample.setAttribute('x',String(-object.width/2));sample.setAttribute('y',String(object.height/2));sample.setAttribute('font-size',String(object.height))
        sample.setAttribute('data-barcode-width',String(object.width));sample.setAttribute('data-barcode-height',String(object.height))
        sample.setAttribute('id',(object.get('id') as string)+'-field');sample.textContent='123456789012'
        // Fabric places the object's own transform on its wrapping group.
        while(node.firstChild)node.removeChild(node.firstChild)
        node.appendChild(sample);target=sample
        target.setAttribute('data-barcode-type',normalizeSymbology(data.barcodeConfig?.barcodeType??'code128')??'code128')
      }
      target.setAttribute('data-field-id',data.fieldId)
      target.setAttribute('data-field-source',data.fieldId)
      target.setAttribute('data-field-type',type)
      target.setAttribute('data-field-required',String(data.required??false))
      if(type==='text'){
        target.setAttribute('data-field-width',String(data.layout?.wrapWidth??object.width))
        const text=object as FabricObject & {fontSize?:number;lineHeight?:number;charSpacing?:number}
        if(text.fontSize)target.setAttribute('data-field-line-height',String(text.fontSize*(text.lineHeight??1.2)))
        if(text.charSpacing&&text.fontSize)target.setAttribute('data-field-letter-spacing',String(text.charSpacing*text.fontSize/1000))
        if(data.layout?.maxLines)target.setAttribute('data-field-max-lines',String(data.layout.maxLines))
        if(data.layout?.minFontSize)target.setAttribute('data-field-min-size',String(data.layout.minFontSize))
      }
      return
    }
    if(node && (data.elementType==='asset' || !(object instanceof Group))) node.setAttribute('data-static','true')
    if(object instanceof Group && data.elementType!=='asset')object.getObjects().forEach(visit)
  }
  canvas.getObjects().forEach(visit)
  return new XMLSerializer().serializeToString(doc.documentElement)
}

export function extractFieldsFromCanvasSvg(svg: string): Array<{fieldId:string;fieldType:'text'|'image'|'barcode';barcodeType?:string}> {
  const doc=new DOMParser().parseFromString(svg,'image/svg+xml')
  return Array.from(doc.querySelectorAll('[data-field-id][data-field-type]')).flatMap(node=>{
    const fieldId=node.getAttribute('data-field-id'),type=node.getAttribute('data-field-type')
    if(!fieldId||(type!=='text'&&type!=='image'&&type!=='barcode'))return []
    return [{fieldId,fieldType:type,barcodeType:node.getAttribute('data-barcode-type')??undefined}]
  })
}

export async function generateSvgFromCanvasData(canvasJson:string,cardWidthMm:number,cardHeightMm:number):Promise<string>{
  const parsed=readEditorDocument(canvasJson)
  delete parsed.overlayImage;delete parsed.cardEditor
  const canvas=new Canvas(document.createElement('canvas'),{width:cardWidthMm*PX_PER_MM,height:cardHeightMm*PX_PER_MM})
  try{
    await document.fonts?.ready
    await canvas.loadFromJSON(parsed)
    return fabricCanvasToSvg(canvas,cardWidthMm,cardHeightMm)
  }finally{await canvas.dispose()}
}
export { SCENE_PROPERTIES }
