import Phaser from 'phaser';
import { DEPTH, FONT_TITLE, NOTE_INFO, NoteName } from '../config';
import { wait } from '../core/util';
import { AudioManager } from './AudioManager';
import { MusicSequence, SequenceResult } from './MusicSequence';

export interface MusicPuzzleConfig {
  id: string;
  label: string;
  /** Where the player must be to start it. */
  x: number;
  y: number;
  radius: number;
  /** Where the melody visibly "comes from" (glyphs pop there). */
  sourceX: number;
  sourceY: number;
  notes: NoteName[];
  /** Tempo of the demo, ms between notes. */
  interval?: number;
  inst?: 'bell' | 'flute' | 'harp' | 'piano';
}

/**
 * A musical puzzle: an object of the world "sings" a short melody, the player
 * listens, remembers and plays it back. Wrong answers are never punished.
 */
export class MusicPuzzle {
  readonly sequence: MusicSequence;
  solved = false;
  demoPlaying = false;
  private demoToken = 0;

  constructor(private scene: Phaser.Scene, readonly cfg: MusicPuzzleConfig) {
    this.sequence = new MusicSequence(cfg.notes);
  }

  get id(): string {
    return this.cfg.id;
  }

  /** Plays the melody with visuals. `onNote` lets the HUD light the matching slot. */
  async playDemo(onNote?: (index: number, note: NoteName) => void): Promise<void> {
    const token = ++this.demoToken;
    this.demoPlaying = true;
    this.sequence.reset();
    const interval = this.cfg.interval ?? 620;
    await wait(this.scene, 350);
    for (let i = 0; i < this.cfg.notes.length; i++) {
      if (token !== this.demoToken) return;
      const n = this.cfg.notes[i];
      AudioManager.playNote(n, { inst: this.cfg.inst ?? 'bell', vel: 0.55, dur: 0.45 });
      this.popGlyph(n, i);
      onNote?.(i, n);
      await wait(this.scene, interval);
    }
    if (token === this.demoToken) this.demoPlaying = false;
  }

  cancelDemo(): void {
    this.demoToken++;
    this.demoPlaying = false;
  }

  input(note: NoteName): SequenceResult {
    return this.sequence.input(note);
  }

  private popGlyph(n: NoteName, i: number): void {
    const { sourceX, sourceY } = this.cfg;
    const color = NOTE_INFO[n].color;
    const x = sourceX + (i - (this.cfg.notes.length - 1) / 2) * 46;
    const y = sourceY;
    const glow = this.scene.add.image(x, y, 'glow').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.FX).setScale(0.2).setAlpha(0.9);
    const g = this.scene.add.image(x, y, 'glyph').setTint(color).setDepth(DEPTH.FX).setScale(0.1).setBlendMode(Phaser.BlendModes.ADD);
    const label = this.scene.add.text(x, y + 34, n, { fontFamily: FONT_TITLE, fontSize: '22px', color: NOTE_INFO[n].css, stroke: '#04122a', strokeThickness: 4 })
      .setOrigin(0.5).setDepth(DEPTH.FX).setAlpha(0);
    this.scene.tweens.add({ targets: g, scale: 0.5, duration: 260, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: glow, scale: 0.75, duration: 300, ease: 'Sine.easeOut' });
    this.scene.tweens.add({ targets: label, alpha: 1, duration: 200 });
    this.scene.tweens.add({
      targets: [g, glow, label],
      y: `-=${60}`,
      alpha: 0,
      delay: 700,
      duration: 900,
      ease: 'Sine.easeIn',
      onComplete: () => {
        g.destroy();
        glow.destroy();
        label.destroy();
      },
    });
  }
}
