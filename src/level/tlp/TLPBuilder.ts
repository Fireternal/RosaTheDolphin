import Phaser from 'phaser';
import { DEPTH } from '../../config';
import { COSTUME_PIECES, SPOTS, TW } from './TLPData';

const ADD = Phaser.BlendModes.ADD;
const NEON = [0xff3fd0, 0x3fd8ff, 0x8a5bff, 0x3fff9f, 0xffb13f];

/** Builds the flooded Recinto Ferial and owns the things that change (lights, screens, people). */
export class TLPBuilder {
  city!: Phaser.GameObjects.TileSprite;
  cityOff!: Phaser.GameObjects.TileSprite;
  beams: Phaser.GameObjects.Image[] = [];
  monitorGlows: Phaser.GameObjects.Image[] = [];
  signGlows: Phaser.GameObjects.Image[] = [];
  blackout!: Phaser.GameObjects.Rectangle;
  emergency: Phaser.GameObjects.Image[] = [];
  phoneLights: Phaser.GameObjects.Image[] = [];
  crowdLights: Phaser.GameObjects.Image[] = [];
  stageBeams: Phaser.GameObjects.Image[] = [];
  screenText!: Phaser.GameObjects.Image;
  screenLogo!: Phaser.GameObjects.Image;
  screenGlow!: Phaser.GameObjects.Image;
  generator!: Phaser.GameObjects.Image;
  rack!: Phaser.GameObjects.Image;
  rackGlow!: Phaser.GameObjects.Image;
  diploma!: Phaser.GameObjects.Image;
  people: Record<string, Phaser.GameObjects.Image> = {};
  costumes: Record<string, Phaser.GameObjects.Image> = {};
  dancers: Phaser.GameObjects.Image[] = [];
  gamers: Phaser.GameObjects.Image[] = [];
  /** 0 = lights on, 1 = full blackout. */
  dark = 0;
  /** Set when the dancers dance with Rosa. */
  party = false;
  private t = 0;

  constructor(private scene: Phaser.Scene) {}

