// src/services/api/matchApi.ts
import axios from 'axios';
import {
  MatchRecord,
  RankingEntry,
  PaginatedResponse,
  RankingQueryParams,
  HistoryQueryParams,
} from '../../types/LogContracts';

export const CURRENT_PLAYER_ID = 'player_jack_current';
export const CURRENT_PLAYER_NAME = 'Captain Jack';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 4500, // Dispara erro se a requisição passar do timeout configurado
});

export const matchApi = {
  async registerMatch(record: MatchRecord): Promise<MatchRecord> {
    const response = await apiClient.post<MatchRecord>('/matches', record);
    return response.data;
  },

  async getRanking(
    params: RankingQueryParams,
    signal?: AbortSignal
  ): Promise<PaginatedResponse<RankingEntry>> {
    const response = await apiClient.get<PaginatedResponse<RankingEntry>>('/ranking', {
      signal,
      params: {
        ...params,
        currentPlayerId: CURRENT_PLAYER_ID,
      },
    });
    return response.data;
  },

  async getPlayerHistory(
    params: HistoryQueryParams,
    signal?: AbortSignal
  ): Promise<PaginatedResponse<MatchRecord>> {
    const response = await apiClient.get<PaginatedResponse<MatchRecord>>('/history', {
      signal,
      params,
    });
    return response.data;
  },
};
