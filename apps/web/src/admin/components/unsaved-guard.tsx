import { useCallback, useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';
import { useConfirm } from '@/components/ui/dialog';

/**
 * Warns before leaving a form with unsaved changes: in-app navigation (router blocker)
 * and tab close / reload (beforeunload). Call `allowNavigation()` right before navigating
 * away programmatically after a successful save.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const confirm = useConfirm();
  const dirtyRef = useRef(dirty);
  const bypass = useRef(false);
  dirtyRef.current = dirty;

  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }: { currentLocation: { pathname: string }; nextLocation: { pathname: string } }) =>
        dirtyRef.current && !bypass.current && currentLocation.pathname !== nextLocation.pathname,
      [],
    ),
  );

  const blockerRef = useRef(blocker);
  blockerRef.current = blocker;
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    let cancelled = false;
    confirm({
      title: 'Уйти без сохранения?',
      description: 'Изменения в форме не сохранены и будут потеряны.',
      confirmLabel: 'Уйти',
      danger: true,
    }).then((ok) => {
      if (cancelled) return;
      const b = blockerRef.current;
      if (b.state !== 'blocked') return;
      if (ok) b.proceed();
      else b.reset();
    });
    return () => {
      cancelled = true;
    };
  }, [blocker.state, confirm]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (bypass.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  return {
    allowNavigation: () => {
      bypass.current = true;
      // Re-arm on the next tick so the guard keeps working if we stay on the page.
      setTimeout(() => (bypass.current = false), 300);
    },
  };
}
