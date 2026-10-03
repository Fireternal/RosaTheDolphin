import Phaser from 'phaser';
import { DEPTH, GOLD_CSS, LAYER_NAMES, NOTE_INFO, NOTE_ORDER, NoteName } from '../config';
import { bus, EV } from '../core/EventBus';
import { damp, dist, isDebug, wait } from '../core/util';
import { isTouchDevice } from '../core/layout';
import { DolphinPod, FishSchool, Jellyfish, Lumi, Manta, Turtle, TurtleQueue } from '../entities/Creatures';
import { IconKind, InteractMarker, QuestIcon } from '../entities/InteractMarker';
import { MelodyFragment } from '../entities/MelodyFragment';
import { MusicalNote } from '../entities/MusicalNote';
import { RosaPlayer } from '../entities/RosaPlayer';
import { CurrentZone, SwimInput, SwimWorld } from '../entities/SwimmingController';
import { ROTONDA_MISSIONS } from '../level/missions';
import { RotondaBuilder } from '../level/RotondaBuilder';
import {
  BRUNO_HIDE, CLAM, CONCH, CURRENT, CURRENT_BARRIER, FINAL_MELODY, floorAt, FRAGMENT_SPOTS, GROTTO, LUMI_START, MAREA_HOME,
  NOTE_SPOTS, ORGAN, PUZZLES, Rect, RING, ROSA_START, STATIC_COLLIDERS, STATUE, STATUE_PUZZLE, TOWER, WORLD,
} from '../level/RotondaData';
import { AudioManager } from '../systems/AudioManager';
import { GratitudeSystem } from '../systems/GratitudeSystem';
import { MusicPuzzle } from '../systems/MusicPuzzle';
import { ObjectiveSystem } from '../systems/ObjectiveSystem';
import { ParticleManager } from '../systems/ParticleManager';
import { SaveData, SaveManager } from '../systems/SaveManager';
import { SonarSystem } from '../systems/SonarSystem';
import type { UIScene } from './UIScene';

interface Interactable {
  id: string;
  pos: () => { x: number; y: number };
  radius: number;
  label: () => string;
  enabled: () => boolean;
  action: () => void;
  /** Vertical offset of the floating "E" marker from pos(). */
  markerY: number;
  /** Show the inviting "near" marker before Rosa is in range. */
  invite?: boolean;
  /** "!" (has a mission) or a speech bubble (just talks) floating over them. */
  icon?: () => IconKind;
}

const ADD = Phaser.BlendModes.ADD;
const FINAL_LABEL = 'Melodía de la Rotonda';

export class GameScene extends Phaser.Scene {
  private save!: SaveData;
  private ui!: UIScene;
  private rosa!: RosaPlayer;
  private builder!: RotondaBuilder;
  private particles!: ParticleManager;
  private sonar!: SonarSystem;
  private gratitude!: GratitudeSystem;
  private objectives!: ObjectiveSystem;
  private notes: MusicalNote[] = [];
  private fragments: MelodyFragment[] = [];
  private lumi!: Lumi;
  private marea!: Turtle;
  private bruno!: Turtle;
  private schools: FishSchool[] = [];
  private jellies: Jellyfish[] = [];
  private manta!: Manta;
  private turtleQueue!: TurtleQueue;
  private locals!: DolphinPod;
  private germans: DolphinPod | null = null;
  private sewage!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sewageHaze!: Phaser.GameObjects.Image;
  private puzzles!: { gate: MusicPuzzle; organ: MusicPuzzle; final: MusicPuzzle };
  private activePuzzle: MusicPuzzle | null = null;
  private puzzleBusy = false;
  private interactables: Interactable[] = [];
  private markers = new Map<string, InteractMarker>();
  private icons = new Map<string, QuestIcon>();
  private busy = false;
  private ready = false;
  private gateOpen = false;
  private currentUp = false;
  private clamOpen = false;
  private statueAwake = false;
  private finaleDone = false;
  private brunoFollowing = false;
  private camFocus = { x: 0, y: 0 };
  private cinematic = false;
  private world!: SwimWorld;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  /** Key presses queued from keydown events, so short taps are never lost at low frame rates. */
  private pressedCodes: string[] = [];
  private bubbleTimer = 0;
  private saveTimer = 0;
  private lastMissingToast = 0;
  private hintTime = 0;

  constructor() {
    super('GameScene');
  }

  create(data: { continue?: boolean }): void {
    // reset per-run state (scenes are reused when restarting)
    this.notes = [];
    this.fragments = [];
    this.schools = [];
    this.jellies = [];
    this.interactables = [];
    this.activePuzzle = null;
    this.puzzleBusy = false;
    this.busy = false;
    this.ready = false;
    this.gateOpen = this.currentUp = this.clamOpen = this.statueAwake = this.finaleDone = this.brunoFollowing = false;
    this.cinematic = false;

    this.save = (data?.continue && SaveManager.load()) || SaveManager.fresh();
    if (!data?.continue) SaveManager.save(this.save);

    this.cameras.main.setBounds(0, WORLD.top, WORLD.w, WORLD.bottom - WORLD.top);
    this.cameras.main.setBackgroundColor('#062a52');
    if (this.renderer.type === Phaser.WEBGL) this.cameras.main.postFX.addVignette(0.5, 0.5, 0.92, 0.32);

    this.builder = new RotondaBuilder(this);
    this.builder.build();
    this.particles = new ParticleManager(this);
    this.sonar = new SonarSystem(this);

    const start = this.save.rosa ?? ROSA_START;
    this.rosa = new RosaPlayer(this, start.x, start.y);
    this.camFocus = { x: start.x, y: start.y };
    this.cameras.main.startFollow(this.camFocus, false, 0.09, 0.09);
    this.cameras.main.centerOn(start.x, start.y);

    this.world = {
      surfaceY: WORLD.surface,
      minX: 70,
      maxX: WORLD.w - 70,
      minY: WORLD.top + 120,
      floorAt,
      colliders: () => this.colliders(),
      currents: () => this.currents(),
    };

    this.createCreatures();
    this.createCollectibles();
    this.createPuzzles();
    this.createInteractables();
    this.registerSonarTargets();
    this.markers = new Map(this.interactables.map((it) => [it.id, new InteractMarker(this)]));
    this.icons = new Map(this.interactables.filter((it) => it.icon).map((it) => [it.id, new QuestIcon(this)]));

    this.keys = this.input.keyboard!.addKeys({
      UP: 'UP', DOWN: 'DOWN', LEFT: 'LEFT', RIGHT: 'RIGHT', W: 'W', A: 'A', S: 'S', D: 'D',
      SHIFT: 'SHIFT', SPACE: 'SPACE', Q: 'Q', E: 'E',
    }) as Record<string, Phaser.Input.Keyboard.Key>;

    this.pressedCodes = [];
    const onKey = (e: KeyboardEvent) => {
      if (!e.repeat) this.pressedCodes.push(e.code);
    };
    this.input.keyboard!.on('keydown', onKey);
    this.events.on(Phaser.Scenes.Events.RESUME, () => { this.pressedCodes = []; });

    bus.on(EV.NOTE_INPUT, this.onNoteInput, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off(EV.NOTE_INPUT, this.onNoteInput, this);
      this.input.keyboard?.off('keydown', onKey);
      this.scene.stop('UIScene');
    });

    AudioManager.unlock();
    AudioManager.startMusic();
    AudioManager.setSongPreview(false);
    AudioManager.setFullMode(false);
    AudioManager.duck(1, 1);
    AudioManager.setNotePool(this.save.notes);
    AudioManager.setLayerCount(this.save.fragmentOrder.length, 2);

    this.scene.launch('UIScene');
    this.ui = this.scene.get('UIScene') as UIScene;
    this.ui.events.once(Phaser.Scenes.Events.CREATE, () => this.onUiReady(!!data?.continue));
    this.cameras.main.fadeIn(1200, 2, 10, 26);

