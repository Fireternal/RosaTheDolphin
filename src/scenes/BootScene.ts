import Phaser from 'phaser';

/** Minimal boot: sets up global behaviour and hands over to the preloader. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.input.keyboard?.addCapture(['SPACE', 'UP', 'DOWN', 'LEFT', 'RIGHT']);
    this.scene.start('PreloadScene');
  }
}
