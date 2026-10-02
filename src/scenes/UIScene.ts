import Phaser from 'phaser';
import { FONT_TITLE, FONT_UI, GOLD, GOLD_CSS, NOTE_INFO, NOTE_ORDER, NoteName, WARM_CSS } from '../config';
import { bus, EV } from '../core/EventBus';
import { centerLayout, isTouchDevice } from '../core/layout';
import { TouchControls } from '../systems/TouchControls';
import { AudioManager } from '../systems/AudioManager';
import type { GratitudeMission, GratitudePresenter } from '../systems/GratitudeSystem';
import type { ObjectivePresenter } from '../systems/ObjectiveSystem';

const ADD = Phaser.BlendModes.ADD;

export interface DialogueLine {
  who: string;
  text: string;
}

const SPEAKER_COLORS: Record<string, string> = {
  Rosa: GOLD_CSS,
  Lumi: '#ffb3cc',
  'Doña Marea': '#a9e38f',
  Bruno: '#d9e98a',
  'La Rotonda': WARM_CSS,
  'Familia Delfín': '#9fd0ff',
};

interface Slot {
  ring: Phaser.GameObjects.Image;
  glyph: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  filled: boolean;
}

interface KeyButton {
  bg: Phaser.GameObjects.Graphics;
  num: Phaser.GameObjects.Text;
  name: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  note: NoteName;
  x: number;
  y: number;
}

/**
 * UIManager — the HUD and every overlay. Runs as its own scene on top of the
 * game so camera zoom/shake never affects the interface.
 */
export class UIScene extends Phaser.Scene implements GratitudePresenter, ObjectivePresenter {
  private hud!: Phaser.GameObjects.Container;
  private slots: Slot[] = [];
  private thanksText!: Phaser.GameObjects.Text;
  private thanksHeart!: Phaser.GameObjects.Image;
  private notesRow: Phaser.GameObjects.Text[] = [];
  private objTitle!: Phaser.GameObjects.Text;
  private objText!: Phaser.GameObjects.Text;
  private objProgress!: Phaser.GameObjects.Text;
  private sonarText!: Phaser.GameObjects.Text;
  private sonarArc!: Phaser.GameObjects.Graphics;
  private promptText!: Phaser.GameObjects.Text;
  private promptValue: string | null = null;
  private toastQueue: { text: string; sub?: string; color?: string }[] = [];
  private toastBusy = false;

  // dialogue
  private dlgBox!: Phaser.GameObjects.Container;
  private dlgName!: Phaser.GameObjects.Text;
  private dlgText!: Phaser.GameObjects.Text;
  private dlgHint!: Phaser.GameObjects.Text;
  private dlgLines: DialogueLine[] = [];
  private dlgIndex = 0;
  private dlgShown = 0;
  private dlgResolve: (() => void) | null = null;
  private dlgOpenedAt = 0;
  dialogueActive = false;

  // puzzle
  private pz!: Phaser.GameObjects.Container;
  private pzTitle!: Phaser.GameObjects.Text;
  private pzState!: Phaser.GameObjects.Text;
  private pzHint!: Phaser.GameObjects.Text;
  private pzSlots: Phaser.GameObjects.Image[] = [];
  private pzSlotLabels: Phaser.GameObjects.Text[] = [];
  private pzSlotRow!: Phaser.GameObjects.Container;
  private keys: KeyButton[] = [];
  puzzleVisible = false;

  // overlays
  private overlayActive = false;
  private overlayResolve: (() => void) | null = null;
  private overlayCanSkipAt = 0;
  private pausePanel!: Phaser.GameObjects.Container;
  private pauseItems: Phaser.GameObjects.Text[] = [];
  private pauseIndex = 0;
  private controlsPanel!: Phaser.GameObjects.Container;
  paused = false;
  private gameRef: { handleEscape(): boolean; goToMenu(): void } | null = null;

  private pressedCodes = new Set<string>();
  private corners: { TL: Phaser.GameObjects.Container; TR: Phaser.GameObjects.Container; BL: Phaser.GameObjects.Container; BR: Phaser.GameObjects.Container } | null = null;
  /** On-screen joystick and buttons (phones / tablets only). */
  touch: TouchControls | null = null;

  constructor() {
    super('UIScene');
  }

  bindGame(game: { handleEscape(): boolean; goToMenu(): void }): void {
    this.gameRef = game;
  }

  create(): void {
    this.slots = [];
    this.notesRow = [];
    this.keys = [];
    this.pzSlots = [];
    this.pzSlotLabels = [];
    this.pauseItems = [];
    this.toastQueue = [];
    this.toastBusy = false;
    this.dialogueActive = false;
    this.puzzleVisible = false;
    this.overlayActive = false;
    this.paused = false;


    this.pressedCodes.clear();
    const onKey = (e: KeyboardEvent) => {
      if (!e.repeat) this.pressedCodes.add(e.code);
    };
    this.input.keyboard!.on('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown', onKey));

