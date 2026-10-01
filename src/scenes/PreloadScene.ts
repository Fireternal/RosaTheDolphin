import Phaser from 'phaser';
import { FONT_TITLE, GOLD_CSS } from '../config';
import { makeCreatureTextures } from '../art/CreatureArt';
import { makeEnvTextures } from '../art/EnvArt';
import { makeFxTextures } from '../art/FxArt';
import { makeRosaTextures } from '../art/RosaArt';

/**
 * Every asset of this vertical slice is generated procedurally, so the game runs
 * with no image or audio files. Real art can later be loaded here with the same keys.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  create(): void {
    const t = this.add.text(960, 540, 'Afinando el océano…', { fontFamily: FONT_TITLE, fontSize: '34px', color: GOLD_CSS, fontStyle: 'italic' }).setOrigin(0.5);
    this.tweens.add({ targets: t, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
    // let the text render one frame before the (synchronous) texture generation
    this.time.delayedCall(50, () => {
      makeFxTextures(this);
      makeRosaTextures(this);
      makeCreatureTextures(this);
      makeEnvTextures(this);
      this.scene.start('MenuScene');
    });
  }
}
