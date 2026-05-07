# COMPETITIVE_DESIGN_BRIEF.md
# Farkle Frenzy V3 — Competitive Vision Document
# READ THIS ALONGSIDE CLAUDE.md (constraints) AND PRESERVATION_SPEC.xml (balance rules)
#
# THIS DOCUMENT GRANTS CREATIVE AUTHORITY.
# Claude Code reading this is authorized to INVENT, PROPOSE, and DESIGN
# new mechanics, systems, and features — subject to the constraints in CLAUDE.md.
# Do NOT just execute. Think critically. Push back on bad ideas. Propose better ones.

---

## VISION IN ONE SENTENCE

A skill-based competitive puzzle game where two players race on a shared board,
building Farkle combinations to score while using power-ups to disrupt each other —
fast, fair, and legible enough to feel good in a 2-minute match.

---

## WHAT ALREADY EXISTS (DO NOT REBUILD)

The following systems are complete and should be treated as infrastructure:

- **Farkle scoring engine** — 16 test cases pass. Max-partition stacking. Do not touch.
- **Shared board VS mode** — WebSocket server, server-authoritative, real-time sync.
- **Bomb system** — BOMB_STANDARD (Six-of-a-Kind) and BOMB_RAINBOW (Straight).
- **Multiplier ladder** — ×1.0 / ×1.25 / ×1.5 / ×2.0 / ×3.0 / ×4.0
- **CSPRNG spawn pool** — SixPoolManager with provably fair seeding.
- **Bio-Architect visual system** — isometric gem cubes, illustrated blockers/bombs.
- **Energy system** — PRIME (0–150 turn-based) / FRENZY (151–300 simultaneous).

The shared board already solves the "synchronized RNG" fairness requirement.
Both players see and modify the same grid — there is no "lucky drop" asymmetry.

---

## THE COMPETITIVE GAP — WHAT NEEDS TO BE INVENTED

The following systems do NOT exist and need to be designed + implemented.
Claude Code has full creative authority in these areas.

---

### GAP 1: ACTIVE DISRUPTION SYSTEM (Priority: HIGH)

**The Problem:** Currently, bombs clear the shared board — helping both players
equally. There is no targeted disruption of the opponent.

**The Requirement:** When a player triggers a power-up or big combo, they should
be able to send something negative to the opponent's side of the board.

**Design Space (Claude Code: invent the best version of this):**

Option considerations:
- Sending ICE tiles that freeze high-value opponent gems
- Sending LOCK tiles that cage opponent's scoring combinations
- A "gravity flip" that temporarily reverses opponent's tile fall direction
- A "scramble" that reshuffles a 3×3 region of opponent's board

**Constraints:**
- Must work within the existing SHARED board model (both players see same grid)
  OR require a new dual-board model (each player has their own half)
- If dual-board: WebSocket protocol needs new OPPONENT_BOARD_UPDATE message
- If shared board: disruption tiles must be visually distinct (whose side is whose)
- Must not break the SixPoolManager spawn system
- Must not require Math.random() — use CSPRNG

**Claude Code task:** Design the disruption architecture. Propose shared vs. dual board.
Show the WebSocket message diff. Show the new tile types needed. Get approval before implementing.

---

### GAP 2: DOUBLER CELLS (Priority: MEDIUM)

**The Requirement:** Rare board cells that double the score value of any chain
that passes through them.

**Spec to design:**
- Visual: distinct cell background (not a tile — a board position modifier)
- Probability: approximately 2–3 per 7×7 board
- Activation: any chain that includes a tile sitting on a doubler cell gets 2× score
- Duration: permanent until triggered, or temporary (e.g., lasts 3 turns)
- Interaction with multiplier: does doubler stack with ladder? (likely: yes, multiplicative)
- Interaction with bombs: bomb landing on doubler — does it double bomb score?

**Claude Code task:** Design the doubler cell type. Add to Cell interface if needed.
Ensure farkleScorer can receive a doublerActive flag. Propose before implementing.

---

### GAP 3: MATCHMAKING + RANKED SYSTEM (Priority: HIGH for revenue)

**The Requirement:** Players of similar skill should find each other.
Ranked play with seasonal resets drives long-term retention.

