// src/services/AudioManager.ts
import {
  AudioSettings,
  AudioVolumeKey,
  loadAudioSettings,
  normalizeAudioSettings,
  saveAudioSettings,
} from '../../services/audioSettings';
export type { AudioSettings } from '../../services/audioSettings';

export type SoundEffect =
  | 'cannon_broadside'
  | 'cannon_fire_1'
  | 'cannon_fire_2'
  | 'cannon_fire_3'
  | 'cannonball_water_hit_1'
  | 'cannonball_water_hit_2'
  | 'game_complete'
  | 'game_over'
  | 'game_pause'
  | 'game_resume'
  | 'game_start'
  | 'health_low'
  | 'score_point'
  | 'ship_collision'
  | 'ship_explosion_1'
  | 'ship_explosion_2'
  | 'ship_sinking'
  | 'ship_wood_hit_1'
  | 'ship_wood_hit_2'
  | 'time_warning'
  | 'ui_back'
  | 'ui_click'
  | 'ui_close'
  | 'ui_hover'
  | 'ui_open';

export type LoopTrack = 'ocean_ambience_loop' | 'ship_sailing_loop';

type AudioChannel = Exclude<AudioVolumeKey, 'masterVolume' | 'sfxVolume'>;
const SOUND_CHANNELS: Record<SoundEffect, AudioChannel> = {
  cannon_broadside: 'cannonsVolume',
  cannon_fire_1: 'cannonsVolume',
  cannon_fire_2: 'cannonsVolume',
  cannon_fire_3: 'cannonsVolume',
  cannonball_water_hit_1: 'impactsVolume',
  cannonball_water_hit_2: 'impactsVolume',
  ship_collision: 'impactsVolume',
  ship_wood_hit_1: 'impactsVolume',
  ship_wood_hit_2: 'impactsVolume',
  ship_explosion_1: 'explosionsVolume',
  ship_explosion_2: 'explosionsVolume',
  ship_sinking: 'explosionsVolume',
  game_complete: 'alertsVolume',
  game_over: 'alertsVolume',
  game_pause: 'alertsVolume',
  game_resume: 'alertsVolume',
  game_start: 'alertsVolume',
  health_low: 'alertsVolume',
  score_point: 'alertsVolume',
  time_warning: 'alertsVolume',
  ui_back: 'uiVolume',
  ui_click: 'uiVolume',
  ui_close: 'uiVolume',
  ui_hover: 'uiVolume',
  ui_open: 'uiVolume',
};
const CHANNELS: AudioChannel[] = [
  'cannonsVolume',
  'impactsVolume',
  'explosionsVolume',
  'uiVolume',
  'alertsVolume',
  'ambienceVolume',
  'sailingVolume',
];
const COMBAT_CHANNELS: AudioChannel[] = ['cannonsVolume', 'impactsVolume', 'explosionsVolume'];

export class AudioManager {
  private static instance: AudioManager | null = null;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private readonly channelGains: Partial<Record<AudioChannel, GainNode>> = {};

  private readonly buffers = new Map<SoundEffect | LoopTrack, AudioBuffer>();
  private readonly activeLoops = new Map<LoopTrack, AudioBufferSourceNode>();
  private readonly pendingLoops = new Set<LoopTrack>();

  private settings: AudioSettings = loadAudioSettings();

  private isUnlocked = false;

  private constructor() {}

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /**
   * Inicializa o barramento de áudio sem forçar a ativação imediata.
   */
  public init(): void {
    if (this.ctx) return;

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    this.ctx = new AudioContextClass();

    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);
    for (const channel of CHANNELS) {
      const gain = this.ctx.createGain();
      gain.connect(COMBAT_CHANNELS.includes(channel) ? this.sfxGain : this.masterGain);
      this.channelGains[channel] = gain;
    }
    this.masterGain.connect(this.ctx.destination);

