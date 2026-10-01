import Phaser from 'phaser';
import { DEPTH } from '../config';
import { mixColor, rng } from '../core/util';
import { RING_TEX, WALKWAY_DECK_Y, WALKWAY_H } from '../art/EnvArt';
import {
  floorAt, FLOOR_POINTS, GARDEN, GROTTO, LEFT_RAMP, PLATFORM, RIGHT_RAMP, RING, STATUE, TOWER, WORLD, CLAM, CONCH, ORGAN,
} from './RotondaData';

const ADD = Phaser.BlendModes.ADD;

export type CoralZone = 'rotonda' | 'gate' | 'wild';

export interface Coral {
  img: Phaser.GameObjects.Image;
  zone: CoralZone;
  bloomed: boolean;
  baseScale: number;
}

export interface Lamp {
  x: number;
  y: number;
  group: 'ring' | 'platform' | 'ramp';
  angle?: number;
  glow: Phaser.GameObjects.Image;
  halo: Phaser.GameObjects.Image;
  on: boolean;
}

interface Kelp {
  x: number;
  y: number;
  h: number;
  w: number;
  phase: number;
  color: number;
  fg: boolean;
}

interface Parallax {
  obj: Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite;
  baseX: number;
  drift: number;
}

const DIM_TINT = 0x5d6f86;

/**
 * Builds every visual layer of La Rotonda Sumergida:
 * background (gradient, rays, far silhouettes), midground (the circular
 * walkway, statue, garden, tower), seabed, corals, lamps, kelp and foreground.
 */
export class RotondaBuilder {
  corals: Coral[] = [];
  lamps: Lamp[] = [];
  private bg!: Phaser.GameObjects.Image;
  private bgWarm!: Phaser.GameObjects.Image;
  private rays: { img: Phaser.GameObjects.Image; phase: number; base: number }[] = [];
  private parallax: Parallax[] = [];
  private kelp: Kelp[] = [];
  private kelpG!: Phaser.GameObjects.Graphics;
  private kelpFg!: Phaser.GameObjects.Graphics;
  private surface!: Phaser.GameObjects.Graphics;
  private t = 0;
  statueGlow!: Phaser.GameObjects.Image;
  staffBeam!: Phaser.GameObjects.Image;
  statue!: Phaser.GameObjects.Image;
  flowers: Phaser.GameObjects.Image[] = [];
  gateCorals: Phaser.GameObjects.Image[] = [];
  grottoLight!: Phaser.GameObjects.Image;
  clamTop!: Phaser.GameObjects.Image;
  clamPearl!: Phaser.GameObjects.Image;
  organGlows: Phaser.GameObjects.Image[] = [];
  organ!: Phaser.GameObjects.Image;
  conch!: Phaser.GameObjects.Image;
  currentParticles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private grasses: { img: Phaser.GameObjects.Image; phase: number }[] = [];
  warmth = 0;

  constructor(private scene: Phaser.Scene) {}

  build(): void {
    this.buildBackground();
    this.buildSky();
    this.buildFar();
    this.buildRotonda();
    this.buildTower();
    this.buildFloor();
    this.buildGrotto();
    this.buildProps();
    this.buildCorals();
    this.buildKelp();
    this.buildForeground();
    this.buildSurface();
  }

  // ------------------------------------------------------------ background

  private buildBackground(): void {
    const s = this.scene;
    // full-screen gradient sampled by depth (scrollFactor 0, oversized for zoom-outs)
    this.bg = s.add.image(960, 540, 'bg_grad').setScrollFactor(0).setDepth(DEPTH.BG).setOrigin(0.5, 0.5);
    this.bg.setDisplaySize(1920 * 2.4, 1080 * 2.4);
    this.bgWarm = s.add.image(960, 540, 'glow').setScrollFactor(0).setDepth(DEPTH.BG).setTint(0xffc98a).setAlpha(0).setBlendMode(ADD);
    this.bgWarm.setDisplaySize(1920 * 2.6, 1080 * 2.2);

    // light rays from the surface
    const rand = rng(5);
    for (let i = 0; i < 16; i++) {
      const x = -400 + i * 520 + rand() * 200;
      const img = s.add.image(x, 6, 'ray').setOrigin(0.5, 0).setBlendMode(ADD).setDepth(DEPTH.RAYS)
        .setScrollFactor(0.75, 1).setTint(0xcff6ff);
      img.setScale(0.8 + rand() * 1.4, 1.1 + rand() * 0.8);
      img.rotation = -0.18 + rand() * 0.12;
      const base = 0.2 + rand() * 0.18;
      this.rays.push({ img, phase: rand() * 10, base });
    }
  }

