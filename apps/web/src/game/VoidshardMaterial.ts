// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// VOIDSHARD ShaderMaterial — CRYSTALLINE pillar, scarce tier.
// Near-black void body + UV purple fresnel + internal lightning veins.
// Reality axis: virtual (cyan→violet) — the rarest digital artifact.
// ─────────────────────────────────────────────────────

import * as THREE from 'three';

// ── Palette (mirrors CURRENCY.sdx in tokens.ts) ───────────────────────────────
const VOID_BASE:      THREE.Vector3 = new THREE.Vector3(0.020, 0.000, 0.031); // #050008
const UV_FRESNEL:     THREE.Vector3 = new THREE.Vector3(0.482, 0.000, 1.000); // #7b00ff
const LIGHTNING:      THREE.Vector3 = new THREE.Vector3(0.749, 0.502, 1.000); // #bf80ff
const EMISSIVE_DEEP:  THREE.Vector3 = new THREE.Vector3(0.239, 0.000, 0.478); // #3d007a

// ── xorshift32 hash (GPU) — same seed strategy as VoxelPileScene vRng ─────────
const _GLSL_HASH = /* glsl */`
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(443.8975, 397.2973, 491.1871));
  p3 += dot(p3, p3.yzx + 19.19);
  return fract((p3.x + p3.y) * p3.z);
}

float hash13(vec3 p) {
  p = fract(p * vec3(443.8975, 397.2973, 491.1871));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}
`;

// ── Smooth value noise ─────────────────────────────────────────────────────────
const _GLSL_NOISE = /* glsl */`
float vnoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f); // smoothstep
  return mix(
    mix(mix(hash13(i + vec3(0,0,0)), hash13(i + vec3(1,0,0)), f.x),
        mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x),
        mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z
  );
}

// FBM: 3 octaves — fast enough for mobile
float fbm3(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * vnoise3(p);
    p = p * 2.0 + vec3(13.3, 7.7, 5.5);
    a *= 0.5;
  }
  return v;
}
`;

const vertexShader = /* glsl */`
uniform float uTime;

varying vec3 vWorldNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;
varying float vFresnel;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * worldPos;

  vLocalPos    = position;
  vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vViewDir     = normalize(cameraPosition - worldPos.xyz);

  float cosTheta = max(0.0, dot(vViewDir, vWorldNormal));
  vFresnel = pow(1.0 - cosTheta, 3.5);
}
`;

const fragmentShader = /* glsl */`
${_GLSL_HASH}
${_GLSL_NOISE}

uniform float uTime;
uniform float uLightningIntensity;  // 0–1
uniform float uFresnelPower;        // default 1.0
uniform vec3  uVoidBase;
uniform vec3  uUvFresnel;
uniform vec3  uLightning;
uniform vec3  uEmissiveDeep;

varying vec3  vWorldNormal;
varying vec3  vViewDir;
varying vec3  vLocalPos;
varying float vFresnel;

void main() {
  // ── Internal lightning veins ──────────────────────────────────────────────
  // Two noise layers at different frequencies create branching bolt patterns
  float n1 = fbm3(vLocalPos * 5.0 + vec3(uTime * 0.4, 0.0, uTime * 0.25));
  float n2 = fbm3(vLocalPos * 11.0 + vec3(0.0, uTime * 0.6, uTime * 0.15));

  // Sharp threshold → lightning vein; smooth → diffuse glow
  float bolt    = pow(max(0.0, n1 * n2 - 0.28), 3.0) * 6.0;
  float diffuse = (n1 * 0.5 + n2 * 0.5) * 0.12;

  // ── Crystalline facet shimmer ─────────────────────────────────────────────
  float facet = abs(dot(vWorldNormal, normalize(vec3(0.577, 0.577, 0.577))));
  float facet2 = abs(dot(vWorldNormal, normalize(vec3(-0.577, 0.577, 0.577))));
  float shimmer = max(facet, facet2) * 0.08;

  // ── Compose ───────────────────────────────────────────────────────────────
  vec3 col = uVoidBase;

  // Deep UV subsurface emissive
  col += uEmissiveDeep * (diffuse + shimmer) * 1.8;

  // Lightning vein — cosmic violet
  col += uLightning * bolt * uLightningIntensity;

  // UV purple fresnel edge — virtual reality rim
  col += uUvFresnel * vFresnel * uFresnelPower * 1.6;

  // Subtle bloom-feed: slightly boost brightest vein tips
  col += uLightning * max(0.0, bolt - 1.5) * 0.4;

  gl_FragColor = vec4(col, 1.0);
}
`;

// ── VoidshardMaterial factory ──────────────────────────────────────────────────

export interface VoidshardUniforms {
  lightningIntensity?: number; // 0–1, default 0.85
  fresnelPower?:       number; // multiplier, default 1.0
}

export function createVoidshardMaterial(opts: VoidshardUniforms = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime:               { value: 0 },
      uLightningIntensity: { value: opts.lightningIntensity ?? 0.85 },
      uFresnelPower:       { value: opts.fresnelPower       ?? 1.0  },
      uVoidBase:           { value: VOID_BASE    },
      uUvFresnel:          { value: UV_FRESNEL   },
      uLightning:          { value: LIGHTNING    },
      uEmissiveDeep:       { value: EMISSIVE_DEEP},
    },
    side:        THREE.FrontSide,
    transparent: false,
  });
}

// ── Tick helper — call from useFrame or requestAnimationFrame ──────────────────

export function tickVoidshard(mat: THREE.ShaderMaterial, dt: number): void {
  const u = mat.uniforms['uTime'];
  if (u) u.value += dt;
}

// ── R3F helper — drop-in <meshes> material via JSX ref ────────────────────────
// Usage:
//   const matRef = useRef<THREE.ShaderMaterial>(null);
//   useFrame((_, dt) => { if (matRef.current) tickVoidshard(matRef.current, dt); });
//   <mesh><boxGeometry /><primitive object={createVoidshardMaterial()} ref={matRef} attach="material" /></mesh>
