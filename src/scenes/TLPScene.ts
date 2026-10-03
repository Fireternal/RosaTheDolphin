import Phaser from 'phaser';
import { DEPTH, FONT_UI, GOLD_CSS, LAYER_NAMES, NOTE_INFO, NOTE_ORDER, NoteName } from '../config';
import { bus, EV } from '../core/EventBus';
import { damp, dist, isDebug, wait } from '../core/util';
import { isTouchDevice } from '../core/layout';
import { FishSchool, Lumi } from '../entities/Creatures';
import { IconKind, InteractMarker, QuestIcon } from '../entities/InteractMarker';
import { MelodyFragment } from '../entities/MelodyFragment';
import { RosaPlayer } from '../entities/RosaPlayer';
import { SwimInput, SwimWorld } from '../entities/SwimmingController';
import { TLPBuilder } from '../level/tlp/TLPBuilder';
import { COSTUME_PIECES, SPOTS, TLP_FINAL, TLP_FRAGMENTS, TLP_LUMI_START, TLP_PUZZLES, TLP_START, tlpFloorAt, TW } from '../level/tlp/TLPData';
import { TLP_MISSIONS } from '../level/tlp/tlpMissions';
import { AudioManager } from '../systems/AudioManager';
import { GratitudeSystem } from '../systems/GratitudeSystem';
import { MusicPuzzle } from '../systems/MusicPuzzle';
import { ObjectiveSystem } from '../systems/ObjectiveSystem';
import { ParticleManager } from '../systems/ParticleManager';
import { SaveData, TLPSave } from '../systems/SaveManager';
import { SonarSystem } from '../systems/SonarSystem';
import type { DialogueLine, UIScene } from './UIScene';

interface Interactable {
  id: string;
  pos: () => { x: number; y: number };
  radius: number;
  label: () => string;
  enabled: () => boolean;
  action: () => void;
  markerY: number;
  invite?: boolean;
  /** "!" (has a mission) or a speech bubble (just talks) floating over them. */
  icon?: () => IconKind;
}

interface Costume {
  id: string;
  name: string;
  item: Phaser.GameObjects.Image;
  worn: Phaser.GameObjects.Image;
  revealed: boolean;
  collected: boolean;
}

const ADD = Phaser.BlendModes.ADD;
const KEY = 'TLPScene';
const TALK_ROOM = 420;

/** Things the hall's PA system keeps announcing. */
const ANNOUNCEMENTS = [
  '«Recordamos que esta TLP está subvencionada por la Coalición Delfinaria»',
  '«Se ruega no mojar los teclados. Más.»',
  '«Ha aparecido un snorkel en la zona LAN. Su dueño puede pasar a recogerlo»',
  '«Es LAN. Repetimos: LAN. Gracias»',
  '«La Coalición Delfinaria les desea una feliz LanD… LAN Party»',
];
const ANNOUNCEMENTS_DARK = [
  '«Rogamos calma. La luz volverá… en algún momento»',
  '«Los teleperos que no encuentren su silla, que no se muevan. Por favor»',
  '«El generador de la Coalición solo alimenta la pantalla del escenario. Prioridades»',
];

/** What people say when Rosa's sonar goes off next to them. */
const SONAR_COMPLAINTS = [
  '¡Qué pesada!',
  '¡Cállate, Rosa!',
  '¡Otra vez el pitido no!',
  '¡Que estoy en ranked!',
  '¡Me has metido lag!',
  'Uff… la del sonar',
  '¡Mutead a la delfina!',
  '¡Que me retumba el snorkel!',
  'Presidenta, por favor…',
  '¿Esto también lo pagamos?',
  '¡Baja eso, señora!',
  '¡Shhh!',
];

/**
 * Melodía II — La Tenerife LanD Party.
 * Rosa subsidises (and floods) the Tenerife LAN Party, pretends to understand
 * everything, collects thank-yous and ends up blacking out the whole city.
 */
export class TLPScene extends Phaser.Scene {
  private save!: SaveData;
  private ui!: UIScene;
  private rosa!: RosaPlayer;
  private builder!: TLPBuilder;
  private particles!: ParticleManager;
  private sonar!: SonarSystem;
  private gratitude!: GratitudeSystem;
  private objectives!: ObjectiveSystem;
  private fragments: MelodyFragment[] = [];
  private costumes: Costume[] = [];
  private lumi!: Lumi;
  private schools: FishSchool[] = [];
  private puzzles!: { kpop: MusicPuzzle; router: MusicPuzzle; final: MusicPuzzle };
  private activePuzzle: MusicPuzzle | null = null;
  private puzzleBusy = false;
  private interactables: Interactable[] = [];
  private markers = new Map<string, InteractMarker>();
  private icons = new Map<string, QuestIcon>();
  private busy = false;
  private ready = false;
  private finaleDone = false;
  private camFocus = { x: 0, y: 0 };
  /** While Rosa talks to someone, the camera frames them in the upper half (above the dialogue). */
  private talkFocus: { x: number; y: number } | null = null;
  private cinematic = false;
  private world!: SwimWorld;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private pressedCodes: string[] = [];
  private bubbleTimer = 0;
  private saveTimer = 0;
  private announceTimer = 40;
  private announceIndex = 0;
  private organizerTalks = 0;
  private sonarShouts = 0;
  private lastComplaint = -1;

  constructor() {
    super(KEY);
  }

  create(data: { continue?: boolean }): void {
    this.fragments = [];
    this.costumes = [];
    this.schools = [];
    this.interactables = [];
    this.activePuzzle = null;
    this.puzzleBusy = false;
    this.busy = false;
    this.ready = false;
    this.finaleDone = false;
    this.cinematic = false;
    this.announceTimer = 40;
    this.organizerTalks = 0;

    this.save = (data?.continue && TLPSave.load()) || TLPSave.fresh();
    // Rosa already knows every note: she learned them in the Rotonda
    this.save.notes = [...NOTE_ORDER];
    if (!data?.continue) TLPSave.save(this.save);

    // extra room under the floor so people standing on it can be framed above the dialogue box
    this.cameras.main.setBounds(0, TW.top, TW.w, TW.bottom + TALK_ROOM - TW.top);
    this.cameras.main.setBackgroundColor('#0d1d3d');
    if (this.renderer.type === Phaser.WEBGL) this.cameras.main.postFX.addVignette(0.5, 0.5, 0.92, 0.3);

    this.builder = new TLPBuilder(this);
    this.builder.build();
    this.particles = new ParticleManager(this);
    this.sonar = new SonarSystem(this);

    const start = this.save.rosa ?? TLP_START;
    this.rosa = new RosaPlayer(this, start.x, start.y);
    this.camFocus = { x: start.x, y: start.y };
    this.cameras.main.startFollow(this.camFocus, false, 0.09, 0.09);
    this.cameras.main.centerOn(start.x, start.y);

    this.world = {
      // the whole hall is flooded up to the roof: there is no surface to jump out of
      surfaceY: -100000,
      minX: 70,
      maxX: TW.w - 70,
      minY: TW.minY,
      floorAt: tlpFloorAt,
      colliders: () => [],
      currents: () => [],
    };

    this.lumi = new Lumi(this, TLP_LUMI_START.x, TLP_LUMI_START.y);
    const R = Phaser.Geom.Rectangle;
    this.schools.push(new FishSchool(this, new R(300, 700, 2400, 900), 10, 'fish_1', 0.9));
    this.schools.push(new FishSchool(this, new R(3100, 700, 2600, 800), 9, 'fish_3', 0.9));

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
      this.events.off(Phaser.Scenes.Events.RESUME);
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
    this.ui.bindGame(this, KEY);
    this.objectives = new ObjectiveSystem(this.ui);
    this.gratitude = new GratitudeSystem(this.save, this.ui, () => this.persist());
    this.gratitude.register(...TLP_MISSIONS);
    this.applySavedState();
    this.ui.setFragments(this.slots());
    this.ui.setNotes(this.save.notes);
    this.ui.setGratitudeCount(this.gratitude.count);
    this.updateStatus();
    this.ready = true;
    this.updateObjective();
    if (!this.save.flags.introDone) void this.runIntro();
    else {
      this.lumi.following = true;
      if (isContinue) this.ui.toast('Bienvenida de nuevo, presidenta', 'La Tenerife LanD Party', GOLD_CSS);
    }
  }

