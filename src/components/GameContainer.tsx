import { ControlMode, loadControlMode, saveControlMode } from '../services/controlSettings';
import React, { useEffect, useRef, useState } from 'react';
import { GameBridge } from '../bridge/GameBridge';
import { GameApp } from '../engine/GameApp';
import { useRegisterMatchMutation } from '../hooks/useCaptainsLog';
import { CURRENT_PLAYER_ID, CURRENT_PLAYER_NAME } from '../services/api/matchApi';
import { GameSettings, getSavedSettings } from '../services/gameSettings';
import { CaptainsLogModal } from './ui/CaptainsLogModal';
import { GameOverModal } from './ui/GameOverModal';
import { MainMenu } from './ui/MainMenu';
import { OptionsModal } from './ui/OptionsModal';
import { PauseModal } from './ui/PauseModal';
import { PlayerHUD } from './ui/PlayerHud';
import { WORLD_SANDBOX_MODE } from '../config/debugFlags';
import { audio } from '../engine/services/audioManager';
import { loadLastResult, saveLastResult } from '../services/lastResult';
import { matchSyncQueue } from '../services/matchSyncQueue';
import { MatchRecord } from '../types/LogContracts';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { DAMAGE_RULES } from '../config/gameplay';
import { WaveAnnouncement } from './ui/WaveAnnouncement';
import { GamePanel } from './ui/GamePanel';

