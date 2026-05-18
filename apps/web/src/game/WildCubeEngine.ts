import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import RAPIER from '@dimforge/rapier3d-compat';

// ==========================================
// 1. DYNAMIC SHADER MATERIAL DEFNITION
// ==========================================
const WildCubeShader = {
    uniforms: {
        uTime: { value: 0 },
        uAudioIntensity: { value: 0 },
        uRockColor: { value: new THREE.Color('#110f0e') },
        uCrackingIntensity: { value: 0.65 }
    },
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vModelPosition;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            vModelPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float uTime;
        uniform float uAudioIntensity;
        uniform vec3 uRockColor;
        uniform float uCrackingIntensity;
        varying vec3 vNormal;
        varying vec3 vModelPosition;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        float noise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                       mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
        }
        vec3 rainbow(float h) {
            vec3 c = mod(h * 6.0 + vec4(0.0, 4.0, 2.0, 0.0).rgb, 6.0);
            return clamp(abs(c - 3.0) - 1.0, 0.0, 1.0);
        }
        void main() {
            vec3 absPos = abs(vModelPosition);
            vec2 faceUV = (absPos.x > absPos.y && absPos.x > absPos.z) ? vModelPosition.zy :
                          (absPos.y > absPos.x && absPos.y > absPos.z) ? vModelPosition.xz : vModelPosition.xy;

            float n = noise(faceUV * 12.0 + uTime * 0.1) * 0.5 + noise(faceUV * 24.0 - uTime * 0.05) * 0.25;
            // Expand crack networks when audio intensity drops/spikes
            float dynamicThreshold = uCrackingIntensity - (uAudioIntensity * 0.08);
            float ambientCracks = smoothstep(dynamicThreshold, dynamicThreshold - 0.03, noise(faceUV * 8.0 + n));

            // Shift hue based on position, time, and dynamic music pulses
            float hue = mod(uTime * 0.15 + length(vModelPosition) * 0.4 + (uAudioIntensity * 0.1), 1.0);
            vec3 wildColor = rainbow(hue);

            // Intense blinding white core glow
            vec3 whiteCore = vec3(2.5, 2.5, 2.5);
            float distFromCenter = length(vModelPosition);
            float coreGlow = smoothstep(0.8, 0.1, distFromCenter) * (1.0 + uAudioIntensity * 0.5);

            vec3 emissiveColor = mix(wildColor, whiteCore, coreGlow * 0.4);
            vec3 finalColor = mix(uRockColor, emissiveColor, ambientCracks);
            finalColor += wildColor * (1.0 - ambientCracks) * 0.15 * coreGlow;

            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
};

// ==========================================
// 2. MAIN EXECUTION ENGINE CLASS
// ==========================================
export class WildCubeEngine {
    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private renderer!: THREE.WebGLRenderer;
    private composer!: EffectComposer;
    private physicsWorld!: RAPIER.World;

    private outerMesh!: THREE.Mesh;
    private innerMesh!: THREE.Mesh;
    private outerBody!: RAPIER.RigidBody;
    private innerBody!: RAPIER.RigidBody;

    private audioAnalyser?: THREE.AudioAnalyser;
    private clock = new THREE.Clock();
    private isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
    private destroyed = false;

    constructor(container: HTMLElement, audioStream?: MediaStream) {
        this.initGraphics(container);
        this.initPostProcessing();
        this.initPhysics().then(() => {
            if (this.destroyed) return;
            this.buildObjects();
            if (audioStream) this.initAudio(audioStream);
            this.animate(0);
        });
    }

    private resizeObserver?: ResizeObserver;

    private initGraphics(container: HTMLElement) {
        this.scene = new THREE.Scene();

        const w = container.clientWidth || 180;
        const h = container.clientHeight || 220;

        this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 100);
        this.camera.position.set(0, 1.2, 4);
        this.camera.lookAt(0, 0.8, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: !this.isMobile, powerPreference: "high-performance", alpha: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);
        container.appendChild(this.renderer.domElement);

