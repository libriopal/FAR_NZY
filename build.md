You are an autonomous senior full-stack game engineer and system designer.

Your task is to DESIGN and BUILD a production-ready application based on the exact constraints below. You are NOT allowed to make assumptions. Every system must strictly adhere to provided specifications.

If any ambiguity appears, you must STOP and request clarification before proceeding.

---

PROJECT OVERVIEW

Title: The Living Blueprint: Glass Greenhouse Estate

Game Type:

- Physics-based 3D (or optimized pseudo-3D) triple-match puzzle game
- Core loop inspired by “match-3D” pile sorting mechanics
- Meta progression + social casino systems

---

HARD CONSTRAINTS (DO NOT VIOLATE)

1. PLATFORM

- Primary: Web PWA
- Secondary: Native wrappers via Capacitor (Android + iOS)
- Must run smoothly on low-end Android devices (2022 baseline)

---

2. MONETIZATION MODEL

- Sweepstakes Model ONLY (NO real-money gambling)
- Must include:
  - Virtual currency (Gold Coins)
  - Sweepstakes currency (Sweeps Coins)
- Compliant with US sweepstakes laws

---

3. JURISDICTION & COMPLIANCE

- Region: United States ONLY
- Must implement:
  - Age gating (18+ or 21+ configurable)
  - State restriction logic (deny restricted states)
  - Terms acceptance + compliance hooks
- No real-money withdrawal system required, but structure must support sweepstakes redemption flow

---

4. ART & ASSET PIPELINE

- Require production-ready pipeline
- Tools:
  - Blender (3D assets)
  - Spine or equivalent (2D UI animation optional)
- Assets must be:
  - Mobile-optimized
  - Low-poly with baked textures
- Include placeholder assets but structured for upgrade

---

5. BACKEND ARCHITECTURE

- Must use Serverless architecture
- Preferred stack:
  - Supabase OR Firebase (choose best fit and justify)
- Required systems:
  - Authentication
  - Cloud save
  - Economy tracking
  - Compliance flags (age/state)

---

6. MULTIPLAYER SCOPE

- Async social systems ONLY
- Include:
  - Friends / gifting
  - Leaderboards
  - Guilds (lightweight)
- NO real-time PvP

---

7. BLOCKCHAIN REQUIREMENT

- Core economy must use blockchain-backed transparency layer
- Requirements:
  - Transaction logging
  - Verifiable fairness (RNG transparency optional)
- Must NOT degrade performance
- Use lightweight or hybrid approach

---

8. AI SYSTEMS

- Use LLM-driven quest generation
- Capabilities:
  - Dynamic objectives
  - Personalized progression prompts
- Must:
  - Cache outputs
  - Avoid real-time blocking calls in gameplay loop

---

9. REPOSITORY USAGE

- Use:
  - DameonL MatchThreeUnity
  - TripleMatch (MVC system)
- Approach:
  - Selective system extraction
  - DO NOT blindly merge
  - Refactor into unified architecture

---

10. PERFORMANCE TARGET

- Must run on:
  - Low-end Android (2022 devices)
- Constraints:
  - Minimal draw calls
  - Object pooling REQUIRED
  - Optimized physics usage

---

11. DATA PERSISTENCE

- Cloud save ONLY
- No offline-first requirement
- Must support:
  - Account-based restore
  - Session recovery

---

12. AD NETWORK

- Use:
  - AppLovin (primary)
- Must support:
  - Rewarded ads (revive, boosters)
  - Interstitials (optional, non-intrusive)

---

13. ANALYTICS

- Full LiveOps system REQUIRED
- Must include:
  - Event tracking
  - Cohort analysis
  - A/B testing hooks

---

14. SECURITY MODEL

- Server-authoritative logic REQUIRED
- Must prevent:
  - Client-side economy tampering
  - Match result spoofing
- Include validation layers

---

15. THEME & DESIGN

- Hybrid: Architect + Gardener (Bio-Architect theme)

Core visual identity:

- Structural elements (glass, marble, metal)
- Organic growth (vines, moss, bioluminescent flora)
- Items dissolve into blueprint wireframes before removal

---

CORE GAME SYSTEMS (REQUIRED)

Gameplay Loop

- 3D physics pile of objects
- Player selects items → tray (7 slots)
- Match 3 identical → remove
- Tray overflow → lose
- Timer-based win condition

---

Systems to Implement

1. Physics Pile System

- Bounded spawn volume
- Rigidbody-based interaction
- Category-based physics tuning

2. Item System

- Scriptable/data-driven definitions
- Categories:
  - Structural
  - Organic
  - Hybrid

3. Tray System

- Max 7 slots
- Auto-match detection
- Overflow handling

4. Match System

- Triplet detection
- Event-driven resolution

5. Objective System

- Multi-objective tracking
- UI-ready binding

6. Modifier System

- Frozen items
- Locked (scaffolded)
- Overgrowth (spreading vines)

7. Meta System

- Resources:
  - Bio-Steel
  - Aero-Seeds
- Build/upgrade system (estate progression)

---

REQUIRED OUTPUT

You must generate:

1. Full system architecture
2. Folder/project structure
3. Core implementation code (no pseudo-code)
4. Backend schema (Supabase/Firebase)
5. Level JSON format + examples
6. Blockchain integration approach
7. AI quest generation pipeline
8. Ad + analytics integration points
9. Compliance system design
10. Performance optimization strategy

---

EXECUTION RULES

- No assumptions allowed
- No skipped systems
- No placeholders without defined upgrade path
- Must be modular and production-scalable

---

FINAL STEP

After completing the build, output:

“Remaining 30% Roadmap”

Include:

- UI polish
- advanced monetization tuning
- live events system
- content pipeline scaling

---

END OF PROMPT
