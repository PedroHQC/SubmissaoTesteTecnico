export type ControlMode = 'buttons' | 'joystick';
const KEY = 'JUNGLE_CONTROL_MODE_V1';

export function loadControlMode(): ControlMode {
  try {
    return localStorage.getItem(KEY) === 'buttons' ? 'buttons' : 'joystick';
  } catch {
    return 'joystick';
  }
}

export function saveControlMode(mode: ControlMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* Session controls still work. */
  }
}
