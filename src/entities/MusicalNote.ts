import Phaser from 'phaser';
import { DEPTH, FONT_TITLE, NOTE_INFO, NoteName } from '../config';
import { mixColor } from '../core/util';

/**
 * A loose note glowing in the world. Collecting it adds the note to Rosa's
 * repertoire (keys 1-7) and a small voice to the ambient music.
 * Hidden notes are invisible until the sonar touches them.
 */
export class MusicalNote {
  collected = false;
  revealed: boolean;
  private glow: Phaser.GameObjects.Image;
  private glyph: Phaser.GameObjects.Image;
  private label: Phaser.GameObjects.Text;
  private ring: Phaser.GameObjects.Image;
  private t = Math.random() * 10;

  constructor(private scene: Phaser.Scene, readonly note: NoteName, readonly x: number, readonly y: number, readonly hidden = false) {
    this.revealed = !hidden;
    const c = NOTE_INFO[note].color;
    this.glow = scene.add.image(x, y, 'glow').setTint(c).setBlendMode(Phaser.BlendModes.ADD).setScale(0.7).setDepth(DEPTH.ITEMS);
    this.ring = scene.add.image(x, y, 'ring').setTint(c).setBlendMode(Phaser.BlendModes.ADD).setScale(1.1).setAlpha(0.5).setDepth(DEPTH.ITEMS);
    this.glyph = scene.add.image(x, y, 'glyph').setTint(mixColor(c, 0xffffff, 0.35)).setScale(0.5).setDepth(DEPTH.ITEMS + 1);
    this.label = scene.add.text(x, y + 44, note, { fontFamily: FONT_TITLE, fontSize: '20px', color: NOTE_INFO[note].css, stroke: '#031026', strokeThickness: 4 })
      .setOrigin(0.5).setDepth(DEPTH.ITEMS + 1);
    if (hidden) this.setAlpha(0);
  }

  private setAlpha(a: number): void {
    this.glow.setAlpha(a * 0.8);
    this.glyph.setAlpha(a);
    this.label.setAlpha(a * 0.9);
    this.ring.setAlpha(a * 0.5);
  }

  reveal(): void {
    if (this.revealed || this.collected) return;
    this.revealed = true;
    this.scene.tweens.addCounter({ from: 0, to: 1, duration: 700, ease: 'Sine.easeOut', onUpdate: (tw) => this.setAlpha(tw.getValue() ?? 1) });
    this.pulse();
  }

  /** Sonar response: a vibration and a brighter shine. */
  pulse(): void {
    if (this.collected) return;
    this.scene.tweens.add({ targets: this.glow, scale: { from: 1.1, to: 0.55 }, duration: 700, ease: 'Cubic.easeOut' });
    this.scene.tweens.add({ targets: this.glyph, angle: { from: -16, to: 0 }, duration: 600, ease: 'Elastic.easeOut' });
  }

  update(dt: number, hintAlpha: number): void {
    if (this.collected) return;
    this.t += dt;
    const bob = Math.sin(this.t * 2) * 8;
    this.glyph.y = this.y + bob;
    this.glow.y = this.y + bob;
    this.ring.y = this.y + bob;
    this.label.y = this.y + 44 + bob;
    this.glyph.angle = Math.sin(this.t * 1.6) * 8;
    this.ring.setScale(1.1 + ((this.t * 0.6) % 1) * 0.8);
    if (this.revealed) {
      this.ring.setAlpha(0.5 * (1 - ((this.t * 0.6) % 1)));
      this.glow.setScale(0.65 + Math.sin(this.t * 3) * 0.08);
      this.glow.setAlpha(0.85);
    } else {
      // a faint shimmer hints that something hums here
      const a = hintAlpha * (0.5 + 0.5 * Math.sin(this.t * 4));
      this.glow.setAlpha(a * 0.35);
      this.glyph.setAlpha(0);
      this.label.setAlpha(0);
      this.ring.setAlpha(0);
    }
  }

  collect(): void {
    this.collected = true;
    this.scene.tweens.add({ targets: [this.glyph, this.label], scale: '*=1.6', alpha: 0, duration: 380, ease: 'Back.easeIn' });
    this.scene.tweens.add({ targets: [this.glow, this.ring], scale: 2.2, alpha: 0, duration: 500, ease: 'Cubic.easeOut' });
    this.scene.time.delayedCall(600, () => this.destroy());
  }

  destroy(): void {
    this.glow.destroy();
    this.glyph.destroy();
    this.label.destroy();
    this.ring.destroy();
  }
}