  // =========================================================== setup

  private createCollectibles(): void {
    for (const s of TLP_FRAGMENTS) {
      if (this.save.fragments.includes(s.id)) continue;
      this.fragments.push(new MelodyFragment(this, s, TLP_FINAL[s.slot]));
    }
    for (const p of COSTUME_PIECES) {
      const item = this.builder.costumes[p.id];
      const worn = this.add.image(0, 0, p.key).setVisible(false).setDepth(p.id === 'cape' ? DEPTH.ROSA - 2 : DEPTH.ROSA + 2);
      const collected = !!this.save.flags[`costume_${p.id}`];
      if (collected) item.setVisible(false);
      this.costumes.push({ id: p.id, name: p.name, item, worn, revealed: collected, collected });
    }
  }

  private createPuzzles(): void {
    this.puzzles = {
      kpop: new MusicPuzzle(this, {
        id: 'kpop', label: 'Random Play Dance', x: SPOTS.boombox.x, y: SPOTS.boombox.y - 140, radius: 260,
        sourceX: SPOTS.dancers[1], sourceY: SPOTS.danceFloor.y - 360, notes: TLP_PUZZLES.kpop, inst: 'flute', interval: 520,
      }),
      router: new MusicPuzzle(this, {
        id: 'router', label: 'Arreglar el lag (escala descendente)', x: SPOTS.router.x, y: SPOTS.router.y - 300, radius: 280,
        sourceX: SPOTS.router.x, sourceY: SPOTS.router.y - 620, notes: TLP_PUZZLES.router, inst: 'bell', interval: 560,
      }),
      final: new MusicPuzzle(this, {
        id: 'final', label: 'Melodía de clausura', x: SPOTS.mic.x, y: SPOTS.mic.y - 120, radius: 420,
        sourceX: SPOTS.screen.x, sourceY: SPOTS.screen.y - 330, notes: TLP_FINAL, inst: 'bell', interval: 640,
      }),
    };
    for (const id of this.save.puzzles) {
      const p = (this.puzzles as Record<string, MusicPuzzle>)[id];
      if (p) p.solved = true;
    }
  }

  private createInteractables(): void {
    const above = (x: number, y: number) => () => ({ x, y });
    this.interactables = [
      {
        id: 'organizer', markerY: -140, invite: true, pos: above(SPOTS.organizer.x, SPOTS.organizer.y - 150), radius: 230,
        label: () => 'E — HABLAR', enabled: () => !!this.save.flags.introDone, action: () => void this.talkOrganizer(), icon: () => 'talk',
      },
      {
        id: 'telepera', markerY: -140, invite: true, pos: above(SPOTS.telepera.x, SPOTS.telepera.y - 150), radius: 220,
        label: () => 'E — HABLAR', enabled: () => true, action: () => void this.talkTelepera(), icon: () => 'talk',
      },
      {
        id: 'telepero', markerY: -140, invite: true, pos: above(SPOTS.telepero.x, SPOTS.telepero.y - 150), radius: 220,
        label: () => 'E — HABLAR', enabled: () => true, action: () => void this.talkTelepero(), icon: () => 'talk',
      },
      {
        id: 'kevin', markerY: -120, invite: true, pos: above(SPOTS.kevin.x, SPOTS.kevin.y - 120), radius: 230,
        label: () => (this.gratitude?.isDone('gg') ? 'E — HABLAR' : 'E — JUGAR UNA PARTIDA'), enabled: () => true,
        action: () => void this.talkKevin(), icon: () => (this.gratitude?.isDone('gg') ? 'talk' : 'quest'),
      },
      {
        id: 'router', markerY: -340, invite: true, pos: above(SPOTS.router.x, SPOTS.router.y - 300), radius: 280,
        label: () => (this.routerReady() ? 'E — ARREGLAR EL LAG' : 'E — MIRAR'), enabled: () => !this.puzzles.router.solved,
        action: () => void (this.routerReady() ? this.startRouter() : this.lookAtRouter()), icon: () => (this.routerReady() ? 'quest' : null),
      },
      {
        id: 'judge', markerY: -150, invite: true, pos: above(SPOTS.judge.x, SPOTS.judge.y - 140), radius: 250,
        label: () => (this.costumeCount() >= 3 ? 'E — PARTICIPAR EN EL COSPLAY' : 'E — HABLAR'),
        enabled: () => !this.gratitude?.isDone('cosplay'), action: () => void this.talkJudge(), icon: () => 'quest',
      },
      {
        id: 'boombox', markerY: -170, invite: true, pos: above(SPOTS.boombox.x, SPOTS.boombox.y - 140), radius: 260,
        label: () => 'E — BAILAR', enabled: () => !this.puzzles.kpop.solved, action: () => void this.startKpop(), icon: () => 'quest',
      },
      {
        id: 'moderator', markerY: -150, invite: true, pos: above(SPOTS.moderator.x + 60, SPOTS.moderator.y - 150), radius: 270,
        label: () => 'E — DAR LA PONENCIA', enabled: () => !this.gratitude?.isDone('innova'), action: () => void this.runInnova(), icon: () => 'quest',
      },
      {
        id: 'mic', markerY: -170, invite: true, pos: above(SPOTS.mic.x, SPOTS.mic.y - 120), radius: 340,
        label: () => (this.save.fragments.length >= 7 ? 'E — INTERPRETAR LA MELODÍA' : 'E — SUBIR AL ESCENARIO'),
        enabled: () => !this.finaleDone, action: () => this.interactMic(), icon: () => (this.save.fragments.length >= 7 ? 'quest' : null),
      },
      {
        id: 'lumi', markerY: -70, invite: false, pos: () => this.lumi, radius: 130,
        label: () => 'E — HABLAR CON LUMI', enabled: () => this.lumi.following && !!this.save.flags.introDone,
        action: () => void this.talkLumi(),
      },
    ];
  }

  private registerSonarTargets(): void {
    for (const f of this.fragments) this.sonar.add({ x: f.x, y: f.y, onSonar: () => { if (f.spawned) f.reveal(); } });
    for (const c of this.costumes) {
      if (c.collected) continue;
      this.sonar.add({ x: c.item.x, y: c.item.y, onSonar: () => this.revealCostume(c) });
    }
    // the sonar is LOUD: whoever it reaches lets Rosa know
    for (const p of Object.values(this.builder.people)) {
      this.sonar.add({ x: p.x, y: p.y - 120, onSonar: () => {
        this.tweens.add({ targets: p, scaleY: { from: 0.9, to: 1 }, duration: 300, ease: 'Back.easeOut' });
        this.complain(p.x, p.y - 290);
      } });
    }
    for (const g of this.builder.gamers) {
      this.sonar.add({ x: g.x, y: g.y - 100, onSonar: () => {
        this.tweens.add({ targets: g, y: { from: g.y - 10, to: g.y }, duration: 260, ease: 'Bounce.easeOut' });
        this.complain(g.x, g.y - 250);
      } });
    }
    for (const s of this.schools) this.sonar.add({ get x() { return s.x; }, get y() { return s.y; }, onSonar: (p) => s.scatter(p.x, p.y) });
  }

  // =========================================================== state

  private slots(): (NoteName | null)[] {
    const out: (NoteName | null)[] = Array(7).fill(null);
    for (const id of this.save.fragments) {
      const s = TLP_FRAGMENTS.find((f) => f.id === id);
      if (s) out[s.slot] = TLP_FINAL[s.slot];
    }
    return out;
  }

  private persist(): void {
    this.save.rosa = { x: Math.round(this.rosa.x), y: Math.round(this.rosa.y) };
    TLPSave.save(this.save);
  }

  private counter(id: string): number {
    return this.save.counters[id] ?? 0;
  }

