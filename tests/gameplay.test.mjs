import assert from 'node:assert/strict';
import test from 'node:test';
import { Texture } from 'pixi.js';
import { Enemy } from '../src/engine/entities/Enemy.ts';
import { ShipController } from '../src/engine/entities/ShipController.ts';
import { FlowField } from '../src/engine/navigation/FlowField.ts';
import { WorldFlowField } from '../src/engine/world/WorldFlowField.ts';
import { CameraShake } from '../src/engine/rendering/CameraShake.ts';
import { findChaserLaunch } from '../src/engine/combat/ChaserLaunch.ts';
import { CombatSystem } from '../src/engine/combat/CombatSystem.ts';
import { Player } from '../src/engine/entities/Player.ts';
import { ENEMY_SPEEDS, MOVEMENT_SPEEDS } from '../src/engine/entities/MovementBalance.ts';
import { chaserHandling, shooterHandling } from '../src/engine/entities/EnemyAI.ts';
import {
  isCircleCollidingTiles,
  isCirclePathClear,
  resolveCircleVsTiles,
} from '../src/engine/tiles/TileCollision.ts';

function terrain(solid) {
  const grid = { cols: 40, rows: 40, tileSize: 32, isSolid: solid };
  grid.hasLineOfSight = (x, y, tx, ty) => isCirclePathClear(grid, x, y, tx, ty, 1);
  return grid;
}

function combatFixture(solid = () => false, maxChasers = 5) {
  const grid = terrain(solid);
  grid.chunkRevision = 0;
  grid.resolveCircleCollision = (body) => resolveCircleVsTiles(grid, body);
  const registry = Object.fromEntries(
    Object.entries(ENEMY_SPEEDS).map(([key, speed]) => [
      key,
      {
        archetype: key.startsWith('chaser') ? 'chaser' : 'shooter',
        maxHealth: 3,
        speed,
        radius: key.startsWith('chaser') ? 16 : 26,
        textures: [Texture.EMPTY, Texture.EMPTY, Texture.EMPTY, Texture.EMPTY],
      },
    ])
  );
  const player = new Player([Texture.EMPTY, Texture.EMPTY, Texture.EMPTY, Texture.EMPTY]);
  player.reset(1000, 500);
  const combat = new CombatSystem(
    { enemyRegistry: registry, projectileTexture: Texture.EMPTY, splashTexture: Texture.WHITE },
    grid,
    player,
    { maxChasers, initialChasers: maxChasers }
  );
  const carrier = combat.enemies.get();
  carrier.spawn(500, 500, 'shooter_5', -Math.PI / 2);
  return { combat, carrier, player };
}

test('launch clears the visible hull, checks the exit corridor and refuses a surrounded carrier', () => {
  const source = { x: 320, y: 320, radius: 26, hullRadius: 56, rotation: 0 };
  const player = { x: 1000, y: 1000, radius: 20 };
  const water = terrain(() => false);
  const launch = findChaserLaunch(source, 24, water, [source], player);
  assert.ok(launch);
  assert.ok(Math.hypot(launch.x - source.x, launch.y - source.y) >= 56 + 24 + 16);
  const shore = terrain((c, r) => r >= 12);
  const alternative = findChaserLaunch(source, 24, shore, [source], player);
  assert.ok(alternative, 'can use another side when the bow is blocked');
  assert.ok(isCirclePathClear(shore, source.x, source.y, alternative.x, alternative.y, 30));
  const ring = terrain((c, r) => c < 8 || c > 11 || r < 8 || r > 11);
  assert.equal(findChaserLaunch(source, 24, ring, [source], player), null);
});