  private buildSky(): void {
    const s = this.scene;
    const sky = s.add.image(-200, WORLD.top, 'sky').setOrigin(0, 0).setDepth(DEPTH.SKY);
    sky.setDisplaySize(WORLD.w + 400, -WORLD.top + 2);
    const sun = s.add.image(4200, -420, 'glow').setScale(2.6).setTint(0xfff0c8).setBlendMode(ADD).setDepth(DEPTH.SKY).setScrollFactor(0.4, 1);
    sun.setAlpha(0.9);
    const rand = rng(8);
    for (let i = 0; i < 9; i++) {
      s.add.image(rand() * WORLD.w, -720 + rand() * 340, 'cloud').setScale(0.6 + rand() * 0.9).setAlpha(0.65).setDepth(DEPTH.SKY).setScrollFactor(0.5 + rand() * 0.3, 1);
    }
  }

  private addParallax(key: string, x: number, y: number, sf: number, tint: number, alpha: number, scale: number, depth: number, drift = 0): Phaser.GameObjects.Image {
    const img = this.scene.add.image(x, y, key).setOrigin(0.5, 1).setScrollFactor(sf).setTint(tint).setAlpha(alpha).setScale(scale).setDepth(depth);
    this.parallax.push({ obj: img, baseX: x, drift });
    return img;
  }

