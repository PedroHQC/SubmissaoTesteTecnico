import { JuicyButton } from './JuicyButton';
import { GamePanel } from './GamePanel';
// src/components/ui/OptionsModal.tsx
import React, { useState } from 'react';
import { GameSettings, saveSettings, SETTINGS_LIMITS } from '../../services/gameSettings';
import { AudioOptions } from './AudioOptions';
import { audio } from '../../engine/services/audioManager';
import { ControlMode } from '../../services/controlSettings';
import { NetworkScenarioToolbar } from './NetworkScenarioToolbar';

/**
 * Configure os caminhos dos assets aqui.
 */
export const OPTIONS_ASSETS = {
  frameBg: '/assets/UsedAssets/Ui/menu_frame.png',
  buttonLarge: '/assets/UsedAssets/Ui/btn_large.png',
  buttonCircle: '/assets/UsedAssets/Ui/button_round.png', // Ex: '/assets/ui/btn_circle_base.png' (base redonda of madeira/dourada)
  iconMinus: '/assets/UsedAssets/Ui/icon_minus.png',
  iconPlus: '/assets/UsedAssets/Ui/icon_plus.png',
};

interface OptionsModalProps {
  currentSettings: GameSettings;
  controlMode: ControlMode;
  onControlMode: (mode: ControlMode) => void;
  onClose: () => void;
  onSave: (settings: GameSettings) => void;
}

export const OptionsModal: React.FC<OptionsModalProps> = ({
  currentSettings,
  controlMode,
  onControlMode,
  onClose,
  onSave,
}) => {
  const [settings, setSettings] = useState(currentSettings);
  const [tab, setTab] = useState<'game' | 'audio' | 'controls' | 'network'>('audio');
  const save = (): void => {
    saveSettings(settings);
    onSave(settings);
    audio.playSFX('ui_close');
    onClose();
  };
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="options-title">
      <GamePanel className="options-panel">
        <h2 id="options-title">OPTIONS</h2>
        <div className="modal-tabs" role="tablist" aria-label="Options">
          {(['game', 'audio', 'controls', 'network'] as const).map((id) => (
            <JuicyButton
              key={id}
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls="options-content"
              onClick={() => setTab(id)}
            >
              {id === 'game'
                ? 'Game'
                : id === 'audio'
                  ? 'Audio'
                  : id === 'controls'
                    ? 'Controls'
                    : 'Network'}
            </JuicyButton>
          ))}
        </div>
        <div
          className="panel-scroll"
          id="options-content"
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
        >
          {tab === 'network' ? (
            <NetworkScenarioToolbar />
          ) : tab === 'audio' ? (
            <AudioOptions />
          ) : tab === 'controls' ? (
            <div className="control-options">
              <p>Choose your on-screen navigation controls.</p>
              <fieldset>
                <legend>Navigation controls</legend>
                {(['joystick', 'buttons'] as const).map((mode) => (
                  <label key={mode}>
                    <input
                      type="radio"
                      name="controlMode"
                      value={mode}
                      checked={controlMode === mode}
                      onChange={() => onControlMode(mode)}
                    />
                    {mode === 'joystick' ? 'Joystick' : 'Directional buttons'}
                  </label>
                ))}
              </fieldset>
              <p>
                Joystick: drag toward your destination. Drag farther to accelerate more. Release to
                stop accelerating.
              </p>
              <p>
                Fire with your other finger. Hold a cannon to repeat shots. Your choice is saved
                automatically.
              </p>
              <p>Keyboard: W/S for throttle and reverse, A/D to turn, Space/Q/E for cannons.</p>
            </div>
          ) : (
            <div className="game-options">
              <label>
                Game mode
                <select
                  aria-label="Game mode"
                  value={settings.mode || 'arena'}
                  onChange={(event) =>
                    setSettings((old) => ({
                      ...old,
                      mode: event.target.value as 'arena' | 'open-sea',
                    }))
                  }
                >
                  <option value="arena">Arena — fixed battlefield</option>
                  <option value="open-sea">Open Sea — scrolling world</option>
                </select>
              </label>
              {(['sessionTime', 'enemySpawnInterval'] as const).map((key) => {
                const label = key === 'sessionTime' ? 'Game session time' : 'Enemy spawn time';
                const step = key === 'sessionTime' ? 10 : 0.5;
                const limit = SETTINGS_LIMITS[key];
                const update = (value: number): void =>
                  setSettings((old) => ({
                    ...old,
                    [key]: Math.min(
                      limit.max,
                      Math.max(limit.min, Number.isFinite(value) ? value : limit.default)
                    ),
                  }));
                return (
                  <div className="setting-row" key={key}>
                    <label htmlFor={key}>
                      {label}
                      <small>
                        {limit.min}–{limit.max} seconds
                      </small>
                    </label>
                    <div className="number-stepper">
                      <JuicyButton
                        aria-label={`Decrease ${label}`}
                        disabled={settings[key] <= limit.min}
                        onClick={() => update(settings[key] - step)}
                      >
                        −
                      </JuicyButton>
                      <input
                        id={key}
                        aria-label={label}
                        type="number"
                        min={limit.min}
                        max={limit.max}
                        step={step}
                        value={settings[key]}
                        onChange={(event) => update(event.currentTarget.valueAsNumber)}
                      />
                      <JuicyButton
                        aria-label={`Increase ${label}`}
                        disabled={settings[key] >= limit.max}
                        onClick={() => update(settings[key] + step)}
                      >
                        +
                      </JuicyButton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <JuicyButton className="menu-button panel-footer" onClick={save}>
          SAVE AND BACK
        </JuicyButton>
      </GamePanel>
    </div>
  );
};