**Design elements needed:**
- ELO or MMR rating system (stored in Supabase scores table)
- Matchmaking queue (WebSocket: ENTER_QUEUE / MATCH_FOUND messages)
- Ranked tiers with names and visual badges (Bronze/Silver/Gold/Diamond/Obsidian
  — echo the gem palette: Coral/Jade/Steel/Violet/Obsidian)
- Seasonal reset cadence (monthly? quarterly?)
- PDX stakes for ranked play (sweepstakes compliance already in place)

**Claude Code task:** Design the Supabase schema for rankings.
Design the matchmaking queue server logic. Propose tier names and thresholds.
Get approval before touching gameRoom.ts or the scores schema.

---

### GAP 4: COMPETITIVE VS MODE FEEL — SPEED TUNING (Priority: HIGH)

**The Problem:** The current game is designed for deliberate, strategic play.
Competitive 2-minute matches need to feel fast and frantic.

**Specific changes needed:**

1. **Turn timer tightening:** In VS modes, default turn timer should be 8 seconds
   (not 10–20). Expose as lobby setting with 5 / 8 / 12 second options.

2. **Cascade speed:** In VS modes, CASCADE_MS should be 60ms (not 80ms).
   Visual physics animation can run at 120ms — slightly decoupled from logic tick.

3. **Auto-banking in VS:** Remove the deliberate Continue/Bank/Pass decision
   from VS mode. Every committed chain auto-banks immediately. Multiplier resets
   after each chain. This makes VS feel like a pure speed competition rather than
   a deliberation game. (Rally mode keeps the full Continue/Bank/Pass mechanic.)

4. **Score display:** In VS mode, show BOTH players' scores side by side in real
   time — not just the local player's score. Creates visible competitive tension.

5. **Win condition:** First player to reach target score wins. Target configurable
   in lobby: 5,000 / 10,000 / 25,000. Alternatively: highest score after 2 minutes.

**Claude Code task:** Propose which changes require new game state (VS_QUICK mode?)
vs. configuration flags. Show the minimal diff to useGame.ts. Get approval first.

---

### GAP 5: POWER-UP EXPANSION (Priority: MEDIUM)

The existing bomb system is solid but limited to two types triggered by rare combos.
A competitive game benefits from more frequent, varied power-ups.

**New power-ups to design (Claude Code: invent these):**

**Triggered by player action (not pure RNG):**
- **Laser:** Four-of-a-Kind → clears an entire row or column (player chooses)
- **Color Surge:** Five-of-a-Kind → converts all tiles of one face to face-1 (Gold) for 1 turn
- **Magnet:** Three Pairs → pulls all tiles of the rarest face to one column

**Passive board modifiers:**
- **Multiplier Lock:** For 3 chains, multiplier cannot reset on Farkle (insurance mechanic)
- **Chain Extender:** Next chain gets +1 maximum tile (7 instead of 6, once per session)

**Revenue power-up (cosmetic version):**
- Skin packs that change gem appearance without changing scoring
- "Lucky charm" cosmetics that animate but have zero mechanical effect

**Claude Code task:** Map each new power-up to a trigger combo. Ensure triggers
don't conflict with existing BOMB_STANDARD and BOMB_RAINBOW triggers.
Propose the Cell type additions. Get approval before implementing.

---

### GAP 6: REVENUE ARCHITECTURE (Priority: HIGH — enables monetization)

**Cosmetic system (no pay-to-win):**
- Gem skin packs: alternate visual appearances for GemCube faces (same geometry, different colors/textures)
- Board theme packs: alternate bio-architect.css variant themes beyond the 3 locked variants
- Avatar frame packs: decorative borders around the generative Avatar component
- Stored as skinId on UserProfile → maps to CSS class in GemCube.tsx and bio-architect.css

**PDX (sweepstakes) monetization:**
- Ranked entry fees in PDX for premium matchmaking queue
- Tournament brackets (weekly/monthly) with PDX prize pools
- Daily challenge with PDX reward for top 10% scorers

**FD (free) monetization path:**
- Watch rewarded ad → +500 FD
- Daily login streak → FD multiplier (day 1: 100 FD, day 7: 700 FD)
- Invite friend → 1000 FD each

**Claude Code task:** Design the skinId system. Show where it hooks into
GemCube.tsx and UserProfile. Show the Supabase schema additions.
Do NOT implement until the cosmetic hook architecture is approved.

