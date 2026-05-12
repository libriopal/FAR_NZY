Engineered Prompt Generation Plan

Browser-Based Procedural Audio Reconstruction + Analysis Architecture

This plan is designed to create a master implementation prompt for Claude Code or similar coding agents that will build a full browser-native audio analysis and procedural recreation system.

The objective is NOT simple MP3 playback.

The objective is:

decode audio

analyze musical structure

extract procedural features

generate symbolic music representations

create reactive/gameplay-ready audio systems

optionally synthesize similar music structures in realtime



---

PHASE 1 — SYSTEM OBJECTIVE DEFINITION

The first prompt section must define the actual architectural goal.

Required Prompt Intent

The generated prompt should explicitly state:

Build a browser-native audio intelligence engine capable of:

- decoding MP3 audio
- extracting PCM waveform data
- performing FFT spectral analysis
- detecting BPM/transients/rhythm signatures
- generating symbolic musical representations
- reconstructing procedural approximations
- driving gameplay/VFX systems reactively
- supporting realtime adaptive audio generation


---

PHASE 2 — CORE ARCHITECTURE REQUIREMENTS

The engineered prompt must separate the system into explicit modules.


---

A. Audio Decode Layer

Responsibilities

MP3 decoding

chunked decoding

streaming support

fallback support


Required Technologies

Web Audio API

OfflineAudioContext

WASM decoder fallback


Prompt Requirements

The generated prompt should instruct:

Implement dual decoding paths:

PRIMARY:
- WASM MP3 decoder

FALLBACK:
- decodeAudioData()

Support:
- ArrayBuffer decoding
- streamed chunk decoding
- partial-frame decoding
- worker-thread execution


---

B. WASM Audio Pipeline

The plan must force Claude to structure decoding as a high-performance worker architecture.

Prompt Requirements

Use Web Workers + WASM for:
- MP3 decoding
- FFT preprocessing
- spectral extraction
- transient analysis
- BPM scanning

Suggested WASM Targets

mpg123

FFmpeg

dr_mp3



---

PHASE 3 — AUDIO FEATURE EXTRACTION

The engineered prompt must explicitly define analysis systems.


---

Required Analysis Modules

Waveform Extraction

Extract Float32 PCM channel data from AudioBuffers.

FFT Analysis

Generate frequency-domain spectral windows.

Transient Detection

Detect:
- kick transients
- snare transients
- peaks
- rhythm accents

BPM Detection

Estimate:
- BPM
- tempo stability
- timing offsets
- beat confidence

Harmonic Analysis

Extract:
- tonal center
- chord energy
- harmonic density
- melodic contour


---

PHASE 4 — SYMBOLIC MUSIC REPRESENTATION

This is the most important conceptual layer.

The prompt should force Claude to convert raw audio into reusable symbolic structures.


---

Required Data Structures

MusicEvent[]
BeatMap[]
TransientMap[]
SpectralSignature[]
SectionTimeline[]
ChordProfile[]
EnergyCurve[]


---

Purpose

These structures become:

gameplay triggers

procedural generators

adaptive soundtrack systems

visualization systems

reconstruction engines



---

PHASE 5 — PROCEDURAL RECONSTRUCTION ENGINE

The engineered prompt must distinguish:

DO NOT:

recreate copyrighted audio directly


DO:

recreate musical structure

generate stylistically similar procedural systems

synthesize adaptive approximations



---

Required Procedural Systems

Rhythm Regeneration

Reconstruct rhythm patterns from transient maps.

Harmonic Recreation

Generate harmonic approximations using extracted chord profiles.

Energy Mapping

Map song intensity into procedural gameplay/audio states.

Section Reconstruction

Detect:
- intro
- buildup
- chorus
- breakdown
- climax


---

PHASE 6 — GAMEPLAY/VFX INTEGRATION

Critical for your project.

The prompt should require:

Expose realtime music events to gameplay systems.


---

Required Reactive Systems

Bomb Sync

explosion timing

bass-reactive flashes

spectrum explosions


Board FX

glow intensity

energy pulses

lighting modulation


Frenzy Mode

BPM escalation

visual amplification

chromatic distortion


Particle Systems

beat-synced bursts

frequency-reactive motion



---

PHASE 7 — MEMORY + PERFORMANCE DESIGN

The prompt MUST aggressively prioritize optimization.


---

Required Constraints

DO NOT

- decode entire libraries simultaneously
- store unnecessary PCM
- allocate FFT buffers repeatedly
- perform analysis on main thread


---

REQUIRED

- worker-thread analysis
- pooled buffers
- chunked decoding
- progressive loading
- downsampled analysis windows
- lazy loading


---

PHASE 8 — BASE64 + SELF-CONTAINED DEPLOYMENT

Optional subsystem.

The prompt should include:

Support fully self-contained HTML deployments using:
- base64 encoded audio
- Uint8Array reconstruction
- embedded procedural assets

BUT ALSO:

Warn against:
- large inline MP3s
- huge bundle sizes
- excessive memory use


---

PHASE 9 — AUDIOWORKLET + REALTIME DSP

The advanced phase.

The prompt should optionally scaffold:

AudioWorklet

realtime DSP graphs

procedural synthesis

low-latency modulation

live spectral effects



---

PHASE 10 — AI/ML OPTIONAL LAYER

Future-facing expansion.

The prompt should scaffold optional:

ONNX runtime

lightweight ML inference

music classification

mood analysis

procedural recommendation systems



---

PHASE 11 — OUTPUT ARCHITECTURE REQUIREMENTS

The engineered prompt should force Claude to output:


---

Required Deliverables

Architecture

full system topology

module boundaries

thread model


Code

TypeScript-first

browser-native

worker-safe

modular


Visualizations

FFT debug overlays

waveform viewers

BPM timelines

transient graphs


Documentation

memory constraints

mobile constraints

latency discussion

browser compatibility



---

FINAL MASTER PROMPT OBJECTIVE

The final engineered prompt should produce:

A browser-native procedural audio intelligence engine that:
- decodes audio
- extracts symbolic music structure
- generates reactive gameplay data
- powers adaptive VFX systems
- supports procedural soundtrack reconstruction
- operates efficiently on desktop and mobile browsers

This is no longer just an audio player.

It becomes:

a music intelligence layer

a gameplay synchronization engine

a procedural soundtrack framework

a reactive VFX orchestration system

a symbolic audio analysis architecture

a realtime browser DSP platform
