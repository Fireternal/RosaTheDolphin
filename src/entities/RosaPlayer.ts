import Phaser from 'phaser';
import { DEPTH } from '../config';
import { angleLerp, clamp, damp } from '../core/util';
import { SwimEvents, SwimInput, SwimmingController, SwimWorld } from './SwimmingController';

interface Strand {
  /** root offset in body-local coordinates (texture centre = 0,0, nose to +x) */
  rx: number;
  ry: number;
  /** rest direction in body-local space (radians, PI = straight back) */
  dir: number;
  /** how much the strand curls down along the body (local units per segment) */
  droop: number;
  seg: number;
  pts: Phaser.Math.Vector2[];
  prev: Phaser.Math.Vector2[];
  width: number;
  color: number;
  alpha: number;
  front: boolean;
  phase: number;
}

/**
 * Rosa: dolphin body + animated tail + fin + swinging treble-clef pendant,
 * and a long blond mane simulated as verlet chains rendered as tapered ribbons.
 */
export class RosaPlayer {
  readonly ctrl: SwimmingController;
  readonly container: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Image;
  private fluke: Phaser.GameObjects.Image;
  private fin: Phaser.GameObjects.Image;
  private pendant: Phaser.GameObjects.Image;
  private pendantGlow: Phaser.GameObjects.Image;
  private hairBack: Phaser.GameObjects.Graphics;
  private hairFront: Phaser.GameObjects.Graphics;
  private strands: Strand[] = [];
  private angle = 0;
  private visScale = 1;
  private tailPhase = 0;
  private time = 0;
  private bob = 0;
  private hairAcc = 0;
  controlEnabled = true;
  /** Visual scale of the whole character. */
  readonly scale: number;

  constructor(scene: Phaser.Scene, x: number, y: number, scale = 0.82) {
    this.scale = scale;
    this.ctrl = new SwimmingController(x, y);
    this.hairBack = scene.add.graphics().setDepth(DEPTH.HAIR_BACK);
    this.fluke = scene.add.image(-134, 4, 'rosa_fluke').setOrigin(0.97, 0.5);
    this.body = scene.add.image(0, 0, 'rosa_body');
    this.fin = scene.add.image(36, 20, 'rosa_fin').setOrigin(0.08, 0.1);
    this.pendantGlow = scene.add.image(56, 72, 'glow').setScale(0.22).setTint(0xffd36e).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
    this.pendant = scene.add.image(56, 34, 'rosa_pendant').setOrigin(0.5, 0.02);
    this.container = scene.add.container(x, y, [this.fluke, this.body, this.fin, this.pendantGlow, this.pendant]);
    this.container.setDepth(DEPTH.ROSA).setScale(scale);
    this.hairFront = scene.add.graphics().setDepth(DEPTH.HAIR_FRONT);
    this.buildHair();
  }

  private buildHair(): void {
    type Def = Omit<Strand, 'pts' | 'prev'>;
    const defs: Def[] = [];
    const back = [0xa86d1f, 0xb87c27, 0xc48a30, 0xae7424, 0xc99437];
    const front = [0xeec25a, 0xf7d270, 0xffdf86, 0xe9b94e, 0xffe8a6];
    // under layer: deeper gold, long, lies along the back
    for (let i = 0; i < 5; i++) {
      defs.push({ rx: 78 - i * 8, ry: -40 + i * 1.2, dir: Math.PI - 0.1 - i * 0.03, droop: 1.6 + i * 0.3, seg: 24 + i, width: 30 - i * 2, color: back[i], alpha: 1, front: false, phase: i * 0.8 });
    }
    // top layer: bright blond waves flowing over the back
    for (let i = 0; i < 5; i++) {
      defs.push({ rx: 88 - i * 8, ry: -42 + i * 1.5, dir: Math.PI - 0.16 - i * 0.02, droop: 1.2 + i * 0.35, seg: 21 + i * 1.2, width: 25 - i * 2, color: front[i], alpha: 1, front: true, phase: 2.1 + i * 0.9 });
    }
    // fine highlights
    defs.push({ rx: 84, ry: -44, dir: Math.PI - 0.2, droop: 1.1, seg: 21, width: 5, color: 0xfff4cc, alpha: 0.9, front: true, phase: 4.2 });
    defs.push({ rx: 70, ry: -42, dir: Math.PI - 0.12, droop: 1.8, seg: 23, width: 4, color: 0xfff0b8, alpha: 0.75, front: true, phase: 5.3 });
    // a soft fringe that falls beside the eye
    defs.push({ rx: 98, ry: -36, dir: 2.45, droop: 0.4, seg: 11, width: 15, color: 0xf9d677, alpha: 1, front: true, phase: 1.3 });

    for (const d of defs) {
      const count = d.seg < 14 ? 4 : 10;
      const pts: Phaser.Math.Vector2[] = [];
      const prev: Phaser.Math.Vector2[] = [];
      for (let k = 0; k < count; k++) {
        const p = this.restPoint(d, k);
        pts.push(p);
        prev.push(p.clone());
      }
      this.strands.push({ ...d, pts, prev });
    }
  }

