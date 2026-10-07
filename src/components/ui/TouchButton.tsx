import { useEffect, useRef } from 'react';

interface Props {
  label: string;
  icon: string;
  className?: string;
  onHold: (pressed: boolean) => void;
}

/** Pointer capture keeps multi-touch holds reliable even outside the button. */
export function TouchButton({ label, icon, className = '', onHold }: Props) {
  const pointer = useRef<number | null>(null);
  const callback = useRef(onHold);
  callback.current = onHold;
  const release = (): void => {
    pointer.current = null;
    callback.current(false);
  };
  useEffect(() => () => callback.current(false), []);
  return (
    <button
      type="button"
      className={`touch-button ${className}`}
      aria-label={label}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (pointer.current !== null || event.button !== 0) return;
        event.preventDefault();
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        callback.current(true);
      }}
      onPointerUp={(event) => {
        if (event.pointerId === pointer.current) release();
      }}
      onPointerCancel={(event) => {
        if (event.pointerId === pointer.current) release();
      }}
      onLostPointerCapture={(event) => {
        if (event.pointerId === pointer.current) release();
      }}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          callback.current(true);
        }
      }}
      onKeyUp={(event) => {
        if (event.key === ' ' || event.key === 'Enter') release();
      }}
      onBlur={release}
    >
      <img src={icon} alt="" draggable={false} />
    </button>
  );
}
