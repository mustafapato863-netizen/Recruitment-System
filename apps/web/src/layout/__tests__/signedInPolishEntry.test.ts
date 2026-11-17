/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const main = readFileSync(resolve(__dirname, '../../main.tsx'), 'utf8');
const shell = readFileSync(resolve(__dirname, '../V2Shell.tsx'), 'utf8');

describe('signed-in polish stays off the login entry', () => {
  it('does not import or mount profile polish from the login entry', () => {
    expect(main).not.toMatch(/ApplicantProfilePolish|CollapseInitialMatchSkills/);
    expect(main).not.toMatch(/CommandCenterPolish\.css|ApplicantProfilePolish\.css/);
  });

  it('mounts that polish from the signed-in shell', () => {
    expect(shell).toContain('<ApplicantProfilePolish />');
    expect(shell).toContain('<CollapseInitialMatchSkills />');
    expect(shell).toContain('CommandCenterPolish.css');
    expect(shell).toContain('ApplicantProfilePolish.css');
  });
});
