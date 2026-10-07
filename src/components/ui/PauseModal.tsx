import { JuicyButton } from './JuicyButton';
import { GamePanel } from './GamePanel';
// src/components/ui/PauseModal.tsx
import React from 'react';

/**
 * Configure os caminhos das imagens dos assets aqui.
 */
export const PAUSE_ASSETS = {
  frameBg: '/assets/UsedAssets/Ui/menu_frame.png',
  buttonLarge: '/assets/UsedAssets/Ui/btn_large.png',
};

interface PauseModalProps {
  onResume: () => void;
  onOptions: () => void;
  onMainMenu: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({ onResume, onOptions, onMainMenu }) => (
  <div className="modal-overlay" role="dialog" aria-labelledby="pause-title">
    <GamePanel className="pause-panel">
      <header>
        <h2 id="pause-title">PAUSED</h2>
        <p>Ready when you are.</p>
      </header>
      <div className="menu-primary">
        <JuicyButton className="menu-button" onClick={onResume}>
          RESUME
        </JuicyButton>
        <JuicyButton className="menu-button" onClick={onOptions}>
          OPTIONS
        </JuicyButton>
        <JuicyButton className="menu-button" onClick={onMainMenu}>
          MAIN MENU
        </JuicyButton>
      </div>
    </GamePanel>
  </div>
);
