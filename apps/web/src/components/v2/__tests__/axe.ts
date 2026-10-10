import axe from 'axe-core';

/** Run axe on a container; colour contrast is not computable in jsdom. */
export async function axeViolations(container: Element) {
  const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
  return result.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
}
