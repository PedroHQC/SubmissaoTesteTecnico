// src/engine/GameApp.ts
import { Application } from 'pixi.js';
import { GameBridge } from '../bridge/GameBridge';
import { SceneManager } from './core/SceneManager';
import { loadGameAssets } from './loaders/loadGameAssets';
import { audio } from './services/audioManager';
import { WorldSandboxScene } from './scenes/WorldSandboxScene';
import { WORLD_SANDBOX_MODE } from '../config/debugFlags';

export class GameApp {
  private app: Application | null = null;
  private sceneManager: SceneManager | null = null;
  private unsubscribers: Array<() => void> = [];
  private isDestroyed = false;

  constructor(private readonly bridge: GameBridge) {}

  public async init(containerElement: HTMLElement): Promise<void> {
    this.isDestroyed = false;

    try {
      const app = new Application();
      this.app = app;

      // 1. Inicialização assíncrona do motor
      await app.init({
        resizeTo: containerElement,
        backgroundColor: 0x0a0c14,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      });

      // Se o React desmontou o componente enquanto app.init() resolvia
      if (this.isDestroyed) {
        this.cleanupPixi();
        return;
      }

      // 2. Configurações de estilo no canvas
      const canvas = app.canvas;
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';

      // Remove canvas órfãos anteriores antes de anexar o novo
      while (containerElement.firstChild) {
        containerElement.removeChild(containerElement.firstChild);
      }
      containerElement.appendChild(canvas);

      this.sceneManager = new SceneManager(app);

      // 3. Carregamento assíncrono de assets
      const [assets] = await Promise.all([
        loadGameAssets(),
        audio.preloadAll('/assets/audio', 'wav').catch((err) => {
          console.warn('[GameApp] Aviso no pré-carregamento de áudio (continuando jogo):', err);
        }),
      ]);

      // Se desmontou durante o carregamento de texturas
      if (this.isDestroyed) {
        this.cleanupPixi();
        return;
      }

      audio.startLoop('ocean_ambience_loop');
      await this.sceneManager.changeScene(
        new WorldSandboxScene(assets, WORLD_SANDBOX_MODE ? undefined : this.bridge)
      );
      const onResize = (width: number, height: number) => this.sceneManager?.resize(width, height);
      app.renderer.on('resize', onResize);
      this.unsubscribers.push(() => app.renderer?.off('resize', onResize));
    } catch (err) {
      // Se a destruição já foi solicitada, erros de abortamento são esperados e descartados
      if (this.isDestroyed) return;
      console.error('Falha ao inicializar GameApp:', err);
      this.destroy();
      throw err;
    }
  }

  private cleanupPixi(): void {
    if (!this.app) return;

    const appToDestroy = this.app;
    this.app = null;

    try {
      // Interrompe o loop do Ticker primeiro para não disparar updateLocalTransform
      appToDestroy.ticker?.stop();

      // Só executa destroy() se o PixiJS tiver concluído a inicialização do renderer
      if (appToDestroy.renderer) {
        appToDestroy.destroy(
          { removeView: true },
          { children: true, texture: false, textureSource: false }
        );
      } else if (appToDestroy.canvas?.parentNode) {
        // Se o renderer não foi criado, remove apenas o elemento HTML do DOM
        appToDestroy.canvas.parentNode.removeChild(appToDestroy.canvas);
      }
    } catch (e) {
      console.warn('Erro contido ao destruir Pixi App:', e);
    }
  }

  public destroy(): void {
    audio.setSailing(false);
    audio.stopLoop('ocean_ambience_loop');
    this.isDestroyed = true;

    // Cancela subscrições da bridge
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];

    // Desmonta cena ativa
    this.sceneManager?.destroy();
    this.sceneManager = null;

    // Apenas destrói síncronamente se o renderer já existir.
    // Caso esteja no meio do "await app.init()", o próprio método init cuidará da limpeza ao resolver.
    if (this.app?.renderer) {
      this.cleanupPixi();
    }
  }
}
