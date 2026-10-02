import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';

/**
 * The canvas expands to fill any screen shape (Scale.EXPAND). Scenes designed for
 * 1920x1080 keep that layout centred by scrolling their camera; `onChange`
 * receives the extra margins so edge-anchored UI can hug the real screen edges.
 */
export function centerLayout(scene: Phaser.Scene, onChange?: (offX: number, offY: number) => void): void {
  const apply = () => {
    const { width, height } = scene.scale.gameSize;
    const ox = (width - GAME_W) / 2;
    const oy = (height - GAME_H) / 2;
    scene.cameras.main.setScroll(-ox, -oy);
    onChange?.(ox, oy);
  };
  apply();
  scene.scale.on(Phaser.Scale.Events.RESIZE, apply);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, apply));
}

/** True on phones and tablets (coarse pointer with touch). */
export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches;
}

/** Full screen + landscape lock where the browser allows it (must run inside a user gesture). */
export function goImmersive(game: Phaser.Game): void {
  if (!game.scale.isFullscreen && game.device.fullscreen.available) game.scale.startFullscreen();
}
