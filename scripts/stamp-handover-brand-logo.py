from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pathlib import Path

pptx_path = Path(r"docs\handover\RecruitFlow_IT_Handover_Presentation.pptx")
logo = Path(r"apps\web\src\design-system\brand\assets\sgh-heart.png")
assert logo.exists(), logo
assert pptx_path.exists(), pptx_path

prs = Presentation(str(pptx_path))
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT = RGBColor(0xB8, 0xD4, 0xEB)

# Title slide — logo top-right
title = prs.slides[0]
# heart lockup
title.shapes.add_picture(str(logo), Inches(11.55), Inches(0.35), height=Inches(1.05))

# Small logo watermark near presenter area left of name block
title.shapes.add_picture(str(logo), Inches(0.75), Inches(5.95), height=Inches(0.55))

# Closing slide — larger centered-ish logo above thanks area
close = prs.slides[-1]
close.shapes.add_picture(str(logo), Inches(11.4), Inches(0.4), height=Inches(1.15))
close.shapes.add_picture(str(logo), Inches(0.75), Inches(5.95), height=Inches(0.55))

# Content slides: small logo top-right on navy bar (skip title index 0 and last)
for idx, slide in enumerate(prs.slides):
    if idx == 0 or idx == len(prs.slides) - 1:
        continue
    # place small logo inside navy header band
    slide.shapes.add_picture(str(logo), Inches(12.35), Inches(0.18), height=Inches(0.7))

prs.save(str(pptx_path))
print(f"Branded {pptx_path} with {logo.name} on {len(prs.slides)} slides")
