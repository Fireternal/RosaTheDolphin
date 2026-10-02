import Phaser from 'phaser';
import { centerLayout } from '../core/layout';
import { FONT_TITLE, FONT_UI, GOLD_CSS, WARM_CSS } from '../config';
import { AudioManager } from '../systems/AudioManager';
import { SaveManager } from '../systems/SaveManager';
import { MenuBackdrop } from './MenuBackdrop';

interface Stats {
  time: number;
  thanks: number;
  notes: number;
  /** Problems that were really fixed (the satire's punchline). */
  solved?: number;
}

export class EndingScene extends Phaser.Scene {
  private backdrop!: MenuBackdrop;
  private buttons: Phaser.GameObjects.Text[] = [];
  private index = 0;
  private ready = false;

  constructor() {
    super('EndingScene');
  }

  create(stats: Stats): void {
    centerLayout(this);
    this.buttons = [];
    this.index = 0;
    this.ready = false;
    this.backdrop = new MenuBackdrop(this, true);
    AudioManager.setFullMode(true);
    this.cameras.main.fadeIn(1600, 2, 10, 26);

    const dim = this.add.rectangle(960, 540, 5000, 3000, 0x020a1a, 0.35).setDepth(25);
    void dim;
    const make = (y: number, text: string, size: number, color: string, delay: number, italic = true) => {
      const t = this.add.text(960, y, text, { fontFamily: FONT_TITLE, fontSize: `${size}px`, color, fontStyle: italic ? 'italic' : 'bold', align: 'center' })
        .setOrigin(0.5).setAlpha(0).setDepth(30).setShadow(0, 0, 'rgba(255,180,80,0.6)', 16, true, true);
      this.tweens.add({ targets: t, alpha: 1, y: y - 10, delay, duration: 1200, ease: 'Sine.easeOut' });
      return t;
    };
    make(150, '¡Gracias, Rosa the Dolphin!', 40, WARM_CSS, 400);
    this.add.image(1700, 260, 'logo_cd').setScale(0.3).setDepth(30).setAngle(4);
    make(330, 'MELODÍA I', 58, GOLD_CSS, 1600, false).setLetterSpacing(12);
    make(420, 'LA ROTONDA SUMERGIDA', 74, '#fff3d6', 2400, false).setLetterSpacing(8);
    make(510, 'COMPLETADA', 50, GOLD_CSS, 3200, false).setLetterSpacing(16);

    const mins = Math.floor((stats?.time ?? 0) / 60);
    const secs = Math.floor((stats?.time ?? 0) % 60);
    const info = this.add.text(960, 640,
      `Gracias recibidas: ${stats?.thanks ?? 0}     ·     Notas descubiertas: ${stats?.notes ?? 7} / 7     ·     Tiempo: ${mins}:${String(secs).padStart(2, '0')}`,
      { fontFamily: FONT_UI, fontSize: '22px', color: '#dff3ff' }).setOrigin(0.5).setAlpha(0).setDepth(30);
    this.tweens.add({ targets: info, alpha: 0.9, delay: 4200, duration: 1000 });
    const verdict = this.add.text(960, 700,
      `Problemas resueltos de verdad: ${stats?.solved ?? 0}     ·     Según Rosa: todos`,
      { fontFamily: FONT_TITLE, fontSize: '30px', color: GOLD_CSS, fontStyle: 'italic' }).setOrigin(0.5).setAlpha(0).setDepth(30);
    this.tweens.add({ targets: verdict, alpha: 1, delay: 4800, duration: 1000 });

    const labels = ['VOLVER A JUGAR', 'MENÚ PRINCIPAL'];
    labels.forEach((l, i) => {
      const b = this.add.text(960, 790 + i * 80, l, { fontFamily: FONT_TITLE, fontSize: '40px', color: '#eaf6ff' })
        .setOrigin(0.5).setLetterSpacing(6).setAlpha(0).setDepth(30).setInteractive({ useHandCursor: true });
      b.on('pointerover', () => this.select(i));
      b.on('pointerdown', () => this.activate(i));
      this.buttons.push(b);
      this.tweens.add({ targets: b, alpha: 1, delay: 5600 + i * 200, duration: 800 });
    });
    this.time.delayedCall(5600, () => {
      this.ready = true;
      this.select(0);
    });
    const kb = this.input.keyboard!;
    kb.on('keydown', (e: KeyboardEvent) => {
      if (!this.ready) return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'w' || e.key === 's') this.select(1 - this.index);
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E') this.activate(this.index);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off('keydown'));
  }

  private select(i: number): void {
    if (i !== this.index) AudioManager.uiMove();
    this.index = i;
    this.buttons.forEach((b, k) => b.setColor(k === i ? GOLD_CSS : '#eaf6ff').setScale(k === i ? 1.08 : 1));
  }

  private activate(i: number): void {
    if (!this.ready) return;
    this.ready = false;
    AudioManager.uiSelect();
    this.cameras.main.fadeOut(900, 2, 10, 26);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (i === 0) {
        SaveManager.clear();
        AudioManager.setFullMode(false);
        AudioManager.setLayerCount(0, 2);
        this.scene.start('IntroScene');
      } else {
        AudioManager.setFullMode(false);
        AudioManager.setLayerCount(1, 2);
        this.scene.start('MenuScene');
      }
    });
  }

  update(_t: number, delta: number): void {
    this.backdrop.update(Math.min(delta / 1000, 0.05));
  }
}