  build(): void {
    const s = this.scene;
    const W = TW.w;
    // back wall + windows on the city
    s.add.tileSprite(W / 2, (390 + TW.floor) / 2, W, TW.floor - 390, 'tlp_wall').setDepth(DEPTH.BG);
    this.city = s.add.tileSprite(W / 2, 245, W, 300, 'tlp_city').setDepth(DEPTH.SKY);
    this.cityOff = s.add.tileSprite(W / 2, 245, W, 300, 'tlp_city_off').setDepth(DEPTH.SKY).setAlpha(0);
    s.add.tileSprite(W / 2, 245, W, 300, 'tlp_window').setDepth(DEPTH.FAR);
    s.add.tileSprite(W / 2, 48, W, 96, 'tlp_truss').setDepth(DEPTH.MID_BACK);
    s.add.tileSprite(W / 2, 430, W, 96, 'tlp_truss').setDepth(DEPTH.MID_BACK);
    s.add.tileSprite(W / 2, TW.floor + 70, W, 160, 'tlp_floor').setDepth(DEPTH.FLOOR);
    s.add.rectangle(W / 2, TW.floor + 150 + 250, W, 500, 0x101119).setDepth(DEPTH.FLOOR);

    // coloured stage lights hanging from the truss
    for (let x = 300; x < W; x += 520) {
      s.add.image(x, 480, 'tlp_spot').setDepth(DEPTH.MID_BACK + 1);
      const beam = s.add.image(x, 505, 'ray').setOrigin(0.5, 0).setScale(0.9, 1.45).setTint(NEON[(x / 520) % NEON.length | 0])
        .setBlendMode(ADD).setAlpha(0.16).setDepth(DEPTH.FAR2);
      beam.setData('phase', x * 0.01);
      this.beams.push(beam);
    }

    // ---- entrance
    s.add.image(SPOTS.banner.x, SPOTS.banner.y, 'tlp_banner_main').setDepth(DEPTH.MID);
    for (const x of [130, 1150]) s.add.rectangle(x, (735 + TW.floor) / 2, 26, TW.floor - 735, 0x3a3d4c).setDepth(DEPTH.MID - 1);
    s.add.image(SPOTS.bannerCD.x, SPOTS.bannerCD.y, 'tlp_banner_cd').setDepth(DEPTH.MID);
    s.add.image(330, 1560, 'tlp_poster').setDepth(DEPTH.MID).setAngle(-3);
    this.person('organizer', SPOTS.organizer.x, SPOTS.organizer.y);

    // ---- LAN zone: a mezzanine and a floor row of desks full of gamers
    s.add.image(2060, 930, 'tlp_sign_lan').setScale(0.85).setDepth(DEPTH.MID);
    for (const x of [SPOTS.deckX0 + 60, 2060, SPOTS.deckX1 - 60]) s.add.image(x, SPOTS.deckY + 20, 'tlp_scaffold').setOrigin(0.5, 0).setScale(1, (TW.floor - SPOTS.deckY - 20) / 520).setDepth(DEPTH.MID_BACK);
    s.add.tileSprite((SPOTS.deckX0 + SPOTS.deckX1) / 2, SPOTS.deckY + 20, SPOTS.deckX1 - SPOTS.deckX0, 40, 'tlp_deck').setDepth(DEPTH.MID + 1);
    for (const row of [SPOTS.deckY, TW.floor]) {
      SPOTS.tables.forEach((tx, i) => {
        s.add.image(tx, row, 'tlp_table').setOrigin(0.5, 1).setDepth(DEPTH.MID);
        for (let m = 0; m < 3; m++) {
          const g = s.add.image(tx - 172 + m * 172, row - 230 + 52, 'glow').setScale(1.0, 0.6).setTint(NEON[(i + m) % NEON.length])
            .setBlendMode(ADD).setAlpha(0.35).setDepth(DEPTH.MID + 0.5);
          this.monitorGlows.push(g);
          const skip = row === SPOTS.deckY && i === 2 && m === 2; // Kevin's seat
          if (!skip) {
            const gm = s.add.image(tx - 172 + m * 172, row + 6, `tlp_gamer_${(i * 3 + m + (row === TW.floor ? 1 : 0)) % 4}`).setOrigin(0.5, 1).setDepth(DEPTH.MID_FRONT);
            gm.setData('phase', Math.random() * 10);
            this.gamers.push(gm);
          }
        }
      });
    }
    this.person('telepera', SPOTS.telepera.x, SPOTS.telepera.y);
    this.person('telepero', SPOTS.telepero.x, SPOTS.telepero.y);
    this.person('kevin', SPOTS.kevin.x, SPOTS.kevin.y);
    this.rack = s.add.image(SPOTS.router.x, SPOTS.router.y, 'tlp_rack').setOrigin(0.5, 1).setDepth(DEPTH.MID);
    this.rackGlow = s.add.image(SPOTS.router.x, SPOTS.router.y - 280, 'glow').setTint(0x3fff9f).setScale(1.8, 3).setBlendMode(ADD).setAlpha(0.25).setDepth(DEPTH.MID + 0.5);
    // the cable bundle that feeds the whole hall
    const cables = s.add.graphics().setDepth(DEPTH.MID - 1);
    NEON.forEach((c, i) => {
      cables.lineStyle(6, c, 0.7);
      const x = SPOTS.router.x - 60 + i * 30;
      cables.beginPath();
      cables.moveTo(x, SPOTS.router.y - 540);
      cables.lineTo(x + Math.sin(i) * 20, 470);
      cables.strokePath();
    });

    // ---- Summer-Con
    s.add.image(SPOTS.cosStage.x, 1330, 'tlp_sign_summer').setScale(0.85).setDepth(DEPTH.MID);
    s.add.image(SPOTS.cosStage.x, SPOTS.cosStage.y, 'tlp_cosstage').setOrigin(0.5, 1).setDepth(DEPTH.MID);
    (['cos_knight', 'cos_magic', 'cos_robot'] as const).forEach((k, i) => this.person(k, SPOTS.cosplayers[i], SPOTS.cosStage.y - 178));
    this.person('judge', SPOTS.judge.x, SPOTS.judge.y, DEPTH.MID);
    s.add.image(SPOTS.judges.x, SPOTS.judges.y, 'tlp_judges').setOrigin(0.5, 1).setDepth(DEPTH.MID + 1);
    this.diploma = s.add.image(0, 0, 'tlp_diploma').setScale(0.5).setDepth(DEPTH.FX).setVisible(false);
    for (const p of COSTUME_PIECES) {
      this.costumes[p.id] = s.add.image(p.x, p.y, p.key).setDepth(DEPTH.ITEMS).setAlpha(0);
    }

    // ---- K-Pop
    s.add.image(SPOTS.danceFloor.x, 1340, 'tlp_sign_kpop').setScale(0.85).setDepth(DEPTH.MID);
    s.add.image(SPOTS.danceFloor.x, SPOTS.danceFloor.y + 6, 'tlp_dancefloor').setOrigin(0.5, 1).setDepth(DEPTH.MID);
    (['dancer_0', 'dancer_1', 'dancer_2'] as const).forEach((k, i) => this.dancers.push(this.person(k, SPOTS.dancers[i], SPOTS.danceFloor.y - 40)));
    s.add.image(SPOTS.boombox.x, SPOTS.boombox.y, 'tlp_boombox').setOrigin(0.5, 1).setDepth(DEPTH.MID + 1);
    this.person('fan_0', 4060, TW.floor);

    // ---- TLP Innova
    s.add.image(SPOTS.innovaScreen.x, 880, 'tlp_sign_innova').setScale(0.85).setDepth(DEPTH.MID);
    s.add.image(SPOTS.innovaScreen.x, SPOTS.innovaScreen.y, 'tlp_innova_screen').setDepth(DEPTH.MID);
    this.signGlows.push(s.add.image(SPOTS.innovaScreen.x, SPOTS.innovaScreen.y, 'glow').setTint(0x3fff9f).setScale(3.4, 2).setBlendMode(ADD).setAlpha(0.18).setDepth(DEPTH.MID - 0.5));
    s.add.image(SPOTS.podium.x, SPOTS.podium.y, 'tlp_podium').setOrigin(0.5, 1).setDepth(DEPTH.MID + 1);
    this.person('moderator', SPOTS.moderator.x, SPOTS.moderator.y);
    s.add.image(5080, TW.floor + 120, 'tlp_chairs').setOrigin(0.5, 1).setScale(1.3).setDepth(DEPTH.FOREGROUND).setAlpha(0.95);

    // ---- main stage
    s.add.image(SPOTS.stage.x, SPOTS.stage.y, 'tlp_stage').setOrigin(0.5, 1).setDepth(DEPTH.MID);
    s.add.image(SPOTS.screen.x, SPOTS.screen.y, 'tlp_screen_frame').setDepth(DEPTH.MID);
    this.screenText = s.add.image(SPOTS.screen.x, SPOTS.screen.y, 'tlp_screen_text').setDepth(DEPTH.MID + 0.2);
    this.screenLogo = s.add.image(SPOTS.screen.x, SPOTS.screen.y, 'tlp_screen_logo').setDepth(DEPTH.MID + 0.3).setAlpha(0);
    this.screenGlow = s.add.image(SPOTS.screen.x, SPOTS.screen.y, 'glow').setTint(0x6fa8ff).setScale(6, 3.6).setBlendMode(ADD).setAlpha(0.18).setDepth(DEPTH.MID - 0.5);
    for (const x of [5540, 6520]) s.add.image(x, SPOTS.stageTop, 'tlp_speaker').setOrigin(0.5, 1).setDepth(DEPTH.MID + 1);
    s.add.image(SPOTS.mic.x, SPOTS.mic.y, 'tlp_mic').setOrigin(0.5, 1).setDepth(DEPTH.MID + 1).setScale(0.8);
    this.generator = s.add.image(SPOTS.generator.x, SPOTS.generator.y, 'tlp_generator').setOrigin(0.5, 1).setDepth(DEPTH.MID + 1).setVisible(false);
    for (let i = 0; i < 6; i++) {
      const x = 5560 + i * 190;
      const b = s.add.image(x, 500, 'ray').setOrigin(0.5, 0).setScale(0.8, 1.1).setTint(NEON[i % NEON.length]).setBlendMode(ADD).setAlpha(0).setDepth(DEPTH.MID + 2);
      b.setData('phase', i);
      this.stageBeams.push(b);
    }
    s.add.image(6020, TW.bottom + 30, 'tlp_crowd').setOrigin(0.5, 1).setDepth(DEPTH.FOREGROUND).setAlpha(0.96);
    for (let i = 0; i < 26; i++) {
      const l = s.add.image(5420 + i * 50 + Math.random() * 20, 1900 + Math.random() * 60, 'glow').setTint(0xdff3ff).setScale(0.12).setBlendMode(ADD)
        .setAlpha(0).setDepth(DEPTH.FOREGROUND + 1);
      this.crowdLights.push(l);
    }

    // ---- emergency lighting (only visible during the blackout)
    for (const x of [1000, 2500, 3900, 5300, 6500]) {
      s.add.image(x, 520, 'tlp_beacon').setDepth(DEPTH.MID_BACK + 1);
      const g = s.add.image(x, 520, 'glow').setTint(0xff3030).setScale(1.6).setBlendMode(ADD).setAlpha(0).setDepth(DEPTH.FOREGROUND + 3);
      g.setData('beacon', true);
      this.emergency.push(g);
    }
    // gamers light their faces with their phones in the dark
    for (const g of this.gamers) {
      const l = s.add.image(g.x + 14, g.y - 120, 'glow').setTint(0xcfe8ff).setScale(0.35).setBlendMode(ADD).setAlpha(0).setDepth(DEPTH.FOREGROUND + 3);
      this.phoneLights.push(l);
    }
    // the hall's darkness (screen-fixed) and the flooded water tint
    this.blackout = s.add.rectangle(960, 540, 6000, 4000, 0x02030c, 0).setScrollFactor(0).setDepth(DEPTH.FOREGROUND + 2);
    s.add.rectangle(960, 540, 6000, 4000, 0x1a6ad0, 0.1).setScrollFactor(0).setDepth(DEPTH.FOREGROUND + 1.5);
  }