test('launching a small boat no longer pushes the carrier, overlaps neighbors or exceeds the cap', () => {
  const { combat, carrier, player } = combatFixture(() => false, 3);
  const start = { x: carrier.x, y: carrier.y };
  for (let i = 0; i < 3; i++) assert.equal(combat.spawnChaserFrom(carrier), true);
  assert.equal(combat.spawnChaserFrom(carrier), false);
  combat.separateEnemies();
  assert.equal(carrier.x, start.x);
  assert.equal(carrier.y, start.y);
  const boats = combat.enemies.rawPool.filter((enemy) => enemy.isActive);
  for (const boat of boats) {
    for (const other of boats) {
      if (boat === other) continue;
      assert.ok(Math.hypot(boat.x - other.x, boat.y - other.y) >= boat.radius + other.radius + 4);
    }
    if (boat === carrier) continue;
    const speed = Math.hypot(boat.ship.vx, boat.ship.vy);
    assert.ok(speed > 0 && speed < boat.ship.handling.maxForwardSpeed);
  }
  combat.destroy();
  player.destroy();
  player.view.destroy({ children: true });
});

test('a failed launch allocates no boat and does not move the carrier', () => {
  const { combat, carrier, player } = combatFixture(() => true);
  const poolSize = combat.enemies.rawPool.length;
  assert.equal(combat.spawnChaserFrom(carrier), false);
  assert.equal(combat.enemies.rawPool.length, poolSize);
  assert.equal(combat.enemies.rawPool.filter((enemy) => enemy.isActive).length, 1);
  assert.equal(carrier.x, 500);
  assert.equal(carrier.y, 500);
  combat.destroy();
  player.destroy();
  player.view.destroy({ children: true });
});

test('the actual launch frame does not teleport the carrier or simulate the newborn twice', () => {
  const { combat, carrier, player } = combatFixture();
  carrier.spawnChaserTimer = 0;
  carrier.shootTimer = Infinity;
  combat.flow.update(player.x, player.y);
  combat.updateEnemies({ deltaTime: 1 });
  const small = combat.enemies.rawPool.find((enemy) => enemy.isActive && enemy !== carrier);
  assert.ok(small);
  assert.ok(Math.hypot(carrier.x - 500, carrier.y - 500) < 1, 'no separation jump');
  const gap = Math.hypot(small.x - carrier.x, small.y - carrier.y);
  assert.ok(Math.abs(gap - (carrier.hullRadius + small.hullRadius + 16)) < 1e-6);
  combat.destroy();
  player.destroy();
  player.view.destroy({ children: true });
});

test('small ships accelerate faster than carriers while the player can escape at cruise speed', () => {
  for (const dt of [0.5, 1, 2]) {
    const player = new ShipController();
    const chaser = new ShipController(chaserHandling(ENEMY_SPEEDS.chaser_1));
    const carrier = new ShipController(shooterHandling(ENEMY_SPEEDS.shooter_5));
    const bodies = [player, chaser, carrier].map(() => ({ x: 0, y: 0, rotation: 0 }));
    const ships = [player, chaser, carrier];
    for (let t = 0; t < 300; t += dt) {
      ships.forEach((ship, i) => ship.step(bodies[i], { throttle: 1, steer: 0 }, dt));
    }
    assert.ok(bodies[0].y > bodies[1].y && bodies[1].y > bodies[2].y);
    assert.ok(chaser.handling.thrust > carrier.handling.thrust);
    assert.ok(chaser.handling.maxTurnRate > carrier.handling.maxTurnRate);
    assert.ok(Math.abs(player.vy - MOVEMENT_SPEEDS.player) < 1e-6);
    assert.ok(MOVEMENT_SPEEDS.enemyProjectile > player.vy);
    assert.ok(MOVEMENT_SPEEDS.playerProjectile > MOVEMENT_SPEEDS.enemyProjectile);
  }
});

