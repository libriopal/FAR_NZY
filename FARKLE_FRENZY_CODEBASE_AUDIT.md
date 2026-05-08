# FARKLE_FRENZY_CODEBASE_AUDIT.md
# Full Preservation Audit + Core File Separation Protocol
# 
# HOW TO USE:
#   1. Drop this file and FARKLE_FRENZY_DESCRIPTION.xml in repo root
#   2. Open Claude Code: claude --permission-mode plan
#   3. Paste the OPENING MESSAGE below as your first message
#   4. Claude Code will audit, then propose a file separation plan
#   5. You approve the plan BEFORE anything is moved or changed
#   6. After separation: CORE files get a lock comment header
#   7. Only then does Claude Code propose any changes to non-core files
#
# IMPORTANT: --permission-mode plan means Claude Code CANNOT write files.
#   It can only read and propose. You control when it gets write access.

---

## OPENING MESSAGE — PASTE THIS INTO CLAUDE CODE

---

You are performing a full preservation audit of Farkle Frenzy V3.

Your job has two parts:
  PART A: Audit every file against the game description
  PART B: Separate the codebase into CORE (sacred, do not touch) and SURFACE (safe to modify)

You are in plan mode. You cannot write any files yet.
Read everything first. Think critically. Then produce two documents.
Do not produce code. Do not suggest implementations. Audit only.

---

STEP 1: READ THESE FILES FIRST (in this exact order)

1. FARKLE_FRENZY_DESCRIPTION.xml
   This is the authoritative game vision. Every mechanic in it must exist
   in the codebase. Memorize the scoring table, game modes, tile states,
   roles, energy constants, and the "things that must never happen" list.

2. CLAUDE.md
   Technical constraints. Any violation of these in the codebase is a bug.

3. FARKLE_FRENZY_PRESERVATION_SPEC.xml (if present)
   Balance and fairness rules. Cross-reference with what you find.

---

STEP 2: READ THE ENTIRE CODEBASE

Read every file in the project. Do not skip any file.
Build a complete mental map of:
  - What exists
  - What each file does
  - How files depend on each other
  - What is referenced but missing
  - What exists but contradicts the description

Start with these directories in order:
  packages/shared/src/
  packages/engine/src/
  apps/client/src/hooks/
  apps/client/src/components/
  apps/client/src/styles/
  apps/client/src/screens/
  apps/server/src/
  controller/

Read every .ts and .tsx file. Read the package.json files.
Read CLAUDE.md again after reading the code — violations are easier to spot
after you understand what the code actually does.

---

STEP 3: PRODUCE AUDIT.md

Create AUDIT.md in the repo root. Structure it exactly as follows:

SECTION A — VERIFIED PRESENT AND CORRECT
  List every game mechanic from FARKLE_FRENZY_DESCRIPTION.xml that is
  correctly implemented in the codebase. One line each. Be specific
  about which file implements it.
  Example: "Farkle scoring engine — packages/engine/src/farkleScorer.ts
            All 16 test cases pass. Max-partition algorithm confirmed."

SECTION B — PRESENT BUT INCORRECT OR INCOMPLETE
  List every mechanic that exists in some form but has a discrepancy
  with the description. For each entry:
    - What the description says it should do
    - What the code actually does
    - How serious the discrepancy is (CRITICAL / IMPORTANT / MINOR)
  Do NOT propose fixes yet. Just document what is wrong and how wrong.

SECTION C — MISSING ENTIRELY
  List every mechanic from the description that has NO implementation
  in the codebase. For each entry:
    - What is missing
    - Which description section it comes from
    - What files would need to be created or modified to add it
  Do NOT propose implementations yet.

SECTION D — VIOLATIONS OF CLAUDE.md CONSTRAINTS
  List every place in the codebase where a constraint from CLAUDE.md
  is violated. For each entry:
    - File and line number (or approximate location)
    - Which rule is violated
    - Severity of the violation
  
  Pay special attention to:
    Math.random() in game logic (should never exist)
    setInterval for cascade or energy tick
    framer-motion imports (must be motion/react)
    better-sqlite3 imports (must be sql.js)
    SP_FREE or SP_CASINO mode name strings
    activeBombs arrays
    Bomb.tsx or RainbowBomb.tsx imports
    Relative imports to packages/ instead of @farkle/ aliases

