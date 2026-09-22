import { useEffect } from 'react';

function hideDuplicateProfileBlocks() {
  const workspace = document.querySelector('section[aria-label="Unified applicant stage workspace"]');
  document.body.classList.toggle('rf-profile-compact', Boolean(workspace));
  if (!workspace) return;

  let el = workspace.nextElementSibling as HTMLElement | null;
  while (el) {
    const text = (el.textContent || '').toLowerCase();
    const isTabs = el.className.includes('border-b') && text.includes('overview') && text.includes('resume');
    const isLegacyGrid =
      el.className.includes('grid-cols-1') &&
      (text.includes('current stage') || text.includes('profile summary') || text.includes('360'));
    if (isTabs || isLegacyGrid) {
      el.hidden = true;
      el.style.display = 'none';
    }
    el = el.nextElementSibling as HTMLElement | null;
  }
}

export function ApplicantProfilePolish() {
  useEffect(() => {
    hideDuplicateProfileBlocks();
    const observer = new MutationObserver(hideDuplicateProfileBlocks);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.body.classList.remove('rf-profile-compact');
    };
  }, []);
  return null;
}
