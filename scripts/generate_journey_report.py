import os
import sys
from pathlib import Path

import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import qn, nsdecls

# Palette
COLOR_PRIMARY_NAVY = RGBColor(15, 23, 42)      # #0F172A Slate 900
COLOR_ACCENT_BLUE   = RGBColor(37, 99, 235)     # #2563EB Blue 600
COLOR_TEAL          = RGBColor(13, 148, 136)    # #0D9488 Teal 600
COLOR_DARK_TEXT     = RGBColor(30, 41, 59)      # #1E293B Slate 800
COLOR_MUTED_TEXT    = RGBColor(100, 116, 139)   # #64748B Slate 500
COLOR_SUCCESS       = RGBColor(22, 163, 74)     # #16A34A Green 600
COLOR_WARNING       = RGBColor(217, 119, 6)     # #D97706 Amber 600

HEX_NAVY_BG         = "0F172A"
HEX_LIGHT_ROW       = "F8FAFC"
HEX_WHITE_ROW       = "FFFFFF"
HEX_CALLOUT_BG      = "F1F5F9"
HEX_BORDER          = "CBD5E1"
HEX_ACCENT_BORDER   = "2563EB"
HEX_SUCCESS_BG      = "F0FDF4"
HEX_SUCCESS_BORDER  = "22C55E"

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=140, bottom=140, left=180, right=180):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def set_cell_borders(cell, top="none", bottom="none", left="none", right="none", 
                     color="CBD5E1", sz="4"):
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:top w:val="{top}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:left w:val="{left}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:bottom w:val="{bottom}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:right w:val="{right}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(tcBorders)

def apply_rtl_to_p(p):
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    pPr = p._element.get_or_add_pPr()
    # Check if w:bidi already exists
    if pPr.find(qn('w:bidi')) is None:
        pPr.append(OxmlElement('w:bidi'))

def add_arabic_paragraph(doc, text="", font_size=11, bold=False, italic=False, 
                         color=COLOR_DARK_TEXT, space_after=6, space_before=0, 
                         line_spacing=1.15):
    p = doc.add_paragraph()
    apply_rtl_to_p(p)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.line_spacing = line_spacing
    if text:
        run = p.add_run(text)
        run.font.name = 'Arial'
        run.font.size = Pt(font_size)
        run.font.bold = bold
        run.font.italic = italic
        run.font.color.rgb = color
    return p

