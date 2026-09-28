/** Tests the real importer/renderer; text measurement is deterministic, not a visual fidelity test. */
import assert from 'node:assert/strict'
import { register } from 'node:module'
register('./ts-resolver.mjs',import.meta.url)
const { DOMParser,parseHTML }=await import('linkedom')
const {document:html}=parseHTML('<html><body></body></html>')
globalThis.DOMParser=DOMParser
globalThis.XMLSerializer=class{serializeToString(node){return node.toString()}}
globalThis.SVGElement=class{static [Symbol.hasInstance](v){return Boolean(v&&typeof v.closest==='function')}}
globalThis.document={createElement(tag){if(tag!=='canvas')return html.createElement(tag);const context={font:'16px Arial',measureText(text){return {width:text.length*parseFloat(this.font.match(/([\d.]+)px/)?.[1]||'16')*0.55}}};return {getContext:()=>context}}}
const {parseTemplateString,renderSvgWithData,parseUnit,toPercent}=await import('../src/lib/svgTemplate.ts')
const {generateAutoMappings}=await import('../src/lib/autoMapping.ts')
const {svgTransform,multiply}=await import('../src/lib/cardRecreation.ts')
let count=0
async function check(name,fn){await fn();count++;console.log('  ok '+name)}
const svg=body=>`<svg xmlns="http://www.w3.org/2000/svg" width="85.6mm" height="53.98mm" viewBox="0 0 856 539.8">${body}</svg>`
const parse=body=>parseTemplateString(svg(body)),doc=markup=>new DOMParser().parseFromString(markup,'image/svg+xml')
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`)
await check('root viewBox midpoint, not physical width',async()=>{const r=await parse('<text id="firstName" x="428" y="100">Sample</text>');near(r.autoFields[0].x,50)})
await check('zero coordinate remains zero',async()=>{const r=await parse('<text id="firstName" x="0" y="0">Sample</text>');near(r.autoFields[0].x,0);near(r.autoFields[0].y,0)})
await check('off-card coordinates remain editable',async()=>{const r=await parse('<text id="firstName" x="-85.6" y="0">Sample</text>');near(r.autoFields[0].x,-10)})
await check('nonzero viewBox origin',async()=>{const r=await parseTemplateString('<svg width="100mm" height="50mm" viewBox="100 200 1000 500"><text id="firstName" x="600" y="450">Sample</text></svg>');near(r.autoFields[0].x,50);near(r.autoFields[0].y,50)})
await check('points convert to physical millimetres',()=>{near(parseUnit('72pt').numeric,25.4);assert.equal(parseUnit('72pt').unit,'mm')})
await check('inches convert to physical millimetres',()=>near(parseUnit('1in').numeric,25.4))
await check('centimetres and picas convert',()=>{near(parseUnit('2.54cm').numeric,25.4);near(parseUnit('6pc').numeric,25.4)})
await check('invalid units are not silently pixels',()=>assert.equal(parseUnit('4em').numeric,undefined))
await check('percentage helper preserves zero and negatives',()=>{near(toPercent(0,100,10),0);near(toPercent(-5,100,10),-5)})
await check('nested transform chain normalizes fields',async()=>{const r=await parseTemplateString('<svg width="100px" height="100px" viewBox="0 0 100 100"><g transform="translate(10 20)"><g transform="scale(2)"><text id="firstName" x="5" y="10">Sample</text></g></g></svg>');near(r.autoFields[0].x,20);near(r.autoFields[0].y,40)})
await check('matrix composition and rotation about origin',()=>{const a=svgTransform('translate(10 20) scale(2)');assert.deepEqual(a,[2,0,0,2,10,20]);const b=svgTransform('rotate(180 10 20)');near(b[4],20);near(b[5],40);assert.deepEqual(multiply([1,0,0,1,0,0],a),a)})
await check('metadata attribute order is irrelevant',async()=>{const r=await parse('<text id="name-object" data-field-type="text" class="label" data-field-id="name" data-field-source="firstName" x="10" y="20">Sample</text>');assert.equal(r.autoFields.length,1);assert.equal(r.autoFields[0].dataSource,'firstName');assert.equal(generateAutoMappings(r.autoFields)[0].standardFieldName,'firstName')})
await check('explicit placeholders merge with legacy photos',async()=>{const r=await parse('<text id="{{field:firstName}}" x="10" y="20">Sample</text><rect id="photo" x="50" y="50" width="120" height="150"/>');assert.equal(r.autoFields.length,2);assert.equal(r.autoFields.filter(f=>f.type==='image').length,1)})
await check('static artwork is not bound',async()=>{const r=await parse('<g data-static="true"><text id="firstName" x="0" y="20">WORDMARK</text></g><text id="lastName" x="0" y="40">Sample</text>');assert.equal(r.autoFields.length,1);assert.equal(r.autoFields[0].sourceId,'lastName')})
await check('group and child photo are one field',async()=>{const r=await parse('<g id="photo"><rect id="photo-frame" x="5" y="10" width="30" height="40"/></g>');assert.equal(r.autoFields.length,1)})
await check('required missing data blocks only production',async()=>{const r=await parse('<text id="name" data-field-id="firstName" data-field-type="text" data-field-required="true" x="0" y="20">SAMPLE</text>');assert.throws(()=>renderSvgWithData(r.metadata,r.autoFields,{}, {mode:'production'}),/required/);assert.match(renderSvgWithData(r.metadata,r.autoFields,{}),/SAMPLE/)})
await check('explicit empty optional data clears sample',async()=>{const r=await parse('<text id="firstName" x="0" y="20">SAMPLE</text>');const f=r.autoFields[0];assert.equal(doc(renderSvgWithData(r.metadata,r.autoFields,{[f.id]:''})).getElementById('firstName').textContent,'')})
await check('absent production data never leaks sample',async()=>{const r=await parse('<text id="firstName" x="0" y="20">SAMPLE</text>');assert.equal(doc(renderSvgWithData(r.metadata,r.autoFields,{}, {mode:'production'})).getElementById('firstName').textContent,'')})
await check('production keeps unbound static artwork',async()=>{const r=await parse('<text id="wordmark" x="0" y="20">INSTITUTE</text>');assert.match(renderSvgWithData(r.metadata,r.autoFields,{}, {mode:'production'}),/INSTITUTE/)})
await check('rect photo replacement has clipped image',async()=>{const r=await parse('<rect id="photo" x="10" y="20" width="100" height="120"/>');const out=doc(renderSvgWithData(r.metadata,r.autoFields,{[r.autoFields[0].id]:{src:'data:image/png;base64,AA==',scale:1.5,offsetX:0.1,fit:'contain'}}));assert.ok(out.querySelector('clipPath'));assert.equal(out.querySelector('image').getAttribute('preserveAspectRatio'),'xMidYMid meet');assert.equal(out.querySelector('image').getAttribute('width'),'150')})
await check('invalid viewBox rejected',()=>assert.rejects(()=>parseTemplateString('<svg viewBox="0 0 0 200"/>'),/viewBox/))
await check('reference excluded from rendered SVG',async()=>{const r=await parse('<image data-editor-only="true" href="reference.png"/><text id="firstName">SAMPLE</text>');assert.doesNotMatch(renderSvgWithData(r.metadata,r.autoFields,{}),/reference.png/)})
await check('explicit text metadata supersedes its legacy placeholder wrapper',async()=>{const r=await parse('<g id="{{field:firstName}}"><text id="name-object" data-field-id="firstName" data-field-type="text" data-field-source="firstName" x="10" y="20">Sample</text></g>');assert.equal(r.autoFields.length,1);assert.equal(r.autoFields[0].sourceId,'name-object')})
console.log(`\n${count} card-recreation integration checks passed.`)