test('impact rebounds and separates even while the player keeps accelerating into land', () => {
  const grid = terrain((c) => c >= 10);
  for (const dt of [0.5, 1, 2]) {
    const ship = new ShipController();
    const body = { x: 302, y: 200, radius: 20, rotation: -Math.PI / 2 };
    ship.vx = 3.4;
    const x = body.x;
    assert.ok(resolveCircleVsTiles(grid, body));
    assert.ok(ship.applyCollision(body.x - x, 0) > 3);
    assert.ok(ship.vx < -2);
    for (let t = 0; t < 16; t += dt) ship.step(body, { throttle: 1, steer: 0 }, dt);
    assert.ok(body.x < 280, `must leave a visible gap at dt=${dt}`);
    assert.equal(isCircleCollidingTiles(grid, body.x, body.y, body.radius), false);
    ship.reset();
    ship.step(body, { throttle: 1, steer: 0 }, 1);
    assert.ok(ship.vx > 0, 'reset clears impact recovery');
  }
});

test('hull sweep catches a thin island between the feeler endpoints', () => {
  const grid = terrain((c, r) => c === 10 && r === 10);
  assert.equal(isCirclePathClear(grid, 200, 330, 450, 330, 20), false);
  assert.equal(isCirclePathClear(grid, 200, 290, 450, 290, 20), true);
  assert.equal(isCirclePathClear(grid, 200, 305, 450, 305, 20), false);
});

test('shared route navigates around a wide island without cutting the hull through corners', () => {
  const grid = terrain((c, r) => c >= 15 && c <= 20 && r >= 10 && r <= 24);
  const flow = new FlowField(grid);
  const target = { x: 900, y: 560 };
  flow.update(target.x, target.y);
  const direction = { dirX: 0, dirY: 0 };
  let x = 250;
  let y = 560;
  for (let i = 0; i < 1400 && Math.hypot(x - target.x, y - target.y) > 32; i++) {
    flow.getDirection(x, y, direction);
    assert.ok(Math.hypot(direction.dirX, direction.dirY) > 0);
    x += direction.dirX * 2;
    y += direction.dirY * 2;
    assert.equal(isCircleCollidingTiles(grid, x, y, 26), false);
  }
  assert.ok(Math.hypot(x - target.x, y - target.y) < 32, 'reaches the far side');
});

test('streamed terrain invalidates navigation even when the target stays still', () => {
  let island = false;
  const world = {
    tileSize: 32,
    chunkRevision: 0,
    isSolid: (c, r) => island && c >= 3 && c <= 6 && r >= -4 && r <= 4,
  };
  const flow = new WorldFlowField(world);
  const out = { dirX: 0, dirY: 0 };
  flow.update(320, 16);
  flow.getDirection(48, 16, out);
  assert.ok(out.dirX > 0.9);
  island = true;
  world.chunkRevision++;
  flow.update(320, 16);
  flow.getDirection(48, 16, out);
  assert.ok(Math.abs(out.dirY) > 0.5, 'routes around newly loaded land');
});

test('actual enemy steering gets around an island with the full ship physics', () => {
  const grid = terrain((c, r) => c >= 15 && c <= 20 && r >= 10 && r <= 24);
  const flow = new FlowField(grid);
  const target = { x: 900, y: 560 };
  flow.update(target.x, target.y);
  for (const radius of [16, 26]) {
    const enemy = new Enemy(
      {
        test: { archetype: 'chaser', maxHealth: 1, speed: 3, radius, textures: [Texture.EMPTY] },
      },
      Texture.EMPTY
    );
    enemy.spawn(250, 560, 'test', -Math.PI / 2);
    let contacts = 0;
    for (let frame = 0; frame < 4000; frame++) {
      enemy.updateEnemy({ deltaTime: 1 }, target.x, target.y, grid, flow);
      const x = enemy.x;
      const y = enemy.y;
      if (resolveCircleVsTiles(grid, enemy)) {
        contacts++;
        enemy.applyCollisionPush(enemy.x - x, enemy.y - y);
      }
      if (Math.hypot(enemy.x - target.x, enemy.y - target.y) < 45) break;
    }
    assert.ok(
      Math.hypot(enemy.x - target.x, enemy.y - target.y) < 45,
      `radius ${radius}: enemy stuck at ${enemy.x}, ${enemy.y}; contacts ${contacts}`
    );
    assert.ok(
      contacts < 5,
      `radius ${radius}: should avoid repeated shore contact, got ${contacts}`
    );
    enemy.view.destroy({ children: true });
  }
});

