// src/components/ui/PlayerHUD.tsx
import React from 'react';
import { ControlMode } from '../../services/controlSettings';
import { StickPosition } from '../../engine/entities/JoystickInput';
import { TouchButton } from './TouchButton';
import { VirtualJoystick } from './VirtualJoystick';
import { JuicyButton } from './JuicyButton';

/**
 * Configure os caminhos das imagens dos assets da HUD aqui.
 */
export const HUD_ASSETS = {
  // Topo Esquerdo
  hpFrame: '/assets/UsedAssets/Ui/HUD/health_frame.png', // Ex: '/assets/ui/hud_hp_frame.png'
  hpHeartIcon: '/assets/UsedAssets/Ui/HUD/icon_heart.png', // Ex: '/assets/ui/hud_heart.png'

  // Topo Direito
  badgeFrame: '/assets/UsedAssets/Ui/HUD/counter_panel.png', // Ex: '/assets/ui/hud_badge_frame.png'
  starIcon: '/assets/UsedAssets/Ui/HUD/icon_score.png', // Ex: '/assets/ui/hud_star.png'
  clockIcon: '/assets/UsedAssets/Ui/HUD/icon_time.png', // Ex: '/assets/ui/hud_clock.png'
  pauseButton: '/assets/UsedAssets/Ui/icon_pause.png', // Ex: '/assets/ui/hud_btn_pause.png'

  // Botões Circulares Inferiores
  btnCircleBase: '/assets/UsedAssets/Ui/button_round.png', // Ex: '/assets/ui/hud_btn_circle.png'
  iconArrowUp: '/assets/UsedAssets/Ui/icon_forward.png', // Ex: '/assets/ui/hud_icon_up.png'
  iconTurnLeft: '/assets/UsedAssets/Ui/icon_turn_left.png', // Ex: '/assets/ui/hud_icon_turn_left.png'
  iconTurnRight: '/assets/UsedAssets/Ui/icon_turn_right.png', // Ex: '/assets/ui/hud_icon_turn_right.png'
  iconShootFront: '/assets/UsedAssets/Ui/icon_fire_front.png', // Ex: '/assets/ui/hud_icon_cannon_front.png'
  iconShootLeft: '/assets/UsedAssets/Ui/icon_fire_left.png', // Ex: '/assets/ui/hud_icon_cannon_left.png'
  iconShootRight: '/assets/UsedAssets/Ui/icon_fire_right.png', // Ex: '/assets/ui/hud_icon_cannon_right.png'
};

interface PlayerHUDProps {
  currentHp: number;
  maxHp?: number;
  score: number;
  wave: number;
  timeRemainingSeconds: number;
  onPause: () => void;
  controlMode: ControlMode;
  onStick: (position: StickPosition) => void;
  onAction: (code: string, pressed: boolean) => void;
}

export const PlayerHUD: React.FC<PlayerHUDProps> = ({
  currentHp,
  maxHp = 100,
  score,
  wave,
  timeRemainingSeconds,
  onPause,
  controlMode,
  onStick,
  onAction,
}) => {
  const hp = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
  const time = Math.max(0, Math.ceil(timeRemainingSeconds));
  const formatted =
    String(Math.floor(time / 60)).padStart(2, '0') + ':' + String(time % 60).padStart(2, '0');
  return (
    <div className="player-hud">
      <div className="hud-top">
        <div
          className="hud-health"
          aria-label="Health"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={maxHp}
          aria-valuenow={currentHp}
        >
          <img src={HUD_ASSETS.hpHeartIcon} alt="" />
          <div className="health-track">
            <div style={{ width: hp + '%' }} />
            <span>
              {currentHp} / {maxHp}
            </span>
          </div>
        </div>
        <div className="hud-counters">
          <div className="hud-badge" aria-label="Score" data-testid="score">
            <img src={HUD_ASSETS.starIcon} alt="" />
            <span>{score}</span>
          </div>
          <div className="hud-badge" aria-label="Time remaining" data-testid="timer">
            <img src={HUD_ASSETS.clockIcon} alt="" />
            <span>{formatted}</span>
          </div>
          <JuicyButton className="touch-button pause-button" aria-label="Pause" onClick={onPause}>
            <img src={HUD_ASSETS.pauseButton} alt="" />
          </JuicyButton>
        </div>
      </div>
      <div className="hud-wave" aria-label="Current wave">
        Wave {wave}
      </div>
      <div className="hud-bottom">
        {controlMode === 'joystick' ? (
          <VirtualJoystick onChange={onStick} />
        ) : (
          <div className="touch-cluster" aria-label="Movement">
            <TouchButton
              label="Accelerate"
              icon={HUD_ASSETS.iconArrowUp}
              className="cluster-front"
              onHold={(held) => onAction('KeyW', held)}
            />
            <TouchButton
              label="Turn left"
              icon={HUD_ASSETS.iconTurnLeft}
              className="cluster-left"
              onHold={(held) => onAction('KeyA', held)}
            />
            <TouchButton
              label="Turn right"
              icon={HUD_ASSETS.iconTurnRight}
              className="cluster-right"
              onHold={(held) => onAction('KeyD', held)}
            />
          </div>
        )}
        <div className="touch-cluster" aria-label="Cannons">
          <TouchButton
            label="Fire bow"
            icon={HUD_ASSETS.iconShootFront}
            className="cluster-front"
            onHold={(held) => onAction('Space', held)}
          />
          <TouchButton
            label="Fire port"
            icon={HUD_ASSETS.iconShootLeft}
            className="cluster-left"
            onHold={(held) => onAction('KeyQ', held)}
          />
          <TouchButton
            label="Fire starboard"
            icon={HUD_ASSETS.iconShootRight}
            className="cluster-right"
            onHold={(held) => onAction('KeyE', held)}
          />
        </div>
      </div>
    </div>
  );
};
