import Phaser from 'phaser';
import { DEPTH } from '../config';
import { damp } from '../core/util';

const ADD = Phaser.BlendModes.ADD;

/** Base for simple characters: position/velocity steering toward a target with facing flip. */
abstract class Mover {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  tx: number;
  ty: number;
  t = Math.random() * 10;
  maxSpeed = 260;
  accel = 4;
  protected faceX = 1;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.tx = x;
    this.ty = y;
  }

  protected steer(dt: number): void {
    const dx = this.tx - this.x;
    const dy = this.ty - this.y;
    const d = Math.hypot(dx, dy);
    const desired = Math.min(this.maxSpeed, d * 1.8);
    const dvx = d > 1 ? (dx / d) * desired : 0;
    const dvy = d > 1 ? (dy / d) * desired : 0;
    this.vx += (dvx - this.vx) * damp(this.accel, dt);
    this.vy += (dvy - this.vy) * damp(this.accel, dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (Math.abs(this.vx) > 12) this.faceX = this.vx > 0 ? 1 : -1;
  }
}

// ---------------------------------------------------------------- Lumi

export class Lumi extends Mover {
  readonly sprite: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  /** When set, Lumi goes there instead of following Rosa. */
  anchor: { x: number; y: number } | null = null;
  following = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(x, y);
    this.maxSpeed = 620;
    this.accel = 3;
    this.glow = scene.add.image(x, y, 'glow').setTint(0xffb8d0).setBlendMode(ADD).setScale(0.6).setAlpha(0.55).setDepth(DEPTH.CREATURES);
    this.sprite = scene.add.image(x, y, 'lumi').setScale(0.85).setDepth(DEPTH.CREATURES + 1);
  }

  update(dt: number, rosa: { x: number; y: number; facing: number }): void {
    this.t += dt;
    if (this.anchor) {
      this.tx = this.anchor.x;
      this.ty = this.anchor.y;
    } else if (this.following) {
      // hover slightly behind and above Rosa
      const ox = -rosa.facing * 150;
      this.tx = rosa.x + ox + Math.sin(this.t * 0.7) * 30;
      this.ty = Math.max(70, rosa.y - 110 + Math.sin(this.t * 1.1) * 20);
    }
    this.steer(dt);
    const bob = Math.sin(this.t * 2.6) * 6;
    this.sprite.setPosition(this.x, this.y + bob);
    this.sprite.setFlipX(this.faceX < 0);
    this.sprite.rotation = Math.sin(this.t * 2) * 0.08 + this.vx * 0.0004;
    this.glow.setPosition(this.x, this.y + bob).setScale(0.55 + Math.sin(this.t * 3) * 0.05);
  }

  hop(scene: Phaser.Scene): void {
    scene.tweens.add({ targets: this.sprite, scaleY: { from: 0.7, to: 0.85 }, scaleX: { from: 1, to: 0.85 }, duration: 400, ease: 'Back.easeOut' });
  }
}

// ---------------------------------------------------------------- Turtles

export class Turtle extends Mover {
  readonly sprite: Phaser.GameObjects.Image;
  home: { x: number; y: number };
  mode: 'wander' | 'goto' | 'follow' | 'hide' = 'wander';
  followTarget: { x: number; y: number } | null = null;
  private wanderAngle = Math.random() * Math.PI * 2;

  constructor(scene: Phaser.Scene, x: number, y: number, key: 'turtle' | 'turtle_baby', private wanderR = 140) {
    super(x, y);
    this.home = { x, y };
    this.maxSpeed = key === 'turtle' ? 120 : 340;
    this.accel = key === 'turtle' ? 1.6 : 2.6;
    this.sprite = scene.add.image(x, y, key).setDepth(DEPTH.CREATURES);
  }

