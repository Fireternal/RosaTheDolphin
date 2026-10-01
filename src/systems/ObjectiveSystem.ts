export interface ObjectivePresenter {
  showObjective(text: string, progress?: { cur: number; total: number }): void;
}

/** Keeps track of the current goal and tells the HUD whenever it changes. */
export class ObjectiveSystem {
  text = '';
  progress?: { cur: number; total: number };

  constructor(private presenter: ObjectivePresenter) {}

  set(text: string, progress?: { cur: number; total: number }): void {
    const changed = text !== this.text || progress?.cur !== this.progress?.cur;
    this.text = text;
    this.progress = progress;
    if (changed) this.presenter.showObjective(text, progress);
  }

  refresh(): void {
    this.presenter.showObjective(this.text, this.progress);
  }
}
