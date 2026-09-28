/** One-time idempotent integration on the review branch; never runs in the app. */
import fs from 'node:fs'
import ts from '../frontend/node_modules/typescript/lib/typescript.js'
function edit(file,fn){const original=fs.readFileSync(file,'utf8'),result=fn(original);if(result!==original)fs.writeFileSync(file,result)}
function once(source,oldText,newText){if(source.includes(newText))return source;if(!source.includes(oldText))throw new Error('Missing patch anchor: '+oldText.slice(0,160));return source.replace(oldText,newText)}
function func(source,name,replacement){const ast=ts.createSourceFile('file.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),node=ast.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text===name);if(!node)throw new Error('Missing function '+name);return source.slice(0,node.getStart(ast))+replacement+source.slice(node.end)}
edit('frontend/src/lib/types.ts',s=>{
 s=once(s,"export type ImageValue = {\n  src: string","export type ImageValue = {\n  fit?: 'cover' | 'contain' | 'fill'\n  src: string")
 return once(s,"export type FieldDefinition = {\n  id: string","export type FieldDefinition = {\n  dataSource?: string\n  required?: boolean\n  maxLines?: number\n  minFontSize?: number\n  letterSpacing?: number\n  id: string")
})
edit('frontend/src/lib/svgTemplate.ts',s=>{
 if(!s.includes("from './cardRecreation'"))s="import { parseAbsoluteSvgLength, coordinatePercent, normalizeCardFields, isBoundField, hasCardValue, validateProductionCard, replaceCardImage } from './cardRecreation'\n"+s
 s=func(s,'parseUnit',`export function parseUnit(value: string | null | undefined): { numeric?: number; unit?: 'mm' | 'px' } { return parseAbsoluteSvgLength(value) }`)
 s=func(s,'toPercent',`export function toPercent(value: number | undefined, total: number | undefined, fallback: number): number { return coordinatePercent(value,total,fallback) }`)
 s=func(s,'parseTemplateString',`export async function parseTemplateString(rawSvg: string, fileName = 'template.svg'): Promise<TemplateExtractionResult> {
  const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml')
  const svgNode = doc.querySelector('svg')
  if (!svgNode || doc.querySelector('parsererror')) throw new Error('Uploaded file does not contain valid SVG.')
  const widthInfo = parseUnit(svgNode.getAttribute('width'))
  const heightInfo = parseUnit(svgNode.getAttribute('height'))
  const numbers = svgNode.getAttribute('viewBox')?.trim().split(/[\\s,]+/).map(Number)
  if (numbers && (numbers.length !== 4 || numbers.some(n => !Number.isFinite(n)) || numbers[2] <= 0 || numbers[3] <= 0)) throw new Error('The SVG viewBox must have finite coordinates and positive dimensions.')
  const viewBox = numbers ? {x:numbers[0],y:numbers[1],width:numbers[2],height:numbers[3]} : undefined
  const unit: 'mm' | 'px' = widthInfo.unit === 'mm' || heightInfo.unit === 'mm' ? 'mm' : 'px'
  const convert = (value: typeof widthInfo, fallback: number) => value.numeric !== undefined ? value.numeric * (unit === 'mm' && value.unit === 'px' ? 25.4 / 96 : 1) : fallback * (unit === 'mm' ? 25.4 / 96 : 1)
  const width = convert(widthInfo, viewBox?.width ?? 85.6*96/25.4)
  const height = convert(heightInfo, viewBox?.height ?? 53.98*96/25.4)
  if (width <= 0 || height <= 0) throw new Error('The SVG must have a positive width and height.')
  const fonts = extractFontFamilies(doc), warnings = collectTemplateWarnings(doc, fonts)
  const canvasBox = viewBox ?? {x:0,y:0,width:width*(unit==='mm'?96/25.4:1),height:height*(unit==='mm'?96/25.4:1)}
  const trimCandidates = detectTrimCandidates(doc,canvasBox).filter(candidate=>isWorthSuggesting(candidate,canvasBox))
  const legacy = [...extractPlaceholders(doc,canvasBox),...extractTextFields(doc,canvasBox),...extractImagePlaceholders(doc,canvasBox)]
  const autoFields = normalizeCardFields(doc,{width,height,unit,viewBox},legacy)
  const normalizedSvg = new XMLSerializer().serializeToString(svgNode)
  const objectUrl = URL.createObjectURL(new Blob([normalizedSvg],{type:'image/svg+xml'}))
  return {metadata:{name:fileName,width,height,unit,rawSvg:normalizedSvg,objectUrl,viewBox,fonts,warnings:warnings.length?warnings:undefined,trimCandidates:trimCandidates.length?trimCandidates:undefined},autoFields}
}`)
 s=func(s,'renderSvgWithData',`export function renderSvgWithData(template: TemplateMeta, fields: FieldDefinition[], cardData: CardData, options: {mode?: 'preview' | 'production'} = {}): string {
  const doc = new DOMParser().parseFromString(template.rawSvg, 'image/svg+xml')
  const svgRoot = doc.documentElement, production = options.mode === 'production'
  if (production) validateProductionCard(fields,cardData)
  bakeCssTextStyles(doc)
  for (const field of fields) {
    if (!field.sourceId) continue
    const target = doc.getElementById(field.sourceId)
    if (!target) continue
    const hasKey = Object.prototype.hasOwnProperty.call(cardData,field.id), supplied = cardData[field.id]
    if (!hasCardValue(supplied) && (hasKey || (production && isBoundField(field))) && !(field.defaultValue?.trim() && !production)) {
      if (field.type === 'image') {
        target.querySelectorAll('image').forEach(image=>image.remove())
        if (target.tagName.toLowerCase() === 'image') {target.removeAttribute('href');target.removeAttribute('xlink:href')}
      } else target.textContent = ''
      continue
    }
    if (field.type === 'image') {applySvgImageField(doc,target,asImageValue(supplied));continue}
    if (field.type === 'barcode') {
      applySvgBarcodeField(doc,target,field,resolveFieldText(field,supplied),{width:template.viewBox?.width??template.width,height:template.viewBox?.height??template.height})
      continue
    }
    if (field.type === 'text' || field.type === 'date') {
      applySvgTextField(doc,target,field,resolveFieldText(field,supplied))
      if (production && field.maxLines && (target.querySelectorAll('tspan').length||1)>field.maxLines) throw new Error('Card export blocked. '+field.label+': text exceeds '+field.maxLines+' lines')
    }
  }
  svgRoot.querySelectorAll('[data-editor-only="true"]').forEach(node=>node.remove())
  return new XMLSerializer().serializeToString(svgRoot)
}`)
 s=func(s,'applySvgImageField',`function applySvgImageField(doc: Document, element: Element, value: ImageValue | undefined) { replaceCardImage(doc,element,value) }`)
 s=once(s,'const effectiveFontSize = originalFontSize ?? field.fontSize ?? 16','const effectiveFontSize = field.fontSize ?? originalFontSize ?? 16')
 s=once(s,'const scale = Math.max(field.wrapWidth / widest, MIN_AUTO_SHRINK_SCALE)','const scale = Math.min(1, Math.max(field.wrapWidth / widest, field.minFontSize ? field.minFontSize / effectiveFontSize : MIN_AUTO_SHRINK_SCALE))')
 s=once(s,"  const anchor = field.align === 'center' ? 'middle' : field.align === 'right' ? 'end' : 'start'","  if (field.letterSpacing !== undefined) element.setAttribute('letter-spacing', String(field.letterSpacing))\n  const anchor = field.align === 'center' ? 'middle' : field.align === 'right' ? 'end' : 'start'")
 return s
})
edit('frontend/src/lib/autoMapping.ts',s=>{s=once(s,'const standardFieldName = resolveStandardFieldName(fieldId)','const standardFieldName = resolveStandardFieldName(field.dataSource || fieldId)');return once(s,'return resolveStandardFieldName(sourceId) !== null','return resolveStandardFieldName(field.dataSource || sourceId) !== null')})
edit('frontend/src/lib/exporter.ts',s=>once(s,'const svgMarkup = renderSvgWithData(template, fields, cardData)',"const svgMarkup = renderSvgWithData(template, fields, cardData, { mode: 'production' })"))
edit('frontend/src/components/FieldEditorPanel.tsx',s=>once(s,"        {field.type === 'barcode' && (",`        <label style={{display:'flex',gap:8,alignItems:'center'}}>
          <input type="checkbox" checked={field.required ?? false} onChange={event=>onChange(field.id,'required',event.target.checked)} />
          Required for production export
        </label>
        {field.type === 'barcode' && (`))
const pkg=JSON.parse(fs.readFileSync('frontend/package.json','utf8'))
if(!pkg.scripts.test.includes('test:card-recreation'))pkg.scripts.test+=' && pnpm run test:card-recreation'
pkg.scripts['test:card-recreation']='node scripts/test-card-recreation.mjs'
fs.writeFileSync('frontend/package.json',JSON.stringify(pkg,null,2)+'\n')
console.log('Card-recreation source integration applied.')
