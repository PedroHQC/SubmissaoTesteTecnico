// src/engine/loaders/loadGameAssets.ts
import { Assets, Texture } from 'pixi.js';
import { GameAssets } from '../scenes/GameScene';
import { ENEMY_SPEEDS } from '../entities/MovementBalance';
import { DAMAGE_RULES } from '../../config/gameplay';

export async function loadGameAssets(): Promise<GameAssets> {
  // 1. Carregamento no formato oficial do PixiJS v8
  await Assets.load([
    // Cenário e Projétil
    { alias: 'water_tile', src: '/assets/UsedAssets/Tiles/water_tile.png' },
    { alias: 'bullet', src: '/assets/UsedAssets/cannon_ball.png' },
    { alias: 'water_splash', src: '/assets/UsedAssets/Effects/wake_foam.png' },

    // Player: wreck at index 0, followed by three living damage stages.
    { alias: 'playerHp1', src: '/assets/UsedAssets/Ships/PlayerShip/player_ship_4.png' },
    { alias: 'playerHp2', src: '/assets/UsedAssets/Ships/PlayerShip/player_ship_3.png' },
    { alias: 'playerHp3', src: '/assets/UsedAssets/Ships/PlayerShip/player_ship_2.png' },
    { alias: 'playerHp4', src: '/assets/UsedAssets/Ships/PlayerShip/player_ship_1.png' },

    // Inimigos Chaser (3 vidas: 50%, 75%, 100%)
    { alias: 'chaser1_1', src: '/assets/UsedAssets/Ships/EnemyChaserShips/chaser1_50.png' },
    { alias: 'chaser1_2', src: '/assets/UsedAssets/Ships/EnemyChaserShips/chaser1_75.png' },
    { alias: 'chaser1_3', src: '/assets/UsedAssets/Ships/EnemyChaserShips/chaser1_100.png' },

    { alias: 'chaser2_1', src: '/assets/UsedAssets/Ships/EnemyChaserShips/chaser2_50.png' },
    { alias: 'chaser2_2', src: '/assets/UsedAssets/Ships/EnemyChaserShips/chaser2_75.png' },
    { alias: 'chaser2_3', src: '/assets/UsedAssets/Ships/EnemyChaserShips/chaser2_100.png' },

    // Inimigos Shooter (4 vidas: 0%, 25%, 50%, 100%)
    { alias: 'shooter1_1', src: '/assets/UsedAssets/Ships/EnemyShooterShips/shooter_ship_1_0.png' },
    {
      alias: 'shooter1_2',
      src: '/assets/UsedAssets/Ships/EnemyShooterShips/shooter_ship_1_25.png',
    },
    {
      alias: 'shooter1_3',
      src: '/assets/UsedAssets/Ships/EnemyShooterShips/shooter_ship_1_50.png',
    },
    {
      alias: 'shooter1_4',
      src: '/assets/UsedAssets/Ships/EnemyShooterShips/shooter_ship_1_100.png',
    },

    { alias: 'shooter2_1', src: '/assets/UsedAssets/Ships/EnemyShooterShips/shooter_ship_2_0.png' },
    {
      alias: 'shooter2_2',
      src: '/assets/UsedAssets/Ships/EnemyShooterShips/shooter_ship_2_25.png',
    },
    {
      alias: 'shooter2_3',
      src: '/assets/UsedAssets/Ships/EnemyShooterShips/shooter_ship_2_50.png',
    },
    {
      alias: 'shooter2_4',
      src: '/assets/UsedAssets/Ships/EnemyShooterShips/shooter_ship_2_100.png',
    },

    { alias: 'shooter3_1', src: '/assets/UsedAssets/Ships/EnemyShooterShips/shooter_ship_3_0.png' },
    {
      alias: 'shooter3_2',
      src: '/assets/UsedAssets/Ships/EnemyShooterShips/shooter_ship_3_25.png',
    },
    {
      alias: 'shooter3_3',
      src: '/assets/UsedAssets/Ships/EnemyShooterShips/shooter_ship_3_50.png',
    },
    {
      alias: 'shooter3_4',
      src: '/assets/UsedAssets/Ships/EnemyShooterShips/shooter_ship_3_100.png',
    },

    { alias: 'shooter4_1', src: '/assets/UsedAssets/Ships/EnemyShooterShips/shooter_ship_4_0.png' },
    {
      alias: 'shooter4_2',
      src: '/assets/UsedAssets/Ships/EnemyShooterShips/shooter_ship_4_25.png',
    },
    {
      alias: 'shooter4_3',
      src: '/assets/UsedAssets/Ships/EnemyShooterShips/shooter_ship_4_50.png',
    },
    {
      alias: 'shooter4_4',
      src: '/assets/UsedAssets/Ships/EnemyShooterShips/shooter_ship_4_100.png',
    },

    { alias: 'shooter5_1', src: '/assets/UsedAssets/Ships/EnemyShooterShips/shooter_ship_5_0.png' },
    {
      alias: 'shooter5_2',
      src: '/assets/UsedAssets/Ships/EnemyShooterShips/shooter_ship_5_25.png',
    },
    {
      alias: 'shooter5_3',
      src: '/assets/UsedAssets/Ships/EnemyShooterShips/shooter_ship_5_50.png',
    },
    {
      alias: 'shooter5_4',
      src: '/assets/UsedAssets/Ships/EnemyShooterShips/shooter_ship_5_100.png',
    },

    { alias: 'island_tl', src: '/assets/UsedAssets/Tiles/island_tl.png' },
    { alias: 'island_top1', src: '/assets/UsedAssets/Tiles/island_top1.png' },
    { alias: 'island_top2', src: '/assets/UsedAssets/Tiles/island_top2.png' },
    { alias: 'island_tr', src: '/assets/UsedAssets/Tiles/island_tr.png' },

    { alias: 'island_left1', src: '/assets/UsedAssets/Tiles/island_left1.png' },
    { alias: 'island_center_tl', src: '/assets/UsedAssets/Tiles/island_center_tl.png' },
    { alias: 'island_center_tr', src: '/assets/UsedAssets/Tiles/island_center_tr.png' },
    { alias: 'island_right1', src: '/assets/UsedAssets/Tiles/island_right1.png' },

    { alias: 'island_left2', src: '/assets/UsedAssets/Tiles/island_left2.png' },
    { alias: 'island_center_bl', src: '/assets/UsedAssets/Tiles/island_center_bl.png' },
    { alias: 'island_center_br', src: '/assets/UsedAssets/Tiles/island_center_br.png' },
    { alias: 'island_right2', src: '/assets/UsedAssets/Tiles/island_right2.png' },

    { alias: 'island_bl', src: '/assets/UsedAssets/Tiles/island_bl.png' },
    { alias: 'island_bottom1', src: '/assets/UsedAssets/Tiles/island_bottom1.png' },
    { alias: 'island_bottom2', src: '/assets/UsedAssets/Tiles/island_bottom2.png' },
    { alias: 'island_br', src: '/assets/UsedAssets/Tiles/island_br.png' },

    { alias: 'island_outer_tl', src: '/assets/UsedAssets/Tiles/island_outer_tl.png' },
    { alias: 'island_outer_top', src: '/assets/UsedAssets/Tiles/island_outer_top.png' },
    { alias: 'island_outer_tr', src: '/assets/UsedAssets/Tiles/island_outer_tr.png' },
    { alias: 'island_outer_left', src: '/assets/UsedAssets/Tiles/island_outer_left.png' },
    { alias: 'island_outer_center', src: '/assets/UsedAssets/Tiles/island_outer_center.png' },
    { alias: 'island_outer_right', src: '/assets/UsedAssets/Tiles/island_outer_right.png' },
    { alias: 'island_outer_bl', src: '/assets/UsedAssets/Tiles/island_outer_bl.png' },
    { alias: 'island_outer_bottom', src: '/assets/UsedAssets/Tiles/island_outer_bottom.png' },
    { alias: 'island_outer_br', src: '/assets/UsedAssets/Tiles/island_outer_br.png' },
  ]);

  // 2. Mapeamento das texturas em cache para os contratos fortemente tipados
  return {
    waterTileTexture: Assets.get<Texture>('water_tile'),
    projectileTexture: Assets.get<Texture>('bullet'),
    splashTexture: Assets.get<Texture>('water_splash'),

    playerTextures: [
      Assets.get<Texture>('playerHp1'),
      Assets.get<Texture>('playerHp2'),
      Assets.get<Texture>('playerHp3'),
      Assets.get<Texture>('playerHp4'),
    ],
    islandTextures: {
      tl: Assets.get<Texture>('island_tl'),
      top1: Assets.get<Texture>('island_top1'),
      top2: Assets.get<Texture>('island_top2'),
      tr: Assets.get<Texture>('island_tr'),
      left1: Assets.get<Texture>('island_left1'),
      centerTL: Assets.get<Texture>('island_center_tl'),
      centerTR: Assets.get<Texture>('island_center_tr'),
      right1: Assets.get<Texture>('island_right1'),
      left2: Assets.get<Texture>('island_left2'),
      centerBL: Assets.get<Texture>('island_center_bl'),
      centerBR: Assets.get<Texture>('island_center_br'),
      right2: Assets.get<Texture>('island_right2'),
      bl: Assets.get<Texture>('island_bl'),
      bottom1: Assets.get<Texture>('island_bottom1'),
      bottom2: Assets.get<Texture>('island_bottom2'),
      br: Assets.get<Texture>('island_br'),
    },

    islandOuterTextures: {
      tl: Assets.get<Texture>('island_outer_tl'),
      top: Assets.get<Texture>('island_outer_top'),
      tr: Assets.get<Texture>('island_outer_tr'),
      left: Assets.get<Texture>('island_outer_left'),
      center: Assets.get<Texture>('island_outer_center') ?? Assets.get<Texture>('water_tile'),
      right: Assets.get<Texture>('island_outer_right'),
      bl: Assets.get<Texture>('island_outer_bl'),
      bottom: Assets.get<Texture>('island_outer_bottom'),
      br: Assets.get<Texture>('island_outer_br'),
    },
    enemyRegistry: {
      // Chasers (mais rápidos, raio menor, 3 HP)
      chaser_1: {
        maxHealth: DAMAGE_RULES.enemyHealth,
        speed: ENEMY_SPEEDS.chaser_1,
        archetype: 'chaser',
        radius: 16,
        textures: [
          Assets.get<Texture>('chaser1_1'),
          Assets.get<Texture>('chaser1_2'),
          Assets.get<Texture>('chaser1_3'),
        ],
      },
      chaser_2: {
        maxHealth: DAMAGE_RULES.enemyHealth,
        speed: ENEMY_SPEEDS.chaser_2,
        archetype: 'chaser',
        radius: 16,
        textures: [
          Assets.get<Texture>('chaser2_1'),
          Assets.get<Texture>('chaser2_2'),
          Assets.get<Texture>('chaser2_3'),
        ],
      },

      // Shooters (mais pesados, velocidades variadas, 4 HP)
      shooter_1: {
        maxHealth: DAMAGE_RULES.enemyHealth,
        speed: ENEMY_SPEEDS.shooter_1,
        archetype: 'shooter',
        radius: 20,
        textures: [
          Assets.get<Texture>('shooter1_1'),
          Assets.get<Texture>('shooter1_2'),
          Assets.get<Texture>('shooter1_3'),
          Assets.get<Texture>('shooter1_4'),
        ],
      },
      shooter_2: {
        maxHealth: DAMAGE_RULES.enemyHealth,
        speed: ENEMY_SPEEDS.shooter_2,
        archetype: 'shooter',
        radius: 22,
        textures: [
          Assets.get<Texture>('shooter2_1'),
          Assets.get<Texture>('shooter2_2'),
          Assets.get<Texture>('shooter2_3'),
          Assets.get<Texture>('shooter2_4'),
        ],
      },
      shooter_3: {
        maxHealth: DAMAGE_RULES.enemyHealth,
        speed: ENEMY_SPEEDS.shooter_3,
        archetype: 'shooter',
        radius: 22,
        textures: [
          Assets.get<Texture>('shooter3_1'),
          Assets.get<Texture>('shooter3_2'),
          Assets.get<Texture>('shooter3_3'),
          Assets.get<Texture>('shooter3_4'),
        ],
      },
      shooter_4: {
        maxHealth: DAMAGE_RULES.enemyHealth,
        speed: ENEMY_SPEEDS.shooter_4,
        archetype: 'shooter',
        radius: 24,
        textures: [
          Assets.get<Texture>('shooter4_1'),
          Assets.get<Texture>('shooter4_2'),
          Assets.get<Texture>('shooter4_3'),
          Assets.get<Texture>('shooter4_4'),
        ],
      },
      shooter_5: {
        maxHealth: DAMAGE_RULES.enemyHealth,
        speed: ENEMY_SPEEDS.shooter_5,
        archetype: 'shooter',
        radius: 26,
        textures: [
          Assets.get<Texture>('shooter5_1'),
          Assets.get<Texture>('shooter5_2'),
          Assets.get<Texture>('shooter5_3'),
          Assets.get<Texture>('shooter5_4'),
        ],
      },
    },
  };
}
