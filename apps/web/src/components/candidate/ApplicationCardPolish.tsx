import { useEffect } from 'react';

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function polishCard(card: HTMLElement) {
  if (card.dataset.rfCardPolished === '1') return;

  const name = card.querySelector('.text-\[13px\], span.font-bold') as HTMLElement | null;
  if (name && name.textContent && name.textContent === name.textContent.toUpperCase()) {
    name.textContent = titleCase(name.textContent.trim());
  }

  const position = Array.from(card.querySelectorAll('span')).find((el) => {
    const text = el.textContent?.trim() || '';
    return text.length > 3 && text === text.toUpperCase() && el.className.includes('truncate');
  });
  if (position?.textContent) {
    position.textContent = titleCase(position.textContent.trim());
  }

  card.querySelectorAll('span').forEach((el) => {
    const text = el.textContent?.trim() || '';
    if (text === 'Claim') el.textContent = 'Assign to me';
    if (/^review profile$/i.test(text)) el.textContent = 'Review application →';
  });

  card.dataset.rfCardPolished = '1';
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
