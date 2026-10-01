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
}

const KEY = 'rosa-the-dolphin/save/v1';

class SaveManagerImpl {
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
    };
  }

  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(KEY);
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
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* storage may be unavailable (private mode) — the game still works */
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
}

export const SaveManager = new SaveManagerImpl();
