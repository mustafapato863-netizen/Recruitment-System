import { useEffect } from 'react';

function titleCase(value: string): string {
  return value.toLowerCase().replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function polishCard(card: HTMLElement) {
  const name = card.querySelector('span.font-bold') as HTMLElement | null;
  if (name?.textContent && name.textContent === name.textContent.toUpperCase() && name.textContent.length > 3) {
    name.textContent = titleCase(name.textContent.trim());
  }

  card.querySelectorAll('span').forEach((el) => {
    const text = el.textContent?.trim() || '';
    if (text === 'Claim') el.textContent = 'Assign to me';
    if (/^review profile$/i.test(text)) el.textContent = 'Review application \u2192';
    if (text === text.toUpperCase() && text.length > 8 && el.className.includes('truncate')) {
      el.textContent = titleCase(text);
    }
  });
}

export function ApplicationCardPolish() {
  useEffect(() => {
    const run = () => {
      document.querySelectorAll<HTMLElement>('.cursor-grab.group').forEach(polishCard);
    };
    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
