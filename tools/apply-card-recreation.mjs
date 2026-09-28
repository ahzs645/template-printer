import fs from 'node:fs'
function edit(file,fn){const old=fs.readFileSync(file,'utf8'),next=fn(old);if(old!==next)fs.writeFileSync(file,next)}
function once(source,oldText,newText){if(source.includes(newText))return source;if(!source.includes(oldText))throw new Error('Missing patch anchor: '+oldText.slice(0,150));return source.replace(oldText,newText)}
edit('frontend/src/lib/templatePackage.ts',s=>{
 if(!s.includes("from './editorDocument'"))s="import { portableEditorJson, readEditorDocument, type PackagedEditor } from './editorDocument'\n"+s
 s=once(s,'export type TemplatePackageManifest = {','export type TemplatePackageManifest = {\n  editor?: PackagedEditor')
 s=once(s,'export type CreatePackageInput = {','export type CreatePackageInput = {\n  editor?: PackagedEditor')
 s=once(s,'export type LoadedPackage = {','export type LoadedPackage = {\n  editor?: PackagedEditor')
 s=once(s,'  const manifest: TemplatePackageManifest = {',`  let editor: PackagedEditor | undefined
  if (input.editor) {
    if (input.editor.version !== 1 || !Number.isFinite(input.editor.widthMm) || !Number.isFinite(input.editor.heightMm) || input.editor.widthMm <= 0 || input.editor.heightMm <= 0) throw new Error('Invalid editable card dimensions.')
    zip.file('editor/front.json', portableEditorJson(input.editor.front))
    if (input.editor.back) zip.file('editor/back.json', portableEditorJson(input.editor.back))
    editor = {...input.editor, front: 'editor/front.json', back: input.editor.back ? 'editor/back.json' : undefined}
  }
  const manifest: TemplatePackageManifest = {`)
 s=once(s,'    format: PACKAGE_FORMAT,','    editor,\n    format: PACKAGE_FORMAT,')
 s=once(s,'  return { manifest, front, back: await readSide(manifest.sides.back), fonts }',`  let editor: PackagedEditor | undefined
  if (manifest.editor) {
    const meta = manifest.editor
    if (meta.version !== 1 || !Number.isFinite(meta.widthMm) || !Number.isFinite(meta.heightMm) || meta.widthMm <= 0 || meta.heightMm <= 0) throw new Error('Invalid editable card dimensions.')
    const readScene = async (path: string) => {
      const entry = zip.file(path)
      if (!entry) throw new Error('The editable package is missing '+path)
      const json = await entry.async('string')
      readEditorDocument(json)
      return json
    }
    editor = {...meta, front: await readScene(meta.front), back: meta.back ? await readScene(meta.back) : undefined}
  }
  return { manifest, front, back: await readSide(manifest.sides.back), fonts, editor }`)
 return s
})
edit('frontend/src/App.tsx',s=>{
 s=once(s,'              <CardDesignerTab\n','              <CardDesignerTab\n                fontOptions={fontOptions}\n                missingFonts={missingFonts}\n                getFonts={() => storage.listFonts()}\n                onLoadFont={loadFontFile}\n')
 s=once(s,'    if (backTemplate) {\n      const design = await createCardDesign({','    if (backTemplate || loaded.editor) {\n      const design = await createCardDesign({')
 s=once(s,'        backTemplateId: backTemplate.id,\n      })',`        backTemplateId: backTemplate?.id ?? null,
        ...(loaded.editor ? {designerMode: 'canvas' as const, frontCanvasData: loaded.editor.front, backCanvasData: loaded.editor.back ?? null, cardWidth: loaded.editor.widthMm, cardHeight: loaded.editor.heightMm} : {}),
      })`)
 s=once(s,'      setOtherSidePreview({ name: backTemplate.name, svg: loaded.back!.svg })','      setOtherSidePreview(backTemplate && loaded.back ? { name: backTemplate.name, svg: loaded.back.svg } : null)')
 return s
})
edit('frontend/src/components/card-designer/CardDesignerTab.tsx',s=>{
 if(!s.includes("from './utils/svgToScene'"))s="import { importPackageSide } from './utils/svgToScene'\n"+s
 s=once(s,'<InlineSvg svg={previewSvg}/>','<InlineSvg markup={previewSvg} name="designer-data-preview"/>')
 s=once(s,"    if(!loaded.editor)throw new Error('This is an SVG template package, not an editable canvas package. Open it in Import mode to edit its fields, or import its SVG as vector artwork here.')",`    if (!loaded.editor) {
      for (const font of loaded.fonts) await onLoadFont?.(font.name, font.file)
      const size = await importPackageSide(sessions.front, loaded.front)
      if (loaded.back) await importPackageSide(sessions.back, loaded.back)
      else await sessions.back.load(null)
      setName(loaded.manifest.name); setWidth(size.widthMm); setHeight(size.heightMm); setSide('front')
      setMessage('SVG package converted to editable vector objects. Declared fields are preserved. Compare complex masks and typography against the original before printing.')
      return
    }`)
 return s
})
edit('frontend/src/components/card-designer/utils/sceneSession.ts',s=>once(s,'layout?: {maxLines?: number; minFontSize?: number}','layout?: {maxLines?: number; minFontSize?: number; wrapWidth?: number}'))
edit('frontend/src/components/card-designer/utils/fabricToSvg.ts',s=>once(s,"target.setAttribute('data-field-width',String(object.width))","target.setAttribute('data-field-width',String(data.layout?.wrapWidth??object.width))"))
edit('frontend/src/components/card-designer/SceneInspector.tsx',s=>{
 s=once(s,'value={fontSize*72/96} min={1} onChange={value=>set(\'fontSize\',value*96/72)}','value={fontSize*Math.abs(object.scaleY)*72/96} min={1} onChange={value=>set(\'fontSize\',value*96/72/Math.abs(object.scaleY))}')
 return s
})
edit('frontend/src/lib/svgTemplate.ts',s=>{
 s=once(s,'function applySvgImageField(doc: Document, element: Element, value: ImageValue | undefined) { replaceCardImage(doc,element,value) }',`function applySvgImageField(doc: Document, element: Element, value: ImageValue | undefined) {
  if (!value) return
  const fit = element.getAttribute('data-photo-fit')
  replaceCardImage(doc,element,{
    scale: Number(element.getAttribute('data-photo-scale')) || 1,
    offsetX: Number(element.getAttribute('data-photo-x')) || 0,
    offsetY: Number(element.getAttribute('data-photo-y')) || 0,
    fit: fit === 'contain' || fit === 'fill' ? fit : 'cover',
    ...Object.fromEntries(Object.entries(value).filter(([,value]) => value !== undefined)),
    src: value.src,
  })
}`)
 s=once(s,'  const heightScale = (explicitHeight ?? targetHeight) / barcode.height\n  const scaleX = targetWidth !== undefined ? targetWidth / barcode.width : heightScale\n  const scaleY = heightScale',`  const localWidth = readNumeric(element.getAttribute('data-barcode-width')) ?? targetWidth
  const localHeight = readNumeric(element.getAttribute('data-barcode-height')) ?? explicitHeight ?? targetHeight
  const heightScale = localHeight / barcode.height
  const widthScale = localWidth !== undefined ? localWidth / barcode.width : heightScale
  const scaleX = symbology === 'qrcode' ? Math.min(widthScale, heightScale) : widthScale
  const scaleY = symbology === 'qrcode' ? Math.min(widthScale, heightScale) : heightScale`)
 return s
})
console.log('Integrated editor sessions, controls, SVG conversion and portable editable packages.')