---

## HONEST TENSIONS TO RESOLVE

Claude Code should flag and propose solutions for these architectural conflicts:

**Tension 1: Shared board vs. disruption**
Farkle Frenzy VS mode uses one shared board. Active disruption that sends
tiles to "opponent's side" requires either:
  a) A split/dual board model (major architectural change)
  b) A "tagged tile" system where tiles belong to a player's zone on the shared board
  c) A disruption queue that replaces opponent's next spawns with penalty tiles
Option (c) is the least invasive. Propose before touching the board model.

**Tension 2: Speed vs. deliberation**
The Farkle mechanic rewards deliberate play (banking decisions).
Fast competitive play rewards instinct. These are in tension.
Resolution: VS mode = instinct (auto-bank, 8s timer). Rally mode = deliberation.
They are different experiences on the same engine. This is a feature, not a bug.

**Tension 3: Power-up frequency vs. balance**
More frequent power-ups = more fun moment-to-moment.
Too many power-ups = skill becomes irrelevant.
Constraint: no new power-up should trigger on combos easier than Three-of-a-Kind.
Four-of-a-Kind and above is the correct trigger floor for VS-mode power-ups.

---

## PRIORITY ORDER FOR CLAUDE CODE

Work in this order. Get approval at each stage before proceeding.

```
1. AUDIT     → Read all existing files. Map what exists vs. what's needed.
               Produce AUDIT.md listing gaps, conflicts, and recommendations.
               Do NOT write code yet.

2. DISRUPT   → Design + propose the Active Disruption System (Gap 1).
               Include WebSocket message protocol diff.
               Get approval. Then implement.

3. VS SPEED  → Implement VS mode speed tuning (Gap 4).
               Minimal changes to useGame.ts and gameRoom.ts.
               Get approval first.

4. MATCHMAKE → Design + implement ranked matchmaking (Gap 3).
               Supabase schema + queue server logic.
               Get approval first.

5. POWER-UPS → Expand power-up system (Gap 5).
               Map triggers, implement new Cell types.
               Get approval first.

6. DOUBLER   → Implement doubler cells (Gap 2).
               Get approval first.

7. REVENUE   → Cosmetic skin hook system (Gap 6).
               Schema only first, then UI hooks.
               Get approval first.
```

---

## CREATIVE AUTHORITY BOUNDARIES

**Claude Code MAY invent without asking:**
- Names, visual descriptions, and thematic framing for new mechanics
- Specific ELO/MMR formula and tier threshold values
- Animation timing and easing curves
- Sound design descriptions for new events
- Supabase schema column names and types
- WebSocket message payload shapes

**Claude Code MUST get approval before:**
- Adding new dependencies to package.json
- Changing any constant in Section 17 of PRESERVATION_SPEC.xml
- Modifying farkleScorer.ts (the 16 test cases must always pass)
- Changing the Cell interface in packages/shared/src/types.ts
- Adding new game modes to the GameMode union type
- Changing the shared board model to a dual-board model
- Any change that touches the RTP engine or normalizer

---

## SUCCESS METRICS FOR A GOOD GAME

A well-implemented version of this design should produce:

- Average VS match duration: 90–180 seconds
- Farkle rate in VS mode: 15–25% of chains (lower than solo — faster decisions)
- Day-7 retention target: 25%+ (competitive social hook drives return)
- Session count per day target: 3–5 (short match length enables multiple sessions)
- First power-up trigger: within first 90 seconds of first game (tutorial hook)
- Revenue per MAU target: $0.80–$2.00 (achievable with PDX ranked + cosmetics)

These are targets, not guarantees. Claude Code should flag if any design decision
is likely to hurt these metrics based on game design principles.

---

## INVOCATION NOTES FOR CLAUDE CODE

When starting a session with this brief:
1. Read CLAUDE.md first (constraints)
2. Read this file second (creative direction)
3. Read FARKLE_FRENZY_PRESERVATION_SPEC.xml third (balance rules)
4. Produce AUDIT.md before touching any source file
5. Propose before implementing — every time

The goal is a game that is genuinely fun to play competitively,
fair to all players, and generates sustainable revenue.
Not a game that looks impressive in a prompt but breaks in play.
