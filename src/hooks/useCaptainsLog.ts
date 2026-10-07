// src/hooks/useCaptainsLog.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { matchApi } from '../services/api/matchApi';
import { matchSyncQueue } from '../services/matchSyncQueue';
import { MatchRecord, RankingQueryParams, HistoryQueryParams } from '../types/LogContracts';

export function useRankingQuery(params: RankingQueryParams) {
  return useQuery({
    queryKey: [
      'ranking',
      params.sessionTime,
      params.enemySpawnInterval,
      params.page,
      params.pageSize,
      params.mode || 'arena',
    ],
    queryFn: ({ signal }) => matchApi.getRanking(params, signal),
    staleTime: 1000 * 30, // 30 segundos de frescura
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

export function useMatchHistoryQuery(params: HistoryQueryParams) {
  return useQuery({
    queryKey: ['matchHistory', params.playerId, params.page, params.pageSize],
    queryFn: ({ signal }) => matchApi.getPlayerHistory(params, signal),
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

export function useRegisterMatchMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (record: MatchRecord) => {
      // Regista na fila resiliente antes de disparar o pedido HTTP
      matchSyncQueue.enqueue(record);
      const res = await matchApi.registerMatch(record);
      matchSyncQueue.dequeue(record.matchId);
      return res;
    },
    onSuccess: () => {
      // Invalidação atómica de ambas as abas
      void queryClient.invalidateQueries({ queryKey: ['ranking'] });
      void queryClient.invalidateQueries({ queryKey: ['matchHistory'] });
    },
    onError: (err, record) => {
      console.warn(
        '[useRegisterMatchMutation] Falha na rede. Partida retida na fila pendente:',
        record.matchId,
        err
      );
    },
  });
}
