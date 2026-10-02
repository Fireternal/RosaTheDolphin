import Phaser from 'phaser';
import { centerLayout } from '../core/layout';
import { FONT_TITLE } from '../config';
import { AudioManager } from '../systems/AudioManager';

/** Three short lines, then the level begins. Skippable. */
export class IntroScene extends Phaser.Scene {
  private skipping = false;

  constructor() {
    super('IntroScene');
  }

  create(): void {
    centerLayout(this);
    this.skipping = false;
    this.cameras.main.setBackgroundColor('#020a1a');
    const lines = [
      'Hay lugares que guardan su propia melodía.',
      'Pero algunas melodías pueden perderse.',
      'Rosa ha llegado para escuchar.',
    ];
    const notes = [[67], [64], [72]];
    const glow = this.add.image(960, 540, 'glow').setScale(6, 2).setTint(0x1f6fb0).setAlpha(0.25).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.4, duration: 3000, yoyo: true, repeat: -1 });
    const bubbles = this.add.particles(0, 1100, 'bubble', {
      x: { min: -700, max: 2620 }, speedY: { min: -90, max: -40 }, scale: { min: 0.2, max: 0.5 }, alpha: { start: 0.5, end: 0 }, lifespan: 9000, frequency: 260,
    });
    void bubbles;
    lines.forEach((l, i) => {
      const t = this.add.text(960, 540, l, { fontFamily: FONT_TITLE, fontSize: '46px', color: '#e8f4ff', fontStyle: 'italic' })
        .setOrigin(0.5).setAlpha(0).setShadow(0, 0, 'rgba(90,170,255,0.6)', 18, true, true);
      const start = 600 + i * 3300;
      this.tweens.add({ targets: t, alpha: 1, y: 530, delay: start, duration: 1100, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: t, alpha: 0, y: 515, delay: start + 2300, duration: 900, ease: 'Sine.easeIn' });
      this.time.delayedCall(start, () => {
        AudioManager.playMidi('harp', notes[i][0], 1.5, 0.3);
        AudioManager.playMidi('pad', notes[i][0] - 12, 2.5, 0.12);
      });
    });
    const skip = this.add.text(1872, 1036, 'ESPACIO / clic — saltar', { fontFamily: FONT_TITLE, fontSize: '18px', color: '#9fc4e6' }).setOrigin(1, 0.5).setAlpha(0.5);
    void skip;
    this.time.delayedCall(600 + 3 * 3300, () => this.go());
    this.input.keyboard?.once('keydown', () => this.go());
    this.input.once('pointerdown', () => this.go());
    this.cameras.main.fadeIn(800, 2, 10, 26);
  }

  private go(): void {
    if (this.skipping) return;
    this.skipping = true;
    this.cameras.main.fadeOut(900, 2, 10, 26);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('GameScene', { continue: false }));
  }
}
