// src/types/logContracts.ts
import { GameSettings } from '../services/gameSettings';

export type MatchEndReason = 'timeout' | 'dead';

export interface MatchRecord {
  matchId: string;
  playerId: string;
  playerName: string;
  playedAt: string; // ISO 8601
  score: number;
  durationSeconds: number;
  endReason: MatchEndReason;
  config: GameSettings;
}

export interface RankingEntry {
  rank: number;
  matchId: string;
  playerId: string;
  captainName: string;
  score: number;
  durationSeconds: number;
  playedAt: string;
  isCurrentPlayer: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface RankingQueryParams {
  mode?: 'arena' | 'open-sea';
  page: number;
  pageSize: number;
  sessionTime: number;
  enemySpawnInterval: number;
}

export interface HistoryQueryParams {
  playerId: string;
  page: number;
  pageSize: number;
}