  update(dt: number): void {
    this.t += dt;
    if (this.mode === 'wander') {
      this.wanderAngle += dt * 0.25;
      this.tx = this.home.x + Math.cos(this.wanderAngle) * this.wanderR;
      this.ty = this.home.y + Math.sin(this.wanderAngle * 1.3) * this.wanderR * 0.3;
    } else if (this.mode === 'follow' && this.followTarget) {
      const dx = this.x - this.followTarget.x;
      const dy = this.y - this.followTarget.y;
      const d = Math.hypot(dx, dy) || 1;
      const keep = 170;
      this.tx = this.followTarget.x + (dx / d) * keep;
      this.ty = Math.max(60, this.followTarget.y + (dy / d) * keep);
    } else if (this.mode === 'hide') {
      this.tx = this.home.x + Math.sin(this.t * 0.6) * 20;
      this.ty = this.home.y + Math.sin(this.t * 0.9) * 8;
    }
    this.steer(dt);
    this.sprite.setPosition(this.x, this.y + Math.sin(this.t * 1.6) * 4);
    this.sprite.setFlipX(this.faceX < 0);
    this.sprite.rotation = Math.sin(this.t * 1.6) * 0.05 + this.vy * 0.0008 * this.faceX;
  }
}

// ---------------------------------------------------------------- Fish schools

interface Fish {
  s: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  o: number;
}

export class FishSchool {
  private fish: Fish[] = [];
  cx: number;
  cy: number;
  private t = Math.random() * 10;
  private scatterT = 0;
  area: Phaser.Geom.Rectangle;
  /** Optional orbit for the finale. */
  orbit: { x: number; y: number; rx: number; ry: number; speed: number } | null = null;
  private target = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene, area: Phaser.Geom.Rectangle, count: number, key: string, scale = 1, startX?: number, startY?: number) {
    this.area = area;
    this.cx = startX ?? area.centerX;
    this.cy = startY ?? area.centerY;
    this.target.set(this.cx, this.cy);
    for (let i = 0; i < count; i++) {
      const x = this.cx + (Math.random() - 0.5) * 160;
      const y = this.cy + (Math.random() - 0.5) * 90;
      const s = scene.add.image(x, y, key).setScale(scale * (0.8 + Math.random() * 0.4)).setDepth(DEPTH.CREATURES - 1);
      this.fish.push({ s, x, y, vx: 0, vy: 0, o: Math.random() * 10 });
    }
    this.pickTarget();
  }

  get x(): number {
    return this.cx;
  }
  get y(): number {
    return this.cy;
  }

  private pickTarget(): void {
    const a = this.area;
    this.target.set(a.x + Math.random() * a.width, a.y + Math.random() * a.height);
  }

  scatter(fromX: number, fromY: number): void {
    this.scatterT = 0.8;
    for (const f of this.fish) {
      const dx = f.x - fromX;
      const dy = f.y - fromY;
      const d = Math.hypot(dx, dy) || 1;
      f.vx += (dx / d) * 420;
      f.vy += (dy / d) * 420;
    }
  }

  setVisible(v: boolean): void {
    for (const f of this.fish) f.s.setVisible(v);
  }

  update(dt: number, rosaX: number, rosaY: number): void {
    this.t += dt;
    this.scatterT = Math.max(0, this.scatterT - dt);
    if (this.orbit) {
      const o = this.orbit;
      this.target.set(o.x + Math.cos(this.t * o.speed) * o.rx, o.y + Math.sin(this.t * o.speed) * o.ry);
    } else if (Phaser.Math.Distance.Between(this.cx, this.cy, this.target.x, this.target.y) < 60) {
      this.pickTarget();
    }
    // school centre drifts to its target
    const dx = this.target.x - this.cx;
    const dy = this.target.y - this.cy;
    const d = Math.hypot(dx, dy) || 1;
    const sp = this.orbit ? 260 : 90;
    this.cx += (dx / d) * Math.min(sp, d * 2) * dt;
    this.cy += (dy / d) * Math.min(sp, d * 2) * dt;

    for (const f of this.fish) {
      const ox = Math.cos(this.t * 0.8 + f.o) * 70;
      const oy = Math.sin(this.t * 1.1 + f.o * 1.3) * 34;
      let ax = (this.cx + ox - f.x) * 2.2;
      let ay = (this.cy + oy - f.y) * 2.2;
      const rx = f.x - rosaX;
      const ry = f.y - rosaY;
      const rd = Math.hypot(rx, ry);
      if (rd < 170 && rd > 1) {
        ax += (rx / rd) * (170 - rd) * 14;
        ay += (ry / rd) * (170 - rd) * 14;
      }
      f.vx += ax * dt;
      f.vy += ay * dt;
      const drag = this.scatterT > 0 ? 1.2 : 2.4;
      f.vx *= Math.exp(-drag * dt);
      f.vy *= Math.exp(-drag * dt);
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.y < 40) f.y = 40;
      f.s.setPosition(f.x, f.y);
      if (Math.abs(f.vx) > 8) f.s.setFlipX(f.vx < 0);
      f.s.rotation = Phaser.Math.Clamp(f.vy * 0.003, -0.5, 0.5) * (f.vx < 0 ? -1 : 1);
    }
  }
}

