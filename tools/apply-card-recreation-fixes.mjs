import fs from 'node:fs'
function edit(file,fn){const old=fs.readFileSync(file,'utf8'),next=fn(old);if(old!==next)fs.writeFileSync(file,next)}
function once(source,oldText,newText){if(source.includes(newText))return source;if(!source.includes(oldText))throw new Error('Missing patch anchor: '+oldText.slice(0,150));return source.replace(oldText,newText)}
edit('frontend/src/components/card-designer/utils/fabricToSvg.ts',s=>once(s,'      let target = node','      let target: Element = node'))
edit('frontend/src/components/card-designer/utils/sceneSession.ts',s=>once(s,"    const image = this.canvas.overlayImage?.getSrc() === reference.src ? this.canvas.overlayImage : await FabricImage.fromURL(reference.src)","    const previous = this.canvas.overlayImage\n    const image = previous instanceof FabricImage && previous.getSrc() === reference.src ? previous : await FabricImage.fromURL(reference.src)"))
edit('frontend/src/components/card-designer/CardDesignerTab.tsx',s=>{
 s=once(s,"  const reference=session?.reference",`  const [snap,setSnap]=useState(false)
  useEffect(()=>{
    if(!session||!snap)return
    const moving=(event:{target:FabricObject})=>{
      const item=event.target
      if(nodeData(item).locked)return
      item.set({left:Math.round(item.left/PX_PER_MM)*PX_PER_MM,top:Math.round(item.top/PX_PER_MM)*PX_PER_MM})
    }
    session.canvas.on('object:moving',moving)
    return()=>{session.canvas.off('object:moving',moving)}
  },[session,snap])
  const openSpecimen=async(kind:string)=>{
    if(session?.canvas.getObjects().length&&!window.confirm('Replace the open canvas with this specimen? Save the current design first to keep it.'))return
    const response=await fetch(import.meta.env.BASE_URL+'card-specimens/'+kind+'-specimen.template-printer.zip')
    if(!response.ok)throw new Error('The bundled specimen could not be loaded.')
    await openPackage(new File([await response.blob()],kind+'.zip',{type:'application/zip'}))
  }
  const reference=session?.reference`)
 s=once(s,'<h2>Layers</h2><p className="scene-muted">',`<fieldset><legend>Recreation specimens</legend><div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{['mit','stanford','harvard'].map(kind=><button type="button" key={kind} disabled={!sessions||session?.busy} onClick={()=>run(()=>openSpecimen(kind))}>{kind==='mit'?'MIT':kind[0].toUpperCase()+kind.slice(1)} specimen</button>)}</div><p className="scene-muted">Anonymous, labelled test layouts. Logos and hidden reference regions are schematic, not official credentials.</p></fieldset>
        <h2>Layers</h2><p className="scene-muted">`)
 s=once(s,'/>Grid</label><label className="scene-check">','/>Grid</label><label className="scene-check"><input type="checkbox" checked={snap} onChange={event=>setSnap(event.target.checked)}/>Snap (1 mm)</label><label className="scene-check">')
 return s
})
console.log('Applied SVG DOM type fixes, safe Fabric image narrowing, snapping and bundled specimens.')
