const path = require('node:path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const { PrismaClient } = require('../generated/client');
const prisma = new PrismaClient();

// Comprehensive position requirements dictionary tailored for Saudi German Health (SGH)
const POSITION_REQUIREMENTS = {
  'STAFF-NURSE': {
    title: 'Registered Nurse',
    department: 'Inpatient Nursing & ICU',
    location: 'SGH Riyadh Hospital',
    minExperienceYears: 3,
    requiredSkills: ['Critical Care', 'Patient Assessment', 'BLS', 'ACLS', 'Medication Administration', 'IV Therapy', 'Triage', 'EHR'],
    certifications: ['SCFHS Nursing Specialist', 'BLS', 'ACLS'],
    jobSummary: 'Provides specialized inpatient nursing and critical care across medical-surgical and intensive care units.',
    description: 'The Registered Nurse delivers direct patient care, administers medications, monitors vital signs, and collaborates with interdisciplinary healthcare teams to ensure clinical excellence.',
    responsibilities: 'Conduct comprehensive patient assessments; administer IV medications; maintain strict infection control; document clinical notes in EHR; respond to clinical emergencies.',
    qualifications: 'Bachelor of Science in Nursing (BSN); Valid SCFHS Nursing Specialist license; active BLS and ACLS certifications; minimum 3 years acute hospital experience.',
  },
  'CONS-CARDIO': {
    title: 'Consultant Cardiologist Intervention',
    department: 'Cardiology Department',
    location: 'SGH Riyadh Hospital',
    minExperienceYears: 10,
    requiredSkills: ['Interventional Cardiology', 'Cardiac Catheterization', 'Angioplasty', 'Echocardiography', 'Coronary Care', 'Clinical Leadership', 'Stent Implantation'],
    certifications: ['SCFHS Consultant', 'Saudi Board Cardiology / Equivalent Fellow'],
    jobSummary: 'Leads complex interventional cardiac procedures, catheterization laboratory sessions, and inpatient cardiac management.',
    description: 'Senior clinical leader responsible for catheterization laboratory interventions, emergency STEMI management, cardiac consultations, and clinical governance.',
    responsibilities: 'Perform diagnostic cardiac catheterization and percutaneous coronary intervention (PCI); lead cardiac emergencies; supervise junior medical staff; participate in clinical morbidity reviews.',
    qualifications: 'Medical Degree (MD/MBBS) + Board Certification in Cardiology with Interventional Fellowship; active SCFHS Consultant license; minimum 10 years post-specialization.',
  },
  'SPEC-CARDIO': {
    title: 'Cardiology Specialist',
    department: 'Cardiology Department',
    location: 'SGH Jeddah Clinic',
    minExperienceYears: 5,
    requiredSkills: ['Non-Invasive Cardiology', 'Echocardiography', 'ECG Interpretation', 'Holter Monitoring', 'Inpatient Cardiac Care', 'ACLS'],
    certifications: ['SCFHS Specialist Cardiology', 'BLS', 'ACLS'],
    jobSummary: 'Performs non-invasive cardiac diagnostic evaluations, inpatient cardiac monitoring, and outpatient clinics.',
    description: 'Specialist physician providing comprehensive cardiology assessments, transthoracic echocardiography, treadmill stress tests, and outpatient hypertension management.',
    responsibilities: 'Interpret 12-lead ECGs and 24-hr Holter records; perform echocardiograms; manage acute coronary cases in CCU; conduct outpatient clinics.',
    qualifications: 'Master Degree / Saudi Board in Cardiology; active SCFHS Specialist registration; minimum 5 years clinical cardiology practice.',
  },
  'PHARM-SPEC': {
    title: 'Clinical Pharmacist',
    department: 'Pharmacy Services',
    location: 'SGH Riyadh Hospital',
    minExperienceYears: 4,
    requiredSkills: ['Pharmacotherapy', 'Clinical Pharmacy', 'Medication Dispensing', 'Drug Interaction Review', 'TDM', 'Sterile Compounding', 'Patient Counseling'],
    certifications: ['SCFHS Pharmacist', 'BCPS Board Certified'],
    jobSummary: 'Ensures optimal therapeutic drug monitoring, patient medication safety, and clinical pharmacy interventions.',
    description: 'Collaborates with attending physicians to review medication orders, optimize drug regimens, conduct therapeutic drug monitoring (TDM), and ensure patient safety.',
    responsibilities: 'Review patient drug charts for contraindications; calculate pharmacokinetic doses; prepare parenteral nutrition; counsel discharged patients on medication adherence.',
    qualifications: 'Doctor of Pharmacy (PharmD); active SCFHS Clinical Pharmacist license; BCPS certification preferred; minimum 4 years hospital experience.',
  },
  'SR-PHARM': {
    title: 'Senior Pharmacist',
    department: 'Pharmacy Services',
    location: 'Dubai Medical Center',
    minExperienceYears: 7,
    requiredSkills: ['Inpatient Pharmacy', 'Inventory Management', 'Clinical Auditing', 'Chemotherapy Preparation', 'Pharmacovigilance', 'Narcotics Control'],
    certifications: ['DHA / SCFHS Senior Pharmacist License', 'Clinical Pharmacy Master'],
    jobSummary: 'Supervises hospital inpatient pharmacy operations, sterile compounding, and pharmaceutical compliance.',
    description: 'Oversees daily pharmacy dispensing, automated dispensing cabinets, controlled narcotics logs, chemotherapy admixture, and junior pharmacist training.',
    responsibilities: 'Manage medication supply chain; conduct ADR reporting; enforce GMP and JCI pharmaceutical standards; supervise pharmacy shifts.',
    qualifications: 'BSc Pharmacy or PharmD + Master degree; active DHA / SCFHS license; minimum 7 years progressive hospital pharmacy leadership.',
  },
  'RAD-TECH': {
    title: 'Radiology Technician',
    department: 'Medical Imaging & Radiology',
    location: 'SGH Riyadh Hospital',
    minExperienceYears: 3,
    requiredSkills: ['MRI Operation', 'CT Scan', 'Diagnostic X-Ray', 'Radiation Safety', 'PACS / RIS Systems', 'Patient Positioning', 'Contrast Media Administration'],
    certifications: ['SCFHS Radiologic Technologist', 'Radiation Protection Certification'],
    jobSummary: 'Operates advanced diagnostic radiological equipment including MRI, multislice CT, and digital radiography.',
    description: 'Produces high-quality diagnostic medical images while maintaining strict ALARA radiation safety standards and patient comfort.',
    responsibilities: 'Position patients correctly for imaging; execute MRI and CT scanning protocols; upload studies to PACS; monitor contrast administration safety.',
    qualifications: 'Bachelor in Radiologic Technology / Medical Imaging; active SCFHS Radiologic Technologist license; minimum 3 years experience.',
  },
  'CONS-PSYCH': {
    title: 'Consultant Psychiatrist',
    department: 'Behavioral Health & Psychiatry',
    location: 'SGH Jeddah Clinic',
    minExperienceYears: 8,
    requiredSkills: ['Clinical Psychiatry', 'Psychopharmacology', 'Inpatient Psychiatric Care', 'Psychotherapy', 'Mental Health Assessment', 'Cognitive Assessment'],
    certifications: ['SCFHS Consultant Psychiatrist', 'Saudi Board / Arab Board / MRCPsych'],
    jobSummary: 'Leads clinical diagnosis, treatment planning, and psychopharmacology for complex psychiatric conditions.',
    description: 'Senior medical consultant delivering evidence-based diagnostic assessments, acute crisis stabilization, psychotherapy supervision, and mood disorder treatment.',
    responsibilities: 'Diagnose psychiatric disorders; prescribe and monitor psychotropic medications; provide crisis intervention; lead behavioral health case conferences.',
    qualifications: 'MD/MBBS with Board certification in Psychiatry; active SCFHS Consultant license; minimum 8 years practice.',
  },
  'COUNS-PSYCH': {
    title: 'Clinical Counselor',
    department: 'Behavioral Health & Psychiatry',
    location: 'SGH Riyadh Hospital',
    minExperienceYears: 4,
    requiredSkills: ['Cognitive Behavioral Therapy (CBT)', 'Psychological Counseling', 'Crisis Intervention', 'Family Therapy', 'Mental Wellness', 'Stress Management'],
    certifications: ['SCFHS Clinical Psychologist / Counselor', 'Master in Clinical Psychology'],
    jobSummary: 'Provides specialized psychological counseling, behavioral interventions, and psychotherapy sessions.',
    description: 'Delivers structured counseling for depression, anxiety, trauma, and bereavement through evidence-based behavioral modalities.',
    responsibilities: 'Conduct psychological intake assessments; design individualized counseling plans; deliver individual and group therapy; maintain confidential clinical records.',
    qualifications: 'Master Degree in Clinical Psychology or Counseling; active SCFHS registration; minimum 4 years clinical counseling practice.',
  },
  'CHILD-PSYCH': {
    title: 'Child Psychiatrist',
    department: 'Behavioral Health & Psychiatry',
    location: 'SGH Riyadh Hospital',
    minExperienceYears: 7,
    requiredSkills: ['Child & Adolescent Psychiatry', 'Developmental Disorders', 'Pediatric Psychopharmacology', 'Autism Spectrum Assessment', 'ADHD Management'],
    certifications: ['SCFHS Consultant Child Psychiatry', 'Pediatric Psychiatry Fellowship'],
    jobSummary: 'Specializes in the diagnosis and multimodal treatment of behavioral, developmental, and emotional conditions in youth.',
    description: 'Expert clinician evaluating neurodevelopmental disorders, childhood anxiety, behavioral dysregulation, and adolescent mental health.',
    responsibilities: 'Conduct pediatric diagnostic assessments; collaborate with schools and families; prescribe pediatric psychotropics safely; coordinate multidisciplinary care.',
    qualifications: 'Board Certification in Child & Adolescent Psychiatry; active SCFHS Consultant license; minimum 7 years dedicated pediatric practice.',
  },
  'SPEC-UROL': {
    title: 'Urology Specialist',
    department: 'Surgery & Urology',
    location: 'SGH Dammam Hospital',
    minExperienceYears: 5,
    requiredSkills: ['Endourology', 'Cystoscopy', 'Urological Surgeries', 'Lithotripsy', 'Urinary Incontinence Management', 'Prostate Care'],
    certifications: ['SCFHS Specialist Urology', 'Saudi Board Urology / Arab Board'],
    jobSummary: 'Delivers comprehensive medical and surgical urological care for urinary tract disorders and male reproductive health.',
    description: 'Specialist surgeon performing endoscopic procedures, kidney stone lithotripsy, transurethral resections, and outpatient urology clinics.',
    responsibilities: 'Perform cystoscopies and ureteroscopies; manage acute renal colic; conduct surgical pre-op and post-op care; run urology clinics.',
    qualifications: 'Master / Board in Urology; active SCFHS Specialist license; minimum 5 years surgical urology experience.',
  },
  'MIDWIFE-LDU': {
    title: 'Midwife - Labour & Delivery',
    department: 'Obstetrics & Gynecology',
    location: 'SGH Riyadh Hospital',
    minExperienceYears: 4,
    requiredSkills: ['Labor & Delivery Care', 'Fetal Heart Monitoring (CTG)', 'Postpartum Care', 'Neonatal Resuscitation (NRP)', 'Obstetric Emergency', 'BLS'],
    certifications: ['SCFHS Registered Midwife', 'NRP', 'BLS'],
    jobSummary: 'Provides expert intrapartum care, manages normal deliveries, and supports obstetricians during complex births.',
    description: 'Dedicated midwife providing compassionate care during labor, delivery, and immediate postpartum, ensuring mother and infant safety.',
    responsibilities: 'Monitor labor progression and interpret CTG tracings; conduct normal vaginal deliveries; perform neonatal resuscitation (NRP); support breastfeeding.',
    qualifications: 'BSc in Midwifery or Nursing with Midwifery diploma; active SCFHS Midwife registration; NRP and BLS certifications; minimum 4 years L&D experience.',
  },
  'SPEC-OBGYN': {
    title: 'Specialist Obs/Gyn',
    department: 'Obstetrics & Gynecology',
    location: 'SGH Jeddah Clinic',
    minExperienceYears: 6,
    requiredSkills: ['Cesarean Section', 'Obstetric Ultrasound', 'High-Risk Pregnancy', 'Gynecological Laparoscopy', 'Antenatal Care', 'Colposcopy'],
    certifications: ['SCFHS Specialist Obstetrics & Gynecology', 'Arab Board / MRCOG'],
    jobSummary: 'Delivers high-level obstetric and gynecological care including operative deliveries and gynecologic surgeries.',
    description: 'Specialist physician providing maternal-fetal surveillance, antenatal screenings, emergency obstetric surgery, and outpatient gynecology care.',
    responsibilities: 'Perform emergency and elective Cesarean sections; conduct detailed obstetric ultrasound; manage high-risk pregnancies; perform minor gynecological surgeries.',
    qualifications: 'Saudi Board / Arab Board / MRCOG in Obstetrics & Gynecology; active SCFHS Specialist registration; minimum 6 years experience.',
  },
  'SPEC-DERMA': {
    title: 'Specialist Dermatologist',
    department: 'Dermatology & Cosmetics',
    location: 'SGH Riyadh Hospital',
    minExperienceYears: 5,
    requiredSkills: ['Clinical Dermatology', 'Cosmetic Procedures', 'Laser Therapy', 'Biopsy & Cryotherapy', 'Skin Cancer Screening', 'Botox & Fillers'],
    certifications: ['SCFHS Specialist Dermatology', 'Dermatology Board'],
    jobSummary: 'Diagnoses dermatologic conditions and performs aesthetic dermatology and cutaneous laser interventions.',
    description: 'Provides advanced diagnostic evaluations for cutaneous diseases, hair disorders, dermato-surgery, and cosmetic dermatology.',
    responsibilities: 'Treat chronic dermatoses; perform diagnostic skin biopsies and cryotherapy; execute cosmetic laser procedures; conduct outpatient dermatology clinics.',
    qualifications: 'Board / Master Degree in Dermatology; active SCFHS Specialist license; minimum 5 years practice in clinical and cosmetic dermatology.',
  },
  'DENT-ASST': {
    title: 'Dental Assistant',
    department: 'Dental Department',
    location: 'SGH Riyadh Hospital',
    minExperienceYears: 2,
    requiredSkills: ['Four-Handed Dentistry', 'Dental Sterilization', 'Dental Radiography', 'Chairside Assistance', 'Impression Taking', 'Infection Control'],
    certifications: ['SCFHS Dental Assistant', 'BLS'],
    jobSummary: 'Assists dental surgeons chairside, prepares operatory rooms, and sterilizes dental instruments.',
    description: 'Supports dentists during restorative, endodontic, and surgical procedures, ensuring patient comfort and dental asepsis.',
    responsibilities: 'Prepare dental instruments and materials; operate dental suction and retraction; take periapical and panoramic X-rays; maintain autoclave logs.',
    qualifications: 'Diploma in Dental Assisting; active SCFHS Dental Assistant registration; active BLS; minimum 2 years chairside experience.',
  },
  'MED-CODER': {
    title: 'Certified Medical Coder',
    department: 'Health Informatics & Revenue Cycle',
    location: 'SGH Riyadh Hospital',
    minExperienceYears: 3,
    requiredSkills: ['ICD-10-AM', 'ACHI Procedure Coding', 'SBS Coding', 'Insurance Claim Pre-authorization', 'Revenue Cycle Management', 'Clinical Documentation Review'],
    certifications: ['AAPC / AHIMA Certified Professional Coder (CPC)', 'CHI Medical Coding'],
    jobSummary: 'Translates healthcare services, diagnoses, and medical procedures into standardized clinical codes for claims reimbursement.',
    description: 'Ensures compliant and accurate medical coding according to CCHI and Saudi Health Council coding standards, minimizing claims rejections.',
    responsibilities: 'Review patient clinical charts; assign accurate ICD-10-AM and ACHI codes; resolve billing rejections with payers; audit medical documentation.',
    qualifications: 'Certified Professional Coder (CPC/CCS) credential; CCHI accreditation; minimum 3 years healthcare revenue cycle experience.',
  },
  'SSE': {
    title: 'Senior Software Engineer',
    department: 'Digital Health & IT',
    location: 'SGH Riyadh Hospital',
    minExperienceYears: 5,
    requiredSkills: ['TypeScript', 'Node.js', 'React', 'PostgreSQL', 'Microservices', 'Docker', 'System Design', 'CI/CD Pipelines'],
    certifications: ['AWS Certified Solutions Architect', 'Clean Architecture'],
    jobSummary: 'Architects and engineers high-availability healthcare enterprise software, APIs, and microservices.',
    description: 'Senior engineer driving technical design, resilient database models, automated pipelines, and cloud services powering hospital digital workflows.',
    responsibilities: 'Design and implement RESTful APIs; optimize database schemas and queries; lead code reviews; mentor junior developers; ensure zero-downtime deployments.',
    qualifications: 'Bachelor in Computer Science or Software Engineering; minimum 5 years full-stack engineering with TypeScript and relational databases.',
  },
  'FE-ENG': {
    title: 'Frontend Engineer',
    department: 'Digital Health & IT',
    location: 'SGH Riyadh Hospital',
    minExperienceYears: 3,
    requiredSkills: ['React', 'TypeScript', 'TailwindCSS', 'Next.js', 'State Management', 'Web Performance', 'REST API', 'Design Systems'],
    certifications: ['Frontend Specialist Certification'],
    jobSummary: 'Builds modern, responsive, and intuitive web interfaces for clinicians, recruiters, and administrative staff.',
    description: 'Implements accessible, highly responsive design systems and reactive dashboards for hospital operational workflows.',
    responsibilities: 'Translate Figma UI designs into pixel-perfect React components; manage client state and caching; optimize browser performance; write component unit tests.',
    qualifications: 'Bachelor degree in CS or related field; minimum 3 years modern React and TypeScript frontend development experience.',
  },
  'CYBER-ENG': {
    title: 'Cyber Security Engineer',
    department: 'Information Security & GRC',
    location: 'SGH Riyadh Hospital',
    minExperienceYears: 4,
    requiredSkills: ['Information Security', 'NCA ECC Compliance', 'Vulnerability Assessment', 'Firewall Management', 'SIEM / SOC Operations', 'Incident Response'],
    certifications: ['CISSP / CEH / CISM', 'NCA Compliance Specialist'],
    jobSummary: 'Secures hospital digital assets, clinical databases, and ensures compliance with National Cybersecurity Authority (NCA) controls.',
    description: 'Protects critical health information systems against unauthorized access, coordinates threat monitoring, and manages cybersecurity incident response.',
    responsibilities: 'Monitor SIEM alerts and investigate security anomalies; conduct periodic vulnerability assessments; enforce NCA ECC cybersecurity controls; audit access logs.',
    qualifications: 'Bachelor in Cybersecurity or Computer Networks; CEH/CISSP certification; minimum 4 years enterprise cybersecurity experience.',
  },
  'IT-SUPP': {
    title: 'IT Support Specialist',
    department: 'Digital Health & IT',
    location: 'SGH Jeddah Clinic',
    minExperienceYears: 2,
    requiredSkills: ['Hospital HIS / EHR Support', 'Network Troubleshooting', 'Hardware Maintenance', 'Helpdesk Ticketing', 'Active Directory', 'Printer & Peripheral Setup'],
    certifications: ['CompTIA A+ / Network+', 'ITIL Foundation'],
    jobSummary: 'Provides technical support for hospital end-user hardware, network connectivity, and clinical application workstations.',
    description: 'Ensures reliable operation of desktop workstations, mobile clinical tablets, biometric scanners, and hospital network infrastructure.',
    responsibilities: 'Resolve helpdesk tickets within SLA; install and configure clinic workstations; troubleshoot network drops and printers; assist clinical staff with HIS logins.',
    qualifications: 'Diploma or Bachelor in Information Technology; CompTIA A+ preferred; minimum 2 years hospital helpdesk experience.',
  },
  'HR-SPEC': {
    title: 'Talent Acquisition Specialist',
    department: 'Human Resources',
    location: 'SGH Riyadh Hospital',
    minExperienceYears: 4,
    requiredSkills: ['Healthcare Recruitment', 'Applicant Tracking Systems (ATS)', 'Candidate Sourcing', 'SCFHS Credentialing', 'Interviewing', 'Salary Negotiation'],
    certifications: ['CIPD / SHRM-CP', 'Healthcare HR Professional'],
    jobSummary: 'Manages end-to-end clinical and administrative recruitment, candidate sourcing, and onboarding for SGH facilities.',
    description: 'Drives sourcing campaigns, conducts preliminary screenings, coordinates panel interviews, and guides foreign healthcare professionals through SCFHS credentialing.',
    responsibilities: 'Source top clinical talent across regional channels; manage requisition pipelines in ATS; arrange interviews with Department Heads; prepare compliant offer packages.',
    qualifications: 'Bachelor in Human Resources, Business, or Healthcare Management; CIPD or SHRM certification; minimum 4 years healthcare recruitment experience.',
  },
  'SALES-EXEC': {
    title: 'Medical Sales Executive',
    department: 'Commercial & Business Development',
    location: 'SGH Dammam Hospital',
    minExperienceYears: 3,
    requiredSkills: ['Healthcare Sales', 'B2B Client Relationship', 'Insurance Corporate Accounts', 'Market Analysis', 'Revenue Targets', 'Contract Negotiation'],
    certifications: ['Medical Representative Certification'],
    jobSummary: 'Develops corporate hospital client relationships, corporate health packages, and insurer partnerships.',
    description: 'Drives B2B corporate partnerships, executive health packages, and group medical screening contracts across the Eastern Province.',
    responsibilities: 'Generate corporate sales leads; negotiate corporate medical agreements; meet monthly revenue quotas; maintain corporate client relationships.',
    qualifications: 'Bachelor in Business Administration or Life Sciences; minimum 3 years proven sales experience in healthcare/pharma sector.',
  },
  'CSR-LEAD': {
    title: 'CSR & Patient Relations Team Leader',
    department: 'Patient Relations & Customer Care',
    location: 'SGH Riyadh Hospital',
    minExperienceYears: 4,
    requiredSkills: ['Patient Experience', 'Customer Service Management', 'Complaint Resolution', 'Hospital Front Office', 'Bilingual Arabic/English', 'Service Recovery'],
    certifications: ['Certified Patient Experience Professional (CPXP)'],
    jobSummary: 'Leads front-line hospital patient experience officers, admissions desks, and patient advocacy desks.',
    description: 'Ensures world-class patient hospitality, supervises outpatient reception teams, manages patient feedback and resolves complaints with empathy and speed.',
    responsibilities: 'Supervise hospital front-desk officers; conduct daily patient satisfaction rounds; de-escalate patient complaints; analyze monthly NPS scores.',
    qualifications: 'Bachelor degree; bilingual in Arabic and English; minimum 4 years hospitality or hospital customer care leadership.',
  }
};

// Rich Candidate Bench profiles for instant multi-tier comparison
const CANDIDATE_BENCH_PROFILES = [
  {
    firstName: 'Dr. Tariq',
    lastName: 'Al-Mansoor',
    email: 'tariq.mansoor@cardio.med.sa',
    currentTitle: 'Consultant Interventional Cardiologist',
    experienceYears: 12,
    location: 'SGH Riyadh Hospital',
    skills: ['Interventional Cardiology', 'Cardiac Catheterization', 'Angioplasty', 'Echocardiography', 'Coronary Care', 'Clinical Leadership', 'Stent Implantation', 'ACLS'],
    certifications: ['SCFHS Consultant', 'Saudi Board Cardiology / Equivalent Fellow', 'BLS', 'ACLS'],
  },
  {
    firstName: 'Noura',
    lastName: 'Al-Ghamdi',
    email: 'noura.ghamdi@nursing.sgh.sa',
    currentTitle: 'Senior ICU Charge Nurse',
    experienceYears: 6,
    location: 'SGH Riyadh Hospital',
    skills: ['Critical Care', 'Patient Assessment', 'BLS', 'ACLS', 'Medication Administration', 'IV Therapy', 'Triage', 'EHR', 'Mechanical Ventilation'],
    certifications: ['SCFHS Nursing Specialist', 'BLS', 'ACLS'],
  },
  {
    firstName: 'Dr. Faisal',
    lastName: 'Al-Zahrani',
    email: 'faisal.zahrani@pharma.sgh.sa',
    currentTitle: 'Clinical Pharmacist Specialist',
    experienceYears: 5,
    location: 'SGH Riyadh Hospital',
    skills: ['Pharmacotherapy', 'Clinical Pharmacy', 'Medication Dispensing', 'Drug Interaction Review', 'TDM', 'Sterile Compounding', 'Patient Counseling'],
    certifications: ['SCFHS Pharmacist', 'BCPS Board Certified'],
  },
  {
    firstName: 'Mohammed',
    lastName: 'Al-Otaibi',
    email: 'm.otaibi@radiology.med.sa',
    currentTitle: 'Senior Radiologic Technologist',
    experienceYears: 4,
    location: 'SGH Riyadh Hospital',
    skills: ['MRI Operation', 'CT Scan', 'Diagnostic X-Ray', 'Radiation Safety', 'PACS / RIS Systems', 'Patient Positioning', 'Contrast Media Administration'],
    certifications: ['SCFHS Radiologic Technologist', 'Radiation Protection Certification'],
  },
  {
    firstName: 'Rania',
    lastName: 'Al-Khatib',
    email: 'rania.khatib@coding.sgh.sa',
    currentTitle: 'Lead Medical Coder',
    experienceYears: 5,
    location: 'SGH Riyadh Hospital',
    skills: ['ICD-10-AM', 'ACHI Procedure Coding', 'SBS Coding', 'Insurance Claim Pre-authorization', 'Revenue Cycle Management', 'Clinical Documentation Review'],
    certifications: ['AAPC / AHIMA Certified Professional Coder (CPC)', 'CHI Medical Coding'],
  },
  {
    firstName: 'Dr. Kareem',
    lastName: 'Nasser',
    email: 'kareem.nasser@psych.sgh.sa',
    currentTitle: 'Consultant Psychiatrist',
    experienceYears: 9,
    location: 'SGH Jeddah Clinic',
    skills: ['Clinical Psychiatry', 'Psychopharmacology', 'Inpatient Psychiatric Care', 'Psychotherapy', 'Mental Health Assessment', 'Cognitive Assessment'],
    certifications: ['SCFHS Consultant Psychiatrist', 'Saudi Board / Arab Board / MRCPsych'],
  },
  {
    firstName: 'Fatima',
    lastName: 'Al-Harbi',
    email: 'fatima.harbi@midwife.sgh.sa',
    currentTitle: 'Staff Midwife - L&D',
    experienceYears: 5,
    location: 'SGH Riyadh Hospital',
    skills: ['Labor & Delivery Care', 'Fetal Heart Monitoring (CTG)', 'Postpartum Care', 'Neonatal Resuscitation (NRP)', 'Obstetric Emergency', 'BLS'],
    certifications: ['SCFHS Registered Midwife', 'NRP', 'BLS'],
  },
  {
    firstName: 'Abdullah',
    lastName: 'Al-Shehri',
    email: 'a.shehri@dev.sgh.sa',
    currentTitle: 'Lead Full-Stack Engineer',
    experienceYears: 6,
    location: 'SGH Riyadh Hospital',
    skills: ['TypeScript', 'Node.js', 'React', 'PostgreSQL', 'Microservices', 'Docker', 'System Design', 'CI/CD Pipelines'],
    certifications: ['AWS Certified Solutions Architect', 'Clean Architecture'],
  },
  {
    firstName: 'Sara',
    lastName: 'Al-Dossary',
    email: 'sara.dossary@cyber.sgh.sa',
    currentTitle: 'Information Security Specialist',
    experienceYears: 4,
    location: 'SGH Riyadh Hospital',
    skills: ['Information Security', 'NCA ECC Compliance', 'Vulnerability Assessment', 'Firewall Management', 'SIEM / SOC Operations', 'Incident Response'],
    certifications: ['CISSP / CEH / CISM', 'NCA Compliance Specialist'],
  },
  {
    firstName: 'Dr. Hisham',
    lastName: 'Mahmoud',
    email: 'hisham.mahmoud@urology.med.sa',
    currentTitle: 'Urology Specialist',
    experienceYears: 7,
    location: 'SGH Dammam Hospital',
    skills: ['Endourology', 'Cystoscopy', 'Urological Surgeries', 'Lithotripsy', 'Urinary Incontinence Management', 'Prostate Care'],
    certifications: ['SCFHS Specialist Urology', 'Saudi Board Urology / Arab Board'],
  }
];

async function main() {
  console.log('--- ENRICHING POSITIONS & REQUIREMENTS IN DATABASE ---');

  const org = await prisma.organization.findFirst({
    where: { code: 'RECRUITFLOW-DEMO' },
  });
  if (!org) throw new Error('RECRUITFLOW-DEMO organization not found');

  const branches = await prisma.branch.findMany({
    where: { organizationId: org.id },
  });
  const defaultBranch = branches[0];
  const branchMap = {};
  branches.forEach(b => {
    branchMap[b.city || b.name] = b;
  });

  const adminUser = await prisma.user.findFirst({
    where: { organizationId: org.id, emailNormalized: 'admin@sgh.com' },
  }) || await prisma.user.findFirst({ where: { organizationId: org.id } });

  // 1. Process each position in POSITION_REQUIREMENTS
  for (const [code, req] of Object.entries(POSITION_REQUIREMENTS)) {
    console.log(`\n[Syncing Position: ${code} - ${req.title}]`);

    // Find or create Position
    let position = await prisma.position.findFirst({
      where: { organizationId: org.id, code },
    });

    if (!position) {
      position = await prisma.position.create({
        data: {
          organizationId: org.id,
          code,
          title: req.title,
          description: req.description,
          status: 'Active',
        },
      });
      console.log(`  + Created position record: ${position.id}`);
    } else {
      position = await prisma.position.update({
        where: { id: position.id },
        data: {
          title: req.title,
          description: req.description,
          status: 'Active',
        },
      });
      console.log(`  * Updated position record: ${position.id}`);
    }

    // Determine target branch
    let targetBranch = defaultBranch;
    if (req.location.includes('Riyadh')) {
      targetBranch = branches.find(b => b.name.includes('Riyadh') || b.city === 'Riyadh') || defaultBranch;
    } else if (req.location.includes('Jeddah')) {
      targetBranch = branches.find(b => b.name.includes('Jeddah') || b.city === 'Jeddah') || defaultBranch;
    } else if (req.location.includes('Dammam')) {
      targetBranch = branches.find(b => b.name.includes('Dammam') || b.city === 'Dammam') || defaultBranch;
    }

    // Find existing vacancy for this position
    let vacancy = await prisma.vacancy.findFirst({
      where: { organizationId: org.id, positionId: position.id },
    });

    if (!vacancy) {
      // Create VacancyRequest first
      const vrCode = `VR-${code}-${Date.now().toString().slice(-4)}`;
      const vacancyRequest = await prisma.vacancyRequest.create({
        data: {
          organizationId: org.id,
          branchId: targetBranch.id,
          positionId: position.id,
          requesterId: adminUser.id,
          requestCode: vrCode,
          status: 'Approved',
          requestedHeadcount: 2,
          employmentType: 'Full-Time',
          budgetStatus: 'Approved',
          criticality: 'High',
          targetStartDate: new Date('2026-10-01'),
          justification: `Approved strategic clinical headcount for ${req.department}.`,
          jobSummary: req.jobSummary,
          description: req.description,
          responsibilities: req.responsibilities,
          qualifications: req.qualifications,
          submittedAt: new Date(),
        },
      });

      const vacCode = `VAC-SGH-${code}`;
      vacancy = await prisma.vacancy.create({
        data: {
          organizationId: org.id,
          branchId: targetBranch.id,
          positionId: position.id,
          vacancyRequestId: vacancyRequest.id,
          vacancyCode: vacCode,
          status: 'Open',
          approvedHeadcount: 2,
          openedAt: new Date(),
          targetStartDate: new Date('2026-10-01'),
          requiredSkills: req.requiredSkills,
          minExperienceYears: req.minExperienceYears,
          location: req.location,
          department: req.department,
          jobSummary: req.jobSummary,
          description: req.description,
          responsibilities: req.responsibilities,
          qualifications: req.qualifications,
          benefits: 'Competitive Tax-Free Salary + Housing Allowance + Family Medical Insurance + Annual Flights + CME Leave Allowance',
        },
      });
      console.log(`  + Created vacancy record: ${vacancy.vacancyCode}`);
    } else {
      // Update existing vacancy with full requirements
      vacancy = await prisma.vacancy.update({
        where: { id: vacancy.id },
        data: {
          status: 'Open',
          requiredSkills: req.requiredSkills,
          minExperienceYears: req.minExperienceYears,
          location: req.location,
          department: req.department,
          jobSummary: req.jobSummary,
          description: req.description,
          responsibilities: req.responsibilities,
          qualifications: req.qualifications,
          benefits: 'Competitive Tax-Free Salary + Housing Allowance + Family Medical Insurance + Annual Flights + CME Leave Allowance',
        },
      });
      console.log(`  * Updated vacancy requirements: ${vacancy.vacancyCode} (Skills: ${req.requiredSkills.length}, MinExp: ${req.minExperienceYears} yrs)`);
    }
  }

  // 2. Enrich Candidate Bench profiles in the DB
  console.log('\n--- ENRICHING CANDIDATE BENCH PROFILES ---');
  for (const cand of CANDIDATE_BENCH_PROFILES) {
    const existing = await prisma.candidate.findFirst({
      where: { organizationId: org.id, email: cand.email },
    });

    if (existing) {
      await prisma.candidate.update({
        where: { id: existing.id },
        data: {
          firstName: cand.firstName,
          lastName: cand.lastName,
          currentTitle: cand.currentTitle,
          experienceYears: cand.experienceYears,
          location: cand.location,
          skills: cand.skills,
          certifications: cand.certifications,
          status: 'Active',
        },
      });
      console.log(`  * Updated bench candidate: ${cand.firstName} ${cand.lastName} (${cand.currentTitle})`);
    } else {
      const code = `CAND-SGH-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 100)}`;
      await prisma.candidate.create({
        data: {
          organizationId: org.id,
          candidateCode: code,
          firstName: cand.firstName,
          lastName: cand.lastName,
          email: cand.email,
          phone: '+966501234567',
          currentTitle: cand.currentTitle,
          experienceYears: cand.experienceYears,
          location: cand.location,
          skills: cand.skills,
          certifications: cand.certifications,
          status: 'Active',
          source: 'Talent Bench Sourcing',
          consentStatus: 'Granted',
        },
      });
      console.log(`  + Created bench candidate: ${cand.firstName} ${cand.lastName} (${cand.currentTitle})`);
    }
  }

  console.log('\n--- SUCCESS: Database fully enriched with rich requirements and candidate benchmark data! ---');
}

main().catch(console.error).finally(() => prisma.$disconnect());
