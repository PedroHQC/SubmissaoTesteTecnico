import React from 'react';
import { audio } from '../../engine/services/audioManager';
import './JuicyButton.css';

let lastHoverSound = 0;

export function JuicyButton({
  className = '',
  onPointerEnter,
  onClick,
  onFocus,
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>): React.JSX.Element {
  const hoverSound = (): void => {
    const now = performance.now();
    if (!props.disabled && now - lastHoverSound > 70) {
      audio.playSFX('ui_hover');
      lastHoverSound = now;
    }
  };

  return (
    <button
      {...props}
      type={type}
      className={`juicy-button ${className}`}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') hoverSound();
        onPointerEnter?.(event);
      }}
      onFocus={(event) => {
        if (event.currentTarget.matches(':focus-visible')) hoverSound();
        onFocus?.(event);
      }}
      onClick={(event) => {
        audio.playSFX('ui_click');
        onClick?.(event);
      }}
    />
  );
}