    if (isDebug() || import.meta.env.DEV) this.exposeDebug();
  }

  private onUiReady(isContinue: boolean): void {
    this.ui.bindGame(this);
    this.objectives = new ObjectiveSystem(this.ui);
    this.gratitude = new GratitudeSystem(this.save, this.ui, () => this.persist());
    this.gratitude.register(...ROTONDA_MISSIONS);
    this.applySavedState();
    this.ui.setFragments(this.slots());
    this.ui.setNotes(this.save.notes);
    this.ui.setGratitudeCount(this.gratitude.count);
    this.ready = true;
    this.updateObjective();
    if (!this.save.flags.introDone) void this.runIntro();
    else {
      this.lumi.following = true;
      if (isContinue) this.ui.toast('Bienvenida de nuevo, Rosa', 'La Rotonda Sumergida');
    }
  }

  // =========================================================== setup

  private createCreatures(): void {
    this.lumi = new Lumi(this, LUMI_START.x, LUMI_START.y);
    this.marea = new Turtle(this, MAREA_HOME.x, MAREA_HOME.y, 'turtle', 160);
    this.bruno = new Turtle(this, BRUNO_HIDE.x, BRUNO_HIDE.y, 'turtle_baby', 60);
    this.bruno.mode = 'hide';
    this.bruno.sprite.setDepth(DEPTH.CREATURES + 1);

    const R = Phaser.Geom.Rectangle;
    this.schools.push(new FishSchool(this, new R(300, 500, 1200, 900), 12, 'fish_0'));
    this.schools.push(new FishSchool(this, new R(600, 1700, 900, 700), 10, 'fish_2'));
    this.schools.push(new FishSchool(this, new R(1300, 200, 1400, 500), 9, 'fish_3', 0.9));
    this.schools.push(new FishSchool(this, new R(4300, 1500, 900, 700), 7, 'fish_2', 0.9));

    for (const [x, y] of [[5960, 470], [6090, 520], [6020, 380], [5700, 700], [6300, 820]]) this.jellies.push(new Jellyfish(this, x, y));
    this.manta = new Manta(this, RING.cx + 300, RING.cy - 520, 1700, 180);

    // the famous queues of La Rotonda
    this.turtleQueue = new TurtleQueue(this, RING.cx, RING.cy + 80, RING.rx + 120, RING.ry + 150, 22);
    // a dolphin family with nowhere to live, waiting by the closed grotto
    this.locals = new DolphinPod(this, 'dolphin_local', [{ x: 4930, y: 2330 }, { x: 5020, y: 2400 }, { x: 4860, y: 2420 }]);
    this.germans = null;
    this.createSewage();
  }

  /** The Tower's outfall pours sewage into the sea. */
  private createSewage(): void {
    this.add.image(6420, 1500, 'pipe').setOrigin(1, 0.5).setDepth(DEPTH.MID_FRONT + 3);
    this.sewageHaze = this.add.image(5750, 1620, 'glow').setTint(0x4a3a18).setScale(6, 4).setAlpha(0.5).setDepth(DEPTH.MID_FRONT + 2);
    this.sewage = this.makeSewage(false);
  }

  private makeSewage(strong: boolean): Phaser.GameObjects.Particles.ParticleEmitter {
    return this.add.particles(6070, 1500, 'softdot', {
      speedX: strong ? { min: -340, max: -90 } : { min: -150, max: -40 },
      speedY: { min: -20, max: strong ? 120 : 60 },
      scale: { start: strong ? 2.4 : 1.6, end: strong ? 8 : 5 },
      alpha: { start: 0.85, end: 0 },
      lifespan: strong ? 6500 : 5500,
      frequency: strong ? 14 : 70,
      tint: [0x4a3a14, 0x5c4618, 0x6b5221, 0x3d3010],
    }).setDepth(DEPTH.MID_FRONT + 2);
  }

  /** The new "Great Outfall Pump": three times more sewage. */
  private moreSewage(instant: boolean): void {
    this.sewage.stop();
    const old = this.sewage;
    this.time.delayedCall(7000, () => old.destroy());
    this.sewage = this.makeSewage(true);
    if (instant) {
      this.sewageHaze.setScale(12, 7).setAlpha(0.75);
      return;
    }
    this.tweens.add({ targets: this.sewageHaze, scaleX: 12, scaleY: 7, alpha: 0.75, duration: 3000 });
    this.particles.bubble(6070, 1500, 30);
    AudioManager.rumble(2);
  }

  /** Homes inside the grotto, taken by the visitors. */
  private grottoHomes(): { x: number; y: number }[] {
    const homes: { x: number; y: number }[] = [];
    for (let i = 0; i < 14; i++) homes.push({ x: 5450 + (i % 7) * 135 + (i > 6 ? 60 : 0), y: 2200 + Math.floor(i / 7) * 230 + (i % 2) * 60 });
    return homes;
  }

  private createCollectibles(): void {
    for (const s of NOTE_SPOTS) {
      if (this.save.notes.includes(s.note)) continue;
      this.notes.push(new MusicalNote(this, s.note, s.x, s.y, s.hidden));
    }
    for (const s of FRAGMENT_SPOTS) {
      if (this.save.fragments.includes(s.id)) continue;
      this.fragments.push(new MelodyFragment(this, s, FINAL_MELODY[s.slot]));
    }
  }

  private createPuzzles(): void {
    this.puzzles = {
      gate: new MusicPuzzle(this, {
        id: 'gate', label: 'La Puerta de Coral', x: CONCH.x, y: CONCH.y - 120, radius: 260,
        sourceX: CONCH.x, sourceY: CONCH.y - 200, notes: PUZZLES.gate, inst: 'bell',
      }),
      organ: new MusicPuzzle(this, {
        id: 'organ', label: 'El Órgano de las Mareas', x: ORGAN.x, y: ORGAN.y - 150, radius: 280,
        sourceX: ORGAN.x, sourceY: ORGAN.y - 340, notes: PUZZLES.organ, inst: 'flute', interval: 700,
      }),
      final: new MusicPuzzle(this, {
        id: 'final', label: FINAL_LABEL, x: STATUE_PUZZLE.x, y: STATUE_PUZZLE.y, radius: 420,
        sourceX: STATUE.x, sourceY: STATUE_PUZZLE.y - 320, notes: FINAL_MELODY, inst: 'bell', interval: 640,
      }),
    };
    for (const id of this.save.puzzles) {
      const p = (this.puzzles as Record<string, MusicPuzzle>)[id];
      if (p) p.solved = true;
    }
  }

  private createInteractables(): void {
    const statuePos = () => STATUE_PUZZLE;
    this.interactables = [
      {
        id: 'statue', markerY: -90, invite: true, pos: statuePos, radius: 420,
        label: () => (this.statueAwake ? 'E — INTERPRETAR LA MELODÍA' : 'E — ESCUCHAR'),
        enabled: () => !this.finaleDone,
        action: () => this.interactStatue(), icon: () => (this.statueAwake ? 'quest' : null),
      },
      {
        id: 'conch', markerY: -150, invite: true, pos: () => ({ x: CONCH.x, y: CONCH.y - 120 }), radius: 260,
        label: () => 'E — ESCUCHAR', enabled: () => !this.puzzles.gate.solved,
        action: () => void this.startGatePuzzle(), icon: () => 'quest',
      },
      {
        id: 'organ', markerY: -200, invite: true, pos: () => ({ x: ORGAN.x, y: ORGAN.y - 150 }), radius: 280,
        label: () => 'E — ESCUCHAR', enabled: () => !this.puzzles.organ.solved,
        action: () => void this.startOrganPuzzle(), icon: () => 'quest',
      },
      {
        id: 'clam', markerY: -110, invite: true, pos: () => ({ x: CLAM.x, y: CLAM.y - 80 }), radius: 240,
        label: () => 'E — ESCUCHAR', enabled: () => !this.clamOpen,
        action: () => this.ui.toast('La almeja duerme profundamente…', 'Quizá un sonido la despierte (Q — SONAR)', '#ffe2d0'),
      },
      {
        id: 'bruno', markerY: -80, invite: true, pos: () => this.bruno, radius: 190,
        label: () => 'E — HABLAR', enabled: () => this.bruno.mode === 'hide',
        action: () => void this.talkBruno(), icon: () => (this.save.flags.metMarea ? 'quest' : null),
      },
      {
        id: 'marea', markerY: -110, invite: true, pos: () => this.marea, radius: 230,
        label: () => 'E — HABLAR', enabled: () => !this.gratitude?.isDone('bruno') && this.bruno.mode !== 'follow',
        action: () => void this.talkMarea(), icon: () => (this.save.flags.metMarea ? 'talk' : 'quest'),
      },
      {
        id: 'lumi', markerY: -70, invite: false, pos: () => this.lumi, radius: 130,
        label: () => 'E — HABLAR CON LUMI', enabled: () => this.lumi.following && !!this.save.flags.introDone,
        action: () => void this.talkLumi(),
      },
    ];
  }

  private registerSonarTargets(): void {
    for (const n of this.notes) this.sonar.add({ x: n.x, y: n.y, onSonar: () => { n.reveal(); n.pulse(); } });
    for (const f of this.fragments) this.sonar.add({ x: f.x, y: f.y, onSonar: () => { if (f.spawned) f.reveal(); } });
    this.sonar.add({ x: CLAM.x, y: CLAM.y - 40, reach: 60, onSonar: () => this.openClam() });
    const wiggle = (img: Phaser.GameObjects.Image) => () => {
      this.tweens.add({ targets: img, angle: { from: -4, to: 0 }, duration: 700, ease: 'Elastic.easeOut' });
      this.particles.glyph(img.x, img.y - img.displayHeight * 0.6, 2);
    };
    this.sonar.add({ x: CONCH.x, y: CONCH.y - 60, onSonar: wiggle(this.builder.conch) });
    this.sonar.add({ x: ORGAN.x, y: ORGAN.y - 120, onSonar: wiggle(this.builder.organ) });
    this.sonar.add({
      x: STATUE.x, y: STATUE.baseY - 700, reach: 400, onSonar: () => {
        this.tweens.add({ targets: this.builder.statueGlow, alpha: { from: 0.35, to: this.statueAwake ? 0.25 : 0 }, duration: 1600 });
      },
    });
    for (const s of this.schools) this.sonar.add({ get x() { return s.x; }, get y() { return s.y; }, onSonar: (p) => s.scatter(p.x, p.y) });
    for (const j of this.jellies) this.sonar.add({ get x() { return j.x; }, get y() { return j.y; }, onSonar: () => j.flash(this) });
    for (const t of [this.marea, this.bruno]) {
      this.sonar.add({ get x() { return t.x; }, get y() { return t.y; }, onSonar: () => {
        this.tweens.add({ targets: t.sprite, y: '-=16', duration: 180, yoyo: true, ease: 'Sine.easeOut' });
        this.particles.glyph(t.x, t.y - 60, 1);
      } });
    }
  }

  // =========================================================== state

  private slots(): (NoteName | null)[] {
    const out: (NoteName | null)[] = Array(7).fill(null);
    for (const id of this.save.fragments) {
      const s = FRAGMENT_SPOTS.find((f) => f.id === id);
      if (s) out[s.slot] = FINAL_MELODY[s.slot];
    }
    return out;
  }

  private persist(): void {
    this.save.rosa = { x: Math.round(this.rosa.x), y: Math.round(Math.max(60, this.rosa.y)) };
    SaveManager.save(this.save);
  }

  private applySavedState(): void {
    const f = this.save.flags;
    if (f.clamOpen) this.openClam(true);
    if (this.gratitude.isDone('bruno')) this.reuniteTurtles(true);
    if (this.puzzles.gate.solved) this.openGate(true);
    if (this.puzzles.organ.solved) {
      this.reverseCurrent(true);
      this.moreSewage(true);
    }
    if (this.save.fragments.length >= 7) this.awakenStatue(true);
    if (this.save.completed) this.restoreRotonda(true);
    for (const fr of this.fragments) {
      if (fr.spot.spawnsOn === 'mission:bruno' && this.gratitude.isDone('bruno')) fr.spawn();
    }
  }

  private updateObjective(): void {
    const n = this.save.fragments.length;
    if (this.save.completed) this.objectives.set('La Rotonda vuelve a cantar. Nada libremente.');
    else if (!this.save.flags.introDone) this.objectives.set('Escucha a la pequeña criatura que se acerca.');
    else if (n < 7) this.objectives.set('Encuentra los fragmentos de la melodía.', { cur: n, total: 7 });
    else this.objectives.set('Regresa al centro de la Rotonda e interpreta la melodía.', { cur: 7, total: 7 });
  }

  private colliders(): Rect[] {
    const list = [...STATIC_COLLIDERS];
    if (!this.gateOpen) list.push(GROTTO.gate);
    if (!this.currentUp) list.push(CURRENT_BARRIER);
    return list;
  }

  private currents(): CurrentZone[] {
    return [{ ...CURRENT, fx: 0, fy: this.currentUp ? -2300 : 2600 }];
  }

  private known(): NoteName[] {
    return this.save.notes;
  }

  private toScreen(x: number, y: number): { x: number; y: number } {
    const cam = this.cameras.main;
    return { x: (x - cam.worldView.x) * cam.zoom, y: (y - cam.worldView.y) * cam.zoom };
  }

  // =========================================================== loop

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    const k = this.keys;
    // consume every queued key press once per frame, in the order they happened
    const q = this.pressedCodes;
    this.pressedCodes = [];
    const has = (code: string) => q.includes(code);
    const noteSeq: NoteName[] = [];
    for (const code of q) {
      const m = /^(?:Digit|Numpad)([1-7])$/.exec(code);
      if (m) noteSeq.push(NOTE_ORDER[Number(m[1]) - 1]);
    }
    const touch = this.ui?.touch;
    const tapped = touch?.consume() ?? { boost: false, sonar: false, interact: false };
    const pressed = { Q: has('KeyQ') || tapped.sonar, E: has('KeyE') || tapped.interact, SPACE: has('Space') || tapped.boost };
    if (!this.ready) return;

    const uiBlocked = this.ui.dialogueActive || this.ui.paused;
    const canAct = !uiBlocked && !this.busy;
    const canMove = canAct && !this.activePuzzle;

    const input: SwimInput = { x: 0, y: 0, sprint: false, boost: false };
    if (canMove) {
      input.x = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
      input.y = (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);
      input.sprint = k.SHIFT.isDown;
      input.boost = pressed.SPACE;
      if (touch && (touch.axisX !== 0 || touch.axisY !== 0)) {
        // analogue stick: pushing it all the way also sprints
        input.x = touch.axisX;
        input.y = touch.axisY;
        input.sprint = Math.hypot(touch.axisX, touch.axisY) > 0.92;
      }
    }

    const ev = this.rosa.update(dt, input, this.world);
    this.onSwimEvents(ev, dt);

    if (canAct) {
      if (this.activePuzzle) {
        noteSeq.forEach((n) => this.onNoteInput(n));
        if (pressed.E && !this.puzzleBusy) void this.listenPuzzle(this.activePuzzle);
      } else {
        if (pressed.Q && this.sonar.emit(this.rosa.x, this.rosa.y)) this.particles.glyph(this.rosa.x, this.rosa.y - 40, 3);
        noteSeq.forEach((n) => this.playFreeNote(n));
        const it = this.nearestInteractable();
        this.ui.setPrompt(it ? it.label() : null);
        touch?.setInteractAvailable(!!it);
        this.updateMarkers(dt, it);
        if (pressed.E && it) {
          AudioManager.uiMove();
          it.action();
        }
      }
      if (this.activePuzzle) this.updateMarkers(dt, null, true);
    } else {
      if (!this.activePuzzle) this.ui.setPrompt(null);
      this.updateMarkers(dt, null, true);
    }

    this.sonar.update(dt);
    this.ui.setSonar(1 - this.sonar.cooldown / this.sonar.cooldownTime);
    this.updateWorld(dt);
    this.checkPickups();
    this.updateCamera(dt);

    this.save.playTime += deltaMs / 1000;
    this.saveTimer += dt;
    if (this.saveTimer > 8 && !this.busy) {
      this.saveTimer = 0;
      this.persist();
    }
  }

  private onSwimEvents(ev: ReturnType<RosaPlayer['update']>, dt: number): void {
    const r = this.rosa;
    const c = r.ctrl;
    if (ev.boosted) {
      const t = r.tail();
      this.particles.bubble(t.x, t.y, 14);
      AudioManager.boost();
      const ring = this.add.image(t.x, t.y, 'ring').setTint(0xcff6ff).setBlendMode(ADD).setDepth(DEPTH.FX).setScale(0.6).setAlpha(0.8);
      this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
    }
    if (ev.leftWater) {
      this.particles.splash(c.x, 0, false);
      AudioManager.splash(false);
    }
    if (ev.enteredWater) {
      const big = Math.abs(c.vy) > 300;
      this.particles.splash(c.x, 0, big);
      AudioManager.splash(big);
      if (big) this.cameras.main.shake(180, 0.003);
    }
    // bubble trail
    this.bubbleTimer -= dt;
    if (!c.airborne && this.bubbleTimer <= 0) {
      if (c.speed01 > 0.5) {
        const t = r.tail();
        this.particles.bubble(t.x, t.y, 1 + Math.floor(c.speed01 * 2));
        this.bubbleTimer = 0.07;
      } else {
        const m = r.localToWorld(30, -40);
        this.particles.bubble(m.x, m.y, 1);
        this.bubbleTimer = 1.8 + Math.random() * 1.5;
      }
    }
  }

  private updateWorld(dt: number): void {
    const cam = this.cameras.main;
    this.builder.update(dt, cam);
    this.particles.update(cam);
    const rosaInfo = { x: this.rosa.x, y: this.rosa.y, facing: this.rosa.ctrl.facing };
    this.lumi.update(dt, rosaInfo);
    this.marea.update(dt);
    if (this.brunoFollowing) this.bruno.followTarget = this.rosa;
    this.bruno.update(dt);
    for (const s of this.schools) s.update(dt, this.rosa.x, this.rosa.y);
    for (const j of this.jellies) j.update(dt);
    this.manta.update(dt);
    this.turtleQueue.update(dt, cam.worldView);
    this.locals.update(dt);
    this.germans?.update(dt);

    // hidden things shimmer when Rosa is close
    this.hintTime += dt;
    for (const n of this.notes) {
      const d = dist(n.x, n.y, this.rosa.x, this.rosa.y);
      n.update(dt, Phaser.Math.Clamp(1 - d / 520, 0, 1));
    }
    for (const f of this.fragments) {
      const d = dist(f.x, f.y, this.rosa.x, this.rosa.y);
      f.update(dt, Phaser.Math.Clamp(1 - d / 520, 0, 1));
    }

    // Bruno reaches his grandmother
    if (this.brunoFollowing && !this.busy && dist(this.bruno.x, this.bruno.y, this.marea.x, this.marea.y) < 280) {
      void this.brunoHome();
    }
  }

  private updateCamera(dt: number): void {
    if (this.cinematic) return;
    const c = this.rosa.ctrl;
    let tx = this.rosa.x + c.vx * 0.32;
    let ty = this.rosa.y + c.vy * 0.22;
    if (this.activePuzzle) {
      const src = this.activePuzzle.cfg;
      // keep Rosa above the note panel while showing where the melody comes from
      tx = (this.rosa.x + src.sourceX) / 2;
      ty = Math.max((this.rosa.y + src.sourceY) / 2, this.rosa.y - 120) + 140;
    }
    const k = damp(3.2, dt);
    this.camFocus.x += (tx - this.camFocus.x) * k;
    this.camFocus.y += (ty - this.camFocus.y) * k;
  }

  /** Floating "E" key-caps above interactive things: inviting when near, full when in range. */
  private updateMarkers(dt: number, active: Interactable | null, hideAll = false): void {
    for (const it of this.interactables) {
      const m = this.markers.get(it.id);
      if (!m) continue;
      const p = it.pos();
      let state: 'hidden' | 'near' | 'active' = 'hidden';
      if (!hideAll && it.enabled()) {
        if (it === active) state = 'active';
        else if (it.invite && dist(p.x, p.y, this.rosa.x, this.rosa.y) < it.radius * 2.6) state = 'near';
      }
      let my = p.y + it.markerY;
      // never sit on top of Rosa: float above her when she is right there
      if (Math.abs(p.x - this.rosa.x) < 160) my = Math.min(my, this.rosa.y - 150);
      m.set(state, p.x, my, it.label().replace(/^E\s*—\s*/, ''), dt);
      const icon = this.icons.get(it.id);
      if (icon) {
        const kind = it.enabled() && this.save.flags.introDone ? it.icon?.() ?? null : null;
        icon.set(kind, p.x, p.y + it.markerY - 85, hideAll || state === 'active', dt);
      }
    }
  }

  private nearestInteractable(): Interactable | null {
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of this.interactables) {
      if (!it.enabled()) continue;
      const p = it.pos();
      const d = dist(p.x, p.y, this.rosa.x, this.rosa.y);
      if (d < it.radius && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    return best;
  }

  // =========================================================== pickups

  private checkPickups(): void {
    if (this.busy) return;
    const rx = this.rosa.x;
    const ry = this.rosa.y;
    for (const n of this.notes) {
      if (n.collected || !n.revealed) continue;
      if (dist(n.x, n.y, rx, ry) < 95) this.collectNote(n);
    }
    for (const f of this.fragments) {
      if (!f.collectable) continue;
      if (dist(f.container.x, f.container.y, rx, ry) < 110) this.collectFragment(f);
    }
  }

  private collectNote(n: MusicalNote): void {
    n.collect();
    if (!this.save.notes.includes(n.note)) this.save.notes.push(n.note);
    AudioManager.collectNote(n.note);
    AudioManager.setNotePool(this.save.notes);
    this.particles.note(n.x, n.y, n.note, 26);
    this.particles.sparkles(n.x, n.y, 8);
    const sp = this.toScreen(n.x, n.y);
    this.ui.flyToNote(sp.x, sp.y, n.note, () => this.ui.setNotes(this.save.notes, n.note));
    const idx = NOTE_ORDER.indexOf(n.note) + 1;
    this.ui.toast(`Nueva nota: ${n.note}`, `Pulsa ${idx} para tocarla`, NOTE_INFO[n.note].css);
    this.persist();
  }

  private collectFragment(f: MelodyFragment): void {
    f.collect();
    this.save.fragments.push(f.spot.id);
    this.save.fragmentOrder.push(f.spot.id);
    const count = this.save.fragments.length;
    const x = f.container.x;
    const y = f.container.y;
    AudioManager.fragment(f.note);
    AudioManager.setLayerCount(count);
    this.particles.sparkles(x, y, 40);
    this.particles.note(x, y, f.note, 30);
    this.cameras.main.flash(260, 255, 236, 190, false);
    this.cameras.main.shake(200, 0.002);
    const sp = this.toScreen(x, y);
    this.ui.flyToSlot(sp.x, sp.y, f.spot.slot, f.note, () => this.ui.setFragments(this.slots(), f.spot.slot));
    this.ui.toast(`Fragmento ${count} de 7`, `La música crece: ${LAYER_NAMES[count - 1]}`, GOLD_CSS);
    this.updateObjective();
    this.persist();
    if (count >= 7) this.time.delayedCall(2600, () => void this.onAllFragments());
  }

  private playFreeNote(note: NoteName): void {
    if (!this.known().includes(note)) {
      if (this.time.now - this.lastMissingToast > 2500) {
        this.lastMissingToast = this.time.now;
        this.ui.toast(`Aún no conoces la nota ${note}`, 'Las notas brillan por toda la Rotonda', '#cfe6ff');
      }
      return;
    }
    AudioManager.playNote(note);
    const m = this.rosa.mouth();
    this.particles.singNote(m.x, m.y, note);
  }

  // =========================================================== puzzles

  private async startPuzzle(p: MusicPuzzle): Promise<void> {
    if (this.activePuzzle || p.solved) return;
    this.activePuzzle = p;
    this.ui.showPuzzle(p.cfg.label, p.sequence.length, this.known());
    await this.listenPuzzle(p);
  }

  private async listenPuzzle(p: MusicPuzzle): Promise<void> {
    if (this.activePuzzle !== p) return;
    this.puzzleBusy = true;
    this.ui.puzzleClearSlots();
    this.ui.puzzleState('Escucha…', '#9fe8ff');
    await p.playDemo((i, n) => {
      if (this.activePuzzle !== p) return;
      this.ui.puzzleSlot(i, n, 'listen');
      if (p.id === 'final') this.ui.pulseSlot(i);
    });
    if (this.activePuzzle !== p) return;
    await wait(this, 350);
    if (this.activePuzzle !== p) return;
    this.ui.puzzleClearSlots();
    this.puzzleBusy = false;
    const missing = p.sequence.missing(this.known());
    if (missing.length) {
      this.ui.puzzleState(`Te faltan notas: ${missing.join(' · ')}. Búscalas por la Rotonda.`, '#ffc7a8');
    } else {
      this.ui.puzzleState(isTouchDevice() ? 'Tu turno: toca las notas de la melodía' : 'Tu turno: toca la melodía (1-7)', '#ffffff');
    }
  }

  private onNoteInput(note: NoteName): void {
    const p = this.activePuzzle;
    if (!p || !this.ready || this.busy || this.ui.dialogueActive) return;
    if (!this.known().includes(note)) {
      this.ui.toast(`Aún no conoces la nota ${note}`, undefined, '#cfe6ff');
      return;
    }
    AudioManager.playNote(note);
    const m = this.rosa.mouth();
    this.particles.singNote(m.x, m.y, note);
    this.ui.puzzleKeyFlash(note, this.known());
    if (this.puzzleBusy) return;
    const idx = p.sequence.progress;
    const r = p.input(note);
    if (r === 'wrong') {
      this.time.delayedCall(260, () => AudioManager.wrong());
      this.ui.puzzleWrong();
      this.ui.puzzleClearSlots();
      this.ui.puzzleState('Casi… vuelve a intentarlo (E para escuchar otra vez)', '#ffd9a0');
      return;
    }
    this.ui.puzzleSlot(idx, note, 'ok');
    if (r === 'complete') void this.solvePuzzle(p);
  }

  private async solvePuzzle(p: MusicPuzzle): Promise<void> {
    this.puzzleBusy = true;
    p.solved = true;
    if (!this.save.puzzles.includes(p.id)) this.save.puzzles.push(p.id);
    this.persist();
    this.ui.puzzleState('¡Precioso!', GOLD_CSS);
    if (p.id !== 'final') AudioManager.success();
    await wait(this, 1000);
    this.ui.hidePuzzle();
    this.activePuzzle = null;
    this.puzzleBusy = false;
    if (p.id === 'gate') await this.solveGate();
    else if (p.id === 'organ') await this.solveOrgan();
    else if (p.id === 'final') await this.runFinale();
  }

  /** Called by the UI when ESC is pressed. Returns true if consumed. */
  handleEscape(): boolean {
    if (this.activePuzzle && !this.busy) {
      const p = this.activePuzzle;
      if (p.solved) return true;
      p.cancelDemo();
      this.activePuzzle = null;
      this.puzzleBusy = false;
      this.ui.hidePuzzle();
      if (p.id === 'final') AudioManager.setLayerCount(this.save.fragmentOrder.length);
      return true;
    }
    return this.busy;
  }

  goToMenu(): void {
    this.persist();
    this.ready = false;
    this.cameras.main.fadeOut(700, 2, 10, 26);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('UIScene');
      this.scene.start('MenuScene');
    });
  }

  // =========================================================== world reactions

  private openClam(instant = false): void {
    if (this.clamOpen) return;
    this.clamOpen = true;
    this.save.flags.clamOpen = true;
    const top = this.builder.clamTop;
    const pearl = this.builder.clamPearl;
    const frag = this.fragments.find((f) => f.spot.spawnsOn === 'clam-open');
    if (instant) {
      top.setRotation(-1.1);
      pearl.setAlpha(1);
      frag?.spawn();
      return;
    }
    this.persist();
    AudioManager.rumble(1.2);
    this.tweens.add({ targets: top, rotation: -1.1, duration: 1400, ease: 'Back.easeOut' });
    this.tweens.add({ targets: pearl, alpha: 1, duration: 800, delay: 600 });
    this.particles.bubble(CLAM.x, CLAM.y - 40, 20);
    this.time.delayedCall(900, () => {
      this.particles.sparkles(CLAM.x, CLAM.y - 40, 24);
      frag?.spawn(CLAM.x, CLAM.y - 20);
      void this.gratitude.thank('clam').then(() => this.ui.setGratitudeCount(this.gratitude.count, true));
    });
  }

  private async startGatePuzzle(): Promise<void> {
    if (!this.save.flags.gateIntro) {
      this.busy = true;
      await this.ui.say([
        { who: 'Familia Delfín', text: '¡Presidenta! No encontramos cueva donde vivir. Las pocas que hay están cerradas o carísimas.' },
        { who: 'Familia Delfín', text: 'Esa gruta lleva años cerrada detrás de la Puerta de Coral…' },
        { who: 'Rosa', text: '¡Tengo la solución! Una melodía, y la gruta será vuestra. Bueno… de alguien.' },
      ]);
      this.save.flags.gateIntro = true;
      this.busy = false;
    }
    await this.startPuzzle(this.puzzles.gate);
  }

  private async startOrganPuzzle(): Promise<void> {
    if (!this.save.flags.organIntro) {
      this.busy = true;
      await this.ui.say([
        { who: 'Lumi', text: 'Presidenta, el emisario de la Torre lleva meses vertiendo aguas residuales al mar. Los vecinos están hartos.' },
        { who: 'Rosa', text: 'Con esta bomba antigua y mi melodía, lo arreglo en un periquete. ¡Que vayan preparando la inauguración!' },
      ]);
      this.save.flags.organIntro = true;
      this.busy = false;
    }
    await this.startPuzzle(this.puzzles.organ);
  }

  private async solveGate(): Promise<void> {
    this.busy = true;
    await this.cinematicTo(GROTTO.gate.x + 250, 2250, 900);
    this.openGate(false);
    await wait(this, 1800);
    // …and a whole pod of German dolphins moves in
    this.germans = new DolphinPod(this, 'dolphin_de', this.grottoHomes(), { x: 4700, y: 1500 });
    this.germans.arrive({ x: GROTTO.gate.x + 60, y: 2400 });
    this.locals.shift(-260, 40);
    await wait(this, 5200);
    this.showGrottoFull();
    await this.ui.say([{ who: 'Rosa', text: '¡Problema de vivienda resuelto! Qué bien se me da esto.' }]);
    await this.gratitude.thank('gate');
    this.ui.setGratitudeCount(this.gratitude.count, true);
    await this.gratitude.showReality('gate');
    await this.ui.say([{ who: 'Familia Delfín', text: '¿Y nosotros…?' }]);
    this.endCinematic();
    this.busy = false;
  }

  private showGrottoFull(): void {
    const sign = this.add.text(GROTTO.gate.x + 330, GROTTO.ceiling.y + GROTTO.ceiling.h + 40, 'COMPLETO', {
      fontFamily: '"Trebuchet MS", Arial, sans-serif', fontSize: '34px', color: '#ffffff', backgroundColor: '#c0392b', padding: { x: 16, y: 8 },
    }).setOrigin(0.5, 0).setDepth(DEPTH.FLOOR + 3).setRotation(-0.06);
    this.tweens.add({ targets: sign, scale: { from: 0, to: 1 }, duration: 500, ease: 'Back.easeOut' });
  }

  private openGate(instant: boolean): void {
    this.gateOpen = true;
    const b = this.builder;
    if (instant) {
      b.gateCorals.forEach((c, i) => c.setPosition(c.x + (i % 2 ? 170 : -170), c.y + 60).setScale(0.55).clearTint());
      b.grottoLight.setAlpha(0.5);
      b.bloomInstant('gate');
      this.germans = new DolphinPod(this, 'dolphin_de', this.grottoHomes());
      this.locals.shift(-260, 40);
      this.showGrottoFull();
      return;
    }
    AudioManager.rumble(2);
    this.cameras.main.shake(900, 0.004);
    b.gateCorals.forEach((c, i) => {
      this.tweens.add({ targets: c, x: c.x + (i % 2 ? 170 : -170), y: c.y + 60, scale: 0.55, rotation: (i % 2 ? 0.5 : -0.5), duration: 1600, delay: i * 90, ease: 'Cubic.easeInOut' });
      this.tweens.addCounter({ from: 0, to: 1, duration: 1200, delay: i * 90, onUpdate: (tw) => {
        const v = tw.getValue() ?? 1;
        const col = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0x5d6f86), Phaser.Display.Color.ValueToColor(0xffffff), 1, v);
        c.setTint(Phaser.Display.Color.GetColor(col.r, col.g, col.b));
      } });
      this.time.delayedCall(i * 90, () => this.particles.bubble(c.x, c.y - 40, 6));
    });
    this.tweens.add({ targets: b.grottoLight, alpha: 0.5, duration: 2000, delay: 600 });
    this.time.delayedCall(700, () => b.bloom('gate', GROTTO.gate.x, 2400, 2000));
  }

  private async solveOrgan(): Promise<void> {
    this.busy = true;
    await this.cinematicTo(TOWER.x0 - 60, 820, 900);
    this.reverseCurrent(false);
    this.moreSewage(false);
    this.cameras.main.pan(5900, 1450, 1600, 'Sine.easeInOut');
    await wait(this, 3200);
    await this.ui.say([{ who: 'Rosa', text: '¡Maravilloso trabajo! Otro problema resuelto. Apuntadlo para la campaña.' }]);
    await this.gratitude.thank('organ');
    this.ui.setGratitudeCount(this.gratitude.count, true);
    await this.gratitude.showReality('organ');
    this.endCinematic();
    this.busy = false;
  }

  private reverseCurrent(instant: boolean): void {
    this.currentUp = true;
    const b = this.builder;
    b.reverseCurrent();
    b.lamps.filter((l) => l.group === 'platform').forEach((l, i) => {
      if (instant) b.lightLamp(l, true);
      else this.time.delayedCall(i * 350, () => { b.lightLamp(l); AudioManager.playNote(PUZZLES.organ[i % 4], { inst: 'chime', octave: 6, vel: 0.3 }); });
    });
    b.organGlows.forEach((g, i) => {
      if (instant) g.setAlpha(0.7);
      else this.tweens.add({ targets: g, alpha: 0.75, scale: { from: 0.8, to: 0.35 }, delay: i * 120, duration: 700 });
    });
    this.jellies.forEach((j, i) => (instant ? j.lightUp(this) : this.time.delayedCall(800 + i * 250, () => j.lightUp(this))));
    if (!instant) {
      AudioManager.rumble(1.5);
      this.cameras.main.shake(600, 0.003);
      this.particles.bubble(ORGAN.x, ORGAN.y - 200, 30);
    }
  }

  private awakenStatue(instant: boolean): void {
    this.statueAwake = true;
    const b = this.builder;
    if (instant) {
      b.staffBeam.setAlpha(0.45);
      b.statueGlow.setAlpha(0.25);
      return;
    }
    this.tweens.add({ targets: b.staffBeam, alpha: 0.45, duration: 2400 });
    this.tweens.add({ targets: b.staffBeam, scaleX: 0.6, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: b.statueGlow, alpha: 0.25, duration: 2400 });
  }

  private async onAllFragments(): Promise<void> {
    if (this.statueAwake) return;
    this.awakenStatue(false);
    this.updateObjective();
    while (this.busy || this.ui.dialogueActive || this.activePuzzle) await wait(this, 300);
    await this.ui.say([
      { who: 'Lumi', text: '¡Los siete fragmentos, presidenta! Algo vibra en el centro de la Rotonda.' },
      { who: 'Lumi', text: 'El bastón de la estatua brilla. Si toca allí la melodía, podrá inaugurar la Rotonda… y acabar con las colas.' },
      { who: 'Rosa', text: '¡Una inauguración! Que vengan todos. Y que traigan muchas ganas de dar las gracias.' },
    ]);
  }

  private interactStatue(): void {
    if (!this.statueAwake) {
      void this.ui.say([
        { who: 'Rosa', text: 'La estatua guarda silencio… Ni siquiera me ha dado las gracias por venir.' },
        { who: 'Lumi', text: `Cuando reúna los siete fragmentos, ella sabrá escucharla. Lleva ${this.save.fragments.length} de 7.` },
      ]);
      return;
    }
    void this.beginFinalPuzzle();
  }

  private async beginFinalPuzzle(): Promise<void> {
    this.busy = true;
    this.lumi.anchor = { x: this.rosa.x - 170, y: this.rosa.y - 80 };
    if (!this.save.flags.finalIntro) {
      await this.ui.say([
        { who: 'Lumi', text: '¡La estatua está escuchando! Toda la Rotonda está pendiente de usted, presidenta.' },
        { who: 'Rosa', text: 'Mi melodía perfecta. Cada fragmento, una nota: SOL, LA, SOL, MI, FA, RE, DO. ¡Que suene a victoria!' },
      ]);
      this.save.flags.finalIntro = true;
    }
    this.lumi.anchor = null;
    AudioManager.setLayerCount(0, 2);
    this.busy = false;
    await this.startPuzzle(this.puzzles.final);
  }

  // =========================================================== creatures & missions

  private async runIntro(): Promise<void> {
    this.busy = true;
    this.lumi.anchor = { x: this.rosa.x + 220, y: this.rosa.y - 40 };
    await wait(this, 1800);
    await this.ui.say([
      { who: 'Lumi', text: '¡Presidenta Rosa! Por fin la encuentro. Faltan muy poquitas semanas para las elecciones.' },
      { who: 'Rosa', text: 'Lo sé, Lumi. Y todavía no tengo mi melodía perfecta.' },
      { who: 'Lumi', text: 'Sin melodía no hay inauguraciones… y sin inauguraciones, nadie le da las gracias.' },
      { who: 'Rosa', text: '¿Nadie? ¿Ni un «gracias, Rosa»? Eso no puede ser. Me encanta que me den las gracias.' },
      { who: 'Lumi', text: 'En la Rotonda Sumergida hay una melodía rota en siete fragmentos. Y muchos problemas: colas de tortugas, aguas residuales, delfines sin cueva…' },
      { who: 'Rosa', text: 'Perfecto. Lo arreglaré todo… o por lo menos haré que lo parezca. ¡A por esos fragmentos!' },
      { who: 'Lumi', text: 'Use el sonar (Q) para encontrar lo escondido y toque las notas con 1-7. ¡Mire, allí al este brilla algo! Y esa nota roja es un DO.' },
    ]);
    this.save.flags.introDone = true;
    this.lumi.anchor = null;
    this.lumi.following = true;
    this.updateObjective();
    this.persist();
    this.busy = false;
    this.ui.showControlsHint();
  }

  private lumiHint(): string {
    const s = this.save;
    const has = (id: string) => s.fragments.includes(id);
    if (s.completed) return '¡Qué inauguración, presidenta! Las colas siguen igual, pero… ¡cuántas gracias!';
    if (s.fragments.length >= 7) return '¡A la estatua del centro! Allí se inaugura la Rotonda. Acérquese y pulse E.';
    if (!has('f-claro')) return 'El primer fragmento brillaba al este de aquí, en aguas abiertas. ¡Síguelo!';
    if (!s.notes.includes('MI') && s.notes.length >= 2) return 'Entre las algas del oeste, cerca del fondo, algo zumba en MI… pero no se ve. ¡Prueba el sonar!';
    if (!has('f-rampa')) return 'Bajo la gran rampa del oeste, junto al fondo, hay un brillo escondido. El sonar lo revela.';
    if (!this.clamOpen) return 'La Almeja Gigante duerme en el fondo, antes del jardín. Dicen que un buen sonar la despierta.';
    if (!this.gratitude.isDone('bruno')) {
      return s.flags.metMarea
        ? 'Bruno es pequeño y curioso. A los pequeños les encanta esconderse entre las algas doradas de la superficie, al oeste.'
        : 'Hay una tortuga muy preocupada junto al jardín de la estatua. Una votante, presidenta: hable con ella.';
    }
    if (!this.puzzles.gate.solved) return 'Al este, en el fondo, una familia busca casa junto a la Puerta de Coral. La caracola (E) recuerda una melodía.';
    if (!this.puzzles.organ.solved) return 'Arriba al este, junto a la Torre, está la vieja bomba del emisario de aguas residuales. ¡Necesitará LA y SI!';
    if (!has('f-ola')) return 'Una vez vi un destello saltar por encima de las olas, justo sobre la Rotonda. ¡Coge carrerilla hacia arriba y pulsa ESPACIO!';
    if (!has('f-torre')) return 'La corriente de la Torre ya sube. ¡Déjate llevar hasta arriba!';
    return 'Sigue explorando: los fragmentos brillan en dorado.';
  }

  private async talkLumi(): Promise<void> {
    this.busy = true;
    this.lumi.hop(this);
    await this.ui.say([{ who: 'Lumi', text: this.lumiHint() }]);
    this.busy = false;
  }

  private async talkMarea(): Promise<void> {
    this.busy = true;
    if (!this.save.flags.metMarea) {
      await this.ui.say([
        { who: 'Doña Marea', text: 'Ay, querida… ¿no habrás visto a mi nieto Bruno? Es así de pequeñito, con el caparazón dorado.' },
        { who: 'Doña Marea', text: 'Llevábamos dos horas en la cola de la rotonda y se escapó nadando hacia la superficie, al oeste. ¡No ha vuelto!' },
        { who: 'Rosa', text: 'No se preocupe, Doña Marea. Yo lo traeré. Y recuerde quién se lo trajo cuando vaya a votar.' },
      ]);
      this.save.flags.metMarea = true;
      this.persist();
      this.ui.toast('Nueva petición', 'Encuentra a Bruno y tráelo con Doña Marea', '#a9e38f');
    } else {
      await this.ui.say([{ who: 'Doña Marea', text: 'Bruno siempre se escondía entre las algas doradas que flotan arriba, al oeste…' }]);
    }
    this.busy = false;
  }

  private async talkBruno(): Promise<void> {
    this.busy = true;
    await this.ui.say(
      this.save.flags.metMarea
        ? [
            { who: 'Bruno', text: '¿M-mi abuela te ha enviado? ¡Pensé que estaría enfadada!' },
            { who: 'Rosa', text: 'Está preocupada por ti. Sígueme, te llevo con ella.' },
          ]
        : [
            { who: 'Bruno', text: 'Hola… me he perdido. Mi abuela Marea vive junto al jardín de la estatua.' },
            { who: 'Rosa', text: '¡Yo te acompaño! Quédate cerca de mí.' },
          ],
    );
    this.brunoFollowing = true;
    this.bruno.mode = 'follow';
    this.bruno.followTarget = this.rosa;
    this.ui.toast('Bruno te sigue', 'Llévalo con Doña Marea, junto al jardín central', '#d9e98a');
    this.busy = false;
  }

  private async brunoHome(): Promise<void> {
    this.busy = true;
    this.brunoFollowing = false;
    this.bruno.mode = 'goto';
    this.bruno.tx = this.marea.x + 120;
    this.bruno.ty = this.marea.y - 30;
    await wait(this, 900);
    await this.ui.say([
      { who: 'Doña Marea', text: '¡Bruno! ¡Mi pequeño! ¿Dónde te habías metido?' },
      { who: 'Bruno', text: 'Rosa me encontró, abuela. ¡Nada rapidísimo!' },
    ]);
    this.reuniteTurtles(false);
    this.particles.heart(this.marea.x, this.marea.y - 60, 10);
    await this.gratitude.thank('bruno');
    this.ui.setGratitudeCount(this.gratitude.count, true);
    const frag = this.fragments.find((f) => f.spot.spawnsOn === 'mission:bruno');
    frag?.spawn(this.marea.x, this.marea.y - 40);
    this.persist();
    this.busy = false;
  }

  private reuniteTurtles(instant: boolean): void {
    this.bruno.home = { x: MAREA_HOME.x + 90, y: MAREA_HOME.y - 40 };
    this.bruno.mode = 'wander';
    this.brunoFollowing = false;
    if (instant) {
      this.bruno.x = this.bruno.home.x;
      this.bruno.y = this.bruno.home.y;
    }
  }

  // =========================================================== cinematics

  private async cinematicTo(x: number, y: number, ms: number, zoom?: number): Promise<void> {
    this.cinematic = true;
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan(x, y, ms, 'Sine.easeInOut');
    if (zoom) cam.zoomTo(zoom, ms, 'Sine.easeInOut');
    await wait(this, ms);
  }

  private endCinematic(): void {
    const cam = this.cameras.main;
    this.camFocus.x = cam.worldView.centerX;
    this.camFocus.y = cam.worldView.centerY;
    cam.zoomTo(1, 800, 'Sine.easeInOut');
    cam.startFollow(this.camFocus, false, 0.09, 0.09);
    this.cinematic = false;
  }

  private restoreRotonda(instant: boolean): void {
    const b = this.builder;
    b.lamps.forEach((l) => b.lightLamp(l, instant));
    b.bloomInstant('rotonda');
    b.bloomInstant('gate');
    b.bloomFlowers(true);
    b.warmth = 1;
    b.staffBeam.setAlpha(0.6);
    b.statueGlow.setAlpha(0.3);
    this.finaleDone = true;
    this.spawnFinaleSchools();
    AudioManager.setFullMode(true);
  }

  private spawnFinaleSchools(): void {
    const R = Phaser.Geom.Rectangle;
    const defs: [string, number, number, number][] = [['fish_0', 0, 1.0, 0.35], ['fish_1', 1, 1.1, -0.3], ['fish_2', 2, 0.9, 0.25], ['fish_3', 3, 1, -0.4], ['fish_0', 4, 0.8, 0.3]];
    for (const [key, i, sc, speed] of defs) {
      const startX = i % 2 ? WORLD.w + 200 : -200;
      const s = new FishSchool(this, new R(RING.cx - 1000, RING.cy - 300, 2000, 900), 10, key, sc, startX, RING.cy + (i - 2) * 160);
      s.orbit = { x: RING.cx, y: RING.cy + 40 + i * 50, rx: RING.rx - 100 - i * 120, ry: RING.ry + 80 + i * 40, speed };
      this.schools.push(s);
    }
  }

  private async runFinale(): Promise<void> {
    this.busy = true;
    this.finaleDone = true;
    this.ui.setPrompt(null);
    this.ui.setHudVisible(false, 1200);
    const cam = this.cameras.main;
    const rx = this.rosa.x;
    const ry = this.rosa.y;

    // 1. the notes of the melody appear around Rosa
    const orbiters = FINAL_MELODY.map((n, i) => {
      const c = NOTE_INFO[n].color;
      const glow = this.add.image(rx, ry, 'glow').setTint(c).setBlendMode(ADD).setScale(0.5).setDepth(DEPTH.FX).setAlpha(0);
      const g = this.add.image(rx, ry, 'glyph').setTint(c).setScale(0.55).setDepth(DEPTH.FX).setAlpha(0);
      return { g, glow, n, i, a: (i / 7) * Math.PI * 2 };
    });
    let orbitT = 0;
    let phase: 'orbit' | 'travel' | 'done' = 'orbit';
    const orbitUpdate = (_t: number, d: number) => {
      if (phase !== 'orbit') return;
      orbitT += d / 1000;
      const r = Math.min(170, orbitT * 260);
      for (const o of orbiters) {
        const a = o.a + orbitT * 1.6;
        o.g.setPosition(this.rosa.x + Math.cos(a) * r, this.rosa.y + Math.sin(a) * r * 0.8);
        o.glow.setPosition(o.g.x, o.g.y);
      }
    };
    this.events.on('update', orbitUpdate);
    for (const o of orbiters) {
      this.tweens.add({ targets: [o.g, o.glow], alpha: 1, duration: 300 });
      AudioManager.playNote(o.n, { inst: 'bell', vel: 0.45 });
      this.particles.note(this.rosa.x, this.rosa.y, o.n, 8);
      await wait(this, 220);
    }
    await wait(this, 900);

    // 2. they travel around the whole rotonda while the camera reveals it
    this.cinematic = true;
    cam.stopFollow();
    cam.pan(RING.cx, RING.cy + 260, 2600, 'Sine.easeInOut');
    cam.zoomTo(0.5, 2800, 'Sine.easeInOut');
    phase = 'travel';
    this.events.off('update', orbitUpdate);
    const b = this.builder;
    const ringLamps = b.lamps.filter((l) => l.group !== 'platform');
    const startA = Math.atan2((this.rosa.y - RING.cy) / RING.ry, (this.rosa.x - RING.cx) / RING.rx);
    const travelMs = 6200;
    orbiters.forEach((o) => {
      const sx = o.g.x;
      const sy = o.g.y;
      let trail = 0;
      this.tweens.addCounter({
        from: 0, to: 1, duration: travelMs, delay: o.i * 230, ease: 'Sine.easeInOut',
        onUpdate: (tw) => {
          const k = tw.getValue() ?? 0;
          // each note ends at its own place on the ring before rising to the staff
          const a = startA + k * (Math.PI * 2 + (o.i / 7) * Math.PI * 2);
          const ex = RING.cx + Math.cos(a) * (RING.rx - 40);
          const ey = RING.cy + Math.sin(a) * (RING.ry - 10) - 70 - o.i * 6;
          const blend = Math.min(1, k * 6);
          o.g.setPosition(sx + (ex - sx) * blend, sy + (ey - sy) * blend);
          o.glow.setPosition(o.g.x, o.g.y);
          o.g.setScale(0.55 + blend * 0.5);
          o.glow.setScale(0.5 + blend * 0.9);
          trail++;
          if (trail % 3 === 0) this.particles.note(o.g.x, o.g.y, o.n, 2);
          if (o.i === 0) {
            for (const l of ringLamps) {
              if (l.on) continue;
              const la = l.angle ?? Math.atan2((l.y - RING.cy) / RING.ry, (l.x - RING.cx) / RING.rx);
              let diff = Math.abs(Phaser.Math.Angle.Wrap(la - a));
              if (l.group === 'ramp') diff = Math.abs(Phaser.Math.Angle.Wrap(Math.PI - a)) + 0.1;
              if (diff < 0.18) {
                b.lightLamp(l);
                AudioManager.playNote(FINAL_MELODY[ringLamps.indexOf(l) % 7], { inst: 'chime', octave: 6, vel: 0.25 });
              }
            }
          }
        },
      });
    });
    // 3-6. layers, fish, corals, flowers, statue — all join the composition
    for (let i = 1; i <= 7; i++) this.time.delayedCall(i * 750, () => AudioManager.setLayerCount(i, 1.5));
    this.time.delayedCall(1400, () => this.spawnFinaleSchools());
    this.time.delayedCall(2200, () => b.bloom('rotonda', STATUE.x, STATUE.baseY, 4200));
    this.time.delayedCall(2600, () => b.bloom('gate', STATUE.x, STATUE.baseY, 2000));
    this.time.delayedCall(3200, () => b.bloomFlowers());
    this.time.delayedCall(3000, () => {
      this.tweens.add({ targets: b.statueGlow, alpha: 0.5, duration: 2500 });
      this.tweens.add({ targets: b.staffBeam, alpha: 0.85, scaleX: 1, duration: 2500 });
      this.tweens.addCounter({ from: 0, to: 1, duration: 4000, onUpdate: (tw) => (b.warmth = tw.getValue() ?? 1) });
    });
    this.manta.approach = { x: RING.cx + 500, y: RING.cy - 300 };
    this.time.delayedCall(6200, () => {
      AudioManager.setFullMode(true);
      b.lamps.forEach((l) => b.lightLamp(l));
    });
    await wait(this, travelMs + 7 * 230 + 400);

    orbiters.forEach((o) => {
      this.tweens.add({ targets: [o.g, o.glow], x: b.staffBeam.x, y: b.staffBeam.y, scale: 0.2, alpha: 0, duration: 1400, delay: o.i * 90, ease: 'Cubic.easeIn' });
    });
    this.time.delayedCall(1500, () => {
      this.particles.sparkles(b.staffBeam.x, b.staffBeam.y, 60);
      cam.flash(600, 255, 236, 190);
    });
    await wait(this, 3600);
    orbiters.forEach((o) => { o.g.destroy(); o.glow.destroy(); });
    phase = 'done';

    // 7. a moment of silence… everyone comes closer
    AudioManager.duck(0.0001, 2.4);
    cam.pan(this.rosa.x, this.rosa.y - 60, 2200, 'Sine.easeInOut');
    cam.zoomTo(0.85, 2200, 'Sine.easeInOut');
    this.lumi.anchor = { x: this.rosa.x - 190, y: this.rosa.y - 90 };
    this.marea.mode = 'goto';
    this.marea.tx = this.rosa.x + 240;
    this.marea.ty = this.rosa.y + 70;
    this.bruno.mode = 'goto';
    this.bruno.tx = this.rosa.x + 200;
    this.bruno.ty = this.rosa.y - 70;
    this.manta.approach = { x: this.rosa.x, y: this.rosa.y - 330 };
    this.schools.forEach((s, i) => {
      s.orbit = { x: this.rosa.x, y: this.rosa.y - 20, rx: 330 + (i % 4) * 70, ry: 170 + (i % 3) * 40, speed: (i % 2 ? 0.5 : -0.45) };
    });
    this.jellies.forEach((j, i) => { j.x = this.rosa.x - 420 + i * 210; j.y = this.rosa.y - 330 + (i - 2) * (i - 2) * 28; });
    await wait(this, 3400);

    // 8. ¡GRACIAS, ROSA THE DOLPHIN!
    AudioManager.duck(1, 1.2);
    this.particles.heart(this.rosa.x, this.rosa.y - 80, 14);
    await this.gratitude.thank('rotonda');
    this.ui.setGratitudeCount(this.gratitude.count, true);
    await this.ui.say([{ who: 'Rosa', text: '¡De nada, de nada! ¡Colas resueltas! Con esta melodía, las elecciones están ganadas.' }]);
    // meanwhile, at the queue…
    const q = this.turtleQueue.focus;
    cam.pan(q.x, q.y - 40, 1800, 'Sine.easeInOut');
    cam.zoomTo(0.8, 1800, 'Sine.easeInOut');
    await wait(this, 1900);
    this.turtleQueue.complainNear(q.x, q.y, '¿Ya está? Pues seguimos igual…');
    await this.gratitude.showReality('rotonda');
    cam.pan(this.rosa.x, this.rosa.y - 60, 1500, 'Sine.easeInOut');
    await wait(this, 1500);
    await this.ui.say([
      { who: 'Lumi', text: 'Presidenta… las tortugas siguen sin moverse.' },
      { who: 'Rosa', text: 'Detalles, Lumi. ¿Has oído cómo me han dado las gracias? ¡Gracias, Rosa the Dolphin! Qué bien suena.' },
    ]);
    this.save.completed = true;
    this.persist();
    // only Bruno's reunion and the clam were really fixed
    const solved = ['clam', 'bruno'].filter((id) => this.gratitude.isDone(id)).length;
    const stats = { time: this.save.playTime, thanks: this.gratitude.count, notes: this.save.notes.length, solved };
    cam.fadeOut(1800, 2, 10, 26);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('UIScene');
      this.scene.start('EndingScene', stats);
    });
  }

  // =========================================================== debug / QA

  private exposeDebug(): void {
    const w = window as unknown as { __ROSA__?: Record<string, unknown> };
    w.__ROSA__ = {
      ...(w.__ROSA__ ?? {}),
      scene: this,
      teleport: (x: number, y: number) => this.rosa.teleport(x, y),
      state: () => ({
        rosa: { x: Math.round(this.rosa.x), y: Math.round(this.rosa.y), airborne: this.rosa.ctrl.airborne, vx: Math.round(this.rosa.ctrl.vx), vy: Math.round(this.rosa.ctrl.vy) },
        notes: [...this.save.notes],
        fragments: [...this.save.fragments],
        missions: [...this.save.missions],
        puzzles: [...this.save.puzzles],
        gratitude: this.gratitude?.count ?? 0,
        gateOpen: this.gateOpen,
        currentUp: this.currentUp,
        clamOpen: this.clamOpen,
        statueAwake: this.statueAwake,
        finaleDone: this.finaleDone,
        completed: this.save.completed,
        busy: this.busy,
        dialogue: this.ui?.dialogueActive,
        puzzle: this.activePuzzle?.id ?? null,
        puzzleBusy: this.puzzleBusy,
        bruno: { x: Math.round(this.bruno.x), y: Math.round(this.bruno.y), mode: this.bruno.mode },
        marea: { x: Math.round(this.marea.x), y: Math.round(this.marea.y) },
        prompt: this.nearestInteractable()?.id ?? null,
        objective: this.objectives?.text,
        audio: AudioManager.ctx?.state ?? 'none',
        song: AudioManager.customSongName,
        theme: AudioManager.hasTheme,
      }),
      fragmentSpots: FRAGMENT_SPOTS,
      noteSpots: NOTE_SPOTS,
    };
  }
}
