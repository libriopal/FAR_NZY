// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Web Audio API synthesizer. No game logic.
// TITAN v1.0 — Neural Conductor update:
//   • Polyphonic: per-sound gain nodes, slight detune variance prevents phase cancellation
//   • playBombCollapse: necrotic detonation (low sawtooth + resonant noise)
//   • playCollisionImpact: physics impulse magnitude → pitched impact
//   • startHeroJourneyTheme / stopHeroJourneyTheme: layered ambient stems
// ─────────────────────────────────────────────────────

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let droneOsc: OscillatorNode | null = null;
let droneGain: GainNode | null = null;
let sfxEnabled = true;
let ambientEnabled = true;

// Hero's Journey multi-stem state
let heroOscs: OscillatorNode[] = [];
let heroGains: GainNode[] = [];
let heroRunning = false;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(ctx.destination);
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

function scheduleEnvelope(gain: GainNode, attackMs: number, sustainMs: number, releaseMs: number, peak = 1) {
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

// Slight pseudo-random detune offset per call — prevents phase cancellation when
// multiple identical chain-add sounds fire on the same tick.
let _detunePhase = 0;
function jitter(range = 6): number {
  _detunePhase = (_detunePhase + 1) % 7;
  return (_detunePhase - 3) * (range / 3);
}

export function playChainAdd(chainLen: number) {
  if (!sfxEnabled) return;
  const ac = getCtx();
  const osc = ac.createOscillator();
  const g = sfxGain(0.18);
  osc.type = 'sine';
  osc.frequency.value = 300 + chainLen * 55;
  osc.detune.value = jitter(8); // polyphony detune variance
  osc.connect(g);
  osc.start();
  scheduleEnvelope(g, 5, 20, 60, 0.18);
  osc.stop(ac.currentTime + 0.1);
}

export function playChainCommit(pts: number) {
  if (!sfxEnabled) return;
  const ac = getCtx();
  const osc = ac.createOscillator();
  const g = sfxGain(0.35);
  osc.type = 'triangle';
  osc.frequency.value = Math.min(1200, 440 + pts * 0.08);
  osc.connect(g);
  osc.start();
  scheduleEnvelope(g, 8, 60, 200, 0.35);
  osc.stop(ac.currentTime + 0.3);
}

export function playFarkle() {
  if (!sfxEnabled) return;
  const ac = getCtx();
  const osc = ac.createOscillator();
  const g = sfxGain(0.45);
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(380, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ac.currentTime + 0.45);
  osc.connect(g);
  osc.start();
  scheduleEnvelope(g, 5, 80, 350, 0.45);
  osc.stop(ac.currentTime + 0.5);
}

export function playBank(pts: number) {
  if (!sfxEnabled) return;
  const ac = getCtx();
  const freqs = [523, 659, 784];
  freqs.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const g = sfxGain(0.22);
    osc.type = 'sine';
    osc.frequency.value = freq + Math.min(pts * 0.02, 200);
    osc.connect(g);
    const delay = i * 0.06;
    osc.start(ac.currentTime + delay);
    g.gain.setValueAtTime(0, ac.currentTime + delay);
    g.gain.linearRampToValueAtTime(0.22, ac.currentTime + delay + 0.01);
    g.gain.linearRampToValueAtTime(0, ac.currentTime + delay + 0.25);
    osc.stop(ac.currentTime + delay + 0.3);
  });
}

export function playSphereHit() {
  if (!sfxEnabled) return;
  const ac = getCtx();
  const osc = ac.createOscillator();
  const g = sfxGain(0.25);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(440, ac.currentTime + 0.12);
  osc.connect(g);
  osc.start();
  scheduleEnvelope(g, 3, 30, 80, 0.25);
  osc.stop(ac.currentTime + 0.15);
}

export function playBombBlast(rainbow = false) {
  if (!sfxEnabled) return;
  const ac = getCtx();
  const buf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const g = sfxGain(rainbow ? 0.7 : 0.5);
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = rainbow ? 3000 : 800;
  src.connect(filter);
  filter.connect(g);
  src.start();
  scheduleEnvelope(g, 2, 50, 380, rainbow ? 0.7 : 0.5);
}

