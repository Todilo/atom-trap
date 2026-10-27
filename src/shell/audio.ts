import type { GameEvent } from '../sim/simulation';

/**
 * All sound is synthesised at runtime with the Web Audio API (ADR-0008): synthwave-style effects per
 * game event and a generated ambient loop. There are no audio files to license, download or cache.
 * The audio context only starts after the player's first tap or click (audio unlock).
 */
export interface AudioSettings {
  music: boolean;
  sfx: boolean;
  /** 0 to 1, from the Settings sliders. */
  musicVolume: number;
  sfxVolume: number;
}

/** Full-volume levels of the two buses; the sliders scale them. */
const MUSIC_LEVEL = 0.55;
const SFX_LEVEL = 0.9;

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

interface Chord {
  root: number;
  notes: [number, number, number];
}

/** Chords in A minor (MIDI notes: bass root and a three-note voicing). */
const Am: Chord = { root: 45, notes: [57, 60, 64] };
const F: Chord = { root: 41, notes: [53, 57, 60] };
const C: Chord = { root: 48, notes: [52, 55, 60] };
const G: Chord = { root: 43, notes: [55, 59, 62] };
const Dm: Chord = { root: 38, notes: [57, 62, 65] };
const Em: Chord = { root: 40, notes: [55, 59, 64] };
const E: Chord = { root: 40, notes: [56, 59, 64] };

/**
 * One section of the song: 8 bars of chords plus how each part plays over them.
 * `arp` lists chord-note indexes per eighth note (-1 = rest); `bass` is the bass step interval in sixteenths.
 */
interface Section {
  chords: Chord[];
  arp: number[];
  arpOctave: number;
  bass: number;
  pad: boolean;
  lead: boolean;
}

