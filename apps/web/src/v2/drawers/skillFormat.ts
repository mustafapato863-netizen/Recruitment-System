/**
 * Clinical & enterprise skill label formatting and multi-token parsing
 * shared across CV intake & job-scoped CV import drawers.
 */

const CANONICAL_TOKENS: Record<string, string> = {
  icu: 'ICU',
  nicu: 'NICU',
  picu: 'PICU',
  ccu: 'CCU',
  ecg: 'ECG',
  ekg: 'EKG',
  bls: 'BLS',
  acls: 'ACLS',
  pals: 'PALS',
  nrp: 'NRP',
  atls: 'ATLS',
  cpr: 'CPR',
  aed: 'AED',
  pacs: 'PACS',
  ris: 'RIS',
  his: 'HIS',
  emr: 'EMR',
  ehr: 'EHR',
  mri: 'MRI',
  ct: 'CT',
  pet: 'PET',
  jci: 'JCI',
  dha: 'DHA',
  moh: 'MOH',
  doh: 'DOH',
  haad: 'HAAD',
  scfhs: 'SCFHS',
  rn: 'RN',
  lpn: 'LPN',
  bsn: 'BSN',
  msn: 'MSN',
  dnp: 'DNP',
  md: 'MD',
  mbbs: 'MBBS',
  mrcp: 'MRCP',
  frcs: 'FRCS',
  facs: 'FACS',
  pharmd: 'PharmD',
  er: 'ER',
  ed: 'ED',
  or: 'OR',
  ot: 'OT',
  pt: 'PT',
  rt: 'RT',
  opd: 'OPD',
  ipd: 'IPD',
  iv: 'IV',
  im: 'IM',
  ob: 'OB',
  gyn: 'GYN',
  ent: 'ENT',
  gi: 'GI',
  msk: 'MSK',
  cns: 'CNS',
  cbc: 'CBC',
  abg: 'ABG',
  dvt: 'DVT',
  copd: 'COPD',
  ards: 'ARDS',
  cabg: 'CABG',
  pci: 'PCI',
  ecmo: 'ECMO',
  crrt: 'CRRT',
  tqm: 'TQM',
  kpi: 'KPI',
  qa: 'QA',
  qc: 'QC',
  sop: 'SOP',
  hipaa: 'HIPAA',
  osha: 'OSHA',
  who: 'WHO',
  cdc: 'CDC',
  hr: 'HR',
  hris: 'HRIS',
  erp: 'ERP',
  crm: 'CRM',
  sap: 'SAP',
  it: 'IT',
  sql: 'SQL',
  api: 'API',
  aws: 'AWS',
  gcp: 'GCP',
  ui: 'UI',
  ux: 'UX',
  ifrs: 'IFRS',
  gaap: 'GAAP',
  cpa: 'CPA',
  cma: 'CMA',
  acca: 'ACCA',
  cfa: 'CFA',
  mba: 'MBA',
  phd: 'PhD',
  bsc: 'BSc',
  msc: 'MSc',
};

function formatToken(token: string): string {
  if (!token) return token;
  if (token.includes('/')) {
    return token.split('/').map(formatToken).join('/');
  }
  const canonical = CANONICAL_TOKENS[token.toLowerCase()];
  if (canonical) return canonical;
  // Keep intentional camelCase/mixed-case (e.g. "TypeScript", "GraphQL")
  if (/[A-Z]/.test(token.slice(1))) return token;
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

/** Normalizes clinical & enterprise acronyms (e.g., "Ecg" -> "ECG", "Icu" -> "ICU", "Bls" -> "BLS"). */
export function formatSkillLabel(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  return cleaned
    .split(' ')
    .map((word) => formatToken(word))
    .join(' ');
}

/** Splits comma/semicolon-separated skill input into deduplicated, normalized skill labels. */
export function parseSkillInput(raw: string): string[] {
  const parts = raw
    .split(/[,;]+/)
    .map((item) => formatSkillLabel(item))
    .filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const skill of parts) {
    const key = skill.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(skill);
    }
  }
  return unique;
}

/** Checks whether a skill matches any keyword in a role-fit matched list (case-insensitive). */
export function isSkillMatched(skill: string, matched: string[]): boolean {
  const norm = skill.trim().toLowerCase();
  if (!norm || matched.length === 0) return false;
  return matched.some((m) => {
    const target = m.trim().toLowerCase();
    return target === norm || target.includes(norm) || norm.includes(target);
  });
}
