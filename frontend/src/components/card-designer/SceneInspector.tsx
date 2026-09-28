import { useEffect, useState } from 'react'
import { FabricObject, Group } from 'fabric'
import { STANDARD_FIELDS, normalizeStandardFieldName } from '../../lib/standardFields'
import { BARCODE_SYMBOLOGIES, BARCODE_SYMBOLOGY_LABELS, type BarcodeSymbology } from '../../lib/barcode'
import { SceneSession, nodeData, readRasterFile } from './utils/sceneSession'
const PX_PER_MM = 96/25.4

export function NumberControl({label,value,onChange,min,max,step=0.1}:{label:string;value:number;onChange:(value:number)=>void;min?:number;max?:number;step?:number}) {
  const [draft,setDraft]=useState(String(Math.round(value*1000)/1000))
  useEffect(()=>setDraft(String(Math.round(value*1000)/1000)),[value])
  return <label className="scene-control"><span>{label}</span><input aria-label={label} type="number" value={draft} min={min} max={max} step={step}
    onChange={event=>{const text=event.target.value;setDraft(text);const next=Number(text);if(text!==''&&Number.isFinite(next)&&(min===undefined||next>=min)&&(max===undefined||next<=max))onChange(next)}}
    onBlur={()=>setDraft(String(Math.round(value*1000)/1000))}/></label>
}

