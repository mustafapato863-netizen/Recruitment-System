import { useEffect } from 'react';
import { inferPriorityFromTitle, isSkillPrioritized } from './skillTags';

const LIMIT = 6;

function readPositionTitle(root: ParentNode): string {
  const nodes = Array.from(root.querySelectorAll('dt, dd, span, p, h2, h3'));
  for (let i = 0; i < nodes.length; i += 1) {
    const text = nodes[i].textContent?.trim();
    if (text === 'Position' && nodes[i + 1]?.textContent) {
      return nodes[i + 1].textContent?.trim() || '';
    }
  }
  return document.querySelector('h1')?.textContent?.trim() || '';
}

function collapseCard(heading: HTMLElement) {
  const card = heading.closest('div');
  if (!card || card.dataset.rfSkillsCollapsed === '1') return;

  const chipRow = Array.from(card.querySelectorAll('div')).find((row) => {
    const chips = row.querySelectorAll(':scope > span');
    return chips.length >= 8;
  });
  if (!chipRow) return;

  const chips = Array.from(chipRow.querySelectorAll(':scope > span')) as HTMLElement[];
  if (chips.length <= LIMIT) return;

  const title = readPositionTitle(document);
  const priority = inferPriorityFromTitle(title);
  const ranked = [
    ...chips.filter((chip) => isSkillPrioritized(chip.textContent || '', priority)),
    ...chips.filter((chip) => !isSkillPrioritized(chip.textContent || '', priority)),
  ];
  ranked.forEach((chip) => chipRow.appendChild(chip));

  const apply = (expanded: boolean) => {
    ranked.forEach((chip, index) => {
      const keep = expanded || index < LIMIT;
      chip.hidden = !keep;
      chip.style.display = keep ? '' : 'none';
    });
  };
  apply(false);

  chipRow.querySelectorAll('[data-rf-skill-more]').forEach((el) => el.remove());
  const more = document.createElement('button');
  more.type = 'button';
  more.dataset.rfSkillMore = '1';
  more.className = 'text-[10px] font-extrabold text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5';
  more.textContent = `+${chips.length - LIMIT}`;
  more.addEventListener('click', () => {
    const open = more.dataset.open === '1';
    if (open) {
      apply(false);
      more.dataset.open = '0';
      more.textContent = `+${chips.length - LIMIT}`;
    } else {
      apply(true);
      more.dataset.open = '1';
      more.textContent = 'Show less';
    }
  });
  chipRow.appendChild(more);
  card.dataset.rfSkillsCollapsed = '1';
}

export function CollapseInitialMatchSkills() {
  useEffect(() => {
    const run = () => {
      document.querySelectorAll('h3').forEach((heading) => {
        if (heading.textContent?.trim() === 'Initial match') {
          collapseCard(heading as HTMLElement);
        }
      });
    };
    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
