import { JuicyButton } from './JuicyButton';
import { GamePanel } from './GamePanel';
// src/components/ui/CaptainsLogModal.tsx
import React, { useState, useEffect } from 'react';
import { useRankingQuery, useMatchHistoryQuery } from '../../hooks/useCaptainsLog';
import { CURRENT_PLAYER_ID } from '../../services/api/matchApi';
import { matchSyncQueue } from '../../services/matchSyncQueue';
import { useQueryClient } from '@tanstack/react-query';
export const LOG_ASSETS = {
  frameBg: '/assets/UsedAssets/Ui/boardResized.png',
  tabActive: '/assets/UsedAssets/Ui/btn_large.png', // Ex: '/assets/ui/btn_tab_active.png' (botão dourado)
  tabInactive: '/assets/UsedAssets/Ui/btn_small.png', // Ex: '/assets/ui/btn_tab_inactive.png' (botão escuro)
  buttonLarge: '/assets/UsedAssets/Ui/btn_large.png',
  buttonCircle: '/assets/UsedAssets/Ui/button_round.png', // Ex: '/assets/ui/btn_circle_base.png' (base redonda of madeira/dourada)

  arrowLeft: '/assets/UsedAssets/Ui/icon_turn_left.png', // Ex: '/assets/ui/icon_arrow_left.png'
  arrowRight: '/assets/UsedAssets/Ui/icon_turn_right.png', // Ex: '/assets/ui/icon_arrow_right.png'
  iconStar: '/assets/UsedAssets/Ui/icon_score.png', // Ex: '/assets/ui/icon_star.png'
};
interface CaptainsLogModalProps {
  onClose: () => void;
  initialTab?: 'RANKING' | 'HISTORY';
  sessionTime?: number;
  spawnInterval?: number;
  mode?: 'arena' | 'open-sea';
}

export const CaptainsLogModal: React.FC<CaptainsLogModalProps> = ({
  onClose,
  initialTab = 'RANKING',
  sessionTime = 120,
  spawnInterval = 3,
  mode = 'arena',
}) => {
  const [activeTab, setActiveTab] = useState<'RANKING' | 'HISTORY'>(initialTab);
  const [page, setPage] = useState<number>(1);
  const pageSize = 5;
  const queryClient = useQueryClient();

  useEffect(() => {
    void queryClient.invalidateQueries({
      queryKey: [activeTab === 'RANKING' ? 'ranking' : 'matchHistory'],
    });
  }, [activeTab, queryClient]);

  // Efetua a tentativa of sincronizar partidas pendentes em segundo plano ao abrir o modal
  useEffect(() => {
    void matchSyncQueue.flushPending().then(() => {
      void queryClient.invalidateQueries({ queryKey: ['ranking'] });
      void queryClient.invalidateQueries({ queryKey: ['matchHistory'] });
    });
  }, [queryClient]);

  // Consultas TanStack Query
  const rankingQuery = useRankingQuery({
    page,
    pageSize,
    sessionTime,
    enemySpawnInterval: spawnInterval,
    mode,
  });

  const historyQuery = useMatchHistoryQuery({
    playerId: CURRENT_PLAYER_ID,
    page,
    pageSize,
  });

  const currentQuery = activeTab === 'RANKING' ? rankingQuery : historyQuery;
  const totalPages = currentQuery.data?.totalPages || 1;

  const formatDateDisplay = (isoStr: string): string => {
    try {
      const d = new Date(isoStr);
      return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="log-title">
      <GamePanel className="log-panel">
        <h2 id="log-title">CAPTAIN'S LOG</h2>
        <div className="modal-tabs" role="tablist" aria-label="Naval records">
          <JuicyButton
            role="tab"
            aria-selected={activeTab === 'RANKING'}
            onClick={() => {
              setActiveTab('RANKING');
              setPage(1);
            }}
          >
            RANKING
          </JuicyButton>
          <JuicyButton
            role="tab"
            aria-selected={activeTab === 'HISTORY'}
            onClick={() => {
              setActiveTab('HISTORY');
              setPage(1);
            }}
          >
            MATCH HISTORY
          </JuicyButton>
        </div>
        <p className="log-settings">
          {mode === 'arena' ? 'Arena' : 'Open Sea'} / {sessionTime}s battles / {spawnInterval}s
          spawns
        </p>
        <div
          className="panel-scroll"
          role="tabpanel"
          aria-label={activeTab === 'RANKING' ? 'Ranking' : 'Match history'}
        >
          {currentQuery.isLoading ? (
            <p role="status">Loading naval records...</p>
          ) : currentQuery.isError ? (
            <div role="alert">
              <p>Could not load records.</p>
              <JuicyButton onClick={() => void currentQuery.refetch()}>Try again</JuicyButton>
            </div>
          ) : !currentQuery.data?.data.length ? (
            <p>No matches {activeTab === 'RANKING' ? 'for this configuration.' : 'played yet.'}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  {(activeTab === 'RANKING'
                    ? ['Rank', 'Captain', 'Score', 'Played']
                    : ['Result', 'Played', 'Score', 'Duration']
                  ).map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeTab === 'RANKING'
                  ? rankingQuery.data?.data.map((row) => (
                      <tr key={row.matchId} data-current-player={row.isCurrentPlayer}>
                        <td>{row.rank}</td>
                        <td>
                          {row.captainName}
                          {row.isCurrentPlayer ? ' (YOU)' : ''}
                        </td>
                        <td>{row.score}</td>
                        <td>{formatDateDisplay(row.playedAt)}</td>
                      </tr>
                    ))
                  : historyQuery.data?.data.map((row) => (
                      <tr key={row.matchId}>
                        <td>{row.endReason === 'timeout' ? 'Time up' : 'Sunk'}</td>
                        <td>{formatDateDisplay(row.playedAt)}</td>
                        <td>{row.score}</td>
                        <td>{row.durationSeconds}s</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="log-pagination">
          <JuicyButton
            aria-label="Previous page"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </JuicyButton>
          <span>
            PAGE {page} OF {totalPages}
          </span>
          <JuicyButton
            aria-label="Next page"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </JuicyButton>
        </div>
        <span className="query-status" role="status">
          {currentQuery.isFetching && !currentQuery.isLoading ? 'Updating records...' : ''}
        </span>
        <JuicyButton className="menu-button panel-footer" onClick={onClose}>
          MAIN MENU
        </JuicyButton>
      </GamePanel>
    </div>
  );
};