    this.corners = null;
    this.touch = null;
    this.buildHud();
    this.buildDialogue();
    this.buildPuzzlePanel();
    this.buildPause();
    if (isTouchDevice()) this.touch = new TouchControls(this, () => this.onTouchPause());
    centerLayout(this, (ox, oy) => this.layoutCorners(ox, oy));
    this.input.on('pointerdown', () => {
      if (this.dialogueActive) this.advanceDialogue();
      else if (this.overlayActive && this.time.now > this.overlayCanSkipAt) this.closeOverlay();
    });
  }

  // =========================================================== HUD

  private buildHud(): void {
    this.hud = this.add.container(0, 0);
    // four corner groups so the HUD hugs the real screen edges on any aspect ratio
    const TL = this.add.container(0, 0);
    const TR = this.add.container(0, 0);
    const BL = this.add.container(0, 0);
    const BR = this.add.container(0, 0);
    this.corners = { TL, TR, BL, BR };
    this.hud.add([TL, TR, BL, BR]);
    TL.add(this.add.image(190, 110, 'shade').setDisplaySize(620, 300).setAlpha(0.8));
    TR.add(this.add.image(1700, 80, 'shade').setDisplaySize(720, 230).setAlpha(0.8));
    BL.add(this.add.image(150, 1010, 'shade').setDisplaySize(420, 200).setAlpha(0.6));
    const title = this.add.text(48, 34, 'ROSA THE DOLPHIN', { fontFamily: FONT_TITLE, fontSize: '30px', color: GOLD_CSS, fontStyle: 'italic' })
      .setShadow(0, 0, 'rgba(255,200,90,0.55)', 12, false, true).setLetterSpacing(3);
    TL.add(title);
    const sub = this.add.text(50, 72, 'MELODÍA', { fontFamily: FONT_UI, fontSize: '14px', color: '#cfe6ff' }).setLetterSpacing(5).setAlpha(0.75);
    TL.add(sub);

    for (let i = 0; i < 7; i++) {
      const x = 70 + i * 52;
      const y = 118;
      const glow = this.add.image(x, y, 'glow').setScale(0.32).setBlendMode(ADD).setAlpha(0);
      const ring = this.add.image(x, y, 'ring').setScale(0.5).setAlpha(0.55).setTint(0xcfe6ff);
      const glyph = this.add.image(x, y, 'glyph').setScale(0.34).setAlpha(0);
      const label = this.add.text(x, y + 30, '', { fontFamily: FONT_UI, fontSize: '13px', color: '#ffffff' }).setOrigin(0.5).setAlpha(0);
      TL.add([glow, ring, glyph, label]);
      this.slots.push({ ring, glyph, glow, label, filled: false });
    }

    this.thanksHeart = this.add.image(58, 178, 'heart').setScale(0.38).setTint(0xff9ab0).setAlpha(0.9);
    this.thanksText = this.add.text(76, 178, 'Gracias recibidas: 0', { fontFamily: FONT_UI, fontSize: '16px', color: '#ffd7e0' }).setOrigin(0, 0.5).setAlpha(0.9);
    TL.add([this.thanksHeart, this.thanksText]);

    NOTE_ORDER.forEach((n, i) => {
      const t = this.add.text(50 + i * 44, 208, n, { fontFamily: FONT_TITLE, fontSize: '16px', color: NOTE_INFO[n].css }).setAlpha(0.18);
      this.notesRow.push(t);
      TL.add(t);
    });

    // objective (top right)
    this.objTitle = this.add.text(1872, 36, 'OBJETIVO', { fontFamily: FONT_UI, fontSize: '15px', color: GOLD_CSS }).setOrigin(1, 0).setLetterSpacing(5);
    this.objText = this.add.text(1872, 62, '', { fontFamily: FONT_UI, fontSize: '22px', color: '#eef7ff', align: 'right', wordWrap: { width: 520 } })
      .setOrigin(1, 0).setShadow(0, 2, 'rgba(0,10,30,0.8)', 6);
    this.objProgress = this.add.text(1872, 100, '', { fontFamily: FONT_TITLE, fontSize: '30px', color: GOLD_CSS }).setOrigin(1, 0);
    TR.add([this.objTitle, this.objText, this.objProgress]);

    // sonar + contextual prompt (bottom left) — keyboard players only; touch has its own buttons
    this.sonarArc = this.add.graphics();
    this.sonarText = this.add.text(92, 1024, 'Q — SONAR', { fontFamily: FONT_UI, fontSize: '19px', color: '#cfefff' }).setOrigin(0, 0.5).setLetterSpacing(2);
    this.promptText = this.add.text(48, 970, '', { fontFamily: FONT_UI, fontSize: '24px', color: '#ffffff', backgroundColor: 'rgba(4,20,44,0.55)', padding: { x: 14, y: 8 } })
      .setOrigin(0, 0.5).setLetterSpacing(2).setAlpha(0);
    const help = this.add.text(1872, 1036, 'ESC — pausa   ·   M — silencio   ·   F — pantalla completa', { fontFamily: FONT_UI, fontSize: '14px', color: '#9fc4e6' }).setOrigin(1, 0.5).setAlpha(0.55);
    BL.add([this.sonarArc, this.sonarText, this.promptText]);
    BR.add(help);
    if (isTouchDevice()) {
      BL.setVisible(false);
      help.setVisible(false);
    }
    this.setSonar(1);
  }

  /** Re-anchors the HUD corners when the screen shape changes. */
  private layoutCorners(ox: number, oy: number): void {
    const c = this.corners;
    if (!c) return;
    const touch = isTouchDevice();
    const touchShift = touch ? -110 : 0;
    // bigger HUD on phones so it stays readable on a small screen
    const k = touch ? 1.3 : 1;
    c.TL.setPosition(-ox, -oy).setScale(k);
    c.TR.setPosition(ox + touchShift + 1920 * (1 - k), -oy).setScale(k);
    c.BL.setPosition(-ox, oy);
    c.BR.setPosition(ox, oy);
    this.touch?.layout(ox, oy);
  }

  setHudVisible(v: boolean, ms = 600): void {
    this.tweens.add({ targets: this.hud, alpha: v ? 1 : 0, duration: ms });
    this.touch?.setVisible(v);
  }

  setFragments(slots: (NoteName | null)[], animateIndex = -1): void {
    slots.forEach((n, i) => {
      const s = this.slots[i];
      if (!n) return;
      const c = NOTE_INFO[n].color;
      s.glyph.setTint(c);
      s.glow.setTint(c);
      s.label.setText(n).setColor(NOTE_INFO[n].css);
      if (s.filled) return;
      s.filled = true;
      if (i === animateIndex) {
        s.glyph.setAlpha(1).setScale(0.9);
        this.tweens.add({ targets: s.glyph, scale: 0.34, duration: 600, ease: 'Back.easeOut' });
        s.glow.setAlpha(1).setScale(1);
        this.tweens.add({ targets: s.glow, alpha: 0.5, scale: 0.32, duration: 900 });
        this.tweens.add({ targets: s.label, alpha: 1, duration: 500, delay: 200 });
        this.tweens.add({ targets: s.ring, alpha: 0, duration: 300 });
      } else {
        s.glyph.setAlpha(1);
        s.glow.setAlpha(0.5);
        s.label.setAlpha(1);
        s.ring.setAlpha(0);
      }
    });
  }

  /** Reveals one slot (used for the finale so the player can read the melody). */
  pulseSlot(i: number): void {
    const s = this.slots[i];
    if (!s) return;
    this.tweens.add({ targets: s.glow, alpha: { from: 1, to: 0.5 }, scale: { from: 0.7, to: 0.32 }, duration: 700 });
    this.tweens.add({ targets: s.glyph, scale: { from: 0.55, to: 0.34 }, duration: 500, ease: 'Back.easeOut' });
  }

  setNotes(known: NoteName[], newest?: NoteName): void {
    NOTE_ORDER.forEach((n, i) => {
      const has = known.includes(n);
      const t = this.notesRow[i];
      t.setAlpha(has ? 1 : 0.18);
      if (n === newest) this.tweens.add({ targets: t, scale: { from: 1.8, to: 1 }, duration: 600, ease: 'Back.easeOut' });
    });
    this.keys.forEach((k) => this.drawKey(k, known.includes(k.note), false));
  }

  setGratitudeCount(n: number, animate = false): void {
    this.thanksText.setText(`Gracias recibidas: ${n}`);
    if (animate) {
      this.tweens.add({ targets: this.thanksHeart, scale: { from: 0.9, to: 0.38 }, duration: 700, ease: 'Back.easeOut' });
      this.tweens.add({ targets: this.thanksText, scale: { from: 1.25, to: 1 }, duration: 500 });
    }
  }

  showObjective(text: string, progress?: { cur: number; total: number }): void {
    this.objText.setText(text);
    this.objProgress.setText(progress ? `${progress.cur} / ${progress.total}` : '');
    this.objProgress.setY(62 + this.objText.height + 6);
    this.tweens.add({ targets: [this.objText, this.objProgress], alpha: { from: 0.2, to: 1 }, duration: 700 });
    this.tweens.add({ targets: this.objTitle, alpha: { from: 0.3, to: 1 }, duration: 700 });
  }

  setPrompt(text: string | null): void {
    if (text === this.promptValue) return;
    this.promptValue = text;
    if (text) {
      this.promptText.setText(text);
      this.tweens.add({ targets: this.promptText, alpha: 1, x: { from: 36, to: 48 }, duration: 220 });
    } else {
      this.tweens.add({ targets: this.promptText, alpha: 0, duration: 200 });
    }
  }

  setSonar(ready01: number): void {
    const g = this.sonarArc;
    g.clear();
    g.lineStyle(3, 0x3f6f9a, 0.6);
    g.strokeCircle(66, 1024, 14);
    g.lineStyle(3, ready01 >= 1 ? 0x9fe8ff : 0x6fb7e0, 1);
    g.beginPath();
    g.arc(66, 1024, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ready01);
    g.strokePath();
    if (ready01 >= 1) {
      g.fillStyle(0x9fe8ff, 0.8);
      g.fillCircle(66, 1024, 5);
    }
    this.sonarText.setAlpha(ready01 >= 1 ? 1 : 0.55);
  }

  /** Small elegant notification near the top centre. */
  toast(text: string, sub?: string, color = '#ffffff'): void {
    this.toastQueue.push({ text, sub, color });
    if (!this.toastBusy) this.nextToast();
  }

  private nextToast(): void {
    const item = this.toastQueue.shift();
    if (!item) {
      this.toastBusy = false;
      return;
    }
    this.toastBusy = true;
    const c = this.add.container(960, 150).setAlpha(0);
    const t = this.add.text(0, 0, item.text, { fontFamily: FONT_TITLE, fontSize: '32px', color: item.color, fontStyle: 'italic' })
      .setOrigin(0.5).setShadow(0, 0, 'rgba(0,20,50,0.9)', 10, true, true);
    c.add(t);
    if (item.sub) c.add(this.add.text(0, 34, item.sub, { fontFamily: FONT_UI, fontSize: '17px', color: '#cfe6ff' }).setOrigin(0.5).setLetterSpacing(2));
    this.tweens.add({ targets: c, alpha: 1, y: 160, duration: 350, ease: 'Sine.easeOut' });
    this.tweens.add({
      targets: c, alpha: 0, y: 140, delay: 2100, duration: 450, onComplete: () => {
        c.destroy();
        this.nextToast();
      },
    });
  }

  /** A glyph flies from a screen position into its HUD slot. */
  flyToSlot(sx: number, sy: number, slot: number, note: NoteName, onArrive?: () => void): void {
    const s = this.slots[slot];
    const g = this.add.image(sx, sy, 'glyph2').setTint(0xffe7a0).setScale(0.7).setBlendMode(ADD);
    const glow = this.add.image(sx, sy, 'glow').setTint(GOLD).setScale(0.7).setBlendMode(ADD);
    this.tweens.add({ targets: [g, glow], x: s.ring.x, duration: 1000, ease: 'Sine.easeInOut' });
    this.tweens.add({
      targets: [g, glow], y: s.ring.y, scale: 0.3, duration: 1000, ease: 'Back.easeIn',
      onComplete: () => {
        g.destroy();
        glow.destroy();
        onArrive?.();
      },
    });
    void note;
  }

  flyToNote(sx: number, sy: number, note: NoteName, onArrive?: () => void): void {
    const t = this.notesRow[NOTE_ORDER.indexOf(note)];
    const g = this.add.image(sx, sy, 'glyph').setTint(NOTE_INFO[note].color).setScale(0.5).setBlendMode(ADD);
    this.tweens.add({ targets: g, x: t.x + 14, duration: 800, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: g, y: t.y + 8, scale: 0.15, duration: 800, ease: 'Back.easeIn', onComplete: () => { g.destroy(); onArrive?.(); } });
  }

  // =========================================================== dialogue

  private buildDialogue(): void {
    this.dlgBox = this.add.container(960, 900).setAlpha(0).setVisible(false);
    const bg = this.add.graphics();
    bg.fillStyle(0x04142e, 0.82);
    bg.fillRoundedRect(-640, -90, 1280, 180, 22);
    bg.lineStyle(2, GOLD, 0.6);
    bg.strokeRoundedRect(-640, -90, 1280, 180, 22);
    bg.lineStyle(1, 0x9fe8ff, 0.25);
    for (let i = 0; i < 5; i++) bg.lineBetween(-600, 60 + i * 5, 600, 60 + i * 5);
    this.dlgName = this.add.text(-600, -70, '', { fontFamily: FONT_TITLE, fontSize: '26px', color: GOLD_CSS, fontStyle: 'italic' });
    this.dlgText = this.add.text(-600, -30, '', { fontFamily: FONT_UI, fontSize: '27px', color: '#f2f8ff', wordWrap: { width: 1180 }, lineSpacing: 6 });
    this.dlgHint = this.add.text(612, 70, 'E ▸', { fontFamily: FONT_UI, fontSize: '18px', color: GOLD_CSS }).setOrigin(1, 0.5);
    this.dlgBox.add([bg, this.dlgName, this.dlgText, this.dlgHint]);
    this.tweens.add({ targets: this.dlgHint, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
  }

  say(lines: DialogueLine[]): Promise<void> {
    return new Promise((resolve) => {
      this.dlgLines = lines;
      this.dlgIndex = 0;
      this.dialogueActive = true;
      this.dlgResolve = resolve;
      this.dlgOpenedAt = this.time.now;
      this.dlgBox.setVisible(true);
      this.tweens.add({ targets: this.dlgBox, alpha: 1, y: { from: 930, to: 900 }, duration: 260 });
      this.showLine();
    });
  }

  private showLine(): void {
    const l = this.dlgLines[this.dlgIndex];
    this.dlgName.setText(l.who).setColor(SPEAKER_COLORS[l.who] ?? '#ffffff');
    this.dlgText.setText('');
    this.dlgShown = 0;
  }

  private advanceDialogue(): void {
    if (this.time.now - this.dlgOpenedAt < 180) return;
    const l = this.dlgLines[this.dlgIndex];
    if (this.dlgShown < l.text.length) {
      this.dlgShown = l.text.length;
      this.dlgText.setText(l.text);
      return;
    }
    this.dlgIndex++;
    AudioManager.uiMove();
    if (this.dlgIndex >= this.dlgLines.length) {
      this.dialogueActive = false;
      this.tweens.add({ targets: this.dlgBox, alpha: 0, duration: 200, onComplete: () => this.dlgBox.setVisible(false) });
      const r = this.dlgResolve;
      this.dlgResolve = null;
      r?.();
      return;
    }
    this.showLine();
  }

  // =========================================================== puzzle panel

  private buildPuzzlePanel(): void {
    this.pz = this.add.container(960, 880).setAlpha(0).setVisible(false);
    const bg = this.add.graphics();
    bg.fillStyle(0x04142e, 0.72);
    bg.fillRoundedRect(-520, -150, 1040, 300, 26);
    bg.lineStyle(2, 0x9fe8ff, 0.35);
    bg.strokeRoundedRect(-520, -150, 1040, 300, 26);
    this.pzTitle = this.add.text(0, -128, '', { fontFamily: FONT_TITLE, fontSize: '26px', color: GOLD_CSS, fontStyle: 'italic' }).setOrigin(0.5, 0);
    this.pzState = this.add.text(0, -92, '', { fontFamily: FONT_UI, fontSize: '20px', color: '#dff3ff' }).setOrigin(0.5, 0).setLetterSpacing(2);
    this.pzSlotRow = this.add.container(0, -36);
    this.pzHint = this.add.text(0, 128, isTouchDevice() ? 'E — escuchar otra vez   ·   II — salir' : 'E — escuchar otra vez   ·   ESC — salir', { fontFamily: FONT_UI, fontSize: '15px', color: '#9fc4e6' }).setOrigin(0.5).setAlpha(0.8);
    this.pz.add([bg, this.pzTitle, this.pzState, this.pzSlotRow, this.pzHint]);

    NOTE_ORDER.forEach((n, i) => {
      const x = -405 + i * 135;
      const y = 62;
      const bgK = this.add.graphics();
      const num = this.add.text(x, y - 22, String(i + 1), { fontFamily: FONT_UI, fontSize: '15px', color: '#9fc4e6' }).setOrigin(0.5);
      const name = this.add.text(x, y + 6, n, { fontFamily: FONT_TITLE, fontSize: '26px', color: NOTE_INFO[n].css }).setOrigin(0.5);
      const zone = this.add.zone(960 + x, 880 + y, 116, 76).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, ev: Phaser.Types.Input.EventData) => {
        ev?.stopPropagation?.();
        if (this.puzzleVisible) bus.emit(EV.NOTE_INPUT, n);
      });
      const kb: KeyButton = { bg: bgK, num, name, zone, note: n, x, y };
      this.pz.add([bgK, num, name]);
      this.keys.push(kb);
      this.drawKey(kb, false, false);
    });
  }

  private drawKey(k: KeyButton, known: boolean, lit: boolean): void {
    const g = k.bg;
    g.clear();
    const c = NOTE_INFO[k.note].color;
    g.fillStyle(lit ? c : 0x0a2446, lit ? 0.55 : known ? 0.85 : 0.4);
    g.fillRoundedRect(k.x - 56, k.y - 38, 112, 76, 14);
    g.lineStyle(2, c, known ? 0.9 : 0.25);
    g.strokeRoundedRect(k.x - 56, k.y - 38, 112, 76, 14);
    k.name.setAlpha(known ? 1 : 0.3);
    k.num.setAlpha(known ? 0.9 : 0.3);
  }

  showPuzzle(label: string, length: number, known: NoteName[]): void {
    this.puzzleVisible = true;
    this.touch?.setPuzzleMode(true);
    this.touch?.setInteractAvailable(true);
    this.pzTitle.setText(label);
    this.pzSlotRow.removeAll(true);
    this.pzSlots = [];
    this.pzSlotLabels = [];
    const gap = Math.min(70, 520 / length);
    for (let i = 0; i < length; i++) {
      const x = (i - (length - 1) / 2) * gap;
      const img = this.add.image(x, 0, 'ring').setScale(0.42).setTint(0xcfe6ff).setAlpha(0.6);
      const t = this.add.text(x, 0, '', { fontFamily: FONT_TITLE, fontSize: '17px', color: '#ffffff' }).setOrigin(0.5);
      this.pzSlotRow.add([img, t]);
      this.pzSlots.push(img);
      this.pzSlotLabels.push(t);
    }
    this.keys.forEach((k) => this.drawKey(k, known.includes(k.note), false));
    this.pz.setVisible(true);
    this.tweens.add({ targets: this.pz, alpha: 1, y: { from: 920, to: 880 }, duration: 300 });
    this.setPrompt(null);
  }

  puzzleState(text: string, color = '#dff3ff'): void {
    this.pzState.setText(text).setColor(color);
    this.tweens.add({ targets: this.pzState, alpha: { from: 0.2, to: 1 }, duration: 300 });
  }

  /** Light a slot during the demo (listening) or when the player plays it. */
  puzzleSlot(i: number, note: NoteName | null, state: 'listen' | 'ok' | 'clear'): void {
    const img = this.pzSlots[i];
    const t = this.pzSlotLabels[i];
    if (!img) return;
    if (state === 'clear' || !note) {
      img.setTint(0xcfe6ff).setAlpha(0.6).setTexture('ring').setScale(0.42);
      t.setText('');
      return;
    }
    const c = NOTE_INFO[note].color;
    if (state === 'listen') {
      img.setTexture('ring').setTint(c).setAlpha(1);
      this.tweens.add({ targets: img, scale: { from: 0.7, to: 0.42 }, duration: 400 });
      t.setText('');
    } else {
      img.setTexture('glow').setTint(c).setAlpha(0.9).setScale(0.25);
      this.tweens.add({ targets: img, scale: { from: 0.45, to: 0.25 }, duration: 300 });
      t.setText(note).setColor('#ffffff');
    }
  }

  puzzleClearSlots(): void {
    this.pzSlots.forEach((_, i) => this.puzzleSlot(i, null, 'clear'));
  }

  puzzleKeyFlash(note: NoteName, known: NoteName[]): void {
    const k = this.keys.find((kk) => kk.note === note);
    if (!k) return;
    this.drawKey(k, known.includes(note), true);
    this.time.delayedCall(180, () => this.drawKey(k, known.includes(note), false));
  }

  puzzleWrong(): void {
    this.tweens.add({ targets: this.pzSlotRow, x: { from: -14, to: 0 }, duration: 380, ease: 'Elastic.easeOut' });
  }

  hidePuzzle(): void {
    if (!this.puzzleVisible) return;
    this.puzzleVisible = false;
    this.touch?.setPuzzleMode(false);
    this.tweens.add({ targets: this.pz, alpha: 0, duration: 250, onComplete: () => this.pz.setVisible(false) });
  }

  // =========================================================== gratitude

  showGratitude(m: GratitudeMission): Promise<void> {
    this.celebrate(m.tone);
    if (m.tone === 'small') return this.smallThanks(m);
    if (m.tone === 'warm') return this.warmThanks(m);
    return this.grandThanks(m);
  }

  private smallThanks(m: GratitudeMission): Promise<void> {
    return new Promise((resolve) => {
      const c = this.add.container(960, 300).setAlpha(0).setDepth(11);
      const t = this.add.text(0, 0, `«${m.message}»`, { fontFamily: FONT_TITLE, fontSize: '40px', color: WARM_CSS, fontStyle: 'italic' })
        .setOrigin(0.5).setShadow(0, 0, 'rgba(255,190,90,0.7)', 16, true, true);
      const who = this.add.text(0, 44, `— ${m.thanker}`, { fontFamily: FONT_UI, fontSize: '19px', color: '#ffd7e0' }).setOrigin(0.5).setLetterSpacing(2);
      c.add([t, who]);
      this.heartsBurst(960, 360, 8);
      this.tweens.add({ targets: c, alpha: 1, y: 280, duration: 400 });
      this.tweens.add({ targets: c, alpha: 0, delay: 2600, duration: 500, onComplete: () => { c.destroy(); resolve(); } });
    });
  }

  private warmThanks(m: GratitudeMission): Promise<void> {
    return new Promise((resolve) => {
      const dim = this.add.rectangle(960, 540, 5000, 3000, 0x020a1a, 0).setDepth(10);
      const c = this.add.container(960, 470).setAlpha(0).setDepth(11);
      const glow = this.add.image(0, 10, 'glow').setScale(5, 1.6).setTint(0xffc46a).setBlendMode(ADD).setAlpha(0.35);
      const who = this.add.text(0, -70, m.thanker.toUpperCase(), { fontFamily: FONT_UI, fontSize: '20px', color: '#ffd7e0' }).setOrigin(0.5).setLetterSpacing(6);
      const t = this.add.text(0, 0, m.message, { fontFamily: FONT_TITLE, fontSize: '68px', color: WARM_CSS, fontStyle: 'italic', align: 'center' })
        .setOrigin(0.5).setShadow(0, 0, 'rgba(255,180,80,0.85)', 24, true, true);
      c.add([glow, who, t]);
      (m.followUps ?? []).forEach((line, i) => {
        c.add(this.add.text(0, 70 + i * 34, line, { fontFamily: FONT_UI, fontSize: '22px', color: '#e8f4ff', align: 'center' }).setOrigin(0.5));
      });
      this.tweens.add({ targets: dim, fillAlpha: 0.35, duration: 500 });
      this.tweens.add({ targets: c, alpha: 1, duration: 600 });
      this.tweens.add({ targets: t, scale: { from: 0.7, to: 1 }, duration: 900, ease: 'Back.easeOut' });
      this.heartsBurst(960, 640, 18);
      this.overlayActive = true;
      this.overlayCanSkipAt = this.time.now + 1600;
      const done = () => {
        this.tweens.add({ targets: [c], alpha: 0, duration: 500 });
        this.tweens.add({ targets: dim, fillAlpha: 0, duration: 500, onComplete: () => { c.destroy(); dim.destroy(); resolve(); } });
      };
      const timer = this.time.delayedCall(4200, () => this.closeOverlay());
      this.overlayResolve = () => {
        timer.remove();
        done();
      };
    });
  }

  private grandThanks(m: GratitudeMission): Promise<void> {
    return new Promise((resolve) => {
      const dim = this.add.rectangle(960, 540, 5000, 3000, 0x020a1a, 0).setDepth(10);
      const rays = this.add.container(960, 470).setDepth(10).setAlpha(0);
      for (let i = 0; i < 14; i++) {
        const r = this.add.image(0, 0, 'ray').setOrigin(0.5, 1).setScale(0.7, 0.9).setTint(0xffd88a).setBlendMode(ADD).setAlpha(0.35);
        r.rotation = (i / 14) * Math.PI * 2;
        rays.add(r);
      }
      this.tweens.add({ targets: rays, angle: 360, duration: 60000, repeat: -1 });
      const c = this.add.container(960, 470).setDepth(11);
      const glow = this.add.image(0, 0, 'glow').setScale(9, 3).setTint(0xffc46a).setBlendMode(ADD).setAlpha(0);
      const l1 = this.add.text(0, -70, '¡GRACIAS,', { fontFamily: FONT_TITLE, fontSize: '104px', color: '#fff3d0', fontStyle: 'bold' })
        .setOrigin(0.5).setShadow(0, 0, 'rgba(255,190,80,1)', 30, true, true).setAlpha(0).setLetterSpacing(6);
      const l2 = this.add.text(0, 62, 'ROSA THE DOLPHIN!', { fontFamily: FONT_TITLE, fontSize: '112px', color: GOLD_CSS, fontStyle: 'bold' })
        .setOrigin(0.5).setShadow(0, 0, 'rgba(255,170,60,1)', 34, true, true).setAlpha(0).setLetterSpacing(4);
      const who = this.add.text(0, 160, `— ${m.thanker} —`, { fontFamily: FONT_UI, fontSize: '22px', color: '#ffd7e0' }).setOrigin(0.5).setLetterSpacing(6).setAlpha(0);
      c.add([glow, l1, l2, who]);
      const ups = (m.followUps ?? []).map((line, i) =>
        this.add.text(960, 720 + i * 52, line, { fontFamily: FONT_TITLE, fontSize: i === 0 ? '34px' : '28px', color: i === 0 ? '#eaf6ff' : GOLD_CSS, fontStyle: 'italic' })
          .setOrigin(0.5).setAlpha(0).setDepth(11).setShadow(0, 0, 'rgba(0,10,30,0.9)', 10, true, true));

      this.tweens.add({ targets: dim, fillAlpha: 0.5, duration: 1200 });
      this.tweens.add({ targets: rays, alpha: 1, duration: 1800 });
      this.tweens.add({ targets: glow, alpha: 0.55, duration: 1500 });
      this.tweens.add({ targets: l1, alpha: 1, scale: { from: 0.5, to: 1 }, duration: 1100, ease: 'Back.easeOut' });
      this.tweens.add({ targets: l2, alpha: 1, scale: { from: 0.5, to: 1 }, delay: 650, duration: 1300, ease: 'Back.easeOut' });
      this.tweens.add({ targets: who, alpha: 1, delay: 1700, duration: 900 });
      this.tweens.add({ targets: [l1, l2], scale: 1.04, delay: 2200, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.goldRain(5200);
      this.time.delayedCall(800, () => {
        this.heartsBurst(560, 700, 14);
        this.heartsBurst(1360, 700, 14);
      });
      ups.forEach((u, i) => this.tweens.add({ targets: u, alpha: 1, y: '-=12', delay: 3600 + i * 1500, duration: 900 }));

      const total = 3600 + ups.length * 1500 + 2600;
      this.overlayActive = true;
      this.overlayCanSkipAt = this.time.now + total - 600;
      const done = () => {
        this.tweens.add({ targets: [c, rays, ...ups], alpha: 0, duration: 900 });
        this.tweens.add({
          targets: dim, fillAlpha: 0, duration: 900, onComplete: () => {
            c.destroy(); rays.destroy(); dim.destroy(); ups.forEach((u) => u.destroy());
            resolve();
          },
        });
      };
      const timer = this.time.delayedCall(total, () => this.closeOverlay());
      this.overlayResolve = () => {
        timer.remove();
        done();
      };
    });
  }

  private closeOverlay(): void {
    if (!this.overlayActive) return;
    this.overlayActive = false;
    const r = this.overlayResolve;
    this.overlayResolve = null;
    r?.();
  }

  /** "MIENTRAS TANTO…": a sober card that shows the problem was not fixed. */
  showReality(text: string): Promise<void> {
    return new Promise((resolve) => {
      const c = this.add.container(960, 860).setDepth(13).setAlpha(0);
      const bg = this.add.graphics();
      bg.fillStyle(0x10161f, 0.9);
      bg.fillRoundedRect(-620, -85, 1240, 170, 18);
      bg.lineStyle(2, 0x8a96a6, 0.6);
      bg.strokeRoundedRect(-620, -85, 1240, 170, 18);
      const head = this.add.text(0, -52, 'MIENTRAS TANTO…', { fontFamily: FONT_UI, fontSize: '18px', color: '#9aa7b8' }).setOrigin(0.5).setLetterSpacing(8);
      const t = this.add.text(0, 12, text, { fontFamily: FONT_TITLE, fontSize: '34px', color: '#d9e0ea', fontStyle: 'italic', align: 'center', wordWrap: { width: 1160 } }).setOrigin(0.5);
      c.add([bg, head, t]);
      this.tweens.add({ targets: c, alpha: 1, y: 840, duration: 400 });
      this.overlayActive = true;
      this.overlayCanSkipAt = this.time.now + 1500;
      const timer = this.time.delayedCall(4600, () => this.closeOverlay());
      this.overlayResolve = () => {
        timer.remove();
        this.tweens.add({ targets: c, alpha: 0, duration: 400, onComplete: () => { c.destroy(); resolve(); } });
      };
    });
  }

  /** Rainbow + shooting stars: every completed mission is a little party. */
  celebrate(tone: 'small' | 'warm' | 'grand'): void {
    const big = tone !== 'small';
    const y = tone === 'small' ? 470 : 640;
    const scale = tone === 'grand' ? 1.75 : big ? 1.35 : 0.85;
    const rainbow = this.add.image(960, y, 'rainbow').setOrigin(0.5, 1).setDepth(10.5).setAlpha(0).setScale(scale * 0.7, scale * 0.35);
    this.tweens.add({ targets: rainbow, alpha: 0.85, scaleX: scale, scaleY: scale, duration: 900, ease: 'Back.easeOut' });
    this.tweens.add({ targets: rainbow, alpha: 0, delay: tone === 'grand' ? 7000 : big ? 3600 : 2400, duration: 1200, onComplete: () => rainbow.destroy() });
    const tints = [0xff6b8a, 0xffa45c, 0xffe066, 0x7ee08a, 0x5cc8ff, 0x7d8cff, 0xc38bff, 0xffffff];
    const stars = this.add.particles(0, 0, 'star', {
      speed: { min: 220, max: big ? 620 : 420 },
      angle: { min: 200, max: 340 },
      gravityY: 380,
      scale: { start: big ? 0.75 : 0.55, end: 0.1 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 },
      lifespan: { min: 1200, max: 2200 },
      tint: tints,
      blendMode: ADD,
      emitting: false,
    }).setDepth(12);
    // bursts around the text, never on top of it
    const points = big ? [[960, y - 400], [520, y - 60], [1400, y - 60]] : [[960, y - 80]];
    points.forEach(([px, py], i) => this.time.delayedCall(i * 220, () => stars.explode(big ? 40 : 24, px, py)));
    if (big) {
      // a gentle shower of twinkles from the top of the arc
      const rain = this.add.particles(0, 0, 'star', {
        x: { min: 960 - 480 * scale, max: 960 + 480 * scale },
        y: y - 460 * scale,
        speedY: { min: 40, max: 140 },
        speedX: { min: -30, max: 30 },
        scale: { start: 0.4, end: 0.05 },
        alpha: { start: 1, end: 0 },
        rotate: { min: 0, max: 360 },
        lifespan: 2600,
        frequency: 45,
        tint: tints,
        blendMode: ADD,
      }).setDepth(12);
      this.time.delayedCall(tone === 'grand' ? 6000 : 2800, () => rain.stop());
      this.time.delayedCall(tone === 'grand' ? 9000 : 5600, () => rain.destroy());
    }
    this.time.delayedCall(3000, () => stars.destroy());
    AudioManager.celebrate();
  }

  private heartsBurst(x: number, y: number, n: number): void {
    const e = this.add.particles(x, y, 'heart', {
      speed: { min: 80, max: 260 },
      angle: { min: 200, max: 340 },
      gravityY: 60,
      scale: { start: 0.55, end: 0.1 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 1200, max: 2000 },
      tint: [0xff9ab0, 0xffc0cc, 0xffe0a0],
      blendMode: ADD,
      emitting: false,
    }).setDepth(12);
    e.explode(n);
    this.time.delayedCall(2200, () => e.destroy());
  }

  private goldRain(ms: number): void {
    const e = this.add.particles(0, -20, 'spark', {
      x: { min: 0, max: 1920 },
      speedY: { min: 60, max: 180 },
      speedX: { min: -20, max: 20 },
      scale: { start: 0.45, end: 0.1 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 },
      lifespan: 4200,
      frequency: 40,
      tint: [0xffe9a6, 0xffd36e, 0xffffff],
      blendMode: ADD,
    }).setDepth(12);
    this.time.delayedCall(ms, () => e.stop());
    this.time.delayedCall(ms + 4500, () => e.destroy());
  }

  /** Shows big centred lines one after another (intro hints, credits...). */
  cards(lines: { text: string; size?: number; color?: string }[], hold = 2200): Promise<void> {
    return new Promise((resolve) => {
      let i = 0;
      const next = () => {
        if (i >= lines.length) return resolve();
        const l = lines[i++];
        const t = this.add.text(960, 540, l.text, { fontFamily: FONT_TITLE, fontSize: `${l.size ?? 44}px`, color: l.color ?? '#eaf6ff', fontStyle: 'italic', align: 'center' })
          .setOrigin(0.5).setAlpha(0).setShadow(0, 0, 'rgba(0,10,30,0.9)', 14, true, true).setDepth(20);
        this.tweens.add({ targets: t, alpha: 1, duration: 700 });
        this.tweens.add({ targets: t, alpha: 0, delay: hold, duration: 700, onComplete: () => { t.destroy(); next(); } });
      };
      next();
    });
  }

  showControlsHint(): void {
    const lines = isTouchDevice()
      ? [
          'Arrastra el dedo a la izquierda para nadar (más lejos = más rápido)',
          'IMPULSO para acelerar y saltar   ·   SONAR para descubrir secretos   ·   E para interactuar',
        ]
      : [
          'WASD / FLECHAS — nadar',
          'SHIFT — nadar rápido   ·   ESPACIO — impulso',
          'Q — sonar musical   ·   E — interactuar   ·   1-7 — tocar notas',
        ];
    const c = this.add.container(960, isTouchDevice() ? 300 : 990).setAlpha(0).setDepth(5);
    lines.forEach((l, i) => c.add(this.add.text(0, i * 28 - 28, l, { fontFamily: FONT_UI, fontSize: '19px', color: '#dff3ff' }).setOrigin(0.5).setLetterSpacing(1)));
    this.tweens.add({ targets: c, alpha: 0.9, duration: 800 });
    this.tweens.add({ targets: c, alpha: 0, delay: 9000, duration: 1500, onComplete: () => c.destroy() });
  }

  // =========================================================== pause

  private buildPause(): void {
    this.pausePanel = this.add.container(960, 540).setVisible(false).setDepth(30);
    const dim = this.add.rectangle(0, 0, 5000, 3000, 0x020a1a, 0.7).setInteractive();
    const title = this.add.text(0, -190, 'PAUSA', { fontFamily: FONT_TITLE, fontSize: '56px', color: GOLD_CSS, fontStyle: 'italic' }).setOrigin(0.5).setLetterSpacing(8);
    this.pausePanel.add([dim, title]);
    const items = ['Continuar', 'Controles', 'Menú principal'];
    items.forEach((label, i) => {
      const t = this.add.text(0, -60 + i * 76, label, { fontFamily: FONT_TITLE, fontSize: '38px', color: '#eaf6ff' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => this.selectPause(i));
      t.on('pointerdown', () => this.activatePause(i));
      this.pauseItems.push(t);
      this.pausePanel.add(t);
    });
    this.controlsPanel = this.buildControlsPanel();
    this.controlsPanel.setVisible(false).setDepth(31);
  }

  private buildControlsPanel(): Phaser.GameObjects.Container {
    const c = this.add.container(960, 540);
    const bg = this.add.graphics();
    bg.fillStyle(0x04142e, 0.95);
    bg.fillRoundedRect(-480, -280, 960, 560, 26);
    bg.lineStyle(2, GOLD, 0.6);
    bg.strokeRoundedRect(-480, -280, 960, 560, 26);
    c.add(bg);
    c.add(this.add.text(0, -240, 'CONTROLES', { fontFamily: FONT_TITLE, fontSize: '40px', color: GOLD_CSS, fontStyle: 'italic' }).setOrigin(0.5).setLetterSpacing(6));
    const rows: [string, string][] = [
      ['WASD / Flechas', 'Nadar'],
      ['SHIFT', 'Nadar más rápido'],
      ['ESPACIO', 'Impulso (¡salta sobre las olas!)'],
      ['Q', 'Sonar musical'],
      ['E', 'Interactuar / escuchar'],
      ['1 – 7', 'Tocar DO RE MI FA SOL LA SI'],
      ['ESC', 'Pausa / salir de un puzle'],
      ['M  ·  F', 'Silenciar  ·  Pantalla completa'],
    ];
    rows.forEach(([k, v], i) => {
      c.add(this.add.text(-60, -160 + i * 50, k, { fontFamily: FONT_UI, fontSize: '25px', color: GOLD_CSS }).setOrigin(1, 0.5));
      c.add(this.add.text(-20, -160 + i * 50, v, { fontFamily: FONT_UI, fontSize: '25px', color: '#eaf6ff' }).setOrigin(0, 0.5));
    });
    c.add(this.add.text(0, 245, 'ESC / clic para volver', { fontFamily: FONT_UI, fontSize: '17px', color: '#9fc4e6' }).setOrigin(0.5));
    const z = this.add.zone(0, 0, 5000, 3000).setInteractive();
    z.on('pointerdown', () => c.setVisible(false));
    c.addAt(z, 0);
    return c;
  }

  private selectPause(i: number): void {
    this.pauseIndex = i;
    this.pauseItems.forEach((t, k) => t.setColor(k === i ? GOLD_CSS : '#eaf6ff').setScale(k === i ? 1.08 : 1));
  }

  private activatePause(i: number): void {
    AudioManager.uiSelect();
    if (i === 0) this.togglePause(false);
    else if (i === 1) this.controlsPanel.setVisible(true);
    else {
      this.togglePause(false);
      this.gameRef?.goToMenu();
    }
  }

  private onTouchPause(): void {
    if (this.paused) {
      this.togglePause(false);
      return;
    }
    if (this.dialogueActive || this.overlayActive) return;
    if (!this.gameRef?.handleEscape()) this.togglePause(true);
  }

  togglePause(on: boolean): void {
    this.paused = on;
    this.pausePanel.setVisible(on);
    this.controlsPanel.setVisible(false);
    if (on) {
      this.scene.pause('GameScene');
      this.selectPause(0);
    } else {
      this.scene.resume('GameScene');
    }
  }

  update(): void {
    // snapshot every key once per frame so stale "just down" flags never leak between states
    const codes: Record<string, string> = {
      E: 'KeyE', SPACE: 'Space', ENTER: 'Enter', ESC: 'Escape', P: 'KeyP', UP: 'ArrowUp', DOWN: 'ArrowDown', W: 'KeyW', S: 'KeyS', M: 'KeyM',
    };
    const pressed: Record<string, boolean> = {};
    for (const [name, code] of Object.entries(codes)) pressed[name] = this.pressedCodes.has(code) || (name === 'ENTER' && this.pressedCodes.has('NumpadEnter'));
    this.pressedCodes.clear();
    const confirm = pressed.E || pressed.SPACE || pressed.ENTER;

    if (pressed.M) {
      const muted = AudioManager.toggleMute();
      bus.emit(EV.MUTE_CHANGED, muted);
      this.toast(muted ? 'Sonido desactivado' : 'Sonido activado');
    }
    if (this.paused) {
      if (pressed.ESC || pressed.P) {
        if (this.controlsPanel.visible) this.controlsPanel.setVisible(false);
        else this.togglePause(false);
      }
      if (pressed.UP || pressed.W) this.selectPause((this.pauseIndex + 2) % 3);
      if (pressed.DOWN || pressed.S) this.selectPause((this.pauseIndex + 1) % 3);
      if (confirm) {
        if (this.controlsPanel.visible) this.controlsPanel.setVisible(false);
        else this.activatePause(this.pauseIndex);
      }
      return;
    }
    if (this.dialogueActive) {
      const l = this.dlgLines[this.dlgIndex];
      if (l && this.dlgShown < l.text.length) {
        const before = Math.floor(this.dlgShown);
        this.dlgShown = Math.min(l.text.length, this.dlgShown + this.game.loop.delta * 0.05);
        if (Math.floor(this.dlgShown) !== before) {
          this.dlgText.setText(l.text.slice(0, Math.floor(this.dlgShown)));
          if (Math.floor(this.dlgShown) % 4 === 0) AudioManager.talk();
        }
      }
      if (confirm) this.advanceDialogue();
      return;
    }
    if (this.overlayActive) {
      if (confirm && this.time.now > this.overlayCanSkipAt) this.closeOverlay();
      return;
    }
    if (pressed.ESC || pressed.P) {
      if (!this.gameRef?.handleEscape()) this.togglePause(true);
    }
  }
}
