import Phaser from 'phaser';
import { DEPTH, GOLD, NOTE_INFO, NoteName } from '../config';
import type { FragmentSpot } from '../level/RotondaData';

/**
 * One of the seven fragments of the lost melody: a golden note inside a halo
 * of curved staff lines. Each fragment holds one note of the final melody.
 */
export class MelodyFragment {
  collected = false;
  revealed: boolean;
  /** Spawned = present in the world (some appear only after an event). */
  spawned: boolean;
  readonly container: Phaser.GameObjects.Container;
  private glow: Phaser.GameObjects.Image;
  private glyph: Phaser.GameObjects.Image;
  private staff: Phaser.GameObjects.Graphics;
  private beam?: Phaser.GameObjects.Image;
  private t = Math.random() * 10;
  x: number;
  y: number;

  constructor(private scene: Phaser.Scene, readonly spot: FragmentSpot, readonly note: NoteName) {
    this.x = spot.x;
    this.y = spot.y;
    this.revealed = spot.kind !== 'hidden';
    this.spawned = !spot.spawnsOn;
    const tint = NOTE_INFO[note].color;
    this.glow = scene.add.image(0, 0, 'glow').setTint(GOLD).setBlendMode(Phaser.BlendModes.ADD).setScale(0.95);
    const inner = scene.add.image(0, 0, 'glow').setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setAlpha(0.8);
    this.staff = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.glyph = scene.add.image(0, 0, 'glyph2').setTint(0xffe7a0).setScale(0.62);
    this.container = scene.add.container(spot.x, spot.y, [this.glow, inner, this.staff, this.glyph]).setDepth(DEPTH.ITEMS + 2);
    if (spot.kind === 'leap') {
      // a column of light rising from the water hints at a fragment above the waves
      this.beam = scene.add.image(spot.x, 40, 'ray').setOrigin(0.5, 1).setScale(0.6, 0.5).setFlipY(true)
        .setTint(0xffe7a0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.25).setDepth(DEPTH.RAYS + 1);
    }
    if (!this.revealed || !this.spawned) this.container.setAlpha(0).setVisible(this.spawned);
  }

  reveal(): void {
    if (this.revealed || this.collected) return;
    this.revealed = true;
    this.container.setVisible(true);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 800, ease: 'Sine.easeOut' });
    this.scene.tweens.add({ targets: this.container, scale: { from: 1.5, to: 1 }, duration: 900, ease: 'Elastic.easeOut' });
  }

  /** Appear (e.g. rising out of the clam, or given by a creature). */
  spawn(fromX?: number, fromY?: number): void {
    if (this.spawned || this.collected) return;
    this.spawned = true;
    this.revealed = true;
    this.container.setVisible(true).setAlpha(0).setScale(0.3);
    if (fromX !== undefined && fromY !== undefined) this.container.setPosition(fromX, fromY);
    this.scene.tweens.add({ targets: this.container, alpha: 1, scale: 1, x: this.x, y: this.y, duration: 1400, ease: 'Sine.easeOut' });
  }

  update(dt: number, hintAlpha: number): void {
    if (this.collected) return;
    this.t += dt;
    const bob = Math.sin(this.t * 1.7) * 10;
    this.glyph.y = bob;
    this.glyph.angle = Math.sin(this.t * 1.3) * 6;
    this.glow.setScale(0.9 + Math.sin(this.t * 2.4) * 0.08);
    // rotating halo of staff lines
    const g = this.staff;
    g.clear();
    for (let l = 0; l < 5; l++) {
      g.lineStyle(1.6, l === 2 ? 0xfff0b8 : 0xffd36e, 0.55);
      g.beginPath();
      const r = 58 + l * 6;
      const a0 = this.t * 0.8 + l * 0.15;
      for (let s = 0; s <= 30; s++) {
        const a = a0 + (s / 30) * Math.PI * 1.3;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r * 0.55 + bob * 0.3;
        if (s === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
    }
    if (this.spawned && !this.revealed) {
      this.container.setVisible(true);
      this.container.setAlpha(hintAlpha * 0.18 * (0.5 + 0.5 * Math.sin(this.t * 4)));
    }
    if (this.beam) this.beam.setAlpha(0.18 + Math.sin(this.t * 1.5) * 0.08);
  }

  get collectable(): boolean {
    return this.spawned && this.revealed && !this.collected;
  }

  collect(): void {
    this.collected = true;
    this.beam?.destroy();
    this.scene.tweens.add({ targets: this.container, scale: 1.8, alpha: 0, duration: 600, ease: 'Cubic.easeOut', onComplete: () => this.container.destroy() });
  }
}
