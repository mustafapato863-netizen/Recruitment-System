import { describe, it, expect } from 'vitest';
import {
  findCompetencyMapping,
  findSynonyms,
  areSkillsSynonyms,
  getAllCompetencyNames,
  COMPETENCY_TAXONOMY,
  SYNONYM_GROUPS,
} from '@recruitflow/validation';

describe('SkillTaxonomy', () => {
  it('has at least 25 competency clusters defined', () => {
    const names = getAllCompetencyNames();
    expect(names.length).toBeGreaterThanOrEqual(25);
    expect(COMPETENCY_TAXONOMY.length).toBeGreaterThanOrEqual(25);
    expect(SYNONYM_GROUPS.length).toBeGreaterThan(0);
  });

  it('finds competency mapping by exact name and by alias', () => {
    // Exact name
    const fullStack = findCompetencyMapping('Full-Stack Web Development');
    expect(fullStack).not.toBeNull();
    expect(fullStack?.competency).toBe('Full-Stack Web Development');

    // Alias
    const fsAlias = findCompetencyMapping('full-stack developer');
    expect(fsAlias).not.toBeNull();
    expect(fsAlias?.competency).toBe('Full-Stack Web Development');

    // Healthcare competency
    const icu = findCompetencyMapping('Intensive Care & Critical Care Nursing');
    expect(icu).not.toBeNull();

    const icuAlias = findCompetencyMapping('critical care specialist');
    expect(icuAlias).not.toBeNull();
    expect(icuAlias?.competency).toBe('Intensive Care & Critical Care Nursing');

    // Quality & Safety
    const quality = findCompetencyMapping('Healthcare Quality & Patient Safety');
    expect(quality).not.toBeNull();

    // Data Engineering
    const de = findCompetencyMapping('data pipeline engineering');
    expect(de).not.toBeNull();
    expect(de?.competency).toBe('Data Engineering & ETL');
  });

  it('returns null for unknown or arbitrary skills', () => {
    expect(findCompetencyMapping('Underwater Basket Weaving')).toBeNull();
    expect(findCompetencyMapping('')).toBeNull();
  });

  it('resolves healthcare and tech synonyms correctly', () => {
    // Healthcare
    expect(areSkillsSynonyms('SCFHS', 'Saudi Commission for Health Specialties')).toBe(true);
    expect(areSkillsSynonyms('BLS', 'Basic Life Support')).toBe(true);
    expect(areSkillsSynonyms('EHR', 'Electronic Medical Records')).toBe(true);
    expect(areSkillsSynonyms('ICU', 'Critical Care')).toBe(true);

    // Tech
    expect(areSkillsSynonyms('RDBMS', 'Relational Database')).toBe(true);
    expect(areSkillsSynonyms('PostgreSQL', 'Postgres')).toBe(true);
    expect(areSkillsSynonyms('K8s', 'Kubernetes')).toBe(true);
    expect(areSkillsSynonyms('CI/CD', 'Continuous Integration')).toBe(true);

    // Non-synonyms
    expect(areSkillsSynonyms('React', 'Python')).toBe(false);
    expect(areSkillsSynonyms('ICU', 'Pediatrics')).toBe(false);
  });

  it('findSynonyms retrieves all alternative terms for a keyword', () => {
    const psqlSynonyms = findSynonyms('postgresql');
    expect(psqlSynonyms).toContain('postgres');
    expect(psqlSynonyms).toContain('psql');

    const scfhsSynonyms = findSynonyms('scfhs');
    expect(scfhsSynonyms).toContain('saudi commission for health specialties');
  });
});
