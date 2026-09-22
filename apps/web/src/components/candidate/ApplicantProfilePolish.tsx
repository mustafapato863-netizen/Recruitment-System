import { useEffect } from 'react';

export function ApplicantProfilePolish() {
  useEffect(() => {
    const sync = () => {
      const workspace = document.querySelector('section[aria-label="Unified applicant stage workspace"]');
      document.body.classList.toggle('rf-profile-compact', Boolean(workspace));
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.body.classList.remove('rf-profile-compact');
    };
  }, []);
  return null;
}
