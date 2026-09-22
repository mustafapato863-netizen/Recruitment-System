import { describe, expect, it } from 'vitest';
import { gradeForScore, orderSkillsForDisplay } from './skillTags';

describe('orderSkillsForDisplay', () => {
  it('puts priority skills first and keeps stable order otherwise', () => {
    const ordered = orderSkillsForDisplay(
      ['Java', 'React', 'SQL', 'Node'],
      ['React', 'SQL'],
    );
    expect(ordered).toEqual(['React', 'SQL', 'Java', 'Node']);
  });

  it('dedupes case-insensitively', () => {
    expect(orderSkillsForDisplay(['React', 'react', 'Vue'], ['Vue'])).toEqual(['Vue', 'React']);
  });
});

describe('gradeForScore', () => {
  it('never labels a zero score as Good Match', () => {
    expect(gradeForScore(0, false)).toBe('Select a position');
    expect(gradeForScore(0, true)).toBe('No position fit');
    expect(gradeForScore(75, true)).toBe('Fair Match');
    expect(gradeForScore(85, true)).toBe('Good Match');
    expect(gradeForScore(92, true)).toBe('High Match');
  });
});