SECTION E — DEPENDENCY MAP
  Produce a plain-text dependency tree showing which files import
  from which other files. Format:
    [filename] → imports from → [filename, filename, ...]
  Focus on the engine and hook files — these are where breakage cascades.
  This map is used in Step 4 to determine which files are CORE.

SECTION F — SUMMARY SCORES
  Give each area a health score (0–10, where 10 is perfect):
    Scoring engine integrity:     X/10
    Game mode completeness:       X/10
    Energy system correctness:    X/10
    Blocker type completeness:    X/10
    Bomb mechanics correctness:   X/10
    Multiplier ladder correctness: X/10
    Currency system completeness: X/10
    Chain mechanic correctness:   X/10
    Visual system completeness:   X/10
    Audio system completeness:    X/10
  
  Overall preservation score: X/10
  Write one honest paragraph about the current state of the codebase.
  Do not be polite. Be accurate.

---

STEP 4: PRODUCE SEPARATION_PLAN.md

This is the core file separation protocol.
Produce a second document: SEPARATION_PLAN.md

The goal: identify which files are CORE SACRED and which are SURFACE MODIFIABLE,
then generate a .ff-core-lock file that permanently marks the boundary.

CLASSIFICATION RULES:

CORE SACRED files are files that:
  - Contain the Farkle scoring engine or any scoring logic
  - Define the canonical TypeScript types and interfaces
  - Implement the spawn pool / SixPoolManager
  - Implement the CSPRNG / provably fair system
  - Implement the RTP engine or Monte Carlo simulation
  - Implement the game state machine (useGame equivalent)
  - Implement the chain input logic (useChain equivalent)
  - Implement the energy system (useEnergy equivalent)
  - Implement the WebSocket server game room (gameRoom equivalent)
  - Implement the cascade system
  - Contain game constants (grid sizes, energy thresholds, heist constants)
  IF IN DOUBT: classify as CORE.

SURFACE MODIFIABLE files are files that:
  - Render visuals only (tile appearance, colors, animations)
  - Handle audio playback and synthesis
  - Implement lobby and menu screens
  - Implement settings and modals
  - Implement player profiles and auth UI
  - Contain CSS, design tokens, theme files
  - Implement leaderboard display
  - Implement chat UI
  SURFACE files may have logic but it must be purely presentational.
  If a SURFACE file imports from a CORE file: that import is sacred,
  the SURFACE file is not.

SEPARATION_PLAN.md must contain:

PART 1 — CORE SACRED FILE LIST
  List every file classified as CORE SACRED.
  For each file: explain in one sentence why it is sacred.
  Include the full file path.

PART 2 — SURFACE MODIFIABLE FILE LIST
  List every file classified as SURFACE MODIFIABLE.
  For each file: describe what kind of changes are safe.
  Include the full file path.

PART 3 — BOUNDARY VIOLATIONS
  List any cases where a SURFACE file contains logic that should be CORE.
  These need to be extracted before safe surface modification is possible.
  Do NOT propose the extraction yet — just flag it.

PART 4 — THE .ff-core-lock FILE CONTENT
  Produce the exact content of a file called .ff-core-lock that will
  live at the repo root. This file is a plain text manifest.
  Format:
  
  # FARKLE FRENZY — CORE LOCK MANIFEST
  # Generated: [date]
  # 
  # Files listed here are CORE SACRED.
  # They implement game balance, scoring, and fairness.
  # DO NOT MODIFY without running the full test suite and getting explicit approval.
  # Claude Code: if asked to modify a file in this list, STOP and ask the developer first.
  #
  # CORE FILES:
  packages/shared/src/types.ts
  packages/engine/src/farkleScorer.ts
  [... all core files listed one per line]
  #
  # SURFACE FILES (safe to modify visually and structurally):
  apps/client/src/styles/bio-architect.css
  [... all surface files listed one per line]

PART 5 — RECOMMENDED DIRECTORY RESTRUCTURE (optional, propose only)
  If the current directory structure makes the core/surface split unclear,
  propose a restructure. For example:
    src/core/     ← CORE files moved here
    src/surface/  ← SURFACE files moved here
  Only propose this if it would meaningfully reduce confusion.
  Do not propose restructuring for its own sake.

---

STEP 5: GATE — WAIT FOR APPROVAL

After producing AUDIT.md and SEPARATION_PLAN.md:
  STOP.
  Do not implement any fixes.
  Do not move any files.
  Do not add the lock comment headers yet.