export const GameContainer: React.FC = () => {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [engineStatus, setEngineStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [initAttempt, setInitAttempt] = useState(0);
  const appRef = useRef<GameApp | null>(null);
  const bridgeRef = useRef<GameBridge>(new GameBridge());

  // 1. Mutação do TanStack Query e Ref estável para não reiniciar o effect do PixiJS
  const registerMatchMutation = useRegisterMatchMutation();
  const mutationRef = useRef(registerMatchMutation);
  mutationRef.current = registerMatchMutation;

  const currentMatchIdRef = useRef<string>(crypto.randomUUID());
  const activeSettingsRef = useRef(getSavedSettings());
  const [lastResult, setLastResult] = useState<MatchRecord | null>(loadLastResult);

  // Estados of navegação e fluxos of ecrã
  const [gameState, setGameState] = useState<'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'>('MENU');
  const [controlMode, setControlMode] = useState<ControlMode>(loadControlMode);
  const [showOptions, setShowOptions] = useState<boolean>(false);
  const [showLog, setShowLog] = useState<boolean>(false);
  const [logTab, setLogTab] = useState<'RANKING' | 'HISTORY'>('RANKING');

  // Options ativas do jogo
  const [settings, setSettings] = useState<GameSettings>(getSavedSettings);

  // Estados em tempo real da HUD e do motor
  const [lives, setLives] = useState<number>(DAMAGE_RULES.playerHealth);
  const [score, setScore] = useState<number>(0);
  const [wave, setWave] = useState(1);
  const [waveAnnouncement, setWaveAnnouncement] = useState<{ wave: number } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(settings.sessionTime);
  const [gameOverReason, setGameOverReason] = useState<'timeout' | 'dead'>('timeout');
  useDialogFocus(`${engineStatus}-${gameState}-${showOptions}-${showLog}`, () => {
    if (showOptions) setShowOptions(false);
    else if (showLog) setShowLog(false);
  });

  // 2. Referência com sincronização síncrona dos dados da partida (garante precisão no GAME_OVER)
  const stateRef = useRef({ score, timeRemaining, settings });
  stateRef.current = { score, timeRemaining, settings };

  // 3. Inicialização única do motor PixiJS (Array of dependências estritamente VAZIO [])
  useEffect(() => {
    if (!canvasHostRef.current) return;

    const bridge = bridgeRef.current;
    const gameApp = new GameApp(bridge);
    appRef.current = gameApp;

    let disposed = false;
    void gameApp
      .init(canvasHostRef.current)
      .then(() => {
        if (!disposed) setEngineStatus('ready');
      })
      .catch(() => {
        if (!disposed) setEngineStatus('error');
      });

    const unsubLives = bridge.onGameEvent('LIFE_UPDATED', ({ remainingLifePoints }) => {
      setLives(remainingLifePoints);
    });

    const unsubScore = bridge.onGameEvent('SCORE_UPDATED', ({ currentScore }) => {
      stateRef.current.score = currentScore;
      setScore(currentScore);
    });

    const unsubTime = bridge.onGameEvent('TIME_UPDATED', ({ remainingSeconds }) => {
      stateRef.current.timeRemaining = remainingSeconds;
      setTimeRemaining(remainingSeconds);
    });
    const unsubWave = bridge.onGameEvent('WAVE_UPDATED', ({ wave }) => {
      setWave(wave);
      setWaveAnnouncement({ wave });
    });

    const unsubGameOver = bridge.onGameEvent('GAME_OVER', (payload) => {
      const {
        score: currentScore,
        timeRemaining: currentRemaining,
        settings: currentSettings,
      } = stateRef.current;
      const endReason = payload?.reason || 'timeout';
      const effectiveDuration =
        payload.durationSeconds ?? currentSettings.sessionTime - currentRemaining;

      // Executa a mutação através da ref estável sem causar desmontagens
      const record: MatchRecord = {
        matchId: currentMatchIdRef.current,
        playerId: CURRENT_PLAYER_ID,
        playerName: CURRENT_PLAYER_NAME,
        playedAt: new Date().toISOString(),
        score: payload.finalScore ?? currentScore,
        durationSeconds: Math.max(0, Math.round(effectiveDuration)),
        endReason,
        config: { ...activeSettingsRef.current },
      };
      saveLastResult(record);
      setLastResult(record);
      mutationRef.current.mutate(record);

      setGameOverReason(endReason);
      setGameState('GAMEOVER');
    });

    return () => {
      disposed = true;
      unsubLives();
      unsubScore();
      unsubTime();
      unsubWave();
      unsubGameOver();
      gameApp.destroy();
      appRef.current = null;
    };
  }, [initAttempt]);

  // --- CONTROLOS DE FLUXO DE JOGO ---

  const handlePlay = (): void => {
    activeSettingsRef.current = { ...settings };
    currentMatchIdRef.current = crypto.randomUUID();
    setGameState('PLAYING');
    bridgeRef.current.emitToGame('START_GAME', { settings });
  };

  const handleRestart = (): void => {
    activeSettingsRef.current = { ...settings };
    currentMatchIdRef.current = crypto.randomUUID();
    setGameState('PLAYING');
    bridgeRef.current.emitToGame('START_GAME', { settings });
  };

  const handlePause = (): void => {
    audio.playSFX('game_pause');
    setGameState('PAUSED');
    bridgeRef.current.emitToGame('PAUSE_GAME');
  };

  const handleResume = (): void => {
    audio.playSFX('game_resume');
    setGameState('PLAYING');
    bridgeRef.current.emitToGame('RESUME_GAME');
  };

  const handleReturnToMainMenu = (): void => {
    audio.playSFX('ui_back');
    bridgeRef.current.emitToGame('ABANDON_GAME');
    setShowOptions(false);
    setShowLog(false);
    setGameState('MENU');
  };

  const handleSaveSettings = (newSettings: GameSettings): void => {
    setSettings(newSettings);
    if (gameState === 'MENU') setTimeRemaining(newSettings.sessionTime);
  };

  const handleOpenOptions = (): void => {
    audio.playSFX('ui_open');
    setShowOptions(true);
  };

  useEffect(() => {
    const pause = (): void => {
      if (gameState !== 'PLAYING') return;
      bridgeRef.current.emitToGame('PAUSE_GAME');
      setGameState('PAUSED');
    };
    const visibility = (): void => {
      if (document.hidden) pause();
    };
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [gameState]);

  useEffect(() => {
    if (!waveAnnouncement) return;
    const timer = window.setTimeout(() => setWaveAnnouncement(null), 2800);
    return () => window.clearTimeout(timer);
  }, [waveAnnouncement]);

  // --- DISPARO DE EVENTOS VIRTUAIS DE ENTRADA PARA A HUD ---

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100dvh',
        overflow: 'hidden',
        backgroundColor: '#0a0c14',
        userSelect: 'none',
      }}
    >
      {/* CAMADA 1: MOTOR PIXIJS (RENDERIZADOR WEBGL DE FUNDO) */}
      <div
        id="pixi-viewport-container"
        ref={canvasHostRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
        }}
      />

      {/* CAMADA 2: INTERFACE REACT (MODAIS, BOTÕES E MENUS) */}
      <div
        id="react-interface-layer"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 9999,
          pointerEvents: 'none',
          display: WORLD_SANDBOX_MODE ? 'none' : undefined,
        }}
      >
        {/* HUD DE JOGO */}
        {gameState === 'PLAYING' && (
          <PlayerHUD
            currentHp={Math.round((lives / DAMAGE_RULES.playerHealth) * 100)}
            maxHp={100}
            score={score}
            wave={wave}
            timeRemainingSeconds={timeRemaining}
            onPause={handlePause}
            controlMode={controlMode}
            onStick={(position) => bridgeRef.current.emitToGame('TOUCH_STICK', position)}
            onAction={(code, pressed) =>
              bridgeRef.current.emitToGame('TOUCH_KEY', { code, pressed })
            }
          />
        )}

        {gameState === 'PLAYING' && waveAnnouncement && (
          <WaveAnnouncement key={waveAnnouncement.wave} wave={waveAnnouncement.wave} />
        )}

        {/* MENU PRINCIPAL */}
        {engineStatus !== 'ready' && (
          <div className="modal-overlay" role="status">
            <GamePanel>
              <h2>
                {engineStatus === 'loading' ? 'Loading your ship…' : 'The game could not be loaded'}
              </h2>
              {engineStatus === 'error' && (
                <button
                  className="menu-button"
                  onClick={() => {
                    setEngineStatus('loading');
                    setInitAttempt((attempt) => attempt + 1);
                  }}
                >
                  Try again
                </button>
              )}
            </GamePanel>
          </div>
        )}
        {gameState === 'MENU' && engineStatus === 'ready' && (
          <MainMenu
            onLastResult={lastResult ? () => setGameState('GAMEOVER') : undefined}
            onPlay={handlePlay}
            onOptions={handleOpenOptions}
            onRanking={() => {
              audio.playSFX('ui_open');
              setLogTab('RANKING');
              setShowLog(true);
            }}
            onMatchHistory={() => {
              audio.playSFX('ui_open');
              setLogTab('HISTORY');
              setShowLog(true);
            }}
          />
        )}

        {/* MODAL DE PAUSA */}
        {gameState === 'PAUSED' && (
          <PauseModal
            onResume={handleResume}
            onOptions={handleOpenOptions}
            onMainMenu={handleReturnToMainMenu}
          />
        )}

        {/* MODAL DE OPÇÕES DE CONFIGURAÇÃO */}
        {showOptions && (
          <OptionsModal
            currentSettings={settings}
            controlMode={controlMode}
            onControlMode={(mode) => {
              saveControlMode(mode);
              setControlMode(mode);
            }}
            onClose={() => setShowOptions(false)}
            onSave={handleSaveSettings}
          />
        )}

        {/* MODAL CAPTAIN'S LOG: RANKING E HISTÓRICO COM TANSTACK QUERY */}
        {showLog && (
          <CaptainsLogModal
            initialTab={logTab}
            onClose={() => setShowLog(false)}
            sessionTime={settings.sessionTime}
            spawnInterval={settings.enemySpawnInterval}
            mode={settings.mode}
          />
        )}

        {/* ECRÃ DE BATTLE COMPLETE / FIM DE PARTIDA */}
        {gameState === 'GAMEOVER' && (
          <GameOverModal
            score={lastResult?.score ?? score}
            durationSeconds={lastResult?.durationSeconds ?? 0}
            reason={lastResult?.endReason ?? gameOverReason}
            registrationStatus={
              registerMatchMutation.isPending
                ? 'saving'
                : lastResult &&
                    matchSyncQueue
                      .getPending()
                      .some((record) => record.matchId === lastResult.matchId)
                  ? 'pending'
                  : 'saved'
            }
            onRetry={() => {
              if (lastResult) registerMatchMutation.mutate(lastResult);
            }}
            onPlayAgain={handleRestart}
            onMainMenu={handleReturnToMainMenu}
          />
        )}
      </div>
    </div>
  );
};
