import { JuicyButton } from './JuicyButton';
import { GamePanel } from './GamePanel';
// src/components/ui/MainMenu.tsx
import React from 'react';

/**
 * Configure os caminhos das suas imagens aqui.
 * Se deixar vazio (''), o componente renderiza o estilo visual em CSS idêntico à arte.
 */
export const MENU_ASSETS = {
  frameBg: '/assets/UsedAssets/Ui/menu_frame.png',
  titleBanner: '/assets/UsedAssets/Ui/title_banner.png',
  buttonLarge: '/assets/UsedAssets/Ui/btn_large.png',
  buttonSmall: '/assets/UsedAssets/Ui/btn_small.png',
  shipIcon: '/assets/UsedAssets/Ui/ship_icon.png',
};

interface MainMenuProps {
  onPlay: () => void;
  onOptions: () => void;
  onRanking?: () => void;
  onMatchHistory?: () => void;
  onControls?: () => void;
  onLastResult?: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onPlay,
  onOptions,
  onRanking,
  onMatchHistory,
  onLastResult,
}) => (
  <div className="modal-overlay" role="dialog" aria-label="Main menu">
    <GamePanel className="main-menu">
      <div className="menu-brand">
        <img className="title-banner" src={MENU_ASSETS.titleBanner} alt="Pirate Battle" />
        <p>Set Sail. Take Command.</p>
      </div>
      <div className="menu-primary">
        <JuicyButton className="menu-button" onClick={onPlay}>
          PLAY
        </JuicyButton>
        <JuicyButton className="menu-button" onClick={onOptions}>
          OPTIONS
        </JuicyButton>
      </div>
      <div className="menu-flavor">
        <img src={MENU_ASSETS.shipIcon} alt="" />
        <p>Navigate the islands. Survive the battle.</p>
      </div>
      <p className="control-hint">
        W/S: throttle · A/D: turn · Space: bow · Q/E: broadsides
        <br />
        Touch: drag the joystick and hold a cannon. Options → Controls.
      </p>
      <div className="menu-secondary">
        <JuicyButton className="menu-button small" onClick={onRanking}>
          RANKING
        </JuicyButton>
        <JuicyButton className="menu-button small" onClick={onMatchHistory}>
          MATCH HISTORY
        </JuicyButton>
      </div>
      {onLastResult && (
        <JuicyButton className="last-result-button" onClick={onLastResult}>
          Last result
        </JuicyButton>
      )}
    </GamePanel>
  </div>
);
