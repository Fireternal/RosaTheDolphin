import Phaser from 'phaser';

export const clamp = Phaser.Math.Clamp;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Frame-rate independent smoothing factor. */
export function damp(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

export function angleLerp(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function wait(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => scene.time.delayedCall(ms, () => resolve()));
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/** Deterministic pseudo random generator so procedural art is stable between runs. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hexToCss(c: number, a = 1): string {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  return `rgba(${r},${g},${b},${a})`;
}

export function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

export function isDebug(): boolean {
  return typeof location !== 'undefined' && /[?&]debug\b/.test(location.search);
}
