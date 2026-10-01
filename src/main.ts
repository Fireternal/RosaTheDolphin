import Phaser from 'phaser';
import { GAME_H, GAME_W } from './config';
import { BootScene } from './scenes/BootScene';
import { EndingScene } from './scenes/EndingScene';
import { GameScene } from './scenes/GameScene';
import { IntroScene } from './scenes/IntroScene';
import { MenuScene } from './scenes/MenuScene';
import { PreloadScene } from './scenes/PreloadScene';
import { UIScene } from './scenes/UIScene';
import { isDebug } from './core/util';

const game = new Phaser.Game({
  // ?canvas forces the Canvas renderer (useful on machines without GPU acceleration)
  type: /[?&]canvas\b/.test(location.search) ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#03142a',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true, powerPreference: 'high-performance' },
  scene: [BootScene, PreloadScene, MenuScene, IntroScene, GameScene, UIScene, EndingScene],
});

if (import.meta.env.DEV || isDebug()) {
  (window as unknown as { __ROSA__: Record<string, unknown> }).__ROSA__ = { game };
}