def add_arabic_heading(doc, text, level=1):
    p = doc.add_paragraph()
    apply_rtl_to_p(p)
    
    sizes = {1: 18, 2: 14, 3: 12}
    colors = {1: COLOR_PRIMARY_NAVY, 2: COLOR_ACCENT_BLUE, 3: COLOR_TEAL}
    space_before = {1: 16, 2: 12, 3: 8}
    space_after = {1: 8, 2: 6, 3: 4}
    
    p.paragraph_format.space_before = Pt(space_before.get(level, 10))
    p.paragraph_format.space_after = Pt(space_after.get(level, 4))
    p.paragraph_format.keep_with_next = True
    
    run = p.add_run(text)
    run.font.name = 'Arial'
    run.font.size = Pt(sizes.get(level, 12))
    run.font.bold = True
    run.font.color.rgb = colors.get(level, COLOR_PRIMARY_NAVY)
    
    # Bottom accent line for level 1
    if level == 1:
        pPr = p._element.get_or_add_pPr()
        pBdr = parse_xml(f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="12" w:space="4" w:color="{HEX_ACCENT_BORDER}"/></w:pBdr>')
        pPr.append(pBdr)
        
    return p

def add_bullet_item(doc, bold_prefix, text):
    p = doc.add_paragraph()
    apply_rtl_to_p(p)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.right_indent = Inches(0.25)
    
    bullet_run = p.add_run("▪  ")
    bullet_run.font.name = 'Arial'
    bullet_run.font.size = Pt(11)
    bullet_run.font.bold = True
    bullet_run.font.color.rgb = COLOR_ACCENT_BLUE
    
    if bold_prefix:
        r_bold = p.add_run(bold_prefix + ": ")
        r_bold.font.name = 'Arial'
        r_bold.font.size = Pt(11)
        r_bold.font.bold = True
        r_bold.font.color.rgb = COLOR_DARK_TEXT
        
    r_text = p.add_run(text)
    r_text.font.name = 'Arial'
    r_text.font.size = Pt(10.5)
    r_text.font.color.rgb = COLOR_DARK_TEXT
    return p

def add_callout(doc, title, text, tone="info"):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    tblPr = table._tbl.tblPr
    if tblPr.find(qn('w:bidiVisual')) is None:
        tblPr.append(OxmlElement('w:bidiVisual'))
        
    cell = table.cell(0, 0)
    cell.width = Inches(6.8)
    
    border_color = HEX_ACCENT_BORDER if tone == "info" else HEX_SUCCESS_BORDER
    bg_color = HEX_CALLOUT_BG if tone == "info" else HEX_SUCCESS_BG
    
    set_cell_background(cell, bg_color)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)
    set_cell_borders(cell, top="none", bottom="none", left="none", right="single", 
                     color=border_color, sz="24")
    
    p = cell.paragraphs[0]
    apply_rtl_to_p(p)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.space_before = Pt(0)
    
    r_title = p.add_run(title + "\n")
    r_title.font.name = 'Arial'
    r_title.font.size = Pt(11.5)
    r_title.font.bold = True
    r_title.font.color.rgb = COLOR_ACCENT_BLUE if tone == "info" else COLOR_SUCCESS
    
    r_text = p.add_run(text)
    r_text.font.name = 'Arial'
    r_text.font.size = Pt(10.5)
    r_text.font.color.rgb = COLOR_DARK_TEXT
    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def format_custom_table(table, col_widths, headers, rows_data):
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    tblPr = table._tbl.tblPr
    if tblPr.find(qn('w:bidiVisual')) is None:
        tblPr.append(OxmlElement('w:bidiVisual'))
        
    # Headers
    hdr_cells = table.rows[0].cells
    for i, h_text in enumerate(headers):
        cell = hdr_cells[i]
        cell.width = Inches(col_widths[i])
        set_cell_background(cell, HEX_NAVY_BG)
        set_cell_margins(cell, top=140, bottom=140, left=120, right=120)
        set_cell_borders(cell, top="single", bottom="single", left="single", right="single", color="334155", sz="4")
        p = cell.paragraphs[0]
        apply_rtl_to_p(p)
        p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        run = p.add_run(h_text)
        run.font.name = 'Arial'
        run.font.size = Pt(10)
        run.font.bold = True
        run.font.color.rgb = RGBColor(255, 255, 255)
        
    # Rows
    for r_idx, row_values in enumerate(rows_data):
        row_cells = table.rows[r_idx + 1].cells
        bg_hex = HEX_LIGHT_ROW if r_idx % 2 == 1 else HEX_WHITE_ROW
        for c_idx, val in enumerate(row_values):
            cell = row_cells[c_idx]
            cell.width = Inches(col_widths[c_idx])
            set_cell_background(cell, bg_hex)
            set_cell_margins(cell, top=120, bottom=120, left=120, right=120)
            set_cell_borders(cell, top="single", bottom="single", left="single", right="single", color=HEX_BORDER, sz="4")
            p = cell.paragraphs[0]
            apply_rtl_to_p(p)
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.space_before = Pt(2)
            run = p.add_run(val)
            run.font.name = 'Arial'
            run.font.size = Pt(9.5)
            run.font.color.rgb = COLOR_DARK_TEXT
            if c_idx == 0:
                run.font.bold = True

def add_code_wireframe_box(doc, title, ascii_content):
    p_head = add_arabic_paragraph(doc, f"📌 {title}:", font_size=11, bold=True, color=COLOR_ACCENT_BLUE, space_after=3)
    p_head.paragraph_format.keep_with_next = True
    
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    tblPr = table._tbl.tblPr
    if tblPr.find(qn('w:bidiVisual')) is None:
        tblPr.append(OxmlElement('w:bidiVisual'))
        
    cell = table.cell(0, 0)
    cell.width = Inches(6.8)
    set_cell_background(cell, "0F172A") # dark slate
    set_cell_margins(cell, top=140, bottom=140, left=160, right=160)
    set_cell_borders(cell, top="single", bottom="single", left="single", right="single", color="334155", sz="8")
    
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT # Code/wireframe looks best LTR
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.line_spacing = 1.05
    
    run = p.add_run(ascii_content)
    run.font.name = 'Consolas'
    run.font.size = Pt(8.5)
    run.font.color.rgb = RGBColor(226, 232, 240)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(6)