/** About 77 s (32 bars) before it repeats, moving between four moods instead of one 4-bar loop. */
const SONG: Section[] = [
  { chords: [Am, F, C, G, Am, F, C, G], arp: [0, 1, 2, 1, 0, 2, 1, 2], arpOctave: 12, bass: 4, pad: true, lead: false },
  { chords: [F, G, Am, Am, F, G, C, E], arp: [0, 1, 2, 0, 1, 2, 0, 2], arpOctave: 12, bass: 2, pad: true, lead: false },
  { chords: [Dm, Am, F, G, Dm, Am, Em, E], arp: [2, -1, -1, 1, -1, -1, 0, -1], arpOctave: 24, bass: 16, pad: true, lead: true },
  { chords: [Am, F, C, G, Am, F, G, E], arp: [0, 2, 1, 2, 0, 2, 1, 0], arpOctave: 12, bass: 2, pad: true, lead: true },
];
const BAR_STEPS = 16;
const SONG_STEPS = SONG.reduce((n, s) => n + s.chords.length * BAR_STEPS, 0);
const BPM = 100;
const SIXTEENTH = 60 / BPM / 4;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private echo!: GainNode;
  private noise!: AudioBuffer;
  private hum: { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private musicTimer: number | null = null;
  private nextStepTime = 0;
  private step = 0;

  constructor(readonly settings: AudioSettings) {}

  /** Call from a user gesture: creates or resumes the audio context and starts the music. */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.buildGraph(this.ctx);
    }
    void this.ctx.resume();
    if (this.settings.music) this.startMusic();
  }

  suspend(): void {
    void this.ctx?.suspend();
  }

  resume(): void {
    void this.ctx?.resume();
  }

  setMusic(on: boolean): void {
    this.settings.music = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  setSfx(on: boolean): void {
    this.settings.sfx = on;
    if (!on) this.setGrowing(0);
  }

  setMusicVolume(v: number): void {
    this.settings.musicVolume = v;
    if (this.ctx && this.settings.music) this.musicBus.gain.setTargetAtTime(MUSIC_LEVEL * v, this.ctx.currentTime, 0.05);
  }

  setSfxVolume(v: number): void {
    this.settings.sfxVolume = v;
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(SFX_LEVEL * v, this.ctx.currentTime, 0.05);
  }

  /** Hum while wall halves grow; pitch rises with the wall's length. 0 = silent. */
  setGrowing(length: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.hum) return;
    const on = length > 0 && this.settings.sfx;
    const t = ctx.currentTime;
    this.hum.gain.gain.setTargetAtTime(on ? 0.05 : 0, t, 0.03);
    if (on) {
      this.hum.osc.frequency.setTargetAtTime(110 + length * 6, t, 0.05);
      this.hum.filter.frequency.setTargetAtTime(500 + length * 40, t, 0.05);
    }
  }

  event(e: GameEvent): void {
    if (!this.ctx || !this.settings.sfx) return;
    switch (e.type) {
      case 'wall-started':
        return this.tone({ freq: 440, to: 880, dur: 0.08, type: 'square', vol: 0.06 });
      case 'wall-completed':
        this.tone({ freq: 160, to: 70, dur: 0.18, type: 'sine', vol: 0.35 });
        return this.tone({ freq: 1320, dur: 0.25, type: 'triangle', vol: 0.08, delay: 0.02 });
      case 'cells-removed':
        return this.whoosh(Math.min(1, 0.35 + e.count / 200));
      case 'wall-broken':
        // A soft shatter: muted noise, a few glassy pings and a low thud (no harsh high crack).
        this.burst(0.14, 0.1, 1800);
        [1760, 1397, 1047].forEach((f, i) => this.tone({ freq: f, to: f * 0.8, dur: 0.16, type: 'triangle', vol: 0.035, delay: 0.02 + i * 0.035 }));
        return this.tone({ freq: 90, to: 45, dur: 0.3, type: 'sine', vol: 0.3 });
      case 'life-lost':
        return this.tone({ freq: 330, to: 165, dur: 0.4, type: 'sawtooth', vol: 0.07, delay: 0.08, filter: 1200 });
      case 'time-warning':
        for (let i = 0; i < 3; i++) this.tone({ freq: 988, dur: 0.09, type: 'square', vol: 0.06, delay: i * 0.18 });
        return;
      case 'level-cleared':
        [69, 72, 76, 81, 84].forEach((n, i) => this.tone({ freq: midi(n), dur: 0.35, type: 'triangle', vol: 0.12, delay: i * 0.09 }));
        return;
      case 'game-over':
        [64, 60, 57, 52].forEach((n, i) => this.tone({ freq: midi(n), dur: 0.5, type: 'sawtooth', vol: 0.06, delay: i * 0.22, filter: 900 }));
        return;
      // Arcade (ADR-0018).
      case 'chain':
        // Each step up the chain plays a higher note, so a long chain climbs.
        if (e.count > 1) this.tone({ freq: midi(70 + Math.min(e.count, 10) * 2), dur: 0.14, type: 'square', vol: 0.05, filter: 3500 });
        return;
      case 'atom-captured':
        // An implosion: a falling sweep and a thump, then a bright chime.
        this.tone({ freq: 900, to: 60, dur: 0.35, type: 'sawtooth', vol: 0.08, filter: 2000 });
        this.tone({ freq: 70, to: 40, dur: 0.3, type: 'sine', vol: 0.35, delay: 0.12 });
        [84, 91, 96].forEach((n, i) => this.tone({ freq: midi(n), dur: 0.3, type: 'triangle', vol: 0.09, delay: 0.2 + i * 0.06 }));
        return;
      case 'big-catch':
        [72, 79, 84].forEach((n, i) => this.tone({ freq: midi(n), dur: 0.4, type: 'triangle', vol: 0.1, delay: 0.12 + i * 0.07 }));
        return;
    }
  }

  private buildGraph(ctx: AudioContext): void {
    const master = ctx.createDynamicsCompressor();
    master.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = SFX_LEVEL * this.settings.sfxVolume;
    this.sfxBus.connect(master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0;
    this.musicBus.connect(master);

    // Feedback echo for the music's arpeggio: the synthwave shimmer.
    const delay = ctx.createDelay(1);
    delay.delayTime.value = SIXTEENTH * 3;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.35;
    this.echo = ctx.createGain();
    this.echo.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(this.musicBus);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter).connect(gain).connect(this.sfxBus);
    osc.start();
    this.hum = { osc, gain, filter };
  }

  private tone(o: { freq: number; to?: number; dur: number; type: OscillatorType; vol: number; delay?: number; filter?: number; bus?: AudioNode }): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(o.vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node: AudioNode = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.filter;
      node = node.connect(f);
    }
    node.connect(gain).connect(o.bus ?? this.sfxBus);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  /** Filtered-noise sweep for an area filling in. */
  private whoosh(strength: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(3500, t + 0.45);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25 * strength, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    src.connect(f).connect(gain).connect(this.sfxBus);
    src.start(t);
    src.stop(t + 0.6);
  }

  /** Short band-limited noise burst around `freq`. */
  private burst(dur: number, vol: number, freq: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(gain).connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  private startMusic(): void {
    const ctx = this.ctx;
    if (!ctx || this.musicTimer !== null) return;
    this.musicBus.gain.setTargetAtTime(MUSIC_LEVEL * this.settings.musicVolume, ctx.currentTime, 0.8);
    this.nextStepTime = ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 100);
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
  }

  /** Look-ahead scheduler: queues the next ~0.4 s of the loop each tick. */
  private scheduleMusic(): void {
    const ctx = this.ctx!;
    if (ctx.state !== 'running') return;
    if (this.nextStepTime < ctx.currentTime) this.nextStepTime = ctx.currentTime + 0.05;
    while (this.nextStepTime < ctx.currentTime + 0.4) {
      this.musicStep(this.step, this.nextStepTime);
      this.step = (this.step + 1) % SONG_STEPS;
      this.nextStepTime += SIXTEENTH;
    }
  }

  private musicStep(step: number, t: number): void {
    const ctx = this.ctx!;
    let bar = Math.floor(step / BAR_STEPS);
    let section = SONG[0];
    for (const s of SONG) {
      if (bar < s.chords.length) {
        section = s;
        break;
      }
      bar -= s.chords.length;
    }
    const chord = section.chords[bar];
    const inBar = step % BAR_STEPS;
    const voice = (freq: number, type: OscillatorType, start: number, attack: number, hold: number, release: number, vol: number, cutoff: number, out: AudioNode, detune = 0) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(vol, start + attack);
      g.gain.setValueAtTime(vol, start + attack + hold);
      g.gain.linearRampToValueAtTime(0, start + attack + hold + release);
      osc.connect(f).connect(g).connect(out);
      osc.start(start);
      osc.stop(start + attack + hold + release + 0.05);
    };
    const barLength = SIXTEENTH * BAR_STEPS;
    if (inBar === 0 && section.pad) {
      // Pad: detuned saws, slow attack, held for the bar.
      for (const n of chord.notes) {
        voice(midi(n), 'sawtooth', t, 0.6, barLength - 0.6, 0.9, 0.022, 900, this.musicBus, -8);
        voice(midi(n), 'sawtooth', t, 0.6, barLength - 0.6, 0.9, 0.022, 900, this.musicBus, 8);
      }
    }
    if (inBar % section.bass === 0) {
      const hold = Math.min(section.bass, 4) * SIXTEENTH;
      voice(midi(chord.root), 'sine', t, 0.01, hold * 0.6, 0.25, 0.16, 400, this.musicBus);
    }
    if (inBar % 2 === 0) {
      const idx = section.arp[(inBar / 2) % section.arp.length];
      if (idx >= 0) {
        const note = chord.notes[idx] + section.arpOctave;
        voice(midi(note), 'triangle', t, 0.005, 0.03, 0.12, 0.05, 3000, this.musicBus);
        voice(midi(note), 'triangle', t, 0.005, 0.03, 0.12, 0.03, 3000, this.echo);
      }
    }
    // Lead: a slow melody over the chord tones, alternating its shape every other bar.
    if (section.lead && (inBar === 0 || inBar === 6 || inBar === 10)) {
      const shape = bar % 2 === 0 ? [2, 1, 0] : [1, 2, 2];
      const note = chord.notes[shape[inBar === 0 ? 0 : inBar === 6 ? 1 : 2]] + 12;
      const hold = inBar === 0 ? SIXTEENTH * 5 : SIXTEENTH * 3;
      voice(midi(note), 'square', t, 0.03, hold, 0.4, 0.025, 1800, this.musicBus);
      voice(midi(note), 'square', t, 0.03, hold, 0.4, 0.018, 1800, this.echo);
    }
  }
}
