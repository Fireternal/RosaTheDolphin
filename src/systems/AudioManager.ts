import { NOTE_INFO, NoteName, noteMidi } from '../config';

/**
 * AudioManager — decoupled, procedural audio built on the Web Audio API.
 *
 * - Every instrument is synthesised (envelopes, harmonics, light reverb), so the
 *   game runs without any audio file.
 * - Real samples can be registered later with `loadSample()`; when a sample exists
 *   for an instrument it is used instead of the synth voice (pitch-shifted).
 * - The soundtrack is a layered step sequencer. Layers are switched on as the
 *   player finds melody fragments, so the music is literally built while playing.
 */

export type Instrument =
  | 'bell'
  | 'rosa'
  | 'piano'
  | 'strings'
  | 'harp'
  | 'flute'
  | 'pad'
  | 'bass'
  | 'choir'
  | 'chime';

export type LayerId =
  | 'base'
  | 'piano'
  | 'strings'
  | 'perc'
  | 'harp'
  | 'wind'
  | 'harmony'
  | 'melody'
  | 'choir'
  | 'chimes';

/** Fragment layers in the order they are unlocked (1st fragment -> piano ...). */
export const FRAGMENT_LAYERS: LayerId[] = ['piano', 'strings', 'perc', 'harp', 'wind', 'harmony', 'melody'];

const LAYER_GAIN: Record<LayerId, number> = {
  base: 0.6,
  piano: 0.42,
  strings: 0.3,
  perc: 0.42,
  harp: 0.3,
  wind: 0.3,
  harmony: 0.36,
  melody: 0.42,
  choir: 0.26,
  chimes: 0.3,
};

interface SampleEntry {
  buffer: AudioBuffer;
  rootMidi: number;
}

type ChordName = 'C' | 'Am' | 'F' | 'G' | 'Em' | 'Dm';

const CHORDS: Record<ChordName, { root: number; tones: number[] }> = {
  C: { root: 36, tones: [60, 64, 67, 71] },
  Am: { root: 45, tones: [57, 60, 64, 67] },
  F: { root: 41, tones: [57, 60, 65, 69] },
  G: { root: 43, tones: [55, 59, 62, 67] },
  Em: { root: 40, tones: [55, 59, 64, 67] },
  Dm: { root: 38, tones: [57, 62, 65, 69] },
};

/** 8 bars x 2 halves. Each half bar = 4 eighth-note steps. */
const PROGRESSION: ChordName[] = ['C', 'C', 'Am', 'Am', 'F', 'G', 'C', 'C', 'F', 'F', 'G', 'G', 'Em', 'Am', 'Dm', 'G'];
const LOOP_STEPS = PROGRESSION.length * 4; // 64 eighth notes

/** Main theme: SOL LA SOL MI FA RE DO, then an answering phrase. [step, midi, steps] */
const MELODY: [number, number, number][] = [
  [0, 79, 3], [3, 81, 1], [4, 79, 4],
  [8, 76, 8],
  [16, 77, 4], [20, 74, 4],
  [24, 72, 8],
  [32, 72, 2], [34, 74, 2], [36, 76, 4],
  [40, 74, 2], [42, 76, 2], [44, 79, 4],
  [48, 76, 2], [50, 79, 2], [52, 81, 4],
  [56, 77, 4], [60, 74, 4],
];

/** Wind counter-melody. */
const COUNTER: [number, number, number][] = [
  [0, 64, 6], [6, 62, 2],
  [8, 60, 8],
  [16, 69, 4], [20, 71, 4],
  [24, 72, 8],
  [32, 69, 4], [36, 72, 4],
  [40, 71, 4], [44, 74, 4],
  [48, 71, 4], [52, 72, 4],
  [56, 69, 4], [60, 67, 4],
];

