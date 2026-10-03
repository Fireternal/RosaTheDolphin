import type { NoteName } from '../../config';
import type { FragmentSpot } from '../RotondaData';

/**
 * Melodía II — La Tenerife LanD Party.
 * The Recinto Ferial, flooded by order of the president (and paid with her subsidy).
 * Left to right: entrance → LAN zone → Summer-Con → K-Pop → TLP Innova → main stage.
 */
export const TW = { w: 6700, top: 0, bottom: 2100, floor: 1960, minY: 330 };

export const tlpFloorAt = (): number => TW.floor;

export const TLP_START = { x: 330, y: 1350 };
export const TLP_LUMI_START = { x: 120, y: 1150 };

/** The melody Rosa plays on the main stage. */
export const TLP_FINAL: NoteName[] = ['MI', 'SOL', 'LA', 'SOL', 'MI', 'RE', 'DO'];

export const TLP_PUZZLES = {
  /** "Random play dance" chorus. */
  kpop: ['SOL', 'SOL', 'LA', 'SOL', 'MI', 'RE'] as NoteName[],
  /** "To lower the ping, a descending scale." It lowers far more than the ping. */
  router: ['SI', 'LA', 'SOL', 'FA', 'MI', 'RE', 'DO'] as NoteName[],
};

export const TLP_FRAGMENTS: FragmentSpot[] = [
  { id: 't-entrada', slot: 0, x: 1250, y: 520, kind: 'explore' },
  { id: 't-cable', slot: 1, x: 2130, y: 1900, kind: 'hidden' },
  { id: 't-gg', slot: 2, x: 2420, y: 1060, kind: 'creature', spawnsOn: 'gg' },
  { id: 't-cosplay', slot: 3, x: 3700, y: 1480, kind: 'creature', spawnsOn: 'cosplay' },
  { id: 't-kpop', slot: 4, x: 4420, y: 1480, kind: 'puzzle', spawnsOn: 'kpop' },
  { id: 't-innova', slot: 5, x: 5080, y: 1480, kind: 'creature', spawnsOn: 'innova' },
  { id: 't-apagon', slot: 6, x: 2900, y: 1220, kind: 'puzzle', spawnsOn: 'router' },
];

/** Where things are. */
export const SPOTS = {
  banner: { x: 640, y: 640 },
  bannerCD: { x: 640, y: 1010 },
  organizer: { x: 880, y: TW.floor },
  deckY: 1300,
  deckX0: 1190,
  deckX1: 2780,
  tables: [1600, 2140, 2680],
  telepera: { x: 1250, y: TW.floor },
  telepero: { x: 1255, y: 1300 },
  kevin: { x: 2420, y: 1300 },
  router: { x: 2900, y: TW.floor },
  judges: { x: 3200, y: TW.floor },
  judge: { x: 3200, y: 1880 },
  cosStage: { x: 3720, y: TW.floor },
  cosplayers: [3460, 3720, 3960],
  danceFloor: { x: 4440, y: TW.floor },
  dancers: [4300, 4460, 4620],
  boombox: { x: 4150, y: TW.floor },
  innovaScreen: { x: 5080, y: 1180 },
  podium: { x: 5080, y: TW.floor },
  moderator: { x: 4880, y: TW.floor },
  stage: { x: 6030, y: TW.floor },
  stageTop: 1566,
  screen: { x: 6030, y: 1010 },
  mic: { x: 6030, y: 1566 },
  generator: { x: 6280, y: 1566 },
};

/** Costume pieces for the Summer-Con (hidden: the sonar reveals them). */
export const COSTUME_PIECES = [
  { id: 'crown', key: 'tlp_crown', name: 'la corona', x: 1850, y: 760 },
  { id: 'cape', key: 'tlp_cape', name: 'la capa', x: 3420, y: 880 },
  { id: 'trident', key: 'tlp_trident', name: 'el tridente', x: 4720, y: 1860 },
];
