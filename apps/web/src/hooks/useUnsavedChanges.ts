import { useEffect } from 'react';

const DEFAULT_MESSAGE = 'You have unsaved changes. Discard them?';

export function useUnsavedChanges(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);
}

export function confirmDiscardChanges(isDirty: boolean, message = DEFAULT_MESSAGE) {
  return !isDirty || window.confirm(message);
}
