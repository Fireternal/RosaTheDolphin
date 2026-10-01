/** Global constants shared across scenes and systems. */

export const GAME_W = 1920;
export const GAME_H = 1080;

export const FONT_TITLE = 'Georgia, "Palatino Linotype", "Book Antiqua", "Times New Roman", serif';
export const FONT_UI = '"Trebuchet MS", "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif';

export type NoteName = 'DO' | 'RE' | 'MI' | 'FA' | 'SOL' | 'LA' | 'SI';

export const NOTE_ORDER: NoteName[] = ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI'];

export interface NoteInfo {
  semitone: number;
  color: number;
  css: string;
}

/** Each note has its own colour so the player can "see" music. */
export const NOTE_INFO: Record<NoteName, NoteInfo> = {
  DO: { semitone: 0, color: 0xff8a9a, css: '#ff8a9a' },
  RE: { semitone: 2, color: 0xffb066, css: '#ffb066' },
  MI: { semitone: 4, color: 0xffdf6a, css: '#ffdf6a' },
  FA: { semitone: 5, color: 0x9be88f, css: '#9be88f' },
  SOL: { semitone: 7, color: 0x6fe6d6, css: '#6fe6d6' },
  LA: { semitone: 9, color: 0x7fbcff, css: '#7fbcff' },
  SI: { semitone: 11, color: 0xc49bff, css: '#c49bff' },
};

/** MIDI number for a note name. Octave 4 => C4 = 60. */
export function noteMidi(note: NoteName, octave = 5): number {
  return 12 * (octave + 1) + NOTE_INFO[note].semitone;
}

export const GOLD = 0xf6cf6b;
export const GOLD_CSS = '#f6cf6b';
export const WARM_CSS = '#ffe7b0';

/** Depth (z-order) layers. */
export const DEPTH = {
  BG: 0,
  SKY: 1,
  RAYS: 3,
  FAR: 4,
  FAR2: 6,
  MID_BACK: 10,
  MID: 14,
  MID_FRONT: 18,
  CORAL_MID: 20,
  FLOOR: 25,
  FLOOR_DECOR: 27,
  ITEMS: 34,
  CREATURES: 36,
  HAIR_BACK: 39,
  ROSA: 40,
  HAIR_FRONT: 41,
  FX: 45,
  SONAR: 50,
  SURFACE: 58,
  FOREGROUND: 72,
  FG_FX: 76,
} as const;

/** Instrument revealed by each collected fragment (in collection order). */
export const LAYER_NAMES = [
  'Piano',
  'Cuerdas',
  'Percusión suave',
  'Arpa',
  'Viento',
  'Armonía',
  'Melodía principal',
];
