from pathlib import Path
import json, fitz
from weasyprint import HTML, CSS
ROOT=Path('/mnt/data/RecruitFlow_UIUX_Application_v2.0')
PAGES=ROOT/'app'/'pages'
manifest=json.loads((ROOT/'manifest.json').read_text())
css_desktop=CSS(string='@page{size:1586px 992px;margin:0} html,body{width:1586px;height:992px;overflow:hidden} body{print-color-adjust:exact;-webkit-print-color-adjust:exact}')
css_mobile=CSS(string='@page{size:460px 920px;margin:0} html,body{width:460px;height:920px;overflow:hidden} body{print-color-adjust:exact;-webkit-print-color-adjust:exact}')
for d in [ROOT/'screens'/'desktop',ROOT/'screens'/'mobile',ROOT/'screens'/'special']:
    d.mkdir(parents=True,exist_ok=True)
for i,s in enumerate(manifest,1):
    mobile=s['category']=='Mobile'
    folder='mobile' if mobile else 'special' if s['category']=='Special' else 'desktop'
    out=ROOT/'screens'/folder/f"{Path(s['file']).stem}.png"
    temp=ROOT/'screens'/folder/f".{Path(s['file']).stem}.pdf"
    HTML(filename=str(PAGES/s['file']),base_url=str(PAGES)).write_pdf(str(temp),stylesheets=[css_mobile if mobile else css_desktop])
    doc=fitz.open(temp); pix=doc[0].get_pixmap(matrix=fitz.Matrix(96/72,96/72),alpha=False); pix.save(out); doc.close(); temp.unlink()
    print(f'{i:02d}/{len(manifest)} {out.name}')
