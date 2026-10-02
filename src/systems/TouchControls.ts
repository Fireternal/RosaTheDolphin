import Phaser from 'phaser';
import { FONT_TITLE, FONT_UI, GOLD, GOLD_CSS } from '../config';

const ADD = Phaser.BlendModes.ADD;

interface TouchButton {
  c: Phaser.GameObjects.Container;
  zone: Phaser.GameObjects.Zone;
  ring: Phaser.GameObjects.Graphics;
  r: number;
  /** offset from the bottom-right corner of the screen */
  dx: number;
  dy: number;
  color: number;
}

/**
 * Touch controls for phones and tablets: a floating joystick on the left half of
 * the screen and round action buttons on the right. Lives in the UI scene so it
 * is never affected by the game camera.
 */
export class TouchControls {
  /** Current stick direction, length 0..1. */
  axisX = 0;
  axisY = 0;
  private queue = new Set<'boost' | 'sonar' | 'interact'>();
  private stickId: number | null = null;
  private baseX = 0;
  private baseY = 0;
  private readonly stickR = 120;
  private stickG: Phaser.GameObjects.Graphics;
  private hintG: Phaser.GameObjects.Graphics;
  private buttons: Record<'boost' | 'sonar' | 'interact' | 'pause', TouchButton>;
  private ox = 0;
  private oy = 0;
  private interactAvailable = false;

