import Phaser from 'phaser';
import { DEPTH } from '../config';
import { AudioManager } from './AudioManager';

export interface SonarTarget {
  x: number;
  y: number;
  /** Optional extra reach for big objects. */
  reach?: number;
  onSonar: (pulse: { x: number; y: number }) => void;
}

interface Pulse {
  x: number;
  y: number;
  t: number;
  dur: number;
  maxR: number;
  hit: Set<SonarTarget>;
  heads: { a: number; line: number }[];
  seed: number;
}

/**
 * Musical sonar: an expanding wave drawn as a curved five-line staff carrying
 * little note heads. Whatever the wavefront touches gets notified.
 */
export class SonarSystem {
  private pulses: Pulse[] = [];
  private targets = new Set<SonarTarget>();
  private g: Phaser.GameObjects.Graphics;
  readonly cooldownTime = 1.2;
  cooldown = 0;
  readonly radius = 760;

  constructor(private scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.SONAR).setBlendMode(Phaser.BlendModes.ADD);
  }

  add(t: SonarTarget): SonarTarget {
    this.targets.add(t);
    return t;
  }

  remove(t: SonarTarget): void {
    this.targets.delete(t);
  }

  get ready(): boolean {
    return this.cooldown <= 0;
  }

  emit(x: number, y: number): boolean {
    if (this.cooldown > 0) return false;
    this.cooldown = this.cooldownTime;
    const heads: { a: number; line: number }[] = [];
    for (let i = 0; i < 14; i++) heads.push({ a: Math.random() * Math.PI * 2, line: Math.floor(Math.random() * 5) });
    this.pulses.push({ x, y, t: 0, dur: 1.25, maxR: this.radius, hit: new Set(), heads, seed: Math.random() * 10 });
    AudioManager.sonar();
    // a small inner flash
    const flash = this.scene.add.image(x, y, 'glow').setTint(0x9fe8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.SONAR).setScale(0.3).setAlpha(0.9);
    this.scene.tweens.add({ targets: flash, scale: 2.2, alpha: 0, duration: 600, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() });
    return true;
  }

  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    const g = this.g;
    g.clear();
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      const r = p.maxR * (1 - Math.pow(1 - k, 2.4));
      const alpha = (1 - k) * 0.95;

      // detect targets touched by the wavefront
      for (const t of this.targets) {
        if (p.hit.has(t)) continue;
        const d = Math.hypot(t.x - p.x, t.y - p.y) - (t.reach ?? 0);
        if (d <= r) {
          p.hit.add(t);
          t.onSonar({ x: p.x, y: p.y });
        }
      }

      // five wavy staff lines
      const segs = 96;
      for (let line = 0; line < 5; line++) {
        const lr = r - line * 9;
        if (lr <= 4) continue;
        g.lineStyle(line === 2 ? 2.4 : 1.6, line % 2 ? 0x9fe8ff : 0xd8f6ff, alpha * (line === 2 ? 1 : 0.7));
        g.beginPath();
        for (let s = 0; s <= segs; s++) {
          const a = (s / segs) * Math.PI * 2;
          const wob = Math.sin(a * 6 + p.t * 7 + p.seed) * 5 * (1 - k) + Math.sin(a * 11 - p.t * 5) * 2.5;
          const px = p.x + Math.cos(a) * (lr + wob);
          const py = p.y + Math.sin(a) * (lr + wob);
          if (s === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokePath();
      }
      // note heads riding the staff
      for (const h of p.heads) {
        const hr = r - h.line * 9;
        if (hr <= 10) continue;
        const a = h.a + p.t * 0.25;
        const hx = p.x + Math.cos(a) * hr;
        const hy = p.y + Math.sin(a) * hr;
        g.fillStyle(0xffd36e, alpha);
        g.fillEllipse(hx, hy, 12, 9);
        g.lineStyle(2, 0xffd36e, alpha);
        g.lineBetween(hx + 5, hy, hx + 5, hy - 22);
      }
      if (k >= 1) this.pulses.splice(i, 1);
    }
  }
}
