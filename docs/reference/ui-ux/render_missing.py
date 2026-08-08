from pathlib import Path
import json, fitz, sys
from weasyprint import HTML, CSS
ROOT=Path(__file__).resolve().parent; PAGES=ROOT/'app'/'pages'
manifest=json.loads((ROOT/'manifest.json').read_text())
start=int(sys.argv[1]); end=int(sys.argv[2])
cd=CSS(string='@page{size:1586px 992px;margin:0} html,body{width:1586px;height:992px;overflow:hidden} body{print-color-adjust:exact;-webkit-print-color-adjust:exact}')
cm=CSS(string='@page{size:460px 920px;margin:0} html,body{width:460px;height:920px;overflow:hidden} body{print-color-adjust:exact;-webkit-print-color-adjust:exact}')
for idx,s in enumerate(manifest,1):
 if idx<start or idx>end: continue
 mobile=s['category']=='Mobile'; folder='mobile' if mobile else 'special' if s['category']=='Special' else 'desktop'
 out=ROOT/'screens'/folder/f"{Path(s['file']).stem}.png"; out.parent.mkdir(parents=True,exist_ok=True)
 if out.exists(): print('skip',idx); continue
 temp=out.with_suffix('.pdf')
 HTML(filename=str(PAGES/s['file']),base_url=str(PAGES)).write_pdf(str(temp),stylesheets=[cm if mobile else cd])
 doc=fitz.open(temp); pix=doc[0].get_pixmap(matrix=fitz.Matrix(96/72,96/72),alpha=False); pix.save(out); doc.close(); temp.unlink()
 print(idx,out.name,flush=True)
