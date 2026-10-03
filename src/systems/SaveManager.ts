import type { NoteName } from '../config';

export interface GratitudeRecord {
  missionId: string;
  by: string;
  message: string;
}

export interface SaveData {
  version: 1;
  notes: NoteName[];
  fragments: string[];
  /** Order in which fragments were collected (drives music layers). */
  fragmentOrder: string[];
  puzzles: string[];
  missions: string[];
  flags: Record<string, boolean>;
  rosa?: { x: number; y: number };
  completed: boolean;
  playTime: number;
  gratitude: GratitudeRecord[];
  /** Running tallies (e.g. how many times Rosa was corrected). */
  counters: Record<string, number>;
}

export type LevelId = 'rotonda' | 'tlp';
const LAST_KEY = 'rosa-the-dolphin/last-level';

class SaveManagerImpl {
  constructor(private readonly key: string, readonly level: LevelId) {}

  fresh(): SaveData {
    return {
      version: 1,
      notes: [],
      fragments: [],
      fragmentOrder: [],
      puzzles: [],
      missions: [],
      flags: {},
      completed: false,
      playTime: 0,
      gratitude: [],
      counters: {},
    };
  }

  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      const data = JSON.parse(raw) as SaveData;
      if (data.version !== 1) return null;
      return { ...this.fresh(), ...data };
    } catch {
      return null;
    }
  }

  hasSave(): boolean {
    return this.load() !== null;
  }

  save(data: SaveData): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
      localStorage.setItem(LAST_KEY, this.level);
    } catch {
      /* storage may be unavailable (private mode) — the game still works */
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.key);
    } catch {
      /* ignore */
    }
  }
}

/** Melodía I — La Rotonda Sumergida. */
export const SaveManager = new SaveManagerImpl('rosa-the-dolphin/save/v1', 'rotonda');
/** Melodía II — La Tenerife LanD Party. */
export const TLPSave = new SaveManagerImpl('rosa-the-dolphin/save/tlp/v1', 'tlp');

/** The level the player saved last (for CONTINUAR), if it still has a save. */
export function lastSavedLevel(): LevelId | null {
  let last: string | null = null;
  try {
    last = localStorage.getItem(LAST_KEY);
  } catch {
    /* ignore */
  }
  if (last === 'tlp' && TLPSave.hasSave()) return 'tlp';
  if (SaveManager.hasSave()) return 'rotonda';
  return TLPSave.hasSave() ? 'tlp' : null;
}
