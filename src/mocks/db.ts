// src/mocks/db.ts
import { MatchRecord, RankingEntry, PaginatedResponse } from '../types/LogContracts';

const STORAGE_DB_KEY = 'pb_msw_confirmed_matches_v1';

export const INITIAL_FIXTURES: MatchRecord[] = [
  {
    matchId: 'fix-01',
    playerId: 'f-1',
    playerName: 'Captain Flint',
    playedAt: '2026-09-08T21:42:00Z',
    score: 38,
    durationSeconds: 60,
    endReason: 'timeout',
    config: { sessionTime: 60, enemySpawnInterval: 1.5 },
  },
  {
    matchId: 'fix-02',
    playerId: 'f-2',
    playerName: 'Red Sparrow',
    playedAt: '2026-09-08T20:18:00Z',
    score: 32,
    durationSeconds: 58,
    endReason: 'dead',
    config: { sessionTime: 60, enemySpawnInterval: 1.5 },
  },
  {
    matchId: 'fix-03',
    playerId: 'f-3',
    playerName: 'Storm Rider',
    playedAt: '2026-09-08T18:50:00Z',
    score: 21,
    durationSeconds: 60,
    endReason: 'timeout',
    config: { sessionTime: 60, enemySpawnInterval: 1.5 },
  },
  {
    matchId: 'fix-04',
    playerId: 'f-4',
    playerName: 'Sea Wolf',
    playedAt: '2026-09-08T18:24:00Z',
    score: 19,
    durationSeconds: 45,
    endReason: 'dead',
    config: { sessionTime: 60, enemySpawnInterval: 1.5 },
  },
  {
    matchId: 'fix-05',
    playerId: 'f-5',
    playerName: 'Blackbeard',
    playedAt: '2026-09-08T17:15:00Z',
    score: 18,
    durationSeconds: 60,
    endReason: 'timeout',
    config: { sessionTime: 60, enemySpawnInterval: 1.5 },
  },
  {
    matchId: 'fix-06',
    playerId: 'f-6',
    playerName: 'Anne Bonny',
    playedAt: '2026-09-08T16:40:00Z',
    score: 17,
    durationSeconds: 34,
    endReason: 'dead',
    config: { sessionTime: 60, enemySpawnInterval: 1.5 },
  },
];

export const mockDb = {
  getAllMatches(): MatchRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_DB_KEY);
      if (data) return JSON.parse(data) as MatchRecord[];
      // Preserve matches from the previous local API during migration.
      const legacy = JSON.parse(
        localStorage.getItem('pb_matches_database_v1') || '[]'
      ) as MatchRecord[];
      const merged = new Map(
        [...INITIAL_FIXTURES, ...legacy].map((match) => [match.matchId, match])
      );
      return [...merged.values()];
    } catch {
      return [...INITIAL_FIXTURES];
    }
  },

  // Gravação idempotente por matchId
  insertMatch(match: MatchRecord): MatchRecord {
    const list = this.getAllMatches();
    const existingIndex = list.findIndex((m) => m.matchId === match.matchId);
    if (existingIndex >= 0) {
      return list[existingIndex]; // Já existente: preserva idempotência
    }
    list.push(match);
    localStorage.setItem(STORAGE_DB_KEY, JSON.stringify(list));
    return match;
  },

  reset(): void {
    localStorage.setItem(STORAGE_DB_KEY, JSON.stringify(INITIAL_FIXTURES));
  },

  queryRanking(
    sessionTime: number,
    enemySpawnInterval: number,
    page: number,
    pageSize: number,
    currentPlayerId: string,
    mode = 'arena'
  ): PaginatedResponse<RankingEntry> {
    const all = this.getAllMatches();
    const filtered = all.filter(
      (m) =>
        m.config.sessionTime === sessionTime &&
        m.config.enemySpawnInterval === enemySpawnInterval &&
        (m.config.mode || 'arena') === mode
    );

    // Critério determinístico: Pontos DESC > Duração DESC > Data DESC > ID ASC
    filtered.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.durationSeconds !== a.durationSeconds) return b.durationSeconds - a.durationSeconds;
      const t = new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime();
      return t !== 0 ? t : a.matchId.localeCompare(b.matchId);
    });

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return {
      data: items.map((m, idx) => ({
        rank: start + idx + 1,
        matchId: m.matchId,
        playerId: m.playerId,
        captainName: m.playerName,
        score: m.score,
        durationSeconds: m.durationSeconds,
        playedAt: m.playedAt,
        isCurrentPlayer: m.playerId === currentPlayerId,
      })),
      page,
      pageSize,
      totalItems,
      totalPages,
    };
  },

  queryHistory(playerId: string, page: number, pageSize: number): PaginatedResponse<MatchRecord> {
    const all = this.getAllMatches();
    const playerMatches = all
      .filter((m) => m.playerId === playerId)
      .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());

    const totalItems = playerMatches.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const start = (page - 1) * pageSize;

    return {
      data: playerMatches.slice(start, start + pageSize),
      page,
      pageSize,
      totalItems,
      totalPages,
    };
  },
};
