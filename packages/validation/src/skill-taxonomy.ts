/**
 * Skill Taxonomy — Structured synonym maps and technology-to-competency mappings.
 *
 * Provides a queryable knowledge base of recruitment competencies, technologies,
 * aliases, and responsibility phrases across Healthcare, IT, Engineering, HR, and Management.
 *
 * Architecture inspired by MatchLens (skill normalization) and sliday (anchored competency matching).
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface CompetencyDimension {
  name: string;
  technologies: string[];
}

export interface CompetencyMapping {
  competency: string;
  aliases: string[];
  dimensions: CompetencyDimension[];
  responsibilityPhrases: string[];
  relatedOnlyTechnologies?: string[];
}

// ---------------------------------------------------------------------------
// Normalization Helper
// ---------------------------------------------------------------------------

function normTaxonomy(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Synonym Groups (Expanded)
// ---------------------------------------------------------------------------

export const SYNONYM_GROUPS: string[][] = [
  // ─── Healthcare & Clinical Licensure ────────────────────────
  ['scfhs', 'saudi commission for health specialties', 'saudi commission', 'scfhs license', 'scfhs registration'],
  ['bls', 'basic life support'],
  ['acls', 'advanced cardiac life support', 'advanced cardiovascular life support'],
  ['pals', 'pediatric advanced life support'],
  ['atls', 'advanced trauma life support'],
  ['cpr', 'cardiopulmonary resuscitation'],
  ['cphq', 'certified professional in healthcare quality'],
  ['cic', 'certified in infection control', 'infection control certification'],
  ['ehr', 'electronic health records', 'emr', 'electronic medical records', 'electronic patient records'],
  ['icu', 'intensive care unit', 'critical care', 'critical care unit', 'ccu'],
  ['picu', 'pediatric intensive care unit', 'pediatric intensive care', 'pediatric critical care'],
  ['nicu', 'neonatal intensive care unit', 'neonatal intensive care'],
  ['infection control', 'infection prevention and control', 'ipc', 'hospital epidemiology'],
  ['quality management', 'tqm', 'total quality management', 'healthcare quality', 'clinical quality'],
  ['phlebotomy', 'blood collection', 'venipuncture'],
  ['triage', 'emergency triage', 'patient triage'],
  ['jci', 'joint commission international', 'jci accreditation'],
  ['cbahi', 'central board for accreditation of healthcare institutions'],

  // ─── Software Engineering & Web Development ─────────────────
  ['rdbms', 'relational database', 'relational database management system', 'sql database', 'relational db'],
  ['sql', 'structured query language', 't-sql', 'pl/sql', 'tsql', 'plsql'],
  ['postgresql', 'postgres', 'psql'],
  ['mysql', 'my-sql'],
  ['mongodb', 'mongo', 'nosql document db'],
  ['react', 'react.js', 'reactjs'],
  ['next.js', 'nextjs', 'next js', 'next'],
  ['vue', 'vue.js', 'vuejs'],
  ['angular', 'angularjs', 'angular.js'],
  ['svelte', 'sveltekit'],
  ['node', 'node.js', 'nodejs'],
  ['nest', 'nest.js', 'nestjs'],
  ['express', 'express.js', 'expressjs'],
  ['typescript', 'ts'],
  ['javascript', 'js', 'es6', 'ecmascript'],
  ['python', 'py'],
  ['c#', 'csharp', 'c sharp', '.net', 'dotnet', 'asp.net', 'asp.net core', '.net core'],
  ['java', 'core java', 'j2ee', 'jakarta ee'],
  ['spring', 'spring boot', 'spring framework'],
  ['golang', 'go language', 'go lang'],
  ['rest', 'restful', 'rest api', 'rest apis', 'restful api', 'restful apis', 'web api'],
  ['graphql', 'gql'],
  ['ci/cd', 'cicd', 'continuous integration', 'continuous deployment', 'continuous delivery'],
  ['devops', 'development and operations', 'cloud devops'],
  ['k8s', 'kubernetes'],
  ['docker', 'containerization', 'containers', 'docker engine'],
  ['aws', 'amazon web services'],
  ['azure', 'microsoft azure', 'ms azure'],
  ['gcp', 'google cloud platform', 'google cloud'],
  ['qa', 'quality assurance', 'software testing', 'test engineering'],
  ['ui/ux', 'ui', 'ux', 'user interface', 'user experience', 'product design', 'ui ux design'],
  ['microservices', 'microservice architecture', 'distributed systems'],
  ['orm', 'object relational mapping', 'prisma', 'typeorm', 'hibernate', 'entity framework'],

  // ─── Data & Automation ─────────────────────────────────────
  ['bi', 'business intelligence'],
  ['power bi', 'powerbi', 'ms power bi', 'microsoft power bi'],
  ['tableau', 'tableau desktop', 'tableau server'],
  ['etl', 'extract transform load', 'data pipeline', 'data pipelines', 'data ingestion'],
  ['ml', 'machine learning'],
  ['ai', 'artificial intelligence'],
  ['nlp', 'natural language processing'],
  ['rpa', 'robotic process automation', 'process automation', 'workflow automation'],
  ['power automate', 'ms flow', 'microsoft flow'],

  // ─── Management, Business & HR ──────────────────────────────
  ['hr', 'human resources', 'people operations', 'personnel'],
  ['hris', 'human resources information system', 'hr analytics', 'people analytics', 'hcm'],
  ['ats', 'applicant tracking system', 'recruitment software', 'e-recruitment'],
  ['ta', 'talent acquisition', 'recruitment', 'talent sourcing', 'staffing'],
  ['kpi', 'key performance indicator', 'kpis', 'key performance indicators'],
  ['sla', 'service level agreement', 'slas'],
  ['crm', 'customer relationship management'],
  ['erp', 'enterprise resource planning'],
  ['pmp', 'project management professional', 'project management', 'program management'],
  ['agile', 'scrum', 'kanban', 'agile methodology', 'scrum framework'],
];

// ---------------------------------------------------------------------------
// Competency Taxonomy (25+ Clusters)
// ---------------------------------------------------------------------------

export const COMPETENCY_TAXONOMY: CompetencyMapping[] = [
  // 1. Full-Stack Web Development
  {
    competency: 'Full-Stack Web Development',
    aliases: [
      'full stack development',
      'full stack web development',
      'full-stack developer',
      'full stack software engineering',
      'full stack engineering',
      'full stack application development',
    ],
    dimensions: [
      {
        name: 'frontend',
        technologies: [
          'react', 'react.js', 'reactjs', 'next.js', 'nextjs', 'vue', 'angular',
          'svelte', 'html5', 'css3', 'tailwind', 'javascript', 'typescript',
        ],
      },
      {
        name: 'backend',
        technologies: [
          'node', 'node.js', 'nodejs', 'express', 'nest.js', 'nestjs', '.net',
          'asp.net', 'c#', 'python', 'django', 'fastapi', 'flask', 'java',
          'spring', 'spring boot', 'laravel', 'ruby on rails', 'golang', 'go',
        ],
      },
      {
        name: 'database_or_api',
        technologies: [
          'sql', 'postgresql', 'postgres', 'mysql', 'mongodb', 'redis',
          'rest api', 'restful', 'graphql', 'prisma', 'typeorm',
        ],
      },
    ],
    responsibilityPhrases: [
      'full stack', 'full-stack', 'frontend and backend', 'front-end and back-end',
      'developed end to end', 'developed web applications', 'built web applications',
      'full-stack web applications', 'full stack web apps',
    ],
  },

  // 2. SQL Database Development & Administration
  {
    competency: 'SQL Database Development & Administration',
    aliases: [
      'sql database development',
      'database administration',
      'database development & administration',
      'sql development and administration',
      'rdbms administration',
      'database development and administration',
      'sql database management',
    ],
    dimensions: [
      {
        name: 'sql_technology',
        technologies: [
          'sql', 'postgresql', 'postgres', 'mysql', 'sql server', 'oracle',
          't-sql', 'pl/sql', 'rdbms', 'sqlite', 'mariadb',
        ],
      },
      {
        name: 'dev_or_admin_tasks',
        technologies: [
          'administered', 'administration', 'database development', 'schema design',
          'stored procedures', 'query optimization', 'performance tuning', 'indexing',
          'backup and recovery', 'replication', 'data modeling', 'ddl', 'dml', 'dba',
          'database architecture',
        ],
      },
    ],
    responsibilityPhrases: [
      'built and administered sql databases', 'administered sql', 'database administration',
      'database development', 'managed sql databases', 'optimized database queries',
      'administered databases', 'database administrator', 'managed relational databases',
    ],
  },

  // 3. Business Process Automation
  {
    competency: 'Business Process Automation',
    aliases: [
      'process automation',
      'workflow automation',
      'business workflow automation',
      'enterprise automation',
      'business process management',
    ],
    dimensions: [
      {
        name: 'automation_core',
        technologies: [
          'power automate', 'zapier', 'make.com', 'camunda', 'n8n', 'uipath',
          'automation anywhere', 'workflow automation', 'process automation',
          'automated workflows', 'business process automation', 'system integrations',
          'automated business processes', 'robotic process automation', 'rpa',
        ],
      },
    ],
    responsibilityPhrases: [
      'built automated workflows', 'automated workflows', 'process automation',
      'system integrations', 'automated business processes', 'workflow integrations',
      'automated business process', 'process automations', 'streamlined business processes',
    ],
  },

  // 4. Microsoft Power Platform
  {
    competency: 'Microsoft Power Platform',
    aliases: [
      'power platform',
      'ms power platform',
      'microsoft power platform development',
      'microsoft power platform process automation',
    ],
    dimensions: [
      {
        name: 'platform_tools',
        technologies: [
          'power apps', 'power automate', 'power platform', 'dataverse',
          'power pages', 'power virtual agents',
        ],
      },
    ],
    relatedOnlyTechnologies: ['power bi'],
    responsibilityPhrases: [
      'power apps development', 'power automate flows', 'power platform solutions',
      'built power apps', 'implemented power automate workflows',
    ],
  },

  // 5. Cloud DevOps & CI/CD
  {
    competency: 'Cloud DevOps & CI/CD',
    aliases: [
      'devops',
      'ci/cd',
      'cloud devops',
      'devops engineering',
      'ci cd pipelines',
      'continuous integration and deployment',
    ],
    dimensions: [
      {
        name: 'container_or_cloud',
        technologies: ['docker', 'kubernetes', 'k8s', 'aws', 'azure', 'gcp', 'terraform'],
      },
      {
        name: 'pipeline_tooling',
        technologies: ['ci/cd', 'jenkins', 'github actions', 'gitlab ci', 'argo cd'],
      },
    ],
    responsibilityPhrases: [
      'ci/cd pipelines', 'deployment pipelines', 'containerized applications',
      'infrastructure as code', 'continuous integration', 'automated deployments',
    ],
  },

  // 6. Frontend Web Development
  {
    competency: 'Frontend Web Development',
    aliases: [
      'frontend development',
      'front end development',
      'frontend engineering',
      'front-end developer',
      'client side development',
    ],
    dimensions: [
      {
        name: 'framework',
        technologies: ['react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt'],
      },
      {
        name: 'styling_and_markup',
        technologies: ['html5', 'css3', 'tailwind', 'sass', 'scss', 'bootstrap', 'material-ui', 'shadcn'],
      },
      {
        name: 'core_language',
        technologies: ['javascript', 'typescript', 'es6'],
      },
    ],
    responsibilityPhrases: [
      'developed user interfaces', 'built responsive web applications', 'frontend engineering',
      'implemented ui components', 'client-side state management', 'responsive layouts',
    ],
  },

  // 7. Backend API Development
  {
    competency: 'Backend API Development',
    aliases: [
      'backend development',
      'back end development',
      'backend engineering',
      'server side development',
      'api development',
      'backend software engineering',
    ],
    dimensions: [
      {
        name: 'runtime_or_language',
        technologies: ['node.js', 'python', 'java', 'c#', '.net', 'golang', 'php', 'ruby'],
      },
      {
        name: 'api_protocol',
        technologies: ['rest api', 'restful', 'graphql', 'grpc', 'websocket', 'microservices'],
      },
      {
        name: 'persistence',
        technologies: ['sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'prisma', 'typeorm', 'hibernate'],
      },
    ],
    responsibilityPhrases: [
      'developed rest apis', 'built backend services', 'microservices architecture',
      'server-side logic', 'designed database schema', 'api authentication and authorization',
    ],
  },

  // 8. Mobile Application Development
  {
    competency: 'Mobile Application Development',
    aliases: [
      'mobile development',
      'mobile app development',
      'ios development',
      'android development',
      'cross-platform mobile development',
    ],
    dimensions: [
      {
        name: 'mobile_tech',
        technologies: [
          'react native', 'flutter', 'swift', 'swiftui', 'kotlin',
          'android sdk', 'ios sdk', 'xcode', 'android studio', 'dart',
        ],
      },
    ],
    responsibilityPhrases: [
      'developed mobile applications', 'built ios and android apps', 'published to app store',
      'mobile ui/ux', 'offline-first mobile architecture', 'push notifications',
    ],
  },

  // 9. Data Engineering & ETL
  {
    competency: 'Data Engineering & ETL',
    aliases: [
      'data engineering',
      'etl development',
      'data pipeline engineering',
      'big data engineering',
    ],
    dimensions: [
      {
        name: 'pipeline_tools',
        technologies: [
          'apache spark', 'spark', 'kafka', 'airflow', 'dbt', 'hadoop',
          'glue', 'data factory', 'databricks', 'snowflake', 'bigquery',
        ],
      },
      {
        name: 'data_processing',
        technologies: ['python', 'sql', 'scala', 'etl', 'elt', 'data warehousing', 'data lake'],
      },
    ],
    responsibilityPhrases: [
      'built etl pipelines', 'data pipeline architecture', 'data ingestion and transformation',
      'managed data warehouse', 'optimized data pipelines', 'batch and streaming data processing',
    ],
  },

  // 10. Machine Learning & AI Engineering
  {
    competency: 'Machine Learning & AI Engineering',
    aliases: [
      'machine learning',
      'data science',
      'ai engineering',
      'deep learning',
      'applied machine learning',
    ],
    dimensions: [
      {
        name: 'ml_frameworks',
        technologies: [
          'pytorch', 'tensorflow', 'scikit-learn', 'keras', 'huggingface',
          'transformers', 'llm', 'langchain', 'openai',
        ],
      },
      {
        name: 'data_science_stack',
        technologies: ['python', 'pandas', 'numpy', 'scipy', 'jupyter', 'r', 'matplotlib'],
      },
    ],
    responsibilityPhrases: [
      'trained machine learning models', 'developed predictive models', 'model fine-tuning',
      'deployed ml models to production', 'feature engineering', 'natural language processing',
    ],
  },

  // 11. Cybersecurity & Information Security
  {
    competency: 'Cybersecurity & Information Security',
    aliases: [
      'cybersecurity',
      'information security',
      'infosec',
      'network security',
      'soc analyst',
      'security engineering',
    ],
    dimensions: [
      {
        name: 'security_tools',
        technologies: [
          'siem', 'soc', 'splunk', 'wireshark', 'nessus', 'qualys', 'burp suite',
          'firewalls', 'ids/ips', 'endpoint protection', 'edr',
        ],
      },
      {
        name: 'standards_and_practices',
        technologies: [
          'iso 27001', 'cissp', 'ceh', 'cism', 'penetration testing', 'vulnerability management',
          'incident response', 'zero trust', 'security audit',
        ],
      },
    ],
    responsibilityPhrases: [
      'monitored security incidents', 'conducted vulnerability assessments', 'penetration testing',
      'implemented security policies', 'incident response and threat hunting', 'iso 27001 compliance',
    ],
  },

  // 12. Cloud Architecture & Infrastructure
  {
    competency: 'Cloud Architecture & Infrastructure',
    aliases: [
      'cloud architecture',
      'cloud engineering',
      'cloud infrastructure',
      'solutions architecture',
    ],
    dimensions: [
      {
        name: 'cloud_providers',
        technologies: ['aws', 'azure', 'gcp', 'google cloud', 'amazon web services', 'microsoft azure'],
      },
      {
        name: 'iac_and_networking',
        technologies: ['terraform', 'cloudformation', 'ansible', 'vpc', 'iam', 'load balancer', 'route 53'],
      },
    ],
    responsibilityPhrases: [
      'architected cloud solutions', 'designed cloud infrastructure', 'cloud migration',
      'infrastructure as code', 'multi-region high availability', 'cloud cost optimization',
    ],
  },

  // 13. Quality Assurance & Automated Testing
  {
    competency: 'Quality Assurance & Automated Testing',
    aliases: [
      'qa engineering',
      'quality assurance',
      'software testing',
      'test automation',
      'sdet',
    ],
    dimensions: [
      {
        name: 'automation_tools',
        technologies: [
          'selenium', 'cypress', 'playwright', 'jest', 'vitest', 'junit',
          'postman', 'appium', 'k6', 'jmeter',
        ],
      },
      {
        name: 'qa_practices',
        technologies: [
          'test automation', 'regression testing', 'unit testing', 'integration testing',
          'e2e testing', 'test cases', 'bug tracking', 'qa methodologies',
        ],
      },
    ],
    responsibilityPhrases: [
      'created automated test suites', 'performed regression and smoke testing',
      'developed e2e test automation', 'api test automation', 'qa test planning and execution',
    ],
  },

  // 14. UI/UX Design & User Research
  {
    competency: 'UI/UX Design & User Research',
    aliases: [
      'ui ux design',
      'product design',
      'user experience design',
      'user interface design',
      'ux research',
    ],
    dimensions: [
      {
        name: 'design_tools',
        technologies: ['figma', 'sketch', 'adobe xd', 'invision', 'framer', 'adobe illustrator', 'photoshop'],
      },
      {
        name: 'methodologies',
        technologies: [
          'wireframing', 'prototyping', 'usability testing', 'user research',
          'design systems', 'user journeys', 'information architecture',
        ],
      },
    ],
    responsibilityPhrases: [
      'designed user interfaces and user flows', 'created interactive prototypes in figma',
      'conducted user research and usability testing', 'built and maintained design systems',
    ],
  },

  // 15. Intensive Care & Critical Care Nursing
  {
    competency: 'Intensive Care & Critical Care Nursing',
    aliases: [
      'critical care nursing',
      'icu nursing',
      'intensive care',
      'critical care specialist',
      'ccu nursing',
    ],
    dimensions: [
      {
        name: 'clinical_skills',
        technologies: [
          'ventilator management', 'mechanical ventilation', 'hemodynamics',
          'arterial line', 'central venous catheter', 'cvc', 'intubation',
          'patient monitoring', 'vasoactive infusions', 'ecmo',
        ],
      },
      {
        name: 'certifications',
        technologies: ['bls', 'acls', 'scfhs', 'critical care certification', 'ccrn'],
      },
    ],
    responsibilityPhrases: [
      'managed critically ill patients in icu', 'titrated vasoactive infusions',
      'operated mechanical ventilators', 'monitored hemodynamic stability',
      'administered critical care medications', 'responded to code blue emergencies',
    ],
  },

  // 16. Emergency Medicine & Trauma Care
  {
    competency: 'Emergency Medicine & Trauma Care',
    aliases: [
      'emergency medicine',
      'trauma care',
      'emergency department nursing',
      'er nursing',
      'acute care',
    ],
    dimensions: [
      {
        name: 'emergency_procedures',
        technologies: [
          'triage', 'emergency triage', 'resuscitation', 'atls', 'trauma management',
          'wound care', 'defibrillation', 'pals', 'emergency medicine',
        ],
      },
    ],
    responsibilityPhrases: [
      'performed emergency triage using cts/esi', 'managed acute trauma cases',
      'executed emergency resuscitation protocols', 'treated life-threatening emergencies',
    ],
  },

  // 17. Healthcare Quality & Patient Safety
  {
    competency: 'Healthcare Quality & Patient Safety',
    aliases: [
      'healthcare quality',
      'patient safety',
      'clinical quality improvement',
      'hospital accreditation',
      'quality and patient safety',
    ],
    dimensions: [
      {
        name: 'accreditation_and_standards',
        technologies: [
          'jci', 'cbahi', 'cphq', 'iso 9001', 'accreditation standards',
          'clinical governance', 'patient safety goals',
        ],
      },
      {
        name: 'quality_methodologies',
        technologies: [
          'root cause analysis', 'rca', 'fmea', 'clinical audit', 'sentinel events',
          'incident reporting', 'kpi monitoring', 'pdca', 'quality improvement',
        ],
      },
    ],
    responsibilityPhrases: [
      'led jci and cbahi accreditation surveys', 'conducted root cause analyses',
      'monitored clinical quality kpis', 'implemented patient safety initiatives',
      'facilitated quality improvement projects', 'managed incident reporting system',
    ],
  },

  // 18. Infection Prevention & Control
  {
    competency: 'Infection Prevention & Control',
    aliases: [
      'infection control',
      'infection prevention',
      'hospital epidemiology',
      'ipc specialist',
    ],
    dimensions: [
      {
        name: 'ipc_core',
        technologies: [
          'cic', 'sterilization', 'surveillance', 'outbreak investigation',
          'ppe protocols', 'hand hygiene', 'hai surveillance', 'isolation precautions',
          'environmental cleaning', 'antimicrobial stewardship',
        ],
      },
    ],
    responsibilityPhrases: [
      'conducted hospital-acquired infection surveillance', 'managed outbreak investigations',
      'audited hand hygiene and ppe compliance', 'enforced sterile processing standards',
      'delivered infection control training to clinical staff',
    ],
  },

  // 19. Clinical Pharmacy & Medication Management
  {
    competency: 'Clinical Pharmacy & Medication Management',
    aliases: [
      'clinical pharmacy',
      'medication management',
      'hospital pharmacy',
      'pharmacotherapy',
    ],
    dimensions: [
      {
        name: 'pharmacy_practice',
        technologies: [
          'pharmacotherapy', 'drug interactions', 'parenteral nutrition', 'tpn',
          'formulary management', 'medication reconciliation', 'antimicrobial stewardship',
          'clinical pharmacology', 'therapeutic drug monitoring',
        ],
      },
    ],
    responsibilityPhrases: [
      'performed medication reconciliation', 'reviewed therapeutic drug regimens',
      'monitored adverse drug events', 'compounded sterile parenteral preparations',
      'provided clinical pharmacology consultations to physicians',
    ],
  },

  // 20. Healthcare Information Systems & EHR/EMR
  {
    competency: 'Healthcare Information Systems & EHR/EMR',
    aliases: [
      'ehr implementation',
      'emr systems',
      'clinical informatics',
      'health informatics',
      'his administration',
    ],
    dimensions: [
      {
        name: 'systems_and_standards',
        technologies: [
          'epic', 'cerner', 'bestcare', 'hl7', 'fhir', 'pacs', 'ris', 'lis',
          'electronic health records', 'ehr', 'emr', 'clinical documentation',
        ],
      },
    ],
    responsibilityPhrases: [
      'implemented and optimized ehr/emr workflows', 'trained clinicians on electronic documentation',
      'configured clinical order sets and templates', 'managed health information system integrations',
    ],
  },

  // 21. Talent Acquisition & Recruitment
  {
    competency: 'Talent Acquisition & Recruitment',
    aliases: [
      'talent acquisition',
      'recruitment',
      'talent sourcing',
      'technical recruiting',
      'talent acquisition strategy',
    ],
    dimensions: [
      {
        name: 'recruiting_core',
        technologies: [
          'competency-based interviewing', 'recruitment analytics', 'kpi management',
          'ats', 'headhunting', 'talent sourcing', 'employer branding',
          'salary negotiation', 'offer management', 'onboarding',
        ],
      },
    ],
    responsibilityPhrases: [
      'managed end to end recruitment lifecycle', 'conducted competency-based interviews',
      'sourced candidates via linkedin and job boards', 'reduced time to hire and cost per hire',
      'partnered with hiring managers on workforce planning',
    ],
  },

  // 22. HR Operations & Compensation/Benefits
  {
    competency: 'HR Operations & Compensation/Benefits',
    aliases: [
      'hr operations',
      'compensation and benefits',
      'c&b',
      'people operations',
      'hr administration',
    ],
    dimensions: [
      {
        name: 'hr_ops',
        technologies: [
          'payroll administration', 'labor law compliance', 'grading structure',
          'job evaluation', 'hr policies', 'employee relations', 'hris',
          'saudi labor law', 'performance appraisal',
        ],
      },
    ],
    responsibilityPhrases: [
      'managed payroll and employee benefits', 'ensured compliance with labor regulations',
      'administered performance management cycles', 'developed organizational grading structures',
      'resolved employee grievances and disciplinary matters',
    ],
  },

  // 23. Financial Analysis & Management Accounting
  {
    competency: 'Financial Analysis & Management Accounting',
    aliases: [
      'financial analysis',
      'management accounting',
      'fp&a',
      'financial planning and analysis',
      'corporate finance',
    ],
    dimensions: [
      {
        name: 'finance_core',
        technologies: [
          'financial modeling', 'variance analysis', 'budgeting', 'forecasting',
          'gaap', 'ifrs', 'p&l management', 'cash flow analysis', 'financial reporting',
          'cost accounting', 'financial statements',
        ],
      },
    ],
    responsibilityPhrases: [
      'built financial models and forecasts', 'analyzed monthly budget variances',
      'prepared executive financial reports and p&l statements', 'managed capital expenditure budgeting',
    ],
  },

  // 24. Business Intelligence & Reporting
  {
    competency: 'Business Intelligence & Reporting',
    aliases: [
      'business intelligence',
      'bi reporting',
      'data analytics and reporting',
      'bi development',
      'dashboard development',
    ],
    dimensions: [
      {
        name: 'bi_tools',
        technologies: ['power bi', 'tableau', 'looker', 'qlik', 'excel', 'ssrs'],
      },
      {
        name: 'data_layer',
        technologies: ['sql', 'dax', 'power query', 'data modeling', 'data warehousing'],
      },
    ],
    responsibilityPhrases: [
      'built interactive bi dashboards', 'developed dax measures and data models',
      'automated executive reporting', 'connected bi tools to sql databases',
    ],
  },

  // 25. Project & Program Management
  {
    competency: 'Project & Program Management',
    aliases: [
      'project management',
      'program management',
      'pmo',
      'project delivery',
      'technical project management',
    ],
    dimensions: [
      {
        name: 'methodologies_and_certs',
        technologies: ['pmp', 'prince2', 'agile', 'scrum', 'kanban', 'waterfall', 'lean six sigma'],
      },
      {
        name: 'pm_tools',
        technologies: ['jira', 'confluence', 'ms project', 'asana', 'trello', 'monday.com'],
      },
    ],
    responsibilityPhrases: [
      'managed end-to-end project lifecycles', 'facilitated sprint planning and daily standups',
      'managed project risks, scope, and budget', 'communicated status to executive stakeholders',
    ],
  },

  // 26. Supply Chain & Healthcare Procurement
  {
    competency: 'Supply Chain & Healthcare Procurement',
    aliases: [
      'procurement',
      'supply chain management',
      'hospital procurement',
      'purchasing and supply chain',
      'vendor management',
    ],
    dimensions: [
      {
        name: 'procurement_core',
        technologies: [
          'vendor management', 'rfp', 'rfq', 'purchase orders', 'inventory control',
          'medical supplies procurement', 'contract negotiation', 'erp procurement',
          'sap mm', 'oracle scm', 'logistics',
        ],
      },
    ],
    responsibilityPhrases: [
      'managed vendor relationships and negotiations', 'issued and evaluated rfps and rfqs',
      'optimized hospital inventory levels', 'managed medical equipment procurement contracts',
    ],
  },

  // 27. IT Infrastructure & Systems Administration
  {
    competency: 'IT Infrastructure & Systems Administration',
    aliases: [
      'systems administration',
      'sysadmin',
      'it infrastructure',
      'network administration',
      'it systems engineer',
    ],
    dimensions: [
      {
        name: 'os_and_directory',
        technologies: ['active directory', 'windows server', 'linux', 'rhel', 'ubuntu', 'dns', 'dhcp', 'group policy'],
      },
      {
        name: 'virtualization_and_networking',
        technologies: ['vmware', 'hyper-v', 'vsphere', 'cisco', 'vlans', 'routing', 'firewall', 'vpn'],
      },
    ],
    responsibilityPhrases: [
      'administered windows server and active directory', 'managed virtualized environments with vmware',
      'configured enterprise network infrastructure', 'performed system backup, disaster recovery, and patching',
    ],
  },
];

// ---------------------------------------------------------------------------
// Query Functions
// ---------------------------------------------------------------------------

/**
 * Finds a matching competency mapping from the taxonomy by exact name or alias.
 */
