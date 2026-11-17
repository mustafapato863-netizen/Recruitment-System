import { Injectable, Logger } from '@nestjs/common';
import type { JdCriteriaDefinition, JdKnockoutRule } from '@recruitflow/contracts';

const COMMON_SKILL_PATTERNS = [
  // Healthcare / Clinical
  'Patient Care', 'Clinical Documentation', 'ICD-10', 'Medical Coding', 'Healthcare Quality',
  'JCI Accreditation', 'Infection Control', 'BLS', 'ACLS', 'EHR', 'Critical Thinking',
  'Triage', 'Emergency Medicine', 'Pediatrics', 'Cardiology', 'Surgery', 'Pharmacology',
  'Nursing Administration', 'ICU', 'Radiology', 'Laboratory', 'Oncology',
  // Technology / Software
  'TypeScript', 'JavaScript', 'React', 'Node.js', 'NestJS', 'PostgreSQL', 'Prisma', 'Docker',
  'Kubernetes', 'Python', 'AWS', 'Azure', 'Git', 'CI/CD', 'REST API', 'GraphQL',
  // General Management
  'Project Management', 'Agile', 'Scrum', 'Leadership', 'Stakeholder Management', 'Recruitment',
  'Budget Management', 'Compliance', 'Risk Assessment',
];

const DEGREE_PATTERNS = [
  { level: 'DOCTORATE', pattern: /\b(ph\.?d|doctorate|md|mbbs|fellowship)\b/i },
  { level: 'MASTERS', pattern: /\b(master'?s|msc|ms|mba|m\.tech)\b/i },
  { level: 'BACHELORS', pattern: /\b(bachelor'?s|bsc|ba|bs|b\.tech|b\.eng)\b/i },
  { level: 'DIPLOMA', pattern: /\b(diploma|associate'?s|certification)\b/i },
];

const LANGUAGE_PATTERNS = [
  { name: 'English', pattern: /\b(english)\b/i },
  { name: 'Arabic', pattern: /\b(arabic)\b/i },
  { name: 'French', pattern: /\b(french)\b/i },
  { name: 'German', pattern: /\b(german)\b/i },
];

@Injectable()
export class JdParserService {
  private readonly logger = new Logger(JdParserService.name);

  /**
   * Parse extracted job description text into structured criteria.
   */
  parseJdText(rawText: string, existingSkills: string[] = []): JdCriteriaDefinition {
    const text = rawText || '';
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    // 1. Extract Experience Years
    const minExperienceYears = this.extractExperienceYears(text);

    // 2. Extract Skills (Must-Have vs Nice-to-Have)
    const { mustHaveSkills, niceToHaveSkills } = this.extractSkills(text, lines, existingSkills);

    // 3. Extract Education Levels
    const educationLevels = this.extractEducation(text);

    // 4. Extract Languages
    const languages = this.extractLanguages(text);

    // 5. Extract Work Mode
    const workMode = this.extractWorkMode(text);

    // 6. Build Knockout Rules
    const knockoutRules: JdKnockoutRule[] = [];
    if (minExperienceYears != null && minExperienceYears > 0) {
      knockoutRules.push({
        id: 'ko-exp',
        field: 'experienceYears',
        operator: 'GTE',
        value: minExperienceYears,
        failureMessage: `Requires at least ${minExperienceYears} years of experience.`,
      });
    }
    if (educationLevels.length > 0) {
      knockoutRules.push({
        id: 'ko-edu',
        field: 'degree',
        operator: 'IN',
        value: educationLevels,
        failureMessage: `Requires degree level: ${educationLevels.join(' or ')}.`,
      });
    }

    return {
      version: 1,
      isLocked: false,
      lockedAt: null,
      lockedById: null,
      lockedByName: null,
      minExperienceYears,
      educationLevels,
      languages,
      workMode,
      mustHaveSkills,
      niceToHaveSkills,
      knockoutRules,
      weights: {
        skills: 50,
        experience: 30,
        education: 10,
        languages: 10,
      },
    };
  }

  private extractExperienceYears(text: string): number | null {
    const expRegexes = [
      /(?:minimum|at least|req(?:uired)?)\s*(\d+)\+?\s*(?:to\s*\d+)?\s*years?(?:\s+of)?\s+experience/i,
      /(\d+)\+?\s*(?:to\s*\d+)?\s*years?(?:\s+of)?\s+(?:relevant\s+)?experience/i,
      /experience\s*:\s*(\d+)\+?\s*years?/i,
    ];

    for (const regex of expRegexes) {
      const match = text.match(regex);
      if (match && match[1]) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val >= 0 && val <= 35) {
          return val;
        }
      }
    }
    return 3; // Default reasonable baseline if not detected
  }

  private extractSkills(text: string, lines: string[], existingSkills: string[]) {
    const mustHaveSet = new Set<string>();
    const niceToHaveSet = new Set<string>();

    // Seed with existing skills on the job
    for (const s of existingSkills) {
      if (s.trim()) mustHaveSet.add(s.trim());
    }

    // Identify sections in text
    let currentSection: 'must' | 'nice' | 'general' = 'general';
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (/must have|minimum requirements?|required (skills|qualifications)|qualifications/i.test(lower)) {
        currentSection = 'must';
        continue;
      } else if (/nice to have|preferred (skills|qualifications)|bonus|plus/i.test(lower)) {
        currentSection = 'nice';
        continue;
      } else if (/responsibilities|duties|about (the role|us)|benefits/i.test(lower)) {
        currentSection = 'general';
        continue;
      }

      // Check for skill keywords in line
      for (const skill of COMMON_SKILL_PATTERNS) {
        const pattern = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (pattern.test(line)) {
          if (currentSection === 'nice') {
            if (!mustHaveSet.has(skill)) niceToHaveSet.add(skill);
          } else {
            mustHaveSet.add(skill);
            niceToHaveSet.delete(skill);
          }
        }
      }
    }

    // Also scan entire text if very few skills found
    if (mustHaveSet.size < 3) {
      for (const skill of COMMON_SKILL_PATTERNS) {
        const pattern = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (pattern.test(text)) {
          mustHaveSet.add(skill);
        }
      }
    }

    const mustHaveSkills = Array.from(mustHaveSet).map((name, i) => ({ id: `must-${i + 1}`, name }));
    const niceToHaveSkills = Array.from(niceToHaveSet).map((name, i) => ({ id: `nice-${i + 1}`, name }));

    return { mustHaveSkills, niceToHaveSkills };
  }

  private extractEducation(text: string): string[] {
    const found = new Set<string>();
    for (const deg of DEGREE_PATTERNS) {
      if (deg.pattern.test(text)) {
        found.add(deg.level);
      }
    }
    return Array.from(found);
  }

  private extractLanguages(text: string): Array<{ language: string; minProficiency?: string }> {
    const list: Array<{ language: string; minProficiency?: string }> = [];
    for (const lang of LANGUAGE_PATTERNS) {
      if (lang.pattern.test(text)) {
        list.push({ language: lang.name, minProficiency: 'Professional' });
      }
    }
    return list;
  }

  private extractWorkMode(text: string): 'On-site' | 'Hybrid' | 'Remote' {
    if (/\bremote\b/i.test(text) && !/\bnon-remote\b/i.test(text)) {
      return /\bhybrid\b/i.test(text) ? 'Hybrid' : 'Remote';
    }
    if (/\bhybrid\b/i.test(text)) return 'Hybrid';
    return 'On-site';
  }
}