  constructor(private scene: Phaser.Scene, onPause: () => void) {
    this.hintG = scene.add.graphics().setDepth(8);
    this.stickG = scene.add.graphics().setDepth(8);
    this.buttons = {
      boost: this.makeButton(200, 190, 100, 0x7fdcff, 'IMPULSO', 'boost'),
      sonar: this.makeButton(430, 130, 78, 0x9fe8ff, 'SONAR', 'sonar'),
      interact: this.makeButton(250, 430, 82, GOLD, 'E', 'interact'),
      pause: this.makeButton(70, -1, 44, 0xcfe6ff, 'II', 'pause', onPause),
    };
    this.buttons.interact.c.setAlpha(0.35);

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.stickId !== null || over.length) return;
      if (p.x > scene.scale.width * 0.5) return;
      this.stickId = p.id;
      this.baseX = p.worldX;
      this.baseY = p.worldY;
      this.moveStick(p);
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id === this.stickId) this.moveStick(p);
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.stickId) return;
      this.stickId = null;
      this.axisX = this.axisY = 0;
      this.stickG.clear();
      this.drawHint();
    };
    scene.input.on('pointerup', release);
    scene.input.on('pointerupoutside', release);
    this.drawHint();
  }

  private makeButton(dx: number, dy: number, r: number, color: number, label: string, id: string, onTap?: () => void): TouchButton {
    const s = this.scene;
    const c = s.add.container(0, 0).setDepth(9);
    const glow = s.add.image(0, 0, 'glow').setTint(color).setBlendMode(ADD).setScale(r / 110).setAlpha(0.25);
    const ring = s.add.graphics();
    const big = label.length <= 2;
    const t = s.add.text(0, 0, label, {
      fontFamily: big ? FONT_TITLE : FONT_UI,
      fontSize: big ? `${Math.round(r * 0.8)}px` : `${Math.round(r * 0.24)}px`,
      color: big ? '#fff3d6' : GOLD_CSS,
      fontStyle: big ? 'bold' : 'normal',
    }).setOrigin(0.5).setLetterSpacing(big ? 0 : 2);
    c.add([glow, ring, t]);
    if (id === 'sonar') c.add(this.icon('sonar', r));
    if (id === 'boost') c.add(this.icon('boost', r));
    if (!big) t.setY(r * 0.45);
    const zone = s.add.zone(0, 0, r * 2.3, r * 2.3).setInteractive();
    zone.on('pointerdown', () => {
      ring.clear();
      this.drawRing(ring, r, color, true);
      s.time.delayedCall(120, () => { ring.clear(); this.drawRing(ring, r, color, false); });
      if (onTap) onTap();
      else this.queue.add(id as 'boost' | 'sonar' | 'interact');
    });
    this.drawRing(ring, r, color, false);
    return { c, zone, ring, r, dx, dy, color };
  }

  private icon(kind: 'sonar' | 'boost', r: number): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    g.lineStyle(4, 0xffffff, 0.9);
    if (kind === 'sonar') {
      for (let i = 1; i <= 3; i++) {
        g.beginPath();
        g.arc(0, -r * 0.12, i * r * 0.14, -Math.PI * 0.8, -Math.PI * 0.2);
        g.strokePath();
      }
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(0, -r * 0.12, 5);
    } else {
      // a little wave with a forward arrow
      g.beginPath();
      g.moveTo(-r * 0.35, -r * 0.05);
      g.lineTo(r * 0.3, -r * 0.05);
      g.strokePath();
      g.fillStyle(0xffffff, 0.9);
      g.fillTriangle(r * 0.38, -r * 0.05, r * 0.18, -r * 0.2, r * 0.18, r * 0.1);
      g.beginPath();
      g.moveTo(-r * 0.35, -r * 0.26);
      g.lineTo(r * 0.05, -r * 0.26);
      g.moveTo(-r * 0.35, r * 0.16);
      g.lineTo(r * 0.05, r * 0.16);
      g.strokePath();
    }
    return g;
  }

  private drawRing(g: Phaser.GameObjects.Graphics, r: number, color: number, pressed: boolean): void {
    g.fillStyle(0x04142e, pressed ? 0.85 : 0.55);
    g.fillCircle(0, 0, r);
    g.lineStyle(pressed ? 5 : 3, color, pressed ? 1 : 0.8);
    g.strokeCircle(0, 0, r);
  }

  private moveStick(p: Phaser.Input.Pointer): void {
    let dx = p.worldX - this.baseX;
    let dy = p.worldY - this.baseY;
    const d = Math.hypot(dx, dy);
    if (d > this.stickR) {
      // the base follows the finger when dragged far, like most mobile games
      this.baseX += (dx / d) * (d - this.stickR);
      this.baseY += (dy / d) * (d - this.stickR);
      dx = p.worldX - this.baseX;
      dy = p.worldY - this.baseY;
    }
    const k = Math.min(1, Math.hypot(dx, dy) / this.stickR);
    const dead = 0.12;
    const m = k < dead ? 0 : (k - dead) / (1 - dead);
    const a = Math.atan2(dy, dx);
    this.axisX = Math.cos(a) * m;
    this.axisY = Math.sin(a) * m;
    const g = this.stickG;
    g.clear();
    g.fillStyle(0x04142e, 0.4);
    g.fillCircle(this.baseX, this.baseY, this.stickR);
    g.lineStyle(3, 0x9fe8ff, 0.6);
    g.strokeCircle(this.baseX, this.baseY, this.stickR);
    g.fillStyle(0xfff3d6, 0.85);
    g.fillCircle(this.baseX + dx, this.baseY + dy, 52);
    g.lineStyle(3, GOLD, 1);
    g.strokeCircle(this.baseX + dx, this.baseY + dy, 52);
    this.hintG.clear();
  }

  /** A faint stick in the corner showing where to put the thumb. */
  private drawHint(): void {
    const g = this.hintG;
    g.clear();
    const x = -this.ox + 230;
    const y = 1080 + this.oy - 230;
    g.lineStyle(3, 0x9fe8ff, 0.25);
    g.strokeCircle(x, y, this.stickR);
    g.fillStyle(0xfff3d6, 0.18);
    g.fillCircle(x, y, 52);
  }

  /** Called whenever the screen shape changes (offsets from the 1920x1080 safe area). */
  layout(ox: number, oy: number): void {
    this.ox = ox;
    this.oy = oy;
    for (const [id, b] of Object.entries(this.buttons)) {
      const x = 1920 + ox - b.dx;
      const y = id === 'pause' ? -oy + 70 : 1080 + oy - b.dy;
      b.c.setPosition(x, y);
      b.zone.setPosition(x, y);
    }
    if (this.stickId === null) this.drawHint();
  }

  /** The E button glows only when there is something to interact with. */
  setInteractAvailable(v: boolean): void {
    if (v === this.interactAvailable) return;
    this.interactAvailable = v;
    this.scene.tweens.add({ targets: this.buttons.interact.c, alpha: v ? 1 : 0.35, scale: v ? 1.08 : 1, duration: 200 });
  }

  /** During a music puzzle only E (listen again) and pause make sense. */
  setPuzzleMode(on: boolean): void {
    for (const id of ['boost', 'sonar'] as const) {
      const b = this.buttons[id];
      b.c.setVisible(!on);
      if (on) b.zone.disableInteractive();
      else b.zone.setInteractive();
    }
  }

  /** Returns and clears the actions tapped since the last frame. */
  consume(): { boost: boolean; sonar: boolean; interact: boolean } {
    const r = { boost: this.queue.has('boost'), sonar: this.queue.has('sonar'), interact: this.queue.has('interact') };
    this.queue.clear();
    return r;
  }

  setVisible(v: boolean): void {
    for (const b of Object.values(this.buttons)) {
      b.c.setVisible(v);
      if (v) b.zone.setInteractive();
      else b.zone.disableInteractive();
    }
    this.hintG.setVisible(v);
    this.stickG.setVisible(v);
  }
}
