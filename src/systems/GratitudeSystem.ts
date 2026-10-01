import type { NoteName } from '../config';
import type { SaveData } from './SaveManager';
import { AudioManager } from './AudioManager';

/**
 * GratitudeSystem — the narrative progression of ROSA THE DOLPHIN.
 *
 * Every musical mission describes who needs help, what is wrong, which melody
 * fixes it, how the world transforms, and — most importantly — who thanks Rosa
 * and with which words. Being thanked is the real reward, so each thank-you is
 * recorded in the save and presented with care by the UI.
 *
 * Future levels only need to `register()` new missions and call `thank()`.
 */

export type GratitudeTone = 'small' | 'warm' | 'grand';

export interface GratitudeMission {
  id: string;
  /** Who needs help. */
  helper: string;
  /** What problem they have. */
  problem: string;
  /** Melody that solves it (if any). */
  melody?: NoteName[];
  /** Description / id of the world transformation. */
  transformation: string;
  /** Who thanks Rosa. */
  thanker: string;
  /** The thank-you itself. */
  message: string;
  /** Extra lines shown after the thank-you. */
  followUps?: string[];
  tone: GratitudeTone;
}

export interface GratitudePresenter {
  showGratitude(m: GratitudeMission): Promise<void>;
}

export class GratitudeSystem {
  private missions = new Map<string, GratitudeMission>();

  constructor(
    private save: SaveData,
    private presenter: GratitudePresenter,
    private persist: () => void,
  ) {}

  register(...missions: GratitudeMission[]): void {
    for (const m of missions) this.missions.set(m.id, m);
  }

  get(id: string): GratitudeMission | undefined {
    return this.missions.get(id);
  }

  isDone(id: string): boolean {
    return this.save.missions.includes(id);
  }

  /** Number of thank-yous Rosa has received. */
  get count(): number {
    return this.save.gratitude.length;
  }

  /** Marks the mission complete without presenting it (used when loading a save). */
  markDone(id: string): void {
    if (!this.save.missions.includes(id)) this.save.missions.push(id);
  }

  /** Completes a mission and presents its thank-you. Resolves when the moment is over. */
  async thank(id: string): Promise<void> {
    const m = this.missions.get(id);
    if (!m || this.isDone(id)) return;
    this.save.missions.push(id);
    this.save.gratitude.push({ missionId: id, by: m.thanker, message: m.message });
    this.persist();
    AudioManager.gratitude(m.tone === 'grand');
    await this.presenter.showGratitude(m);
  }
}
