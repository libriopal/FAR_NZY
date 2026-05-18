// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Web Audio API synthesizer — ASMR Edition + Adaptive Emotional Conductor
//   • All SFX: softer gains, sine/triangle only, long releases, chorus warmth
//   • Conductor: 4 emotional profiles ("training data") — calm/melancholic/tense/euphoric
//     Responds to game state via setMusicState(); schedules notes with lookahead clock
// ─────────────────────────────────────────────────────

let _ar = (typeof crypto !== 'undefined' ? crypto.getRandomValues(new Uint32Array(1))[0]! : 0xdeadbeef) || 0xdeadbeef;
const aRng = () => { _ar ^= _ar << 13; _ar ^= _ar >>> 17; _ar ^= _ar << 5; return (_ar >>> 0) / 4294967296; };

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let droneOsc: OscillatorNode | null = null;
let droneGain: GainNode | null = null;
let analyserNode: AnalyserNode | null = null;
let sfxEnabled = true;
let ambientEnabled = true;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.7;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -6;
    compressor.knee.value = 3;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.1;
    analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 512;
    analyserNode.smoothingTimeConstant = 0.85;
    masterGain.connect(compressor);
    compressor.connect(analyserNode);
    analyserNode.connect(ctx.destination);
  }
  return ctx;
}

function sfxGain(value = 0.4): GainNode {
  const ac = getCtx();
  const g = ac.createGain();
  g.gain.value = value;
  g.connect(masterGain!);
  return g;
}

function scheduleEnvelope(
  gain: GainNode,
  attackMs: number,
  sustainMs: number,
  releaseMs: number,
  peak = 1,
) {
  const ac = getCtx();
  const now = ac.currentTime;
  const a = attackMs / 1000;
  const s = sustainMs / 1000;
  const r = releaseMs / 1000;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + a);
  gain.gain.setValueAtTime(peak, now + a + s);
  gain.gain.linearRampToValueAtTime(0, now + a + s + r);
}

export function setMasterVolume(v: number) {
  getCtx();
  if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, v));
}

export function setSfxEnabled(v: boolean) { sfxEnabled = v; }
export function setAmbientEnabled(v: boolean) {
  ambientEnabled = v;
  if (!v) {
    stopAmbientDrone();
    stopHeroJourneyTheme();
  }
}

export function resumeCtx() {
  if (ctx?.state === 'suspended') void ctx.resume();
}

let _detunePhase = 0;
function jitter(range = 6): number {
  _detunePhase = (_detunePhase + 1) % 7;
  return (_detunePhase - 3) * (range / 3);
}

// ── ASMR SFX ─────────────────────────────────────────────────────────────────

export function playChainAdd(chainLen: number) {
  if (!sfxEnabled) return;
  const ac = getCtx();
  const freq = 280 + chainLen * 45;
  const dur = 0.58;

  // Primary sine tone
  const osc = ac.createOscillator();
  const g = sfxGain(0.10);
  osc.type = 'sine';
  osc.frequency.value = freq;
  osc.detune.value = jitter(6);
  osc.connect(g);
  osc.start();
  scheduleEnvelope(g, 18, 40, 260, 0.10);
  osc.stop(ac.currentTime + dur);

  // Chorus ghost — detuned twin for warmth
  const osc2 = ac.createOscillator();
  const g2 = sfxGain(0.05);
  osc2.type = 'sine';
  osc2.frequency.value = freq;
  osc2.detune.value = jitter(6) + 10;
  osc2.connect(g2);
  osc2.start();
  scheduleEnvelope(g2, 24, 38, 290, 0.05);
  osc2.stop(ac.currentTime + dur);
}

export function playChainCommit(pts: number) {
  if (!sfxEnabled) return;
  const ac = getCtx();
  const osc = ac.createOscillator();
  const g = sfxGain(0.15);
  osc.type = 'sine';
  osc.frequency.value = Math.min(1100, 440 + pts * 0.06);
  osc.connect(g);
  osc.start();
  scheduleEnvelope(g, 20, 80, 520, 0.15);
  osc.stop(ac.currentTime + 0.68);
}

