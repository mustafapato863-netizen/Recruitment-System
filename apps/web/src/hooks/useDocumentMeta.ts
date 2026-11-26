import { useEffect } from 'react';

const DEFAULT_TITLE = 'Saudi German Health • RecruitFlow';
const DEFAULT_DESCRIPTION =
  'Saudi German Health RecruitFlow — Enterprise recruitment workflow, applicant tracking, and candidate career portal.';

/** Updates document title and meta description for the active route and restores defaults on unmount. */
export function useDocumentMeta(title?: string, description?: string): void {
  useEffect(() => {
    const previousTitle = document.title;
    const metaTag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = metaTag?.getAttribute('content') ?? DEFAULT_DESCRIPTION;

    if (title) {
      document.title = title;
    }
    if (metaTag && description) {
      metaTag.setAttribute('content', description);
    }

    return () => {
      document.title = previousTitle || DEFAULT_TITLE;
      if (metaTag) {
        metaTag.setAttribute('content', previousDescription);
      }
    };
  }, [title, description]);
}
