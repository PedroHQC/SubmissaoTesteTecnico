import { MatchRecord } from '../types/LogContracts';
const KEY = 'PIRATE_LAST_RESULT_V1';
export function loadLastResult(): MatchRecord | null {
  try {
    const result = JSON.parse(localStorage.getItem(KEY) || 'null') as MatchRecord | null;
    return result?.matchId && Number.isFinite(result.score) ? result : null;
  } catch {
    return null;
  }
}
export function saveLastResult(result: MatchRecord): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(result));
  } catch {
    /* Keep playing without storage. */
  }
}
