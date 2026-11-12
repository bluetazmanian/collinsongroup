// Render the canonical sequences and PNG previews without browser network access.
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const diagrams=path.join(here,'../diagrams');
const selected=process.argv.slice(2);
const wants=name=>!selected.length||selected.includes(name);
const bundle=await build({stdin:{contents:"import mermaid from 'mermaid'; window.diagramMermaid=mermaid;",resolveDir:here},bundle:true,write:false,format:'iife',platform:'browser',logLevel:'silent'});
const browser=await chromium.launch({headless:true,...(process.env.DESIGN_CHROMIUM_PATH?{executablePath:process.env.DESIGN_CHROMIUM_PATH}:{}),args:['--no-sandbox']});
try{
 const page=await browser.newPage();
 await page.route(/^https?:/,r=>r.abort());
 await page.setContent('<html><body></body></html>');
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.evaluate(()=>window.diagramMermaid.initialize({startOnLoad:false,theme:'base',securityLevel:'strict',fontFamily:'Arial, sans-serif',themeVariables:{fontSize:'19px',primaryColor:'#dbe6fd',primaryBorderColor:'#9db4ee',primaryTextColor:'#111827',lineColor:'#4b5563',actorBkg:'#ffffff',actorBorder:'#4b5563',actorTextColor:'#111827',noteBkgColor:'#ffffff',noteBorderColor:'#d1d5db',noteTextColor:'#4b5563',signalColor:'#4b5563',signalTextColor:'#111827'},sequence:{useMaxWidth:false,diagramMarginX:40,diagramMarginY:35,actorMargin:95,width:240,height:75,messageMargin:52,noteMargin:24,boxMargin:20,mirrorActors:false,wrap:true}}));
 for(const name of ['recommendation-sequence','catalogue-refresh-sequence'].filter(wants)){
  const src=fs.readFileSync(path.join(diagrams,name+'.mmd'),'utf8');
  const svg=await page.evaluate(async({src,name})=>{await window.diagramMermaid.parse(src);return(await window.diagramMermaid.render(name,src)).svg},{src,name});
  fs.writeFileSync(path.join(diagrams,name+'.svg'),svg);
 }
 for(const file of fs.readdirSync(diagrams).filter(f=>f.endsWith('.svg')&&wants(f.slice(0,-4)))){
  await page.setContent('<html><body style="margin:0">'+fs.readFileSync(path.join(diagrams,file),'utf8')+'</body></html>');
  await page.evaluate(()=>document.fonts.ready);
  const size=await page.evaluate(()=>{const v=document.querySelector('svg').viewBox.baseVal;return{w:Math.ceil(v.width),h:Math.ceil(v.height)}});
  await page.setViewportSize({width:size.w,height:size.h});
  await page.addStyleTag({content:'html,body{margin:0}svg{display:block;width:100%;height:auto}'});
  await page.screenshot({path:path.join(diagrams,file.replace(/\.svg$/,'.png')),fullPage:true});
  console.log('Rendered',file,size.w+'x'+size.h);
 }
}finally{await browser.close()}
