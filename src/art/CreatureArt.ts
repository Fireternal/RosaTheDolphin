import Phaser from 'phaser';
import { canvasTex, Ctx, linear, radial } from './canvas';

function eye(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#10182c';
  ctx.beginPath();
  ctx.arc(x + r * 0.15, y + r * 0.1, r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + r * 0.35, y - r * 0.3, r * 0.25, 0, Math.PI * 2);
  ctx.fill();
}

/** All texture art faces RIGHT. */
export function makeCreatureTextures(scene: Phaser.Scene): void {
  // Lumi — a small glowing seahorse, the guide.
  canvasTex(scene, 'lumi', 80, 120, (ctx) => {
    const body = new Path2D();
    body.moveTo(46, 14);
    body.bezierCurveTo(64, 10, 74, 22, 70, 32); // snout top
    body.lineTo(76, 34);
    body.lineTo(74, 40);
    body.bezierCurveTo(64, 40, 58, 40, 56, 44);
    body.bezierCurveTo(62, 58, 60, 76, 48, 86); // belly
    body.bezierCurveTo(40, 96, 46, 108, 56, 106);
    body.bezierCurveTo(62, 104, 60, 96, 54, 98);
    body.bezierCurveTo(44, 100, 40, 92, 38, 84);
    body.bezierCurveTo(30, 70, 30, 50, 34, 36);
    body.bezierCurveTo(32, 24, 38, 16, 46, 14);
    body.closePath();
    ctx.fillStyle = linear(ctx, 30, 10, 70, 100, [[0, '#ffd2a6'], [0.5, '#ff9fb4'], [1, '#e77aa7']]);
    ctx.fill(body);
    ctx.strokeStyle = 'rgba(150,50,90,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke(body);
    // belly ridges
    ctx.strokeStyle = 'rgba(255,240,220,0.7)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(46, 52 + i * 6, 10, -0.2, 0.6);
      ctx.stroke();
    }
    // crown spikes
    ctx.fillStyle = '#ffe08a';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(38 + i * 5, 18 - (i % 2) * 2);
      ctx.lineTo(36 + i * 5, 6 + (i % 2) * 3);
      ctx.lineTo(42 + i * 5, 16);
      ctx.fill();
    }
    // dorsal fin
    ctx.fillStyle = 'rgba(255,240,160,0.75)';
    ctx.beginPath();
    ctx.ellipse(30, 60, 6, 12, 0.2, 0, Math.PI * 2);
    ctx.fill();
    eye(ctx, 54, 26, 6);
  });

  // Doña Marea — a wise sea turtle.
  const turtle = (ctx: Ctx, w: number, h: number, baby: boolean): void => {
    const s = w / 240;
    ctx.save();
    ctx.scale(s, s);
    // back flipper
    ctx.fillStyle = '#6f9a5c';
    ctx.beginPath();
    ctx.ellipse(56, 104, 30, 13, 0.6, 0, Math.PI * 2);
    ctx.fill();
    // front flipper
    ctx.fillStyle = '#7fae69';
    ctx.beginPath();
    ctx.ellipse(160, 108, 50, 16, 0.5, 0, Math.PI * 2);
    ctx.fill();
    // head
    ctx.fillStyle = linear(ctx, 180, 50, 230, 100, [[0, '#9ccc7c'], [1, '#5f8c4c']]);
    ctx.beginPath();
    ctx.ellipse(205, 72, 30, 22, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,70,30,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(220, 84);
    ctx.quadraticCurveTo(228, 86, 234, 80);
    ctx.stroke();
    eye(ctx, 214, 64, baby ? 8 : 6.5);
    if (!baby) {
      // wise eyelid
      ctx.fillStyle = '#7aa862';
      ctx.beginPath();
      ctx.ellipse(214, 60, 8, 4, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    }
    // shell
    const shell = new Path2D();
    shell.moveTo(30, 92);
    shell.bezierCurveTo(40, 20, 170, 10, 190, 88);
    shell.bezierCurveTo(140, 104, 80, 106, 30, 92);
    shell.closePath();
    ctx.fillStyle = linear(ctx, 0, 20, 0, 100, [[0, baby ? '#b9a25a' : '#a4874a'], [1, '#5d4a26']]);
    ctx.fill(shell);
    ctx.save();
    ctx.clip(shell);
    ctx.strokeStyle = 'rgba(255,230,170,0.45)';
    ctx.lineWidth = 3;
    const plates: [number, number, number][] = [[80, 58, 24], [120, 50, 26], [158, 66, 20], [50, 76, 18], [104, 86, 20], [140, 90, 16]];
    for (const [x, y, r] of plates) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r * 0.8;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(40,30,15,0.6)';
    ctx.lineWidth = 2.5;
    ctx.stroke(shell);
    // belly rim
    ctx.fillStyle = '#e8d9a4';
    ctx.beginPath();
    ctx.moveTo(30, 92);
    ctx.bezierCurveTo(80, 108, 140, 104, 190, 88);
    ctx.bezierCurveTo(140, 116, 80, 116, 30, 92);
    ctx.fill();
    if (!baby) {
      // a little knitted scarf: she's the grandmother of the Rotonda
      ctx.fillStyle = '#c4473f';
      ctx.beginPath();
      ctx.ellipse(186, 82, 10, 20, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };
  canvasTex(scene, 'turtle', 240, 140, (c, w, h) => turtle(c, w, h, false));
  canvasTex(scene, 'turtle_baby', 108, 64, (c, w, h) => turtle(c, w, h, true));

  // Fish
  const fish = (ctx: Ctx, w: number, h: number, body: string[], stripes: string | null, stripeCount: number): void => {
    const p = new Path2D();
    p.moveTo(w - 2, h / 2);
    p.bezierCurveTo(w - 10, 2, 16, 0, 12, h / 2);
    p.bezierCurveTo(16, h, w - 10, h - 2, w - 2, h / 2);
    p.closePath();
    // tail
    ctx.fillStyle = body[1];
    ctx.beginPath();
    ctx.moveTo(16, h / 2);
    ctx.lineTo(0, 2);
    ctx.lineTo(4, h / 2);
    ctx.lineTo(0, h - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, body[0]], [1, body[1]]]);
    ctx.fill(p);
    if (stripes) {
      ctx.save();
      ctx.clip(p);
      ctx.fillStyle = stripes;
      for (let i = 0; i < stripeCount; i++) ctx.fillRect(18 + i * ((w - 26) / stripeCount), 0, 4, h);
      ctx.restore();
    }
    eye(ctx, w - 10, h / 2 - 2, 3);
  };
  canvasTex(scene, 'fish_0', 48, 26, (c, w, h) => fish(c, w, h, ['#ffe36a', '#f2a93c'], 'rgba(30,30,40,0.85)', 3));
  canvasTex(scene, 'fish_1', 44, 24, (c, w, h) => fish(c, w, h, ['#ff9a4a', '#e8572c'], 'rgba(255,255,255,0.95)', 3));
  canvasTex(scene, 'fish_2', 46, 26, (c, w, h) => fish(c, w, h, ['#5aa8ff', '#2a4fc0'], null, 0));
  canvasTex(scene, 'fish_3', 40, 22, (c, w, h) => fish(c, w, h, ['#c9f2ff', '#7fc8e6'], null, 0));

  // Jellyfish
  canvasTex(scene, 'jelly', 90, 140, (ctx) => {
    ctx.strokeStyle = 'rgba(220,200,255,0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const x = 18 + i * 9;
      ctx.beginPath();
      ctx.moveTo(x, 50);
      ctx.bezierCurveTo(x - 8, 80, x + 8, 100, x - 2, 136);
      ctx.stroke();
    }
    ctx.fillStyle = radial(ctx, 45, 30, 44, [[0, 'rgba(255,240,255,0.95)'], [0.6, 'rgba(210,170,255,0.7)'], [1, 'rgba(160,120,240,0.35)']]);
    ctx.beginPath();
    ctx.moveTo(4, 52);
    ctx.bezierCurveTo(4, -4, 86, -4, 86, 52);
    ctx.bezierCurveTo(70, 46, 60, 58, 45, 52);
    ctx.bezierCurveTo(30, 58, 20, 46, 4, 52);
    ctx.fill();
  });

  // Manta ray (top-down-ish silhouette swimming right)
  canvasTex(scene, 'manta', 300, 170, (ctx) => {
    const p = new Path2D();
    p.moveTo(250, 85);
    p.bezierCurveTo(230, 40, 160, 10, 120, 6);
    p.bezierCurveTo(130, 40, 110, 70, 60, 84);
    p.lineTo(4, 88);
    p.lineTo(60, 92);
    p.bezierCurveTo(110, 104, 130, 130, 120, 164);
    p.bezierCurveTo(160, 160, 230, 130, 250, 85);
    p.closePath();
    ctx.fillStyle = linear(ctx, 0, 0, 0, 170, [[0, '#2c4a78'], [0.5, '#4a6fa6'], [1, '#2c4a78']]);
    ctx.fill(p);
    ctx.fillStyle = 'rgba(220,235,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(190, 85, 40, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    // cephalic fins
    ctx.fillStyle = '#2c4a78';
    ctx.beginPath();
    ctx.ellipse(262, 72, 16, 6, 0.4, 0, Math.PI * 2);
    ctx.ellipse(262, 98, 16, 6, -0.4, 0, Math.PI * 2);
    ctx.fill();
    eye(ctx, 236, 76, 4);
  });

  // Small dolphins: locals looking for a home, and German visitors in sun hats.
  const smallDolphin = (ctx: Ctx, w: number, h: number, body: string[], tourist: boolean): void => {
    const p = new Path2D();
    p.moveTo(w - 4, h * 0.6);
    p.bezierCurveTo(w - 14, h * 0.48, w - 22, h * 0.44, w - 30, h * 0.42);
    p.bezierCurveTo(w - 38, h * 0.22, w - 56, h * 0.2, w * 0.5, h * 0.24);
    p.bezierCurveTo(w * 0.3, h * 0.3, w * 0.2, h * 0.42, 18, h * 0.5);
    p.lineTo(4, h * 0.36);
    p.lineTo(10, h * 0.56);
    p.lineTo(4, h * 0.76);
    p.lineTo(18, h * 0.6);
    p.bezierCurveTo(w * 0.3, h * 0.72, w * 0.6, h * 0.78, w - 26, h * 0.66);
    p.bezierCurveTo(w - 16, h * 0.64, w - 8, h * 0.64, w - 4, h * 0.6);
    p.closePath();
    // dorsal fin
    ctx.fillStyle = body[0];
    ctx.beginPath();
    ctx.moveTo(w * 0.55, h * 0.25);
    ctx.lineTo(w * 0.42, h * 0.06);
    ctx.lineTo(w * 0.4, h * 0.3);
    ctx.fill();
    ctx.fillStyle = linear(ctx, 0, h * 0.2, 0, h * 0.8, [[0, body[0]], [0.55, body[1]], [1, '#eef4fa']]);
    ctx.fill(p);
    ctx.strokeStyle = 'rgba(20,40,80,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke(p);
    if (tourist) {
      // sunburnt cheeks
      ctx.fillStyle = 'rgba(255,110,110,0.55)';
      ctx.beginPath();
      ctx.ellipse(w - 30, h * 0.56, 7, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // sunglasses
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.ellipse(w - 34, h * 0.42, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w - 41, h * 0.41);
      ctx.lineTo(w - 50, h * 0.38);
      ctx.stroke();
      // straw sun hat with a red band
      ctx.fillStyle = '#f2d27a';
      ctx.beginPath();
      ctx.ellipse(w - 46, h * 0.25, 20, 5, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(w - 47, h * 0.17, 11, 9, -0.15, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d64545';
      ctx.fillRect(w - 58, h * 0.17, 22, 3);
    } else {
      eye(ctx, w - 32, h * 0.44, 3.5);
    }
  };
  canvasTex(scene, 'dolphin_de', 120, 64, (c, w, h) => smallDolphin(c, w, h, ['#8f9fb8', '#c7b3c0'], true));
  canvasTex(scene, 'dolphin_local', 110, 60, (c, w, h) => smallDolphin(c, w, h, ['#3f5f8e', '#7f9fc4'], false));

  // Whale silhouette for the far background
  canvasTex(scene, 'whale', 900, 300, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(880, 140);
    ctx.bezierCurveTo(860, 60, 700, 40, 520, 60);
    ctx.bezierCurveTo(360, 76, 220, 110, 120, 140);
    ctx.lineTo(30, 70);
    ctx.lineTo(60, 150);
    ctx.lineTo(20, 240);
    ctx.lineTo(130, 170);
    ctx.bezierCurveTo(260, 200, 420, 230, 600, 220);
    ctx.bezierCurveTo(760, 210, 880, 200, 880, 140);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(620, 240, 90, 20, 0.5, 0, Math.PI * 2);
    ctx.fill();
  });
}