    this.applyVolumes();
    this.bindUnlockEvents();
  }

  /**
   * Escuta a primeira interação do utilizador para reativar o contexto e tocar sons pendentes.
   */
  private bindUnlockEvents(): void {
    const unlock = async (): Promise<void> => {
      if (this.ctx && this.ctx.state === 'suspended') {
        try {
          await this.ctx.resume();
        } catch {
          // Ignora falhas momentâneas de reativação
        }
      }

      if (!this.ctx || this.ctx.state !== 'running') return;
      this.isUnlocked = true;

      // Inicia quaisquer loops que tenham sido solicitados antes do primeiro clique
      this.pendingLoops.forEach((track) => {
        this.playLoopSource(track);
      });

      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };

    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
  }

  public async preloadAll(basePath = '/assets/audio', ext = 'mp3'): Promise<void> {
    if (!this.ctx) this.init();

    const allKeys: (SoundEffect | LoopTrack)[] = [
      'cannon_broadside',
      'cannon_fire_1',
      'cannon_fire_2',
      'cannon_fire_3',
      'cannonball_water_hit_1',
      'cannonball_water_hit_2',
      'game_complete',
      'game_over',
      'game_pause',
      'game_resume',
      'game_start',
      'health_low',
      'ocean_ambience_loop',
      'score_point',
      'ship_collision',
      'ship_explosion_1',
      'ship_explosion_2',
      'ship_sailing_loop',
      'ship_sinking',
      'ship_wood_hit_1',
      'ship_wood_hit_2',
      'time_warning',
      'ui_back',
      'ui_click',
      'ui_close',
      'ui_hover',
      'ui_open',
    ];

    const loadPromises = allKeys.map(async (key) => {
      try {
        const res = await fetch(`${basePath}/${key}.${ext}`);
        if (!res.ok) return;
        const arrayBuffer = await res.arrayBuffer();
        const decoded = await this.ctx!.decodeAudioData(arrayBuffer);
        this.buffers.set(key, decoded);
        if (
          (key === 'ocean_ambience_loop' || key === 'ship_sailing_loop') &&
          this.pendingLoops.has(key)
        ) {
          this.playLoopSource(key);
        }
      } catch (err) {
        console.warn(`[AudioManager] Áudio ausente ou formato incorreto: ${key}.${ext}`, err);
      }
    });

    await Promise.all(loadPromises);
  }

  public playSFX(name: SoundEffect, pitchSpread = 0.04): void {
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    if (this.ctx.state === 'suspended') return;

    const buffer = this.buffers.get(name);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    if (pitchSpread > 0) {
      source.playbackRate.value = 1 + (Math.random() * 2 - 1) * pitchSpread;
    }

    const gain = this.channelGains[SOUND_CHANNELS[name]];
    if (!gain) return;
    source.connect(gain);
    source.onended = () => source.disconnect();
    source.start(0);
  }

  // --- MÉTODOS VARIÁVEIS ---

  public playCannonFire(): void {
    const variations: SoundEffect[] = ['cannon_fire_1', 'cannon_fire_2', 'cannon_fire_3'];
    const pick = variations[Math.floor(Math.random() * variations.length)];
    this.playSFX(pick);
  }

  public playWaterHit(): void {
    const pick: SoundEffect =
      Math.random() < 0.5 ? 'cannonball_water_hit_1' : 'cannonball_water_hit_2';
    this.playSFX(pick);
  }

  public playWoodHit(): void {
    const pick: SoundEffect = Math.random() < 0.5 ? 'ship_wood_hit_1' : 'ship_wood_hit_2';
    this.playSFX(pick);
  }

  public playExplosion(): void {
    const pick: SoundEffect = Math.random() < 0.5 ? 'ship_explosion_1' : 'ship_explosion_2';
    this.playSFX(pick);
  }

  // --- CONTROLOS DE LOOP (OCEANO E NAVEGAÇÃO) ---

  public startLoop(track: LoopTrack): void {
    if (this.activeLoops.has(track)) return;

    // Se o utilizador ainda não interagiu, coloca na fila pendente sem disparar erro
    if (!this.isUnlocked || this.ctx?.state !== 'running' || !this.buffers.has(track)) {
      this.pendingLoops.add(track);
      return;
    }

    this.playLoopSource(track);
  }

  private playLoopSource(track: LoopTrack): void {
    const gain =
      this.channelGains[track === 'ocean_ambience_loop' ? 'ambienceVolume' : 'sailingVolume'];
    if (
      !this.ctx ||
      !gain ||
      !this.isUnlocked ||
      this.ctx.state !== 'running' ||
      this.activeLoops.has(track)
    )
      return;

    const buffer = this.buffers.get(track);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start(0);

    this.activeLoops.set(track, source);
    this.pendingLoops.delete(track);
  }

  public stopLoop(track: LoopTrack): void {
    this.pendingLoops.delete(track);

    const source = this.activeLoops.get(track);
    if (!source) return;

    try {
      source.stop();
      source.disconnect();
    } catch {
      // Ignora caso já esteja parado
    }

    this.activeLoops.delete(track);
  }

  public setSailing(isMoving: boolean): void {
    if (isMoving) {
      this.startLoop('ship_sailing_loop');
    } else {
      this.stopLoop('ship_sailing_loop');
    }
  }

  // --- CONTROLO DE VOLUMES ---

  public updateVolumes(newSettings: Partial<AudioSettings>): void {
    this.settings = normalizeAudioSettings({ ...this.settings, ...newSettings });
    saveAudioSettings(this.settings);
    this.applyVolumes();
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  /** Short sample on the actual channel, without starting or stopping gameplay loops. */
  public async preview(channel: AudioVolumeKey): Promise<void> {
    if (!this.ctx || this.settings.muted) return;
    try {
      await this.ctx.resume();
    } catch {
      return;
    }
    const samples: Record<AudioVolumeKey, SoundEffect | LoopTrack> = {
      masterVolume: 'ui_click',
      sfxVolume: 'cannon_fire_1',
      cannonsVolume: 'cannon_fire_1',
      impactsVolume: 'ship_wood_hit_1',
      explosionsVolume: 'ship_explosion_1',
      uiVolume: 'ui_click',
      alertsVolume: 'game_start',
      ambienceVolume: 'ocean_ambience_loop',
      sailingVolume: 'ship_sailing_loop',
    };
    const name = samples[channel];
    const buffer = this.buffers.get(name);
    const route =
      name === 'ocean_ambience_loop'
        ? 'ambienceVolume'
        : name === 'ship_sailing_loop'
          ? 'sailingVolume'
          : SOUND_CHANNELS[name];
    const gain = this.channelGains[route];
    if (!buffer || !gain) return;
    const source = this.ctx.createBufferSource();
    const fade = this.ctx.createGain();
    const duration = Math.min(1.2, buffer.duration);
    fade.gain.setValueAtTime(0, this.ctx.currentTime);
    fade.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 0.02);
    fade.gain.setValueAtTime(1, this.ctx.currentTime + Math.max(0.02, duration - 0.1));
    fade.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
    source.buffer = buffer;
    source.connect(fade);
    fade.connect(gain);
    source.onended = () => {
      source.disconnect();
      fade.disconnect();
    };
    source.start(0, 0, duration);
  }

  private applyVolumes(): void {
    if (!this.masterGain || !this.sfxGain || !this.ctx) return;

    const master = this.settings.muted ? 0 : this.settings.masterVolume;
    this.masterGain.gain.setTargetAtTime(master, this.ctx.currentTime, 0.02);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfxVolume, this.ctx.currentTime, 0.02);
    for (const channel of CHANNELS) {
      this.channelGains[channel]?.gain.setTargetAtTime(
        this.settings[channel],
        this.ctx.currentTime,
        0.02
      );
    }
  }
}

export const audio = AudioManager.getInstance();
