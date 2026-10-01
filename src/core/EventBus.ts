import Phaser from 'phaser';

/** Small global event bus for decoupled scene/system communication. */
export const bus = new Phaser.Events.EventEmitter();

export const EV = {
  NOTE_INPUT: 'note-input',
  MUTE_CHANGED: 'mute-changed',
} as const;
