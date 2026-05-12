// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Web Audio API synthesizer. No game logic.
// ─────────────────────────────────────────────────────

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let droneOsc: OscillatorNode | null = null;
let droneGain: GainNode | null = null;
let sfxEnabled = true;
let ambientEnabled = true;

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
  if (!v) stopAmbientDrone();
}

export function resumeCtx() {
  if (ctx?.state === 'suspended') void ctx.resume();
}

export function playChainAdd(chainLen: number) {
  if (!sfxEnabled) return;
  const ac = getCtx();
  const osc = ac.createOscillator();
  const g = sfxGain(0.18);
  osc.type = 'sine';
  osc.frequency.value = 300 + chainLen * 55;
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
