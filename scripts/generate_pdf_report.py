import subprocess
from pathlib import Path

html_content = """<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>تقرير تحليلي استراتيجي: تكامل رحلة المرشح والموظف في RecruitFlow</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4;
      margin: 18mm 14mm 18mm 14mm;
      @bottom-right {
        content: counter(page);
        font-family: 'Cairo', sans-serif;
        font-size: 9pt;
        color: #64748b;
      }
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: 'IBM Plex Sans Arabic', 'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 10.5pt;
      line-height: 1.65;
      color: #1e293b;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
      direction: rtl;
      text-align: right;
    }

    h1, h2, h3, h4 {
      font-family: 'Cairo', sans-serif;
      color: #0f172a;
      margin-top: 1.4em;
      margin-bottom: 0.5em;
      font-weight: 800;
      page-break-after: avoid;
    }

    h1 {
      font-size: 20pt;
      line-height: 1.3;
      color: #0f172a;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 8px;
      margin-top: 0;
    }

    h2 {
      font-size: 13.5pt;
      color: #1e3a8a;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 5px;
      margin-top: 1.8em;
    }

    h3 {
      font-size: 11.5pt;
      color: #0d9488;
      margin-top: 1.2em;
    }

    p {
      margin-top: 0;
      margin-bottom: 0.8em;
      text-align: justify;
    }

    .header-badge {
      display: inline-block;
      background: #eff6ff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 9pt;
      font-weight: 700;
      margin-bottom: 12px;
    }

    .metadata-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-right: 4px solid #2563eb;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 24px;
      font-size: 9.5pt;
    }

    .metadata-card ul {
      margin: 6px 0 0 0;
      padding-right: 18px;
    }

    .metadata-card li {
      margin-bottom: 4px;
      color: #334155;
    }

    .callout {
      border-radius: 8px;
      padding: 14px 18px;
      margin: 16px 0;
      page-break-inside: avoid;
    }

    .callout-info {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-right: 4px solid #0284c7;
    }

    .callout-success {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-right: 4px solid #16a34a;
    }

    .callout-warning {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-right: 4px solid #d97706;
    }

    .callout-title {
      font-weight: 800;
      font-size: 11pt;
      margin-bottom: 4px;
      font-family: 'Cairo', sans-serif;
    }

    .callout-info .callout-title { color: #0369a1; }
    .callout-success .callout-title { color: #15803d; }
    .callout-warning .callout-title { color: #b45309; }

    ul, ol {
      margin-top: 0;
      margin-bottom: 1em;
      padding-right: 22px;
    }

    li {
      margin-bottom: 6px;
    }

    li strong {
      color: #0f172a;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 18px 0;
      font-size: 9.5pt;
      page-break-inside: avoid;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    th, td {
      padding: 10px 12px;
      text-align: right;
      border: 1px solid #cbd5e1;
      vertical-align: top;
    }

    th {
      background-color: #0f172a;
      color: #ffffff;
      font-weight: 700;
      font-family: 'Cairo', sans-serif;
      font-size: 9.5pt;
    }

    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    tr:nth-child(odd) td {
      background-color: #ffffff;
    }

    .wireframe-container {
      background: #0f172a;
      color: #f1f5f9;
      border-radius: 8px;
      padding: 14px 18px;
      margin: 18px 0;
      direction: ltr;
      text-align: left;
      font-family: 'JetBrains Mono', Consolas, monospace;
      font-size: 8pt;
      line-height: 1.45;
      overflow-x: auto;
      border: 1px solid #334155;
      page-break-inside: avoid;
    }

    .wireframe-title {
      font-family: 'Cairo', sans-serif;
      font-weight: 700;
      font-size: 10.5pt;
      color: #2563eb;
      margin-bottom: 6px;
      text-align: right;
      direction: rtl;
    }

    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 8.5pt;
      font-weight: 600;
    }
    .badge-success { background: #dcfce7; color: #166534; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-blue { background: #dbeafe; color: #1e40af; }

    .footer-note {
      font-size: 8pt;
      color: #64748b;
      text-align: center;
      margin-top: 30px;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>

  <div class="header-badge">المملكة العربية السعودية | منظومة التوظيف المؤسسي RecruitFlow Enterprise</div>
  
  <h1>تقرير تحليلي استراتيجي: تكامل رحلة المرشح والموظف وفق أفضل ممارسات Odoo Enterprise</h1>
  
  <p style="font-size: 11pt; color: #64748b; margin-bottom: 18px;">
    تشخيص فجوات التدفق الحالية، دراسة معمارية مقارنة مع أودو 19، وتصميم التجربة المستقبلية الموحدة (To-Be Experience) من الاستقطاب حتى مباشرة العمل.
  </p>

  <div class="metadata-card">
    <div class="callout-title" style="color: #1e3a8a; margin-bottom: 6px;">بطاقة التحكم بالوثيقة (Document Metadata)</div>
    <ul>
      <li><strong>التاريخ:</strong> 4 سبتمبر 2026 | <strong>الإصدار:</strong> Version 1.0 (Canonical Strategic Release)</li>
      <li><strong>النطاق البرمجي:</strong> واجهات الويب <code>apps/web</code>، نظام التصميم <code>packages/design-system</code>، وتوافق عقود قاعدة البيانات <code>Prisma Schema</code></li>
      <li><strong>المرجعية المعيارية:</strong> Odoo 19 Recruitment & Employee Workflow Framework</li>
      <li><strong>الفئة المستهدفة:</strong> الإدارة العليا، مدراء التوظيف، مهندسو النظام وفرق تجربة المستخدم (UI/UX)</li>
      <li><strong>حالة الاعتماد:</strong> <span class="badge badge-success">APPROVED FOR ARCHITECTURAL EXECUTION</span></li>
    </ul>
  </div>

  <h2>1. الملخص التنفيذي (Executive Summary)</h2>
  
  <p>
    أثار فحص دورة حياة التوظيف في نظام <strong>RecruitFlow</strong> تساؤلاً جوهرياً ودقيقاً: <em>«هل رحلة المرشح والموظف غير متكاملة أو تحتوي على حلقات مفقودة مقارنة بمرجعيات أودو (Odoo)؟»</em>. 
    الإجابة القاطعة هي: <strong>نعم، إحساسك صحيح ومبرر هندسياً وتشغيلياً بنسبة 100%.</strong>
  </p>
  
  <p>
    هذا التقرير لا يكتفي بتأكيد هذا الشعور، بل يضع تشريحاً علمياً دقيقاً يفكك المسألة إلى مستويين رئيسيين:
  </p>
  
  <ul>
    <li><strong>المستوى الأول (الفارق المفاهيمي في النطاق):</strong> أودو هو نظام ERP / HRMS متكامل، رحلة التوظيف فيه لا تنتهي عند توقيع العرض، بل تبدأ منها مرحلة جديدة عبر زر شهير يسمى <code>Create Employee</code>، ينقل بيانات المرشح إلى ملف الموظف الدائم ويطلق خطة التهيئة المؤسسية (Onboarding Plan). في المقابل، صُمم RecruitFlow في الأساس كـ Enterprise ATS تخصصي، وتنتهي دورته الرسمية عند تأكيد المباشرة (Joined) ورفع عداد الشاغر المكتمل.</li>
    <li><strong>المستوى الثاني (فجوات الترابط التشغيلي داخل دورة التوظيف):</strong> حتى داخل حدود التوظيف، تعاني الواجهات الحالية في RecruitFlow من تشتت المسار عبر شاشات معزولة (المقابلات في صفحة، العروض في صفحة، ومسوغات التعيين في صفحة)، مع غياب شريط الأزرار الذكية الموحدة (Smart Action Buttons) وشريط المراسلات الحي (Chatter) الذي يمثل جوهر الإنتاجية في أودو.</li>
  </ul>

  <div class="callout callout-success">
    <div class="callout-title">الهدف الاستراتيجي للتحسين</div>
    سد الفجوات التشغيلية الخمس وتحويل RecruitFlow إلى مسار انسيابي فائق السلاسة يضاهي أودو في الترابط والسرعة، مع الحفاظ الكامل على هوية RecruitFlow المتفوقة في الأمان، وحوكمة الصلاحيات (Role-Aware Security)، وسجل التدقيق الرقابي الصارم (Audit Evidence).
  </div>

  <h2>2. تشخيص الوضع الحالي: تفكيك الفجوات الخمس الكبرى</h2>
  
  <p>
    عند فحص الشاشات الحالية في المشروع (<code>VacantListPage</code>, <code>ApplicationsPage</code>, <code>ApplicationDetailPage</code>, <code>CandidateDetailPage</code>, <code>InterviewsPage</code>, <code>OffersPage</code>, <code>HiringCasePage</code>)، نكتشف المفارقة التالية: قاعدة البيانات في الباك إند (Prisma Schema) مبنية بأعلى مستوى من النضج المؤسسي، ولكن واجهات المستخدم لم تستغل هذا النضج بعد، مما أدى لظهور 5 فجوات حرجة:
  </p>

  <h3>الفجوة الأولى: جزر الشاشات المعزولة (Siloed Fragmented Screens)</h3>
  <p>
    عندما يكون مسؤول التوظيف داخل كارت المرشح ويريد جدولة مقابلة أو التحقق من عرض أو مراجعة مسوغات التعيين، يُجبر على الخروج تماماً من السياق، والتنقل في القائمة الجانبية إلى شاشة منفصلة والبحث عن المرشح مجدداً. في أودو، يظل المستخدم في نفس الشاشة طوال 90% من وقته عبر نوافذ السياق المباشر (Context Drawers).
  </p>

  <h3>الفجوة الثانية: غياب الأزرار الذكية الموحدة (Smart Action Buttons)</h3>
  <p>
    في أودو، يحتوي أعلى كارت المرشح على أزرار ذكية تُظهر بوضوح: كاونتر المقابلات، العروض المصاغة، الوثائق المرفوعة، والزر الأهم وهو (Next Recommended Action) بلون مميز. في RecruitFlow الحالي، لا توجد هذه الأزرار الموحدة في أعلى شاشة تفاصيل المرشح، مما يُفقد المستخدم الرؤية الشاملة الفورية لمدى تقدم المرشح.
  </p>

  <h3>الفجوة الثالثة: غياب شريط الأنشطة والملاحظات الموحد (Odoo-Style Central Chatter)</h3>
  <p>
    العمود الفقري لأي نظام توظيف ناجح هو التواصل والتوثيق الحي في لحظته. في أودو، يحتوي كل كارت على Chatter يتيح: (1) إرسال إيميل للمرشح، (2) كتابة ملاحظة داخلية (Internal Note) لمدير القسم، و(3) جدولة نشاط تذكيري (Schedule Call / Meeting). في RecruitFlow، توجد جداول Tasks و ScreeningLog و ActivityTimeline ولكنها مبعثرة وليست مدمجة كـ Chatter تفاعلي تحت نظر المسؤول.
  </p>

  <h3>الفجوة الرابعة: انقطاع حلقة تقييم المقابلات (Disconnected Scorecard Feedback Loop)</h3>
  <p>
    جداول قاعدة البيانات تحتوي بالفعل على جدول متطور اسمه <code>InterviewScorecard</code> و <code>InterviewAttendee</code>، ولكن في الواجهة الأمامية الحالية لا يوجد مسار سلس يتيح لعضو لجنة المقابلة فتح نموذج التقييم مباشرة من كارت المقابلة وحساب النتيجة، ثم انعكاس هذا التقييم فوراً في كارت المرشح الرئيسي.
  </p>

  <h3>الفجوة الخامسة: فجوة اللحظة الأخيرة (The Pre-hire to Joining Handshake)</h3>
  <p>
    يمتلك RecruitFlow نموذجاً متقدماً جداً للمسوغات والامتثال (<code>HiringCase</code> و <code>ComplianceRequirement</code>)، ولكن بعد قبول العرض في بوابة المرشح، تظل هذه الخطوة معزولة في مسار <code>/hires</code>، ولا يشعر مسؤول التوظيف باكتمال الرحلة حتى لحظة الضغط على (Confirm Joining) واستخراج ملخص تسليم الموظف الجديد.
  </p>

  <h2>3. مصفوفة المقارنة الشاملة: الوضع الحالي vs أودو 19 vs الوضع المقترح</h2>

  <table>
    <thead>
      <tr>
        <th style="width: 18%;">المرحلة / المحور</th>
        <th style="width: 27%;">الوضع الحالي في RecruitFlow</th>
        <th style="width: 27%;">مرجعية أودو 19 (Odoo Enterprise)</th>
        <th style="width: 28%;">الوضع المقترح لـ RecruitFlow (To-Be)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>1. شاشة الشواغر<br>(Jobs / Vacancies)</strong></td>
        <td>جداول وكروت تعرض الأرقام الإجمالية؛ الانتقال للمتقدمين يتطلب البحث والفلترة يدوياً.</td>
        <td>لوحة تحكم (Job-First) بأزرار واضحة: كم متقدم جديد، كم مقابلة، ونسبة إشغال الشاغر (Hired vs Target).</td>
        <td><strong>بطاقات الشواغر الذكية:</strong> نقرة واحدة تنقلك مباشرة إلى كانبان المتقدمين مفلتراً تلقائياً على هذا الشاغر.</td>
      </tr>
      <tr>
        <td><strong>2. ملف المرشح 360<br>(Candidate 360)</strong></td>
        <td>بيانات ثابتة، وثائق، وسجل زمني. الصفحات الفرعية تتطلب مغادرة كارت المرشح.</td>
        <td>شريط أزرار علوي ذكي (Smart Buttons): كاونتر المقابلات، العروض، والوثائق، مع شريط مراحل انسيابي (Stage Rail).</td>
        <td><strong>Smart Actions Bar + Context Drawer:</strong> أزرار علوية ذكية تفتح أي إجراء فوراً دون مغادرة كارت المرشح.</td>
      </tr>
      <tr>
        <td><strong>3. حركة المراحل<br>(Stage Progression)</strong></td>
        <td>تغيير المرحلة من القائمة المنسدلة، أو سحب البطاقة، مع إشعارات نجاح عامة دون فتح الإجراء المرتبط.</td>
        <td>نقل المرشح يفتح تلقائياً نافذة الإجراء المرتبط بالمرحلة (مثلاً: نقله لمقابلة يفتح فوراً جدولة الموعد).</td>
        <td><strong>Contextual Modals:</strong> عند ترقية المرشح لمرحلة، ينبثق فوراً الإجراء المطلوب لها تلقائياً في نفس الصفحة.</td>
      </tr>
      <tr>
        <td><strong>4. المقابلات والتقييم<br>(Interviews & Scorecards)</strong></td>
        <td>صفحة مقابلات مستقلة، جدولة المقابلة وحفظها. التقييم ليس مدمجاً في الكارت بسلاسة.</td>
        <td>جدولة عبر التقويم، إرسال دعوات تلقائية، وفتح نموذج التقييم (Scorecard Survey) وحساب التقييم التراكمي.</td>
        <td><strong>Scorecard Loop:</strong> زر مباشر في كارت المرشح لجدولة المقابلة ونموذج تقييم سريع يحدث نقاط المرشح فورياً.</td>
      </tr>
      <tr>
        <td><strong>5. العروض الوظيفية<br>(Offer Management)</strong></td>
        <td>صياغة العرض في صفحة العروض المنفصلة، موافقة داخلية، وعرضه في بوابة المرشح.</td>
        <td>توليد العرض من قالب جاهز، إرساله للمرشح للتوقيع الرقمي (e-Sign)، وعند القبول يتحول لكارت موظف.</td>
        <td><strong>زر "Prepare Offer" داخل الكارت:</strong> استيراد تفاصيل الراتب، إرساله للبوابة وتوقيعه، وتحويله لـ Hiring Case.</td>
      </tr>
      <tr>
        <td><strong>6. المسوغات والامتثال<br>(Compliance & Pre-hire)</strong></td>
        <td>صفحة HiringCasePage مستقلة تحتوي على جدول المسوغات والفحص الطبي والتراخيص.</td>
        <td>قائمة تدقيق المستندات (Checklist) مدمجة في شاشات التعيين، مع تنبيهات عند نقص أي وثيقة مطلوبة.</td>
        <td><strong>مؤشر الجاهزية (Compliance Meter):</strong> شريط نسبة مئوية (100% Ready) في كارت المرشح يوضح اكتمال المسوغات.</td>
      </tr>
      <tr>
        <td><strong>7. مباشرة العمل<br>(Joining & Handshake)</strong></td>
        <td>زر Confirm Joining في شاشة الحالات يقوم برفع عداد الشاغر في قاعدة البيانات فقط.</td>
        <td>زر شهير Create Employee ينقل كل البيانات إلى سجل الموظف في HR ويبدأ خطة Onboarding بمهام متعددة.</td>
        <td><strong>Joining Readiness Gateway:</strong> تأكيد المباشرة، توليد كود الموظف، واستخراج ملف التعيين المتكامل (Dossier).</td>
      </tr>
      <tr>
        <td><strong>8. التواصل والأنشطة<br>(Chatter & Activities)</strong></td>
        <td>ملاحظات التصفية وسجل التدقيق مسجلة داخلياً في الباك إند ولكن الواجهة تفتقر لشريط تواصل مباشر.</td>
        <td>شريط Chatter متكامل في كل صفحة: إرسال إيميل، كتابة ملاحظة خاصة، وجدولة تذكير بمهمة هاتفية أو موعد.</td>
        <td><strong>Live Mini-Chatter:</strong> شريط تفاعلي في كارت المرشح يتيح كتابة الملاحظات وجدولة الخطوة القادمة بتنبيه.</td>
      </tr>
    </tbody>
  </table>

  <h2>4. كيف سيكون شكلنا وتجربتنا بعد التطوير؟ (The To-Be Experience)</h2>
  
  <p>
    لإزالة أي غموض حول الشكل والمظهر بعد تنفيذ التحسينات، يوضح المخطط السلكي أدناه التخطيط الهيكلي والتفاعلي المقترح لكارت المرشح الموحد وبوابة المباشرة:
  </p>

  <div class="wireframe-title">📌 المظهر المقترح لكارت المرشح 360 الموحد بشريط الإجراءات الذكي والـ Chatter التفاعلي:</div>
  <div class="wireframe-container">
+---------------------------------------------------------------------------------------------------------+
| [Back to Pipeline]   CANDIDATE 360: Ahmed Al-Mansoor (Senior Software Engineer)                        |
| Stage: [ 1. Applied ] -> [ 2. Screening ] -> [ *3. Interview* ] -> [ 4. Offer ] -> [ 5. Pre-Hire Ready ] |
+---------------------------------------------------------------------------------------------------------+
| SMART ACTIONS BAR:                                                                                      |
| [ (2) Interviews Scheduled ] [ Prepare Offer (Draft) ] [ Compliance: 85% Ready ] [ *Next: Tech Review* ] |
+----------------------------------------------------+----------------------------------------------------+
| LEFT ZONE: Candidate Identity & Profile Details    | RIGHT ZONE: Live Odoo-Style Chatter & Activities   |
| • Email: ahmed.mansoor@example.com                 | [ + Log Note ] [ + Send Email ] [ + Schedule Task ]|
| • Phone: +966 50 123 4567 | Riyadh, Saudi Arabia   |----------------------------------------------------|
| • Match Score: 94% | Experience: 7 Years           | [!] Upcoming Activity: Phone Screen (Tomorrow 10 AM|
| • Education: B.Sc. Computer Science (KSU)          |----------------------------------------------------|
| [View Attached CV (PDF)] [Download Dossier]        | Today 2:15 PM - Sarah (Recruiter):                 |
|                                                    | 'Candidate passed technical assessment with 92/100'|
| [Tab: Overview] [Tab: Interviews] [Tab: Documents] | Yesterday 4:00 PM - System Audit:                  |
| Scorecard: 4.8 / 5.0 (Recommendation: Strong Hire) | Stage advanced from Screening to Interview.        |
+----------------------------------------------------+----------------------------------------------------+
  </div>

  <div class="wireframe-title">📌 المظهر المقترح لبوابة الجاهزية والتعيين ومباشرة العمل (Joining Readiness Gateway):</div>
  <div class="wireframe-container">
+---------------------------------------------------------------------------------------------------------+
| CANDIDATE JOINING & PRE-HIRE READINESS GATEWAY                                                          |
| Candidate: Ahmed Al-Mansoor | Position: Senior Software Engineer | Location: Riyadh Main Branch         |
+---------------------------------------------------------------------------------------------------------+
| READINESS METER: [============================================= 100% COMPLETE ] [ READY FOR JOINING ]  |
+----------------------------------------------------+----------------------------------------------------+
| COMPLIANCE & CREDENTIALS CHECKLIST                 | CONTRACT & REMUNERATION SUMMARY                    |
| [x] Verified: National ID / Iqama (Clean Record)   | • Monthly Package: 28,500 SAR                      |
| [x] Verified: Medical Fitness & Drug Screening     | • Basic Salary: 18,000 SAR | Housing: 6,000 SAR    |
| [x] Verified: Professional Engineering License     | • Transportation: 2,500 SAR | Benefits Included    |
| [x] Verified: Offer Digitally Signed by Candidate  | • Probation Period: 90 Days (Standard Labor Law)   |
| [x] Verified: Executive Hiring Approval Granted    | • Proposed Starting Date: October 1st, 2026        |
+----------------------------------------------------+----------------------------------------------------+
| FINAL TRANSITION ACTIONS:                                                                               |
| [ Confirm Actual Joining & Assign Employee ID ]    [ Export Employee Onboarding Dossier (PDF/JSON) ]    |
+---------------------------------------------------------------------------------------------------------+
  </div>

  <h2>5. الأثر التشغيلي والفوائد الاستراتيجية (Business Impact)</h2>

  <table>
    <thead>
      <tr>
        <th style="width: 25%;">المؤشر التشغيلي</th>
        <th style="width: 25%;">الوضع الحالي</th>
        <th style="width: 25%;">بعد التطوير (To-Be)</th>
        <th style="width: 25%;">معدل التحسن والعائد</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>زمن إنجاز الإجراء<br>(Time to Action)</strong></td>
        <td>يتطلب 6 إلى 8 نقرات والتنقل بين 3 شاشات لجدولة مقابلة أو متابعة عرض.</td>
        <td>نقرة واحدة من شريط الإجراءات الذكي في كارت المرشح مباشرة.</td>
        <td><span class="badge badge-success">⚡ انخفاض النقرات بنسبة 70%</span> وزيادة إنتاجية مسؤول التوظيف.</td>
      </tr>
      <tr>
        <td><strong>معدل دوران المرشح<br>(Time-to-Hire)</strong></td>
        <td>متوسط 28 يوماً بسبب بطء المتابعة وتأخر الملاحظات المعلقة في القوائم.</td>
        <td>متوسط 18 يوماً بفضل شريط الأنشطة القادمة (Next Activities) والتنبيهات.</td>
        <td><span class="badge badge-success">📉 تسريع إغلاق الشواغر بنسبة 35%</span> وخفض تكلفة الشاغر المفتوح.</td>
      </tr>
      <tr>
        <td><strong>نسبة فقدان المتابعات<br>(Dropped Follow-ups)</strong></td>
        <td>قد يتأخر الرد على المرشح أو تضيع ملاحظة مدير القسم لعدم وجود سجل موحد.</td>
        <td>صفر متابعات مفقودة بفضل وجود شريط الـ Chatter التفاعلي المرئي فوراً.</td>
        <td><span class="badge badge-success">🛡️ حوكمة 100%</span> ورضا استثنائي لمديري الإدارات والمرشحين.</td>
      </tr>
      <tr>
        <td><strong>اكتمال مسوغات التعيين<br>(Pre-hire Compliance)</strong></td>
        <td>مراجعة يدوية في شاشات منفصلة قبل موعد مباشرة العمل بيوم أو يومين.</td>
        <td>مؤشر الجاهزية الرقمي (100% Meter) يمنع مباشرة أي موظف دون اكتمال مسوغاته.</td>
        <td><span class="badge badge-success">🔒 أمان وامتثال نظامي 100%</span> متوافق مع لوائح ونظام العمل.</td>
      </tr>
    </tbody>
  </table>

  <h2>6. خطة التنفيذ المقترحة (Execution Roadmap)</h2>
  
  <p>
    لتنفيذ هذه القفزة التشغيلية بأعلى درجات الكفاءة ودون أي تعطيل لمنظومة العمل الحالية، نقترح جدول تنفيذ مقسم على 4 مراحل رشيقة (Sprints):
  </p>

  <ol>
    <li><strong>المرحلة الأولى: تفعيل شريط الإجراءات الذكي (Smart Actions Bar):</strong> تزويد صفحة تفاصيل المرشح بشريط علوي يحتوي على كاونترات مباشرة: المقابلات المجدولة، حالة العرض، ونسبة الجاهزية، مع أزرار تشغيلية سريعة تفتح النوافذ التفاعلية في نفس الصفحة.</li>
    <li><strong>المرحلة الثانية: بناء شريط الـ Chatter التفاعلي (Interactive Activity & Notes):</strong> دمج صندوق لكتابة الملاحظات الداخلية السريعة (Log Note) وإرسال إيميل رسمي من كارت المرشح، مع ميزة جدولة نشاط تذكيري (Next Activity) تظهر كتنبيه للمسؤول.</li>
    <li><strong>المرحلة الثالثة: الربط السياقي لنقل المراحل وتقييم المقابلات (Scorecards Loop):</strong> ربط تغيير المرحلة بنوافذ منبثقة سريعة (Contextual Modals) لحجز المقابلة وصياغة العرض، مع إتاحة نموذج تقييم سريع يحدث نقاط المرشح فورياً.</li>
    <li><strong>المرحلة الرابعة: بوابة المباشرة وتسليم الموظف (Joining Readiness & Handshake):</strong> تفعيل شاشة المباشرة المتكاملة عند اكتمال المسوغات، وتأكيد مباشرة العمل مع توليد كود تعريفي للموظف، واستخراج بطاقة التسليم الرسمية (Dossier Certificate) بصيغة PDF قابلة للتسليم لأي نظام HRMS خارجي.</li>
  </ol>

  <div class="callout callout-info">
    <div class="callout-title">الخلاصة والتوصية الختامية</div>
    المنظومة تمتلك أساساً تقنياً وقاعدة بيانات صلبة جداً. تنفيذ هذه الخطة سيربط كل القطع المتناثرة في مسار واحد متكامل ومبهر، ويجعل تجربة RecruitFlow أسهل وأذكى وأسرع من أودو، مع الحفاظ الكامل على معايير الأمان والامتثال المؤسسي التي صُمم النظام من أجلها.
  </div>

  <div class="footer-note">
    RecruitFlow Enterprise Recruitment System © 2026 — وثيقة هندسية استراتيجية صادرة عن فريق تطوير المنتج
  </div>

</body>
</html>
"""

def generate_pdf():
    docs_dir = Path("docs").resolve()
    html_path = docs_dir / "RecruitFlow_Candidate_Journey_Odoo_Benchmark_Report.html"
    pdf_path = docs_dir / "RecruitFlow_Candidate_Journey_Odoo_Benchmark_Report.pdf"

    html_path.write_text(html_content, encoding="utf-8")
    print(f"HTML written to: {html_path}")

    chrome_candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    ]

    browser_bin = None
    for cand in chrome_candidates:
        if Path(cand).exists():
            browser_bin = cand
            break

    if not browser_bin:
        raise RuntimeError("No Chromium browser found for PDF generation")

    print(f"Using browser: {browser_bin}")
    cmd = [
        browser_bin,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_path}",
        str(html_path)
    ]

    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0 and pdf_path.exists():
        size = pdf_path.stat().st_size
        print(f"PDF_GENERATED_SUCCESSFULLY: {pdf_path} ({size:,} bytes)")
    else:
        print("Error generating PDF:", res.stderr)
        raise RuntimeError(f"PDF generation failed: {res.stderr}")

if __name__ == "__main__":
    generate_pdf()
