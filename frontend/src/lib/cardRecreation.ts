/** Shared import geometry, explicit bindings and production preflight. */
import type { CardData, FieldDefinition, ImageValue, TemplateMeta } from './types'
import { normalizeStandardFieldName, parseBarcodeLayerId } from './standardFields'
import { normalizeSymbology, validateBarcodeText } from './barcode'
import { isInNonFieldLayer } from './layerRoles'
export type Matrix = [number, number, number, number, number, number]
const IDENTITY: Matrix = [1,0,0,1,0,0]
const SVG_NS = 'http://www.w3.org/2000/svg'
const UNITS: Record<string,number> = {mm:1,cm:10,in:25.4,pt:25.4/72,pc:25.4/6}
export function parseAbsoluteSvgLength(value: string|null|undefined): {numeric?:number;unit?:'mm'|'px'} {
  const match=value?.trim().match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(mm|cm|in|pt|pc|px)?$/i)
  if(!match) return {}
  const n=Number(match[1]), unit=(match[2]??'px').toLowerCase()
  if(!Number.isFinite(n)||n<0) return {}
  return unit in UNITS?{numeric:n*UNITS[unit],unit:'mm'}:{numeric:n,unit:'px'}
}
export function coordinatePercent(value:number|undefined,extent:number|undefined,fallback:number,origin=0):number {
  return value!==undefined&&Number.isFinite(value)&&extent!==undefined&&Number.isFinite(extent)&&extent>0?(value-origin)/extent*100:fallback
}
export function multiply(a:Matrix,b:Matrix):Matrix {
  return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]]
}
export function svgTransform(value:string|null):Matrix {
  let result:Matrix=[...IDENTITY]
  for(const m of (value??'').matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/gi)) {
    const v=m[2].trim().split(/[\s,]+/).map(Number)
    if(v.some(n=>!Number.isFinite(n))) continue
    let next:Matrix=[...IDENTITY]
    const angle=(v[0]??0)*Math.PI/180
    switch(m[1].toLowerCase()) {
      case 'matrix': if(v.length===6) next=v as Matrix; break
      case 'translate': next[4]=v[0]??0;next[5]=v[1]??0;break
      case 'scale': next[0]=v[0]??1;next[3]=v[1]??next[0];break
      case 'rotate': {const r:Matrix=[Math.cos(angle),Math.sin(angle),-Math.sin(angle),Math.cos(angle),0,0];const x=v[1]??0,y=v[2]??0;next=multiply(multiply([1,0,0,1,x,y],r),[1,0,0,1,-x,-y]);break}
      case 'skewx': next[2]=Math.tan(angle);break
      case 'skewy': next[1]=Math.tan(angle);break
    }
    result=multiply(result,next)
  }
  return result
}
export function rootMatrix(node:Element):Matrix {
  const chain:Element[]=[]
  for(let current:Element|null=node;current&&current.tagName.toLowerCase()!=='svg';current=current.parentElement) chain.unshift(current)
  return chain.reduce((matrix,current)=>multiply(matrix,svgTransform(current.getAttribute('transform'))),[...IDENTITY] as Matrix)
}
function point(m:Matrix,x:number,y:number) {return {x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]}}
function numberAttr(node:Element,key:string,fallback=0):number {const n=Number.parseFloat(node.getAttribute(key)??'');return Number.isFinite(n)?n:fallback}
function property(node:Element,key:string):string|null {
  for(let current:Element|null=node;current;current=current.parentElement) {
    const direct=current.getAttribute(key)
    if(direct!==null) return direct
    const inline=current.getAttribute('style')?.match(new RegExp('(?:^|;)\\s*'+key+'\\s*:\\s*([^;]+)'))?.[1]
    if(inline) return inline.trim()
  }
  return null
}
function textPosition(node:Element) {
  const span=node.querySelector('tspan')
  const x=span?.hasAttribute('x')?numberAttr(span,'x'):numberAttr(node,'x')
  const y=span?.hasAttribute('y')?numberAttr(span,'y'):numberAttr(node,'y')
  return point(rootMatrix(node),x+(span?numberAttr(span,'dx'):0),y+(span?numberAttr(span,'dy'):0))
}
function geometry(node:Element) {
  const m=rootMatrix(node),x=numberAttr(node,'x'),y=numberAttr(node,'y'),w=numberAttr(node,'width'),h=numberAttr(node,'height')
  const corners=[point(m,x,y),point(m,x+w,y),point(m,x,y+h),point(m,x+w,y+h)],xs=corners.map(p=>p.x),ys=corners.map(p=>p.y)
  return {x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)}
}
/** Explicit metadata beats legacy naming only on the same node; other fields remain discoverable. */
export function normalizeCardFields(doc:Document,meta:Pick<TemplateMeta,'width'|'height'|'unit'|'viewBox'>,legacy:FieldDefinition[]):FieldDefinition[] {
  const root=meta.viewBox??{x:0,y:0,width:meta.width*(meta.unit==='mm'?96/25.4:1),height:meta.height*(meta.unit==='mm'?96/25.4:1)}
  const explicit:FieldDefinition[]=[],claimed=new Set<Element>()
  for(const container of Array.from(doc.querySelectorAll('[data-field-id][data-field-type]'))) {
    if(container.closest('defs,[data-static="true"],[data-editor-only="true"]')||isInNonFieldLayer(container)) continue
    const type=container.getAttribute('data-field-type')
    if(type!=='text'&&type!=='image'&&type!=='barcode'&&type!=='date') continue
    const node=(type==='text'||type==='date')&&container.tagName.toLowerCase()!=='text'?container.querySelector('text')??container:container
    const id=container.getAttribute('data-field-id')?.trim()
    if(!id) continue
    if(!node.id) node.setAttribute('id','bound-'+explicit.length+'-'+id.replace(/[^a-z0-9_-]/gi,'-'))
    const prior=legacy.find(f=>f.sourceId===node.id),family=property(node,'font-family')?.split(',')[0].replace(/["']/g,'')
    explicit.push({...prior,id,label:container.getAttribute('data-field-label')||prior?.label||id,sourceId:node.id,type,auto:true,x:0,y:0,
      dataSource:container.getAttribute('data-field-source')||id,required:container.getAttribute('data-field-required')==='true',
      fontSize:numberAttr(node,'font-size',prior?.fontSize??16),fontFamily:family||prior?.fontFamily,
      fontWeight:property(node,'font-weight')==='bold'?700:Number(property(node,'font-weight'))||prior?.fontWeight,
      color:property(node,'fill')||prior?.color||'#000000',wrapWidth:Number(container.getAttribute('data-field-width'))||prior?.wrapWidth,
      maxLines:Number(container.getAttribute('data-field-max-lines'))||undefined,minFontSize:Number(container.getAttribute('data-field-min-size'))||undefined,
      lineHeight:Number(container.getAttribute('data-field-line-height'))||prior?.lineHeight,letterSpacing:Number(container.getAttribute('data-field-letter-spacing'))||undefined,
      ...(type==='barcode'?{barcodeSymbology:normalizeSymbology(container.getAttribute('data-barcode-type')||'code128')??'code128'}:{})})
    claimed.add(node);claimed.add(container)
  }
  const seenNodes=new Set<string>(),seenIds=new Map<string,number>()
  return [...explicit,...legacy.filter(field=>{const node=field.sourceId?doc.getElementById(field.sourceId):null;return !node||!Array.from(claimed).some(owner=>owner===node||owner.contains(node)||(node.contains(owner)&&/\{\{(?:field|image|barcode|date):/.test(node.id)))})].filter(field=>{
    if(!field.sourceId||seenNodes.has(field.sourceId)) return false
    const node=doc.getElementById(field.sourceId)
    if(!node||node.closest('defs,[data-static="true"],[data-editor-only="true"]')||isInNonFieldLayer(node)) return false
    seenNodes.add(field.sourceId);return true
  }).map(field=>{
    const node=doc.getElementById(field.sourceId!)!
    const target=(field.type==='text'||field.type==='date')?node:node.tagName.toLowerCase()==='g'?node.querySelector('rect,image')??node:node
    const box=field.type==='text'||field.type==='date'?{...textPosition(target),width:0,height:0}:geometry(target)
    const count=seenIds.get(field.id)??0;seenIds.set(field.id,count+1)
    return {...field,id:count?field.id+'-'+(count+1):field.id,x:coordinatePercent(box.x,root.width,field.x,root.x),y:coordinatePercent(box.y,root.height,field.y,root.y),
      ...(box.width>0?{width:coordinatePercent(box.width,root.width,field.width??20)}:{}),...(box.height>0?{height:coordinatePercent(box.height,root.height,field.height??20)}:{})}
  })
}
export function isBoundField(field:FieldDefinition):boolean {
  return Boolean(field.dataSource||field.required||normalizeStandardFieldName(field.sourceId||field.id)||normalizeStandardFieldName(field.id)||/^(name|fullname|profilephoto|student_id|id)$/i.test(field.sourceId||'')||parseBarcodeLayerId(field.sourceId||field.id))
}
export function hasCardValue(value:unknown):boolean {
  return typeof value==='string'?value.trim().length>0:Boolean(value&&typeof value==='object'&&'src' in value&&typeof value.src==='string'&&value.src.trim())
}
export function validateProductionCard(fields:FieldDefinition[],data:CardData):void {
  const issues:string[]=[]
  for(const field of fields) {
    const value=data[field.id]
    if(field.required&&!hasCardValue(value)) issues.push(field.label+': required value is missing')
    if(field.type==='barcode'&&typeof value==='string'&&value.trim()) {const result=validateBarcodeText(field.barcodeSymbology??'code128',value);if(!result.valid) issues.push(field.label+': '+(result.error??'invalid barcode'))}
  }
  if(issues.length) throw new Error('Card export blocked. '+issues.join('; '))
}
/** Rects, images and grouped photos share one clipped local-coordinate replacement. */
export function replaceCardImage(doc:Document,original:Element,value:ImageValue|undefined):void {
  if(!value?.src) return
  const sourceTag=original.tagName.toLowerCase(),sourceBox=sourceTag==='g'?original.querySelector('rect,image'):original
  if(!sourceBox) return
  const x=numberAttr(sourceBox,'x'),y=numberAttr(sourceBox,'y'),width=numberAttr(sourceBox,'width'),height=numberAttr(sourceBox,'height')
  if(width<=0||height<=0) return
  let group=original
  if(sourceTag!=='g') {
    group=doc.createElementNS(SVG_NS,'g')
    for(const name of ['id','transform','clip-path','mask','opacity','data-field-id','data-field-type','data-field-source']) {const attr=original.getAttribute(name);if(attr!==null){group.setAttribute(name,attr);original.removeAttribute(name)}}
    original.parentNode?.replaceChild(group,original)
    if(sourceTag==='rect') group.appendChild(original)
  }
  group.querySelectorAll('image').forEach(image=>image.remove());group.querySelectorAll('[data-idcard-photo-clip]').forEach(clip=>clip.remove())
  const frame=group.querySelector('rect');frame?.setAttribute('fill','none')
  const defs=doc.createElementNS(SVG_NS,'defs');defs.setAttribute('data-idcard-photo-clip','true')
  const clip=doc.createElementNS(SVG_NS,'clipPath')
  let clipId='photo-clip-'+(group.id||'field').replace(/[^a-z0-9_-]/gi,'-')
  while(doc.getElementById(clipId)) clipId+='-1'
  clip.id=clipId;clip.setAttribute('clipPathUnits','userSpaceOnUse')
  const clipRect=doc.createElementNS(SVG_NS,'rect')
  for(const [key,n] of Object.entries({x,y,width,height,rx:numberAttr(sourceBox,'rx'),ry:numberAttr(sourceBox,'ry')})) clipRect.setAttribute(key,String(n))
  clip.appendChild(clipRect);defs.appendChild(clip);group.appendChild(defs)
  const scale=Number.isFinite(value.scale)?Math.max(0.1,Math.min(10,value.scale!)):1,offsetX=Number.isFinite(value.offsetX)?value.offsetX!:0,offsetY=Number.isFinite(value.offsetY)?value.offsetY!:0
  const imageGroup=doc.createElementNS(SVG_NS,'g');imageGroup.setAttribute('clip-path','url(#'+clipId+')');imageGroup.setAttribute('data-idcard-photo-clip','true')
  const image=doc.createElementNS(SVG_NS,'image')
  for(const [key,n] of Object.entries({x:x+offsetX*width-width*(scale-1)/2,y:y+offsetY*height-height*(scale-1)/2,width:width*scale,height:height*scale})) image.setAttribute(key,String(n))
  image.setAttribute('preserveAspectRatio',value.fit==='fill'?'none':value.fit==='contain'?'xMidYMid meet':'xMidYMid slice');image.setAttribute('href',value.src);image.setAttribute('data-idcard-generated','true')
  imageGroup.appendChild(image);group.appendChild(imageGroup);if(frame) group.appendChild(frame)
}