// ---------------------------------------------------------------- Jellyfish

export class Jellyfish {
  readonly sprite: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private t = Math.random() * 10;
  lit = false;

  constructor(scene: Phaser.Scene, public x: number, public y: number) {
    this.glow = scene.add.image(x, y, 'glow').setTint(0xc9a8ff).setBlendMode(ADD).setScale(0.5).setAlpha(0.15).setDepth(DEPTH.CREATURES - 2);
    this.sprite = scene.add.image(x, y, 'jelly').setScale(0.8).setAlpha(0.6).setDepth(DEPTH.CREATURES - 1).setTint(0x8090b0);
  }

  lightUp(scene: Phaser.Scene): void {
    this.lit = true;
    this.sprite.clearTint();
    scene.tweens.add({ targets: this.sprite, alpha: 0.95, duration: 800 });
    scene.tweens.add({ targets: this.glow, alpha: 0.6, scale: 0.9, duration: 1200 });
  }

  flash(scene: Phaser.Scene): void {
    scene.tweens.add({ targets: this.glow, alpha: { from: 0.8, to: this.lit ? 0.6 : 0.15 }, duration: 900 });
  }

  update(dt: number): void {
    this.t += dt;
    const pulse = Math.sin(this.t * 2.4);
    const yy = this.y + Math.sin(this.t * 0.5) * 40;
    this.sprite.setPosition(this.x + Math.sin(this.t * 0.3) * 20, yy);
    this.sprite.setScale(0.8 + pulse * 0.05, 0.8 - pulse * 0.06);
    this.glow.setPosition(this.sprite.x, yy - 20);
  }
}

// ---------------------------------------------------------------- Manta

export class Manta {
  readonly sprite: Phaser.GameObjects.Image;
  private t = 0;
  approach: { x: number; y: number } | null = null;
  private px: number;
  private py: number;

  constructor(scene: Phaser.Scene, private cx: number, private cy: number, private rx: number, private ry: number) {
    this.px = cx;
    this.py = cy;
    this.sprite = scene.add.image(cx, cy, 'manta').setScale(0.9).setDepth(DEPTH.CREATURES - 3).setAlpha(0.95);
  }

  update(dt: number): void {
    this.t += dt;
    let tx: number;
    let ty: number;
    if (this.approach) {
      tx = this.approach.x + Math.cos(this.t * 0.6) * 60;
      ty = this.approach.y + Math.sin(this.t * 0.9) * 20;
    } else {
      tx = this.cx + Math.cos(this.t * 0.09) * this.rx;
      ty = this.cy + Math.sin(this.t * 0.18) * this.ry;
    }
    const k = damp(this.approach ? 0.8 : 3, dt);
    const nx = this.px + (tx - this.px) * k;
    const ny = this.py + (ty - this.py) * k;
    const vx = nx - this.px;
    this.px = nx;
    this.py = ny;
    this.sprite.setPosition(nx, ny);
    if (Math.abs(vx) > 0.05) this.sprite.setFlipX(vx < 0);
    // wing flap
    this.sprite.scaleY = 0.9 * (0.8 + Math.sin(this.t * 2.2) * 0.2);
  }
}
