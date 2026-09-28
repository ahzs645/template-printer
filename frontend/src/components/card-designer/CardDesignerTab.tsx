import { useEffect, useRef, useState } from 'react'
import { Canvas, Circle, Line, Rect, FabricObject, Group } from 'fabric'
import { SceneSession, isEditingText, nodeData, objectId } from './utils/sceneSession'
import { fabricCanvasToSvg } from './utils/fabricToSvg'
import { SceneInspector, NumberControl } from './SceneInspector'
import { parseTemplateString, renderSvgWithData } from '../../lib/svgTemplate'
import { generateAutoMappings } from '../../lib/autoMapping'
import { createTemplatePackage, packageFileName, readTemplatePackage } from '../../lib/templatePackage'
import type { FontData } from '../../lib/api'
import type { CardData } from '../../lib/types'
import { InlineSvg } from '../InlineSvg'
import './card-designer.css'

const PX_PER_MM=96/25.4
const SYSTEM_FONTS=['Arial','Helvetica','Times New Roman','Georgia','Verdana','sans-serif','serif']
type SaveData={name:string;frontCanvasData:string;backCanvasData:string;cardWidth:number;cardHeight:number}
type Props={designId?:string;initialName?:string;initialFrontData?:string|null;initialBackData?:string|null;initialCardWidth?:number;initialCardHeight?:number;onSave:(data:SaveData)=>void;onCancel:()=>void;fontOptions?:string[];missingFonts?:string[];getFonts?:()=>Promise<FontData[]>;onLoadFont?:(name:string,file:File)=>Promise<unknown>}