/** Max simultaneous voices before background notes are skipped. */
const MAX_VOICES = 40;
/** Seconds of music scheduled ahead of time. */
const LOOKAHEAD = 0.4;

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class AudioManagerImpl {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private musicDuck!: GainNode;
  private sfxBus!: GainNode;
  private reverbSend!: GainNode;
  private noise!: AudioBuffer;
  private layerNodes = new Map<LayerId, GainNode>();
  private layerOn = new Map<LayerId, boolean>();
  private samples = new Map<Instrument, SampleEntry>();
  private schedulerId: number | null = null;
  private step = 0;
  private nextStepTime = 0;
  private tempo = 74;
  private notePool: NoteName[] = [];
  private melodyGain = 0.55;
  private waterGain: GainNode | null = null;
  /** End times of sounding voices, to keep the synth within a CPU budget. */
  private voiceEnds: number[] = [];
  private schedulingMusic = false;
  /** Optional song chosen by the player; replaces the procedural soundtrack. */
  /** Rosa's official theme (public/music), loaded at start-up. */
  private themeSong: { buffer: AudioBuffer; name: string } | null = null;
  /** A song chosen by the player overrides the theme. */
  private customSong: { buffer: AudioBuffer; name: string } | null = null;
  private themeRequested = false;

  private get song(): { buffer: AudioBuffer; name: string } | null {
    return this.customSong ?? this.themeSong;
  }
  private songSrc: AudioBufferSourceNode | null = null;
  private songFilter: BiquadFilterNode | null = null;
  private songGain: GainNode | null = null;
  private songLevel = 0;
  private songPreview = false;
  muted = false;
  fullMode = false;

  get ready(): boolean {
    return !!this.ctx;
  }

  /** Must be called from a user gesture (click / key). Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      // 'playback' asks the browser for larger audio buffers: fewer crackles when the game is busy
      this.ctx = new Ctor({ latencyHint: 'playback' });
      this.buildGraph();
      void this.loadTheme();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private buildGraph(): void {
    const ctx = this.ctx!;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 18;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    this.master.connect(comp).connect(ctx.destination);

    const reverb = ctx.createConvolver();
    reverb.buffer = this.makeImpulse(3.4, 2.4);
    const reverbOut = ctx.createGain();
    reverbOut.gain.value = 0.55;
    reverb.connect(reverbOut).connect(this.master);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 1;
    this.reverbSend.connect(reverb);

    this.musicDuck = ctx.createGain();
    this.musicDuck.gain.value = 1;
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.9;
    this.musicBus.connect(this.musicDuck);
    this.musicDuck.connect(this.master);
    const musicVerb = ctx.createGain();
    musicVerb.gain.value = 0.45;
    this.musicDuck.connect(musicVerb).connect(this.reverbSend);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);
    const sfxVerb = ctx.createGain();
    sfxVerb.gain.value = 0.5;
    this.sfxBus.connect(sfxVerb).connect(this.reverbSend);

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    const ids: LayerId[] = ['base', 'piano', 'strings', 'perc', 'harp', 'wind', 'harmony', 'melody', 'choir', 'chimes'];
    for (const id of ids) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.musicBus);
      this.layerNodes.set(id, g);
      this.layerOn.set(id, false);
    }
  }

  private makeImpulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // soft pre-delay + exponential tail, slightly darker over time
        const env = Math.pow(1 - t, decay) * (i < ctx.sampleRate * 0.012 ? i / (ctx.sampleRate * 0.012) : 1);
        ch[i] = (Math.random() * 2 - 1) * env * (0.6 + 0.4 * (1 - t));
      }
    }
    return buf;
  }

  // ---------------------------------------------------------------- samples

  /** Register a real audio sample for an instrument (optional, for future assets). */
  async loadSample(instrument: Instrument, url: string, rootMidi = 60): Promise<boolean> {
    if (!this.ctx) return false;
    try {
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      const buffer = await this.ctx.decodeAudioData(arr);
      this.samples.set(instrument, { buffer, rootMidi });
      return true;
    } catch {
      return false;
    }
  }

  private playSample(s: SampleEntry, dest: AudioNode, midi: number, t: number, dur: number, vel: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = s.buffer;
    src.playbackRate.value = mtof(midi) / mtof(s.rootMidi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.setTargetAtTime(0, t + dur, 0.4);
    src.connect(g).connect(dest);
    src.start(t);
    src.stop(t + dur + 3);
  }

  // ---------------------------------------------------------------- voices

  private env(param: AudioParam, t: number, a: number, peak: number, d: number, sus: number, dur: number, r: number): void {
    param.cancelScheduledValues(t);
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(peak, t + a);
    param.setTargetAtTime(Math.max(0.0001, sus), t + a, d / 3);
    param.setTargetAtTime(0.0001, t + Math.max(a, dur), r / 4);
  }

  private oscVoice(
    dest: AudioNode,
    type: OscillatorType,
    freq: number,
    t: number,
    stop: number,
    gain: number,
    detune = 0,
  ): OscillatorNode {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.value = gain;
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(stop);
    return o;
  }

  /** Plays one synthesised note on the given instrument. */
  voice(inst: Instrument, dest: AudioNode, midi: number, t: number, dur: number, vel: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const sample = this.samples.get(inst);
    // voice budget: background music notes are dropped (never SFX) when too many voices ring
    const now = ctx.currentTime;
    if (this.voiceEnds.length > 24) this.voiceEnds = this.voiceEnds.filter((e) => e > now);
    if (this.schedulingMusic && this.voiceEnds.length >= MAX_VOICES) return;
    this.voiceEnds.push(t + dur + 2.5);
    if (sample) return this.playSample(sample, dest, midi, t, dur, vel);
    const f = mtof(midi);
    const out = ctx.createGain();
    out.connect(dest);

    switch (inst) {
      case 'bell':
      case 'chime':
      case 'rosa': {
        const partials: [number, number][] =
          inst === 'chime'
            ? [[1, 1], [2.76, 0.25], [5.4, 0.08]]
            : [[1, 1], [2, 0.32], [3, 0.12], [4.07, 0.06], [6.1, 0.02]];
        const tail = inst === 'chime' ? 1.6 : 2.4;
        this.env(out.gain, t, 0.006, vel, 0.35, vel * 0.32, dur, tail);
        const stop = t + dur + tail + 0.5;
        for (const [m, a] of partials) {
          const g = ctx.createGain();
          g.gain.setValueAtTime(a, t);
          g.gain.setTargetAtTime(a * 0.3, t + 0.02, 0.25 / m);
          const o = ctx.createOscillator();
          o.type = 'sine';
          o.frequency.value = f * m;
          o.connect(g).connect(out);
          o.start(t);
          o.stop(stop);
        }
        if (inst === 'rosa') {
          // a breathy, singing component: Rosa "sings" her notes
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = f * 3;
          const sg = ctx.createGain();
          this.env(sg.gain, t, 0.08, 0.22, 0.4, 0.12, dur, 0.9);
          const o = ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.setValueAtTime(f * 0.985, t);
          o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
          const vib = ctx.createOscillator();
          vib.frequency.value = 5.2;
          const vg = ctx.createGain();
          vg.gain.value = f * 0.006;
          vib.connect(vg).connect(o.frequency);
          o.connect(lp).connect(sg).connect(out);
          o.start(t);
          vib.start(t);
          o.stop(stop);
          vib.stop(stop);
        }
        break;
      }
      case 'piano': {
        this.env(out.gain, t, 0.005, vel, 0.9, vel * 0.08, dur, 1.2);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(f * 8, t);
        lp.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.8);
        lp.connect(out);
        const stop = t + dur + 1.6;
        this.oscVoice(lp, 'triangle', f, t, stop, 0.8);
        this.oscVoice(lp, 'sine', f * 2, t, stop, 0.25, 3);
        this.oscVoice(lp, 'sine', f, t, stop, 0.4, -4);
        break;
      }
      case 'strings':
      case 'pad': {
        const isPad = inst === 'pad';
        const a = isPad ? 1.6 : 0.55;
        const r = isPad ? 2.6 : 1.4;
        this.env(out.gain, t, a, vel, 0.6, vel * 0.85, dur, r);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = isPad ? 900 : 2200;
        lp.Q.value = 0.6;
        lp.connect(out);
        const stop = t + dur + r + 0.5;
        const det = isPad ? 9 : 6;
        this.oscVoice(lp, 'sawtooth', f, t, stop, 0.33, -det);
        this.oscVoice(lp, 'sawtooth', f, t, stop, 0.33, det);
        if (isPad) this.oscVoice(lp, 'triangle', f / 2, t, stop, 0.3);
        else {
          const vib = ctx.createOscillator();
          vib.frequency.value = 5;
          const vg = ctx.createGain();
          vg.gain.value = 7;
          const o = this.oscVoice(lp, 'sawtooth', f * 1.001, t, stop, 0.2);
          vib.connect(vg).connect(o.detune);
          vib.start(t);
          vib.stop(stop);
        }
        break;
      }
      case 'harp': {
        this.env(out.gain, t, 0.004, vel, 0.5, vel * 0.15, dur, 1.4);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(f * 10, t);
        lp.frequency.exponentialRampToValueAtTime(f * 2, t + 0.4);
        lp.connect(out);
        const stop = t + dur + 1.8;
        this.oscVoice(lp, 'triangle', f, t, stop, 0.8);
        this.oscVoice(lp, 'sine', f * 2, t, stop, 0.2);
        break;
      }
      case 'flute': {
        this.env(out.gain, t, 0.12, vel, 0.3, vel * 0.8, dur, 0.5);
        const stop = t + dur + 0.9;
        const o = this.oscVoice(out, 'sine', f, t, stop, 0.85);
        this.oscVoice(out, 'sine', f * 2, t, stop, 0.12);
        const vib = ctx.createOscillator();
        vib.frequency.value = 5.4;
        const vg = ctx.createGain();
        vg.gain.setValueAtTime(0, t);
        vg.gain.linearRampToValueAtTime(9, t + 0.35);
        vib.connect(vg).connect(o.detune);
        vib.start(t);
        vib.stop(stop);
        const n = ctx.createBufferSource();
        n.buffer = this.noise;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = f * 2;
        bp.Q.value = 2;
        const ng = ctx.createGain();
        ng.gain.value = 0.05;
        n.connect(bp).connect(ng).connect(out);
        n.start(t);
        n.stop(stop);
        break;
      }
      case 'bass': {
        this.env(out.gain, t, 0.02, vel, 0.8, vel * 0.5, dur, 0.6);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 380;
        lp.connect(out);
        const stop = t + dur + 1;
        this.oscVoice(lp, 'sine', f, t, stop, 0.9);
        this.oscVoice(lp, 'triangle', f, t, stop, 0.3);
        break;
      }
      case 'choir': {
        this.env(out.gain, t, 0.9, vel, 0.8, vel * 0.9, dur, 2);
        const stop = t + dur + 2.6;
        const mix = ctx.createGain();
        mix.gain.value = 1;
        const formants: [number, number, number][] = [[700, 6, 1.1], [1150, 7, 0.7]];
        for (const [ff, q, a] of formants) {
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = ff;
          bp.Q.value = q;
          const fg = ctx.createGain();
          fg.gain.value = a * 2.2;
          mix.connect(bp).connect(fg).connect(out);
        }
        for (const det of [-10, 10]) this.oscVoice(mix, 'sawtooth', f, t, stop, 0.4, det);
        break;
      }
    }
  }

  // ---------------------------------------------------------------- sfx

  private now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** A musical note played by Rosa (keys 1-7, puzzles). */
  playNote(note: NoteName, opts: { octave?: number; vel?: number; dur?: number; inst?: Instrument; delay?: number } = {}): void {
    if (!this.ctx) return;
    const midi = noteMidi(note, opts.octave ?? 5);
    this.voice(opts.inst ?? 'rosa', this.sfxBus, midi, this.now() + (opts.delay ?? 0) + 0.01, opts.dur ?? 0.5, opts.vel ?? 0.55);
  }

  /** Plays an arbitrary MIDI note on an instrument through the SFX bus. */
  playMidi(inst: Instrument, midi: number, dur = 0.6, vel = 0.4, delay = 0): void {
    if (!this.ctx) return;
    this.voice(inst, this.sfxBus, midi, this.now() + 0.01 + delay, dur, vel);
  }

  /** Note pickup: the note itself plus a sparkling run. */
  collectNote(note: NoteName): void {
    if (!this.ctx) return;
    const t = this.now() + 0.01;
    const m = noteMidi(note, 5);
    this.voice('rosa', this.sfxBus, m, t, 0.6, 0.6);
    [12, 19, 24].forEach((iv, i) => this.voice('chime', this.sfxBus, m + iv, t + 0.09 * (i + 1), 0.2, 0.18));
  }

  /** Fragment pickup: a warm swell crowned by the fragment's note. */
  fragment(note: NoteName): void {
    if (!this.ctx) return;
    const t = this.now() + 0.01;
    const root = noteMidi(note, 4);
    [0, 4, 7, 11, 14].forEach((iv, i) => this.voice('harp', this.sfxBus, root + iv, t + i * 0.07, 0.4, 0.35));
    this.voice('strings', this.sfxBus, root - 12, t, 1.6, 0.18);
    this.voice('strings', this.sfxBus, root + 7, t, 1.6, 0.12);
    this.voice('bell', this.sfxBus, root + 12, t + 0.4, 1.2, 0.5);
    this.voice('chime', this.sfxBus, root + 24, t + 0.55, 0.6, 0.2);
  }

  sonar(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = this.now() + 0.01;
    // rising whale-like sweep
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(260, t);
    o.frequency.exponentialRampToValueAtTime(980, t + 0.35);
    o.frequency.exponentialRampToValueAtTime(700, t + 0.7);
    const g = ctx.createGain();
    this.env(g.gain, t, 0.04, 0.22, 0.3, 0.1, 0.4, 0.8);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 1.6);
    // echoing arpeggio of known notes (or a C triad)
    const pool: number[] = this.notePool.length
      ? this.notePool.map((n) => noteMidi(n, 6))
      : [84, 88, 91];
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.22;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const dg = ctx.createGain();
    dg.gain.value = 0.6;
    delay.connect(fb).connect(delay);
    delay.connect(dg).connect(this.sfxBus);
    const sorted = [...pool].sort((a, b) => a - b).slice(0, 4);
    sorted.forEach((m, i) => this.voice('chime', delay, m, t + 0.08 + i * 0.07, 0.15, 0.16));
    sorted.forEach((m, i) => this.voice('chime', this.sfxBus, m, t + 0.08 + i * 0.07, 0.15, 0.12));
    // soft whoosh
    this.noiseBurst(t, 0.6, 500, 2400, 0.06, 'bandpass');
  }

  private noiseBurst(t: number, dur: number, f0: number, f1: number, vol: number, type: BiquadFilterType = 'bandpass'): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f).connect(g).connect(this.sfxBus);
    n.start(t, Math.random());
    n.stop(t + dur + 0.05);
  }

  private blip(t: number, f0: number, f1: number, dur: number, vol: number): void {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  boost(): void {
    if (!this.ctx) return;
    const t = this.now() + 0.005;
    this.noiseBurst(t, 0.45, 300, 1600, 0.12);
    for (let i = 0; i < 4; i++) this.blip(t + 0.05 + i * 0.05 + Math.random() * 0.03, 500 + Math.random() * 300, 1300 + Math.random() * 500, 0.06, 0.04);
  }

  splash(big = false): void {
    if (!this.ctx) return;
    const t = this.now() + 0.005;
    this.noiseBurst(t, big ? 0.8 : 0.45, 3000, 400, big ? 0.22 : 0.12, 'lowpass');
    for (let i = 0; i < 5; i++) this.blip(t + 0.1 + i * 0.06, 400 + Math.random() * 400, 1200, 0.05, 0.03);
  }

  bubbles(): void {
    if (!this.ctx) return;
    const t = this.now();
    for (let i = 0; i < 3; i++) this.blip(t + i * 0.07, 600 + Math.random() * 400, 1400 + Math.random() * 300, 0.05, 0.03);
  }

  wrong(): void {
    if (!this.ctx) return;
    const t = this.now() + 0.01;
    // a gentle, warm "hmm" — never punishing
    this.voice('flute', this.sfxBus, 64, t, 0.22, 0.18);
    this.voice('flute', this.sfxBus, 62, t + 0.22, 0.4, 0.15);
  }

  success(): void {
    if (!this.ctx) return;
    const t = this.now() + 0.01;
    [72, 76, 79, 84, 88].forEach((m, i) => this.voice('bell', this.sfxBus, m, t + i * 0.09, 0.5, 0.35));
    [48, 55, 64, 67].forEach((m) => this.voice('strings', this.sfxBus, m, t, 2.2, 0.12));
  }

  rumble(dur = 1.6): void {
    if (!this.ctx) return;
    this.noiseBurst(this.now(), dur, 120, 60, 0.25, 'lowpass');
  }

  uiMove(): void {
    if (!this.ctx) return;
    this.voice('chime', this.sfxBus, 91, this.now() + 0.005, 0.08, 0.08);
  }

  uiSelect(): void {
    if (!this.ctx) return;
    const t = this.now() + 0.005;
    this.voice('bell', this.sfxBus, 79, t, 0.2, 0.22);
    this.voice('bell', this.sfxBus, 84, t + 0.08, 0.3, 0.2);
  }

  talk(): void {
    if (!this.ctx) return;
    const notes = [72, 74, 76, 79, 81];
    this.voice('chime', this.sfxBus, notes[Math.floor(Math.random() * notes.length)], this.now() + 0.005, 0.05, 0.05);
  }

  /** "Wah wah wah waaah": the problem is still there. */
  sadTrombone(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = this.now() + 0.05;
    const notes: [number, number, number][] = [[67, 0, 0.42], [66, 0.45, 0.42], [65, 0.9, 0.42], [64, 1.35, 1.3]];
    for (const [m, at, dur] of notes) {
      const t = t0 + at;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(m - 12);
      const vib = ctx.createOscillator();
      vib.frequency.value = dur > 1 ? 6 : 0.1;
      const vg = ctx.createGain();
      vg.gain.value = dur > 1 ? 4 : 0;
      vib.connect(vg).connect(o.frequency);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(500, t);
      lp.frequency.linearRampToValueAtTime(1300, t + 0.12);
      lp.frequency.linearRampToValueAtTime(700, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.05);
      g.gain.setTargetAtTime(0.0001, t + dur - 0.1, 0.08);
      o.connect(lp).connect(g).connect(this.sfxBus);
      o.start(t);
      vib.start(t);
      o.stop(t + dur + 0.4);
      vib.stop(t + dur + 0.4);
    }
  }

  /** Sparkling "twinkle" run for the rainbow celebration. */
  celebrate(): void {
    if (!this.ctx) return;
    const t = this.now() + 0.05;
    [84, 88, 91, 96, 100, 103].forEach((m, i) => this.voice('chime', this.sfxBus, m, t + i * 0.055, 0.15, 0.1));
  }

  /** The reward sound for being thanked. `grand` is reserved for the finale. */
  gratitude(grand = false): void {
    if (!this.ctx) return;
    const t = this.now() + 0.02;
    const chord = [60, 64, 67, 71, 74];
    chord.forEach((m) => this.voice('choir', this.sfxBus, m, t, grand ? 4 : 2.2, grand ? 0.13 : 0.08));
    chord.forEach((m, i) => this.voice('harp', this.sfxBus, m + 12, t + i * 0.08, 0.6, 0.25));
    this.voice('bell', this.sfxBus, 84, t + 0.5, 1.5, 0.35);
    if (grand) {
      this.voice('strings', this.sfxBus, 48, t, 4.5, 0.2);
      this.voice('strings', this.sfxBus, 55, t, 4.5, 0.16);
      [72, 76, 79, 84, 88, 91, 96].forEach((m, i) => this.voice('chime', this.sfxBus, m, t + 0.9 + i * 0.06, 0.4, 0.15));
    }
  }

  // ---------------------------------------------------------------- music

  /** True once Rosa's official theme is decoded and ready. */
  get hasTheme(): boolean {
    return !!this.themeSong;
  }

  get customSongName(): string | null {
    return this.customSong?.name ?? null;
  }

  /** Loads the official theme (OGG, or MP3 where OGG is not supported, e.g. Safari). */
  private async loadTheme(): Promise<void> {
    if (this.themeRequested || !this.ctx) return;
    this.themeRequested = true;
    const base = import.meta.env.BASE_URL;
    for (const file of ['music/rosa-theme.ogg', 'music/rosa-theme.mp3']) {
      try {
        const res = await fetch(base + file);
        if (!res.ok) continue;
        const buffer = await this.ctx.decodeAudioData(await res.arrayBuffer());
        this.themeSong = { buffer, name: 'Rosa the Dolphin — tema oficial' };
        if (!this.customSong) this.useSong();
        return;
      } catch {
        /* try the next format; if none works the procedural soundtrack keeps playing */
      }
    }
  }

  /** Switches from the procedural layers to the current song. */
  private useSong(): void {
    if (!this.ctx) return;
    for (const [id, node] of this.layerNodes) if (id !== 'base') node.gain.setTargetAtTime(0, this.ctx.currentTime, 0.6);
    if (this.schedulerId !== null) this.startSong();
  }

  /**
   * Uses the player's own song as background music. It starts muffled and quiet
   * and opens up with every fragment, so the "music grows as you play" idea holds.
   */
  async setCustomSong(data: ArrayBuffer, name: string): Promise<boolean> {
    if (!this.ctx) return false;
    try {
      const buffer = await this.ctx.decodeAudioData(data);
      this.customSong = { buffer, name };
      this.useSong();
      return true;
    } catch {
      return false;
    }
  }

  /** Menu / ending: let the player's song play in full. */
  setSongPreview(on: boolean): void {
    this.songPreview = on;
    this.applySongLevel(1.5);
  }

  /** Back to Rosa's official theme (or the procedural soundtrack if it could not load). */
  clearCustomSong(): void {
    this.stopSong();
    this.customSong = null;
    if (!this.ctx) return;
    if (this.themeSong) this.useSong();
    else for (const [id, on] of this.layerOn) if (on) this.setLayer(id, true, 1.5);
  }

  private startSong(): void {
    if (!this.ctx || !this.song) return;
    this.stopSong();
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.song.buffer;
    src.loop = true;
    this.songFilter = ctx.createBiquadFilter();
    this.songFilter.type = 'lowpass';
    this.songFilter.Q.value = 0.7;
    this.songGain = ctx.createGain();
    this.songGain.gain.value = 0.0001;
    src.connect(this.songFilter).connect(this.songGain).connect(this.musicBus);
    src.start();
    this.songSrc = src;
    this.applySongLevel(2.5);
  }

  private stopSong(): void {
    if (!this.songSrc || !this.ctx) return;
    const g = this.songGain!;
    const old = this.songSrc;
    g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.3);
    old.stop(this.ctx.currentTime + 1.5);
    this.songSrc = null;
  }

  private applySongLevel(fade = 2.5): void {
    if (!this.ctx || !this.songFilter || !this.songGain) return;
    // in the menu the song plays in full; in the level it starts softly muffled
    // (never below ~1.4 kHz, or phone speakers would make it inaudible) and opens up
    const n = this.fullMode || this.songPreview ? 8.5 : this.songLevel;
    const cutoff = Math.min(20000, 1400 * Math.pow(2, n * 0.56));
    const gain = this.fullMode || this.songPreview ? 0.9 : 0.6 + n * 0.04;
    const t = this.ctx.currentTime;
    this.songFilter.frequency.cancelScheduledValues(t);
    this.songFilter.frequency.setTargetAtTime(cutoff, t, fade / 3);
    this.songGain.gain.cancelScheduledValues(t);
    this.songGain.gain.setTargetAtTime(gain, t, fade / 3);
  }

  startMusic(): void {
    if (!this.ctx || this.schedulerId !== null) return;
    if (this.song) this.startSong();
    this.setLayer('base', true, 2);
    this.setLayer('chimes', true, 1);
    this.startWater();
    this.step = 0;
    this.nextStepTime = this.ctx.currentTime + 0.1;
    this.schedulerId = window.setInterval(() => this.tick(), 25);
  }

  private startWater(): void {
    if (!this.ctx || this.waterGain) return;
    const ctx = this.ctx;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'lowpass';
    bp.frequency.value = 420;
    bp.Q.value = 0.8;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lg = ctx.createGain();
    lg.gain.value = 220;
    lfo.connect(lg).connect(bp.frequency);
    this.waterGain = ctx.createGain();
    this.waterGain.gain.value = 0.0001;
    this.waterGain.gain.setTargetAtTime(0.09, ctx.currentTime, 1.5);
    n.connect(bp).connect(this.waterGain).connect(this.master);
    n.start();
    lfo.start();
  }

  private setLayer(id: LayerId, on: boolean, fade = 2.5): void {
    if (!this.ctx) return;
    const node = this.layerNodes.get(id);
    if (!node) return;
    this.layerOn.set(id, on);
    const target = on && (!this.song || id === 'base') ? (id === 'melody' ? this.melodyGain : LAYER_GAIN[id]) : 0;
    node.gain.cancelScheduledValues(this.ctx.currentTime);
    node.gain.setTargetAtTime(Math.max(0, target), this.ctx.currentTime, fade / 3);
  }

  /** Number of fragment layers active (0..7). */
  setLayerCount(n: number, fade = 3): void {
    FRAGMENT_LAYERS.forEach((id, i) => this.setLayer(id, i < n, fade));
    this.songLevel = n;
    this.applySongLevel(fade);
  }

  setNotePool(notes: NoteName[]): void {
    this.notePool = [...notes];
  }

  /** The complete version of the composition: everything plays, melody in front, choir on top. */
  setFullMode(on: boolean): void {
    this.fullMode = on;
    this.melodyGain = on ? 0.62 : 0.42;
    this.setLayerCount(on ? 7 : this.countFragmentLayers(), 2);
    this.setLayer('choir', on, 4);
    this.applySongLevel(2);
  }

  private countFragmentLayers(): number {
    return FRAGMENT_LAYERS.filter((id) => this.layerOn.get(id)).length;
  }

  /** Smoothly lower (or restore) all music — used for the finale's moment of silence. */
  duck(level: number, seconds: number): void {
    if (!this.ctx) return;
    const g = this.musicDuck.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setTargetAtTime(Math.max(0.0001, level), this.ctx.currentTime, Math.max(0.01, seconds / 3));
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.85, this.ctx.currentTime, 0.1);
    return this.muted;
  }

  private tick(): void {
    if (!this.ctx) return;
    const stepDur = 60 / this.tempo / 2;
    const now = this.ctx.currentTime;
    // if the page stalled, silently skip the steps already in the past but keep the beat grid
    while (this.nextStepTime < now - 0.01) {
      this.nextStepTime += stepDur;
      this.step++;
    }
    // generous look-ahead so heavy frames (the finale) never starve the audio
    this.schedulingMusic = true;
    while (this.nextStepTime < now + LOOKAHEAD) {
      this.scheduleStep(this.step % LOOP_STEPS, this.nextStepTime, stepDur);
      this.nextStepTime += stepDur;
      this.step++;
    }
    this.schedulingMusic = false;
  }

  private on(id: LayerId): boolean {
    return this.layerOn.get(id) === true;
  }

  private scheduleStep(s: number, t: number, sd: number): void {
    if (this.song) return; // the player's song is playing instead
    const half = Math.floor(s / 4);
    const chordName = PROGRESSION[half];
    const chord = CHORDS[chordName];
    const prevName = PROGRESSION[(half + PROGRESSION.length - 1) % PROGRESSION.length];
    const chordStart = s % 4 === 0 && (prevName !== chordName || s % 8 === 0);
    let runHalves = 1;
    while (half + runHalves < PROGRESSION.length && PROGRESSION[half + runHalves] === chordName && (s + runHalves * 4) % 8 !== 0) runHalves++;
    const chordDur = runHalves * 4 * sd;
    const L = this.layerNodes;

    if (this.on('base') && chordStart && !this.fullMode) {
      for (const m of chord.tones.slice(0, 3)) this.voice('pad', L.get('base')!, m - 12, t, chordDur, 0.14);
    }
    if (this.on('base') && Math.random() < 0.05) {
      const tt = t + Math.random() * sd;
      this.blipTo(L.get('base')!, tt, 500 + Math.random() * 500, 1300, 0.05, 0.05);
    }
    if (this.on('piano') && [0, 3, 6].includes(s % 8)) {
      const idx = (s % 8) / 3 + (Math.floor(s / 8) % 2);
      this.voice('piano', L.get('piano')!, chord.tones[idx % chord.tones.length] + 12, t, sd * 2, 0.32);
    }
    if (this.on('strings') && chordStart) {
      this.voice('strings', L.get('strings')!, chord.root + 12, t, chordDur, 0.2);
      this.voice('strings', L.get('strings')!, chord.tones[1], t, chordDur, 0.14);
      this.voice('strings', L.get('strings')!, chord.tones[2], t, chordDur, 0.12);
    }
    if (this.on('perc')) {
      const p = L.get('perc')!;
      if (s % 8 === 0) this.kick(p, t, 0.55);
      if (s % 8 === 5) this.kick(p, t, 0.25);
      if (s % 2 === 1) this.shaker(p, t, s % 4 === 3 ? 0.07 : 0.04);
    }
    if (this.on('harp')) {
      const tones = [...chord.tones, ...chord.tones.map((m) => m + 12)];
      const order = [0, 1, 2, 3, 4, 3, 2, 1];
      this.voice('harp', L.get('harp')!, tones[order[s % 8]], t, sd, 0.22);
    }
    if (this.on('wind')) {
      for (const [st, m, len] of COUNTER) if (st === s) this.voice('flute', L.get('wind')!, m, t, len * sd * 0.92, 0.2);
    }
    if (this.on('harmony')) {
      if (chordStart) this.voice('bass', L.get('harmony')!, chord.root, t, chordDur * 0.9, 0.5);
      if (s % 4 === 2) this.voice('bass', L.get('harmony')!, chord.root + 12, t, sd, 0.2);
      if (chordStart) this.voice('pad', L.get('harmony')!, chord.tones[3] + 12, t, chordDur, 0.06);
    }
    if (this.on('melody')) {
      for (const [st, m, len] of MELODY) if (st === s) {
        this.voice('bell', L.get('melody')!, m, t, len * sd * 0.9, 0.28);
        if (this.fullMode) this.voice('flute', L.get('melody')!, m - 12, t, len * sd * 0.95, 0.12);
      }
    }
    if (this.on('choir') && chordStart) {
      for (const m of chord.tones.slice(0, 3)) this.voice('choir', L.get('choir')!, m, t, chordDur, 0.1);
    }
    if (this.on('chimes') && this.notePool.length && s % 2 === 0) {
      const p = 0.03 + this.notePool.length * 0.018;
      if (Math.random() < p) {
        const n = this.notePool[Math.floor(Math.random() * this.notePool.length)];
        this.voice('chime', L.get('chimes')!, noteMidi(n, 6), t, 0.2, 0.09);
      }
    }
  }

  private blipTo(dest: AudioNode, t: number, f0: number, f1: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private kick(dest: AudioNode, t: number, vol: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.45);
  }

  private shaker(dest: AudioNode, t: number, vol: number): void {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    n.connect(hp).connect(g).connect(dest);
    n.start(t, Math.random() * 1.5);
    n.stop(t + 0.08);
  }

  /** Color helper so other systems can stay audio-agnostic. */
  noteColor(n: NoteName): number {
    return NOTE_INFO[n].color;
  }
}

export const AudioManager = new AudioManagerImpl();
