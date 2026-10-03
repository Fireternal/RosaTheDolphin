import Phaser from 'phaser';
import { canvasTex, linear, radial } from './canvas';
import { drawTrebleClef } from './RosaArt';

/** Generic effect textures: glows, sparkles, bubbles, musical glyphs, light rays. */
export function makeFxTextures(scene: Phaser.Scene): void {
  canvasTex(scene, 'glow', 256, 256, (ctx) => {
    ctx.fillStyle = radial(ctx, 128, 128, 128, [
      [0, 'rgba(255,255,255,1)'],
      [0.2, 'rgba(255,255,255,0.55)'],
      [0.5, 'rgba(255,255,255,0.16)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    ctx.fillRect(0, 0, 256, 256);
  });

  // dark soft shade used behind HUD text for legibility (no tint needed)
  canvasTex(scene, 'shade', 256, 128, (ctx) => {
    ctx.scale(1, 0.5);
    ctx.fillStyle = radial(ctx, 128, 128, 128, [[0, 'rgba(2,12,30,0.75)'], [0.6, 'rgba(2,12,30,0.4)'], [1, 'rgba(2,12,30,0)']]);
    ctx.fillRect(0, 0, 256, 256);
  });

  // celebration rainbow: soft concentric bands
  canvasTex(scene, 'rainbow', 1024, 540, (ctx, w, h) => {
    const bands = ['#ff6b8a', '#ffa45c', '#ffe066', '#7ee08a', '#5cc8ff', '#7d8cff', '#c38bff'];
    const cx = w / 2;
    const cy = h - 10;
    const outer = 500;
    const bw = 26;
    ctx.globalAlpha = 0.9;
    bands.forEach((c, i) => {
      ctx.beginPath();
      ctx.arc(cx, cy, outer - i * bw, Math.PI, 0);
      ctx.arc(cx, cy, outer - (i + 1) * bw, 0, Math.PI, true);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
    });
    // fade the feet of the arc
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.fillStyle = linear(ctx, 0, cy - 220, 0, cy, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
    ctx.fillRect(0, cy - 220, w, 230);
  });

  canvasTex(scene, 'star', 64, 64, (ctx) => {
    ctx.fillStyle = radial(ctx, 32, 32, 30, [[0, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 9 : 22;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const x = 32 + Math.cos(a) * r;
      const y = 32 + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  });

  // Coalición Delfinaria: a star of three leaping dolphins. No badge — the text is
  // white because every screen of the game has a dark background.
  canvasTex(scene, 'logo_cd', 560, 600, (ctx, w) => {
    /** One dolphin drawn horizontally: tail at (0,0), head to the right at about (300, 0). */
    const dolphin = (x: number, y: number, rot: number, color: string, flipY = false): void => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(0.62, flipY ? -0.62 : 0.62);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.bezierCurveTo(70, -26, 150, -40, 210, -44); // back
      ctx.bezierCurveTo(250, -46, 280, -36, 296, -22); // melon
      ctx.bezierCurveTo(314, -14, 330, -8, 338, -4); // rostrum
      ctx.bezierCurveTo(318, 2, 298, 6, 280, 8); // jaw
      ctx.bezierCurveTo(230, 16, 170, 30, 120, 52); // belly
      ctx.bezierCurveTo(70, 72, 30, 70, 0, 16);
      ctx.closePath();
      ctx.fill();
      // flipper
      ctx.beginPath();
      ctx.moveTo(190, 30);
      ctx.bezierCurveTo(170, 60, 150, 90, 120, 104);
      ctx.bezierCurveTo(150, 70, 160, 50, 160, 36);
      ctx.closePath();
      ctx.fill();
      // eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(262, -20, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    const cx = w / 2;
    const cy = 260;
    // blue: leaps up and to the right from the centre
    dolphin(cx - 44, cy + 30, -1.05, '#0aa0e6');
    // grey: swims to the left
    dolphin(cx - 44, cy + 40, Math.PI + 0.22, '#c3c4c7', true);
    // yellow: swims to the right
    dolphin(cx + 44, cy + 40, -0.22, '#ffcc0a');
    ctx.fillStyle = '#1a62c9';
    ctx.beginPath();
    ctx.arc(cx - 46, cy + 34, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a3cc14';
    ctx.beginPath();
    ctx.arc(cx + 46, cy + 34, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = '900 78px "Arial Rounded MT Bold", "Trebuchet MS", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('coalición', cx, 500);
    ctx.fillText('delfinaria', cx, 580);
  });

  canvasTex(scene, 'softdot', 32, 32, (ctx) => {
    ctx.fillStyle = radial(ctx, 16, 16, 16, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 0, 32, 32);
  });

  canvasTex(scene, 'spark', 64, 64, (ctx) => {
    ctx.fillStyle = radial(ctx, 32, 32, 30, [[0, 'rgba(255,255,255,0.9)'], [0.25, 'rgba(255,255,255,0.25)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(32, 2);
    ctx.quadraticCurveTo(35, 29, 62, 32);
    ctx.quadraticCurveTo(35, 35, 32, 62);
    ctx.quadraticCurveTo(29, 35, 2, 32);
    ctx.quadraticCurveTo(29, 29, 32, 2);
    ctx.fill();
  });

  canvasTex(scene, 'bubble', 32, 32, (ctx) => {
    ctx.fillStyle = radial(ctx, 16, 16, 14, [[0, 'rgba(200,240,255,0.05)'], [0.8, 'rgba(200,240,255,0.18)'], [1, 'rgba(220,250,255,0.6)']]);
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(230,250,255,0.75)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.ellipse(11, 10, 3.5, 2.2, -0.6, 0, Math.PI * 2);
    ctx.fill();
  });

  canvasTex(scene, 'snow', 8, 8, (ctx) => {
    ctx.fillStyle = radial(ctx, 4, 4, 4, [[0, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 0, 8, 8);
  });

  canvasTex(scene, 'heart', 48, 44, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(24, 40);
    ctx.bezierCurveTo(4, 26, 0, 14, 8, 6);
    ctx.bezierCurveTo(14, 0, 22, 4, 24, 10);
    ctx.bezierCurveTo(26, 4, 34, 0, 40, 6);
    ctx.bezierCurveTo(48, 14, 44, 26, 24, 40);
    ctx.fill();
  });

  // Musical glyphs (white, tinted at runtime)
  canvasTex(scene, 'glyph', 64, 96, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.save();
    ctx.translate(24, 76);
    ctx.rotate(-0.4);
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 10.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillRect(35, 10, 5.5, 64);
    ctx.beginPath();
    ctx.moveTo(40, 10);
    ctx.bezierCurveTo(46, 26, 62, 30, 56, 54);
    ctx.bezierCurveTo(56, 40, 50, 34, 40, 32);
    ctx.closePath();
    ctx.fill();
  });

  canvasTex(scene, 'glyph2', 96, 96, (ctx) => {
    ctx.fillStyle = '#ffffff';
    for (const x of [22, 70]) {
      ctx.save();
      ctx.translate(x, 76);
      ctx.rotate(-0.4);
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillRect(x + 10, 16, 5, 60);
    }
    ctx.beginPath();
    ctx.moveTo(32, 14);
    ctx.lineTo(85, 8);
    ctx.lineTo(85, 20);
    ctx.lineTo(32, 26);
    ctx.closePath();
    ctx.fill();
  });

  canvasTex(scene, 'clef', 64, 128, (ctx) => {
    drawTrebleClef(ctx, 32, 66, 1.35, '#ffffff', 6);
  });

  canvasTex(scene, 'ring', 64, 64, (ctx) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(32, 32, 26, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Light ray from the surface: soft vertical beam
  canvasTex(scene, 'ray', 256, 1024, (ctx, w, h) => {
    ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, 'rgba(255,255,255,0.9)'], [0.4, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = linear(ctx, 0, 0, w, 0, [[0, 'rgba(0,0,0,0)'], [0.35, 'rgba(0,0,0,0.8)'], [0.5, 'rgba(0,0,0,1)'], [0.65, 'rgba(0,0,0,0.8)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(0, 0, w, h);
  });

  // Underwater gradient (sampled vertically by depth)
  canvasTex(scene, 'bg_grad', 16, 1024, (ctx, w, h) => {
    ctx.fillStyle = linear(ctx, 0, 0, 0, h, [
      [0, '#5ccbe6'],
      [0.12, '#2f9bcb'],
      [0.35, '#1a6ba8'],
      [0.6, '#114782'],
      [0.82, '#0b3063'],
      [1, '#08224a'],
    ]);
    ctx.fillRect(0, 0, w, h);
  });

  canvasTex(scene, 'sky', 16, 720, (ctx, w, h) => {
    ctx.fillStyle = linear(ctx, 0, 0, 0, h, [
      [0, '#3c6fb8'],
      [0.45, '#7fb0dc'],
      [0.8, '#f2d7b0'],
      [1, '#ffe6bd'],
    ]);
    ctx.fillRect(0, 0, w, h);
  });

  canvasTex(scene, 'cloud', 400, 140, (ctx) => {
    ctx.fillStyle = 'rgba(255,250,240,0.85)';
    for (const [x, y, r] of [[90, 90, 50], [160, 70, 62], [240, 80, 55], [310, 95, 40], [200, 105, 50]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // classic game icons over characters: "!" = has a mission for Rosa, bubble = just wants to chat
  canvasTex(scene, 'icon_quest', 84, 100, (ctx, w) => {
    const cx = w / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx + 3, 46, 36, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = linear(ctx, 0, 6, 0, 86, [[0, '#fff3b0'], [0.5, '#ffd36e'], [1, '#e8a521']]);
    ctx.beginPath();
    ctx.ellipse(cx, 43, 34, 38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#7a4a00';
    ctx.stroke();
    ctx.fillStyle = '#5a2e00';
    ctx.beginPath();
    ctx.roundRect(cx - 7, 16, 14, 38, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, 66, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(cx - 16, 26, 6, 10, -0.5, 0, Math.PI * 2);
    ctx.fill();
  });
  canvasTex(scene, 'icon_talk', 100, 90, (ctx) => {
    const bubble = (dx: number, dy: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(8 + dx, 6 + dy, 84, 56, 20);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(30 + dx, 58 + dy);
      ctx.lineTo(24 + dx, 82 + dy);
      ctx.lineTo(48 + dx, 60 + dy);
      ctx.closePath();
      ctx.fill();
    };
    bubble(3, 3, 'rgba(0,0,0,0.35)');
    bubble(0, 0, '#ffffff');
    ctx.strokeStyle = '#2a4a7a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(8, 6, 84, 56, 20);
    ctx.stroke();
    ctx.fillStyle = '#2a4a7a';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(30 + i * 20, 34, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}
