from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, math
ROOT=Path('/mnt/data/RecruitFlow_UIUX_Application_v2.0')
SPECIAL=ROOT/'screens'/'special'; SPECIAL.mkdir(parents=True,exist_ok=True)
try:
    font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
    bold=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',18)
    small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
    tiny=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',11)
except:
    font=bold=small=tiny=ImageFont.load_default()

def annotate(src,out,title,points):
    im=Image.open(src).convert('RGBA'); d=ImageDraw.Draw(im,'RGBA')
    # title strip
    d.rounded_rectangle((250,73,850,118),12,fill=(17,24,39,225))
    d.text((270,85),title,font=bold,fill='white')
    for n,(x,y,label) in enumerate(points,1):
        d.ellipse((x-18,y-18,x+18,y+18),fill=(249,115,22,245),outline='white',width=3)
        txt=str(n); box=d.textbbox((0,0),txt,font=bold); d.text((x-(box[2]-box[0])/2,y-(box[3]-box[1])/2-2),txt,font=bold,fill='white')
    # legend
    lx,ly,lw=1120,720,430
    lh=48+len(points)*31
    d.rounded_rectangle((lx,ly,lx+lw,min(980,ly+lh)),15,fill=(255,255,255,242),outline=(124,58,237,90),width=2)
    d.text((lx+18,ly+13),'FEATURE ANATOMY',font=bold,fill=(23,21,38))
    yy=ly+48
    for n,(_,_,label) in enumerate(points,1):
        d.ellipse((lx+18,yy-2,lx+40,yy+20),fill=(249,115,22,255))
        d.text((lx+25,yy+1),str(n),font=tiny,fill='white')
        d.text((lx+51,yy),label,font=small,fill=(50,47,65))
        yy+=31
    im.convert('RGB').save(out,quality=94)

annotate(ROOT/'screens/desktop/01_dashboard.png',SPECIAL/'51_annotated_dashboard.png','Dashboard - Feature Anatomy',[
    (120,320,'Module navigation and role-based visibility'),(820,36,'Global search and quick actions'),(1420,105,'Page actions and exports'),(550,210,'Operational KPI summary'),(700,455,'Recruitment funnel and hiring trend'),(1290,385,'Priority tasks and direct actions'),(650,730,'Supporting analytics and source health')])
annotate(ROOT/'screens/desktop/09_vacancy_overview.png',SPECIAL/'52_annotated_vacancy.png','Vacancy Overview - Feature Anatomy',[
    (550,120,'Vacancy identity, branch and criticality'),(575,183,'Cross-module vacancy tabs'),(680,338,'Required, joined, accepted and remaining headcount'),(650,430,'Pipeline stage summary'),(1340,320,'Primary recruiter versus current next action'),(650,600,'Position master and vacancy-specific data'),(650,820,'License, skills and role requirements')])
annotate(ROOT/'screens/desktop/15_candidate_profile.png',SPECIAL/'53_annotated_candidate.png','Candidate Profile - Feature Anatomy',[
    (650,135,'Unique candidate identity and contact information'),(650,200,'Candidate profile tabs'),(570,430,'Reusable professional profile data'),(610,690,'Separate applications with stage and score'),(1320,340,'Current CV and secure file actions'),(1310,650,'Cross-entity activity history')])
annotate(ROOT/'screens/desktop/31_hiring_case.png',SPECIAL/'54_annotated_hiring_case.png','Hiring Case - Feature Anatomy',[
    (650,145,'Pre-hire workflow stepper'),(620,295,'Readiness and blocking-gate metrics'),(620,555,'Mandatory configured checklist'),(1340,310,'Recruiter, operations and task ownership'),(1330,650,'Immutable status and approval history'),(630,865,'Internal notes and candidate communication')])

# Contact sheets
manifest=json.loads((ROOT/'manifest.json').read_text())
def make_sheet(items,out,title,cols=4,thumb=(360,225)):
    rows=math.ceil(len(items)/cols); tw,th=thumb; gap=18; head=70
    canvas=Image.new('RGB',(cols*tw+(cols+1)*gap,head+rows*(th+54+gap)),(246,245,250)); d=ImageDraw.Draw(canvas)
    d.text((gap,18),title,font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',28),fill=(23,21,38))
    for i,(path,label) in enumerate(items):
        r,c=divmod(i,cols); x=gap+c*(tw+gap); y=head+r*(th+54+gap)
        im=Image.open(path).convert('RGB'); im.thumbnail((tw,th))
        tile=Image.new('RGB',(tw,th),'white'); tile.paste(im,((tw-im.width)//2,0)); canvas.paste(tile,(x,y))
        d.rounded_rectangle((x,y,x+tw,y+th),8,outline=(221,216,235),width=2)
        d.text((x+4,y+th+9),label,font=small,fill=(36,32,53))
    canvas.save(out,quality=90)

desk=[(ROOT/'screens/desktop'/f"{Path(s['file']).stem}.png",f"{Path(s['file']).stem[:2]}  {s['title']}") for s in manifest if s['category'] not in ['Mobile','Special']]
make_sheet(desk[:16],ROOT/'UIUX_Screen_Catalog_01.jpg','RecruitFlow UI/UX - Core Operations (01-16)')
make_sheet(desk[16:32],ROOT/'UIUX_Screen_Catalog_02.jpg','RecruitFlow UI/UX - Recruitment & Offers (17-32)')
make_sheet(desk[32:],ROOT/'UIUX_Screen_Catalog_03.jpg','RecruitFlow UI/UX - Hiring & Administration (33-45)')
others=[(ROOT/'screens/mobile'/f"{Path(s['file']).stem}.png",s['title']) for s in manifest if s['category']=='Mobile']+[(p,p.stem.replace('_',' ').title()) for p in sorted(SPECIAL.glob('*.png'))]
make_sheet(others,ROOT/'UIUX_Mobile_Special_Catalog.jpg','RecruitFlow UI/UX - Mobile, Dark & Annotated',cols=4,thumb=(280,300))
print('catalogs and annotations created')
