import Phaser from 'phaser';
import { DEPTH, NOTE_INFO, NOTE_ORDER, NoteName } from '../config';

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

/**
 * Central place for every particle effect: bubbles, golden sparkles,
 * coloured note bursts, splashes and ambient marine snow.
 */
export class ParticleManager {
  private bubbles: Emitter;
  private sparkle: Emitter;
  private noteBursts = new Map<NoteName, Emitter>();
  private splashE: Emitter;
  private hearts: Emitter;
  private glyphs: Emitter;
  private snowZone = new Phaser.Geom.Rectangle(0, 0, 2400, 1600);

  constructor(private scene: Phaser.Scene) {
    this.bubbles = scene.add.particles(0, 0, 'bubble', {
      speed: { min: 10, max: 60 },
      angle: { min: 240, max: 300 },
      scale: { start: 0.35, end: 0.12 },
      alpha: { start: 0.85, end: 0 },
      lifespan: { min: 700, max: 1500 },
      gravityY: -120,
      emitting: false,
    }).setDepth(DEPTH.FX);

    this.sparkle = scene.add.particles(0, 0, 'spark', {
      speed: { min: 40, max: 220 },
      scale: { start: 0.55, end: 0 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 180 },
      lifespan: { min: 500, max: 1100 },
      tint: [0xffe9a6, 0xffd36e, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    }).setDepth(DEPTH.FX);

    for (const n of NOTE_ORDER) {
      this.noteBursts.set(n, scene.add.particles(0, 0, 'softdot', {
        speed: { min: 30, max: 180 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: { min: 500, max: 1000 },
        tint: NOTE_INFO[n].color,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      }).setDepth(DEPTH.FX));
    }

    this.glyphs = scene.add.particles(0, 0, 'glyph', {
      speedY: { min: -90, max: -40 },
      speedX: { min: -40, max: 40 },
      scale: { start: 0.32, end: 0.1 },
      alpha: { start: 1, end: 0 },
      rotate: { min: -20, max: 20 },
      lifespan: { min: 900, max: 1500 },
      tint: [0xffe9a6, 0xffd36e, 0xfff6d8],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    }).setDepth(DEPTH.FX);

    this.splashE = scene.add.particles(0, 0, 'softdot', {
      speed: { min: 120, max: 420 },
      angle: { min: 220, max: 320 },
      scale: { start: 0.5, end: 0.1 },
      alpha: { start: 0.95, end: 0 },
      gravityY: 900,
      lifespan: { min: 500, max: 900 },
      tint: [0xe8fbff, 0xbfefff],
      emitting: false,
    }).setDepth(DEPTH.SURFACE + 1);

    this.hearts = scene.add.particles(0, 0, 'heart', {
      speedY: { min: -80, max: -30 },
      speedX: { min: -50, max: 50 },
      scale: { start: 0.45, end: 0.15 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 1400, max: 2200 },
      tint: [0xff9ab0, 0xffc0cc, 0xffe0a0],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    }).setDepth(DEPTH.FX);

    // ambient marine snow that drifts in front of the camera
    scene.add.particles(0, 0, 'snow', {
      emitZone: { type: 'random', source: this.snowZone, quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      speedX: { min: -8, max: 8 },
      speedY: { min: 4, max: 20 },
      scale: { min: 0.4, max: 1.1 },
      alpha: { start: 0, end: 0.5, ease: 'Sine.easeInOut' },
      lifespan: 7000,
      frequency: 60,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(DEPTH.FX - 1);
  }

  /** Keep ambient emitters spawning around the camera view (particles live in world space). */
  update(cam: Phaser.Cameras.Scene2D.Camera): void {
    const v = cam.worldView;
    this.snowZone.setTo(v.x - 300, v.y - 300, v.width + 600, v.height + 600);
  }

  bubble(x: number, y: number, n = 3): void {
    this.bubbles.explode(n, x, y);
  }

  sparkles(x: number, y: number, n = 16): void {
    this.sparkle.explode(n, x, y);
  }

  note(x: number, y: number, note: NoteName, n = 18): void {
    this.noteBursts.get(note)?.explode(n, x, y);
  }

  glyph(x: number, y: number, n = 1): void {
    this.glyphs.explode(n, x, y);
  }

  splash(x: number, y: number, big = false): void {
    this.splashE.explode(big ? 34 : 16, x, y);
    this.bubbles.explode(big ? 14 : 6, x, y + 30);
  }

  heart(x: number, y: number, n = 6): void {
    this.hearts.explode(n, x, y);
  }

  /** A note glyph that floats up from Rosa, tinted with the note's colour. */
  singNote(x: number, y: number, note: NoteName): void {
    const img = this.scene.add.image(x, y, 'glyph').setScale(0.42).setTint(NOTE_INFO[note].color).setDepth(DEPTH.FX).setBlendMode(Phaser.BlendModes.ADD);
    const glow = this.scene.add.image(x, y, 'glow').setScale(0.4).setTint(NOTE_INFO[note].color).setAlpha(0.6).setDepth(DEPTH.FX - 1).setBlendMode(Phaser.BlendModes.ADD);
    const dx = (Math.random() - 0.5) * 80;
    this.scene.tweens.add({
      targets: [img, glow],
      y: y - 130,
      x: x + dx,
      alpha: 0,
      duration: 1300,
      ease: 'Sine.easeOut',
      onComplete: () => {
        img.destroy();
        glow.destroy();
      },
    });
    this.scene.tweens.add({ targets: img, angle: { from: -12, to: 12 }, duration: 320, yoyo: true, repeat: 2 });
    this.note(x, y, note, 8);
  }
}