test('camera shake stays bounded, decays to zero and resets cleanly', () => {
  const shake = new CameraShake();
  shake.impact(100);
  let moved = false;
  for (let frame = 0; frame < 60; frame++) {
    shake.update(1 / 60);
    moved ||= Math.abs(shake.x) > 0;
    assert.ok(Math.abs(shake.x) <= 12 && Math.abs(shake.y) <= 12);
  }
  assert.ok(moved);
  assert.equal(Math.abs(shake.x) + Math.abs(shake.y), 0);
  shake.impact(7);
  shake.reset();
  shake.update(1 / 60);
  assert.equal(Math.abs(shake.x) + Math.abs(shake.y), 0);
});

test('chasers and shooters escape a concave island and regain a clear route to the player', () => {
  // U-shaped land, open to the left: enemies must initially sail away from the player.
  const grid = terrain(
    (c, r) =>
      (((r >= 10 && r <= 12) || (r >= 24 && r <= 26)) && c >= 10 && c <= 22) ||
      (c >= 20 && c <= 22 && r >= 10 && r <= 26)
  );
  const target = { x: 980, y: 590 };
  const flow = new FlowField(grid);
  flow.update(target.x, target.y);
  for (const archetype of ['chaser', 'shooter']) {
    for (const dt of [0.5, 2]) {
      const enemy = new Enemy(
        {
          test: {
            archetype,
            maxHealth: 3,
            speed: 2.5,
            radius: 26,
            textures: [Texture.EMPTY, Texture.EMPTY, Texture.EMPTY, Texture.EMPTY],
          },
        },
        Texture.EMPTY
      );
      enemy.spawn(500, 590, 'test', -Math.PI / 2);
      let escaped = false;
      let contacts = 0;
      for (let time = 0; time < 6500; time += dt) {
        enemy.updateEnemy({ deltaTime: dt }, target.x, target.y, grid, flow);
        const x = enemy.x;
        const y = enemy.y;
        if (resolveCircleVsTiles(grid, enemy)) {
          contacts++;
          enemy.applyCollisionPush(enemy.x - x, enemy.y - y);
        }
        if (
          Math.hypot(enemy.x - target.x, enemy.y - target.y) < 350 &&
          isCirclePathClear(grid, enemy.x, enemy.y, target.x, target.y, 26)
        ) {
          escaped = true;
          break;
        }
      }
      assert.ok(escaped, `${archetype} dt=${dt} stuck at ${enemy.x}, ${enemy.y}`);
      assert.ok(contacts < 5, `${archetype} dt=${dt} has ${contacts} coast collisions`);
      enemy.view.destroy({ children: true });
    }
  }
});


test('analog joystick has a dead zone, proportional throttle and correct turn direction', async () => {
 const { joystickShipInput } = await import('../src/engine/entities/JoystickInput.ts');
 assert.deepEqual(joystickShipInput({x:.05,y:.05},0),{throttle:0,steer:0});
 assert.equal(joystickShipInput({x:0,y:1},0).throttle,1);
 assert.ok(joystickShipInput({x:0,y:.5},0).throttle < 1);
 assert.ok(joystickShipInput({x:1,y:0},0).steer < 0);
 assert.ok(joystickShipInput({x:-1,y:0},0).steer > 0);
 assert.equal(joystickShipInput({x:0,y:-1},0).throttle,0);
});

test('dead shooters never separate, ram or launch and a projectile cannot score twice', () => {
 const { combat, carrier, player } = combatFixture();
 carrier.takeDamage(3);
 const before={x:carrier.x,y:carrier.y};
 const neighbor=combat.enemies.get(); neighbor.spawn(carrier.x+10,carrier.y,'shooter_1',0);
 combat.separateEnemies(); assert.deepEqual({x:carrier.x,y:carrier.y},before);
 let points=0;combat.onEnemyDefeated=()=>points++;
 neighbor.currentHealth=1;
 const shot=combat.playerShots.get();shot.spawn(neighbor.x,neighbor.y,1,0);
 combat.resolveHits();combat.resolveHits();assert.equal(points,1);assert.equal(shot.isActive,false);
 combat.destroy();player.destroy();player.view.destroy({children:true});
});

