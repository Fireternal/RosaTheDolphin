import type { NoteName } from '../config';

export type SequenceResult = 'progress' | 'wrong' | 'complete';

/** A melody the player must reproduce. Stateless rules + a small input cursor. */
export class MusicSequence {
  private cursor = 0;

  constructor(readonly notes: NoteName[]) {}

  get length(): number {
    return this.notes.length;
  }

  get progress(): number {
    return this.cursor;
  }

  reset(): void {
    this.cursor = 0;
  }

  input(note: NoteName): SequenceResult {
    if (this.notes[this.cursor] !== note) {
      this.cursor = 0;
      return 'wrong';
    }
    this.cursor++;
    if (this.cursor >= this.notes.length) {
      this.cursor = 0;
      return 'complete';
    }
    return 'progress';
  }

  /** Notes the player still needs in their repertoire to attempt this melody. */
  missing(known: NoteName[]): NoteName[] {
    return [...new Set(this.notes.filter((n) => !known.includes(n)))];
  }
}