  private updateStatus(flash = false): void {
    this.ui?.setStatus(`Postureo: ${this.counter('postureo')}%   ·   Lo que entiende: 0%\n«Es LAN, presidenta»: ${this.counter('corrections')}`, flash);
  }

  /** Someone corrects "LanD" (and Rosa does not care). */
  private corrected(): void {
    this.save.counters.corrections = this.counter('corrections') + 1;
    this.updateStatus(true);
    this.ui.toast(`Veces que la han corregido: ${this.counter('corrections')}`, 'Veces que le ha importado: 0', '#7fe3ff');
  }

  private posture(n: number): void {
    this.save.counters.postureo = Math.min(100, this.counter('postureo') + n);
    this.updateStatus(true);
  }

  private costumeCount(): number {
    return this.costumes.filter((c) => c.collected).length;
  }

  private applySavedState(): void {
    const f = this.save.flags;
    if (f.blackout) this.builder.setDark(1);
    if (f.generator) this.builder.generator.setVisible(true);
    if (this.gratitude.isDone('kpop')) this.builder.party = true;
    for (const fr of this.fragments) {
      if (fr.spot.spawnsOn && this.gratitude.isDone(fr.spot.spawnsOn)) fr.spawn();
    }
    if (this.save.completed) this.restoreFinale();
  }

  private updateObjective(): void {
    const n = this.save.fragments.length;
    if (this.save.completed) this.objectives.set('La TLP ha sido clausurada. Disfruta del recinto (a oscuras).');
    else if (!this.save.flags.introDone) this.objectives.set('Saluda a la organización.');
    else if (n < 6) this.objectives.set('Participa en las actividades y reúne los fragmentos.', { cur: n, total: 7 });
    else if (n < 7) this.objectives.set('Los teleperos tienen lag: mira el router de la zona LAN.', { cur: n, total: 7 });
    else this.objectives.set('¡Al escenario principal (al este)! Interpreta la melodía.', { cur: 7, total: 7 });
  }

  private toScreen(x: number, y: number): { x: number; y: number } {
    const cam = this.cameras.main;
    return { x: (x - cam.worldView.x) * cam.zoom, y: (y - cam.worldView.y) * cam.zoom };
  }

  // =========================================================== loop

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    const k = this.keys;
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

    const uiBlocked = this.ui.dialogueActive || this.ui.paused || this.ui.rhythmActive;
    const canAct = !uiBlocked && !this.busy;
    const canMove = canAct && !this.activePuzzle;

