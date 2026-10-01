import Phaser from 'phaser';

export type Ctx = CanvasRenderingContext2D;

/** Creates (once) a canvas texture and lets `draw` paint it with the full Canvas 2D API. */
export function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx, w: number, h: number) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, Math.ceil(w), Math.ceil(h));
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.save();
  draw(ctx, w, h);
  ctx.restore();
  tex.refresh();
}

export function radial(ctx: Ctx, x: number, y: number, r: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function linear(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

/** Closed smooth shape through points (quadratic midpoint smoothing). */
export function smoothPath(ctx: Ctx, pts: [number, number][], closed = true): void {
  if (pts.length < 2) return;
  ctx.beginPath();
  const n = pts.length;
  if (closed) {
    const mx = (pts[n - 1][0] + pts[0][0]) / 2;
    const my = (pts[n - 1][1] + pts[0][1]) / 2;
    ctx.moveTo(mx, my);
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % n];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) {
      const p = pts[i];
      const q = pts[i + 1];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
  }
}

/** Organic blob around a center (used for rocks, coral heads...). */
export function blob(cx: number, cy: number, rx: number, ry: number, n: number, jitter: number, rand: () => number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (rand() - 0.5) * jitter;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}
