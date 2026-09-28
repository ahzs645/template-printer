import { FabricObject, Group, Rect, loadSVGFromString } from 'fabric'
import { parseTemplateString } from '../../../lib/svgTemplate'
import { isEmbeddedRaster } from '../../../lib/editorDocument'
import { normalizeSymbology } from '../../../lib/barcode'
import type { LoadedPackageSide } from '../../../lib/templatePackage'
import { SceneSession, assignObjectIds, type SceneNode } from './sceneSession'

/** Import SVG specimens as vector objects while preserving declared record bindings. */
export async function importPackageSide(session: SceneSession, side: LoadedPackageSide): Promise<{widthMm:number;heightMm:number}> {
  const document=new DOMParser().parseFromString(side.svg,'image/svg+xml')
  for(const image of document.querySelectorAll('image')){
    const src=image.getAttribute('href')||image.getAttribute('xlink:href')||''
    if(src&&!isEmbeddedRaster(src))throw new Error('Embed raster images before converting this SVG to editable artwork.')
  }
  const parsedTemplate=await parseTemplateString(side.svg,side.name)
  const meta=parsedTemplate.metadata
  URL.revokeObjectURL(meta.objectUrl)
  const fields=side.fields.length?side.fields:parsedTemplate.autoFields
  const bySource=new Map(fields.filter(field=>field.sourceId).map(field=>[field.sourceId!,field]))
  const mappings=new Map(side.mappings.map(mapping=>[mapping.svgLayerId,mapping.standardFieldName]))
  const owners=new Map<FabricObject,string>()
  const parsed=await loadSVGFromString(side.svg,(element,object)=>{
    for(let node:Element|null=element;node&&node.tagName.toLowerCase()!=='svg';node=node.parentElement){
      if(bySource.has(node.id)){owners.set(object,node.id);break}
    }
  })
  const objects=parsed.objects.filter((object):object is FabricObject=>Boolean(object))
  const claimed=new Set<FabricObject>(),result:FabricObject[]=[]
  for(const object of objects){
    if(claimed.has(object))continue
    const sourceId=owners.get(object),field=sourceId?bySource.get(sourceId):undefined
    if(!field){object.set('data',{elementType:typeof object.get('text')==='string'?'text':'asset',name:object.type});assignObjectIds(object,true);result.push(object);continue}
    const members=objects.filter(item=>owners.get(item)===sourceId)
    members.forEach(item=>claimed.add(item))
    if((field.type==='text'||field.type==='date')&&members.length>1)throw new Error('The field '+field.label+' consists of separate text objects. Give those text objects separate field IDs before converting it.')
    let item:FabricObject=members.length>1?new Group(members):object
    const fieldId=mappings.get(sourceId!)||field.dataSource||field.id
    const data:SceneNode={elementType:field.type==='image'?'image-placeholder':field.type==='barcode'?'barcode':'dynamic-text',fieldId,isDynamic:field.type==='text',required:field.required,name:field.label}
    if(field.type==='image')data.imagePlaceholderConfig={fieldId,fitMode:'cover',scale:1,offsetX:0,offsetY:0}
    if(field.type==='barcode'){
      const bounds=item.getBoundingRect()
      item=new Rect({left:bounds.left,top:bounds.top,width:bounds.width||100,height:bounds.height||40,originX:'left',originY:'top',fill:'#f1f5f9',stroke:'#64748b',strokeWidth:1})
      data.barcodeConfig={fieldId,barcodeType:normalizeSymbology(field.barcodeSymbology??'code128')??'code128'}
    }
    data.layout={maxLines:field.maxLines,minFontSize:field.minFontSize}
    if(field.wrapWidth)data.layout={...data.layout,wrapWidth:field.wrapWidth}
    item.set('data',data);assignObjectIds(item,true);result.push(item)
  }
  const json=JSON.stringify({version:'7.1.0',objects:result.map(object=>object.toObject()),background:'#ffffff',cardEditor:{version:1}})
  await session.load(json)
  const scale=meta.unit==='mm'?1:25.4/96
  return{widthMm:meta.width*scale,heightMm:meta.height*scale}
}
