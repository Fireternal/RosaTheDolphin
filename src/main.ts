import '@fontsource/chewy/400.css';
import Phaser from 'phaser';
import { GAME_H, GAME_W } from './config';
import { BootScene } from './scenes/BootScene';
import { EndingScene } from './scenes/EndingScene';
import { GameScene } from './scenes/GameScene';
import { IntroScene } from './scenes/IntroScene';
import { MenuScene } from './scenes/MenuScene';
import { PreloadScene } from './scenes/PreloadScene';
import { TLPScene } from './scenes/TLPScene';
import { UIScene } from './scenes/UIScene';
import { isDebug } from './core/util';
import { goImmersive, isTouchDevice } from './core/layout';

const game = new Phaser.Game({
  // ?canvas forces the Canvas renderer (useful on machines without GPU acceleration)
  type: /[?&]canvas\b/.test(location.search) ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#03142a',
  // EXPAND: fills any screen shape (no black bars); 1920x1080 is the guaranteed safe area
  scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.CENTER_BOTH, fullscreenTarget: document.documentElement },
  input: { activePointers: 3 },
  render: { antialias: true, powerPreference: 'high-performance' },
  scene: [BootScene, PreloadScene, MenuScene, IntroScene, GameScene, TLPScene, UIScene, EndingScene],
});

// Full screen: corner button or the F key (both are user gestures, as browsers require)
const fsButton = document.getElementById('fullscreen');
const toggleFullscreen = () => {
  if (game.scale.isFullscreen) game.scale.stopFullscreen();
  else game.scale.startFullscreen();
  fsButton?.blur();
};
fsButton?.addEventListener('click', toggleFullscreen);
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyF' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) toggleFullscreen();
});
// on phones, turn to landscape as soon as we are in full screen
game.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, () => {
  const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  o?.lock?.('landscape').catch(() => undefined);
});
// phones: the first tap goes full screen (and landscape) — a game feels right that way
if (isTouchDevice()) {
  window.addEventListener('touchend', () => goImmersive(game), { once: true });
}
game.events.once(Phaser.Core.Events.READY, () => {
  // browsers without the Fullscreen API (e.g. iPhone Safari) get no button
  if (!game.device.fullscreen.available && fsButton) fsButton.style.display = 'none';
});

if (import.meta.env.DEV || isDebug()) {
  (window as unknown as { __ROSA__: Record<string, unknown> }).__ROSA__ = { game };
}
