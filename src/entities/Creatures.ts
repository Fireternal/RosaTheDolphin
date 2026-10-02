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

// ---------------------------------------------------------------- Turtle traffic jam

const QUEUE_COMPLAINTS = [
  '¡Llevo dos horas aquí!',
  '¡Avanza, que es pa’ hoy!',
  '¿Esto no lo iban a arreglar?',
  '¡Piii, piiii!',
  'Mi abuela llegaba antes nadando de espaldas…',
  'Otra vez la cola de la rotonda…',
  '¡Que alguien haga algo!',
  'Voy a llegar tarde al trabajo. Otra vez.',
];

interface QueueTurtle {
  s: Phaser.GameObjects.Image;
  u: number;
  phase: number;
  scale: number;
}

/**
 * The famous queues of La Rotonda: dozens of sea turtles stuck in a marine
 * current around the ring. They inch forward and stop, and never get anywhere.
 */
export class TurtleQueue {
  private turtles: QueueTurtle[] = [];
  private t = 0;
  private bubbleT = 2;
  private bubble: Phaser.GameObjects.Text | null = null;

  constructor(
    private scene: Phaser.Scene,
    private cx: number,
    private cy: number,
    private rx: number,
    private ry: number,
    count: number,
  ) {
    for (let i = 0; i < count; i++) {
      const scale = 0.36 + Math.random() * 0.14;
      const key = i % 5 === 3 ? 'turtle_baby' : 'turtle';
      const s = scene.add.image(0, 0, key).setDepth(DEPTH.CREATURES - 2).setScale(key === 'turtle' ? scale : scale * 2);
      this.turtles.push({ s, u: 0.04 + (i / count) * 0.92, phase: Math.random() * 10, scale });
    }
    // a faint current along the queue
    const path = new Phaser.Curves.Ellipse(cx, cy, rx, ry, 10, 170);
    scene.add.particles(0, 0, 'softdot', {
      emitZone: { type: 'random', source: path as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource },
      speedX: { min: 30, max: 70 },
      scaleX: 1.6,
      scaleY: 0.25,
      alpha: { start: 0.35, end: 0 },
      lifespan: 1800,
      frequency: 90,
      tint: 0xcff6ff,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(DEPTH.CREATURES - 3);
  }

  /** Position on the front arc of the ring (u: 0..1, the current flows left to right). */
  private at(u: number): { x: number; y: number; a: number } {
    const a = Phaser.Math.DegToRad(170 - u * 160);
    const x = this.cx + Math.cos(a) * this.rx;
    const y = this.cy + Math.sin(a) * this.ry;
    return { x, y, a };
  }

  update(dt: number, view: Phaser.Geom.Rectangle): void {
    this.t += dt;
    // stop-and-go: everyone creeps a few pixels, then waits… forever
    const go = Math.max(0, Math.sin(this.t * 0.7)) * 0.0009;
    for (const q of this.turtles) {
      q.u = Math.min(0.97, q.u + go * dt * 10);
      const p = this.at(q.u);
      const bob = Math.sin(this.t * 1.7 + q.phase) * 4;
      q.s.setPosition(p.x, p.y + bob);
      q.s.setFlipX(false); // all facing the way the current flows (left to right along the arc)
      q.s.rotation = Math.sin(this.t * 1.3 + q.phase) * 0.06;
    }
    // complaints from turtles that are on screen
    this.bubbleT -= dt;
    if (this.bubbleT <= 0) {
      this.bubbleT = 3 + Math.random() * 3;
      const visible = this.turtles.filter((q) => view.contains(q.s.x, q.s.y));
      if (visible.length) this.say(visible[Math.floor(Math.random() * visible.length)]);
    }
  }

  private say(q: QueueTurtle, text?: string): void {
    this.bubble?.destroy();
    const line = text ?? QUEUE_COMPLAINTS[Math.floor(Math.random() * QUEUE_COMPLAINTS.length)];
    const b = this.scene.add.text(q.s.x, q.s.y - 60, line, {
      fontFamily: '"Trebuchet MS", "Segoe UI", Arial, sans-serif',
      fontSize: '22px',
      color: '#1b2a3a',
      backgroundColor: 'rgba(245,250,255,0.92)',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5, 1).setDepth(DEPTH.FX + 1).setAlpha(0);
    this.bubble = b;
    this.scene.tweens.add({ targets: b, alpha: 1, y: b.y - 10, duration: 250 });
    this.scene.tweens.add({ targets: b, alpha: 0, delay: 2600, duration: 400, onComplete: () => b.destroy() });
  }

  /** Make a specific complaint from the turtle nearest to a point (used by cutscenes). */
  complainNear(x: number, y: number, text: string): void {
    let best = this.turtles[0];
    let bd = Infinity;
    for (const q of this.turtles) {
      const d = Phaser.Math.Distance.Between(x, y, q.s.x, q.s.y);
      if (d < bd) { bd = d; best = q; }
    }
    if (best) this.say(best, text);
  }

  /** Centre of the visible part of the queue (for the camera). */
  get focus(): { x: number; y: number } {
    return this.at(0.5);
  }
}

// ---------------------------------------------------------------- Dolphin pods

export class DolphinPod {
  readonly members: { s: Phaser.GameObjects.Image; hx: number; hy: number; phase: number }[] = [];
  private t = 0;
  private settled = true;

  constructor(private scene: Phaser.Scene, key: 'dolphin_de' | 'dolphin_local', homes: { x: number; y: number }[], start?: { x: number; y: number }) {
    for (const h of homes) {
      const s = scene.add.image(start?.x ?? h.x, start?.y ?? h.y, key).setDepth(DEPTH.CREATURES).setScale(0.9 + Math.random() * 0.25);
      this.members.push({ s, hx: h.x, hy: h.y, phase: Math.random() * 10 });
    }
    if (start) this.settled = false;
  }

  /** Swim from the start point, through a waypoint, to each member's home. */
  arrive(via: { x: number; y: number }, onDone?: () => void): void {
    this.members.forEach((m, i) => {
      m.s.setFlipX(m.hx < m.s.x);
      this.scene.tweens.add({
        targets: m.s, x: via.x + (Math.random() - 0.5) * 80, y: via.y + (Math.random() - 0.5) * 80,
        delay: i * 160, duration: 1500, ease: 'Sine.easeInOut',
        onComplete: () => {
          m.s.setFlipX(m.hx < m.s.x);
          this.scene.tweens.add({ targets: m.s, x: m.hx, y: m.hy, duration: 1300, ease: 'Sine.easeOut' });
        },
      });
    });
    this.scene.time.delayedCall(this.members.length * 160 + 2900, () => {
      this.settled = true;
      onDone?.();
    });
  }

  /** Move the whole pod's homes (e.g. locals being pushed out). */
  shift(dx: number, dy: number): void {
    for (const m of this.members) {
      m.hx += dx;
      m.hy += dy;
      this.scene.tweens.add({ targets: m.s, x: m.hx, y: m.hy, duration: 1600, ease: 'Sine.easeInOut' });
    }
  }

  update(dt: number): void {
    this.t += dt;
    if (!this.settled) return;
    for (const m of this.members) {
      m.s.y = m.hy + Math.sin(this.t * 1.6 + m.phase) * 6;
      m.s.x = m.hx + Math.sin(this.t * 0.7 + m.phase) * 10;
      m.s.rotation = Math.sin(this.t * 1.6 + m.phase) * 0.06;
      m.s.setFlipX(Math.cos(this.t * 0.7 + m.phase) < 0);
    }
  }
}