    const input: SwimInput = { x: 0, y: 0, sprint: false, boost: false };
    if (canMove) {
      input.x = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
      input.y = (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);
      input.sprint = k.SHIFT.isDown;
      input.boost = pressed.SPACE;
      if (touch && (touch.axisX !== 0 || touch.axisY !== 0)) {
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
        this.updateMarkers(dt, null, true);
      } else {
        if (pressed.Q && this.sonar.emit(this.rosa.x, this.rosa.y)) {
          this.sonarShouts = 0;
          this.particles.glyph(this.rosa.x, this.rosa.y - 40, 3);
        }
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
    } else {
      if (!this.activePuzzle) this.ui.setPrompt(null);
      this.updateMarkers(dt, null, true);
    }

    this.sonar.update(dt);
    this.ui.setSonar(1 - this.sonar.cooldown / this.sonar.cooldownTime);
    this.updateWorld(dt);
    this.checkPickups();
    this.updateCamera(dt);
    this.updateAnnouncements(dt, canAct);

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
    this.bubbleTimer -= dt;
    if (this.bubbleTimer <= 0) {
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
    this.lumi.update(dt, { x: this.rosa.x, y: this.rosa.y, facing: this.rosa.ctrl.facing });
    for (const s of this.schools) s.update(dt, this.rosa.x, this.rosa.y);
    for (const f of this.fragments) {
      const d = dist(f.x, f.y, this.rosa.x, this.rosa.y);
      f.update(dt, Phaser.Math.Clamp(1 - d / 520, 0, 1));
    }
    // hidden costume pieces shimmer when Rosa is near
    const t = this.time.now / 1000;
    for (const c of this.costumes) {
      if (c.collected) continue;
      if (!c.revealed) {
        const near = Phaser.Math.Clamp(1 - dist(c.item.x, c.item.y, this.rosa.x, this.rosa.y) / 520, 0, 1);
        c.item.setAlpha(near * 0.2 * (0.5 + 0.5 * Math.sin(t * 4)));
      } else {
        c.item.setY(c.item.y + Math.sin(t * 2 + c.item.x) * 0.3);
        c.item.setRotation(Math.sin(t * 1.5 + c.item.x) * 0.15);
      }
    }
    this.updateWorn();
  }

  /** Costume pieces Rosa has picked up are worn right away. */
  private updateWorn(): void {
    const rot = this.rosa.bodyRotation;
    const f = this.rosa.facingSign;
    const vis = this.rosa.container.visible;
    for (const c of this.costumes) {
      if (!c.collected) continue;
      const lp = c.id === 'crown' ? [86, -66] : c.id === 'cape' ? [-30, -30] : [40, 46];
      const p = this.rosa.localToWorld(lp[0], lp[1]);
      c.worn.setVisible(vis).setPosition(p.x, p.y).setFlipX(f < 0);
      if (c.id === 'crown') c.worn.setRotation(rot + 0.12 * f).setScale(0.55);
      else if (c.id === 'cape') c.worn.setRotation(rot - 0.3 * f + Math.sin(this.time.now / 300) * 0.06).setScale(0.75);
      else c.worn.setRotation(rot + 0.5 * f).setScale(0.6);
    }
  }

  private updateCamera(dt: number): void {
    if (this.cinematic) return;
    const c = this.rosa.ctrl;
    let tx = this.rosa.x + c.vx * 0.32;
    let ty = this.rosa.y + c.vy * 0.22;
    if (this.talkFocus && !this.busy && !this.ui.dialogueActive) this.talkFocus = null;
    if (this.activePuzzle) {
      const src = this.activePuzzle.cfg;
      tx = (this.rosa.x + src.sourceX) / 2;
      ty = Math.max((this.rosa.y + src.sourceY) / 2, this.rosa.y - 120) + 140;
    } else if (this.talkFocus) {
      tx = this.talkFocus.x;
      ty = this.talkFocus.y + 280;
    }
    // the room under the floor is only for framing conversations
    if (!this.talkFocus) ty = Math.min(ty, TW.bottom - 540);
    const k = damp(3.2, dt);
    this.camFocus.x += (tx - this.camFocus.x) * k;
    this.camFocus.y += (ty - this.camFocus.y) * k;
  }

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

  private updateAnnouncements(dt: number, canAct: boolean): void {
    if (!this.save.flags.introDone || this.finaleDone) return;
    this.announceTimer -= dt;
    if (this.announceTimer > 0 || !canAct || this.activePuzzle) return;
    this.announceTimer = 70;
    const list = this.save.flags.blackout ? ANNOUNCEMENTS_DARK : ANNOUNCEMENTS;
    this.ui.toast(list[this.announceIndex++ % list.length], 'MEGAFONÍA', '#ffe08a');
  }

  /** Somebody annoyed by the sonar (a few per ping, never the same line twice in a row). */
  private complain(x: number, y: number): void {
    if (this.sonarShouts >= 3 || dist(x, y, this.rosa.x, this.rosa.y) > 650) return;
    let i = Math.floor(Math.random() * SONAR_COMPLAINTS.length);
    if (i === this.lastComplaint) i = (i + 1) % SONAR_COMPLAINTS.length;
    this.lastComplaint = i;
    this.shout(x, y, SONAR_COMPLAINTS[i], '#ffb3a8', this.sonarShouts++ * 250);
  }

  /** A line shouted by someone in the hall (floats over their head). */
  private shout(x: number, y: number, text: string, color = '#ffffff', delay = 0): void {
    this.time.delayedCall(delay, () => {
      const t = this.add.text(x, y, text, { fontFamily: FONT_UI, fontSize: '28px', color, fontStyle: 'bold', stroke: '#06061a', strokeThickness: 7 })
        .setOrigin(0.5).setDepth(DEPTH.FOREGROUND + 4).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, y: y - 40, duration: 400, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: t, alpha: 0, y: y - 80, delay: 2400, duration: 600, onComplete: () => t.destroy() });
    });
  }

  // =========================================================== pickups

  private checkPickups(): void {
    if (this.busy) return;
    const rx = this.rosa.x;
    const ry = this.rosa.y;
    for (const f of this.fragments) {
      if (f.collectable && dist(f.container.x, f.container.y, rx, ry) < 110) this.collectFragment(f);
    }
    for (const c of this.costumes) {
      if (c.revealed && !c.collected && dist(c.item.x, c.item.y, rx, ry) < 110) this.collectCostume(c);
    }
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
    else if (count === 6 && !this.puzzles.router.solved) this.time.delayedCall(2600, () => void this.onRouterReady());
  }

  private revealCostume(c: Costume): void {
    if (c.revealed || c.collected) return;
    c.revealed = true;
    this.tweens.killTweensOf(c.item);
    c.item.setAlpha(1);
    this.tweens.add({ targets: c.item, scale: { from: 1.6, to: 1 }, duration: 800, ease: 'Elastic.easeOut' });
    this.particles.sparkles(c.item.x, c.item.y, 16);
  }

  private collectCostume(c: Costume): void {
    c.collected = true;
    this.save.flags[`costume_${c.id}`] = true;
    c.item.setVisible(false);
    this.particles.sparkles(c.item.x, c.item.y, 24);
    AudioManager.collectNote('SOL');
    const n = this.costumeCount();
    this.ui.toast(`Pieza de cosplay: ${c.name} (${n}/3)`, n >= 3 ? '¡Disfraz completo! Al jurado de la Summer-Con' : 'Rosa se la pone. Le queda… regular.', '#ffb36b');
    this.persist();
  }

  private playFreeNote(note: NoteName): void {
    AudioManager.playNote(note);
    const m = this.rosa.mouth();
    this.particles.singNote(m.x, m.y, note);
  }

  // =========================================================== puzzles

  private async startPuzzle(p: MusicPuzzle): Promise<void> {
    if (this.activePuzzle || p.solved) return;
    this.activePuzzle = p;
    // near the floor Rosa would hide behind the note panel: she floats up a little
    const top = TW.floor - 430;
    if (this.rosa.y > top) this.tweens.add({ targets: this.rosa.ctrl, y: top, duration: 800, ease: 'Sine.easeInOut' });
    this.ui.showPuzzle(p.cfg.label, p.sequence.length, this.save.notes);
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
    this.ui.puzzleState(isTouchDevice() ? 'Tu turno: toca las notas de la melodía' : 'Tu turno: toca la melodía (1-7)', '#ffffff');
  }

  private onNoteInput(note: NoteName): void {
    const p = this.activePuzzle;
    if (!p || !this.ready || this.busy || this.ui.dialogueActive) return;
    AudioManager.playNote(note);
    const m = this.rosa.mouth();
    this.particles.singNote(m.x, m.y, note);
    this.ui.puzzleKeyFlash(note, this.save.notes);
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
    this.ui.puzzleState(p.id === 'router' ? 'Ping: bajando…' : '¡Precioso!', GOLD_CSS);
    if (p.id !== 'final') AudioManager.success();
    await wait(this, 1000);
    this.ui.hidePuzzle();
    this.activePuzzle = null;
    this.puzzleBusy = false;
    if (p.id === 'kpop') await this.solveKpop();
    else if (p.id === 'router') await this.solveRouter();
    else if (p.id === 'final') await this.runFinale();
  }

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
    return this.busy || this.ui.rhythmActive;
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

  private spawnFragment(mission: string, fromX: number, fromY: number): void {
    const frag = this.fragments.find((f) => f.spot.spawnsOn === mission);
    frag?.spawn(fromX, fromY);
  }

  /** Rosa swims beside whoever she talks to, facing them, so both stay visible. */
  private async approach(p: { x: number; y: number }): Promise<void> {
    const headY = p.y - 190;
    const side = this.rosa.x <= p.x ? -1 : 1;
    const tx = Phaser.Math.Clamp(p.x + side * 240, this.world.minX, this.world.maxX);
    const ty = Phaser.Math.Clamp(headY, TW.minY, TW.floor - 80);
    const c = this.rosa.ctrl;
    c.vx = 0;
    c.vy = 0;
    c.facing = side > 0 ? -1 : 1;
    this.talkFocus = { x: (tx + p.x) / 2, y: headY };
    this.tweens.add({ targets: c, x: tx, y: ty, duration: 450, ease: 'Sine.easeOut' });
    await wait(this, 460);
  }

  private async say(lines: DialogueLine[]): Promise<void> {
    await this.ui.say(lines);
  }

  // =========================================================== story

  private async runIntro(): Promise<void> {
    this.busy = true;
    this.lumi.anchor = { x: this.rosa.x - 160, y: this.rosa.y - 90 };
    await wait(this, 1600);
    await this.say([
      { who: 'Organizadora', text: '¡Presidenta! Bienvenida a la Tenerife LAN Party. Bueno… a lo que queda de ella después de inundarla.' },
      { who: 'Rosa', text: '¡Bienvenidos todos a la primera Tenerife LanD Party acuática tecnológica más grande del mundo!' },
      { who: 'Organizadora', text: 'Es LAN, presidenta. L-A-N. Y bueno… es la única acuática.' },
    ]);
    this.corrected();
    await this.say([
      { who: 'Rosa', text: 'LAN, LanD, lo que sea. Lo importante es que esto lo pago yo. ¿Lo habéis puesto en los carteles?' },
      { who: 'Organizadora', text: 'En todos. Y en la pancarta de la entrada… le hemos tapado la D con cinta.' },
    ]);
    await this.gratitude.thank('welcome');
    this.ui.setGratitudeCount(this.gratitude.count, true);
    await this.say([
      { who: 'Lumi', text: 'Presidenta, aquí hay miles de jóvenes que votan por primera vez. Si consigue que le den las gracias…' },
      { who: 'Rosa', text: '…la Coalición Delfinaria arrasa en las elecciones. Tranquila, Lumi: yo de esto sé muchísimo. Soy muy gamer. Muy telepera.' },
      { who: 'Lumi', text: 'Hay siete fragmentos de melodía repartidos por las actividades: la zona LAN, la Summer-Con, el K-Pop y TLP Innova.' },
      { who: 'Lumi', text: 'Cuando los tenga, el escenario principal la espera al fondo, al este. Con su logo en la pantalla grande, como pidió.' },
      { who: 'Rosa', text: 'Como debe ser. ¡Vamos a que nos den las gracias!' },
    ]);
    this.posture(10);
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
    const done = (id: string) => this.gratitude.isDone(id);
    if (s.completed) return 'Qué clausura, presidenta. Aunque… la ciudad sigue a oscuras.';
    if (s.fragments.length >= 7) return '¡Los siete! El escenario principal está al fondo, al este. Suba al micrófono y pulse E.';
    if (!has('t-entrada')) return 'Arriba, junto a la pancarta de la entrada, brilla un fragmento. ¡Nade hacia arriba!';
    if (!done('gg')) return 'Kevin, un chico de la grada de la zona LAN, busca compañero para una partida. Es su oportunidad de parecer gamer.';
    if (!has('t-cable')) return 'Kevin dice que se le cayó algo brillante debajo de las mesas de abajo. Use el sonar (Q) cerca del suelo.';
    if (!done('cosplay') && this.costumeCount() < 3) return `Para el cosplay necesita corona, capa y tridente. Lleva ${this.costumeCount()} de 3: el sonar las revela. Una está muy arriba en la zona LAN, otra cerca de la Summer-Con y otra junto al K-Pop.`;
    if (!done('cosplay')) return '¡Disfraz completo! El jurado de la Summer-Con está junto al escenario de cosplay.';
    if (!this.puzzles.kpop.solved) return 'En la zona K-Pop hacen un Random Play Dance. Hable con el altavoz (E) y repita el estribillo.';
    if (!done('innova')) return 'En TLP Innova la esperan para su ponencia. Se titula… «Blockchain, metaverso e IA aplicados a la gestión de rotondas».';
    if (s.fragments.length < 6) return 'Le faltan fragmentos por recoger: brillan en dorado donde terminó cada actividad.';
    if (!this.puzzles.router.solved) return 'Los teleperos se quejan del lag. El router principal está al final de la zona LAN… pero pone «NO TOCAR».';
    return 'Siga buscando: los fragmentos brillan en dorado.';
  }

  private async talkLumi(): Promise<void> {
    this.busy = true;
    this.lumi.hop(this);
    await this.say([{ who: 'Lumi', text: this.lumiHint() }]);
    this.busy = false;
  }

  private async talkOrganizer(): Promise<void> {
    this.busy = true;
    await this.approach(this.builder.people.organizer);
    const lines: DialogueLine[][] = [
      [
        { who: 'Rosa', text: '¡Qué gran Tenerife LanD Party estamos haciendo!' },
        { who: 'Organizadora', text: 'LAN, presidenta.' },
      ],
      [
        { who: 'Rosa', text: 'Lumi, ¿han dicho ya lo de la subvención por megafonía?' },
        { who: 'Lumi', text: 'Cada media hora, presidenta. Como pidió.' },
        { who: 'Rosa', text: 'Que lo digan cada cuarto de hora. Y que digan LanD.' },
        { who: 'Organizadora', text: 'Es LAN.' },
      ],
      [
        { who: 'Organizadora', text: 'Presidenta, ¿de verdad hacía falta inundar el recinto?' },
        { who: 'Rosa', text: 'Para que me sienta como en casa. Además, una LanD Party acuática es muy… innovadora.' },
        { who: 'Organizadora', text: 'LAN. Los teclados no opinan lo mismo.' },
      ],
    ];
    const set = lines[this.organizerTalks++ % lines.length];
    await this.say(set);
    if (set.some((l) => l.text.startsWith('LAN') || l.text.startsWith('Es LAN'))) this.corrected();
    this.busy = false;
  }

  private async talkTelepera(): Promise<void> {
    this.busy = true;
    await this.approach(this.builder.people.telepera);
    if (this.save.flags.jargonA) {
      await this.say([{ who: 'Telepera', text: 'Presidenta, se lo digo con cariño: LAN viene de «Local Area Network». No lleva D.' }]);
      this.busy = false;
      return;
    }
    const i = await this.ui.choose({ who: 'Telepera', text: 'Presidenta, ¿usted es más de PC o de consola?' }, [
      'De PC. Tengo uno en el despacho para el Excel.',
      'De consola. Me consuelo muchísimo.',
      'De las dos. Y de la Game Boy de mi sobrino.',
    ]);
    const replies: DialogueLine[][] = [
      [{ who: 'Telepera', text: '¿Para el Excel…? Vale. ¿Y a qué juega?' }, { who: 'Rosa', text: 'Al Buscaminas. A nivel competitivo.' }],
      [{ who: 'Telepera', text: 'Eso no es… bueno, da igual.' }],
      [{ who: 'Telepera', text: 'Una Game Boy. Qué retro, presidenta.' }, { who: 'Rosa', text: '¿Retro? Si es nuevísima. Me la regalaron hace nada. En 1998.' }],
    ];
    await this.say(replies[i]);
    this.posture(15);
    await this.say([
      { who: 'Rosa', text: 'Bueno, ¿y qué te parece mi Tenerife LanD Party?' },
      { who: 'Telepera', text: 'LAN.' },
    ]);
    this.corrected();
    this.save.flags.jargonA = true;
    this.persist();
    this.busy = false;
  }

  private async talkTelepero(): Promise<void> {
    this.busy = true;
    await this.approach(this.builder.people.telepero);
    if (this.save.flags.jargonB) {
      await this.say([{ who: 'Telepero', text: 'Si quiere jugar de verdad, Kevin busca compañero. Está en la grada, al fondo. Es un crack.' }]);
      this.busy = false;
      return;
    }
    const i = await this.ui.choose({ who: 'Telepero', text: '¿Se echa una ranked, presidenta? Vamos tryhard, pero sin tiltear.' }, [
      '¡Claro! Yo tilteo muchísimo. Es lo que más tilteo.',
      'No puedo, tengo lag de agenda.',
      '¿Ranked? Yo solo juego en modo presidenta.',
    ]);
    const replies: DialogueLine[][] = [
      [{ who: 'Telepero', text: 'No… tiltear es malo, presidenta. Es cuando te enfadas y juegas fatal.' }, { who: 'Rosa', text: 'Ah, eso. Eso lo hace la oposición.' }],
      [{ who: 'Telepero', text: '«Lag de agenda»… Me lo apunto. Qué cringe. Digo… qué crack.' }],
      [{ who: 'Telepero', text: '¿Y eso qué modo es?' }, { who: 'Rosa', text: 'Uno en el que siempre ganas y te dan las gracias. Muy difícil de desbloquear.' }],
    ];
    await this.say(replies[i]);
    this.posture(15);
    await this.say([{ who: 'Telepero', text: 'Si quiere jugar de verdad, Kevin busca compañero. Está en la grada, al fondo.' }]);
    this.save.flags.jargonB = true;
    this.persist();
    this.busy = false;
  }

  // ---------------------------------------------------------------- Kevin (the "GG")

  private async talkKevin(): Promise<void> {
    this.busy = true;
    await this.approach(this.builder.people.kevin);
    if (this.gratitude.isDone('gg')) {
      await this.say([
        { who: 'Kevin', text: 'Antes se me cayó algo brillante debajo de las mesas de abajo. ¿Lo busca con su sonar ese?' },
        { who: 'Rosa', text: 'Mi sonar es de última generación. Lo pagué yo.' },
      ]);
      this.busy = false;
      return;
    }
    await this.say([
      { who: 'Kevin', text: '¡Eh, señora delfín! Me falta uno para la partida. ¿Sabe jugar?' },
      { who: 'Rosa', text: '¿Que si sé? Soy la presidenta. Nadie juega más que yo. Bueno, mi asesor de comunicación.' },
      { who: 'Kevin', text: 'Vale. Pulse las notas cuando lleguen al círculo. Y sin lag, ¿eh?' },
    ]);
    const chart: [number, number][] = [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4], [2, 5], [2, 6], [1, 7], [0, 8], [1, 9], [2, 10], [0, 11], [2, 12], [1, 13], [0, 14]];
    const r = await this.ui.rhythm('La partida de Kevin', ['DO', 'RE', 'MI'], chart, 96);
    const won = r.hits >= r.total * 0.6;
    await this.say([
      { who: 'Kevin', text: won ? `¡Hemos ganado! ${r.hits} de ${r.total}. No está mal para una señora delfín.` : `Hemos perdido… ${r.hits} de ${r.total}. Pero bueno, da igual.` },
      { who: 'Kevin', text: 'GG.' },
      { who: 'Rosa', text: '¿Cómo? ¿«Gracias, gracias»? ¡Ay, de nada, cariño, de nada!' },
      { who: 'Kevin', text: 'No… GG es «good game»…' },
      { who: 'Rosa', text: 'Lumi, apunta: un joven me ha dado las gracias. Dos veces.' },
    ]);
    this.posture(20);
    await this.gratitude.thank('gg');
    this.ui.setGratitudeCount(this.gratitude.count, true);
    await this.gratitude.showReality('gg');
    const k = this.builder.people.kevin;
    this.spawnFragment('gg', k.x, k.y - 160);
    await this.say([{ who: 'Kevin', text: 'Tome, esto brillaba en mi pantalla. Y antes se me cayó otra cosa brillante debajo de las mesas de abajo.' }]);
    this.persist();
    this.busy = false;
  }

  // ---------------------------------------------------------------- Summer-Con

  private async talkJudge(): Promise<void> {
    this.busy = true;
    await this.approach(this.builder.people.judge);
    if (this.costumeCount() < 3) {
      await this.say([
        { who: 'Jurado de la Summer-Con', text: '¿Viene al concurso de cosplay? Necesita un disfraz completo: corona, capa y tridente.' },
        { who: 'Jurado de la Summer-Con', text: 'Alguien perdió esas piezas por el recinto. Con tanta agua, flotan por todas partes.' },
        { who: 'Lumi', text: `Lleva ${this.costumeCount()} de 3, presidenta. El sonar (Q) las hace brillar.` },
      ]);
      this.busy = false;
      return;
    }
    await this.say([
      { who: 'Jurado de la Summer-Con', text: '¡Bienvenida al concurso de cosplay de la Summer-Con! ¿De qué va disfrazada?' },
      { who: 'Rosa', text: 'De «Reina de los Mares Galáctica, Presidenta Edition». Es un personaje muy conocido. Lo he inventado yo esta mañana.' },
    ]);
    this.posture(15);
    // Rosa goes on stage
    const cam = this.cameras.main;
    cam.fadeOut(350, 2, 10, 26);
    await wait(this, 400);
    this.rosa.teleport(SPOTS.cosplayers[1] - 260, SPOTS.cosStage.y - 330);
    this.camFocus.x = SPOTS.cosStage.x - 120;
    this.camFocus.y = 1500;
    await this.cinematicTo(SPOTS.cosStage.x - 120, 1500, 10);
    cam.fadeIn(350, 2, 10, 26);
    await wait(this, 600);
    AudioManager.playMidi('harp', 72, 1, 0.3);
    await this.say([{ who: 'Jurado de la Summer-Con', text: 'Tras deliberar mucho… el ganador de este año es… ¡el Caballero de Cartón!' }]);
    const knight = this.builder.people.cos_knight;
    this.tweens.add({ targets: knight, y: knight.y - 60, duration: 260, yoyo: true, repeat: 2, ease: 'Sine.easeOut' });
    this.particles.sparkles(knight.x, knight.y - 200, 40);
    AudioManager.success();
    this.shout(knight.x, knight.y - 300, '¡¡SÍÍÍ!!', '#ffe08a');
    await wait(this, 1200);
    await this.say([{ who: 'Jurado de la Summer-Con', text: 'Y a todos los demás… ¡gracias por participar! Aquí tienen su diploma.' }]);
    const d = this.builder.diploma;
    d.setPosition(SPOTS.judge.x, SPOTS.judge.y - 200).setVisible(true).setScale(0.2);
    this.tweens.add({ targets: d, x: this.rosa.x + 40, y: this.rosa.y - 150, scale: 0.55, duration: 900, ease: 'Sine.easeOut' });
    await wait(this, 900);
    await this.say([
      { who: 'Rosa', text: '¿Lo habéis oído? ¡GRACIAS! A mí. ¡He ganado!' },
      { who: 'Lumi', text: 'Presidenta… ha ganado el de cartón. Usted tiene un diploma de participación.' },
      { who: 'Rosa', text: 'Él ha ganado el concurso. Yo he ganado las gracias. ¡Soy la mejor presidenta delfina de la historia!' },
    ]);
    await this.gratitude.thank('cosplay');
    this.ui.setGratitudeCount(this.gratitude.count, true);
    await this.gratitude.showReality('cosplay');
    this.tweens.add({ targets: d, alpha: 0, duration: 600, onComplete: () => d.setVisible(false).setAlpha(1) });
    this.spawnFragment('cosplay', SPOTS.judge.x, SPOTS.judge.y - 160);
    this.endCinematic();
    this.persist();
    this.busy = false;
  }

  // ---------------------------------------------------------------- K-Pop

  private async startKpop(): Promise<void> {
    if (!this.save.flags.kpopIntro) {
      this.busy = true;
      await this.say([
        { who: 'Fans del K-Pop', text: '¡Random Play Dance! Suena una canción y quien se la sepa, sale a bailar. ¿Se anima, presidenta?' },
        { who: 'Rosa', text: 'Por supuesto. Me encanta el K-Pop. Sobre todo el… el de Corea.' },
        { who: 'Fans del K-Pop', text: '¡Pues repita el estribillo con nosotras!' },
      ]);
      this.posture(10);
      this.save.flags.kpopIntro = true;
      this.busy = false;
    }
    await this.startPuzzle(this.puzzles.kpop);
  }

  private async solveKpop(): Promise<void> {
    this.busy = true;
    this.builder.party = true;
    await this.cinematicTo(SPOTS.danceFloor.x, 1550, 900);
    AudioManager.setLayerCount(7, 1);
    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(i * 380, () => {
        this.particles.note(SPOTS.dancers[i % 3], 1700, TLP_PUZZLES.kpop[i], 10);
        AudioManager.playNote(TLP_PUZZLES.kpop[i], { inst: 'flute', vel: 0.4 });
      });
    }
    for (let i = 0; i < 5; i++) this.time.delayedCall(i * 450, () => this.particles.sparkles(this.rosa.x, this.rosa.y - 40, 14));
    this.shout(SPOTS.dancers[0], 1560, '¡Lo están grabando!', '#ff9fe0', 600);
    this.shout(SPOTS.dancers[2], 1500, '¡Ya está en todas las redes!', '#ff9fe0', 1500);
    await wait(this, 2600);
    AudioManager.setLayerCount(this.save.fragmentOrder.length, 2);
    await this.say([{ who: 'Rosa', text: '¡Soy viral! Lumi, ¿cuántos votos son dos millones de visitas?' }]);
    await this.gratitude.thank('kpop');
    this.ui.setGratitudeCount(this.gratitude.count, true);
    await this.gratitude.showReality('kpop');
    this.spawnFragment('kpop', SPOTS.danceFloor.x, 1700);
    this.endCinematic();
    this.persist();
    this.busy = false;
  }

  // ---------------------------------------------------------------- TLP Innova

  private async runInnova(): Promise<void> {
    this.busy = true;
    await this.approach(this.builder.people.moderator);
    await this.say([
      { who: 'Moderador', text: 'Presidenta, su ponencia: «Blockchain, metaverso e IA aplicados a la gestión de rotondas». El público espera.' },
      { who: 'Rosa', text: 'Perfecto. Lo he preparado muchísimo. Bueno, he leído el título.' },
    ]);
    await this.cinematicTo(SPOTS.podium.x, 1500, 700);
    const qs: { q: string; opts: string[]; replies: DialogueLine[][] }[] = [
      {
        q: 'Presidenta, ¿qué es para usted el blockchain?',
        opts: ['Una cadena. De bloques. Muy larga.', 'Lo que usamos para cortar las rotondas por obras.', 'Una cosa moderna que da muchas subvenciones.'],
        replies: [[{ who: 'Público', text: '(silencio)' }], [{ who: 'Público', text: '(silencio incómodo)' }], [{ who: 'Público', text: '(alguien tose)' }]],
      },
      {
        q: '¿Y cómo aplicaría la inteligencia artificial?',
        opts: ['Con mucha inteligencia. Y bastante artificial.', 'Un chatbot que diga «gracias, Rosa» cada cinco minutos.', 'Igual que el blockchain, pero en el metaverso.'],
        replies: [[{ who: 'Público', text: '(un aplauso suelto, por error)' }], [{ who: 'Público', text: '(el chatbot ya existe: lo pagó ella)' }], [{ who: 'Público', text: '(¿qué ha dicho?)' }]],
      },
      {
        q: '¿Qué les diría a los jóvenes emprendedores?',
        opts: ['Que voten a la Coalición Delfinaria.', 'Que emprendan. Pero sin molestar.', 'Que habrá un hub de innovación. En la rotonda.'],
        replies: [[{ who: 'Público', text: '(murmullos)' }], [{ who: 'Público', text: '(¿eso es un consejo?)' }], [{ who: 'Público', text: '(¿en la rotonda?)' }]],
      },
    ];
    for (const q of qs) {
      const i = await this.ui.choose({ who: 'Público', text: q.q }, q.opts);
      await this.say(q.replies[i]);
      this.posture(10);
    }
    await this.say([
      { who: 'Rosa', text: 'En resumen: el futuro es el futuro. Y la Coalición Delfinaria ya está allí. Esperándoos. Con un hub.' },
      { who: 'Moderador', text: 'Eh… muchas gracias, presidenta. Ha sido… una ponencia.' },
    ]);
    await this.gratitude.thank('innova');
    this.ui.setGratitudeCount(this.gratitude.count, true);
    await this.gratitude.showReality('innova');
    this.spawnFragment('innova', SPOTS.podium.x, SPOTS.podium.y - 220);
    this.endCinematic();
    this.persist();
    this.busy = false;
  }

  // ---------------------------------------------------------------- the router (and the blackout)

  /** The router is the last activity: the party is lit until everything else is done. */
  private routerReady(): boolean {
    return this.save.fragments.length >= 6 || this.puzzles.router.solved;
  }

  private async lookAtRouter(): Promise<void> {
    this.busy = true;
    await this.say([
      { who: 'Rosa', text: 'Un router enorme. Con lucecitas. Pone «NO TOCAR».' },
      { who: 'Lumi', text: 'Mejor no lo toque, presidenta. Primero termine el resto de actividades… y luego, si eso, tampoco.' },
    ]);
    this.busy = false;
  }

  /** All the activities are done: now the gamers complain about the lag. */
  private async onRouterReady(): Promise<void> {
    while (this.busy || this.ui.dialogueActive || this.activePuzzle) await wait(this, 300);
    this.updateObjective();
    const g = this.builder.gamers;
    this.shout(g[2].x, g[2].y - 260, '¡¡LAG!!', '#ff9a9a');
    this.shout(g[9].x, g[9].y - 260, '¡Esto va a pedales!', '#ff9a9a', 600);
    await this.say([
      { who: 'Megafonía', text: 'Atención: se están registrando problemas de conexión en la zona LAN. Rogamos paciencia.' },
      { who: 'Lumi', text: 'Presidenta, los teleperos se quejan de lag. El router principal está al final de la zona LAN.' },
      { who: 'Rosa', text: '¿Lag? Eso lo arreglo yo con una melodía. Luego, al escenario a recoger las gracias.' },
    ]);
  }

  private async startRouter(): Promise<void> {
    if (!this.save.flags.routerIntro) {
      this.busy = true;
      await this.say([
        { who: 'Telepero', text: '¡Presidenta! ¡Hay un lag horrible! ¡El ping está por las nubes!' },
        { who: 'Rosa', text: '¿El ping? Tranquilos. Si el ping está alto, se baja con una escala descendente. Lo sabe todo el mundo.' },
        { who: 'Lumi', text: 'Presidenta… ese cartel dice «NO TOCAR».' },
        { who: 'Rosa', text: 'Ese cartel no sabe con quién está hablando.' },
      ]);
      this.posture(10);
      this.save.flags.routerIntro = true;
      this.busy = false;
    }
    await this.startPuzzle(this.puzzles.router);
  }

  private async solveRouter(): Promise<void> {
    this.busy = true;
    const b = this.builder;
    await this.cinematicTo(SPOTS.router.x - 500, 1300, 800, 0.75);
    // everything goes down… one flicker at a time
    AudioManager.powerDown();
    this.cameras.main.shake(700, 0.004);
    for (const v of [0.6, 0.1, 0.8, 0.3, 1]) {
      b.setDark(v);
      await wait(this, 160);
    }
    this.save.flags.blackout = true;
    this.persist();
    AudioManager.duck(0.35, 0.6);
    const g = b.gamers;
    this.shout(g[1].x, g[1].y - 260, '¡¡NOOO!! ¡Iba ganando!', '#ff9a9a', 300);
    this.shout(g[4].x, g[4].y - 260, '¡Se ha ido el internet!', '#ff9a9a', 900);
    this.shout(g[7].x, g[7].y - 260, '¡Y la luz!', '#ff9a9a', 1500);
    await wait(this, 2200);
    // …and through the windows: the whole city goes dark
    await this.cinematicTo(this.rosa.x, 560, 1400, 0.75);
    await wait(this, 800);
    await this.say([{ who: 'Megafonía', text: 'Atención: se ha ido la luz en toda la ciudad. Repetimos: en toda la ciudad.' }]);
    await this.cinematicTo(this.rosa.x, this.rosa.y - 60, 1000, 1);
    AudioManager.duck(1, 1.5);
    await this.say([{ who: 'Rosa', text: 'Ping: cero. ¡Problema resuelto! ¿Veis? Yo de esto entiendo.' }]);
    this.posture(20);
    await this.gratitude.thank('router');
    this.ui.setGratitudeCount(this.gratitude.count, true);
    await this.gratitude.showReality('router');
    await this.say([
      { who: 'Lumi', text: 'Presidenta… el escenario principal también se ha quedado sin luz.' },
      { who: 'Rosa', text: 'Tranquila. La Coalición tiene un generador. Para la pantalla con mi logo, lo primero.' },
    ]);
    this.spawnFragment('router', SPOTS.router.x, SPOTS.router.y - 500);
    this.endCinematic();
    this.persist();
    this.busy = false;
  }

  // ---------------------------------------------------------------- main stage

  private async onAllFragments(): Promise<void> {
    this.updateObjective();
    while (this.busy || this.ui.dialogueActive || this.activePuzzle) await wait(this, 300);
    await this.say([
      { who: 'Lumi', text: '¡Los siete fragmentos, presidenta! Es la hora de la clausura en el escenario principal, al este.' },
      { who: 'Rosa', text: 'Que enciendan el generador. Y que pongan mi logo bien grande. Más grande. Más.' },
    ]);
  }

  private interactMic(): void {
    const n = this.save.fragments.length;
    if (n < 7) {
      void this.say([
        { who: 'Rosa', text: '¡Qué escenario! Aquí voy a clausurar mi Tenerife LanD Party.' },
        { who: 'Lumi', text: `Le faltan ${7 - n} fragmentos para la melodía, presidenta. ${this.save.flags.blackout ? '' : 'Y, de momento, la pantalla ya tiene su nombre… mal escrito.'}` },
      ]);
      return;
    }
    void this.beginFinal();
  }

  private async beginFinal(): Promise<void> {
    this.busy = true;
    const cam = this.cameras.main;
    if (!this.save.flags.finalIntro) {
      cam.fadeOut(350, 2, 10, 26);
      await wait(this, 400);
      this.rosa.teleport(SPOTS.mic.x - 150, SPOTS.mic.y - 140);
      this.camFocus.x = this.rosa.x;
      this.camFocus.y = this.rosa.y;
      cam.fadeIn(350, 2, 10, 26);
      await this.say([{ who: 'Megafonía', text: 'Y para clausurar la primera TLP acuática… ¡la presidenta de la Coalición Delfinaria!' }]);
      this.shout(5700, 1840, '¿Quién?', '#cfe6ff');
      this.shout(6300, 1860, '¿Esa no es la del apagón?', '#cfe6ff', 700);
      await wait(this, 1400);
      await this.say([{ who: 'Rosa', text: '¡Lumi, el generador!' }]);
      this.powerGenerator(false);
      await wait(this, 2600);
      await this.say([{ who: 'Rosa', text: 'Gracias, gracias. Esta es mi melodía perfecta: MI, SOL, LA, SOL, MI, RE, DO. ¡Que suene a mayoría absoluta!' }]);
      this.save.flags.finalIntro = true;
      this.persist();
    } else if (!this.save.flags.generator) this.powerGenerator(true);
    AudioManager.setLayerCount(0, 2);
    this.busy = false;
    await this.startPuzzle(this.puzzles.final);
  }

  private powerGenerator(instant: boolean): void {
    const b = this.builder;
    this.save.flags.generator = true;
    b.generator.setVisible(true);
    if (instant) {
      b.screenLogo.setAlpha(1);
      return;
    }
    AudioManager.generator();
    this.tweens.add({ targets: b.generator, y: { from: b.generator.y + 30, to: b.generator.y }, duration: 120, yoyo: true, repeat: 6 });
    this.particles.bubble(b.generator.x + 80, b.generator.y - 220, 20);
    this.time.delayedCall(1200, () => {
      this.tweens.add({ targets: b.screenLogo, alpha: { from: 0, to: 1 }, duration: 300, yoyo: true, repeat: 2, onComplete: () => b.screenLogo.setAlpha(1) });
      this.cameras.main.flash(300, 120, 170, 255);
    });
  }

  private async runFinale(): Promise<void> {
    this.busy = true;
    this.finaleDone = true;
    this.ui.setPrompt(null);
    this.ui.setHudVisible(false, 1200);
    const cam = this.cameras.main;
    const b = this.builder;
    this.cinematic = true;
    cam.stopFollow();
    cam.pan(SPOTS.stage.x, 1320, 2200, 'Sine.easeInOut');
    cam.zoomTo(0.62, 2400, 'Sine.easeInOut');

    // each note flies to the big screen and lights a stage beam
    for (let i = 0; i < 7; i++) {
      const n = TLP_FINAL[i];
      const m = this.rosa.mouth();
      const c = NOTE_INFO[n].color;
      const g = this.add.image(m.x, m.y, 'glyph').setTint(c).setScale(0.6).setDepth(DEPTH.FOREGROUND + 4);
      const glow = this.add.image(m.x, m.y, 'glow').setTint(c).setBlendMode(ADD).setScale(0.6).setDepth(DEPTH.FOREGROUND + 4);
      AudioManager.playNote(n, { inst: 'bell', vel: 0.5 });
      const tx = SPOTS.screen.x - 390 + i * 130;
      this.tweens.add({
        targets: [g, glow], x: tx, y: SPOTS.screen.y - 240, scale: 1, duration: 900, ease: 'Sine.easeInOut', onComplete: () => {
          this.particles.note(tx, SPOTS.screen.y - 240, n, 14);
          const beam = b.stageBeams[i % b.stageBeams.length];
          this.tweens.add({ targets: beam, alpha: 0.35, duration: 600 });
          this.tweens.add({ targets: [g, glow], alpha: 0, scale: 0.3, delay: 900, duration: 800, onComplete: () => { g.destroy(); glow.destroy(); } });
        },
      });
      this.time.delayedCall(400, () => AudioManager.setLayerCount(i + 1, 1.2));
      await wait(this, 520);
    }
    await wait(this, 900);
    AudioManager.setFullMode(true);
    // the crowd lights up the hall with their phones; confetti everywhere
    b.crowdLights.forEach((l, i) => this.tweens.add({ targets: l, alpha: 0.9, delay: i * 60, duration: 600 }));
    this.tweens.add({ targets: b.screenGlow, alpha: 0.4, duration: 1500 });
    this.tweens.add({ targets: b.screenLogo, scale: 1.03, duration: 700, yoyo: true, repeat: 5, ease: 'Sine.easeInOut' });
    const confetti = this.add.particles(0, 0, 'star', {
      x: { min: 5400, max: 6650 }, y: 520, speedY: { min: 120, max: 260 }, speedX: { min: -60, max: 60 },
      scale: { start: 0.5, end: 0.2 }, rotate: { min: 0, max: 360 }, lifespan: 6000, frequency: 30,
      tint: [0xff3fd0, 0x3fd8ff, 0xffe08a, 0x3fff9f, 0xffffff],
    }).setDepth(DEPTH.FOREGROUND + 4);
    this.time.delayedCall(7000, () => confetti.stop());
    this.time.delayedCall(14000, () => confetti.destroy());
    await wait(this, 4200);

    // silence… everyone looks at Rosa
    AudioManager.duck(0.0001, 2);
    cam.pan(this.rosa.x, this.rosa.y - 40, 1800, 'Sine.easeInOut');
    cam.zoomTo(0.85, 1800, 'Sine.easeInOut');
    this.lumi.anchor = { x: this.rosa.x - 190, y: this.rosa.y - 90 };
    await wait(this, 2600);

    AudioManager.duck(1, 1.2);
    this.particles.heart(this.rosa.x, this.rosa.y - 80, 14);
    await this.gratitude.thank('tlp');
    this.ui.setGratitudeCount(this.gratitude.count, true);
    await this.say([{ who: 'Rosa', text: '¡Gracias a vosotros! ¡Viva la Tenerife LanD Party!' }]);
    this.shout(5700, 1800, '¡¡ES LAN!!', '#7fe3ff');
    this.shout(6050, 1780, '¡¡ES LAN!!', '#7fe3ff', 250);
    this.shout(6400, 1800, '¡¡ES LAN!!', '#7fe3ff', 500);
    await wait(this, 900);
    this.corrected();
    await this.say([{ who: 'Rosa', text: 'Lo que sea. ¡Os quiero! ¡Votad delfín!' }]);
    // meanwhile, through the windows…
    cam.pan(this.rosa.x - 400, 560, 1600, 'Sine.easeInOut');
    await wait(this, 1700);
    await this.gratitude.showReality('tlp');
    cam.pan(this.rosa.x, this.rosa.y - 60, 1400, 'Sine.easeInOut');
    await wait(this, 1400);
    await this.say([
      { who: 'Lumi', text: 'Presidenta… el público estaba esperando al streamer xX_CalamarPro_Xx, que sale justo ahora.' },
      { who: 'Rosa', text: 'Ya, ya. Pero las gracias me las han dado a mí. ¿Lo has grabado todo para la campaña?' },
      { who: 'Lumi', text: 'Sí. Pero se ha ido la luz y no hay internet para subirlo.' },
    ]);
    this.save.completed = true;
    this.persist();
    const stats = {
      level: 'tlp' as const,
      time: this.save.playTime,
      thanks: this.gratitude.count,
      notes: 7,
      corrections: this.counter('corrections'),
      postureo: Math.max(100, this.counter('postureo')),
    };
    cam.fadeOut(1800, 2, 10, 26);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('UIScene');
      this.scene.start('EndingScene', stats);
    });
  }

  private restoreFinale(): void {
    this.finaleDone = true;
    const b = this.builder;
    b.generator.setVisible(true);
    b.screenLogo.setAlpha(1);
    b.screenGlow.setAlpha(0.4);
    b.stageBeams.forEach((s) => s.setAlpha(0.3));
    b.crowdLights.forEach((l) => l.setAlpha(0.8));
    AudioManager.setFullMode(true);
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

  // =========================================================== debug / QA

  private exposeDebug(): void {
    const w = window as unknown as { __ROSA__?: Record<string, unknown> };
    w.__ROSA__ = {
      ...(w.__ROSA__ ?? {}),
      scene: this,
      level: 'tlp',
      teleport: (x: number, y: number) => this.rosa.teleport(x, y),
      state: () => ({
        level: 'tlp',
        rosa: { x: Math.round(this.rosa.x), y: Math.round(this.rosa.y) },
        fragments: [...this.save.fragments],
        missions: [...this.save.missions],
        puzzles: [...this.save.puzzles],
        flags: { ...this.save.flags },
        counters: { ...this.save.counters },
        costumes: this.costumes.filter((c) => c.collected).map((c) => c.id),
        revealedCostumes: this.costumes.filter((c) => c.revealed).map((c) => c.id),
        gratitude: this.gratitude?.count ?? 0,
        dark: this.builder.dark,
        finaleDone: this.finaleDone,
        completed: this.save.completed,
        busy: this.busy,
        dialogue: this.ui?.dialogueActive,
        choice: this.ui?.choiceActive,
        rhythm: this.ui?.rhythmActive,
        puzzle: this.activePuzzle?.id ?? null,
        puzzleBusy: this.puzzleBusy,
        prompt: this.nearestInteractable()?.id ?? null,
        objective: this.objectives?.text,
        audio: AudioManager.ctx?.state ?? 'none',
      }),
      fragmentSpots: TLP_FRAGMENTS,
      costumeSpots: COSTUME_PIECES,
      spots: SPOTS,
    };
  }
}
