import { JuicyButton } from './JuicyButton';
import { GamePanel } from './GamePanel';
// src/components/ui/GameOverModal.tsx
import React from 'react';

/**
 * Configure os caminhos das imagens dos assets aqui.
 */
export const GAMEOVER_ASSETS = {
  frameBg: '/assets/UsedAssets/Ui/menu_frame.png',
  buttonLarge: '/assets/UsedAssets/Ui/btn_large.png',
};

interface GameOverModalProps {
  score: number;
  durationSeconds?: number;
  reason?: 'timeout' | 'dead';
  onPlayAgain: () => void;
  onMainMenu: () => void;
  registrationStatus: 'pending' | 'saving' | 'saved';
  onRetry: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  score,
  durationSeconds = 60,
  reason = 'timeout',
  onPlayAgain,
  onMainMenu,
  registrationStatus,
  onRetry,
}) => (
  <div className="modal-overlay" role="dialog" aria-labelledby="result-title">
    <GamePanel className="result-panel">
      <header>
        <h2 id="result-title">BATTLE COMPLETE</h2>
        <p>{reason === 'timeout' ? 'TIME UP' : 'SUNK'}</p>
      </header>
      <div className="result-stats">
        <span>
          SCORE<strong data-testid="final-score">{score}</strong>
        </span>
        <span>
          DURATION
          <strong>
            {String(Math.floor(durationSeconds / 60)).padStart(2, '0')}:
            {String(durationSeconds % 60).padStart(2, '0')}
          </strong>
        </span>
      </div>
      <div className="menu-primary">
        <JuicyButton className="menu-button" onClick={onPlayAgain}>
          PLAY AGAIN
        </JuicyButton>
        <JuicyButton className="menu-button" onClick={onMainMenu}>
          MAIN MENU
        </JuicyButton>
      </div>
      <div className="registration-status" role="status">
        {registrationStatus === 'saved'
          ? 'Match saved'
          : registrationStatus === 'saving'
            ? 'Saving match…'
            : 'Saved locally. Upload pending.'}
        {registrationStatus === 'pending' && (
          <JuicyButton onClick={onRetry}>Retry upload</JuicyButton>
        )}
      </div>
    </GamePanel>
  </div>
);