export function findCompetencyMapping(skillName: string): CompetencyMapping | null {
  const norm = normTaxonomy(skillName);
  if (!norm) return null;

  for (const comp of COMPETENCY_TAXONOMY) {
    const compNorm = normTaxonomy(comp.competency);
    if (compNorm === norm) return comp;

    for (const alias of comp.aliases) {
      const aliasNorm = normTaxonomy(alias);
      if (aliasNorm === norm) return comp;

      // Substring check for compound aliases
      if (norm.length >= 6 && (norm.includes(aliasNorm) || aliasNorm.includes(norm))) {
        return comp;
      }
    }
  }

  return null;
}

/**
 * Finds all known synonyms for a given skill or acronym.
 */
export function findSynonyms(term: string): string[] {
  const norm = normTaxonomy(term);
  if (!norm) return [];

  const results: string[] = [];

  for (const group of SYNONYM_GROUPS) {
    const normGroup = group.map((s) => normTaxonomy(s));
    const index = normGroup.indexOf(norm);
    if (index !== -1) {
      for (let i = 0; i < group.length; i++) {
        const item = group[i];
        if (i !== index && item) results.push(item);
      }
    }
  }

  return Array.from(new Set(results));
}

/**
 * Checks if two skill terms are considered synonyms in the taxonomy.
 */
export function areSkillsSynonyms(a: string, b: string): boolean {
  const normA = normTaxonomy(a);
  const normB = normTaxonomy(b);

  if (!normA || !normB) return false;
  if (normA === normB) return true;

  for (const group of SYNONYM_GROUPS) {
    const normGroup = group.map((s) => normTaxonomy(s));
    const hasA = normGroup.some((g) => g === normA || new RegExp(`(?:^|\\s)${escapeRegex(g)}(?:$|\\s)`).test(normA));
    const hasB = normGroup.some((g) => g === normB || new RegExp(`(?:^|\\s)${escapeRegex(g)}(?:$|\\s)`).test(normB));
    if (hasA && hasB) return true;
  }

  return false;
}

/**
 * Returns all competency names defined in the taxonomy.
 */
export function getAllCompetencyNames(): string[] {
  return COMPETENCY_TAXONOMY.map((c) => c.competency);
}
