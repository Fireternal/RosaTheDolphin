import Phaser from 'phaser';
import { centerLayout } from '../core/layout';
import { FONT_TITLE, FONT_UI, GOLD, GOLD_CSS } from '../config';
import { AudioManager } from '../systems/AudioManager';
import { SaveManager } from '../systems/SaveManager';
import { SongStore } from '../systems/SongStore';
import { MenuBackdrop } from './MenuBackdrop';

interface Item {
  label: string;
  text: Phaser.GameObjects.Text;
  enabled: boolean;
  action: () => void;
}

export class MenuScene extends Phaser.Scene {
  private backdrop!: MenuBackdrop;
  private items: Item[] = [];
  private index = 0;
  private controls!: Phaser.GameObjects.Container;
  private music!: Phaser.GameObjects.Container;
  private musicStatus!: Phaser.GameObjects.Text;
  private musicItems: Phaser.GameObjects.Text[] = [];
  private musicIndex = 0;
  private static songLoaded = false;
  private leaving = false;
  private marker!: Phaser.GameObjects.Image;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    centerLayout(this);
    AudioManager.setSongPreview(true);
    this.items = [];
    this.index = 0;
    this.leaving = false;
    this.backdrop = new MenuBackdrop(this);

    const titleGlow = this.add.image(560, 300, 'glow').setScale(5, 2.4).setTint(0xffd36e).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD).setDepth(29);
    this.tweens.add({ targets: titleGlow, alpha: 0.28, duration: 2600, yoyo: true, repeat: -1 });
    const rosa = this.add.text(560, 250, 'ROSA', { fontFamily: FONT_TITLE, fontSize: '190px', color: '#fff3d6', fontStyle: 'bold' })
      .setOrigin(0.5).setShadow(0, 0, 'rgba(255,190,80,0.9)', 28, true, true).setLetterSpacing(14).setDepth(30);
    const the = this.add.text(560, 386, 'THE DOLPHIN', { fontFamily: FONT_TITLE, fontSize: '74px', color: GOLD_CSS, fontStyle: 'italic' })
      .setOrigin(0.5).setShadow(0, 0, 'rgba(255,170,60,0.8)', 18, true, true).setLetterSpacing(10).setDepth(30);
    const clef = this.add.image(560 + 300, 236, 'clef').setTint(GOLD).setScale(0.75).setDepth(30).setAlpha(0.9);
    this.tweens.add({ targets: clef, angle: { from: -6, to: 6 }, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.text(560, 470, 'Una aventura en busca de la melodía perdida', { fontFamily: FONT_TITLE, fontSize: '30px', color: '#e2f1ff', fontStyle: 'italic' })
      .setOrigin(0.5).setShadow(0, 2, 'rgba(0,10,30,0.9)', 8).setDepth(30);
    [rosa, the].forEach((t, i) => this.tweens.add({ targets: t, alpha: { from: 0, to: 1 }, y: `+=${0}`, duration: 1400, delay: i * 300 }));

    const hasSave = SaveManager.hasSave();
    const defs: [string, boolean, () => void][] = [
      ['JUGAR', true, () => this.startNew()],
      ['CONTINUAR', hasSave, () => this.continueGame()],
      ['CONTROLES', true, () => this.showControls(true)],
      ['MÚSICA', true, () => this.showMusic(true)],
    ];
    this.marker = this.add.image(0, 0, 'glyph').setTint(GOLD).setScale(0.32).setDepth(31);
    defs.forEach(([label, enabled, action], i) => {
      const t = this.add.text(560, 610 + i * 86, label, { fontFamily: FONT_TITLE, fontSize: '46px', color: '#eaf6ff' })
        .setOrigin(0.5).setLetterSpacing(8).setDepth(30).setAlpha(enabled ? 1 : 0.3)
        .setShadow(0, 2, 'rgba(0,10,30,0.9)', 8);
      if (enabled) {
        t.setInteractive({ useHandCursor: true });
        t.on('pointerover', () => this.select(i));
        t.on('pointerdown', () => this.activate(i));
      }
      this.items.push({ label, text: t, enabled, action });
    });
    this.select(0, true);

    this.add.text(960, 1050, 'Vertical slice · Melodía I — La Rotonda Sumergida', { fontFamily: FONT_UI, fontSize: '15px', color: '#9fc4e6' })
      .setOrigin(0.5).setAlpha(0.5).setDepth(30);
    this.controls = this.buildControls();
    this.musicItems = [];
    this.music = this.buildMusic();

    const kb = this.input.keyboard!;
    kb.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.input.on('pointerdown', () => this.ensureAudio());
    this.cameras.main.fadeIn(900, 2, 10, 26);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off('keydown'));
  }

  private ensureAudio(): void {
    const first = !AudioManager.ready;
    AudioManager.unlock();
    AudioManager.startMusic();
    if (first) {
      AudioManager.setFullMode(false);
      AudioManager.setLayerCount(1, 3);
    }
    if (!MenuScene.songLoaded && AudioManager.ready) {
      MenuScene.songLoaded = true;
      void SongStore.load().then(async (song) => {
        if (song && (await AudioManager.setCustomSong(song.data.slice(0), song.name))) this.refreshMusic();
      });
    }
  }

  private onKey(e: KeyboardEvent): void {
    this.ensureAudio();
    if (this.leaving) return;
    if (this.controls.visible) {
      if (['Escape', 'Enter', ' ', 'e', 'E'].includes(e.key)) this.showControls(false);
      return;
    }
    if (this.music.visible) {
      if (e.key === 'Escape') this.showMusic(false);
      else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') this.selectMusic((this.musicIndex + 2) % 3);
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') this.selectMusic((this.musicIndex + 1) % 3);
      else if (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E') this.activateMusic(this.musicIndex);
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') this.move(-1);
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') this.move(1);
    else if (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E') this.activate(this.index);
  }

  private move(dir: number): void {
    let i = this.index;
    do i = (i + dir + this.items.length) % this.items.length;
    while (!this.items[i].enabled);
    this.select(i);
  }

  private select(i: number, silent = false): void {
    if (!this.items[i]?.enabled) return;
    if (i !== this.index && !silent) AudioManager.uiMove();
    this.index = i;
    this.items.forEach((it, k) => {
      it.text.setColor(k === i ? GOLD_CSS : '#eaf6ff').setScale(k === i ? 1.08 : 1);
    });
    const t = this.items[i].text;
    this.marker.setPosition(t.x - t.displayWidth / 2 - 44, t.y);
    this.tweens.killTweensOf(this.marker);
    this.tweens.add({ targets: this.marker, x: this.marker.x + 8, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private activate(i: number): void {
    this.ensureAudio();
    const it = this.items[i];
    if (!it?.enabled || this.leaving) return;
    AudioManager.uiSelect();
    it.action();
  }

  private startNew(): void {
    this.leaving = true;
    SaveManager.clear();
    AudioManager.setLayerCount(0, 2);
    this.cameras.main.fadeOut(900, 2, 10, 26);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('IntroScene'));
  }

  private continueGame(): void {
    this.leaving = true;
    this.cameras.main.fadeOut(900, 2, 10, 26);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('GameScene', { continue: true }));
  }

  private buildControls(): Phaser.GameObjects.Container {
    const c = this.add.container(960, 540).setDepth(50).setVisible(false);
    const dim = this.add.rectangle(0, 0, 5000, 3000, 0x020a1a, 0.6).setInteractive();
    dim.on('pointerdown', () => this.showControls(false));
    const bg = this.add.graphics();
    bg.fillStyle(0x04142e, 0.95);
    bg.fillRoundedRect(-500, -320, 1000, 640, 26);
    bg.lineStyle(2, GOLD, 0.6);
    bg.strokeRoundedRect(-500, -320, 1000, 640, 26);
    c.add([dim, bg]);
    c.add(this.add.text(0, -270, 'CONTROLES', { fontFamily: FONT_TITLE, fontSize: '44px', color: GOLD_CSS, fontStyle: 'italic' }).setOrigin(0.5).setLetterSpacing(6));
    const rows: [string, string][] = [
      ['WASD / Flechas', 'Nadar en cualquier dirección'],
      ['SHIFT', 'Nadar más rápido'],
      ['ESPACIO', 'Impulso — ¡salta sobre las olas!'],
      ['Q', 'Sonar musical: revela secretos'],
      ['E', 'Interactuar / escuchar'],
      ['1 – 7', 'Tocar DO · RE · MI · FA · SOL · LA · SI'],
      ['ESC', 'Pausa / salir de un puzle'],
      ['M  ·  F', 'Silenciar  ·  Pantalla completa'],
    ];
    rows.forEach(([k, v], i) => {
      c.add(this.add.text(-70, -180 + i * 54, k, { fontFamily: FONT_UI, fontSize: '26px', color: GOLD_CSS }).setOrigin(1, 0.5));
      c.add(this.add.text(-30, -180 + i * 54, v, { fontFamily: FONT_UI, fontSize: '26px', color: '#eaf6ff' }).setOrigin(0, 0.5));
    });
    c.add(this.add.text(0, 280, 'ESC / ENTER / clic para volver', { fontFamily: FONT_UI, fontSize: '18px', color: '#9fc4e6' }).setOrigin(0.5));
    return c;
  }

  // ------------------------------------------------------------ music panel

  private buildMusic(): Phaser.GameObjects.Container {
    const c = this.add.container(960, 540).setDepth(50).setVisible(false);
    const dim = this.add.rectangle(0, 0, 5000, 3000, 0x020a1a, 0.6).setInteractive();
    dim.on('pointerdown', () => this.showMusic(false));
    const bg = this.add.graphics();
    bg.fillStyle(0x04142e, 0.96);
    bg.fillRoundedRect(-560, -300, 1120, 600, 26);
    bg.lineStyle(2, GOLD, 0.6);
    bg.strokeRoundedRect(-560, -300, 1120, 600, 26);
    const panelBlock = this.add.zone(0, 0, 1120, 600).setInteractive();
    c.add([dim, bg, panelBlock]);
    c.add(this.add.text(0, -250, 'MÚSICA DE FONDO', { fontFamily: FONT_TITLE, fontSize: '42px', color: GOLD_CSS, fontStyle: 'italic' }).setOrigin(0.5).setLetterSpacing(6));
    this.musicStatus = this.add.text(0, -170, '', { fontFamily: FONT_UI, fontSize: '25px', color: '#eaf6ff', align: 'center', wordWrap: { width: 1000 } }).setOrigin(0.5);
    c.add(this.musicStatus);
    const labels = ['Elegir una canción de mi dispositivo…', 'Usar la banda sonora original', 'Volver'];
    labels.forEach((l, i) => {
      const t = this.add.text(0, -60 + i * 72, l, { fontFamily: FONT_TITLE, fontSize: '34px', color: '#eaf6ff' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => this.selectMusic(i));
      t.on('pointerdown', () => this.activateMusic(i));
      this.musicItems.push(t);
      c.add(t);
    });
    c.add(this.add.text(0, 200,
      'Se guarda solo en este navegador (en cada dispositivo hay que elegirla una vez) y no se sube a ningún sitio.\nEn el menú suena entera; en el nivel empieza suave y se abre con cada fragmento que encuentras.',
      { fontFamily: FONT_UI, fontSize: '19px', color: '#9fc4e6', align: 'center', lineSpacing: 8 }).setOrigin(0.5));
    this.refreshMusic();
    return c;
  }

  private refreshMusic(): void {
    if (!this.musicStatus?.active) return;
    const name = AudioManager.customSongName;
    this.musicStatus.setText(name ? `Ahora suena: «${name}»` : 'Ahora suena: la banda sonora original de Rosa');
  }

  private selectMusic(i: number): void {
    if (i !== this.musicIndex) AudioManager.uiMove();
    this.musicIndex = i;
    this.musicItems.forEach((t, k) => t.setColor(k === i ? GOLD_CSS : '#eaf6ff').setScale(k === i ? 1.06 : 1));
  }

  private activateMusic(i: number): void {
    AudioManager.uiSelect();
    if (i === 0) this.pickSong();
    else if (i === 1) {
      AudioManager.clearCustomSong();
      void SongStore.clear();
      this.refreshMusic();
    } else this.showMusic(false);
  }

  private pickSong(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.style.display = 'none';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return;
      this.musicStatus.setText('Cargando…');
      const data = await file.arrayBuffer();
      const name = file.name.replace(/\.[^.]+$/, '');
      const ok = await AudioManager.setCustomSong(data.slice(0), name);
      if (ok) {
        await SongStore.save({ name, data });
        this.refreshMusic();
      } else {
        this.musicStatus.setText('No he podido leer ese archivo. Prueba con un MP3, OGG o WAV.');
      }
    });
    document.body.appendChild(input);
    input.click();
  }

  private showMusic(v: boolean): void {
    this.music.setVisible(v);
    if (v) {
      this.refreshMusic();
      this.selectMusic(0);
      this.tweens.add({ targets: this.music, alpha: { from: 0, to: 1 }, duration: 250 });
    }
  }

  private showControls(v: boolean): void {
    this.controls.setVisible(v);
    if (v) this.tweens.add({ targets: this.controls, alpha: { from: 0, to: 1 }, duration: 250 });
  }

  update(_t: number, delta: number): void {
    this.backdrop.update(Math.min(delta / 1000, 0.05));
  }
}
