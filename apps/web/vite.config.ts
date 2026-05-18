import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';

const PACKAGES_ROOT = path.resolve(__dirname, '../../packages');

// Copies rapier_wasm3d_bg.wasm into build output and fixes the broken "<deleted>"
// base URL that Vite leaves when it can't resolve import.meta.url inside a library.
function rapierWasmPlugin(): Plugin {
  const wasmFileName = 'rapier_wasm3d_bg.wasm';
  return {
    name: 'rapier-wasm',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const wasmSrc = path.resolve(
        __dirname,
        `../../node_modules/@dimforge/rapier3d-compat/${wasmFileName}`
      );
      if (fs.existsSync(wasmSrc)) {
        this.emitFile({
          type: 'asset',
          fileName: wasmFileName,
          source: fs.readFileSync(wasmSrc),
        });
      }
      // Patch the broken URL in the rapier chunk
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk' && chunk.code.includes(wasmFileName)) {
          chunk.code = chunk.code.replace(
            /new URL\(["']rapier_wasm3d_bg\.wasm["'],["'][^"']*["']\)/g,
            `new URL("/${wasmFileName}", globalThis.location?.href ?? "http://localhost/")`
          );
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    rapierWasmPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // SW generation disabled — terser is unavailable in this build environment.
      // Re-enable when building in CI with full Node toolchain.
      selfDestroying: true,
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'The Living Blueprint: Glass Greenhouse Estate',
        short_name: 'Living Blueprint',
        description: 'Physics-based bio-architect match-3 puzzle game',
        theme_color: '#0a1628',
        background_color: '#0a1628',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        disableDevLogs: true,
        runtimeCaching: [],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@match3d/game-core': path.join(PACKAGES_ROOT, 'game-core/src/index.ts'),
      '@match3d/compliance': path.join(PACKAGES_ROOT, 'compliance/src/index.ts'),
      '@match3d/economy': path.join(PACKAGES_ROOT, 'economy/src/index.ts'),
      '@match3d/blockchain': path.join(PACKAGES_ROOT, 'blockchain/src/index.ts'),
      '@match3d/ai-quests': path.join(PACKAGES_ROOT, 'ai-quests/src/index.ts'),
      '@match3d/ads': path.join(PACKAGES_ROOT, 'ads/src/index.ts'),
      '@match3d/analytics': path.join(PACKAGES_ROOT, 'analytics/src/index.ts'),
      '@match3d/backend-client': path.join(PACKAGES_ROOT, 'backend-client/src/index.ts'),
      '@match3d/farkle-shared': path.join(PACKAGES_ROOT, 'farkle-shared/src/index.ts'),
      '@match3d/farkle-engine': path.join(PACKAGES_ROOT, 'farkle-engine/src/web.ts'),
      '@assets': path.resolve(__dirname, '../../assets'),
      '@dimforge/rapier3d-compat': path.resolve(__dirname, '../../packages/game-core/node_modules/@dimforge/rapier3d-compat/rapier.es.js'),
    },
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat'],
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('react-dom') || id.includes('react/')) return 'react-vendor';
          if (id.includes('three') || id.includes('@react-three')) return 'three-vendor';
          if (id.includes('@dimforge/rapier3d-compat') || id.includes('rapier.es')) return 'rapier';
          if (id.includes('packages/game-core')) return 'game-core';
        },
      },
    },
  },
});