        this.resizeObserver = new ResizeObserver(entries => {
            const { width, height } = entries[0]!.contentRect;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
            this.composer.setSize(width, height);
        });
        this.resizeObserver.observe(container);
    }

    private initPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        // High intensity bloom configured to catch the white "W" and saturated cracks
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(this.renderer.domElement.width, this.renderer.domElement.height),
            1.8,  // Strength
            0.4,  // Radius
            0.85  // Threshold (Only elements over-saturated past 1.0 bleed light)
        );
        this.composer.addPass(bloomPass);
    }

    private async initPhysics() {
        await RAPIER.init();
        // Setup world with standard global downward gravity
        this.physicsWorld = new RAPIER.World(new RAPIER.Vector3(0, -9.81, 0));
    }

    private initAudio(stream: MediaStream) {
        const listener = new THREE.AudioListener();
        this.camera.add(listener);

        const audio = new THREE.Audio(listener);
        const context = listener.context;
        const source = context.createMediaStreamSource(stream);
        // MediaStreamAudioSourceNode is not schedulable but is connectable as a source
        audio.setNodeSource(source as unknown as AudioScheduledSourceNode);

        this.audioAnalyser = new THREE.AudioAnalyser(audio, 128);
    }

    private buildObjects() {
        // --- 1. Outer Box Configuration ---
        const boxGeo = new RoundedBoxGeometry(1.5, 1.5, 1.5, 4, 0.15);
        const boxMat = new THREE.ShaderMaterial({
            vertexShader: WildCubeShader.vertexShader,
            fragmentShader: WildCubeShader.fragmentShader,
            uniforms: THREE.UniformsUtils.clone(WildCubeShader.uniforms),
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        if (this.isMobile && boxMat.uniforms['uCrackingIntensity']) boxMat.uniforms['uCrackingIntensity'].value = 0.72;

        this.outerMesh = new THREE.Mesh(boxGeo, boxMat);
        this.scene.add(this.outerMesh);

        // Physics: Outer solid tumbling cuboid body
        const outerBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 3, 0);
        this.outerBody = this.physicsWorld.createRigidBody(outerBodyDesc);
        const outerCollider = RAPIER.ColliderDesc.cuboid(0.75, 0.75, 0.75).setRestitution(0.5);
        this.physicsWorld.createCollider(outerCollider, this.outerBody);

        // Force an initial violent spinning throw
        this.outerBody.setLinvel(new RAPIER.Vector3(0, 2, -2), true);
        this.outerBody.setAngvel(new RAPIER.Vector3(5, 4, 2), true);

        // --- 2. Static World Floor (physics only — no visible mesh) ---
        this.physicsWorld.createCollider(RAPIER.ColliderDesc.cuboid(15, 0.05, 15).setTranslation(0, -0.05, 0));

        // --- 3. Internal "W" Configuration ---
        // Basic fallback setup using basic primitives to build a physical proxy shape for "W"
        const wGeo = new THREE.BoxGeometry(0.3, 0.3, 0.1);
        const wMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); // Pure bright white to hyper-trigger bloom
        this.innerMesh = new THREE.Mesh(wGeo, wMat);
        this.scene.add(this.innerMesh);

        // Physics: Light dynamic inner body
        const innerBodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(0, 3, 0)
            .setAngularDamping(0.8); // Helps the "W" settle naturally without perpetual spinning
        this.innerBody = this.physicsWorld.createRigidBody(innerBodyDesc);
        const innerCollider = RAPIER.ColliderDesc.ball(0.15).setRestitution(0.1);
        this.physicsWorld.createCollider(innerCollider, this.innerBody);
    }

    // ==========================================
    // 3. INTERNAL PENETRATION CONSTRAINT MATH
    // ==========================================
    private enforceInternalBounds() {
        const oPosRaw = this.outerBody.translation();
        const oRotRaw = this.outerBody.rotation();
        const iPosRaw = this.innerBody.translation();
        const iVelRaw = this.innerBody.linvel();

        const outerPos = new THREE.Vector3(oPosRaw.x, oPosRaw.y, oPosRaw.z);
        const innerPos = new THREE.Vector3(iPosRaw.x, iPosRaw.y, iPosRaw.z);
        const innerVel = new THREE.Vector3(iVelRaw.x, iVelRaw.y, iVelRaw.z);
        const outerQuat = new THREE.Quaternion(oRotRaw.x, oRotRaw.y, oRotRaw.z, oRotRaw.w);

        // Flatten the rolling space: convert Inner global tracking parameters into Cube Local coordinates
        const localPos = innerPos.clone().sub(outerPos).applyQuaternion(outerQuat.clone().invert());
        const localVel = innerVel.clone().applyQuaternion(outerQuat.clone().invert());

        // Boundary calculation: half-extent (0.75) minus asset limits and bevel radius offsets
        const innerLimit = 0.52;
        const innerBounceLoss = 0.6; // Restitution value inside the cube container
        let corrected = false;

        const axes: ('x' | 'y' | 'z')[] = ['x', 'y', 'z'];
        for (const axis of axes) {
            if (Math.abs(localPos[axis]) > innerLimit) {
                corrected = true;
                localPos[axis] = Math.sign(localPos[axis]) * innerLimit;

                // Reflect and dampen velocity along the colliding local axis plane
                if (Math.sign(localVel[axis]) === Math.sign(localPos[axis])) {
                    localVel[axis] = -localVel[axis] * innerBounceLoss;
                }
            }
        }

        // Write corrected matrices back into WASM simulation layer to cleanly reset position state
        if (corrected) {
            const worldPos = localPos.clone().applyQuaternion(outerQuat).add(outerPos);
            const worldVel = localVel.clone().applyQuaternion(outerQuat);
            this.innerBody.setTranslation(worldPos, true);
            this.innerBody.setLinvel(worldVel, true);
        }
    }

    // ==========================================
    // 4. TICK / RENDERING LOOP
    // ==========================================
    private animate = (_timestamp: number) => {
        if (this.destroyed) return;
        requestAnimationFrame(this.animate);
        const time = this.clock.getElapsedTime();

        // 1. Process Audio Payload
        let intensity = 0;
        if (this.audioAnalyser) {
            // Sample mid-bass frequency thresholds for impact sync
            const data = this.audioAnalyser.getFrequencyData();
            intensity = ((data[2] ?? 0) + (data[4] ?? 0) + (data[6] ?? 0)) / 3 / 255;
        }

        // 2. Advance Physics Engines
        this.physicsWorld.step();
        this.enforceInternalBounds();

        // 3. Matrix Transformations Syncing
        const oPos = this.outerBody.translation();
        const oRot = this.outerBody.rotation();
        this.outerMesh.position.set(oPos.x, oPos.y, oPos.z);
        this.outerMesh.quaternion.set(oRot.x, oRot.y, oRot.z, oRot.w);

        const iPos = this.innerBody.translation();
        const iRot = this.innerBody.rotation();
        this.innerMesh.position.set(iPos.x, iPos.y, iPos.z);
        this.innerMesh.quaternion.set(iRot.x, iRot.y, iRot.z, iRot.w);

        // 4. Update GLSL Shader Parameters
        const shaderMat = this.outerMesh.material as THREE.ShaderMaterial;
        if (shaderMat.uniforms['uTime']) shaderMat.uniforms['uTime'].value = time;
        if (shaderMat.uniforms['uAudioIntensity']) shaderMat.uniforms['uAudioIntensity'].value = intensity;

        // 5. Fire Final Post-Processing Execution Stack
        this.composer.render();
    };

    destroy() {
        this.destroyed = true;
        this.resizeObserver?.disconnect();
        this.renderer.dispose();
        this.physicsWorld?.free();
    }
}
