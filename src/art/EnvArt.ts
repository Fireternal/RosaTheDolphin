import Phaser from 'phaser';
import { rng } from '../core/util';
import { blob, canvasTex, Ctx, linear, radial, smoothPath } from './canvas';
import { GROTTO, LEFT_RAMP, PLATFORM, RIGHT_RAMP, RING, TOWER } from '../level/RotondaData';

/** Ring texture metrics (centre of ellipse inside the texture). */
export const RING_TEX = { w: RING.rx * 2 + 240, h: RING.ry * 2 + 260, cx: RING.rx + 120, cy: RING.ry + 110 };
export const WALKWAY_H = 112;
export const WALKWAY_DECK_Y = 40; // deck surface line inside walkway textures

export const CORAL_COLORS = [
  ['#c25bd6', '#f08cff'],
  ['#ff7a45', '#ffc070'],
  ['#ff6f9a', '#ffb3c9'],
  ['#2fc6b6', '#9cf5e6'],
  ['#ffd04a', '#fff0a0'],
];

function speckle(ctx: Ctx, rand: () => number, x: number, y: number, w: number, h: number, n: number, color: string, size = 2): void {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.arc(x + rand() * w, y + rand() * h, rand() * size + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function hangingAlgae(ctx: Ctx, rand: () => number, x: number, y: number, len: number): void {
  ctx.strokeStyle = `rgba(${60 + rand() * 40},${140 + rand() * 50},${90 + rand() * 40},${0.55 + rand() * 0.3})`;
  ctx.lineWidth = 2 + rand() * 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  const sway = (rand() - 0.5) * 16;
  ctx.bezierCurveTo(x + sway, y + len * 0.3, x - sway, y + len * 0.7, x + sway * 0.5, y + len);
  ctx.stroke();
}

function coralTuft(ctx: Ctx, rand: () => number, x: number, y: number, s: number): void {
  const pal = CORAL_COLORS[Math.floor(rand() * CORAL_COLORS.length)];
  ctx.fillStyle = pal[0];
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(x + (rand() - 0.5) * 14 * s, y - rand() * 8 * s, (2 + rand() * 4) * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = pal[1];
  ctx.beginPath();
  ctx.arc(x, y - 4 * s, 2 * s, 0, Math.PI * 2);
  ctx.fill();
}

// ------------------------------------------------------------------ the ring

function drawRing(ctx: Ctx, half: 'back' | 'front'): void {
  const { w, h, cx, cy } = RING_TEX;
  const { rx, ry, deck, thickness: th } = RING;
  const irx = rx - deck;
  const iry = ry - deck * 0.42;
  const rand = rng(half === 'back' ? 11 : 23);

  ctx.save();
  ctx.beginPath();
  if (half === 'back') ctx.rect(0, 0, w, cy + 2);
  else ctx.rect(0, cy - 2, w, h - cy + 2);
  ctx.clip();

  // deck top surface (band between ellipses)
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.ellipse(cx, cy, irx, iry, 0, 0, Math.PI * 2, true);
  ctx.fillStyle = linear(ctx, 0, cy - ry, 0, cy + ry, [[0, '#7f98ad'], [0.5, '#a9bfcf'], [1, '#c3d3de']]);
  ctx.fill('evenodd');
  // paving lines
  ctx.strokeStyle = 'rgba(70,95,120,0.35)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * irx, cy + Math.sin(a) * iry);
    ctx.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(cx, cy, (rx + irx) / 2, (ry + iry) / 2, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(240,250,255,0.25)';
  ctx.stroke();

  if (half === 'back') {
    // inner wall of the far side, seen from the front
    ctx.beginPath();
    ctx.ellipse(cx, cy, irx, iry, 0, Math.PI, Math.PI * 2);
    ctx.ellipse(cx, cy + th * 0.8, irx, iry, 0, Math.PI * 2, Math.PI, true);
    ctx.closePath();
    ctx.fillStyle = linear(ctx, 0, cy - iry, 0, cy - iry + th, [[0, '#6e8598'], [1, '#3e5468']]);
    ctx.fill();
    for (let i = 0; i < 70; i++) {
      const a = Math.PI + rand() * Math.PI;
      hangingAlgae(ctx, rand, cx + Math.cos(a) * irx, cy + Math.sin(a) * iry + th * 0.8, 14 + rand() * 40);
    }
  } else {
    // front fascia
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI);
    ctx.ellipse(cx, cy + th, rx, ry, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fillStyle = linear(ctx, 0, cy + ry - 10, 0, cy + ry + th, [[0, '#e8f0f5'], [0.5, '#b8c9d6'], [1, '#7d93a6']]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,80,105,0.4)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 60; i++) {
      const a = (i / 60) * Math.PI;
      const x = cx + Math.cos(a) * rx;
      const y = cy + Math.sin(a) * ry;
      ctx.beginPath();
      ctx.moveTo(x, y + 4);
      ctx.lineTo(x, y + th - 4);
      ctx.stroke();
    }
    // lower lip highlight
    ctx.beginPath();
    ctx.ellipse(cx, cy + th * 0.42, rx, ry, 0, 0.05, Math.PI - 0.05);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    ctx.stroke();
    // marine life colonising the edge
    for (let i = 0; i < 160; i++) {
      const a = rand() * Math.PI;
      hangingAlgae(ctx, rand, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry + th - 2, 10 + rand() * 55);
    }
    for (let i = 0; i < 90; i++) {
      const a = rand() * Math.PI;
      speckle(ctx, rand, cx + Math.cos(a) * rx - 10, cy + Math.sin(a) * ry + 6, 20, th - 10, 3, 'rgba(230,220,200,0.6)', 2.2);
    }
  }
  // edge darkening for curvature (only on painted pixels)
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = linear(ctx, cx - rx, 0, cx + rx, 0, [[0, 'rgba(8,30,60,0.45)'], [0.18, 'rgba(8,30,60,0)'], [0.82, 'rgba(8,30,60,0)'], [1, 'rgba(8,30,60,0.45)']]);
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  // patches of coral on the deck
  for (let i = 0; i < 46; i++) {
    const a = half === 'back' ? Math.PI + rand() * Math.PI : rand() * Math.PI;
    const k = rand();
    coralTuft(ctx, rand, cx + Math.cos(a) * (irx + (rx - irx) * k), cy + Math.sin(a) * (iry + (ry - iry) * k), 0.8 + rand() * 0.8);
  }
  ctx.restore();

  // railings (drawn without clip, by angle range)
  const a0 = half === 'back' ? Math.PI : 0;
  const a1 = half === 'back' ? Math.PI * 2 : Math.PI;
  const railH = 34;
  for (const [erx, ery, alpha] of [[rx - 6, ry - 3, 1], [irx + 6, iry + 3, 0.7]] as [number, number, number][]) {
    if (half === 'front' && alpha < 1) {
      /* inner railing of the near side faces away; keep it subtle */
    }
    // glass
    ctx.beginPath();
    ctx.ellipse(cx, cy, erx, ery, 0, a0, a1);
    ctx.ellipse(cx, cy - railH, erx, ery, 0, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = `rgba(170,230,255,${0.13 * alpha})`;
    ctx.fill();
    // handrail
    ctx.beginPath();
    ctx.ellipse(cx, cy - railH, erx, ery, 0, a0, a1);
    ctx.strokeStyle = `rgba(225,240,250,${0.85 * alpha})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    // posts
    ctx.strokeStyle = `rgba(200,220,235,${0.7 * alpha})`;
    ctx.lineWidth = 2;
    const steps = 90;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (a1 - a0) * (i / steps);
      const x = cx + Math.cos(a) * erx;
      const y = cy + Math.sin(a) * ery;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - railH);
      ctx.stroke();
    }
  }
}

function drawWalkway(ctx: Ctx, len: number, seed: number): void {
  const rand = rng(seed);
  const deckY = WALKWAY_DECK_Y;
  // glass railing
  ctx.fillStyle = 'rgba(170,230,255,0.14)';
  ctx.fillRect(0, deckY - 34, len, 34);
  ctx.strokeStyle = 'rgba(225,240,250,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, deckY - 34);
  ctx.lineTo(len, deckY - 34);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(200,220,235,0.7)';
  ctx.lineWidth = 2;
  for (let x = 4; x < len; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, deckY);
    ctx.lineTo(x, deckY - 34);
    ctx.stroke();
  }
  // deck surface
  ctx.fillStyle = linear(ctx, 0, deckY, 0, deckY + 12, [[0, '#c9d8e2'], [1, '#9fb4c4']]);
  ctx.fillRect(0, deckY, len, 12);
  // fascia
  ctx.fillStyle = linear(ctx, 0, deckY + 12, 0, deckY + 60, [[0, '#e3ecf2'], [0.6, '#b2c4d2'], [1, '#7a90a3']]);
  ctx.fillRect(0, deckY + 12, len, 48);
  ctx.strokeStyle = 'rgba(60,80,105,0.35)';
  for (let x = 30; x < len; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, deckY + 14);
    ctx.lineTo(x, deckY + 58);
    ctx.stroke();
  }
  for (let i = 0; i < len / 9; i++) hangingAlgae(ctx, rand, rand() * len, deckY + 58, 8 + rand() * 46);
  for (let i = 0; i < len / 40; i++) coralTuft(ctx, rand, rand() * len, deckY + 4, 0.8 + rand() * 0.6);
  speckle(ctx, rand, 0, deckY + 16, len, 40, len / 12, 'rgba(230,220,200,0.5)', 2);
}

// ------------------------------------------------------------------ statue

function drawStatue(ctx: Ctx, w: number, h: number): void {
  const rand = rng(77);
  const base = '#3f7f6c';
  const dark = '#21463c';
  const light = '#86c7ad';
  const bottom = h - 6;
  const cx = w / 2 - 20;

  // staff (behind the hand)
  const sx = cx + 104;
  ctx.fillStyle = linear(ctx, sx - 7, 0, sx + 7, 0, [[0, dark], [0.4, light], [1, dark]]);
  ctx.fillRect(sx - 6, 70, 12, bottom - 70);
  // staff finial: ring + orb
  ctx.strokeStyle = light;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(sx, 52, 16, 22, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = radial(ctx, sx - 4, 48, 14, [[0, '#a9e3cb'], [1, dark]]);
  ctx.beginPath();
  ctx.arc(sx, 52, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.fillRect(sx - 10, 74, 20, 10);

  // robe
  const robe = new Path2D();
  robe.moveTo(cx - 72, 262);
  robe.bezierCurveTo(cx - 88, 380, cx - 96, 560, cx - 104, 760);
  robe.bezierCurveTo(cx - 110, 900, cx - 118, 1020, cx - 122, bottom - 18);
  // hem with folds
  for (let i = 0; i <= 10; i++) {
    const x = cx - 122 + i * 24.4;
    robe.quadraticCurveTo(x - 12, bottom - (i % 2 ? 4 : 14), x, bottom - 10);
  }
  robe.bezierCurveTo(cx + 116, 1000, cx + 100, 820, cx + 92, 640);
  robe.bezierCurveTo(cx + 86, 480, cx + 84, 360, cx + 74, 262);
  robe.bezierCurveTo(cx + 40, 236, cx - 40, 236, cx - 72, 262);
  robe.closePath();

  ctx.save();
  ctx.clip(robe);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = linear(ctx, cx - 120, 0, cx + 120, 0, [[0, 'rgba(160,230,200,0.35)'], [0.45, 'rgba(0,0,0,0)'], [1, 'rgba(10,30,25,0.55)']]);
  ctx.fillRect(0, 0, w, h);
  // vertical folds
  for (let i = 0; i < 9; i++) {
    const fx = cx - 96 + i * 24 + (rand() - 0.5) * 8;
    ctx.strokeStyle = 'rgba(15,40,34,0.55)';
    ctx.lineWidth = 3 + rand() * 3;
    ctx.beginPath();
    ctx.moveTo(fx + (rand() - 0.5) * 10, 600 + rand() * 120);
    ctx.bezierCurveTo(fx - 6, 800, fx + 6, 950, fx + (i - 4) * 3, bottom);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(170,235,210,0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fx + 6, 640 + rand() * 120);
    ctx.bezierCurveTo(fx, 820, fx + 10, 960, fx + 7 + (i - 4) * 3, bottom);
    ctx.stroke();
  }
  ctx.restore();

  // mantle draped diagonally
  const mantle = new Path2D();
  mantle.moveTo(cx - 76, 258);
  mantle.bezierCurveTo(cx - 100, 360, cx - 96, 520, cx - 60, 640);
  mantle.bezierCurveTo(cx - 20, 700, cx + 50, 690, cx + 90, 610);
  mantle.bezierCurveTo(cx + 70, 520, cx + 40, 420, cx + 8, 330);
  mantle.bezierCurveTo(cx - 10, 290, cx - 40, 262, cx - 76, 258);
  mantle.closePath();
  ctx.save();
  ctx.fillStyle = linear(ctx, cx - 100, 0, cx + 90, 0, [[0, '#5a9c86'], [1, '#2c5c4f']]);
  ctx.fill(mantle);
  ctx.clip(mantle);
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = 'rgba(15,40,34,0.5)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 80 + i * 10, 300 + i * 40);
    ctx.quadraticCurveTo(cx - 20 + i * 12, 560 + i * 10, cx + 80, 600 + i * 6);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(15,40,34,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke(mantle);

  // left arm across the chest
  ctx.fillStyle = '#356f5f';
  ctx.beginPath();
  ctx.ellipse(cx - 6, 430, 54, 22, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4e917c';
  ctx.beginPath();
  ctx.ellipse(cx + 34, 414, 16, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  // right arm (wide sleeve) reaching the staff
  const sleeve = new Path2D();
  sleeve.moveTo(cx + 62, 268);
  sleeve.bezierCurveTo(cx + 92, 320, cx + 104, 400, cx + 116, 500);
  sleeve.bezierCurveTo(cx + 120, 540, cx + 96, 560, cx + 78, 540);
  sleeve.bezierCurveTo(cx + 74, 450, cx + 62, 360, cx + 50, 300);
  sleeve.closePath();
  ctx.fillStyle = linear(ctx, cx + 50, 0, cx + 120, 0, [[0, '#4a8a75'], [1, '#22493f']]);
  ctx.fill(sleeve);
  // hand around the staff
  ctx.fillStyle = radial(ctx, sx - 4, 520, 22, [[0, '#7cbca3'], [1, '#2f6153']]);
  ctx.beginPath();
  ctx.ellipse(sx, 522, 16, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = linear(ctx, sx - 7, 0, sx + 7, 0, [[0, dark], [0.4, light], [1, dark]]);
  ctx.fillRect(sx - 6, 540, 12, 30);

  // neck & head (solemn, slightly bowed)
  ctx.fillStyle = '#3b7867';
  ctx.fillRect(cx - 18, 205, 36, 40);
  const hx = cx, hy = 168;
  ctx.fillStyle = radial(ctx, hx - 14, hy - 16, 70, [[0, '#9ad6bd'], [0.5, base], [1, dark]]);
  ctx.beginPath();
  ctx.ellipse(hx, hy, 40, 52, 0.05, 0, Math.PI * 2);
  ctx.fill();
  // hair cap
  ctx.fillStyle = '#2f6556';
  ctx.beginPath();
  ctx.ellipse(hx, hy - 26, 43, 32, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 7; i++) {
    ctx.strokeStyle = 'rgba(150,220,195,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hx - 34 + i * 11, hy - 30, 6, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  // beard
  ctx.fillStyle = '#2f6556';
  ctx.beginPath();
  ctx.moveTo(hx - 30, hy + 12);
  ctx.quadraticCurveTo(hx, hy + 78, hx + 30, hy + 12);
  ctx.quadraticCurveTo(hx, hy + 40, hx - 30, hy + 12);
  ctx.fill();
  // face: closed eyes, brow, nose
  ctx.strokeStyle = 'rgba(15,40,34,0.75)';
  ctx.lineWidth = 2.5;
  for (const ex of [-14, 14]) {
    ctx.beginPath();
    ctx.arc(hx + ex, hy - 2, 7, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(hx - 24, hy - 14);
  ctx.quadraticCurveTo(hx, hy - 22, hx + 24, hy - 14);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(hx, hy - 6);
  ctx.lineTo(hx - 3, hy + 14);
  ctx.lineTo(hx + 3, hy + 15);
  ctx.stroke();

  // verdigris streaks & weathering
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 40; i++) {
    const x = cx - 110 + rand() * 230;
    const y = 240 + rand() * 300;
    ctx.strokeStyle = `rgba(150,235,205,${0.08 + rand() * 0.12})`;
    ctx.lineWidth = 2 + rand() * 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 6, y + 80 + rand() * 300);
    ctx.stroke();
  }
  for (let i = 0; i < 25; i++) {
    ctx.fillStyle = `rgba(120,90,50,${0.08 + rand() * 0.1})`;
    ctx.beginPath();
    ctx.arc(cx - 100 + rand() * 200, 300 + rand() * 800, 6 + rand() * 18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // small coral & algae colonising the hem
  for (let i = 0; i < 10; i++) coralTuft(ctx, rand, cx - 110 + rand() * 220, bottom - rand() * 20, 1 + rand());
}

function drawPedestal(ctx: Ctx, w: number, h: number): void {
  const rand = rng(91);
  const stone = (y0: number, y1: number): CanvasGradient => linear(ctx, 0, y0, 0, y1, [[0, '#a7b4be'], [1, '#62737f']]);
  // top slab
  ctx.fillStyle = stone(0, 34);
  ctx.fillRect(10, 0, w - 20, 34);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(10, 0, w - 20, 5);
  // body
  ctx.fillStyle = stone(34, h - 46);
  ctx.fillRect(40, 34, w - 80, h - 80);
  ctx.fillStyle = linear(ctx, 40, 0, w - 40, 0, [[0, 'rgba(255,255,255,0.12)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,10,30,0.35)']]);
  ctx.fillRect(40, 34, w - 80, h - 80);
  // base step
  ctx.fillStyle = stone(h - 46, h);
  ctx.fillRect(0, h - 46, w, 46);
  // bronze plaque with a staff of music
  const px = w / 2 - 70, py = 80;
  ctx.fillStyle = linear(ctx, px, py, px, py + 70, [[0, '#4f8f78'], [1, '#2a5446']]);
  ctx.fillRect(px, py, 140, 70);
  ctx.strokeStyle = 'rgba(170,235,210,0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 4, py + 4, 132, 62);
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(px + 14, py + 20 + i * 8);
    ctx.lineTo(px + 126, py + 20 + i * 8);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(190,245,220,0.7)';
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.ellipse(px + 22 + i * 15, py + 50 - [3, 1, 3, 4, 2, 5, 6][i] * 4, 4, 3, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // moss, barnacles, coral
  speckle(ctx, rand, 10, 0, w - 20, h, 120, 'rgba(70,140,100,0.35)', 4);
  speckle(ctx, rand, 0, h - 60, w, 60, 60, 'rgba(235,225,205,0.55)', 2.5);
  for (let i = 0; i < 8; i++) coralTuft(ctx, rand, rand() * w, h - rand() * 10, 1.2 + rand());
  for (let i = 0; i < 14; i++) hangingAlgae(ctx, rand, 12 + rand() * (w - 24), 34, 10 + rand() * 30);
}

// ------------------------------------------------------------------ props

function drawPillar(ctx: Ctx, w: number, h: number): void {
  const rand = rng(5);
  const sw = 64;
  const x0 = (w - sw) / 2;
  ctx.fillStyle = linear(ctx, x0, 0, x0 + sw, 0, [[0, '#7d93a6'], [0.35, '#e4edf3'], [0.6, '#b9cad6'], [1, '#5f7487']]);
  ctx.fillRect(x0, 40, sw, h - 40);
  // capital flare
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(x0 + sw, 46);
  ctx.lineTo(x0, 46);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, 0, 0, w, 0, [[0, '#7d93a6'], [0.4, '#e9f1f6'], [1, '#62778a']]);
  ctx.fill();
  // bands
  for (let y = 120; y < h; y += 260) {
    ctx.fillStyle = 'rgba(40,60,85,0.35)';
    ctx.fillRect(x0, y, sw, 6);
  }
  for (let i = 0; i < 30; i++) hangingAlgae(ctx, rand, x0 + rand() * sw, 40 + rand() * 200, 20 + rand() * 80);
  speckle(ctx, rand, x0, 0, sw, h, 160, 'rgba(70,140,100,0.3)', 3);
  for (let i = 0; i < 8; i++) coralTuft(ctx, rand, x0 + rand() * sw, 60 + rand() * (h - 100), 1 + rand());
}

function drawGarden(ctx: Ctx, w: number, h: number): void {
  const rand = rng(31);
  const cx = w / 2, cy = 110, rx = 600, ry = 96;
  // front wall of the planter
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI);
  ctx.ellipse(cx, cy + 110, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, 0, cy + ry, 0, cy + ry + 110, [[0, '#a5b3bd'], [1, '#55687a']]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,55,70,0.4)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    ctx.beginPath();
    ctx.moveTo(x, y + 14);
    ctx.lineTo(x, y + 108);
    ctx.stroke();
  }
  // lawn
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = linear(ctx, 0, cy - ry, 0, cy + ry, [[0, '#1f5a49'], [1, '#3f8a5e']]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 2600; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand());
    const x = cx + Math.cos(a) * rx * r;
    const y = cy + Math.sin(a) * ry * r;
    ctx.strokeStyle = `rgba(${70 + rand() * 60},${150 + rand() * 70},${90 + rand() * 40},0.55)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 4, y - 4 - rand() * 7);
    ctx.stroke();
  }
  // a circular path around the statue
  ctx.beginPath();
  ctx.ellipse(cx, cy, 230, 38, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(200,210,215,0.45)';
  ctx.lineWidth = 14;
  ctx.stroke();
  ctx.restore();
  // rim
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = '#c3cfd7';
  ctx.lineWidth = 12;
  ctx.stroke();
  speckle(ctx, rand, 0, cy + 60, w, 150, 150, 'rgba(235,225,205,0.45)', 2.2);
  void h;
}

function drawTower(ctx: Ctx, w: number, h: number): void {
  // texture covers x: TOWER.x0-30 .. TOWER.x1+30, y: TOWER.top-170 .. TOWER.bottom+20
  const rand = rng(61);
  const ox = 30, oy = 170;
  const W = TOWER.x1 - TOWER.x0, wall = TOWER.wall;
  const H = TOWER.bottom - TOWER.top;
  // interior back wall (darker, see-through cutaway)
  ctx.fillStyle = linear(ctx, 0, oy, 0, oy + H, [[0, '#1d3c5a'], [1, '#0f2640']]);
  ctx.fillRect(ox + wall, oy + 50, W - wall * 2, H - 50);
  // windows letting light in
  for (let i = 0; i < 4; i++) {
    const wy = oy + 120 + i * 190;
    ctx.fillStyle = radial(ctx, ox + W / 2, wy + 30, 60, [[0, 'rgba(120,200,240,0.4)'], [1, 'rgba(120,200,240,0)']]);
    ctx.fillRect(ox + wall, wy - 30, W - wall * 2, 120);
    ctx.fillStyle = 'rgba(100,170,220,0.35)';
    ctx.beginPath();
    ctx.moveTo(ox + W / 2 - 22, wy + 60);
    ctx.lineTo(ox + W / 2 - 22, wy + 14);
    ctx.arc(ox + W / 2, wy + 14, 22, Math.PI, 0);
    ctx.lineTo(ox + W / 2 + 22, wy + 60);
    ctx.closePath();
    ctx.fill();
  }
  // stone walls
  const wallGrad = (x: number) => linear(ctx, x, 0, x + wall, 0, [[0, '#5f7488'], [0.4, '#b7c6d2'], [1, '#6c8194']]);
  ctx.fillStyle = wallGrad(ox);
  ctx.fillRect(ox, oy, wall, H);
  ctx.fillStyle = wallGrad(ox + W - wall);
  ctx.fillRect(ox + W - wall, oy, wall, H);
  ctx.fillStyle = linear(ctx, 0, oy, 0, oy + 50, [[0, '#c9d6df'], [1, '#7d92a5']]);
  ctx.fillRect(ox, oy, W, 50);
  // stone courses
  ctx.strokeStyle = 'rgba(40,55,75,0.4)';
  ctx.lineWidth = 2;
  for (let y = oy + 40; y < oy + H; y += 34) {
    ctx.beginPath();
    ctx.moveTo(ox, y);
    ctx.lineTo(ox + wall, y);
    ctx.moveTo(ox + W - wall, y);
    ctx.lineTo(ox + W, y);
    ctx.stroke();
  }
  // dome roof
  ctx.beginPath();
  ctx.moveTo(ox - 20, oy + 4);
  ctx.quadraticCurveTo(ox + W / 2, oy - 220, ox + W + 20, oy + 4);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, 0, oy - 140, 0, oy, [[0, '#6fb3a0'], [1, '#2f6656']]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(180,240,220,0.4)';
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(ox - 20 + (i * (W + 40)) / 6, oy + 2);
    ctx.quadraticCurveTo(ox + W / 2, oy - 160, ox + W / 2, oy - 106);
    ctx.stroke();
  }
  // bottom opening arch hint
  ctx.fillStyle = 'rgba(10,25,45,0.6)';
  ctx.fillRect(ox + wall, oy + H - 10, W - wall * 2, 10);
  for (let i = 0; i < 70; i++) hangingAlgae(ctx, rand, ox + rand() * W, oy + 40 + rand() * (H - 60), 14 + rand() * 50);
  speckle(ctx, rand, ox, oy, W, H, 200, 'rgba(70,140,100,0.35)', 3);
  for (let i = 0; i < 16; i++) coralTuft(ctx, rand, ox + (rand() < 0.5 ? rand() * wall : W - rand() * wall), oy + 60 + rand() * (H - 80), 1 + rand());
  void w; void h;
}

function drawOrgan(ctx: Ctx, w: number, h: number): void {
  const rand = rng(8);
  const colors = ['#ff8a9a', '#ffb066', '#ffdf6a', '#9be88f', '#6fe6d6', '#7fbcff', '#c49bff'];
  const heights = [120, 150, 180, 205, 180, 150, 120];
  // console
  ctx.fillStyle = linear(ctx, 0, h - 90, 0, h, [[0, '#9fb0bd'], [1, '#5a6d7d']]);
  smoothPath(ctx, [[10, h], [20, h - 80], [w / 2, h - 96], [w - 20, h - 80], [w - 10, h]]);
  ctx.fill();
  // pipes
  for (let i = 0; i < 7; i++) {
    const px = 40 + i * 32;
    const ph = heights[i];
    const top = h - 80 - ph;
    ctx.fillStyle = linear(ctx, px - 11, 0, px + 11, 0, [[0, '#6b5a2e'], [0.4, '#e6c56c'], [1, '#6b5a2e']]);
    ctx.fillRect(px - 11, top, 22, ph);
    ctx.fillStyle = '#3b2f16';
    ctx.beginPath();
    ctx.ellipse(px, top, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // mouth
    ctx.fillStyle = 'rgba(30,20,10,0.8)';
    ctx.fillRect(px - 6, top + ph - 40, 12, 8);
    // note gem
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.arc(px, top + ph - 16, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(px - 2, top + ph - 18, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  speckle(ctx, rand, 20, 0, w - 40, h, 90, 'rgba(70,150,110,0.4)', 3);
  for (let i = 0; i < 10; i++) hangingAlgae(ctx, rand, 30 + rand() * (w - 60), h - 90 - rand() * 120, 10 + rand() * 30);
}

function drawConch(ctx: Ctx, w: number, h: number): void {
  // rock base
  const rand = rng(4);
  ctx.fillStyle = linear(ctx, 0, h - 60, 0, h, [[0, '#5d7286'], [1, '#2d3f52']]);
  smoothPath(ctx, blob(w / 2, h - 24, w / 2 - 6, 30, 12, 0.25, rand));
  ctx.fill();
  // spiral conch
  ctx.save();
  ctx.translate(w / 2, h - 70);
  ctx.rotate(-0.25);
  const shell = new Path2D();
  shell.moveTo(-70, 10);
  shell.bezierCurveTo(-60, -40, 10, -60, 50, -30);
  shell.bezierCurveTo(70, -20, 76, 0, 64, 12);
  shell.bezierCurveTo(30, 36, -30, 40, -70, 10);
  shell.closePath();
  ctx.fillStyle = linear(ctx, -70, -40, 70, 40, [[0, '#fff1e2'], [0.5, '#f6c4b0'], [1, '#d98a7a']]);
  ctx.fill(shell);
  ctx.strokeStyle = 'rgba(140,70,60,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke(shell);
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(30 - i * 4, -10, 34 - i * 6, Math.PI * 0.9, Math.PI * 1.9);
    ctx.strokeStyle = 'rgba(160,90,70,0.45)';
    ctx.stroke();
  }
  // opening
  ctx.fillStyle = radial(ctx, -50, 8, 26, [[0, '#ffd3c4'], [1, '#c86f6a']]);
  ctx.beginPath();
  ctx.ellipse(-52, 8, 22, 14, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawClam(ctx: Ctx, w: number, h: number, part: 'bottom' | 'top'): void {
  const cx = w / 2;
  ctx.save();
  if (part === 'top') {
    ctx.translate(0, 0);
    const p = new Path2D();
    p.moveTo(10, h - 6);
    p.bezierCurveTo(20, 10, w - 20, 10, w - 10, h - 6);
    p.closePath();
    ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, '#f7d9c0'], [0.6, '#d9a48c'], [1, '#9f6a5a']]);
    ctx.fill(p);
    ctx.clip(p);
    for (let i = 0; i < 11; i++) {
      ctx.strokeStyle = 'rgba(120,70,55,0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, h + 10);
      ctx.lineTo(10 + (i * (w - 20)) / 10, 0);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(110,60,50,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, h - 6);
    ctx.bezierCurveTo(20, 10, w - 20, 10, w - 10, h - 6);
    ctx.stroke();
  } else {
    const p = new Path2D();
    p.moveTo(10, 6);
    p.bezierCurveTo(20, h - 4, w - 20, h - 4, w - 10, 6);
    p.closePath();
    ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, '#ffe8d6'], [0.3, '#e0ad95'], [1, '#8a5a4c']]);
    ctx.fill(p);
    // inner nacre
    ctx.fillStyle = linear(ctx, 0, 0, w, 0, [[0, 'rgba(200,220,255,0.5)'], [0.5, 'rgba(255,230,250,0.65)'], [1, 'rgba(200,255,240,0.5)']]);
    ctx.beginPath();
    ctx.ellipse(cx, 12, w / 2 - 22, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawLamp(ctx: Ctx, w: number, h: number): void {
  ctx.fillStyle = linear(ctx, w / 2 - 3, 0, w / 2 + 3, 0, [[0, '#3c4c5c'], [0.5, '#8a9cad'], [1, '#3c4c5c']]);
  ctx.fillRect(w / 2 - 3, 24, 6, h - 24);
  ctx.fillStyle = '#4c5d6e';
  ctx.fillRect(w / 2 - 8, h - 8, 16, 8);
  ctx.fillStyle = radial(ctx, w / 2 - 3, 14, 14, [[0, '#f4f8ff'], [1, '#8fa3b6']]);
  ctx.beginPath();
  ctx.arc(w / 2, 16, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4c5d6e';
  ctx.fillRect(w / 2 - 8, 26, 16, 4);
}

function drawRock(ctx: Ctx, w: number, h: number, seed: number): void {
  const rand = rng(seed);
  const pts = blob(w / 2, h * 0.62, w * 0.46, h * 0.5, 14, 0.35, rand);
  for (const p of pts) if (p[1] > h - 4) p[1] = h - 4;
  smoothPath(ctx, pts);
  ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, '#5d7890'], [0.6, '#33485e'], [1, '#1d2c3e']]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = radial(ctx, w * 0.35, h * 0.25, w * 0.6, [[0, 'rgba(160,210,240,0.35)'], [1, 'rgba(160,210,240,0)']]);
  ctx.fillRect(0, 0, w, h);
  speckle(ctx, rand, 0, 0, w, h, (w * h) / 300, 'rgba(20,35,55,0.4)', 3);
  speckle(ctx, rand, 0, 0, w, h * 0.5, (w * h) / 900, 'rgba(90,170,120,0.35)', 4);
  ctx.restore();
}

function drawGrottoRock(ctx: Ctx, w: number, h: number): void {
  const rand = rng(41);
  const pts: [number, number][] = [[0, 0], [w, 0], [w, h * 0.6]];
  for (let i = 1; i < 18; i++) {
    const x = w - (i / 18) * w;
    pts.push([x, h * 0.55 + rand() * h * 0.45]);
  }
  pts.push([0, h * 0.75]);
  smoothPath(ctx, pts);
  ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, '#2b4258'], [0.7, '#1c2d40'], [1, '#14202e']]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  speckle(ctx, rand, 0, 0, w, h, 500, 'rgba(90,130,170,0.25)', 4);
  speckle(ctx, rand, 0, 0, w, h * 0.3, 160, 'rgba(90,170,120,0.35)', 4);
  ctx.restore();
  for (let i = 0; i < 70; i++) hangingAlgae(ctx, rand, rand() * w, h * 0.6 + rand() * h * 0.3, 20 + rand() * 60);
}

function drawCoralBranch(ctx: Ctx, w: number, h: number, seed: number, pal: string[]): void {
  const rand = rng(seed);
  const branch = (x: number, y: number, a: number, len: number, wid: number, depth: number): void => {
    const x2 = x + Math.cos(a) * len;
    const y2 = y + Math.sin(a) * len;
    ctx.strokeStyle = depth > 2 ? pal[0] : pal[1];
    ctx.lineWidth = wid;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a + 0.3) * len * 0.5, y + Math.sin(a + 0.3) * len * 0.5, x2, y2);
    ctx.stroke();
    if (depth <= 0) {
      ctx.fillStyle = pal[1];
      ctx.beginPath();
      ctx.arc(x2, y2, wid * 0.8, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const n = 2 + (rand() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) branch(x2, y2, a + (rand() - 0.5) * 1.3, len * (0.62 + rand() * 0.2), wid * 0.72, depth - 1);
  };
  branch(w / 2, h - 4, -Math.PI / 2, h * 0.3, 14, 4);
}

function drawFan(ctx: Ctx, w: number, h: number, seed: number, pal: string[]): void {
  const rand = rng(seed);
  const bx = w / 2, by = h - 4;
  ctx.strokeStyle = pal[0];
  ctx.lineCap = 'round';
  const tips: [number, number][] = [];
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI + 0.35 + (i / 13) * (Math.PI - 0.7);
    const r = h * (0.75 + rand() * 0.2);
    const tx = bx + Math.cos(a) * r * 0.9;
    const ty = by + Math.sin(a) * r;
    tips.push([tx, ty]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + Math.cos(a) * r * 0.4, by + Math.sin(a) * r * 0.6, tx, ty);
    ctx.stroke();
  }
  ctx.strokeStyle = pal[1];
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.7;
  for (let k = 0.3; k < 1; k += 0.12) {
    ctx.beginPath();
    tips.forEach(([tx, ty], i) => {
      const x = bx + (tx - bx) * k;
      const y = by + (ty - by) * k;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawBrain(ctx: Ctx, w: number, h: number, pal: string[]): void {
  const rand = rng(17);
  ctx.beginPath();
  ctx.ellipse(w / 2, h, w / 2 - 4, h - 6, 0, Math.PI, Math.PI * 2);
  ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, pal[1]], [1, pal[0]]]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(60,20,40,0.35)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 16; i++) {
    ctx.beginPath();
    let x = rand() * w, y = h * 0.2 + rand() * h;
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (rand() - 0.5) * 30;
      y += (rand() - 0.5) * 16;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawSponge(ctx: Ctx, w: number, h: number, pal: string[]): void {
  const rand = rng(29);
  for (let i = 0; i < 5; i++) {
    const tw = 16 + rand() * 12;
    const th = h * (0.45 + rand() * 0.5);
    const x = 10 + i * ((w - 30) / 4);
    ctx.fillStyle = linear(ctx, x, 0, x + tw, 0, [[0, pal[0]], [0.5, pal[1]], [1, pal[0]]]);
    ctx.beginPath();
    ctx.roundRect(x, h - th, tw, th, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(40,10,30,0.6)';
    ctx.beginPath();
    ctx.ellipse(x + tw / 2, h - th + 5, tw / 2 - 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAnemone(ctx: Ctx, w: number, h: number, pal: string[]): void {
  const rand = rng(53);
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI + 0.25 + (i / 25) * (Math.PI - 0.5);
    const len = h * (0.55 + rand() * 0.35);
    ctx.strokeStyle = i % 2 ? pal[0] : pal[1];
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(w / 2, h - 10);
    ctx.quadraticCurveTo(w / 2 + Math.cos(a) * len * 0.6 + (rand() - 0.5) * 12, h - 10 + Math.sin(a) * len * 0.5, w / 2 + Math.cos(a) * len * 0.8, h - 10 + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.fillStyle = pal[0];
  ctx.beginPath();
  ctx.ellipse(w / 2, h - 8, 18, 8, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawSeagrass(ctx: Ctx, w: number, h: number): void {
  const rand = rng(3);
  ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const x = w / 2 + (rand() - 0.5) * w * 0.6;
    ctx.strokeStyle = `rgba(${60 + rand() * 40},${150 + rand() * 60},${90 + rand() * 40},0.9)`;
    ctx.lineWidth = 3 + rand() * 2;
    const tx = x + (rand() - 0.5) * 30;
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.quadraticCurveTo(x + (rand() - 0.5) * 20, h * 0.5, tx, h * (0.05 + rand() * 0.35));
    ctx.stroke();
  }
}

function drawFlower(ctx: Ctx, w: number, h: number): void {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.ellipse(w / 2 + Math.cos(a) * 12, h / 2 + Math.sin(a) * 12, 10, 5, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,240,180,1)';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawSargassum(ctx: Ctx, w: number, h: number): void {
  const rand = rng(99);
  for (let i = 0; i < 40; i++) {
    const x = 20 + rand() * (w - 40);
    const y = 10 + rand() * (h * 0.5);
    ctx.strokeStyle = `rgba(${150 + rand() * 50},${120 + rand() * 40},40,0.9)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (rand() - 0.5) * 40, y + 30, x + (rand() - 0.5) * 30, y + 40 + rand() * 60);
    ctx.stroke();
    ctx.fillStyle = `rgba(${190 + rand() * 50},${150 + rand() * 40},50,0.95)`;
    ctx.beginPath();
    ctx.arc(x, y, 4 + rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFarRuin(ctx: Ctx, w: number, h: number): void {
  ctx.fillStyle = '#ffffff';
  // a colonnade with arches
  for (let i = 0; i < 5; i++) {
    const x = 20 + i * ((w - 80) / 4);
    ctx.fillRect(x, 80, 40, h - 80);
  }
  ctx.fillRect(0, 50, w, 40);
  for (let i = 0; i < 4; i++) {
    const x = 60 + i * ((w - 80) / 4);
    const aw = (w - 80) / 4 - 40;
    ctx.beginPath();
    ctx.moveTo(x, 90);
    ctx.lineTo(x + aw, 90);
    ctx.lineTo(x + aw, 140);
    ctx.arc(x + aw / 2, 140, aw / 2, 0, Math.PI, true);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(-10, 52);
  ctx.lineTo(w / 2, 0);
  ctx.lineTo(w + 10, 52);
  ctx.closePath();
  ctx.fill();
}

function drawFarRidge(ctx: Ctx, w: number, h: number, seed: number): void {
  const rand = rng(seed);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, h);
  let y = h * 0.5;
  for (let x = 0; x <= w; x += 40) {
    y = Math.max(h * 0.1, Math.min(h * 0.85, y + (rand() - 0.5) * 60));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  // spires
  for (let i = 0; i < 5; i++) {
    const x = rand() * w;
    ctx.beginPath();
    ctx.moveTo(x - 30, h);
    ctx.lineTo(x - 6, h * 0.05 + rand() * h * 0.3);
    ctx.lineTo(x + 8, h * 0.1 + rand() * h * 0.3);
    ctx.lineTo(x + 34, h);
    ctx.fill();
  }
}

export function makeEnvTextures(scene: Phaser.Scene): void {
  canvasTex(scene, 'ring_back', RING_TEX.w, RING_TEX.h, (ctx) => drawRing(ctx, 'back'));
  canvasTex(scene, 'ring_front', RING_TEX.w, RING_TEX.h, (ctx) => drawRing(ctx, 'front'));

  const leftLen = Math.hypot(LEFT_RAMP.x1 - LEFT_RAMP.x0, LEFT_RAMP.y1 - LEFT_RAMP.y0);
  const rightLen = Math.hypot(RIGHT_RAMP.x1 - RIGHT_RAMP.x0, RIGHT_RAMP.y1 - RIGHT_RAMP.y0);
  canvasTex(scene, 'ramp_left', leftLen, WALKWAY_H, (ctx) => drawWalkway(ctx, leftLen, 101));
  canvasTex(scene, 'ramp_right', rightLen, WALKWAY_H, (ctx) => drawWalkway(ctx, rightLen, 102));
  canvasTex(scene, 'platform', PLATFORM.x1 - PLATFORM.x0, WALKWAY_H, (ctx) => drawWalkway(ctx, PLATFORM.x1 - PLATFORM.x0, 103));

  canvasTex(scene, 'pillar', 120, 1500, drawPillar);
  canvasTex(scene, 'garden', 1240, 260, drawGarden);
  canvasTex(scene, 'statue', 380, 1160, drawStatue);
  canvasTex(scene, 'pedestal', 340, 250, drawPedestal);
  canvasTex(scene, 'tower', TOWER.x1 - TOWER.x0 + 60, TOWER.bottom - TOWER.top + 190, drawTower);
  canvasTex(scene, 'organ', 300, 300, drawOrgan);
  canvasTex(scene, 'conch', 200, 150, drawConch);
  canvasTex(scene, 'clam_bottom', 260, 70, (c, w, h) => drawClam(c, w, h, 'bottom'));
  canvasTex(scene, 'clam_top', 260, 110, (c, w, h) => drawClam(c, w, h, 'top'));
  canvasTex(scene, 'pearl', 40, 40, (ctx) => {
    ctx.fillStyle = radial(ctx, 15, 14, 18, [[0, '#ffffff'], [0.6, '#f2e9ff'], [1, '#b9b0d6']]);
    ctx.beginPath();
    ctx.arc(20, 20, 16, 0, Math.PI * 2);
    ctx.fill();
  });
  canvasTex(scene, 'lamp', 30, 110, drawLamp);
  canvasTex(scene, 'grotto', GROTTO.ceiling.w + 60, 320, drawGrottoRock);
  canvasTex(scene, 'leg', 46, 1800, (ctx, w, h) => {
    ctx.fillStyle = linear(ctx, 0, 0, w, 0, [[0, '#4f6477'], [0.4, '#a9bac8'], [1, '#4f6477']]);
    ctx.fillRect(0, 0, w, h);
    const rand = rng(2);
    for (let i = 0; i < 30; i++) hangingAlgae(ctx, rand, rand() * w, rand() * h, 20 + rand() * 50);
  });

  for (let i = 0; i < 4; i++) canvasTex(scene, `rock_${i}`, 180 + i * 50, 110 + i * 30, (c, w, h) => drawRock(c, w, h, 200 + i));
  CORAL_COLORS.forEach((pal, i) => {
    canvasTex(scene, `coral_branch_${i}`, 170, 200, (c, w, h) => drawCoralBranch(c, w, h, 300 + i, pal));
    canvasTex(scene, `coral_fan_${i}`, 180, 170, (c, w, h) => drawFan(c, w, h, 400 + i, pal));
  });
  canvasTex(scene, 'coral_brain', 140, 80, (c, w, h) => drawBrain(c, w, h, ['#c97a4a', '#f2b07a']));
  canvasTex(scene, 'sponge', 150, 140, (c, w, h) => drawSponge(c, w, h, ['#7a3fb0', '#c08af0']));
  canvasTex(scene, 'anemone', 130, 110, (c, w, h) => drawAnemone(c, w, h, ['#ff5f8f', '#ffd0e0']));
  canvasTex(scene, 'seagrass', 90, 120, drawSeagrass);
  canvasTex(scene, 'flower', 48, 48, drawFlower);
  canvasTex(scene, 'sargassum', 280, 140, drawSargassum);
  canvasTex(scene, 'far_ruin', 700, 560, drawFarRuin);
  canvasTex(scene, 'far_ridge_0', 1800, 500, (c, w, h) => drawFarRidge(c, w, h, 7));
  canvasTex(scene, 'far_ridge_1', 1800, 420, (c, w, h) => drawFarRidge(c, w, h, 13));
}
