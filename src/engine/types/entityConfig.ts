// src/engine/types/entityConfig.ts
import { Texture } from 'pixi.js';

export type EnemyArchetype = 'chaser' | 'shooter';

export type EnemyVariation =
  'chaser_1' | 'chaser_2' | 'shooter_1' | 'shooter_2' | 'shooter_3' | 'shooter_4' | 'shooter_5';

export type Textures3Hp = readonly [Texture, Texture, Texture];
export type Textures4Hp = readonly [Texture, Texture, Texture, Texture];

export interface EnemyConfigBase {
  readonly archetype: EnemyArchetype;
  readonly speed: number;
  readonly radius: number;
}

export interface EnemyConfigChaser extends EnemyConfigBase {
  readonly archetype: 'chaser';
  readonly maxHealth: 3;
  readonly textures: Textures3Hp;
}

export interface EnemyConfigShooter extends EnemyConfigBase {
  readonly archetype: 'shooter';
  readonly maxHealth: 3; // 3 vidas reais
  readonly textures: Textures4Hp; // [0% (morto), 25%, 50%, 100%]
}

export type EnemyConfig = EnemyConfigChaser | EnemyConfigShooter;
export type EnemyRegistry = Record<EnemyVariation, EnemyConfig>;