export function playFarkle() {
  if (!sfxEnabled) return;
  const ac = getCtx();
  // Soft descending sine — gentle "woosh down", no harsh sawtooth
  const osc = ac.createOscillator();
  const g = sfxGain(0.18);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(310, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(110, ac.currentTime + 0.65);
  osc.connect(g);
  osc.start();
  scheduleEnvelope(g, 12, 100, 720, 0.18);
  osc.stop(ac.currentTime + 0.90);
}

export function playBank(pts: number) {
  if (!sfxEnabled) return;
  const ac = getCtx();
  [523, 659, 784].forEach((freq, i) => {
    const osc = ac.createOscillator();
    const g = sfxGain(0.12);
    osc.type = 'sine';
    osc.frequency.value = freq + Math.min(pts * 0.015, 160);
    osc.connect(g);
    const delay = i * 0.11;
    osc.start(ac.currentTime + delay);
    g.gain.setValueAtTime(0, ac.currentTime + delay);
    g.gain.linearRampToValueAtTime(0.12, ac.currentTime + delay + 0.025);
    g.gain.linearRampToValueAtTime(0, ac.currentTime + delay + 0.62);
    osc.stop(ac.currentTime + delay + 0.68);
  });
}

export function playSphereHit() {
  if (!sfxEnabled) return;
  const ac = getCtx();
  const osc = ac.createOscillator();
  const g = sfxGain(0.12);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(660, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(330, ac.currentTime + 0.20);
  osc.connect(g);
  osc.start();
  scheduleEnvelope(g, 5, 40, 360, 0.12);
  osc.stop(ac.currentTime + 0.44);
}

export function playBombBlast(rainbow = false) {
  if (!sfxEnabled) return;
  const ac = getCtx();
  const buf = ac.createBuffer(1, ac.sampleRate * 0.65, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (aRng() * 2 - 1) * Math.pow(1 - i / data.length, 1.6);
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const g = sfxGain(rainbow ? 0.32 : 0.22);
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = rainbow ? 1600 : 550;
  filter.Q.value = 1.5;
  src.connect(filter);
  filter.connect(g);
  src.start();
  scheduleEnvelope(g, 6, 60, 520, rainbow ? 0.32 : 0.22);
}

export function playBombCollapse(rainbow = false) {
  if (!sfxEnabled) return;
  const ac = getCtx();

  // Bass drop — triangle (ASMR-smooth vs old sawtooth)
  const bassOsc = ac.createOscillator();
  const bassGain = sfxGain(0.28);
  bassOsc.type = 'triangle';
  bassOsc.frequency.setValueAtTime(rainbow ? 88 : 55, ac.currentTime);
  bassOsc.frequency.exponentialRampToValueAtTime(18, ac.currentTime + 1.1);
  bassOsc.connect(bassGain);
  bassOsc.start();
  scheduleEnvelope(bassGain, 8, 100, 950, 0.28);
  bassOsc.stop(ac.currentTime + 1.25);

  // Soft low-pass noise burst
  const noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.9, ac.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) {
    nd[i] = (aRng() * 2 - 1) * Math.exp(-i / (nd.length * 0.22));
  }
  const noiseSrc = ac.createBufferSource();
  noiseSrc.buffer = noiseBuf;
  const nFilter = ac.createBiquadFilter();
  nFilter.type = 'lowpass';
  nFilter.frequency.value = rainbow ? 700 : 350;
  nFilter.Q.value = 2.5;
  const noiseGain = sfxGain(0.16);
  noiseSrc.connect(nFilter);
  nFilter.connect(noiseGain);
  noiseSrc.start();
  scheduleEnvelope(noiseGain, 3, 80, 750, 0.16);

  // Sub sine thud
  const subOsc = ac.createOscillator();
  const subGain = sfxGain(0.20);
  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(rainbow ? 72 : 48, ac.currentTime);
  subOsc.frequency.exponentialRampToValueAtTime(18, ac.currentTime + 0.42);
  subOsc.connect(subGain);
  subOsc.start();
  scheduleEnvelope(subGain, 5, 30, 420, 0.20);
  subOsc.stop(ac.currentTime + 0.52);
}

let _lastImpactAt = 0;
export function playCollisionImpact(magnitude: number) {
  if (!sfxEnabled || magnitude < 0.05) return;
  const now = performance.now();
  if (now - _lastImpactAt < 30) return;
  _lastImpactAt = now;

  const ac = getCtx();
  const clamped = Math.min(1, magnitude);
  const freq = 100 + clamped * 380;
  const vol = 0.04 + clamped * 0.09;

  const osc = ac.createOscillator();
  const g = sfxGain(vol);
  osc.type = 'triangle'; // always triangle — no harsh sawtooth
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.28, ac.currentTime + 0.20);
  osc.detune.value = jitter(8);
  osc.connect(g);
  osc.start();
  scheduleEnvelope(g, 2, 8, 190, vol);
  osc.stop(ac.currentTime + 0.24);
}

// ── Adaptive Emotional Conductor ─────────────────────────────────────────────
// Driven by training data inlined from two sibling packages (cross-package
// import not possible at build time, data reproduced verbatim):
//
//   Source A — dream/apps/frontend/src/audio/spectralGenome.ts
//     FALLBACK_GENOMES: bpm, onsetDensity, fftBands, harmonicTension, motifIntervals
//
//   Source B — dream/apps/frontend/src/erk/leitmotifs.ts
//     LEITMOTIF_REGISTRY: rootKey, mode, harmonicProgression (by cluster)
//
// Game emotional state → ERK genome + leitmotif pairing:
//   calm       → Silence genome       + "Silence"              (C Dorian,  56 BPM)
//   melancholic → Mourning genome     + "Requiem of the Gods"  (Eb minor,  60 BPM)
//   tense       → RitualisticBuild    + "Gates of Hell"        (C# Phrygian, 100 BPM)
//   euphoric    → Escalation genome   + "Golden Dance"         (D Major,  120 BPM)
//
// The lookahead scheduler (Web Audio best practice) places notes on the audio
// clock regardless of JS timer jitter.

export type EmotionalState = 'calm' | 'melancholic' | 'tense' | 'euphoric';

// Modal scale intervals in semitones — used to build Hz scale from rootKey
// (standard Western music theory; matches leitmotifs.ts MusicalMode type)
const MODE_INTERVALS: Record<string, number[]> = {
  major:      [0, 2, 4, 5, 7, 9, 11],
  minor:      [0, 2, 3, 5, 7, 8, 10],
  dorian:     [0, 2, 3, 5, 7, 9, 10],
  phrygian:   [0, 1, 3, 5, 7, 8, 10],
  lydian:     [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian:    [0, 2, 3, 5, 7, 8, 10],
  locrian:    [0, 1, 3, 5, 6, 8, 10],
};

// C2 = 65.41 Hz; rootKey 0–11 (C=0 … B=11), matching leitmotifs.ts rootKey field
const C2_HZ = 65.41;

function buildScale(rootKey: number, mode: string): number[] {
  const intervals = MODE_INTERVALS[mode] ?? MODE_INTERVALS['minor']!;
  const rootHz = C2_HZ * Math.pow(2, rootKey / 12);
  return intervals.map(s => rootHz * Math.pow(2, s / 12));
}

// Generates a 16-step rhythm pattern from onsetDensity (0–1) in the
// SpectralGenome schema. Downbeats land stronger than off-beats.
function buildRhythm(density: number): number[] {
  const pat = new Array<number>(16).fill(0);
  const count = Math.max(1, Math.round(density * 16));
  for (let i = 0; i < count; i++) {
    const pos = Math.round((i * 16) / count) % 16;
    pat[pos] = pos % 4 === 0 ? 1.0 : pos % 2 === 0 ? 0.65 : 0.45;
  }
  return pat;
}

// ERK profile: merged SpectralGenome + LeitmotifSeed fields
interface ERKProfile {
  bpm: number;               // from SpectralGenome.bpm
  rhythm: number[];          // derived from SpectralGenome.onsetDensity
  // layer gains: sub / low / mid — scaled from SpectralGenome.fftBands
  layerGains: [number, number, number];
  // waveform per layer — driven by SpectralGenome.harmonicTension
  layerTypes: [OscillatorType, OscillatorType, OscillatorType];
  // note Hz scale — from LeitmotifSeed.rootKey + .mode
  scale: number[];
  // harmonic walk — from LeitmotifSeed.harmonicProgression (1-based scale degrees)
  progression: number[];
}

// ── Training data — inlined from sibling packages ─────────────────────────────

const ERK_PROFILES: Record<EmotionalState, ERKProfile> = (() => {
  // fftBands → layer gains. Scaled so audible through masterGain on phone speakers.
  // ERK fftBands ratios preserved for tonal character; floors ensure minimum presence.
  const bands = (sub: number, low: number, mid: number): [number, number, number] =>
    [Math.max(sub * 1.65, 0.55), Math.max(low * 1.35, 0.44), Math.max(mid * 1.05, 0.32)];

  // harmonicTension → waveform selection
  const waves = (t: number): [OscillatorType, OscillatorType, OscillatorType] =>
    t > 0.6 ? ['triangle', 'triangle', 'sine']
    : t > 0.3 ? ['triangle', 'sine', 'sine']
    : ['sine', 'sine', 'sine'];

  return {
    // ── calm: Silence genome + "Silence" leitmotif ──────────────────────────
    // Genome  : bpm 40→56, onsetDensity 0.02→0.35, fftBands [0.05,0.03,0.02], tension 0.10
    // Leitmotif: rootKey 0 (C), mode dorian, prog [1,4,1,-7,1,4,-3,1]
    calm: {
      bpm: 56,
      rhythm: buildRhythm(0.35),
      layerGains: bands(0.22, 0.16, 0.10),
      layerTypes: waves(0.10),
      scale: buildScale(0, 'dorian'),
      progression: [1, 4, 1, -7, 1, 4, -3, 1],
    },

    // ── melancholic: Mourning genome + "Requiem of the Gods" leitmotif ──────
    // Genome  : bpm 50, onsetDensity 0.30, fftBands [0.4,0.3,0.3], tension 0.75
    // Leitmotif: rootKey 3 (Eb), mode minor, prog [1,4,5,1,-7,3,4,5]
    melancholic: {
      bpm: 50,
      rhythm: buildRhythm(0.30),
      layerGains: bands(0.4, 0.3, 0.3),
      layerTypes: waves(0.75),
      scale: buildScale(3, 'minor'),
      progression: [1, 4, 5, 1, -7, 3, 4, 5],
    },

    // ── tense: RitualisticBuild genome + "Gates of Hell" leitmotif ──────────
    // Genome  : bpm 120→100, onsetDensity 0.65, fftBands [0.5,0.55,0.6], tension 0.55
    // Leitmotif: rootKey 1 (C#), mode phrygian, prog [1,-2,1,-7,1,-2,5,1]
    tense: {
      bpm: 100,
      rhythm: buildRhythm(0.65),
      layerGains: bands(0.5, 0.55, 0.6),
      layerTypes: waves(0.55),
      scale: buildScale(1, 'phrygian'),
      progression: [1, -2, 1, -7, 1, -2, 5, 1],
    },

    // ── euphoric: Escalation genome + "Golden Dance" leitmotif ──────────────
    // Genome  : bpm 140→122, onsetDensity 0.80, fftBands [0.5,0.7,0.6], tension 0.45
    // Leitmotif: rootKey 2 (D), mode major, prog [1,5,6,3,4,1,5,1]
    euphoric: {
      bpm: 122,
      rhythm: buildRhythm(0.80),
      layerGains: bands(0.5, 0.7, 0.6),
      layerTypes: waves(0.45),
      scale: buildScale(2, 'major'),
      progression: [1, 5, 6, 3, 4, 1, 5, 1],
    },
  };
})();

// Octave multipliers: fundamental (1×), upper (2×), bright (4×)
// Avoids sub-bass (0.5×) which is inaudible on phone speakers.
const LAYER_OCTAVES: [number, number, number] = [1, 2, 4];

let _conductorState: EmotionalState = 'calm';
let _conductorRunning = false;
let _conductorStep = 0;
let _conductorNextTime = 0;
let _conductorTimerId: ReturnType<typeof setInterval> | null = null;

function _conductorTick() {
  if (!_conductorRunning || !ambientEnabled) return;
  const ac = getCtx();
  const p = ERK_PROFILES[_conductorState];
  const stepDur = 60 / p.bpm / 4; // 16th-note duration in seconds
  // Clamp: if nextTime drifted behind real time (e.g. tab hidden), skip ahead
  if (_conductorNextTime < ac.currentTime - stepDur) {
    _conductorNextTime = ac.currentTime + 0.05;
  }
  const lookahead = ac.currentTime + 0.28;

  while (_conductorNextTime < lookahead) {
    const step = _conductorStep % 16;
    const vel = p.rhythm[step] ?? 0;

    if (vel > 0) {
      // Walk harmonic progression from leitmotif training data
      const progIdx = Math.floor(_conductorStep / 2) % p.progression.length;
      const degree = Math.abs(p.progression[progIdx] ?? 1) - 1; // 0-indexed
      const baseFreq = p.scale[degree % p.scale.length] ?? p.scale[0]!;

      const noteLen = stepDur * 0.72;
      const fadeDur = stepDur * 0.38;
      const schedAt = _conductorNextTime;

      LAYER_OCTAVES.forEach((octMul, li) => {
        const peak = (p.layerGains[li] ?? 0.01) * vel;
        if (peak < 0.0005) return;
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = p.layerTypes[li] ?? 'sine';
        osc.frequency.value = baseFreq * octMul;
        osc.detune.value = jitter(3);
        osc.connect(g);
        g.connect(masterGain!);
        g.gain.value = 0;
        g.gain.setValueAtTime(0, schedAt);
        g.gain.linearRampToValueAtTime(peak, schedAt + 0.018);
        g.gain.setValueAtTime(peak, schedAt + noteLen - fadeDur);
        g.gain.linearRampToValueAtTime(0, schedAt + noteLen + fadeDur);
        osc.start(schedAt);
        osc.stop(schedAt + noteLen + fadeDur + 0.05);
      });
    }

    _conductorNextTime += stepDur;
    _conductorStep++;
  }
}

// Called by useGameAudio to drive emotional state from game events
export function setMusicState(state: EmotionalState) {
  if (_forcedMusicState !== null) return;
  if (state === _conductorState) return;
  const prevBpm = ERK_PROFILES[_conductorState].bpm;
  _conductorState = state;
  // Resync timing grid on large tempo jumps to avoid stale lookahead
  if (ctx && Math.abs(ERK_PROFILES[state].bpm - prevBpm) > 25) {
    _conductorNextTime = ctx.currentTime + 0.06;
    _conductorStep = 0;
  }
}

export function getAnalyserNode(): AnalyserNode | null { return analyserNode; }

let _forcedMusicState: EmotionalState | null = null;
export function forceMusicState(state: EmotionalState | null) {
  _forcedMusicState = state;
  if (state !== null) {
    _conductorState = state;
    if (ctx) {
      _conductorNextTime = ctx.currentTime + 0.05;
      _conductorStep = 0;
    }
  }
}

// ── Hero's Journey API (used by useGameAudio.ts) — now drives the conductor ──
export function startHeroJourneyTheme() {
  if (!ambientEnabled || _conductorRunning) return;
  _conductorRunning = true;
  _conductorStep = 0;
  const ac = getCtx();

  const launch = () => {
    _conductorNextTime = ac.currentTime + 0.12;
    _conductorTimerId = setInterval(_conductorTick, 80);
  };

  if (ac.state === 'suspended') {
    void ac.resume().then(launch);
  } else {
    launch();
  }
}

export function stopHeroJourneyTheme() {
  if (!_conductorRunning) return;
  _conductorRunning = false;
  if (_conductorTimerId !== null) {
    clearInterval(_conductorTimerId);
    _conductorTimerId = null;
  }
}

// ── Ambient Drone ─────────────────────────────────────────────────────────────

export function startAmbientDrone() {
  if (!ambientEnabled || droneOsc) return;
  const ac = getCtx();
  const start = () => {
    droneOsc = ac.createOscillator();
    droneGain = ac.createGain();
    droneOsc.type = 'sine';
    droneOsc.frequency.value = 55;
    droneOsc.connect(droneGain);
    droneGain.connect(masterGain!);
    droneGain.gain.value = 0;
    droneGain.gain.linearRampToValueAtTime(0.18, ac.currentTime + 3.5);
    droneOsc.start();
  };
  if (ac.state === 'suspended') {
    void ac.resume().then(start);
  } else {
    start();
  }
}

export function stopAmbientDrone() {
  if (!droneOsc || !droneGain) return;
  const ac = getCtx();
  droneGain.gain.linearRampToValueAtTime(0, ac.currentTime + 2.2);
  droneOsc.stop(ac.currentTime + 2.3);
  droneOsc = null;
  droneGain = null;
}