// ── Necrotic Bomb/Collapse sound (Neural Conductor — "Infection" detonation) ────
// Deep sawtooth bass drop + resonant filtered noise burst for a dark, organic decay.
export function playBombCollapse(rainbow = false) {
  if (!sfxEnabled) return;
  const ac = getCtx();

  // Bass impact — descending sawtooth through soft distortion
  const bassOsc = ac.createOscillator();
  const bassGain = sfxGain(0.55);
  const distortion = ac.createWaveShaper();
  const curve = new Float32Array(512);
  for (let i = 0; i < 512; i++) {
    const x = (i * 2) / 512 - 1;
    curve[i] = (3 * x) / (1 + 2 * Math.abs(x)); // soft knee
  }
  distortion.curve = curve;
  bassOsc.type = 'sawtooth';
  bassOsc.frequency.setValueAtTime(rainbow ? 88 : 55, ac.currentTime);
  bassOsc.frequency.exponentialRampToValueAtTime(14, ac.currentTime + 0.9);
  bassOsc.connect(distortion);
  distortion.connect(bassGain);
  bassOsc.start();
  scheduleEnvelope(bassGain, 4, 80, 750, 0.55);
  bassOsc.stop(ac.currentTime + 0.95);

  // Resonant noise burst — necrotic "tissue tear" texture
  const noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.7, ac.sampleRate);
  const noiseData = noiseBuf.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (noiseData.length * 0.15));
  }
  const noiseSrc = ac.createBufferSource();
  noiseSrc.buffer = noiseBuf;
  const nFilter = ac.createBiquadFilter();
  nFilter.type = 'bandpass';
  nFilter.frequency.value = rainbow ? 320 : 180;
  nFilter.Q.value = 12;
  const noiseGain = sfxGain(0.42);
  noiseSrc.connect(nFilter);
  nFilter.connect(noiseGain);
  noiseSrc.start();
  scheduleEnvelope(noiseGain, 1, 60, 580, 0.42);

  // Sub thud — adds physical weight
  const subOsc = ac.createOscillator();
  const subGain = sfxGain(0.38);
  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(rainbow ? 72 : 48, ac.currentTime);
  subOsc.frequency.exponentialRampToValueAtTime(18, ac.currentTime + 0.35);
  subOsc.connect(subGain);
  subOsc.start();
  scheduleEnvelope(subGain, 2, 20, 300, 0.38);
  subOsc.stop(ac.currentTime + 0.4);
}

// ── Physics impulse → audio (Neural Conductor — WASM physics bridge layer) ───────
// magnitude: 0–1, where 1 = max detected collision velocity delta.
// Pitch and gain scale with magnitude; very small impacts are silenced.
let _lastImpactAt = 0;
export function playCollisionImpact(magnitude: number) {
  if (!sfxEnabled || magnitude < 0.04) return;
  const now = performance.now();
  // Rate-limit: max one impact sound per 25ms to prevent audio saturation
  if (now - _lastImpactAt < 25) return;
  _lastImpactAt = now;

  const ac = getCtx();
  const clamped = Math.min(1, magnitude);
  const freq = 90 + clamped * 580; // 90–670 Hz
  const vol = 0.08 + clamped * 0.22;

  const osc = ac.createOscillator();
  const g = sfxGain(vol);
  osc.type = clamped > 0.6 ? 'sawtooth' : 'triangle';
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.25, ac.currentTime + 0.14);
  osc.detune.value = jitter(12);
  osc.connect(g);
  osc.start();
  scheduleEnvelope(g, 1, 5, 120, vol);
  osc.stop(ac.currentTime + 0.16);
}

// ── Hero's Journey — multi-stem background music (Gothic Hacker atmosphere) ─────
// Five layered sine pads tuned to the A minor pentatonic, with slow attack and
// subtle detune warmth. Fades in over 4s; stops cleanly with 2s tail.
const _HERO_FREQS = [55, 82.41, 110, 164.81, 220, 329.63]; // A1–E4
const _HERO_GAINS = [0.028, 0.022, 0.016, 0.014, 0.010, 0.008];

export function startHeroJourneyTheme() {
  if (!ambientEnabled || heroRunning) return;
  heroRunning = true;
  const ac = getCtx();

  _HERO_FREQS.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = i < 2 ? 'triangle' : 'sine';
    osc.frequency.value = freq;
    // Slight individual detune for warmth/beating
    osc.detune.value = (i % 3 - 1) * 3.5;
    osc.connect(g);
    g.connect(masterGain!);
    g.gain.value = 0;
    const peak = _HERO_GAINS[i] ?? 0.01;
    const delay = i * 0.6;
    g.gain.setValueAtTime(0, ac.currentTime + delay);
    g.gain.linearRampToValueAtTime(peak, ac.currentTime + delay + 4.0);
    osc.start(ac.currentTime);
    heroOscs.push(osc);
    heroGains.push(g);
  });
}

export function stopHeroJourneyTheme() {
  if (!heroRunning) return;
  heroRunning = false;
  const ac = getCtx();
  heroGains.forEach(g => {
    try {
      g.gain.cancelScheduledValues(ac.currentTime);
      g.gain.linearRampToValueAtTime(0, ac.currentTime + 2.0);
    } catch { /* already disconnected */ }
  });
  const oToStop = [...heroOscs];
  setTimeout(() => {
    oToStop.forEach(osc => { try { osc.stop(); } catch {} });
  }, 2200);
  heroOscs = [];
  heroGains = [];
}

export function startAmbientDrone() {
  if (!ambientEnabled || droneOsc) return;
  const ac = getCtx();
  droneOsc = ac.createOscillator();
  droneGain = ac.createGain();
  droneOsc.type = 'sine';
  droneOsc.frequency.value = 55;
  droneOsc.connect(droneGain);
  droneGain.connect(masterGain!);
  droneGain.gain.value = 0;
  droneGain.gain.linearRampToValueAtTime(0.06, ac.currentTime + 2);
  droneOsc.start();
}

export function stopAmbientDrone() {
  if (!droneOsc || !droneGain) return;
  const ac = getCtx();
  droneGain.gain.linearRampToValueAtTime(0, ac.currentTime + 1.5);
  droneOsc.stop(ac.currentTime + 1.6);
  droneOsc = null;
  droneGain = null;
}