  /** Rest position of point k of a strand, in world space. */
  private restPoint(d: { rx: number; ry: number; dir: number; droop: number; seg: number }, k: number): Phaser.Math.Vector2 {
    const lx = d.rx + Math.cos(d.dir) * d.seg * k;
    const ly = d.ry + Math.sin(d.dir) * d.seg * k + d.droop * k * k * 0.16;
    return this.localToWorld(lx, ly);
  }

  get x(): number {
    return this.ctrl.x;
  }
  get y(): number {
    return this.ctrl.y;
  }

  /** Transform a body-local point (texture space centred, nose +x) to world space. */
  localToWorld(lx: number, ly: number): Phaser.Math.Vector2 {
    const s = this.scale;
    const sx = lx * this.visScale * s;
    const sy = ly * s;
    const c = Math.cos(this.angle);
    const sn = Math.sin(this.angle);
    return new Phaser.Math.Vector2(this.container.x + sx * c - sy * sn, this.container.y + sx * sn + sy * c);
  }

  /** World position of the mouth / rostrum tip (notes are "sung" from here). */
  mouth(): Phaser.Math.Vector2 {
    return this.localToWorld(140, 12);
  }

  tail(): Phaser.Math.Vector2 {
    return this.localToWorld(-150, 4);
  }

  teleport(x: number, y: number): void {
    this.ctrl.x = x;
    this.ctrl.y = y;
    this.ctrl.vx = 0;
    this.ctrl.vy = 0;
    this.ctrl.airborne = false;
    this.container.setPosition(x, y);
    for (const s of this.strands) {
      s.pts.forEach((p, k) => {
        p.copy(this.restPoint(s, k));
        s.prev[k].copy(p);
      });
    }
  }

  setDepth(base: number): void {
    this.hairBack.setDepth(base - 1);
    this.container.setDepth(base);
    this.hairFront.setDepth(base + 1);
  }

  update(dt: number, input: SwimInput, world: SwimWorld): SwimEvents {
    this.time += dt;
    const inp = this.controlEnabled ? input : { x: 0, y: 0, sprint: false, boost: false };
    const ev = this.ctrl.update(dt, inp, world);
    this.updateVisuals(dt);
    return ev;
  }

  /** Drives visuals without physics (menu / cutscenes). */
  updateVisuals(dt: number): void {
    const c = this.ctrl;
    const sp = c.speed;
    const s01 = c.speed01;

    // facing flip with a quick squash through zero
    this.visScale += (c.facing - this.visScale) * damp(11, dt);
    if (Math.abs(this.visScale) < 0.08) this.visScale = 0.08 * (c.facing || 1);

    // body angle follows velocity
    let target = 0;
    if (sp > 50 || c.airborne) {
      target = c.facing > 0 ? Math.atan2(c.vy, c.vx) : Math.atan2(-c.vy, -c.vx);
      const lim = c.airborne ? 1.5 : 1.15;
      target = clamp(target, -lim, lim);
    }
    // idle: gentle breathing tilt
    if (sp < 50 && !c.airborne) target += Math.sin(this.time * 1.4) * 0.05;
    this.angle = angleLerp(this.angle, target, damp(c.airborne ? 9 : 6, dt));

    this.tailPhase += dt * (2.6 + s01 * 11 + (c.boostTimer > 0 ? 8 : 0));
    const amp = 0.14 + s01 * 0.32 + (c.boostTimer > 0 ? 0.15 : 0);
    this.fluke.rotation = Math.sin(this.tailPhase) * amp;
    this.fluke.y = 4 + Math.sin(this.tailPhase - 0.6) * amp * 14;
    this.body.y = Math.sin(this.tailPhase - 1.2) * amp * 3;
    this.fin.rotation = Math.sin(this.tailPhase * 0.5 + 1) * 0.18 + 0.1;

    this.bob = sp < 60 && !c.airborne ? Math.sin(this.time * 1.8) * 5 : this.bob * 0.9;
    this.container.setPosition(c.x, c.y + this.bob);
    this.container.rotation = this.angle;
    this.container.scaleX = this.visScale * this.scale;
    this.container.scaleY = this.scale * (1 + Math.sin(this.tailPhase * 2) * 0.01);

    // pendant hangs toward world-down and swings with motion
    const worldDown = Math.PI / 2;
    const bodyRot = this.angle;
    const local = (worldDown - bodyRot) - Math.PI / 2;
    const swing = Math.sin(this.time * 2.3) * 0.12 - c.vx * 0.0004 * Math.sign(this.visScale);
    this.pendant.rotation = (local + swing) * Math.sign(this.visScale);
    const pr = this.pendant.rotation;
    this.pendantGlow.setPosition(56 - Math.sin(pr) * 38, 34 + Math.cos(pr) * 38);
    this.pendantGlow.setAlpha(0.35 + Math.sin(this.time * 3) * 0.12);

    this.updateHair(dt);
  }

