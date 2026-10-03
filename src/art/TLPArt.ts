import Phaser from 'phaser';
import { FONT_TITLE, FONT_UI } from '../config';
import { rng } from '../core/util';
import { canvasTex, Ctx, linear, radial } from './canvas';

/**
 * Procedural art for Melodía II — La Tenerife LanD Party: the (flooded) exhibition
 * hall, its desks full of gamers with snorkels, the stages, the people and props.
 * The real event's logo is never copied: every sign is plain text drawn here.
 */

const NEON = ['#ff3fd0', '#3fd8ff', '#8a5bff', '#3fff9f', '#ffb13f'];

function text(ctx: Ctx, s: string, x: number, y: number, size: number, color: string, o: { bold?: boolean; italic?: boolean; align?: CanvasTextAlign; font?: string; stroke?: string; sw?: number; glow?: string } = {}): void {
  ctx.save();
  ctx.font = `${o.italic ? 'italic ' : ''}${o.bold ? 'bold ' : ''}${size}px ${o.font ?? FONT_UI}`;
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = 'middle';
  if (o.glow) {
    ctx.shadowColor = o.glow;
    ctx.shadowBlur = size * 0.4;
  }
  if (o.stroke) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = o.sw ?? size * 0.15;
    ctx.strokeStyle = o.stroke;
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
  ctx.restore();
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Paints a small Coalición Delfinaria logo (reuses the procedural one). */
function logo(scene: Phaser.Scene, ctx: Ctx, cx: number, cy: number, h: number): void {
  const src = scene.textures.get('logo_cd').getSourceImage() as CanvasImageSource & { width: number; height: number };
  const w = (src.width / src.height) * h;
  ctx.drawImage(src, cx - w / 2, cy - h / 2, w, h);
}

// ------------------------------------------------------------------ people

export interface PersonStyle {
  skin: string;
  hair: string;
  hairStyle: 'short' | 'long' | 'bun' | 'cap' | 'spiky' | 'pigtails' | 'bald';
  top: string;
  pants: string;
  /** Text printed on the t-shirt. */
  print?: string;
  printColor?: string;
  kid?: boolean;
  headset?: string;
  lanyard?: boolean;
  extra?: 'cape' | 'armor' | 'robot' | 'wand' | 'idol' | 'tie' | 'clipboard' | 'phone' | 'none';
}

/** A standing person in a diving mask with a snorkel — the hall is flooded. Feet at the bottom centre. */
function person(ctx: Ctx, w: number, h: number, p: PersonStyle): void {
  const cx = w / 2;
  const k = p.kid ? 0.78 : 1;
  const base = h - 4;
  const legH = 70 * k;
  const bodyH = 78 * k;
  const headR = 30 * (p.kid ? 0.95 : 1);
  const bodyW = 64 * k;
  const bodyTop = base - legH - bodyH;
  const headY = bodyTop - headR + 6;

  if (p.extra === 'cape') {
    ctx.fillStyle = '#a3123a';
    ctx.beginPath();
    ctx.moveTo(cx - bodyW / 2 - 4, bodyTop + 8);
    ctx.lineTo(cx + bodyW / 2 + 4, bodyTop + 8);
    ctx.lineTo(cx + bodyW / 2 + 26, base - 6);
    ctx.lineTo(cx - bodyW / 2 - 26, base - 6);
    ctx.closePath();
    ctx.fill();
  }
  // legs + shoes
  ctx.fillStyle = p.pants;
  rr(ctx, cx - bodyW / 2 + 6, base - legH, bodyW / 2 - 9, legH, 8);
  ctx.fill();
  rr(ctx, cx + 3, base - legH, bodyW / 2 - 9, legH, 8);
  ctx.fill();
  ctx.fillStyle = '#f2f2f2';
  rr(ctx, cx - bodyW / 2 + 2, base - 12, bodyW / 2 - 2, 14, 6);
  ctx.fill();
  rr(ctx, cx + 2, base - 12, bodyW / 2 - 2, 14, 6);
  ctx.fill();
  // arms
  ctx.fillStyle = p.top;
  rr(ctx, cx - bodyW / 2 - 16, bodyTop + 8, 18, bodyH * 0.8, 9);
  ctx.fill();
  rr(ctx, cx + bodyW / 2 - 2, bodyTop + 8, 18, bodyH * 0.8, 9);
  ctx.fill();
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.arc(cx - bodyW / 2 - 7, bodyTop + bodyH * 0.8 + 10, 9, 0, Math.PI * 2);
  ctx.arc(cx + bodyW / 2 + 7, bodyTop + bodyH * 0.8 + 10, 9, 0, Math.PI * 2);
  ctx.fill();
  // torso
  ctx.fillStyle = p.top;
  rr(ctx, cx - bodyW / 2, bodyTop, bodyW, bodyH, 16);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  rr(ctx, cx + bodyW / 2 - 14, bodyTop + 4, 12, bodyH - 8, 8);
  ctx.fill();
  if (p.extra === 'armor') {
    ctx.fillStyle = '#b8bfc9';
    rr(ctx, cx - bodyW / 2 + 4, bodyTop + 6, bodyW - 8, bodyH * 0.6, 10);
    ctx.fill();
    ctx.strokeStyle = '#6d7480';
    ctx.lineWidth = 3;
    ctx.stroke();
    text(ctx, 'CARTÓN', cx, bodyTop + bodyH * 0.34, 11, '#5a5f68', { bold: true });
  }
  if (p.extra === 'robot') {
    ctx.fillStyle = '#9aa3ad';
    rr(ctx, cx - bodyW / 2 - 4, bodyTop - 4, bodyW + 8, bodyH + 8, 6);
    ctx.fill();
    ctx.fillStyle = '#e04646';
    ctx.fillRect(cx - 14, bodyTop + 16, 8, 8);
    ctx.fillStyle = '#46e07a';
    ctx.fillRect(cx + 4, bodyTop + 16, 8, 8);
    ctx.strokeStyle = '#5e666f';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) ctx.strokeRect(cx - 18, bodyTop + 34 + i * 12, 36, 8);
  }
  if (p.print) text(ctx, p.print, cx, bodyTop + bodyH * 0.42, p.print.length > 6 ? 12 : 16, p.printColor ?? '#ffffff', { bold: true });
  if (p.lanyard) {
    ctx.strokeStyle = '#ff3fd0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 12, bodyTop + 2);
    ctx.lineTo(cx, bodyTop + 40);
    ctx.lineTo(cx + 12, bodyTop + 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    rr(ctx, cx - 11, bodyTop + 38, 22, 28, 3);
    ctx.fill();
    ctx.fillStyle = '#3fd8ff';
    ctx.fillRect(cx - 8, bodyTop + 42, 16, 6);
  }
  if (p.extra === 'tie') {
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.moveTo(cx - 5, bodyTop + 4);
    ctx.lineTo(cx + 5, bodyTop + 4);
    ctx.lineTo(cx + 8, bodyTop + 46);
    ctx.lineTo(cx, bodyTop + 56);
    ctx.lineTo(cx - 8, bodyTop + 46);
    ctx.closePath();
    ctx.fill();
  }
  if (p.extra === 'clipboard') {
    ctx.fillStyle = '#8a5a2b';
    rr(ctx, cx + bodyW / 2 - 4, bodyTop + 30, 30, 40, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx + bodyW / 2, bodyTop + 36, 22, 30);
  }
  if (p.extra === 'wand') {
    ctx.strokeStyle = '#ffd36e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx + bodyW / 2 + 8, bodyTop + bodyH * 0.8 + 8);
    ctx.lineTo(cx + bodyW / 2 + 30, bodyTop - 20);
    ctx.stroke();
    ctx.fillStyle = '#ff8fd0';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 7 : 15;
      ctx.lineTo(cx + bodyW / 2 + 30 + Math.cos(a) * r, bodyTop - 26 + Math.sin(a) * r);
    }
    ctx.fill();
  }
  if (p.extra === 'phone') {
    ctx.fillStyle = '#1a1a22';
    rr(ctx, cx + bodyW / 2 + 1, bodyTop + bodyH * 0.6, 14, 24, 3);
    ctx.fill();
    ctx.fillStyle = '#9fe8ff';
    ctx.fillRect(cx + bodyW / 2 + 3, bodyTop + bodyH * 0.6 + 3, 10, 17);
  }

  // head
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  // hair
  ctx.fillStyle = p.hair;
  const hs = p.hairStyle;
  if (hs === 'long' || hs === 'pigtails') {
    rr(ctx, cx - headR - 4, headY - 6, headR * 2 + 8, headR * 1.7, 14);
    ctx.fill();
  }
  if (hs === 'pigtails') {
    ctx.beginPath();
    ctx.arc(cx - headR - 10, headY + 6, 13, 0, Math.PI * 2);
    ctx.arc(cx + headR + 10, headY + 6, 13, 0, Math.PI * 2);
    ctx.fill();
  }
  if (hs !== 'bald') {
    ctx.beginPath();
    ctx.arc(cx, headY - 4, headR + 2, Math.PI * 1.02, Math.PI * 1.98);
    ctx.closePath();
    ctx.fill();
  }
  if (hs === 'bun') {
    ctx.beginPath();
    ctx.arc(cx, headY - headR - 8, 13, 0, Math.PI * 2);
    ctx.fill();
  }
  if (hs === 'spiky') {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const x0 = cx - headR + i * (headR / 3);
      ctx.moveTo(x0, headY - headR + 6);
      ctx.lineTo(x0 + headR / 6, headY - headR - 16);
      ctx.lineTo(x0 + headR / 3, headY - headR + 6);
    }
    ctx.fill();
  }
  if (hs === 'cap') {
    ctx.fillStyle = p.top === '#1f1f2a' ? '#ff3fd0' : '#1f1f2a';
    ctx.beginPath();
    ctx.arc(cx, headY - 6, headR + 1, Math.PI, Math.PI * 2);
    ctx.fill();
    rr(ctx, cx - 4, headY - 12, headR + 22, 9, 4);
    ctx.fill();
  }
  if (p.extra === 'idol') {
    ctx.fillStyle = '#ffd36e';
    ctx.beginPath();
    ctx.arc(cx + headR - 6, headY - headR + 4, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // diving mask + snorkel
  ctx.fillStyle = '#20232b';
  ctx.fillRect(cx - headR, headY - 9, headR * 2, 6);
  ctx.fillStyle = 'rgba(160,230,255,0.75)';
  rr(ctx, cx - headR * 0.72, headY - 13, headR * 1.44, 20, 8);
  ctx.fill();
  ctx.strokeStyle = '#ffcf3f';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(cx - headR * 0.55, headY - 9, 7, 4);
  ctx.strokeStyle = '#ff8a1f';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + headR * 0.4, headY + 16);
  ctx.quadraticCurveTo(cx + headR + 8, headY + 18, cx + headR + 6, headY - 6);
  ctx.lineTo(cx + headR + 6, headY - headR - 18);
  ctx.stroke();
  // smile
  ctx.strokeStyle = 'rgba(60,30,20,0.7)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx - 4, headY + 12, 7, 0.2, Math.PI - 0.2);
  ctx.stroke();
  if (p.headset) {
    ctx.strokeStyle = p.headset;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, headY - 2, headR + 4, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.fillStyle = p.headset;
    rr(ctx, cx - headR - 9, headY - 6, 12, 22, 5);
    ctx.fill();
  }
  if (p.extra === 'robot') {
    ctx.strokeStyle = '#9aa3ad';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 10, headY - headR);
    ctx.lineTo(cx - 16, headY - headR - 22);
    ctx.stroke();
    ctx.fillStyle = '#e04646';
    ctx.beginPath();
    ctx.arc(cx - 16, headY - headR - 24, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A gamer seen from behind in a gaming chair (in front of the desks). */
function gamerBack(ctx: Ctx, w: number, h: number, hoodie: string, hair: string, chair: string): void {
  const cx = w / 2;
  // chair back
  ctx.fillStyle = '#16161e';
  rr(ctx, cx - 44, 40, 88, 104, 18);
  ctx.fill();
  ctx.fillStyle = chair;
  rr(ctx, cx - 30, 48, 14, 88, 6);
  ctx.fill();
  rr(ctx, cx + 16, 48, 14, 88, 6);
  ctx.fill();
  // shoulders + hood
  ctx.fillStyle = hoodie;
  rr(ctx, cx - 40, 34, 80, 56, 22);
  ctx.fill();
  // head + hair
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(cx, 26, 24, 0, Math.PI * 2);
  ctx.fill();
  // mask strap + snorkel
  ctx.fillStyle = '#20232b';
  ctx.fillRect(cx - 24, 22, 48, 6);
  ctx.strokeStyle = '#ff8a1f';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + 22, 30);
  ctx.lineTo(cx + 26, -2);
  ctx.stroke();
  // headset band
  ctx.strokeStyle = '#2a2a33';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, 26, 26, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  ctx.fillStyle = NEON[(hoodie.length + hair.length) % NEON.length];
  ctx.beginPath();
  ctx.arc(cx - 26, 30, 7, 0, Math.PI * 2);
  ctx.arc(cx + 26, 30, 7, 0, Math.PI * 2);
  ctx.fill();
  // chair base
  ctx.fillStyle = '#2a2a33';
  ctx.fillRect(cx - 4, 144, 8, h - 160);
  ctx.fillRect(cx - 34, h - 16, 68, 6);
}

// ------------------------------------------------------------------ textures

export function makeTLPTextures(scene: Phaser.Scene): void {
  // ---- hall structure
  canvasTex(scene, 'tlp_wall', 512, 512, (ctx, w, h) => {
    ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, '#141433'], [1, '#0d1d3d']]);
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(120,140,220,0.12)';
    ctx.lineWidth = 3;
    for (let x = 0; x <= w; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(120,140,220,0.06)';
    for (let y = 0; y <= h; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  });

  // night skyline through the windows: Anaga hills, the city and the Teide far away
  const city = (on: boolean) => (ctx: Ctx, w: number, h: number) => {
    ctx.fillStyle = linear(ctx, 0, 0, 0, h, on ? [[0, '#0b1240'], [0.7, '#3a2a6a'], [1, '#6a3a6a']] : [[0, '#050818'], [1, '#0d1028']]);
    ctx.fillRect(0, 0, w, h);
    const r = rng(7);
    ctx.fillStyle = on ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.95)';
    for (let i = 0; i < (on ? 30 : 90); i++) ctx.fillRect(r() * w, r() * h * 0.5, 2, 2);
    // Teide
    ctx.fillStyle = on ? '#24204a' : '#141530';
    ctx.beginPath();
    ctx.moveTo(w * 0.55, h * 0.75);
    ctx.lineTo(w * 0.72, h * 0.26);
    ctx.lineTo(w * 0.75, h * 0.22);
    ctx.lineTo(w * 0.78, h * 0.27);
    ctx.lineTo(w * 0.95, h * 0.75);
    ctx.fill();
    ctx.fillStyle = 'rgba(240,240,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(w * 0.72, h * 0.26);
    ctx.lineTo(w * 0.75, h * 0.22);
    ctx.lineTo(w * 0.78, h * 0.27);
    ctx.lineTo(w * 0.76, h * 0.3);
    ctx.lineTo(w * 0.74, h * 0.28);
    ctx.fill();
    // hills
    ctx.fillStyle = on ? '#1b1838' : '#0b0c1e';
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 32) ctx.lineTo(x, h * 0.6 + Math.sin(x * 0.012) * 18 + Math.sin(x * 0.031) * 10);
    ctx.lineTo(w, h);
    ctx.fill();
    // buildings
    const rb = rng(21);
    let x = 0;
    while (x < w) {
      const bw = 26 + rb() * 50;
      const bh = 40 + rb() * 120;
      ctx.fillStyle = on ? '#141230' : '#07081a';
      ctx.fillRect(x, h - bh, bw, bh);
      for (let wy = h - bh + 8; wy < h - 6; wy += 12) {
        for (let wx = x + 5; wx < x + bw - 6; wx += 10) {
          const lit = rb();
          if (on && lit < 0.55) {
            ctx.fillStyle = lit < 0.12 ? '#9fe8ff' : '#ffd88a';
            ctx.fillRect(wx, wy, 5, 6);
          } else if (!on && lit < 0.02) {
            ctx.fillStyle = 'rgba(255,240,200,0.5)'; // a few candles
            ctx.fillRect(wx, wy, 4, 5);
          }
        }
      }
      x += bw + 3 + rb() * 10;
    }
    if (on) {
      // the port lights and a glow over the city
      ctx.fillStyle = radial(ctx, w * 0.3, h, w * 0.4, [[0, 'rgba(255,170,90,0.35)'], [1, 'rgba(255,170,90,0)']]);
      ctx.fillRect(0, 0, w, h);
    }
  };
  canvasTex(scene, 'tlp_city', 1024, 260, city(true));
  canvasTex(scene, 'tlp_city_off', 1024, 260, city(false));

  canvasTex(scene, 'tlp_window', 512, 300, (ctx, w, h) => {
    // window frame (the city tile shows through the transparent panes)
    ctx.fillStyle = '#1b1b2e';
    ctx.fillRect(0, 0, w, 20);
    ctx.fillRect(0, h - 26, w, 26);
    for (let x = 0; x <= w; x += 128) ctx.fillRect(x - 6, 0, 12, h);
    ctx.fillRect(0, h * 0.5 - 4, w, 8);
  });

  canvasTex(scene, 'tlp_truss', 512, 96, (ctx, w, h) => {
    ctx.strokeStyle = '#4a4e60';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(w, 10);
    ctx.moveTo(0, h - 10);
    ctx.lineTo(w, h - 10);
    ctx.stroke();
    ctx.lineWidth = 5;
    for (let x = 0; x < w; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x + 32, h - 10);
      ctx.lineTo(x + 64, 10);
      ctx.stroke();
    }
    ctx.fillStyle = '#2a2d3a';
    ctx.fillRect(0, h - 4, w, 4);
  });

  canvasTex(scene, 'tlp_spot', 70, 70, (ctx) => {
    ctx.fillStyle = '#22242e';
    rr(ctx, 12, 6, 46, 44, 8);
    ctx.fill();
    ctx.fillStyle = '#3b3e4c';
    ctx.fillRect(30, 0, 10, 10);
    ctx.fillStyle = radial(ctx, 35, 50, 20, [[0, '#ffffff'], [1, 'rgba(255,255,255,0.1)']]);
    ctx.beginPath();
    ctx.ellipse(35, 52, 18, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  canvasTex(scene, 'tlp_floor', 512, 160, (ctx, w, h) => {
    ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, '#2b2d3c'], [0.15, '#1d1f2b'], [1, '#101119']]);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, 0, w, 4);
    // cables on the floor
    const r = rng(3);
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = ['#1f6fff', '#ffcf3f', '#ff4d6d', '#2a2a2a', '#3fff9f'][i];
      ctx.lineWidth = 3;
      ctx.beginPath();
      const y = 14 + i * 10 + r() * 6;
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 64) ctx.lineTo(x, y + Math.sin(x * 0.03 + i) * 3);
      ctx.stroke();
    }
  });

  // ---- LAN zone
  canvasTex(scene, 'tlp_table', 540, 230, (ctx, w, h) => {
    const r = rng(11);
    // PC towers with RGB under the table
    for (let i = 0; i < 3; i++) {
      const x = 40 + i * 170;
      ctx.fillStyle = '#121219';
      rr(ctx, x, h - 108, 56, 104, 6);
      ctx.fill();
      const c = NEON[(i + 2) % NEON.length];
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.85;
      rr(ctx, x + 8, h - 98, 40, 70, 5);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#121219';
      ctx.beginPath();
      ctx.arc(x + 28, h - 76, 13, 0, Math.PI * 2);
      ctx.arc(x + 28, h - 46, 13, 0, Math.PI * 2);
      ctx.fill();
    }
    // legs + top
    ctx.fillStyle = '#3a3c48';
    ctx.fillRect(14, 118, 10, h - 118);
    ctx.fillRect(w - 24, 118, 10, h - 118);
    ctx.fillStyle = '#e9e9ee';
    ctx.fillRect(0, 108, w, 14);
    ctx.fillStyle = '#b9bac4';
    ctx.fillRect(0, 122, w, 6);
    // monitors facing us, each with a different game on screen
    for (let i = 0; i < 3; i++) {
      const x = 22 + i * 172;
      ctx.fillStyle = '#0d0d12';
      rr(ctx, x, 6, 150, 92, 6);
      ctx.fill();
      const scr = linear(ctx, x, 10, x, 94, [[0, ['#2b6bff', '#ff3f7a', '#2bd17a'][i]], [1, ['#0a1a4a', '#3a0a2a', '#0a3a2a'][i]]]);
      ctx.fillStyle = scr;
      ctx.fillRect(x + 6, 12, 138, 78);
      // little game shapes
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let k = 0; k < 6; k++) ctx.fillRect(x + 12 + r() * 120, 18 + r() * 60, 6 + r() * 14, 4 + r() * 8);
      ctx.fillStyle = '#ffde59';
      ctx.fillRect(x + 10, 16, 40, 5);
      ctx.fillStyle = '#2a2a33';
      ctx.fillRect(x + 70, 98, 10, 10);
      // keyboard RGB strip
      ctx.fillStyle = NEON[i];
      ctx.fillRect(x + 20, 104, 110, 4);
    }
  });
  const hoodies = ['#1f1f2a', '#6a2bd1', '#2b6bff', '#d12b6a'];
  const hairs = ['#2a1a10', '#d8b04a', '#5a2a1a', '#101010'];
  const chairs = ['#ff3fd0', '#3fd8ff', '#3fff9f', '#ffb13f'];
  for (let i = 0; i < 4; i++) canvasTex(scene, `tlp_gamer_${i}`, 110, 200, (ctx, w, h) => gamerBack(ctx, w, h, hoodies[i], hairs[i], chairs[i]));

  canvasTex(scene, 'tlp_scaffold', 256, 520, (ctx, w, h) => {
    ctx.strokeStyle = '#5a5e70';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.lineWidth = 5;
    for (let y = 8; y < h - 8; y += 128) {
      ctx.beginPath();
      ctx.moveTo(8, y);
      ctx.lineTo(w - 8, y + 128);
      ctx.moveTo(w - 8, y);
      ctx.lineTo(8, y + 128);
      ctx.stroke();
    }
  });
  canvasTex(scene, 'tlp_deck', 512, 40, (ctx, w, h) => {
    ctx.fillStyle = '#3a3d4c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffcf3f';
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + 20, 0);
      ctx.lineTo(x + 32, 0);
      ctx.lineTo(x + 12, h);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 10, w, h - 20);
    ctx.fillStyle = '#5a5e70';
    ctx.fillRect(0, 0, w, 6);
  });

  // the main router: a tall rack with blinking lights and a "do not touch" sign
  canvasTex(scene, 'tlp_rack', 250, 560, (ctx, w, h) => {
    ctx.fillStyle = '#0f1016';
    rr(ctx, 10, 10, w - 20, h - 20, 10);
    ctx.fill();
    ctx.strokeStyle = '#3b3f50';
    ctx.lineWidth = 6;
    ctx.stroke();
    const r = rng(5);
    for (let u = 0; u < 13; u++) {
      const y = 60 + u * 34;
      ctx.fillStyle = '#1c1e28';
      ctx.fillRect(26, y, w - 52, 28);
      for (let p = 0; p < 12; p++) {
        ctx.fillStyle = r() < 0.6 ? (r() < 0.5 ? '#3fff9f' : '#ffb13f') : '#2a2d3a';
        ctx.fillRect(36 + p * 15, y + 9, 8, 8);
      }
    }
    // cables
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = NEON[i % NEON.length];
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(40 + i * 30, 70);
      ctx.bezierCurveTo(10 + i * 10, 200, w - 20, 300, 30 + i * 32, h - 20);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffcf3f';
    rr(ctx, 30, 18, w - 60, 34, 4);
    ctx.fill();
    text(ctx, 'ROUTER PRINCIPAL', w / 2, 30, 14, '#111', { bold: true });
    text(ctx, 'NO TOCAR', w / 2, 45, 11, '#c0392b', { bold: true });
  });

  // ---- signage
  canvasTex(scene, 'tlp_banner_main', 1100, 190, (ctx, w, h) => {
    ctx.fillStyle = linear(ctx, 0, 0, w, 0, [[0, '#2a0f5a'], [0.5, '#1a2a8a'], [1, '#0a5a7a']]);
    rr(ctx, 6, 6, w - 12, h - 12, 18);
    ctx.fill();
    ctx.strokeStyle = '#3fd8ff';
    ctx.lineWidth = 5;
    ctx.stroke();
    text(ctx, 'BIENVENIDOS A LA', w / 2, 38, 26, '#cfe6ff', { bold: true });
    // "TENERIFE LAN" + the extra D Rosa ordered, crossed out with tape by the organisers
    ctx.font = `bold 78px ${FONT_UI}`;
    const a = 'TENERIFE LAN';
    const b = 'D';
    const c = ' PARTY';
    const wa = ctx.measureText(a).width;
    const wb = ctx.measureText(b).width;
    const wc = ctx.measureText(c).width;
    let x = w / 2 - (wa + wb + wc) / 2;
    const y = 112;
    text(ctx, a, x, y, 78, '#ffffff', { bold: true, align: 'left', glow: '#3fd8ff' });
    x += wa;
    text(ctx, b, x, y, 78, '#ff6fd0', { bold: true, align: 'left' });
    ctx.save();
    ctx.translate(x + wb / 2, y);
    ctx.rotate(-0.5);
    ctx.fillStyle = 'rgba(250,240,200,0.92)';
    ctx.fillRect(-wb * 0.9, -12, wb * 1.8, 24);
    ctx.restore();
    x += wb;
    text(ctx, c, x, y, 78, '#ffffff', { bold: true, align: 'left', glow: '#3fd8ff' });
    text(ctx, '1ª EDICIÓN ACUÁTICA · RECINTO FERIAL', w / 2, 166, 20, '#9fe8ff', { bold: true });
  });

  canvasTex(scene, 'tlp_banner_cd', 640, 230, (ctx, w, h) => {
    ctx.fillStyle = '#f7f7fa';
    rr(ctx, 6, 6, w - 12, h - 12, 14);
    ctx.fill();
    ctx.fillStyle = '#1a62c9';
    ctx.beginPath();
    ctx.roundRect(6, 6, w - 12, 50, [14, 14, 0, 0]);
    ctx.fill();
    text(ctx, 'CON LA COLABORACIÓN DE', w / 2, 31, 24, '#ffffff', { bold: true });
    // logo plate (dark so the white logo text reads)
    ctx.fillStyle = '#0d2350';
    rr(ctx, 26, 68, 150, 146, 12);
    ctx.fill();
    logo(scene, ctx, 101, 141, 132);
    text(ctx, 'COALICIÓN', 410, 110, 50, '#1a62c9', { bold: true });
    text(ctx, 'DELFINARIA', 410, 162, 50, '#1a62c9', { bold: true });
    text(ctx, '(esto lo paga Rosa)', 410, 200, 18, '#7a8496', { italic: true });
  });

  canvasTex(scene, 'tlp_poster', 300, 400, (ctx, w, h) => {
    ctx.fillStyle = '#1a62c9';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#a3cc14';
    ctx.fillRect(0, h - 70, w, 70);
    ctx.fillStyle = radial(ctx, w / 2, 150, 120, [[0, 'rgba(255,230,140,0.9)'], [1, 'rgba(255,230,140,0)']]);
    ctx.fillRect(0, 20, w, 260);
    logo(scene, ctx, w / 2, 150, 210);
    text(ctx, 'ESTO LO', w / 2, 290, 40, '#ffffff', { bold: true, stroke: '#0d2350', sw: 6 });
    text(ctx, 'PAGO YO', w / 2, 334, 40, '#ffe08a', { bold: true, stroke: '#0d2350', sw: 6 });
    text(ctx, '— Rosa, presidenta', w / 2, 372, 20, '#0d2350', { bold: true, italic: true });
  });

  const zoneSign = (key: string, title: string, sub: string, c1: string, c2: string) =>
    canvasTex(scene, key, 760, 170, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(8,8,24,0.85)';
      rr(ctx, 6, 6, w - 12, h - 12, 22);
      ctx.fill();
      ctx.strokeStyle = c1;
      ctx.lineWidth = 6;
      ctx.shadowColor = c1;
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.shadowBlur = 0;
      text(ctx, title, w / 2, 72, 66, '#ffffff', { bold: true, glow: c1 });
      text(ctx, sub, w / 2, 134, 24, c2, { bold: true });
    });
  zoneSign('tlp_sign_lan', 'ZONA LAN', '1.200 PUESTOS · AHORA CON SNORKEL', '#3fd8ff', '#9fe8ff');
  zoneSign('tlp_sign_summer', 'SUMMER-CON', 'CONCURSO DE COSPLAY', '#ffb13f', '#ffe08a');
  zoneSign('tlp_sign_kpop', 'K-POP DANCE', 'RANDOM PLAY DANCE · ¡TODOS A BAILAR!', '#ff3fd0', '#ffb3e8');
  zoneSign('tlp_sign_innova', 'TLP INNOVA', 'CHARLAS · EMPRENDIMIENTO · FUTURO', '#3fff9f', '#b5ffd8');

  canvasTex(scene, 'tlp_innova_screen', 620, 340, (ctx, w, h) => {
    ctx.fillStyle = '#0d0d14';
    rr(ctx, 0, 0, w, h, 12);
    ctx.fill();
    ctx.fillStyle = linear(ctx, 0, 0, w, h, [[0, '#0f3a2a'], [1, '#0a1a3a']]);
    ctx.fillRect(14, 14, w - 28, h - 28);
    text(ctx, 'PONENCIA', w / 2, 52, 22, '#3fff9f', { bold: true });
    text(ctx, 'Blockchain, metaverso e IA', w / 2, 112, 36, '#ffffff', { bold: true });
    text(ctx, 'aplicados a la gestión', w / 2, 156, 36, '#ffffff', { bold: true });
    text(ctx, 'de rotondas', w / 2, 200, 36, '#ffffff', { bold: true });
    text(ctx, 'Ponente: Rosa, presidenta (experta en todo)', w / 2, 262, 20, '#b5ffd8', { italic: true });
    text(ctx, '¿Preguntas? → #TLPInnova', w / 2, 300, 18, '#7fa8c9');
  });

  canvasTex(scene, 'tlp_podium', 170, 200, (ctx, w, h) => {
    ctx.fillStyle = '#e9e9ee';
    ctx.beginPath();
    ctx.moveTo(10, 30);
    ctx.lineTo(w - 10, 30);
    ctx.lineTo(w - 26, h);
    ctx.lineTo(26, h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3fff9f';
    ctx.fillRect(26, 70, w - 52, 10);
    text(ctx, 'INNOVA', w / 2, 120, 26, '#1a1a22', { bold: true });
    ctx.strokeStyle = '#2a2a33';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w / 2, 30);
    ctx.lineTo(w / 2 + 20, 2);
    ctx.stroke();
  });

  canvasTex(scene, 'tlp_chairs', 600, 120, (ctx, w, h) => {
    // audience: a row of heads and chair backs seen from behind
    const r = rng(17);
    for (let i = 0; i < 8; i++) {
      const x = 40 + i * 74;
      ctx.fillStyle = '#20222c';
      rr(ctx, x - 30, 50, 60, 70, 10);
      ctx.fill();
      ctx.fillStyle = ['#2a1a10', '#d8b04a', '#5a2a1a', '#101010', '#8a4a2a'][Math.floor(r() * 5)];
      ctx.beginPath();
      ctx.arc(x, 40, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff8a1f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x + 18, 44);
      ctx.lineTo(x + 20, 12);
      ctx.stroke();
    }
  });

  canvasTex(scene, 'tlp_cosstage', 720, 200, (ctx, w, h) => {
    ctx.fillStyle = '#5a1a3a';
    ctx.fillRect(0, 30, w, h - 30);
    ctx.fillStyle = '#ffb13f';
    ctx.fillRect(0, 22, w, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    for (let x = 0; x < w; x += 60) ctx.fillRect(x, 40, 30, h - 40);
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = i % 2 ? '#ffe08a' : '#ff8fd0';
      ctx.beginPath();
      ctx.arc(40 + i * 80, 28, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  canvasTex(scene, 'tlp_judges', 420, 150, (ctx, w, h) => {
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(0, 60, w, h - 60);
    ctx.fillStyle = '#ffb13f';
    ctx.fillRect(0, 52, w, 10);
    text(ctx, 'JURADO', w / 2, 104, 34, '#ffe08a', { bold: true });
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#ffffff';
      rr(ctx, 50 + i * 120, 10, 70, 44, 6);
      ctx.fill();
      text(ctx, ['9', '8', '10'][i], 85 + i * 120, 32, 30, '#c0392b', { bold: true });
    }
  });
  canvasTex(scene, 'tlp_diploma', 220, 160, (ctx, w, h) => {
    ctx.fillStyle = '#fff8e0';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c99a2a';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    text(ctx, 'DIPLOMA', w / 2, 44, 28, '#7a5a1a', { bold: true, font: FONT_TITLE });
    text(ctx, 'de participación', w / 2, 82, 20, '#7a5a1a', { italic: true, font: FONT_TITLE });
    text(ctx, '(como todos)', w / 2, 122, 16, '#a08050', { italic: true });
  });

  canvasTex(scene, 'tlp_dancefloor', 700, 90, (ctx, w, h) => {
    for (let i = 0; i < 14; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = NEON[(i + j * 2) % NEON.length];
        ctx.globalAlpha = 0.75;
        ctx.fillRect(i * 50 + 2, 20 + j * 34 + 2, 46, 30);
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2a2a33';
    ctx.fillRect(0, 0, w, 20);
  });
  canvasTex(scene, 'tlp_boombox', 240, 150, (ctx, w, h) => {
    ctx.fillStyle = '#1a1a22';
    rr(ctx, 4, 30, w - 8, h - 34, 16);
    ctx.fill();
    ctx.strokeStyle = '#ff3fd0';
    ctx.lineWidth = 4;
    ctx.stroke();
    for (const x of [62, w - 62]) {
      ctx.fillStyle = '#2a2a36';
      ctx.beginPath();
      ctx.arc(x, 92, 44, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff3fd0';
      ctx.beginPath();
      ctx.arc(x, 92, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#3fd8ff';
    ctx.fillRect(w / 2 - 22, 60, 44, 20);
    ctx.strokeStyle = '#5a5e70';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(50, 32);
    ctx.lineTo(70, 6);
    ctx.lineTo(w - 70, 6);
    ctx.lineTo(w - 50, 32);
    ctx.stroke();
  });

  // ---- main stage
  canvasTex(scene, 'tlp_stage', 1160, 420, (ctx, w, h) => {
    ctx.fillStyle = '#121218';
    ctx.fillRect(0, 40, w, h - 40);
    ctx.fillStyle = '#2a2a36';
    ctx.fillRect(0, 26, w, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let x = 0; x < w; x += 24) ctx.fillRect(x, 60, 12, h - 60);
    ctx.fillStyle = '#3fd8ff';
    ctx.fillRect(0, 44, w, 4);
    text(ctx, 'ESCENARIO PRINCIPAL', w / 2, 150, 34, 'rgba(255,255,255,0.35)', { bold: true });
  });
  canvasTex(scene, 'tlp_speaker', 170, 420, (ctx, w, h) => {
    for (let i = 0; i < 3; i++) {
      const y = i * 140;
      ctx.fillStyle = '#16161c';
      rr(ctx, 4, y + 4, w - 8, 132, 8);
      ctx.fill();
      ctx.fillStyle = '#2a2a33';
      ctx.beginPath();
      ctx.arc(w / 2, y + 76, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0d0d12';
      ctx.beginPath();
      ctx.arc(w / 2, y + 76, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a2a33';
      ctx.beginPath();
      ctx.arc(w / 2, y + 22, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  canvasTex(scene, 'tlp_screen_frame', 1000, 580, (ctx, w, h) => {
    ctx.fillStyle = '#0a0a0e';
    rr(ctx, 0, 0, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = '#4a4e60';
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.fillStyle = '#05050a';
    ctx.fillRect(24, 24, w - 48, h - 48);
    // LED grid
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let x = 24; x < w - 24; x += 12) ctx.fillRect(x, 24, 2, h - 48);
  });
  canvasTex(scene, 'tlp_screen_text', 940, 520, (ctx, w, h) => {
    ctx.fillStyle = linear(ctx, 0, 0, w, h, [[0, '#2a0f5a'], [1, '#0a3a6a']]);
    ctx.fillRect(0, 0, w, h);
    text(ctx, 'TENERIFE', w / 2, 150, 110, '#ffffff', { bold: true, glow: '#3fd8ff' });
    text(ctx, 'LanD PARTY', w / 2, 270, 110, '#ff6fd0', { bold: true, glow: '#ff3fd0' });
    text(ctx, 'patrocina: COALICIÓN DELFINARIA', w / 2, 380, 34, '#9fe8ff', { bold: true });
    text(ctx, '(la pantalla la pagó ella, así que pone lo que ella dijo)', w / 2, 440, 22, 'rgba(255,255,255,0.6)', { italic: true });
  });
  canvasTex(scene, 'tlp_screen_logo', 940, 520, (ctx, w, h) => {
    ctx.fillStyle = radial(ctx, w / 2, h / 2, w * 0.6, [[0, '#1a4aa9'], [1, '#081a44']]);
    ctx.fillRect(0, 0, w, h);
    logo(scene, ctx, w / 2 - 170, h / 2, 440);
    text(ctx, '¡GRACIAS,', w / 2 + 210, h / 2 - 70, 64, '#ffffff', { bold: true, glow: '#ffd36e' });
    text(ctx, 'ROSA!', w / 2 + 210, h / 2 + 20, 92, '#ffe08a', { bold: true, glow: '#ffd36e' });
    text(ctx, 'VOTA DELFÍN', w / 2 + 210, h / 2 + 110, 34, '#a3cc14', { bold: true });
  });
  canvasTex(scene, 'tlp_mic', 70, 300, (ctx, w, h) => {
    ctx.strokeStyle = '#2a2a33';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(w / 2, 40);
    ctx.lineTo(w / 2, h - 10);
    ctx.stroke();
    ctx.fillRect(w / 2 - 26, h - 12, 52, 8);
    ctx.fillStyle = '#4a4e60';
    rr(ctx, w / 2 - 12, 4, 24, 44, 12);
    ctx.fill();
    ctx.fillStyle = '#8a8e9c';
    for (let y = 10; y < 40; y += 6) ctx.fillRect(w / 2 - 9, y, 18, 2);
  });
  canvasTex(scene, 'tlp_generator', 380, 240, (ctx, w, h) => {
    ctx.fillStyle = '#ffcf3f';
    rr(ctx, 10, 40, w - 20, h - 60, 14);
    ctx.fill();
    ctx.strokeStyle = '#7a5a10';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = '#1a62c9';
    ctx.fillRect(10, 90, w - 20, 70);
    text(ctx, 'GENERADOR', w / 2, 112, 28, '#ffffff', { bold: true });
    text(ctx, 'COALICIÓN DELFINARIA', w / 2, 142, 20, '#ffe08a', { bold: true });
    ctx.fillStyle = '#2a2a33';
    ctx.fillRect(w - 80, 10, 22, 40);
    ctx.fillRect(40, h - 24, 50, 20);
    ctx.fillRect(w - 90, h - 24, 50, 20);
    text(ctx, '(solo para la pantalla)', w / 2, 192, 17, '#5a4a10', { italic: true });
  });
  canvasTex(scene, 'tlp_crowd', 1300, 240, (ctx, w, h) => {
    const r = rng(29);
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 26; i++) {
        const x = i * 52 + (row ? 26 : 0) + r() * 10;
        const y = 70 + row * 60 + r() * 16;
        ctx.fillStyle = row ? '#06060c' : '#0e0e18';
        ctx.beginPath();
        ctx.arc(x, y, 24, 0, Math.PI * 2);
        ctx.fill();
        rr(ctx, x - 34, y + 18, 68, h, 22);
        ctx.fill();
        // snorkels
        ctx.strokeStyle = row ? '#1a1a22' : '#25252f';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x + 20, y + 4);
        ctx.lineTo(x + 22, y - 30);
        ctx.stroke();
        if (r() < 0.35) {
          // raised arm
          ctx.beginPath();
          ctx.lineWidth = 12;
          ctx.moveTo(x - 26, y + 30);
          ctx.lineTo(x - 40, y - 40);
          ctx.stroke();
        }
      }
    }
  });
  canvasTex(scene, 'tlp_beacon', 40, 40, (ctx) => {
    ctx.fillStyle = '#5a1010';
    ctx.fillRect(8, 24, 24, 14);
    ctx.fillStyle = '#ff3030';
    ctx.beginPath();
    ctx.arc(20, 22, 12, Math.PI, Math.PI * 2);
    ctx.fill();
  });

  // ---- cosplay pieces (collected with the sonar, then worn by Rosa)
  canvasTex(scene, 'tlp_crown', 90, 70, (ctx, w, h) => {
    ctx.fillStyle = '#ffd36e';
    ctx.beginPath();
    ctx.moveTo(6, h - 8);
    ctx.lineTo(10, 16);
    ctx.lineTo(28, 38);
    ctx.lineTo(45, 6);
    ctx.lineTo(62, 38);
    ctx.lineTo(80, 16);
    ctx.lineTo(84, h - 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#a8761a';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#ff3f7a';
    ctx.beginPath();
    ctx.arc(45, 46, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3fd8ff';
    ctx.beginPath();
    ctx.arc(24, 50, 5, 0, Math.PI * 2);
    ctx.arc(66, 50, 5, 0, Math.PI * 2);
    ctx.fill();
  });
  canvasTex(scene, 'tlp_cape', 120, 110, (ctx, w, h) => {
    ctx.fillStyle = linear(ctx, 0, 0, w, h, [[0, '#d1124a'], [1, '#7a0a2a']]);
    ctx.beginPath();
    ctx.moveTo(30, 6);
    ctx.lineTo(90, 6);
    ctx.quadraticCurveTo(122, 60, 110, h - 6);
    ctx.quadraticCurveTo(60, h - 20, 10, h - 6);
    ctx.quadraticCurveTo(0, 60, 30, 6);
    ctx.fill();
    ctx.fillStyle = '#ffd36e';
    ctx.fillRect(30, 4, 60, 8);
  });
  canvasTex(scene, 'tlp_trident', 60, 170, (ctx, w, h) => {
    ctx.strokeStyle = '#ffd36e';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w / 2, 40);
    ctx.lineTo(w / 2, h - 6);
    ctx.moveTo(10, 10);
    ctx.lineTo(10, 40);
    ctx.lineTo(w - 10, 40);
    ctx.lineTo(w - 10, 10);
    ctx.moveTo(w / 2, 40);
    ctx.lineTo(w / 2, 4);
    ctx.stroke();
  });

  // ---- people
  const P: Record<string, PersonStyle> = {
    organizer: { skin: '#e8b48a', hair: '#2a1a10', hairStyle: 'bun', top: '#ff3fd0', pants: '#1f1f2a', print: 'STAFF', lanyard: true, extra: 'clipboard' },
    kevin: { skin: '#f0c49a', hair: '#d8b04a', hairStyle: 'cap', top: '#2b6bff', pants: '#3a3a4a', print: 'PRO', kid: true, headset: '#3fff9f' },
    telepera: { skin: '#c98a5a', hair: '#5a2a1a', hairStyle: 'pigtails', top: '#6a2bd1', pants: '#1f1f2a', print: 'GG EZ', headset: '#ff3fd0', lanyard: true },
    telepero: { skin: '#f0c49a', hair: '#101010', hairStyle: 'spiky', top: '#1f1f2a', pants: '#2a3a5a', print: 'AFK', headset: '#3fd8ff' },
    judge: { skin: '#e8b48a', hair: '#8a8a8a', hairStyle: 'short', top: '#ffb13f', pants: '#2a2a3a', print: 'JURADO', printColor: '#3a1a00', extra: 'clipboard' },
    moderator: { skin: '#c98a5a', hair: '#101010', hairStyle: 'short', top: '#e9e9ee', pants: '#1f1f2a', extra: 'tie', lanyard: true },
    dancer_0: { skin: '#f0c49a', hair: '#ff8fd0', hairStyle: 'long', top: '#ff3fd0', pants: '#ffffff', extra: 'idol' },
    dancer_1: { skin: '#e8b48a', hair: '#101010', hairStyle: 'spiky', top: '#8a5bff', pants: '#1f1f2a', extra: 'idol' },
    dancer_2: { skin: '#c98a5a', hair: '#3fd8ff', hairStyle: 'bun', top: '#3fd8ff', pants: '#ffffff', extra: 'idol' },
    cos_knight: { skin: '#f0c49a', hair: '#5a2a1a', hairStyle: 'short', top: '#6d7480', pants: '#4a4e5a', extra: 'armor' },
    cos_magic: { skin: '#e8b48a', hair: '#ffd36e', hairStyle: 'pigtails', top: '#ff8fd0', pants: '#ffffff', extra: 'wand' },
    cos_robot: { skin: '#c98a5a', hair: '#101010', hairStyle: 'bald', top: '#9aa3ad', pants: '#6d7480', extra: 'robot' },
    fan_0: { skin: '#f0c49a', hair: '#2a1a10', hairStyle: 'long', top: '#3fff9f', pants: '#1f1f2a', extra: 'phone' },
    fan_1: { skin: '#c98a5a', hair: '#101010', hairStyle: 'cap', top: '#ffb13f', pants: '#2a3a5a', extra: 'phone' },
  };
  for (const [k, p] of Object.entries(P)) canvasTex(scene, `tlp_${k}`, 150, 260, (ctx, w, h) => person(ctx, w, h, p));
}
