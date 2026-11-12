"""Render one three-page proposal: infrastructure, backend and frontend."""
from pathlib import Path
import html,re
from markdown_it import MarkdownIt
from diagram import font_css
ROOT=Path(__file__).resolve().parents[1]
md=MarkdownIt('commonmark',{'html':False}).enable('table')
CSS=font_css()+'''
:root{color-scheme:light;--ink:#182735;--line:#d5dfeb}
*{box-sizing:border-box}body{margin:0;background:#edf1f6;color:var(--ink);font:16px/1.45 'Inter',Arial,sans-serif}main{max-width:1240px;margin:24px auto;background:white;padding:32px 40px}h1,h2,h3{font-family:'Space Grotesk',Arial,sans-serif}h1{font-size:30px;line-height:1.15;margin:0 0 14px;color:#173f68}h2{font-size:24px;line-height:1.2;margin:18px 0 8px;color:#173f68}h3{font-size:19px;line-height:1.2;margin:12px 0 7px;color:#173f68}p{margin:0 0 10px}a{color:#1d4ed8}a:focus-visible{outline:2px solid #1d4ed8}code{font-size:.95em}figure{margin:8px 0}figure>a{display:block}figure img{display:block;width:100%;height:auto}table{border-collapse:collapse;width:100%;font-size:14px;line-height:1.35;margin:8px 0 12px}th,td{border:1px solid var(--line);padding:7px 9px;vertical-align:top;text-align:left}th{background:#edf3fc}.sheet+.sheet{border-top:1px solid var(--line);margin-top:24px;padding-top:8px}.source-links{font-size:13px}.decision-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:6mm}.sheet{overflow-wrap:anywhere}.technology-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 20px;margin:8px 0}.technology-grid>div{border-top:1px solid var(--line);padding-top:5px}.technology-grid dt{font-weight:700}.technology-grid dd{margin:3px 0 0;font-size:14px;line-height:1.3}
@media(max-width:750px){main{margin:0;padding:20px 16px}.decision-grid,.technology-grid{display:block}table{font-size:14px}th,td{padding:6px}}
@page{size:A4 landscape;margin:9mm 12mm 13mm}
@media print{body{background:white;font-size:10pt;line-height:1.2}main{max-width:none;margin:0;padding:0}h1{font-size:15pt;margin:0 0 1.5mm}h2{font-size:13pt;margin:1.5mm 0 1mm;break-after:avoid}h3{font-size:10.5pt;margin:1mm 0 1mm;break-after:avoid}p{margin:0 0 1mm}figure{margin:0 0 1.5mm}table{font-size:9.5pt;line-height:1.15;margin:1.5mm 0 2mm}th,td{padding:1mm 1.5mm}th:first-child{width:23%}tr{break-inside:avoid}thead{display:table-header-group}a{color:inherit;text-decoration:none}.source-links{display:none}.technology-grid{gap:1.5mm 6mm;margin:1mm 0 0;font-size:9.5pt;line-height:1.15}.technology-grid>div{padding-top:1mm}.technology-grid dd{font-size:9.5pt;line-height:1.15;margin:0.5mm 0 0}.sheet+.sheet{border:0;margin:0;padding:0;break-before:page}}
'''
def render():
 source=(ROOT/'solution-design.md').read_text()
 parts=re.split(r'(?=^## [123]\. )',source,flags=re.M)
 assert len(parts)==4,'Expected the three numbered architecture views.'
 pages=[parts[0]+parts[1],parts[2],parts[3]]
 seen={}
 def decorate(body):
  def heading(m):
   tag,title=m.groups();plain=html.unescape(re.sub('<[^>]+>','',title));slug=re.sub('[^a-z0-9]+','-',plain.lower()).strip('-');n=seen.get(slug,0);seen[slug]=n+1
   return f'<{tag} id="{slug+("-"+str(n) if n else "")}">{title}</{tag}>'
  body=re.sub(r'<(h[1-6])>(.*?)</\1>',heading,body)
  body=re.sub(r'<p>(<img src="([^\"]+\.svg)"[^>]*>)</p>',r'<figure><a href="\2" aria-label="Open full-size diagram">\1</a></figure>',body)
  return re.sub(r'<p>(.*?)</p>',lambda m:'<p class="source-links">'+m.group(1)+'</p>' if '.excalidraw' in m.group(1) else m.group(0),body,flags=re.S)
 pages=[decorate(md.render(s)) for s in pages]
 # Six choices in a paired list retain reading order and avoid wide, repetitive rows.
 def technology_cards(match):
  rows=re.findall(r'<tr>\s*<td>(.*?)</td>\s*<td>(.*?)</td>\s*</tr>',match.group(0),re.S)
  assert len(rows)==6,'Expected six infrastructure choices.'
  return '<dl class="technology-grid">'+''.join('<div><dt>'+k+'</dt><dd>'+v+'</dd></div>' for k,v in rows)+'</dl>'
 pages[0]=re.sub(r'<table>.*?</table>',technology_cards,pages[0],count=1,flags=re.S)
 # Pair recommendation inputs with quality objectives. The frontend page
 # has one technology section and no separate controls or testing section.
 p=pages[1];split=p.index('<h3 ');intro,detail=p[:split],p[split:]
 blocks=[b for b in re.split(r'(?=<h3 )',detail) if b.strip()]
 assert len(blocks)==2,'Expected recommendation rules and quality objectives.'
 pages[1]=intro+'<div class="decision-grid">'+''.join('<div>'+b+'</div>' for b in blocks)+'</div>'
 output='<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Airport Trip Planner: solution design</title><style>'+CSS+'</style></head><body><main>'+''.join('<section class="sheet">'+p+'</section>' for p in pages)+'</main></body></html>'
 (ROOT/'solution-design.html').write_text(output)
 print('Rendered the three-view proposal.')
if __name__=='__main__':render()
