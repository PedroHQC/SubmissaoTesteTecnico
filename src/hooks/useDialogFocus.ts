import { useEffect } from 'react';

export function useDialogFocus(key: string, onEscape: () => void): void {
  useEffect(() => {
    const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')];
    const dialog = dialogs[dialogs.length - 1];
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogs.slice(0, -1).forEach((element) => {
      element.inert = true;
    });
    const focusable = (): HTMLElement[] =>
      [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select, [tabindex="0"]'
        ),
      ].filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onEscape();
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (!elements.length) {
        event.preventDefault();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      dialogs.forEach((element) => {
        element.inert = false;
      });
      if (previous?.isConnected) previous.focus();
    };
  }, [key]);
}
