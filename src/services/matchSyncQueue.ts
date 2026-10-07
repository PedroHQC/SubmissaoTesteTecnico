// src/services/matchSyncQueue.ts
import { MatchRecord } from '../types/LogContracts';
import { matchApi } from './api/matchApi';

const PENDING_QUEUE_KEY = 'pb_pending_sync_matches_v1';

export const matchSyncQueue = {
  getPending(): MatchRecord[] {
    try {
      const raw = localStorage.getItem(PENDING_QUEUE_KEY);
      return raw ? (JSON.parse(raw) as MatchRecord[]) : [];
    } catch {
      return [];
    }
  },

  enqueue(match: MatchRecord): void {
    const list = this.getPending();
    if (!list.some((m) => m.matchId === match.matchId)) {
      list.push(match);
      try {
        localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(list));
      } catch (e) {
        console.warn('[Queue] Erro ao gravar fila:', e);
      }
    }
  },

  dequeue(matchId: string): void {
    const list = this.getPending().filter((m) => m.matchId !== matchId);
    try {
      localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('[Queue] Erro ao atualizar fila:', e);
    }
  },

  async flushPending(): Promise<void> {
    const pending = this.getPending();
    if (pending.length === 0) return;

    for (const match of pending) {
      try {
        await matchApi.registerMatch(match);
        this.dequeue(match.matchId);
      } catch {
        // Mantém na fila para nova tentativa em segundo plano sem quebrar o jogo
        break;
      }
    }
  },
};