  private person(key: string, x: number, y: number, depth: number = DEPTH.CREATURES - 4): Phaser.GameObjects.Image {
    const img = this.scene.add.image(x, y, `tlp_${key}`).setOrigin(0.5, 1).setDepth(depth);
    img.setData('baseY', y).setData('phase', Math.random() * 10);
    this.people[key] = img;
    return img;
  }

  /** Lights out: network down and the whole city dark. */
  setDark(v: number): void {
    this.dark = v;
    const on = 1 - v;
    this.cityOff.setAlpha(v);
    this.city.setAlpha(on);
    this.blackout.fillAlpha = 0.58 * v;
    this.monitorGlows.forEach((g) => g.setAlpha(0.35 * on));
    this.signGlows.forEach((g) => g.setAlpha(0.18 * on));
    this.rackGlow.setTint(v > 0.5 ? 0xff3030 : 0x3fff9f);
    if (v < 1) this.beams.forEach((b) => b.setAlpha(0.16 * on));
    this.screenText.setAlpha(on);
    this.screenGlow.setAlpha(0.18 * on);
  }

  update(dt: number, cam: Phaser.Cameras.Scene2D.Camera): void {
    this.t += dt;
    const t = this.t;
    // parallax: the city moves slower than the hall
    this.city.tilePositionX = cam.scrollX * -0.25;
    this.cityOff.tilePositionX = this.city.tilePositionX;
    const on = 1 - this.dark;
    for (const b of this.beams) b.setRotation(Math.sin(t * 0.5 + b.getData('phase')) * 0.35).setAlpha(0.16 * on);
    for (const b of this.stageBeams) b.setRotation(Math.sin(t * 1.3 + b.getData('phase')) * 0.5);
    for (const [k, p] of Object.entries(this.people)) {
      const base = p.getData('baseY') as number;
      const ph = p.getData('phase') as number;
      if (k.startsWith('dancer')) {
        const speed = this.party ? 9 : 4.5;
        p.setY(base - Math.abs(Math.sin(t * speed + ph)) * (this.party ? 34 : 14));
        p.setRotation(Math.sin(t * speed * 0.5 + ph) * 0.12);
      } else {
        p.setY(base + Math.sin(t * 1.4 + ph) * 3);
      }
    }
    if (this.dark > 0) {
      for (const g of this.emergency) {
        const beacon = g.getData('beacon');
        g.setAlpha(beacon ? (Math.sin(t * 6) > 0.2 ? 0.75 * this.dark : 0.1 * this.dark) : 0.5 * this.dark);
      }
      this.phoneLights.forEach((l, i) => l.setAlpha((0.45 + Math.sin(t * 2 + i) * 0.1) * this.dark));
    }
    this.crowdLights.forEach((l, i) => {
      if (l.alpha > 0.01) l.setY(1900 + Math.sin(t * 2 + i) * 20 + (i % 3) * 20);
    });
    this.rackGlow.setAlpha(0.18 + Math.sin(t * (this.dark > 0.5 ? 8 : 3)) * 0.08);
  }
}
