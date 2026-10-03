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

export type IconKind = 'quest' | 'talk' | null;

/**
 * Icon floating over a character: "!" when they have a mission for Rosa, a speech
 * bubble when they only want to chat. Visible from afar so players know where to go.
 */
export class QuestIcon {
  private img: Phaser.GameObjects.Image;
  private kind: IconKind = null;
  private alpha = 0;
  private t = Math.random() * 10;

  constructor(scene: Phaser.Scene) {
    this.img = scene.add.image(0, 0, 'icon_quest').setDepth(DEPTH.FG_FX + 1).setAlpha(0).setVisible(false);
  }

  /** `hidden` while the full "E" key-cap is showing for the same thing. */
  set(kind: IconKind, x: number, y: number, hidden: boolean, dt: number): void {
    this.t += dt;
    if (kind && kind !== this.kind) {
      this.img.setTexture(kind === 'quest' ? 'icon_quest' : 'icon_talk');
      if (kind === 'quest') this.img.setScale(1.4);
    }
    if (kind) this.kind = kind;
    const target = kind && !hidden ? 1 : 0;
    this.alpha += (target - this.alpha) * damp(8, dt);
    const quest = this.kind === 'quest';
    const s = quest ? 0.78 + Math.sin(this.t * 5) * 0.06 : 0.62;
    this.img.setScale(this.img.scaleX + (s - this.img.scaleX) * damp(10, dt));
    this.img.setPosition(x, y + Math.sin(this.t * (quest ? 3.2 : 2)) * (quest ? 9 : 5));
    this.img.setRotation(quest ? Math.sin(this.t * 2.4) * 0.08 : 0);
    this.img.setAlpha(this.alpha);
    this.img.setVisible(this.alpha > 0.02);
  }

  destroy(): void {
    this.img.destroy();
  }
}
