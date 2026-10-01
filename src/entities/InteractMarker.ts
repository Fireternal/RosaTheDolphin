import Phaser from 'phaser';
import { DEPTH, FONT_TITLE, FONT_UI, GOLD, GOLD_CSS } from '../config';
import { damp } from '../core/util';

export type MarkerState = 'hidden' | 'near' | 'active';

/**
 * A floating "E" key-cap shown in the world above anything Rosa can interact with.
 * - near:   a small pulsing key-cap invites her to come closer
 * - active: in range — full key-cap plus the action ("ESCUCHAR", "HABLAR"…)
 */
export class InteractMarker {
  private c: Phaser.GameObjects.Container;
  private glow: Phaser.GameObjects.Image;
  private label: Phaser.GameObjects.Text;
  private state: MarkerState = 'hidden';
  private alpha = 0;
  private scale = 0.6;
  private t = Math.random() * 10;

  constructor(scene: Phaser.Scene) {
    this.glow = scene.add.image(0, 0, 'glow').setTint(GOLD).setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0.55);
    const cap = scene.add.graphics();
    cap.fillStyle(0x04142e, 0.85);
    cap.fillRoundedRect(-30, -30, 60, 60, 14);
    cap.lineStyle(3, GOLD, 1);
    cap.strokeRoundedRect(-30, -30, 60, 60, 14);
    cap.lineStyle(2, 0xfff2c8, 0.35);
    cap.lineBetween(-20, -22, 20, -22);
    const key = scene.add.text(0, 1, 'E', { fontFamily: FONT_TITLE, fontSize: '36px', color: '#fff3d6', fontStyle: 'bold' }).setOrigin(0.5);
    this.label = scene.add.text(0, 50, '', { fontFamily: FONT_UI, fontSize: '22px', color: GOLD_CSS, stroke: '#031026', strokeThickness: 5 })
      .setOrigin(0.5, 0).setLetterSpacing(3);
    this.c = scene.add.container(0, 0, [this.glow, cap, key, this.label]).setDepth(DEPTH.FG_FX + 2).setAlpha(0).setScale(0.6);
  }

  set(state: MarkerState, x: number, y: number, text: string, dt: number): void {
    this.t += dt;
    this.state = state;
    if (state === 'active' && this.label.text !== text) this.label.setText(text);
    const targetA = state === 'active' ? 1 : state === 'near' ? 0.6 : 0;
    const targetS = state === 'active' ? 1 : 0.62;
    this.alpha += (targetA - this.alpha) * damp(10, dt);
    this.scale += (targetS - this.scale) * damp(10, dt);
    const pulse = state === 'near' ? 1 + Math.sin(this.t * 4) * 0.08 : 1;
    this.c.setPosition(x, y + Math.sin(this.t * 2.6) * 7);
    this.c.setScale(this.scale * pulse);
    this.c.setAlpha(this.alpha);
    this.c.setVisible(this.alpha > 0.02);
    this.label.setAlpha(state === 'active' ? 1 : 0);
    this.glow.setAlpha(0.35 + Math.sin(this.t * 3) * 0.15);
  }

  get current(): MarkerState {
    return this.state;
  }

  destroy(): void {
    this.c.destroy();
  }
}
