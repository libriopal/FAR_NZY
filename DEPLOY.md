# Deployment Runbook

## Prerequisites
- Node 20+, pnpm 9+
- Android SDK (API 34) + Java 17
- Supabase CLI (`npm i -g supabase`)
- Capacitor CLI included via devDependencies

---

## 1. Environment

```bash
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase project
```

---

## 2. Supabase Setup

```bash
# Start local Supabase (Docker required)
pnpm supabase:start

# Push schema to local
pnpm supabase:push

# Regenerate TypeScript types after schema changes
pnpm supabase:gen-types

# Deploy edge functions
supabase functions deploy process-transaction
supabase functions deploy generate-quests
supabase functions deploy ingest-analytics
supabase functions deploy blockchain-relay
supabase functions deploy send-gift

# Set edge function secrets
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set ALCHEMY_API_KEY=...
supabase secrets set RELAY_WALLET_PRIVATE_KEY=...
```

---

## 3. Web PWA Build

```bash
pnpm build:web
# Output: apps/web/dist/
# Serve dist/ behind HTTPS for full PWA install support
```

---

## 4. Android APK (Debug)

```bash
pnpm android:debug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

## 5. Android APK (Release)

```bash
# Generate keystore once:
keytool -genkey -v -keystore android/keystore.jks \
  -alias match3d -keyalg RSA -keysize 2048 -validity 10000

# Build signed APK:
KEYSTORE_PATH=android/keystore.jks \
KEYSTORE_PASSWORD=your_ks_pass \
KEY_ALIAS=match3d \
KEY_PASSWORD=your_key_pass \
pnpm android:release
# Output: android/app/build/outputs/apk/release/app-release.apk
```

## 6. Android App Bundle (Play Store)

```bash
KEYSTORE_PATH=android/keystore.jks \
KEYSTORE_PASSWORD=your_ks_pass \
KEY_ALIAS=match3d \
KEY_PASSWORD=your_key_pass \
pnpm android:bundle
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

---

## 7. Multiplayer Server

```bash
pnpm --filter server build
node apps/server/dist/index.js
# Default port: 3001
# Set VITE_WS_URL=wss://your-server:3001 in production .env
```

---

## PWA Icons (replace placeholders before release)

- `apps/web/public/pwa-192x192.png` — 192×192 PNG
- `apps/web/public/pwa-512x512.png` — 512×512 PNG
- `apps/web/public/favicon.ico` — 32×32 ICO
- `apps/web/public/masked-icon.svg` — SVG (already generated, update as needed)
