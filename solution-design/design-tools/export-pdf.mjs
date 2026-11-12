// Export the single proposal. Earlier reference exports are left unchanged.
import {chromium} from 'playwright-core';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const browser=await chromium.launch({headless:true,...(process.env.DESIGN_CHROMIUM_PATH?{executablePath:process.env.DESIGN_CHROMIUM_PATH}:{}),args:['--no-sandbox']});
try{
 const page=await browser.newPage();
 await page.route(/^https?:/,r=>r.abort());
 await page.goto(new URL('../solution-design.html',import.meta.url).href,{waitUntil:'load'});
 await page.evaluate(()=>document.fonts.ready);
 const failed=await page.evaluate(()=>[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute('src')));
 if(failed.length)throw new Error('Unloaded diagrams: '+failed.join(', '));
 await page.evaluate(()=>document.querySelectorAll('a[href]').forEach(a=>{if(!a.getAttribute('href').startsWith('#')&&!/^https?:\/\//i.test(a.getAttribute('href')))a.removeAttribute('href')}));
 await page.pdf({path:path.join(root,'solution-design.pdf'),preferCSSPageSize:true,printBackground:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="font-family:Arial;font-size:8px;color:#64748b;width:100%;text-align:center">Airport Trip Planner · <span class="pageNumber"></span> / <span class="totalPages"></span></div>'});
 console.log('Exported solution-design.pdf');
}finally{await browser.close()}