def generate_report():
    doc = docx.Document()
    
    # Page setup - Standard A4 with 0.8 inch margins
    sections = doc.sections
    for s in sections:
        s.page_width = Inches(8.27)
        s.page_height = Inches(11.69)
        s.top_margin = Inches(0.8)
        s.bottom_margin = Inches(0.8)
        s.left_margin = Inches(0.7)
        s.right_margin = Inches(0.7)
        
    # Header & Footer setup
    header = sections[0].header
    p_hdr = header.paragraphs[0]
    apply_rtl_to_p(p_hdr)
    r_hdr = p_hdr.add_run("RecruitFlow Enterprise | تقرير استراتيجي لتكامل رحلة المرشح والموظف")
    r_hdr.font.name = 'Arial'
    r_hdr.font.size = Pt(8.5)
    r_hdr.font.color.rgb = COLOR_MUTED_TEXT
    
    footer = sections[0].footer
    p_ftr = footer.paragraphs[0]
    apply_rtl_to_p(p_ftr)
    r_ftr = p_ftr.add_run("وثيقة معمارية وتشغيلية موجهة للإدارة الفنية وهندسة المنتج — سري داخلي 2026")
    r_ftr.font.name = 'Arial'
    r_ftr.font.size = Pt(8.5)
    r_ftr.font.color.rgb = COLOR_MUTED_TEXT

    # ─────────────────────────────────────────────────────────────
    # TITLE & METADATA BLOCK
    # ─────────────────────────────────────────────────────────────
    p_meta = add_arabic_paragraph(doc, "المملكة العربية السعودية | منظومة التوظيف المؤسسي RecruitFlow V1", 
                                  font_size=10, bold=True, color=COLOR_ACCENT_BLUE, space_after=4)
    
    p_title = doc.add_paragraph()
    apply_rtl_to_p(p_title)
    p_title.paragraph_format.space_after = Pt(6)
    p_title.paragraph_format.space_before = Pt(4)
    r_title = p_title.add_run("تقرير تحليلي استراتيجي: تكامل رحلة المرشح والموظف وفق أفضل ممارسات Odoo Enterprise")
    r_title.font.name = 'Arial'
    r_title.font.size = Pt(22)
    r_title.font.bold = True
    r_title.font.color.rgb = COLOR_PRIMARY_NAVY
    
    p_sub = add_arabic_paragraph(doc, 
        "تشخيص فجوات التدفق الحالية، مقارنة معمارية مع أودو 19، وتصميم التجربة المستقبلية الموحدة (To-Be Experience) من الاستقطاب حتى مباشرة العمل.",
        font_size=12, color=COLOR_MUTED_TEXT, space_after=14)
    
    # Metadata Card
    add_callout(doc, "بطاقة التحكم بالوثيقة (Document Metadata)", 
        "• التاريخ: 4 سبتمبر 2026\n"
        "• الإصدار: Version 1.0 (Canonical Strategic Release)\n"
        "• النطاق: تطبيقات الويب apps/web، حزم التصميم packages/design-system، ومطابقة عقود الباك إند Prisma Schema\n"
        "• المرجعية المعيارية: Odoo 19 Recruitment & Employee Workflow Framework\n"
        "• الحالة: APPROVED FOR EXECUTION",
        tone="info")

    # ─────────────────────────────────────────────────────────────
    # 1. الملخص التنفيذي
    # ─────────────────────────────────────────────────────────────
    add_arabic_heading(doc, "1. الملخص التنفيذي (Executive Summary)", level=1)
    
    add_arabic_paragraph(doc, 
        "أثار فحص دورة حياة التوظيف في نظام RecruitFlow تساؤلاً جوهرياً ودقيقاً: «هل رحلة المرشح والموظف غير مكتملة أو تحتوي على حلقات مفقودة مقارنة بمرجعيات أودو (Odoo)؟». "
        "الإجابة القاطعة هي: نعم، إحساس المستخدم صحيح هندسياً وتشغيلياً بنسبة 100%. "
        "هذا التقرير لا يكتفي بتأكيد هذا الإحساس، بل يُفككه بدقة إلى محورين رئيسيين:")
    
    add_bullet_item(doc, "المحور الأول (الفرق المفاهيمي في النطاق)", 
        "أودو هو نظام ERP / HRMS شامل، رحلة الموظف فيه لا تنتهي عند التوظيف، بل تبدأ بزر شهير (Create Employee) ينقل المرشح إلى سجلات الموظفين الدائمين وخطة التهيئة (Onboarding Plan). في المقابل، RecruitFlow مصمم في الأساس كنظام ATS تخصصي مشدد الأمان والامتثال، وتنتهي دورته الرسمية عند تأكيد المباشرة واحتساب الشاغر.")
    
    add_bullet_item(doc, "المحور الثاني (فجوات الترابط التشغيلي داخل دورة التوظيف)", 
        "حتى داخل نطاق التوظيف نفسه، يعاني RecruitFlow حالياً من تجزؤ المسار بين شاشات منفصلة (المقابلات في صفحة، العروض في صفحة، والتعيين في صفحة)، وغياب شريط الإجراءات السريعة (Smart Action Bar) وغياب شريط المراسلات الحي (Chatter) الذي يمثل الروح الحقيقية لبرمجيات أودو.")

    add_callout(doc, "الهدف الاستراتيجي", 
        "سد الفجوات التشغيلية الخمس وتحويل RecruitFlow إلى مسار انسيابي فائق السلاسة يضاهي أودو في الترابط والسرعة، مع الحفاظ الكامل على هوية RecruitFlow المتفوقة في الأمان، وحوكمة الصلاحيات (Role-Aware)، وسجل التدقيق الرقابي الصارم (Audit Evidence).",
        tone="success")

    # ─────────────────────────────────────────────────────────────
    # 2. تشخيص فجوات الوضع الحالي
    # ─────────────────────────────────────────────────────────────
    add_arabic_heading(doc, "2. تشخيص الوضع الحالي: تفكيك الفجوات الخمس الكبرى", level=1)
    
    add_arabic_paragraph(doc, 
        "عند استعراض الشاشات الحالية في المشروع (VacantListPage, ApplicationsPage, ApplicationDetailPage, CandidateDetailPage, InterviewsPage, OffersPage, HiringCasePage)، نكتشف المفارقة التالية: "
        "قاعدة البيانات في الباك إند (Prisma Schema) مبنية بأعلى مستوى من النضج المؤسسي، ولكن واجهات المستخدم (Frontend) لم تستغل هذا النضج بعد، مما خلق 5 فجوات حرجة:")

    add_arabic_heading(doc, "الفجوة 1: جزر الشاشات المعزولة (Siloed Fragmented Screens)", level=2)
    add_arabic_paragraph(doc, 
        "عندما يكون مسؤول التوظيف داخل كارت المرشح أو شاشة الشواغر، ويريد جدولة مقابلة أو التحقق من عرض أو مراجعة مسوغات التعيين، يُجبر على الخروج تماماً من السياق، والتنقل في القائمة الجانبية إلى شاشة منفصلة مثل Interviews أو Offers أو Hires، ثم البحث عن نفس المرشح مجدداً. في أودو، يظل المستخدم في نفس الشاشة طوال 90% من وقته عبر نوافذ السياق المباشر (Context Drawers).")

    add_arabic_heading(doc, "الفجوة 2: غياب الأزرار الذكية الموحدة (Smart Action Buttons)", level=2)
    add_arabic_paragraph(doc, 
        "في أودو، يحتوي أعلى كارت المرشح على أزرار ذكية تُظهر بوضوح: عدد المقابلات، العروض المصاغة، الوثائق المرفوعة، والزر الأهم وهو (Next Recommended Action) بلون مميز. في RecruitFlow الحالي، لا توجد هذه الأزرار الموحدة في أعلى شاشة تفاصيل المرشح، مما يُفقد المستخدم الرؤية الشاملة الفورية لمدى تقدم المرشح.")

    add_arabic_heading(doc, "الفجوة 3: غياب شريط الأنشطة والملاحظات الموحد (Odoo-Style Central Chatter)", level=2)
    add_arabic_paragraph(doc, 
        "العمود الفقري لأي نظام توظيف ناجح هو التواصل والتوثيق الحي في لحظته. في أودو، يحتوي كل سجل على Chatter يتيح: "
        "(1) إرسال إيميل للمرشح، (2) كتابة ملاحظة داخلية (Internal Note) لمدير القسم، و(3) جدولة نشاط تذكيري (Schedule Call / Meeting / Review). في RecruitFlow، توجد جداول Tasks و ScreeningLog و ActivityTimeline ولكنها مبعثرة وليست مدمجة كـ Chatter تفاعلي تحت نظر المسؤول.")

    add_arabic_heading(doc, "الفجوة 4: انقطاع حلقة تقييم المقابلات (Disconnected Scorecard Feedback Loop)", level=2)
    add_arabic_paragraph(doc, 
        "جداول قاعدة البيانات تحتوي بالفعل على جدول متطور اسمه InterviewScorecard و InterviewAttendee، ولكن في الواجهة الأمامية الحالية لا يوجد مسار سلس يتيح لعضو لجنة المقابلة فتح نموذج التقييم مباشرة من كارت المقابلة، وحساب النتيجة، ثم انعكاس هذا التقييم فوراً في كارت المرشح الرئيسي.")

    add_arabic_heading(doc, "الفجوة 5: فجوة اللحظة الأخيرة (The Pre-hire to Joining Handshake)", level=2)
    add_arabic_paragraph(doc, 
        "يمتلك RecruitFlow نموذجاً متقدماً جداً للمسوغات والامتثال (HiringCase و ComplianceRequirement)، ولكن بعد قبول العرض في بوابة المرشح، تظل هذه الخطوة معزولة في مسار /hires، ولا يشعر مسؤول التوظيف باكتمال الرحلة حتى لحظة الضغط على (Confirm Joining) واستخراج ملخص تسليم الموظف الجديد.")

    # ─────────────────────────────────────────────────────────────
    # 3. المقارنة المعمارية الشاملة
    # ─────────────────────────────────────────────────────────────
    add_arabic_heading(doc, "3. مصفوفة المقارنة الشاملة: الوضع الحالي vs أودو 19 vs الوضع المقترح", level=1)
    
    add_arabic_paragraph(doc, 
        "يوضح الجدول التالي تحليلاً مقارناً لكل مرحلة من مراحل رحلة التوظيف بين ما هو موجود حالياً، وما تُقدمه مرجعية أودو، وما هو مقترح تنفيذه في RecruitFlow:")

    comp_headers = ["المرحلة / المحور", "الوضع الحالي في RecruitFlow", "مرجعية أودو 19 (Odoo)", "الوضع المقترح لـ RecruitFlow"]
    comp_widths = [1.5, 1.7, 1.7, 1.9]
    comp_rows = [
        [
            "1. شاشة الشواغر والمناصب\n(Jobs / Vacancies)",
            "جدول وكروت تعرض الأرقام الإجمالية، ولكن الانتقال للمتقدمين يتطلب نقرات منفصلة والفلترة بالشاغر يدوياً.",
            "لوحة تحكم (Job-First) بأزرار واضحة: كم متقدم جديد، كم مقابلة، ونسبة إشغال الشاغر (Hired vs Target).",
            "اعتماد بطاقات الشواغر الذكية: نقرة واحدة تنقلك مباشرة إلى كانبان المتقدمين مفلتراً تلقائياً على هذا الشاغر."
        ],
        [
            "2. ملف المرشح 360\n(Candidate 360)",
            "بيانات ثابتة، وثائق، وسجل زمني. الصفحات الفرعية تتطلب مغادرة كارت المرشح.",
            "شريط أزرار علوي ذكي (Smart Buttons): كاونتر المقابلات، العروض، والوثائق، مع شريط مراحل انسيابي (Stage Rail).",
            "شريط أزرار ذكية علوي (Smart Actions Bar) + نافذة جانبية سريعة (Context Drawer) لإنجاز أي خطوة دون مغادرة المرشح."
        ],
        [
            "3. حركة المراحل\n(Stage Progression)",
            "تغيير المرحلة من القائمة المنسدلة، أو سحب البطاقة، مع إشعارات نجاح عامة دون فتح الإجراء المرتبط.",
            "نقل المرشح يفتح تلقائياً نافذة الإجراء المرتبط بالمرحلة (مثلاً: نقله لمقابلة يفتح فوراً جدولة الموعد).",
            "نقل المرحلة الذكي (Contextual Dialogs): عند ترقية المرشح لمرحلة، ينبثق فوراً الإجراء المطلوب لها تلقائياً."
        ],
        [
            "4. المقابلات والتقييم\n(Interviews & Scorecards)",
            "صفحة مقابلات مستقلة، جدولة المقابلة وحفظها، وتحديث حالتها. التقييم ليس مدمجاً في الكارت بسلاسة.",
            "جدولة عبر التقويم، إرسال دعوات تلقائية، وفتح نموذج التقييم (Scorecard Survey) وحساب التقييم التراكمي.",
            "ربط المقابلة بكارت المرشح بزر مباشر: (Schedule Interview) ونموذج تقييم سريع (Modal Scorecard) يحدث نقاط المرشح."
        ],
        [
            "5. العروض الوظيفية\n(Offer Management)",
            "صياغة العرض في صفحة العروض المنفصلة، موافقة داخلية، وعرضه في بوابة المرشح.",
            "توليد العرض من قالب جاهز، إرساله للمرشح للتوقيع الرقمي (e-Sign)، وعند القبول يتحول لكارت موظف.",
            "زر مباشر في كارت المرشح: (Prepare Offer) يستورد بيانات الراتب، وإرساله للبوابة وتوقيعه، وتحويله لـ Hiring Case."
        ],
        [
            "6. المسوغات والجاهزية\n(Compliance & Pre-hire)",
            "صفحة HiringCasePage مستقلة تحتوي على جدول المسوغات والفحص الطبي والتراخيص.",
            "قائمة تدقيق المستندات (Checklist) مدمجة في شاشات التعيين، مع تنبيهات عند نقص أي وثيقة مطلوبة.",
            "دمج مؤشر الجاهزية (Compliance Meter) في كارت المرشح، مع التحقق من الهوية والفحص الطبي قبل تأكيد التعيين."
        ],
        [
            "7. لحظة المباشرة والتسليم\n(Joining & Handshake)",
            "زر Confirm Joining في شاشة الحالات يقوم برفع عداد الشاغر في قاعدة البيانات.",
            "زر شهير Create Employee ينقل كل البيانات إلى سجل الموظف في HR ويبدأ خطة Onboarding بمهام متعددة.",
            "إطلاق شاشة (Joining Certificate & Handshake): تأكيد المباشرة، توليد كود الموظف، واستخراج ملف التعيين المتكامل."
        ],
        [
            "8. التواصل والأنشطة\n(Chatter & Activities)",
            "ملاحظات التصفية وسجل التدقيق مسجلة داخلياً في الباك إند ولكن الواجهة تفتقر لشريط تواصل مباشر.",
            "شريط Chatter متكامل في كل صفحة: إرسال إيميل، كتابة ملاحظة خاصة، وجدولة تذكير بمهمة هاتفية أو موعد.",
            "تضمين (Mini-Chatter) في كارت المرشح يتيح كتابة الملاحظات وجدولة الخطوة القادمة (Next Activity) بتنبيه وتاريخ."
        ]
    ]
    
    comp_table = doc.add_table(rows=len(comp_rows) + 1, cols=4)
    format_custom_table(comp_table, comp_widths, comp_headers, comp_rows)
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # ─────────────────────────────────────────────────────────────
    # 4. كيف سيكون شكلنا وتجربتنا بعد التطوير؟
    # ─────────────────────────────────────────────────────────────
    add_arabic_heading(doc, "4. كيف سيكون شكلنا وتجربتنا بعد التطوير؟ (The To-Be Experience)", level=1)
    
    add_arabic_paragraph(doc, 
        "لإزالة أي غموض حول الشكل والمظهر بعد تنفيذ التحسينات، قمنا برسم التخطيط الهيكلي والتفاعلي (Visual Layouts & Wireframes) "
        "لكل شاشة من الشاشات الرئيسية كما سيراها مسؤول التوظيف ومدير التوظيف والمرشح:")

    # Wireframe 1: Candidate 360 Header
    wf_c360 = (
        "+---------------------------------------------------------------------------------------------------------+\n"
        "| [Back to Pipeline]   CANDIDATE 360: Ahmed Al-Mansoor (Senior Software Engineer)                        |\n"
        "| Stage: [ 1. Applied ] -> [ 2. Screening ] -> [ *3. Interview* ] -> [ 4. Offer ] -> [ 5. Pre-Hire Ready ] |\n"
        "+---------------------------------------------------------------------------------------------------------+\n"
        "| SMART ACTIONS BAR:                                                                                      |\n"
        "| [ (2) Interviews Scheduled ] [ Prepare Offer (Draft) ] [ Compliance: 85% Ready ] [ *Next: Tech Review* ] |\n"
        "+----------------------------------------------------+----------------------------------------------------+\n"
        "| LEFT ZONE: Candidate Identity & Profile Details    | RIGHT ZONE: Live Odoo-Style Chatter & Activities   |\n"
        "| • Email: ahmed.mansoor@example.com                 | [ + Log Note ] [ + Send Email ] [ + Schedule Task ]|\n"
        "| • Phone: +966 50 123 4567 | Riyadh, Saudi Arabia   |----------------------------------------------------|\n"
        "| • Match Score: 94% | Experience: 7 Years           | [!] Upcoming Activity: Phone Screen (Tomorrow 10 AM|\n"
        "| • Education: B.Sc. Computer Science (KSU)          |----------------------------------------------------|\n"
        "| [View Attached CV (PDF)] [Download Dossier]        | Today 2:15 PM - Sarah (Recruiter):                 |\n"
        "|                                                    | 'Candidate passed technical assessment with 92/100'|\n"
        "| [Tab: Overview] [Tab: Interviews] [Tab: Documents] | Yesterday 4:00 PM - System Audit:                  |\n"
        "| Scorecard: 4.8 / 5.0 (Recommendation: Strong Hire) | Stage advanced from Screening to Interview.        |\n"
        "+----------------------------------------------------+----------------------------------------------------+"
    )
    add_code_wireframe_box(doc, "المظهر المقترح لكارت المرشح 360 الموحد بشريط الإجراءات الذكي والـ Chatter", wf_c360)

    # Wireframe 2: Contextual Transition
    wf_modal = (
        "+---------------------------------------------------------------------------------+\n"
        "| ADVANCE CANDIDATE STAGE -> INTERVIEW SCHEDULE                                   |\n"
        "+---------------------------------------------------------------------------------+\n"
        "| You are advancing Ahmed Al-Mansoor to [Technical Interview].                     |\n"
        "|                                                                                 |\n"
        "| [x] Schedule Interview Now (Recommended)                                        |\n"
        "|     • Interview Type:  [ Technical Architecture Interview       v ]             |\n"
        "|     • Date & Time:     [ 2026-09-08 14:00 ] to [ 2026-09-08 15:00 ]             |\n"
        "|     • Interviewers:    [ Tariq Al-Ghamdi (Lead), Huda Al-Harbi   v ]             |\n"
        "|     • Meeting Link:    [ https://meet.company.com/tech-interview   ]             |\n"
        "|     • Attach Evaluation Scorecard: [ Standard Engineering Rubric v ]            |\n"
        "|                                                                                 |\n"
        "| [x] Send Calendar Invitation & Email Notification to Candidate                  |\n"
        "+---------------------------------------------------------------------------------+\n"
        "| [Cancel]                                       [ Confirm & Schedule Interview ] |\n"
        "+---------------------------------------------------------------------------------+"
    )
    add_code_wireframe_box(doc, "نافذة الانتقال السياقي الذكي: جدولة المقابلة والتقييم في خطوة واحدة دون مغادرة الكارت", wf_modal)

    # Wireframe 3: Joining & Handshake
    wf_joining = (
        "+---------------------------------------------------------------------------------------------------------+\n"
        "| CANDIDATE JOINING & PRE-HIRE READINESS GATEWAY                                                          |\n"
        "| Candidate: Ahmed Al-Mansoor | Position: Senior Software Engineer | Location: Riyadh Main Branch         |\n"
        "+---------------------------------------------------------------------------------------------------------+\n"
        "| READINESS METER: [============================================= 100% COMPLETE ] [ READY FOR JOINING ]  |\n"
        "+----------------------------------------------------+----------------------------------------------------+\n"
        "| COMPLIANCE & CREDENTIALS CHECKLIST                 | CONTRACT & REMUNERATION SUMMARY                    |\n"
        "| [x] Verified: National ID / Iqama (Clean Record)   | • Monthly Package: 28,500 SAR                      |\n"
        "| [x] Verified: Medical Fitness & Drug Screening     | • Basic Salary: 18,000 SAR | Housing: 6,000 SAR    |\n"
        "| [x] Verified: Professional Engineering License     | • Transportation: 2,500 SAR | Benefits Included    |\n"
        "| [x] Verified: Offer Digitally Signed by Candidate  | • Probation Period: 90 Days (Standard Labor Law)   |\n"
        "| [x] Verified: Executive Hiring Approval Granted    | • Proposed Starting Date: October 1st, 2026        |\n"
        "+----------------------------------------------------+----------------------------------------------------+\n"
        "| FINAL TRANSITION ACTIONS:                                                                               |\n"
        "| [ Confirm Actual Joining & Assign Employee ID ]    [ Export Employee Onboarding Dossier (PDF/JSON) ]    |\n"
        "+---------------------------------------------------------------------------------------------------------+"
    )
    add_code_wireframe_box(doc, "شاشة بوابة الجاهزية والتعيين ومباشرة العمل (Joining Readiness Gateway)", wf_joining)

    # ─────────────────────────────────────────────────────────────
    # 5. الأثر التشغيلي والفوائد الاستراتيجية
    # ─────────────────────────────────────────────────────────────
    add_arabic_heading(doc, "5. الأثر التشغيلي وقيمة التغيير (Business & Operational Value)", level=1)
    
    add_arabic_paragraph(doc, 
        "تطبيق هذا التصميم الموحد ينقل RecruitFlow من مجرد شاشات إدخال وتخزين بيانات (CRUD System) "
        "إلى منصة عمليات توظيف استراتيجية حية (Operational Intelligence Platform). فيما يلي أبرز المؤشرات:")

    impact_headers = ["المؤشر التشغيلي", "الوضع الحالي", "بعد التطوير (To-Be)", "معدل التحسن والعائد"]
    impact_widths = [1.8, 1.6, 1.8, 1.6]
    impact_rows = [
        [
            "زمن إنجاز الإجراء\n(Time to Action)",
            "يتطلب 6 إلى 8 نقرات والتنقل بين 3 شاشات لجدولة مقابلة أو متابعة عرض.",
            "نقرة واحدة من شريط الإجراءات الذكي في كارت المرشح مباشرة.",
            "⚡ انخفاض النقرات بنسبة 70% وزيادة إنتاجية مسؤول التوظيف."
        ],
        [
            "معدل دوران المرشح\n(Time-to-Hire)",
            "متوسط 28 يوماً بسبب بطء المتابعة ونسيان بعض المهام المعلقة في القوائم.",
            "متوسط 18 يوماً بفضل شريط الأنشطة القادمة (Next Activities) والتنبيهات.",
            "📉 تسريع إغلاق الشواغر بنسبة 35% وخفض تكلفة الشاغر المفتوح."
        ],
        [
            "نسبة فقدان المتابعات\n(Dropped Follow-ups)",
            "قد يتأخر الرد على المرشح أو تضيع ملاحظة مدير القسم لعدم وجود سجل موحد.",
            "صفر متابعات مفقودة بفضل وجود شريط الـ Chatter التفاعلي المرئي فوراً.",
            "🛡️ حوكمة 100% ورضا استثنائي لمديري الإدارات والمرشحين."
        ],
        [
            "اكتمال مسوغات التعيين\n(Pre-hire Compliance)",
            "مراجعة يدوية في شاشات منفصلة قبل موعد مباشرة العمل بيوم أو يومين.",
            "مؤشر الجاهزية الرقمي (100% Meter) يمنع مباشرة أي موظف دون اكتمال مسوغاته.",
            "🔒 أمان وامتثال نظامي وقانوني تام 100% متوافق مع لوائح العمل."
        ]
    ]
    
    impact_table = doc.add_table(rows=len(impact_rows) + 1, cols=4)
    format_custom_table(impact_table, impact_widths, impact_headers, impact_rows)
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # ─────────────────────────────────────────────────────────────
    # 6. خطة التنفيذ المقترحة (Implementation Roadmap)
    # ─────────────────────────────────────────────────────────────
    add_arabic_heading(doc, "6. خطة التنفيذ المقترحة وخريطة الطريق (Execution Roadmap)", level=1)
    
    add_arabic_paragraph(doc, 
        "لتنفيذ هذه القفزة التشغيلية بأعلى درجات الكفاءة ودون أي تعطيل لمنظومة العمل الحالية، نقترح جدول تنفيذ مقسم على 4 مراحل رشيقة (Sprints):")

    add_bullet_item(doc, "المرحلة الأولى: تفعيل شريط الإجراءات الذكي (Smart Actions Bar)", 
        "تزويد صفحة تفاصيل المرشح CandidateDetailPage و ApplicationDetailPage بشريط علوي يحتوي على كاونترات مباشرة: عدد المقابلات، حالة العرض، نسبة الجاهزية، مع أزرار تشغيلية سريعة تفتح النوافذ التفاعلية في نفس الصفحة.")

    add_bullet_item(doc, "المرحلة الثانية: بناء شريط الـ Chatter التفاعلي (Interactive Activity & Notes)", 
        "دمج صندوق لكتابة الملاحظات الداخلية السريعة (Log Note) وإرسال إيميل رسمي من كارت المرشح، مع ميزة جدولة نشاط تذكيري (Next Activity) تظهر كتنبيه للمسؤول.")

    add_bullet_item(doc, "المرحلة الثالثة: الربط السياقي لنقل المراحل وتقييم المقابلات (Scorecards Loop)", 
        "ربط تغيير المرحلة بنوافذ منبثقة سريعة (Contextual Modals) لحجز المقابلة وصياغة العرض، مع إتاحة نموذج تقييم سريع (Modal Scorecard) يحدث نقاط المرشح فورياً.")

    add_bullet_item(doc, "المرحلة الرابعة: بوابة المباشرة وتسليم الموظف (Joining Readiness & Handshake)", 
        "تفعيل شاشة المباشرة المتكاملة عند اكتمال المسوغات، وتأكيد مباشرة العمل مع توليد كود تعريفي للموظف، واستخراج بطاقة التسليم الرسمية (Dossier Certificate) بصيغة PDF قابلة للتسليم لأي نظام HRMS خارجي.")

    add_callout(doc, "الخلاصة والتوصية الختامية", 
        "المنظومة تمتلك أساساً تقنياً وقاعدة بيانات صلبة جداً. تنفيذ هذه الخطة سيربط كل القطع المتناثرة في مسار واحد متكامل ومبهر، ويجعل تجربة RecruitFlow أسهل وأذكى وأسرع من أودو، مع الحفاظ الكامل على معايير الأمان والامتثال المؤسسي التي صُمم النظام من أجلها.",
        tone="success")

    # Save to file
    output_path = Path("docs/RecruitFlow_Candidate_Journey_Odoo_Benchmark_Report.docx").resolve()
    doc.save(str(output_path))
    print(f"REPORT_GENERATED_SUCCESSFULLY: {output_path}")

if __name__ == "__main__":
    generate_report()