  private updateHair(dt: number): void {
    // fixed 60 Hz sub-steps keep the verlet chains stable at any frame rate
    this.hairAcc = Math.min(this.hairAcc + dt, 0.1);
    let steps = 0;
    while (this.hairAcc >= 1 / 60 && steps < 6) {
      this.hairAcc -= 1 / 60;
      this.hairStep(steps);
      steps++;
    }
    this.drawHair();
  }

  private hairStep(sub: number): void {
    const c = this.ctrl;
    const inAir = c.airborne;
    const ux = Math.sin(this.angle);
    const uy = -Math.cos(this.angle);
    const tt = this.time - sub / 60;

    for (const s of this.strands) {
      const root = this.localToWorld(s.rx, s.ry);
      s.pts[0].copy(root);
      s.prev[0].copy(root);
      const segLen = s.seg * this.scale;
      for (let k = 1; k < s.pts.length; k++) {
        const p = s.pts[k];
        const pv = s.prev[k];
        const vx = (p.x - pv.x) * (inAir ? 0.97 : 0.9);
        const vy = (p.y - pv.y) * (inAir ? 0.97 : 0.9);
        pv.copy(p);
        const rest = this.restPoint(s, k);
        // underwater the hair floats a little; in the air it falls
        const float = inAir ? 0 : -k * 0.9;
        const wave = Math.sin(tt * (2 + c.speed01 * 3.5) - k * 0.6 + s.phase) * (0.8 + k * 0.45) * (0.5 + c.speed01 * 1.2);
        const pull = inAir ? 0.02 : 0.07;
        p.x += vx + (rest.x - p.x) * pull + ux * wave * 0.3;
        p.y += vy + (rest.y + float - p.y) * pull + uy * wave * 0.3 + (inAir ? 0.9 : 0);
      }
      for (let it = 0; it < 2; it++) {
        for (let k = 1; k < s.pts.length; k++) {
          const a = s.pts[k - 1];
          const b = s.pts[k];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.0001;
          const diff = (d - segLen) / d;
          b.x -= dx * diff;
          b.y -= dy * diff;
        }
      }
    }
  }

  private drawHair(): void {
    this.hairBack.clear();
    this.hairFront.clear();
    for (const s of this.strands) {
      const g = s.front ? this.hairFront : this.hairBack;
      const curve = new Phaser.Curves.Spline(s.pts.map((p) => new Phaser.Math.Vector2(p.x, p.y)));
      const n = s.pts.length * 4;
      const pts = curve.getPoints(n);
      const left: Phaser.Math.Vector2[] = [];
      const right: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)];
        const b = pts[Math.min(pts.length - 1, i + 1)];
        let nx = -(b.y - a.y);
        let ny = b.x - a.x;
        const l = Math.hypot(nx, ny) || 1;
        nx /= l;
        ny /= l;
        const t = i / (pts.length - 1);
        // taper with a soft bulge near the root
        const w = s.width * this.scale * (0.6 + Math.sin(Math.min(1, t * 4) * Math.PI * 0.5) * 0.4) * Math.pow(1 - t, 0.7) * 0.5 + 0.6;
        left.push(new Phaser.Math.Vector2(pts[i].x + nx * w, pts[i].y + ny * w));
        right.push(new Phaser.Math.Vector2(pts[i].x - nx * w, pts[i].y - ny * w));
      }
      g.fillStyle(s.color, s.alpha);
      g.fillPoints([...left, ...right.reverse()], true);
      // shadow side line for definition
      if (!s.front || s.width > 6) {
        g.lineStyle(1.2, 0x7a4f12, 0.35);
        g.strokePoints(left.slice(0, Math.floor(left.length * 0.8)), false);
      }
    }
  }

  setVisible(v: boolean): void {
    this.container.setVisible(v);
    this.hairBack.setVisible(v);
    this.hairFront.setVisible(v);
  }

  destroy(): void {
    this.container.destroy();
    this.hairBack.destroy();
    this.hairFront.destroy();
  }
}
