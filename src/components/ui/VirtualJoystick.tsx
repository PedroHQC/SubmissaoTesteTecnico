import { useEffect, useRef, useState } from 'react';
import type { StickPosition } from '../../engine/entities/JoystickInput';

export function VirtualJoystick({ onChange }: { onChange: (position: StickPosition) => void }) {
  const pointer = useRef<number | null>(null);
  const callback = useRef(onChange);
  callback.current = onChange;
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const reset = (): void => {
    pointer.current = null;
    setPosition({ x: 0, y: 0 });
    callback.current({ x: 0, y: 0 });
  };
  useEffect(() => {
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('blur', reset);
      callback.current({ x: 0, y: 0 });
    };
  }, []);
  const move = (event: React.PointerEvent<HTMLDivElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = rect.width * 0.32;
    const x = (event.clientX - rect.left - rect.width / 2) / radius;
    const y = (event.clientY - rect.top - rect.height / 2) / radius;
    const length = Math.max(1, Math.hypot(x, y));
    const next = { x: x / length, y: y / length };
    setPosition(next);
    callback.current(next);
  };
  return (
    <div
      className="virtual-joystick"
      role="group"
      aria-label="Navigation joystick"
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (pointer.current !== null || event.button !== 0) return;
        event.preventDefault();
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        move(event);
      }}
      onPointerMove={(event) => {
        if (pointer.current === event.pointerId) move(event);
      }}
      onPointerUp={(event) => {
        if (pointer.current === event.pointerId) reset();
      }}
      onPointerCancel={(event) => {
        if (pointer.current === event.pointerId) reset();
      }}
      onLostPointerCapture={(event) => {
        if (pointer.current === event.pointerId) reset();
      }}
    >
      <span className="joystick-ring" />
      <span
        className="joystick-knob"
        style={{
          left: `${50 + position.x * 32}%`,
          top: `${50 + position.y * 32}%`,
        }}
      />
      <span className="joystick-caption">SAIL</span>
    </div>
  );
}
