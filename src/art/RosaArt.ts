import Phaser from 'phaser';
import { canvasTex, Ctx, linear, radial } from './canvas';

/**
 * Provisional procedural art for Rosa: a clearly dolphin silhouette, feminine
 * expressive eye, navy & gold ornaments and a golden treble-clef pendant.
 * The long blond hair is NOT baked here — it is simulated at runtime.
 *
 * Body texture: 300x150, nose to the right. Local anchor offsets used by
 * RosaPlayer are relative to the texture centre (150, 75).
 */
export const ROSA_BODY = { w: 300, h: 150 };

export function drawTrebleClef(ctx: Ctx, x: number, y: number, s: number, color: string, width: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = width / s;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  // spiral body
  ctx.moveTo(2, 8);
  ctx.bezierCurveTo(-8, 8, -9, -4, 0, -5);
  ctx.bezierCurveTo(12, -6, 13, 12, 0, 14);
  ctx.bezierCurveTo(-16, 15, -16, -8, -2, -16);
  // up to the top loop
  ctx.bezierCurveTo(8, -22, 10, -32, 6, -40);
  ctx.bezierCurveTo(2, -46, -4, -40, -2, -30);
  // long stem down
  ctx.lineTo(4, 24);
  ctx.bezierCurveTo(5, 32, -4, 34, -6, 28);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(-4, 27, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function makeRosaTextures(scene: Phaser.Scene): void {
  canvasTex(scene, 'rosa_body', ROSA_BODY.w, ROSA_BODY.h, (ctx) => {
    ctx.translate(0, 5);
    // --- silhouette (nose to the right)
    const body = new Path2D();
    body.moveTo(296, 84);
    body.bezierCurveTo(290, 77, 280, 73, 268, 70); // rostrum top
    body.bezierCurveTo(262, 50, 246, 34, 222, 30); // melon
    body.bezierCurveTo(196, 26, 170, 27, 150, 31); // back
    body.bezierCurveTo(118, 37, 80, 47, 50, 58);
    body.bezierCurveTo(36, 62, 26, 64, 16, 67); // tail stock
    body.lineTo(16, 79);
    body.bezierCurveTo(30, 82, 52, 90, 80, 98);
    body.bezierCurveTo(120, 109, 170, 112, 210, 104); // belly
    body.bezierCurveTo(238, 99, 258, 93, 274, 89); // throat / jaw
    body.bezierCurveTo(284, 87, 292, 87, 296, 84);
    body.closePath();

    // dorsal fin (behind body outline)
    const dorsal = new Path2D();
    dorsal.moveTo(168, 32);
    dorsal.bezierCurveTo(150, 22, 128, 6, 112, 0);
    dorsal.bezierCurveTo(116, 12, 118, 26, 112, 40);
    dorsal.closePath();
    ctx.fillStyle = linear(ctx, 0, 0, 0, 40, [[0, '#2f4f7c'], [1, '#4c6f9c']]);
    ctx.fill(dorsal);

    ctx.save();
    ctx.clip(body);
    // countershading: dark back, light belly
    ctx.fillStyle = linear(ctx, 0, 26, 0, 112, [
      [0, '#3e5f8e'],
      [0.35, '#6f8fbb'],
      [0.62, '#a9c0da'],
      [0.8, '#e6eef7'],
      [1, '#f6f9fc'],
    ]);
    ctx.fillRect(0, 0, 300, 150);
    // belly patch shape for a cleaner division
    ctx.fillStyle = 'rgba(242,247,252,0.85)';
    ctx.beginPath();
    ctx.moveTo(296, 86);
    ctx.bezierCurveTo(270, 80, 250, 82, 224, 84);
    ctx.bezierCurveTo(180, 88, 120, 86, 40, 80);
    ctx.lineTo(40, 120);
    ctx.lineTo(296, 120);
    ctx.closePath();
    ctx.fill();
    // back highlight
    ctx.strokeStyle = 'rgba(200,225,255,0.45)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(240, 40);
    ctx.bezierCurveTo(200, 33, 150, 36, 90, 52);
    ctx.stroke();
    // shading to give volume
    ctx.fillStyle = radial(ctx, 210, 60, 140, [[0, 'rgba(255,255,255,0)'], [1, 'rgba(10,30,70,0.35)']]);
    ctx.fillRect(0, 0, 300, 150);
    ctx.restore();

    // outline
    ctx.strokeStyle = 'rgba(20,40,80,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke(body);

    // --- mouth (gentle smile)
    ctx.strokeStyle = 'rgba(40,50,90,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(294, 85);
    ctx.bezierCurveTo(282, 88, 268, 88, 258, 82);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(258, 82);
    ctx.quadraticCurveTo(255, 79, 256, 76);
    ctx.stroke();
    // cheek blush
    ctx.fillStyle = radial(ctx, 246, 80, 14, [[0, 'rgba(255,150,170,0.45)'], [1, 'rgba(255,150,170,0)']]);
    ctx.fillRect(228, 64, 36, 32);

    // --- eye
    const ex = 238, ey = 60;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, ey, 9, 8, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = radial(ctx, ex + 1, ey + 1, 7, [[0, '#2b7fd0'], [0.55, '#1a3f8a'], [1, '#0b1a40']]);
    ctx.beginPath();
    ctx.ellipse(ex + 1.5, ey + 1, 6.5, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#05091a';
    ctx.beginPath();
    ctx.arc(ex + 2, ey + 1.5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex + 4, ey - 2, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex - 0.5, ey + 3.5, 1, 0, Math.PI * 2);
    ctx.fill();
    // upper lid + lashes
    ctx.strokeStyle = '#13213f';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(ex, ey + 1, 10, 9, -0.15, Math.PI * 1.08, Math.PI * 1.95);
    ctx.stroke();
    ctx.lineWidth = 2;
    for (const [a, l] of [[-2.7, 6], [-2.35, 7], [-2.0, 6]] as [number, number][]) {
      const px = ex + Math.cos(a) * 10;
      const py = ey + 1 + Math.sin(a) * 9;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l - 1);
      ctx.stroke();
    }
    // brow
    ctx.strokeStyle = 'rgba(40,60,110,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(228, 46);
    ctx.quadraticCurveTo(240, 42, 250, 47);
    ctx.stroke();

    // --- navy & gold scarf / collar
    const scarf = new Path2D();
    scarf.moveTo(206, 30);
    scarf.bezierCurveTo(214, 52, 216, 80, 214, 106);
    scarf.lineTo(194, 108);
    scarf.bezierCurveTo(196, 82, 194, 54, 186, 30);
    scarf.closePath();
    ctx.save();
    ctx.clip(body);
    ctx.fillStyle = linear(ctx, 186, 0, 216, 0, [[0, '#14245a'], [0.5, '#22398a'], [1, '#14245a']]);
    ctx.fill(scarf);
    ctx.strokeStyle = '#f0c35c';
    ctx.lineWidth = 2.5;
    ctx.stroke(scarf);
    // filigree dots
    ctx.fillStyle = '#ffd97a';
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      ctx.beginPath();
      ctx.arc(200 + t * 4, 40 + t * 62, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // pearls along the collar edge
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const px = 214 + t * 1;
      const py = 36 + t * 64;
      ctx.fillStyle = radial(ctx, px - 1, py - 1, 3.5, [[0, '#ffffff'], [1, '#d9d2c4']]);
      ctx.beginPath();
      ctx.arc(px + 3, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Tail fluke — pivot on its right edge (attached to the tail stock).
  canvasTex(scene, 'rosa_fluke', 90, 96, (ctx) => {
    const p = new Path2D();
    p.moveTo(88, 46);
    p.bezierCurveTo(70, 40, 50, 20, 30, 4);
    p.bezierCurveTo(24, 14, 22, 26, 30, 38);
    p.bezierCurveTo(14, 42, 6, 44, 2, 48);
    p.bezierCurveTo(6, 52, 14, 54, 30, 58);
    p.bezierCurveTo(22, 70, 24, 82, 30, 92);
    p.bezierCurveTo(50, 76, 70, 56, 88, 50);
    p.closePath();
    ctx.fillStyle = linear(ctx, 0, 0, 0, 96, [[0, '#3c5c8c'], [0.5, '#6a8ab6'], [1, '#3c5c8c']]);
    ctx.fill(p);
    ctx.strokeStyle = 'rgba(20,40,80,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke(p);
    ctx.strokeStyle = 'rgba(220,235,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(84, 47);
    ctx.quadraticCurveTo(50, 36, 32, 10);
    ctx.stroke();
  });

  // Pectoral fin — pivot top-left.
  canvasTex(scene, 'rosa_fin', 70, 52, (ctx) => {
    const p = new Path2D();
    p.moveTo(6, 4);
    p.bezierCurveTo(26, 6, 46, 20, 64, 46);
    p.bezierCurveTo(40, 44, 18, 30, 4, 14);
    p.closePath();
    ctx.fillStyle = linear(ctx, 0, 0, 64, 46, [[0, '#56779f'], [1, '#86a3c4']]);
    ctx.fill(p);
    ctx.strokeStyle = 'rgba(20,40,80,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke(p);
  });

  // Golden treble-clef pendant on a short chain — pivot top-centre.
  canvasTex(scene, 'rosa_pendant', 40, 76, (ctx) => {
    ctx.strokeStyle = '#e9b950';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([2.5, 1.5]);
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(20, 18);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = radial(ctx, 20, 46, 22, [[0, 'rgba(255,230,140,0.55)'], [1, 'rgba(255,230,140,0)']]);
    ctx.fillRect(0, 20, 40, 56);
    drawTrebleClef(ctx, 20, 46, 0.62, '#ffd36e', 3.2);
    drawTrebleClef(ctx, 19.5, 45.5, 0.62, '#fff2c0', 1.1);
  });
}