  private buildFar(): void {
    // Objects at scrollFactor sf appear at screenY = y - camY*sf. Place them for a
    // reference camera deep in the level (camY ≈ 1500).
    const deep = 1500;
    const rand = rng(12);
    for (let i = 0; i < 6; i++) {
      const sf = 0.25;
      this.addParallax(i % 2 ? 'far_ridge_0' : 'far_ridge_1', -600 + i * 1500, 1150 + deep * sf, sf, 0x0c3360, 0.9, 1.2, DEPTH.FAR);
    }
    for (let i = 0; i < 7; i++) {
      const sf = 0.42;
      const key = rand() < 0.6 ? 'far_ruin' : 'far_ridge_1';
      this.addParallax(key, -300 + i * 1000 + rand() * 300, 1080 + deep * sf + rand() * 40, sf, 0x134577, 0.75, 0.6 + rand() * 0.5, DEPTH.FAR + 1);
    }
    // a distant whale gliding slowly
    const whale = this.scene.add.image(-600, 1100, 'whale').setScrollFactor(0.3).setTint(0x1a4d80).setAlpha(0.55).setDepth(DEPTH.FAR + 1).setScale(0.8);
    this.scene.tweens.add({ targets: whale, x: 3600, duration: 160000, repeat: -1, ease: 'Linear' });
    this.scene.tweens.add({ targets: whale, y: 1180, duration: 9000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // mid-distance seabed ridge
    for (let i = 0; i < 6; i++) {
      const sf = 0.7;
      this.addParallax('far_ridge_0', -400 + i * 1400, 1080 + deep * sf + 60, sf, 0x0f3a64, 1, 1, DEPTH.FAR2);
    }
  }

  // ------------------------------------------------------------ rotonda

  private buildRotonda(): void {
    const s = this.scene;
    const ox = RING.cx - RING_TEX.cx;
    const oy = RING.cy - RING_TEX.cy;

    // back pillars (behind the garden)
    const backAngles = [200, 225, 252, 288, 315, 340];
    for (const deg of backAngles) {
      const a = (deg * Math.PI) / 180;
      const x = RING.cx + Math.cos(a) * (RING.rx - 60);
      const y = RING.cy + Math.sin(a) * (RING.ry - 24) + 30;
      s.add.image(x, y, 'pillar').setOrigin(0.5, 0).setScale(0.82, 1).setTint(0x9fb3c6).setDepth(DEPTH.MID_BACK - 1);
    }
    s.add.image(ox, oy, 'ring_back').setOrigin(0, 0).setDepth(DEPTH.MID_BACK);

    // garden, statue
    s.add.image(GARDEN.cx, GARDEN.cy - 110 + GARDEN.ry, 'garden').setOrigin(0.5, 0).setDepth(DEPTH.MID_BACK + 1).setY(GARDEN.cy - 110);
    this.statueGlow = s.add.image(STATUE.x, STATUE.baseY - 700, 'glow').setScale(5, 7).setTint(0x7fffd0).setBlendMode(ADD).setAlpha(0).setDepth(DEPTH.MID_BACK + 1);
    s.add.image(STATUE.x, STATUE.baseY, 'pedestal').setOrigin(0.5, 1).setDepth(DEPTH.MID);
    this.statue = s.add.image(STATUE.x, STATUE.baseY - STATUE.pedestalH + 6, 'statue').setOrigin(0.5, 1).setDepth(DEPTH.MID);
    const staffTopX = STATUE.x + 64;
    const staffTopY = STATUE.baseY - STATUE.pedestalH + 6 - 1160 + 52;
    this.staffBeam = s.add.image(staffTopX, staffTopY, 'ray').setOrigin(0.5, 1).setFlipY(true).setScale(0.5, 1.4)
      .setTint(0xffe6a0).setBlendMode(ADD).setAlpha(0).setDepth(DEPTH.MID);
    const orb = s.add.image(staffTopX, staffTopY, 'glow').setScale(0.5).setTint(0xffe6a0).setBlendMode(ADD).setAlpha(0.35).setDepth(DEPTH.MID + 1);
    s.tweens.add({ targets: orb, alpha: 0.6, scale: 0.6, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // garden flowers (closed buds until the finale)
    const rand = rng(44);
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2;
      const r = 0.35 + rand() * 0.6;
      const x = GARDEN.cx + Math.cos(a) * GARDEN.rx * r;
      const y = GARDEN.cy + Math.sin(a) * GARDEN.ry * r;
      if (Math.abs(x - GARDEN.cx) < 150 && y < GARDEN.cy + 30) continue;
      const f = s.add.image(x, y, 'flower').setScale(0.25).setTint(mixColor(0xff9ac0, 0xffe08a, rand())).setAlpha(0.5).setDepth(DEPTH.MID + 1);
      this.flowers.push(f);
    }

    // front pillars
    const frontAngles = [18, 48, 132, 162];
    for (const deg of frontAngles) {
      const a = (deg * Math.PI) / 180;
      const x = RING.cx + Math.cos(a) * (RING.rx - 60);
      const y = RING.cy + Math.sin(a) * (RING.ry - 30) + RING.thickness;
      s.add.image(x, y, 'pillar').setOrigin(0.5, 0).setDepth(DEPTH.MID_FRONT - 1);
    }
    s.add.image(ox, oy, 'ring_front').setOrigin(0, 0).setDepth(DEPTH.MID_FRONT);

    // ramps & platform
    const ramp = (key: string, x0: number, y0: number, x1: number, y1: number): void => {
      const ang = Math.atan2(y1 - y0, x1 - x0);
      s.add.image(x0, y0, key).setOrigin(0, WALKWAY_DECK_Y / WALKWAY_H).setRotation(ang).setDepth(DEPTH.MID_FRONT);
    };
    ramp('ramp_left', LEFT_RAMP.x0, LEFT_RAMP.y0, LEFT_RAMP.x1, LEFT_RAMP.y1);
    ramp('ramp_right', RIGHT_RAMP.x0, RIGHT_RAMP.y0, RIGHT_RAMP.x1, RIGHT_RAMP.y1);
    s.add.image(PLATFORM.x0, PLATFORM.y, 'platform').setOrigin(0, WALKWAY_DECK_Y / WALKWAY_H).setDepth(DEPTH.MID_FRONT);
    // supports
    for (const t of [0.35, 0.7]) {
      const x = LEFT_RAMP.x0 + (LEFT_RAMP.x1 - LEFT_RAMP.x0) * t;
      const y = LEFT_RAMP.y0 + (LEFT_RAMP.y1 - LEFT_RAMP.y0) * t + 50;
      s.add.image(x, y, 'pillar').setOrigin(0.5, 0).setScale(0.55, 1).setDepth(DEPTH.MID_FRONT - 1);
    }
    for (const x of [4800, 5250, 5700]) {
      const y = x < 5150 ? RIGHT_RAMP.y0 + (RIGHT_RAMP.y1 - RIGHT_RAMP.y0) * ((x - RIGHT_RAMP.x0) / (RIGHT_RAMP.x1 - RIGHT_RAMP.x0)) + 50 : PLATFORM.y + 50;
      s.add.image(x, y, 'pillar').setOrigin(0.5, 0).setScale(0.55, 1).setDepth(DEPTH.MID_FRONT - 1);
    }

    // lamps around the ring
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + 0.17;
      const x = RING.cx + Math.cos(a) * (RING.rx - 14);
      const y = RING.cy + Math.sin(a) * (RING.ry - 6);
      const front = Math.sin(a) > 0;
      this.addLamp(x, y, 'ring', front ? DEPTH.MID_FRONT + 1 : DEPTH.MID_BACK + 1, a);
    }
    for (const x of [5220, 5420, 5640]) this.addLamp(x, PLATFORM.y, 'platform', DEPTH.MID_FRONT + 1);
    for (const t of [0.2, 0.5, 0.8]) {
      this.addLamp(LEFT_RAMP.x0 + (LEFT_RAMP.x1 - LEFT_RAMP.x0) * t, LEFT_RAMP.y0 + (LEFT_RAMP.y1 - LEFT_RAMP.y0) * t, 'ramp', DEPTH.MID_FRONT + 1);
    }
  }

  private addLamp(x: number, y: number, group: Lamp['group'], depth: number, angle?: number): void {
    const s = this.scene;
    s.add.image(x, y, 'lamp').setOrigin(0.5, 1).setDepth(depth).setScale(0.9);
    const gy = y - 92;
    const halo = s.add.image(x, gy, 'glow').setTint(0xffd98a).setBlendMode(ADD).setScale(1.3).setAlpha(0).setDepth(depth);
    const glow = s.add.image(x, gy, 'softdot').setTint(0xfff1c8).setBlendMode(ADD).setScale(1.2).setAlpha(0.15).setDepth(depth + 0.5);
    this.lamps.push({ x, y: gy, group, angle, glow, halo, on: false });
  }

  lightLamp(l: Lamp, instant = false): void {
    if (l.on) return;
    l.on = true;
    if (instant) {
      l.halo.setAlpha(0.75);
      l.glow.setAlpha(1);
      return;
    }
    this.scene.tweens.add({ targets: l.halo, alpha: 0.75, scale: { from: 2.4, to: 1.3 }, duration: 900, ease: 'Cubic.easeOut' });
    this.scene.tweens.add({ targets: l.glow, alpha: 1, duration: 300 });
  }

  // ------------------------------------------------------------ tower

  private buildTower(): void {
    const s = this.scene;
    for (const x of [TOWER.x0 + 28, TOWER.x1 - 28]) s.add.image(x, TOWER.bottom - 10, 'leg').setOrigin(0.5, 0).setDepth(DEPTH.MID_BACK);
    s.add.image(TOWER.x0 - 30, TOWER.top - 170, 'tower').setOrigin(0, 0).setDepth(DEPTH.MID_FRONT + 2);
    // water current streaks inside the shaft
    this.currentParticles = s.add.particles(0, 0, 'softdot', {
      x: { min: TOWER.x0 + 60, max: TOWER.x1 - 60 },
      y: { min: 300, max: 1080 },
      speedY: { min: 380, max: 620 },
      scaleX: 0.25,
      scaleY: { start: 2.6, end: 1.2 },
      alpha: { start: 0.55, end: 0 },
      lifespan: 900,
      frequency: 28,
      tint: 0xbfefff,
      blendMode: ADD,
    }).setDepth(DEPTH.FX - 2);
  }

  /** The tide organ was played: the current now flows upward. */
  reverseCurrent(): void {
    this.currentParticles.setConfig({
      x: { min: TOWER.x0 + 60, max: TOWER.x1 - 60 },
      y: { min: 400, max: 1320 },
      speedY: { min: -620, max: -380 },
      scaleX: 0.25,
      scaleY: { start: 2.6, end: 1.2 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 900,
      frequency: 24,
      tint: [0xfff0b8, 0xbfefff],
      blendMode: ADD,
    });
  }

  // ------------------------------------------------------------ seabed

  private buildFloor(): void {
    const s = this.scene;
    const g = s.add.graphics().setDepth(DEPTH.FLOOR);
    const pts: Phaser.Math.Vector2[] = [];
    for (let x = -300; x <= WORLD.w + 300; x += 30) pts.push(new Phaser.Math.Vector2(x, floorAt(x)));
    // layered fill for a soft gradient
    const layers: [number, number][] = [[0, 0x2f5672], [14, 0x264a66], [40, 0x1d3c57], [90, 0x152e46], [170, 0x0f2236]];
    for (const [off, col] of layers) {
      g.fillStyle(col, 1);
      g.fillPoints([...pts.map((p) => new Phaser.Math.Vector2(p.x, p.y + off)), new Phaser.Math.Vector2(WORLD.w + 300, WORLD.bottom + 400), new Phaser.Math.Vector2(-300, WORLD.bottom + 400)], true);
    }
    // sandy highlight line
    g.lineStyle(4, 0x6f9bb4, 0.6);
    g.strokePoints(pts, false);
    // pebbles
    const rand = rng(71);
    for (let i = 0; i < 400; i++) {
      const x = rand() * WORLD.w;
      const y = floorAt(x) + 10 + rand() * 120;
      g.fillStyle(rand() < 0.5 ? 0x3d6680 : 0x10243a, 0.6);
      g.fillCircle(x, y, 2 + rand() * 4);
    }
    void FLOOR_POINTS;
  }

  private buildGrotto(): void {
    const s = this.scene;
    const c = GROTTO.ceiling;
    s.add.image(c.x - 30, c.y - 60, 'grotto').setOrigin(0, 0).setDepth(DEPTH.FLOOR + 1);
    this.grottoLight = s.add.image(5850, 2450, 'glow').setScale(4, 2.6).setTint(0xffb46a).setBlendMode(ADD).setAlpha(0.05).setDepth(DEPTH.MID_BACK);
    // the coral gate: a dense wall of sleeping coral
    const gx = GROTTO.gate.x + GROTTO.gate.w / 2;
    const rand = rng(90);
    const keys = ['coral_branch_0', 'coral_fan_2', 'coral_brain', 'coral_branch_3', 'coral_fan_0', 'sponge', 'coral_branch_1', 'coral_fan_4', 'anemone'];
    let y = floorAt(gx) + 10;
    let i = 0;
    while (y > GROTTO.gate.y - 30) {
      const key = keys[i % keys.length];
      const img = s.add.image(gx + (rand() - 0.5) * 50, y, key).setOrigin(0.5, 1).setScale(0.9 + rand() * 0.3).setTint(DIM_TINT).setDepth(DEPTH.FLOOR + 2);
      img.rotation = (rand() - 0.5) * 0.4;
      this.gateCorals.push(img);
      y -= 70 + rand() * 25;
      i++;
    }
  }

  private buildProps(): void {
    const s = this.scene;
    // the giant clam
    s.add.image(CLAM.x, CLAM.y, 'clam_bottom').setOrigin(0.5, 0.15).setDepth(DEPTH.FLOOR + 2);
    this.clamPearl = s.add.image(CLAM.x, CLAM.y - 4, 'pearl').setDepth(DEPTH.FLOOR + 2).setAlpha(0);
    this.clamTop = s.add.image(CLAM.x + 126, CLAM.y + 8, 'clam_top').setOrigin(0.985, 0.95).setDepth(DEPTH.FLOOR + 3);
    // conch of the coral gate
    this.conch = s.add.image(CONCH.x, CONCH.y + 30, 'conch').setOrigin(0.5, 1).setDepth(DEPTH.FLOOR + 2);
    // tide organ
    this.organ = s.add.image(ORGAN.x, ORGAN.y + 4, 'organ').setOrigin(0.5, 1).setDepth(DEPTH.MID_FRONT + 1);
    const heights = [120, 150, 180, 205, 180, 150, 120];
    for (let i = 0; i < 7; i++) {
      const px = ORGAN.x - 150 + 40 + i * 32;
      const top = ORGAN.y + 4 - 80 - heights[i];
      this.organGlows.push(s.add.image(px, top, 'glow').setScale(0.35).setTint([0xff8a9a, 0xffb066, 0xffdf6a, 0x9be88f, 0x6fe6d6, 0x7fbcff, 0xc49bff][i]).setBlendMode(ADD).setAlpha(0).setDepth(DEPTH.MID_FRONT + 2));
    }
  }

  // ------------------------------------------------------------ corals

  private addCoral(key: string, x: number, y: number, zone: CoralZone, scale: number, depth: number): void {
    const img = this.scene.add.image(x, y, key).setOrigin(0.5, 1).setScale(zone === 'wild' ? scale : scale * 0.86).setDepth(depth);
    img.rotation = (Math.random() - 0.5) * 0.2;
    if (zone !== 'wild') img.setTint(DIM_TINT);
    this.corals.push({ img, zone, bloomed: zone === 'wild', baseScale: scale });
  }

  private buildCorals(): void {
    const rand = rng(123);
    const keys = ['coral_branch_0', 'coral_branch_1', 'coral_branch_2', 'coral_branch_3', 'coral_branch_4', 'coral_fan_0', 'coral_fan_1', 'coral_fan_2', 'coral_fan_3', 'coral_brain', 'sponge', 'anemone'];
    const pick = () => keys[Math.floor(rand() * keys.length)];
    // seabed corals
    for (let x = 80; x < WORLD.w - 40; x += 70 + rand() * 90) {
      if (x > GROTTO.gate.x - 30 && x < GROTTO.gate.x + GROTTO.gate.w + 30) continue;
      const zone: CoralZone = x > 1900 && x < 4600 ? 'rotonda' : x > 4600 && x < 6400 ? 'gate' : 'wild';
      if (rand() < 0.25) {
        this.scene.add.image(x, floorAt(x) + 30, `rock_${Math.floor(rand() * 4)}`).setOrigin(0.5, 1).setDepth(DEPTH.FLOOR + 1).setScale(0.7 + rand() * 0.6);
      }
      this.addCoral(pick(), x, floorAt(x) + 12, zone, 0.55 + rand() * 0.6, DEPTH.FLOOR_DECOR);
      if (rand() < 0.5) {
        const g = this.scene.add.image(x + 30, floorAt(x + 30) + 10, 'seagrass').setOrigin(0.5, 1).setDepth(DEPTH.FLOOR_DECOR).setScale(0.8 + rand() * 0.6);
        this.grasses.push({ img: g, phase: rand() * 10 });
      }
    }
    // around the garden rim
    for (let i = 0; i < 22; i++) {
      const a = Math.PI * (0.05 + (i / 21) * 0.9);
      const x = GARDEN.cx + Math.cos(a) * (GARDEN.rx - 10);
      const y = GARDEN.cy + Math.sin(a) * GARDEN.ry + 20;
      this.addCoral(pick(), x, y, 'rotonda', 0.45 + rand() * 0.35, DEPTH.MID + 2);
    }
    // on the ring deck
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rand() * 0.1;
      const x = RING.cx + Math.cos(a) * (RING.rx - 50);
      const y = RING.cy + Math.sin(a) * (RING.ry - 20);
      const front = Math.sin(a) > 0;
      this.addCoral(pick(), x, y, 'rotonda', 0.32 + rand() * 0.25, front ? DEPTH.MID_FRONT + 1 : DEPTH.MID_BACK + 1);
    }
    // inside the grotto: a cosy home
    for (let i = 0; i < 8; i++) {
      const x = 5450 + i * 120;
      this.addCoral(pick(), x, floorAt(x) + 10, 'gate', 0.6 + rand() * 0.4, DEPTH.FLOOR_DECOR);
    }
  }

  bloom(zone: CoralZone, originX: number, originY: number, maxDelay = 2600): void {
    const list = this.corals.filter((c) => c.zone === zone && !c.bloomed);
    let maxD = 1;
    for (const c of list) maxD = Math.max(maxD, Phaser.Math.Distance.Between(originX, originY, c.img.x, c.img.y));
    for (const c of list) {
      c.bloomed = true;
      const d = Phaser.Math.Distance.Between(originX, originY, c.img.x, c.img.y);
      const delay = (d / maxD) * maxDelay;
      this.scene.tweens.addCounter({
        from: 0, to: 1, delay, duration: 1100, ease: 'Sine.easeOut',
        onUpdate: (tw) => c.img.setTint(mixColor(DIM_TINT, 0xffffff, tw.getValue() ?? 1)),
      });
      this.scene.tweens.add({ targets: c.img, scale: c.baseScale * 1.08, delay, duration: 500, ease: 'Back.easeOut', yoyo: false, onComplete: () => {
        this.scene.tweens.add({ targets: c.img, scale: c.baseScale, duration: 400 });
      } });
    }
  }

  bloomInstant(zone: CoralZone): void {
    for (const c of this.corals) if (c.zone === zone) {
      c.bloomed = true;
      c.img.clearTint().setScale(c.baseScale);
    }
  }

  bloomFlowers(instant = false): void {
    this.flowers.forEach((f, i) => {
      if (instant) {
        f.setScale(0.8).setAlpha(1);
        return;
      }
      this.scene.tweens.add({ targets: f, scale: 0.8, alpha: 1, delay: i * 70, duration: 900, ease: 'Back.easeOut' });
    });
  }

  // ------------------------------------------------------------ kelp & foreground

  private buildKelp(): void {
    this.kelpG = this.scene.add.graphics().setDepth(DEPTH.FLOOR_DECOR - 1);
    const rand = rng(64);
    // dense kelp forest to the west, sparse elsewhere
    for (let i = 0; i < 46; i++) {
      const x = 120 + rand() * 1150;
      this.kelp.push({ x, y: floorAt(x) + 20, h: 380 + rand() * 520, w: 10 + rand() * 8, phase: rand() * 10, color: mixColor(0x2f7a4c, 0x7fae4a, rand()), fg: false });
    }
    for (let i = 0; i < 18; i++) {
      const x = 1400 + rand() * 4800;
      if (x > 2400 && x < 4000) continue;
      this.kelp.push({ x, y: floorAt(x) + 20, h: 200 + rand() * 300, w: 8 + rand() * 6, phase: rand() * 10, color: mixColor(0x2f7a4c, 0x6f9e44, rand()), fg: false });
    }
    // foreground kelp (parallax 1.2)
    this.kelpFg = this.scene.add.graphics().setDepth(DEPTH.FOREGROUND).setScrollFactor(1.2);
    for (let i = 0; i < 16; i++) {
      const x = rand() * WORLD.w * 1.2;
      this.kelp.push({ x, y: floorAt(x / 1.2) + 600, h: 500 + rand() * 500, w: 22 + rand() * 12, phase: rand() * 10, color: mixColor(0x10301f, 0x1f4a2a, rand()), fg: true });
    }
    // floating sargassum near the surface (Bruno hides there)
    for (const [x, y] of [[1600, 70], [1780, 100], [1690, 160], [3000, 60], [4700, 80]]) {
      const img = this.scene.add.image(x, y, 'sargassum').setDepth(DEPTH.CREATURES + 2).setScale(1.1);
      this.scene.tweens.add({ targets: img, y: y + 12, duration: 2400 + Math.random() * 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private buildForeground(): void {
    const s = this.scene;
    const rand = rng(202);
    for (let i = 0; i < 14; i++) {
      const x = rand() * WORLD.w * 1.25;
      const img = s.add.image(x, floorAt(x / 1.25) + 520, `coral_branch_${Math.floor(rand() * 5)}`).setOrigin(0.5, 1).setScale(1.6 + rand()).setScrollFactor(1.25).setDepth(DEPTH.FOREGROUND).setTint(0x1d3550).setAlpha(0.6);
      img.rotation = (rand() - 0.5) * 0.3;
    }
  }

  private buildSurface(): void {
    this.surface = this.scene.add.graphics().setDepth(DEPTH.SURFACE);
  }

  // ------------------------------------------------------------ per-frame

  update(dt: number, cam: Phaser.Cameras.Scene2D.Camera): void {
    this.t += dt;
    // background colour follows depth
    const view = cam.worldView;
    const depth01 = Phaser.Math.Clamp((view.centerY - 0) / (WORLD.bottom - 400), 0, 1);
    const tex = this.bg;
    tex.setCrop();
    // shift the gradient vertically to sample the right band
    tex.y = 540 + (0.5 - depth01) * (tex.displayHeight * 0.55);
    this.bgWarm.setAlpha(this.warmth * 0.25);

    for (const r of this.rays) {
      r.img.setAlpha(r.base * (0.7 + 0.3 * Math.sin(this.t * 0.6 + r.phase)) * (1 - depth01 * 0.6) * (1 + this.warmth * 0.6));
      r.img.rotation = -0.15 + Math.sin(this.t * 0.15 + r.phase) * 0.05;
    }
    for (const p of this.parallax) if (p.drift) p.obj.x = p.baseX + Math.sin(this.t * 0.05) * p.drift;
    for (const g of this.grasses) g.img.rotation = Math.sin(this.t * 1.2 + g.phase) * 0.08;

    this.drawKelp(view);
    this.drawSurface(view);
  }

  private drawKelp(view: Phaser.Geom.Rectangle): void {
    const g = this.kelpG;
    const fg = this.kelpFg;
    g.clear();
    fg.clear();
    for (const k of this.kelp) {
      const target = k.fg ? fg : g;
      // cheap culling (foreground uses parallax coordinates)
      const vx = k.fg ? view.x * 1.2 : view.x;
      if (k.x < vx - 300 || k.x > vx + view.width + 300) continue;
      const segs = 14;
      const left: Phaser.Math.Vector2[] = [];
      const right: Phaser.Math.Vector2[] = [];
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const sway = Math.sin(this.t * 0.9 + k.phase + t * 2.4) * 40 * t + Math.sin(this.t * 0.4 + k.phase) * 25 * t * t;
        const x = k.x + sway;
        const y = k.y - k.h * t;
        const w = k.w * (1 - t * 0.6) * (0.8 + 0.2 * Math.sin(t * 9 + k.phase));
        left.push(new Phaser.Math.Vector2(x - w, y));
        right.push(new Phaser.Math.Vector2(x + w, y));
      }
      target.fillStyle(k.color, k.fg ? 0.7 : 0.95);
      target.fillPoints([...left, ...right.reverse()], true);
      if (!k.fg) {
        // little leaves
        target.fillStyle(mixColor(k.color, 0xb8e07a, 0.3), 0.9);
        for (let i = 3; i < segs; i += 3) {
          const p = left[i];
          target.fillEllipse(p.x - 8, p.y, 22, 8);
        }
      }
    }
  }

  private drawSurface(view: Phaser.Geom.Rectangle): void {
    const g = this.surface;
    g.clear();
    if (view.y > 300) return;
    const x0 = view.x - 50;
    const x1 = view.x + view.width + 50;
    const top: Phaser.Math.Vector2[] = [];
    for (let x = x0; x <= x1; x += 24) {
      const y = Math.sin(x * 0.012 + this.t * 1.6) * 6 + Math.sin(x * 0.031 - this.t * 2.1) * 3;
      top.push(new Phaser.Math.Vector2(x, y));
    }
    // water body seen from above the surface
    g.fillStyle(0x4fb6dc, 0.35);
    g.fillPoints([...top, new Phaser.Math.Vector2(x1, 40), new Phaser.Math.Vector2(x0, 40)], true);
    // bright underside of the surface
    g.fillStyle(0xcff6ff, 0.25);
    g.fillPoints([...top, ...top.map((p) => new Phaser.Math.Vector2(p.x, p.y + 22)).reverse()], true);
    g.lineStyle(3, 0xffffff, 0.75);
    g.strokePoints(top, false);
  }
}