export function SceneInspector({session,object,fontOptions,missingFonts,onError}:{session:SceneSession;object:FabricObject|null;fontOptions:string[];missingFonts:string[];onError:(message:string)=>void}) {
  if(!object)return <p className="scene-muted">Select a layer to edit its geometry, appearance and data binding.</p>
  const data=nodeData(object), text=typeof object.get('text')==='string', dynamic=['dynamic-text','image-placeholder','barcode'].includes(data.elementType)
  const textValue=object.get('text') as string|undefined
  const fontFamily=(object.get('fontFamily') as string|undefined)??'Arial'
  const fontSize=(object.get('fontSize') as number|undefined)??18
  const set=(key:string,value:unknown)=>session.update(object,{[key]:value})
  const changeData=(patch:Parameters<SceneSession['updateData']>[1])=>session.updateData(object,patch)
  const bind=(fieldId:string)=>changeData({fieldId,...(data.dynamicConfig?{dynamicConfig:{...data.dynamicConfig,fieldId}}:{}),...(data.barcodeConfig?{barcodeConfig:{...data.barcodeConfig,fieldId}}:{}),...(data.imagePlaceholderConfig?{imagePlaceholderConfig:{...data.imagePlaceholderConfig,fieldId}}:{})})
  const photo=data.imagePlaceholderConfig
  const photoChange=(patch:Partial<NonNullable<typeof photo>>)=>changeData({imagePlaceholderConfig:{fieldId:data.fieldId??'photo',fitMode:'cover',...photo,...patch}})
  return <div className="scene-inspector">
    <label className="scene-control"><span>Layer name</span><input aria-label="Layer name" value={data.name??data.elementType} onChange={event=>changeData({name:event.target.value})}/></label>
    <div className="scene-two-columns">
      <NumberControl label="Anchor X (mm)" value={object.left/PX_PER_MM} onChange={value=>set('left',value*PX_PER_MM)}/>
      <NumberControl label="Anchor Y (mm)" value={object.top/PX_PER_MM} onChange={value=>set('top',value*PX_PER_MM)}/>
      <NumberControl label="Object width (mm)" value={object.getScaledWidth()/PX_PER_MM} min={0.1} onChange={value=>set('scaleX',object.scaleX*value*PX_PER_MM/object.getScaledWidth())}/>
      <NumberControl label="Object height (mm)" value={object.getScaledHeight()/PX_PER_MM} min={0.1} onChange={value=>set('scaleY',object.scaleY*value*PX_PER_MM/object.getScaledHeight())}/>
      <NumberControl label="Rotation (degrees)" value={object.angle} step={1} onChange={value=>set('angle',value)}/>
      <NumberControl label="Opacity (%)" value={object.opacity*100} min={0} max={100} step={1} onChange={value=>set('opacity',value/100)}/>
    </div>
    <label className="scene-control"><span>{object instanceof Group?'Tint filled paths':'Fill colour'}</span><input aria-label="Fill colour" type="color" value={typeof object.fill==='string'&&/^#[0-9a-f]{6}$/i.test(object.fill)?object.fill:'#000000'} onChange={event=>object instanceof Group?session.tint(object,event.target.value):set('fill',event.target.value)}/></label>
    {!text&&!(object instanceof Group)&&<div className="scene-two-columns">
      <label className="scene-control"><span>Stroke</span><input aria-label="Stroke colour" type="color" value={typeof object.stroke==='string'&&/^#[0-9a-f]{6}$/i.test(object.stroke)?object.stroke:'#000000'} onChange={event=>set('stroke',event.target.value)}/></label>
      <NumberControl label="Stroke width (px)" value={object.strokeWidth} min={0} onChange={value=>set('strokeWidth',value)}/>
      {object.type.toLowerCase()==='rect'&&<NumberControl label="Corner radius (px)" value={Number(object.get('rx'))||0} min={0} onChange={value=>session.update(object,{rx:value,ry:value})}/>}
    </div>}
    {text&&<fieldset><legend>Typography</legend>
      <label className="scene-control"><span>Text / sample value</span><textarea aria-label="Text / sample value" rows={3} value={textValue??''} onChange={event=>set('text',event.target.value)}/></label>
      <label className="scene-control"><span>Font family</span><select aria-label="Font family" value={fontFamily} onChange={event=>set('fontFamily',event.target.value)}>
        {Array.from(new Set([...fontOptions,fontFamily])).sort().map(font=><option key={font} value={font}>{font}{missingFonts.includes(font)?' (missing)':''}</option>)}
      </select></label>
      {missingFonts.includes(fontFamily)&&<p role="status" className="scene-warning">This font is not loaded. Load it in the app’s font manager before checking print fidelity.</p>}
      <div className="scene-two-columns">
        <NumberControl label="Font size (pt)" value={fontSize*Math.abs(object.scaleY)*72/96} min={1} onChange={value=>set('fontSize',value*96/72/Math.abs(object.scaleY))}/>
        <label className="scene-control"><span>Weight</span><select aria-label="Font weight" value={String(object.get('fontWeight')??'normal')} onChange={event=>set('fontWeight',event.target.value)}>{['normal','bold','100','200','300','400','500','600','700','800','900'].map(weight=><option key={weight}>{weight}</option>)}</select></label>
        <NumberControl label="Line spacing" value={Number(object.get('lineHeight'))||1.2} min={0.5} max={4} onChange={value=>set('lineHeight',value)}/>
        <NumberControl label="Letter spacing (px)" value={(Number(object.get('charSpacing'))||0)*fontSize/1000} onChange={value=>set('charSpacing',value/fontSize*1000)}/>
        <NumberControl label="Text box width (mm)" value={object.width*Math.abs(object.scaleX)/PX_PER_MM} min={1} onChange={value=>set('width',value*PX_PER_MM/Math.abs(object.scaleX))}/>
        <label className="scene-control"><span>Alignment</span><select aria-label="Text alignment" value={String(object.get('textAlign')??'left')} onChange={event=>set('textAlign',event.target.value)}>{['left','center','right'].map(align=><option key={align}>{align}</option>)}</select></label>
      </div>
      <label className="scene-check"><input type="checkbox" checked={dynamic} onChange={event=>changeData(event.target.checked?{elementType:'dynamic-text',isDynamic:true,fieldId:data.fieldId??'fullName_First_Last'}:{elementType:'text',isDynamic:false,fieldId:undefined,required:false})}/>Variable text</label>
    </fieldset>}
    {dynamic&&<fieldset><legend>Data binding</legend>
      <label className="scene-control"><span>Record field / name format</span><input aria-label="Record field / name format" list="scene-standard-fields" value={data.fieldId??''} onChange={event=>bind(event.target.value)}/></label>
      <datalist id="scene-standard-fields">{STANDARD_FIELDS.map(field=><option key={field} value={field}/>)}</datalist>
      {data.fieldId&&!normalizeStandardFieldName(data.fieldId)&&<p className="scene-warning">This is a custom field. Map it before exporting records.</p>}
      <label className="scene-check"><input aria-label="Required for production" type="checkbox" checked={data.required??false} onChange={event=>changeData({required:event.target.checked})}/>Required for production export</label>
      {text&&<div className="scene-two-columns">
        <NumberControl label="Maximum lines (0 = unlimited)" value={data.layout?.maxLines??0} min={0} step={1} onChange={value=>changeData({layout:{...data.layout,maxLines:Math.floor(value)||undefined}})}/>
        <NumberControl label="Minimum font size (pt)" value={(data.layout?.minFontSize??fontSize*0.6)*72/96} min={1} onChange={value=>changeData({layout:{...data.layout,minFontSize:value*96/72}})}/>
      </div>}
      {data.elementType==='barcode'&&<label className="scene-control"><span>Barcode format</span><select aria-label="Barcode format" value={data.barcodeConfig?.barcodeType??'code128'} onChange={event=>changeData({barcodeConfig:{fieldId:data.fieldId??'studentId',barcodeType:event.target.value as BarcodeSymbology}})}>{BARCODE_SYMBOLOGIES.map(type=><option key={type} value={type}>{BARCODE_SYMBOLOGY_LABELS[type]}</option>)}</select></label>}
      {data.elementType==='image-placeholder'&&<>
        <label className="scene-control"><span>Photo fit</span><select aria-label="Photo fit" value={photo?.fitMode??'cover'} onChange={event=>photoChange({fitMode:event.target.value as 'cover'|'contain'|'fill'})}><option value="cover">Cover / crop</option><option value="contain">Contain</option><option value="fill">Stretch (distorts photo)</option></select></label>
        <div className="scene-two-columns">
          <NumberControl label="Photo zoom (%)" value={(photo?.scale??1)*100} min={10} max={1000} step={1} onChange={value=>photoChange({scale:value/100})}/>
          <NumberControl label="Photo offset X (%)" value={(photo?.offsetX??0)*100} min={-200} max={200} step={1} onChange={value=>photoChange({offsetX:value/100})}/>
          <NumberControl label="Photo offset Y (%)" value={(photo?.offsetY??0)*100} min={-200} max={200} step={1} onChange={value=>photoChange({offsetY:value/100})}/>
        </div>
        <label className="scene-control"><span>Sample photo (preview only)</span><input aria-label="Sample photo" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event=>{const file=event.target.files?.[0];if(file)void readRasterFile(file).then(sampleSrc=>photoChange({sampleSrc})).catch(error=>onError(String(error)));event.target.value=''}}/></label>
        {photo?.sampleSrc&&<div style={{position:'relative',overflow:'hidden',height:180,background:'#eee'}}><img alt="Sample photo crop" src={photo.sampleSrc} style={{width:'100%',height:'100%',objectFit:photo.fitMode==='fill'?'fill':photo.fitMode==='contain'?'contain':'cover',transform:`translate(${(photo.offsetX??0)*100}%,${(photo.offsetY??0)*100}%) scale(${photo.scale??1})`}}/></div>}
        <p className="scene-muted">The gray canvas box marks the frame. Use Data preview to see the cropped sample photo on the card.</p>
      </>}
    </fieldset>}
    {data.assetId&&<p className="scene-muted">Reusable artwork instance. Duplicate keeps its asset identity; position, tint and opacity remain independent.</p>}
  </div>
}