Present a summary of your findings:
  - Overall preservation score
  - Number of CRITICAL issues found
  - Number of missing features
  - Number of CLAUDE.md violations
  - Your confidence that the core game vision is preserved

Then ask: "Do you want to proceed with:
  A) Fixing CRITICAL issues in SECTION B first
  B) Adding missing features from SECTION C first
  C) Applying the core/surface file separation first
  D) All of the above in order: separation → critical fixes → missing features"

Wait for the answer. Do not proceed until you receive it.

---

STEP 6: AFTER APPROVAL — APPLY LOCK HEADERS

When the developer approves the separation plan:

Switch from plan mode to full mode.
For every file classified as CORE SACRED:
  Add this comment block at the very top of the file, before any imports:

  For TypeScript/TSX files:
  // ═══════════════════════════════════════════════════════
  // FARKLE FRENZY — CORE SACRED FILE
  // This file implements game balance, scoring, or fairness logic.
  // DO NOT MODIFY without:
  //   1. Running all 16 farkleScorer test cases
  //   2. Running npx tsc --noEmit (must show 0 errors)
  //   3. Explicit developer approval
  //   4. Updating DECISIONS_LOCKED_v4.txt if any constant changes
  // See .ff-core-lock for full classification manifest.
  // ═══════════════════════════════════════════════════════

  For CSS files:
  /* ═══════════════════════════════════════════════════════
     FARKLE FRENZY — CORE SACRED FILE
     Game constant styles. Do not change values without approval.
     ═══════════════════════════════════════════════════════ */

For every file classified as SURFACE MODIFIABLE:
  Add this lighter header:

  // ─────────────────────────────────────────────────────
  // FARKLE FRENZY — SURFACE FILE
  // Visual/presentational layer. Safe to modify appearance.
  // Do not add game logic here. Do not remove imports from CORE files.
  // ─────────────────────────────────────────────────────

Create the .ff-core-lock file at repo root with the content from SEPARATION_PLAN.md Part 4.

After adding all headers and the lock file:
  Run npx tsc --noEmit
  Confirm 0 errors. If any errors appeared: the headers were added incorrectly.
  Report the result.

---

STEP 7: GATE — APPROVAL REQUIRED BEFORE ANY CONTENT CHANGES

After the separation is applied:
  STOP AGAIN.
  Do not fix any game logic.
  Do not add any missing features.
  Present the SECTION B and SECTION C items from AUDIT.md as a prioritized list.
  Ask the developer which items to address and in what order.
  
  Every fix must be individually approved before implementation.
  No batch changes. No "I'll fix several things while I'm in here."
  One issue. One proposal. One approval. One implementation.
  
  If fixing an issue would require modifying a CORE SACRED file:
    State this explicitly before proposing anything.
    "This fix requires modifying [CORE FILE]. Here is the exact change
    I would make: [show the minimal diff]. Do you approve?"

---

RULES FOR ALL PHASES — READ THESE BEFORE STARTING

NEVER modify a CORE SACRED file without showing the exact diff first.
NEVER change the Farkle scoring engine without running all 16 test cases.
NEVER add a new npm dependency without asking.
NEVER change game constants without explicitly flagging them.
NEVER batch multiple changes — one approval per change.
NEVER assume a file is SURFACE just because it has a visual name.
  (A file called Tile.tsx might contain game logic — read it first.)

ALWAYS classify boundary cases as CORE — err on the side of protection.
ALWAYS run npx tsc --noEmit after any change.
ALWAYS report the exact file and line when flagging an issue.
ALWAYS quote the relevant line from FARKLE_FRENZY_DESCRIPTION.xml
  when noting a discrepancy.

IF you find a conflict between FARKLE_FRENZY_DESCRIPTION.xml and the
current code where the code seems intentionally different:
  Flag it as a SECTION B discrepancy but mark it "(POSSIBLY INTENTIONAL)".
  Do not assume the code is wrong — ask the developer.

IF you cannot determine whether a file is CORE or SURFACE:
  Classify it as CORE and explain why you were uncertain.

---

START NOW.

Read the files in the order listed in STEP 1.
Read the entire codebase.
Produce AUDIT.md and SEPARATION_PLAN.md.
Then STOP and present your summary.

Make this thorough. Make it honest. A missed issue now becomes a
shipped bug later. Find everything.

---