export function CardDesignerTab({initialName='Untitled Design',initialFrontData,initialBackData,initialCardWidth=85.6,initialCardHeight=53.98,onSave,onCancel,fontOptions=SYSTEM_FONTS,missingFonts=[],getFonts,onLoadFont}:Props){
  const [name,setName]=useState(initialName),[width,setWidth]=useState(initialCardWidth),[height,setHeight]=useState(initialCardHeight)
  const [side,setSide]=useState<'front'|'back'>('front'),[sessions,setSessions]=useState<{front:SceneSession;back:SceneSession}|null>(null)
  const [revision,setRevision]=useState(0),[error,setError]=useState<string|null>(null),[message,setMessage]=useState(''),[grid,setGrid]=useState(true),[zoom,setZoom]=useState(1.8),[preview,setPreview]=useState(false),[previewSvg,setPreviewSvg]=useState('')
  const frontElement=useRef<HTMLCanvasElement>(null),backElement=useRef<HTMLCanvasElement>(null)
  const initial=useRef({initialFrontData,initialBackData,initialCardWidth,initialCardHeight})
  const disposal=useRef<Promise<unknown>>(Promise.resolve())
  const session=sessions?.[side]??null
  const selected=session?.canvas.getActiveObjects()??[]
  const object=selected.length===1?selected[0]:null
  const run=(action:()=>void|Promise<unknown>)=>{setError(null);try{Promise.resolve(action()).catch(reason=>setError(reason instanceof Error?reason.message:String(reason)))}catch(reason){setError(reason instanceof Error?reason.message:String(reason))}}

  useEffect(()=>{
    let cancelled=false
    let owned:{front:SceneSession;back:SceneSession}|undefined
    const unsubscribers:Array<()=>void>=[]
    void (async()=>{
      await disposal.current
      if(cancelled||!frontElement.current||!backElement.current)return
      const options={width:initial.current.initialCardWidth*PX_PER_MM,height:initial.current.initialCardHeight*PX_PER_MM,backgroundColor:'#ffffff',preserveObjectStacking:true}
      owned={front:new SceneSession(new Canvas(frontElement.current,options)),back:new SceneSession(new Canvas(backElement.current,options))}
      for(const value of Object.values(owned))unsubscribers.push(value.subscribe(()=>{if(!cancelled)setRevision(current=>current+1)}))
      await Promise.all([owned.front.load(initial.current.initialFrontData),owned.back.load(initial.current.initialBackData)])
      if(!cancelled)setSessions(owned)
    })().catch(reason=>{if(!cancelled)setError(reason instanceof Error?reason.message:String(reason))})
    return ()=>{cancelled=true;unsubscribers.forEach(unsubscribe=>unsubscribe());if(owned){owned.front.dispose();owned.back.dispose();disposal.current=Promise.all([owned.front.canvas.dispose(),owned.back.canvas.dispose()])}}
  },[])

  useEffect(()=>{
    if(!sessions)return
    for(const current of Object.values(sessions)){current.canvas.setDimensions({width:width*PX_PER_MM,height:height*PX_PER_MM});current.canvas.requestRenderAll()}
  },[sessions,width,height])

  useEffect(()=>{
    if(!session)return
    const key=(event:KeyboardEvent)=>{
      if(isEditingText(event,session.canvas)||session.busy)return
      const mod=event.ctrlKey||event.metaKey
      if(mod&&event.key.toLowerCase()==='z'){event.preventDefault();void(event.shiftKey?session.redo():session.undo()).catch(reason=>setError(String(reason)))}
      else if(mod&&event.key.toLowerCase()==='y'){event.preventDefault();void session.redo().catch(reason=>setError(String(reason)))}
      else if(mod&&event.key.toLowerCase()==='d'){event.preventDefault();void session.duplicate().catch(reason=>setError(String(reason)))}
      else if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();session.removeSelection()}
    }
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)
  },[session])

  useEffect(()=>{
    if(!session||!preview)return
    let cancelled=false
    void (async()=>{
      await document.fonts.ready
      const parsed=await parseTemplateString(fabricCanvasToSvg(session.canvas,width,height))
      const objects=new Map<string,FabricObject>()
      const visit=(item:FabricObject)=>{objects.set(objectId(item),item);if(item instanceof Group)item.getObjects().forEach(visit)}
      session.canvas.getObjects().forEach(visit)
      const values:CardData={}
      for(const field of parsed.autoFields){
        const item=objects.get((field.sourceId??'').replace(/-field$/,''));if(!item)continue
        const data=nodeData(item),photo=data.imagePlaceholderConfig
        if(field.type==='image'&&photo?.sampleSrc)values[field.id]={src:photo.sampleSrc,fit:photo.fitMode,scale:photo.scale,offsetX:photo.offsetX,offsetY:photo.offsetY}
        else if(field.type==='barcode')values[field.id]='123456789012'
        else if(typeof item.get('text')==='string')values[field.id]=item.get('text') as string
      }
      const svg=renderSvgWithData(parsed.metadata,parsed.autoFields,values)
      URL.revokeObjectURL(parsed.metadata.objectUrl)
      if(!cancelled)setPreviewSvg(svg)
    })().catch(reason=>{if(!cancelled)setError(String(reason))})
    return()=>{cancelled=true}
  },[session,revision,preview,width,height])

  const downloadPackage=async()=>{
    if(!sessions)return
    const makeSide=async(current:SceneSession,label:string)=>{const parsed=await parseTemplateString(fabricCanvasToSvg(current.canvas,width,height),name+' '+label);URL.revokeObjectURL(parsed.metadata.objectUrl);return{template:parsed.metadata,fields:parsed.autoFields,mappings:generateAutoMappings(parsed.autoFields)}}
    const front=await makeSide(sessions.front,'front'),back=sessions.back.canvas.getObjects().length?await makeSide(sessions.back,'back'):undefined
    const result=await createTemplatePackage({name,front,back,availableFonts:await getFonts?.()??[],editor:{version:1,widthMm:width,heightMm:height,front:sessions.front.snapshot(false),back:sessions.back.snapshot(false)}})
    const url=URL.createObjectURL(result.blob),link=document.createElement('a');link.href=url;link.download=packageFileName(name);link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
    setMessage('Editable package saved with SVG fallbacks. Reference images were excluded.')
  }
  const openPackage=async(file:File)=>{
    if(!sessions)return
    const loaded=await readTemplatePackage(file)
    if(!loaded.editor)throw new Error('This is an SVG template package, not an editable canvas package. Open it in Import mode to edit its fields, or import its SVG as vector artwork here.')
    for(const font of loaded.fonts)await onLoadFont?.(font.name,font.file)
    setName(loaded.manifest.name);setWidth(loaded.editor.widthMm);setHeight(loaded.editor.heightMm)
    await sessions.front.load(loaded.editor.front);await sessions.back.load(loaded.editor.back)
    setSide('front');setMessage('Editable package restored, including fields, layers, photo settings and transforms.')
  }
  const save=()=>{if(sessions)onSave({name,frontCanvasData:sessions.front.snapshot(),backCanvasData:sessions.back.snapshot(),cardWidth:width,cardHeight:height})}
  const addShape=(kind:string)=>{
    if(!session)return
    const common={left:24,top:24,originX:'left' as const,originY:'top' as const,fill:'#a6b3bd',strokeWidth:0}
    const shape=kind==='circle'?new Circle({...common,radius:28}):kind==='line'?new Line([0,0,100,0],{...common,stroke:'#111827',strokeWidth:2}):new Rect({...common,width:100,height:45})
    session.add(shape,{elementType:kind})
  }
  const reference=session?.reference
  const modifyReference=(patch:Partial<NonNullable<typeof reference>>)=>{if(session&&reference)run(()=>session.setReference({...reference,...patch}))}
  return <div className="scene-editor" data-testid="card-designer">
    <header className="scene-header">
      <label className="scene-name"><span>Design</span><input aria-label="Design name" value={name} onChange={event=>setName(event.target.value)}/></label>
      <div className="scene-side-switch" aria-label="Card side">{(['front','back'] as const).map(value=><button key={value} type="button" aria-pressed={side===value} onClick={()=>{session?.canvas.discardActiveObject();setSide(value)}}>{value==='front'?'Front':'Back'}</button>)}</div>
      <button type="button" onClick={onCancel}>Cancel</button><button type="button" className="scene-primary" disabled={!sessions||session?.busy||!name.trim()} onClick={save}>Save Design</button>
    </header>
    <div className="scene-toolbar" aria-label="Design tools">
      <button type="button" disabled={!session||session.busy} onClick={()=>session?.addText()}>Text</button>
      <button type="button" disabled={!session||session.busy} onClick={()=>session?.addText(true)}>Variable text</button>
      <button type="button" disabled={!session||session.busy} onClick={()=>session?.addPhoto()}>Photo frame</button>
      {['rectangle','circle','line'].map(kind=><button key={kind} type="button" disabled={!session||session.busy} onClick={()=>addShape(kind)}>{kind[0].toUpperCase()+kind.slice(1)}</button>)}
      <button type="button" disabled={!session||session.busy} onClick={()=>session?.addBarcode('code128')}>Barcode</button>
      <button type="button" disabled={!session||session.busy} onClick={()=>session?.addBarcode('qrcode')}>QR code</button>
      <label className="scene-file-button">Import artwork<input aria-label="Import artwork" type="file" accept=".svg,image/png,image/jpeg,image/webp,image/gif" disabled={!session||session.busy} onChange={event=>{const file=event.target.files?.[0];if(file&&session)run(()=>session.importAsset(file));event.target.value=''}}/></label>
      <span className="scene-divider"/>
      <button type="button" disabled={!session?.canUndo} onClick={()=>run(()=>session?.undo())}>Undo</button><button type="button" disabled={!session?.canRedo} onClick={()=>run(()=>session?.redo())}>Redo</button>
      <button type="button" disabled={!selected.length||session?.busy} onClick={()=>run(()=>session?.duplicate())}>Duplicate</button>
      <button type="button" disabled={selected.length<2||session?.busy} onClick={()=>session?.group()}>Group</button>
      <button type="button" disabled={!(object instanceof Group)||session?.busy} onClick={()=>session?.ungroup()}>Ungroup</button>
      <button type="button" disabled={!selected.length||session?.busy} onClick={()=>session?.removeSelection()}>Delete</button>
    </div>
    {error&&<div role="alert" className="scene-error">{error}</div>}
    {message&&<div role="status" className="scene-notice">{message}</div>}
    <div className="scene-workspace">
      <aside className="scene-layers">
        <h2>Layers</h2><p className="scene-muted">Top of this list prints on top. Shift-click on the canvas to select multiple objects.</p>
        <div className="scene-layer-list">{session&&[...session.canvas.getObjects()].reverse().map(layer=><div className="scene-layer" key={objectId(layer)} data-selected={selected.includes(layer)}>
          <button type="button" className="scene-layer-title" disabled={nodeData(layer).locked} onClick={()=>{session.canvas.setActiveObject(layer);session.canvas.requestRenderAll();setRevision(value=>value+1)}}>{nodeData(layer).name??nodeData(layer).fieldId??nodeData(layer).elementType}</button>
          <div className="scene-layer-actions"><button type="button" aria-label={'Toggle visibility '+objectId(layer)} onClick={()=>session.update(layer,{visible:!layer.visible})}>{layer.visible?'Hide':'Show'}</button><button type="button" aria-label={'Toggle lock '+objectId(layer)} onClick={()=>session.lock(layer,!nodeData(layer).locked)}>{nodeData(layer).locked?'Unlock':'Lock'}</button><button type="button" title="Move up" onClick={()=>session.moveLayer(layer,1)}>↑</button><button type="button" title="Move down" onClick={()=>session.moveLayer(layer,-1)}>↓</button></div>
        </div>)}</div>
        {!session?.canvas.getObjects().length&&<p className="scene-muted">Add a text field, shape or vector asset to begin.</p>}
        <fieldset><legend>Reference — never printed</legend>
          <label className="scene-control"><span>Reference image</span><input aria-label="Reference image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={!session||session.busy} onChange={event=>{const file=event.target.files?.[0];if(file&&session)run(()=>session.importReference(file));event.target.value=''}}/></label>
          {reference&&<><label className="scene-check"><input type="checkbox" checked={reference.visible} onChange={event=>modifyReference({visible:event.target.checked})}/>Show reference overlay</label>
            <NumberControl label="Reference opacity (%)" value={reference.opacity*100} min={0} max={100} step={1} onChange={value=>modifyReference({opacity:value/100})}/>
            <div className="scene-two-columns"><NumberControl label="Reference X (mm)" value={reference.x/PX_PER_MM} onChange={value=>modifyReference({x:value*PX_PER_MM})}/><NumberControl label="Reference Y (mm)" value={reference.y/PX_PER_MM} onChange={value=>modifyReference({y:value*PX_PER_MM})}/><NumberControl label="Reference width (mm)" value={reference.width/PX_PER_MM} min={1} onChange={value=>modifyReference({width:value*PX_PER_MM})}/><NumberControl label="Reference height (mm)" value={reference.height/PX_PER_MM} min={1} onChange={value=>modifyReference({height:value*PX_PER_MM})}/></div>
            <NumberControl label="Reference angle" value={reference.angle} step={1} onChange={value=>modifyReference({angle:value})}/>
            <button type="button" onClick={()=>run(()=>session?.setReference(undefined))}>Remove reference</button>
          </>}
          <p className="scene-muted">Saved locally with the design; excluded from SVG, PDF and shareable packages. Four-corner perspective correction is not applied.</p>
        </fieldset>
      </aside>
      <main className="scene-main">
        <div className="scene-view-tools"><label className="scene-check"><input type="checkbox" checked={grid} onChange={event=>setGrid(event.target.checked)}/>Grid</label><label className="scene-check"><input aria-label="Data preview" type="checkbox" checked={preview} onChange={event=>setPreview(event.target.checked)}/>Data preview</label><NumberControl label="Zoom (%)" value={zoom*100} min={50} max={300} step={10} onChange={value=>setZoom(value/100)}/></div>
        <div className="scene-canvas-scroll" style={grid?{backgroundImage:'linear-gradient(to right,rgba(127,127,127,.12) 1px,transparent 1px),linear-gradient(to bottom,rgba(127,127,127,.12) 1px,transparent 1px)',backgroundSize:'20px 20px'}:{}}>
          {(['front','back'] as const).map(value=><div key={value} className="scene-card-slot" style={{display:side===value&&!preview?'block':'none',width:width*PX_PER_MM*zoom,height:height*PX_PER_MM*zoom}}><div style={{transform:`scale(${zoom})`,transformOrigin:'0 0',width:width*PX_PER_MM,height:height*PX_PER_MM}}><canvas aria-label={value+' design canvas'} ref={value==='front'?frontElement:backElement}/></div></div>)}
          {preview&&<div className="scene-data-preview" style={{width:width*PX_PER_MM*zoom}}><InlineSvg svg={previewSvg}/><p className="scene-muted">Sample-data preview. Reference overlays and grid lines are excluded.</p></div>}
        </div>
        <div className="scene-align-tools"><span>Align:</span>{(['left','center','right','top','middle','bottom','distribute-x','distribute-y'] as const).map(mode=><button key={mode} type="button" disabled={!selected.length||session?.busy} onClick={()=>session?.align(mode)}>{mode.replace('distribute-','Space ')}</button>)}</div>
        <div className="scene-dimensions"><NumberControl label="Card width (mm)" value={width} min={10} max={400} onChange={setWidth}/><NumberControl label="Card height (mm)" value={height} min={10} max={400} onChange={setHeight}/><button type="button" onClick={()=>{setWidth(height);setHeight(width)}}>Swap orientation</button></div>
        <div className="scene-package-tools"><button type="button" disabled={!sessions||session?.busy} onClick={()=>run(downloadPackage)}>Download editable package</button><label className="scene-file-button">Open editable package<input aria-label="Open editable package" type="file" accept=".zip" disabled={!sessions||session?.busy} onChange={event=>{const file=event.target.files?.[0];if(file)run(()=>openPackage(file));event.target.value=''}}/></label></div>
      </main>
      <aside className="scene-properties"><h2>Properties</h2>{selected.length>1?<p className="scene-muted">{selected.length} layers selected. Group, duplicate, align or distribute them using the toolbar.</p>:session&&<SceneInspector session={session} object={object} fontOptions={Array.from(new Set([...SYSTEM_FONTS,...fontOptions]))} missingFonts={missingFonts} onError={setError}/>}</aside>
    </div>
  </div>
}