test('player wreck texture is reserved for death and restart restores the intact hull', () => {
  const textures = Array.from({ length: 4 }, () => new Texture({ source: Texture.EMPTY.source }));
  const player = new Player(textures);
  assert.equal(player.sprite.texture, textures[3]);
  for (let hit = 0; hit < player.maxHp - 1; hit++) {
    player.takeDamage();
    assert.notEqual(player.sprite.texture, textures[0]);
  }
  player.takeDamage();
  assert.equal(player.sprite.texture, textures[0]);
  player.reset(100, 100);
  assert.equal(player.sprite.texture, textures[3]);
  player.destroy();
  player.view.destroy({ children: true });
  textures.forEach((texture) => texture.destroy());
});

test('shooter turns its real hull before firing and never shoots sideways or backwards', () => {
  const { combat, carrier, player } = combatFixture();
  const grid = terrain(() => false);
  const target = { x: 500, y: 750 };
  const flow = new FlowField(grid);
  flow.update(target.x, target.y);
  carrier.rotation = Math.PI;
  carrier.shootTimer = 0;
  carrier.onSpawnChaser = null;
  let shots = 0;
  carrier.onShoot = (x, y, dx, dy) => {
    shots++;
    const bowX = -Math.sin(carrier.rotation);
    const bowY = Math.cos(carrier.rotation);
    const distance = Math.hypot(target.x - carrier.x, target.y - carrier.y);
    assert.ok((bowX * (target.x - carrier.x) + bowY * (target.y - carrier.y)) / distance >= Math.cos(Math.PI / 22.5));
    assert.ok(dx * bowX + dy * bowY >= Math.cos(0.061));
    assert.ok((x - carrier.x) * bowX + (y - carrier.y) * bowY > 0);
  };
  carrier.updateEnemy({ deltaTime: 1 }, target.x, target.y, grid, flow);
  assert.equal(shots, 0);
  for (let frame = 0; frame < 480; frame++) {
    carrier.updateEnemy({ deltaTime: 1 }, target.x, target.y, grid, flow);
  }
  assert.ok(shots > 0, 'a turned and aligned carrier can still attack');
  combat.destroy(); player.destroy(); player.view.destroy({ children: true });
});

test('waves cap launched chasers at one, two and three and the director spawns only carriers', () => {
  const { combat, carrier, player } = combatFixture(() => false, 3);
  combat.config.initialChasers = 1;
  for (let index = 0; index < 3; index++) {
    combat.waveElapsed = index * combat.config.waveDuration;
    assert.equal(combat.wave.chasers, index + 1);
    assert.equal(combat.spawnChaserFrom(carrier), true);
    assert.equal(combat.spawnChaserFrom(carrier), false);
  }
  combat.waveElapsed = 20 * combat.config.waveDuration;
  assert.equal(combat.wave.chasers, 3);
  assert.equal(combat.spawnChaserFrom(carrier), false);
  carrier.takeDamage(3);
  assert.equal(combat.spawnChaserFrom(carrier), false);
  combat.reset();
  assert.equal(combat.wave.number, 1);
  for (let frame = 0; frame < 3600; frame += 30) {
    combat.updateDirector(30, { x: 0, y: 0, width: 1280, height: 768 });
  }
  const active = combat.enemies.rawPool.filter((enemy) => enemy.isActive);
  assert.ok(active.length > 0 && active.length <= 3);
  assert.ok(active.every((enemy) => enemy.archetype === 'shooter'));
  combat.destroy(); player.destroy(); player.view.destroy({ children: true });
});
