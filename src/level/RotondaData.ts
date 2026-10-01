import type { NoteName } from '../config';

/**
 * Level 1 — LA ROTONDA SUMERGIDA.
 * All world-space geometry lives here so art, physics and gameplay agree.
 * y grows downward. The sea surface is y = 0; the sky is above it.
 */

export const WORLD = { w: 6400, top: -760, bottom: 2900, surface: 0 };

export const RING = { cx: 3200, cy: 1450, rx: 1250, ry: 290, deck: 120, thickness: 62 };

export const GARDEN = { cx: 3200, cy: 2628, rx: 600, ry: 96 };
export const STATUE = { x: 3200, baseY: 2640, pedestalH: 250 };

export const LEFT_RAMP = { x0: 950, y0: 2420, x1: RING.cx - RING.rx + 40, y1: RING.cy + 10 };
export const RIGHT_RAMP = { x0: RING.cx + RING.rx - 40, y0: RING.cy + 10, x1: 5150, y1: 1250 };
export const PLATFORM = { x0: 5150, x1: 5800, y: 1250 };

export const TOWER = { x0: 5850, x1: 6200, top: 250, bottom: 1100, wall: 50 };
/** The water current inside the tower shaft. */
export const CURRENT = { x: 5900, y: 640, w: 250, h: 700 };
/** Invisible "wall of current" that blocks the shaft until the organ is played. */
export const CURRENT_BARRIER = { x: 5900, y: 600, w: 250, h: 44 };

export const GROTTO = {
  ceiling: { x: 5250, y: 1880, w: 1150, h: 140 },
  gate: { x: 5250, y: 2010, w: 92, h: 900 },
};

export interface Rect { x: number; y: number; w: number; h: number }

/** Static solid geometry (circle-vs-rect collisions). */
export const STATIC_COLLIDERS: Rect[] = [
  { x: TOWER.x0, y: TOWER.top, w: TOWER.wall, h: TOWER.bottom - TOWER.top },
  { x: TOWER.x1 - TOWER.wall, y: TOWER.top, w: TOWER.wall, h: TOWER.bottom - TOWER.top },
  { x: TOWER.x0, y: TOWER.top, w: TOWER.x1 - TOWER.x0, h: 50 },
  GROTTO.ceiling,
];

/** Seabed profile (x, y). Interpolated linearly. */
export const FLOOR_POINTS: [number, number][] = [
  [-200, 2560], [0, 2580], [300, 2640], [700, 2700], [1100, 2690], [1500, 2710],
  [1900, 2750], [2300, 2790], [2550, 2830], [2800, 2770], [3200, 2745], [3600, 2760],
  [4000, 2750], [4400, 2740], [4800, 2730], [5150, 2770], [5500, 2790], [5900, 2800],
  [6200, 2780], [6600, 2700],
];

export function floorAt(x: number): number {
  const p = FLOOR_POINTS;
  if (x <= p[0][0]) return p[0][1];
  for (let i = 0; i < p.length - 1; i++) {
    const [x0, y0] = p[i];
    const [x1, y1] = p[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0);
      // smoothstep between points for gentle dunes
      const s = t * t * (3 - 2 * t);
      return y0 + (y1 - y0) * s;
    }
  }
  return p[p.length - 1][1];
}

export const ROSA_START = { x: 330, y: 1250 };
export const LUMI_START = { x: 820, y: 1320 };

export interface NoteSpot { note: NoteName; x: number; y: number; hidden?: boolean }

/** Seven loose notes that build Rosa's playable repertoire. All are freely reachable. */
export const NOTE_SPOTS: NoteSpot[] = [
  { note: 'DO', x: 980, y: 1010 },
  { note: 'RE', x: 1820, y: 1500 },
  { note: 'MI', x: 640, y: 2440, hidden: true },
  { note: 'FA', x: 2880, y: 1060 },
  { note: 'SOL', x: 4720, y: 2380 },
  { note: 'LA', x: 4360, y: 380 },
  { note: 'SI', x: 4990, y: 1640, hidden: true },
];

/** The final melody. Fragment slot i holds FINAL_MELODY[i]. */
export const FINAL_MELODY: NoteName[] = ['SOL', 'LA', 'SOL', 'MI', 'FA', 'RE', 'DO'];

export type FragmentKind = 'explore' | 'hidden' | 'sonar' | 'creature' | 'puzzle' | 'leap';

export interface FragmentSpot {
  id: string;
  slot: number;
  x: number;
  y: number;
  kind: FragmentKind;
  /** Fragments that only appear after some event. */
  spawnsOn?: string;
}

export const FRAGMENT_SPOTS: FragmentSpot[] = [
  { id: 'f-claro', slot: 0, x: 1560, y: 1180, kind: 'explore' },
  { id: 'f-rampa', slot: 1, x: 1290, y: 2590, kind: 'hidden' },
  { id: 'f-almeja', slot: 2, x: 2550, y: 2690, kind: 'sonar', spawnsOn: 'clam-open' },
  { id: 'f-marea', slot: 3, x: 4050, y: 2380, kind: 'creature', spawnsOn: 'mission:bruno' },
  { id: 'f-gruta', slot: 4, x: 5900, y: 2480, kind: 'puzzle' },
  { id: 'f-torre', slot: 5, x: 6025, y: 440, kind: 'puzzle' },
  { id: 'f-ola', slot: 6, x: 3700, y: -235, kind: 'leap' },
];

export const CLAM = { x: 2550, y: 2812 };
export const CONCH = { x: 5050, y: 2730 };
export const ORGAN = { x: 5560, y: PLATFORM.y };
export const MAREA_HOME = { x: 4060, y: 2470 };
export const BRUNO_HIDE = { x: 1720, y: 230 };
export const STATUE_PUZZLE = { x: STATUE.x, y: 2240 };

export const PUZZLES = {
  gate: ['SOL', 'MI', 'DO', 'RE'] as NoteName[],
  organ: ['MI', 'SOL', 'LA', 'SI'] as NoteName[],
};
