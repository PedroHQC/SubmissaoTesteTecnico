import { ShipInput } from './ShipController';

export interface StickPosition {
  x: number;
  y: number;
}
export const STICK_DEADZONE = 0.14;

/** Screen-space stick direction becomes a heading, retaining the boat's inertia. */
export function joystickShipInput(
  stick: StickPosition,
  rotation: number,
  reversing = false
): ShipInput {
  const magnitude = Math.min(1, Math.hypot(stick.x, stick.y));
  if (magnitude <= STICK_DEADZONE) return { throttle: 0, steer: 0 };
  const target = Math.atan2(-stick.x, stick.y);
  const difference = Math.atan2(Math.sin(target - rotation), Math.cos(target - rotation));
  const strength = (magnitude - STICK_DEADZONE) / (1 - STICK_DEADZONE);
  return {
    throttle: strength * Math.max(0, Math.cos(difference)),
    steer: Math.max(-1, Math.min(1, difference / 0.6)) * (reversing ? -1 : 1),
  };
}
