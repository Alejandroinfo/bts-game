# BST Animals — Project Knowledge

## 1. Game Concept

BST Animals is a cooperative board game for 2-5 players. Players hold numbered cards (1-100) and play them in silence to construct Binary Search Trees (BST) and inverted Pyramids across progressive levels. Communication is restricted and unlocks gradually. The group shares a pool of lives; the goal is to complete all levels before lives reach zero.

The digital version (Firebase web app) is a prototype for testing rules. The final product is a **physical printed board game** — any design decision must work on a table with physical cards, no software assistance.

---

## 2. Card System — 100 Cards, Fused Color + Personality

Each card has a number (1-100). The **last digit** determines BOTH its color AND personality (called "potencia" 0-9):

| Digit | Personality | Color | Spanish Color |
|-------|------------|-------|---------------|
| 0 | Common | Gray | Gris |
| 1 | Loud | Yellow | Amarillo |
| 2 | Orderly | Green | Verde |
| 3 | Curious | Orange | Naranja |
| 4 | Familiar | Blue | Azul |
| 5 | Shy | Purple | Morado |
| 6 | Joker | Pink | Rosa |
| 7 | Sacrifice | White | Blanco |
| 8 | Hyperactive | Red | Rojo |
| 9 | Demolisher | Black | Negro |

Each card also has a **Class** (animal) by decade: 1-10=Dog, 11-20=Cat, 21-30=Bear, 31-40=Rabbit, 41-50=Rat, 51-60=Cow, 61-70=Tiger, 71-80=Lion, 81-90=Shark, 91-100=Sparrow.

---

## 3. The 10 Personalities

### Always active (no confirmation needed):
- **Common (0):** No effect.
- **Loud (1):** All players reveal their highest card for 15 seconds (visible on all screens with player names).
- **Orderly (2):** +1 point if a neighbor (parent/child in BST, or lateral/fusion neighbor in Pyramid) has ±1 exact value difference.
- **Familiar (4):** Two consecutive Familiar plays trigger a simultaneous card-pass mechanic (each player with a Familiar passes one to their left neighbor).
- **Joker (6):** Copies the personality of the last played card.

### Optional (confirm() dialog before activating):
- **Curious (3):** Reveals top 2 cards of deck to all players. Cards move to the BOTTOM of the deck after reveal.
- **Shy (5):** Stacks instead of placing (LIFO). Released when a normal card is played. Works in both BST and Pyramid.
- **Sacrifice (7):** Discard another card (not Common/Sacrifice) from hand, copy its personality.
- **Hyperactive (8):** Play as if BEFORE the last card played. Uses snapshot-based reorder with chain support for consecutive Hyperactive plays. Works in both BST and Pyramid.
- **Demolisher (9):** Remove any card from board; hole remains with double constraints. **BST only** — not yet implemented for Pyramid.

### Key implementation notes:
- All personalities except Demolisher work in both BST and Pyramid levels.
- In Tutorial Phase 1 (levels T1-T2), ALL personalities are forced to "Common".
- The `autoSkipFamiliarPass` function uses `"__skip__"` (not `null`) as a marker, because Firebase drops null values.

---

## 4. Level Structure

### Main Game — 8 Levels
| Level | Type | Height | Nodes | Timer |
|-------|------|--------|-------|-------|
| 1 | BST | 3 | 7 | 3 min |
| 2 | Pyramid | 3 | 7 | 3 min |
| 3 | BST | 4 | 15 | 6 min |
| 4 | Pyramid | 4 | 15 | 6 min |
| 5 | BST | 5 | 31 | 9 min |
| 6 | Pyramid | 5 | 31 | 9 min |
| 7 | BST | 6 | 63 | 12 min |
| 8 | Pyramid | 6 | 63 | 12 min |

When the timer expires, the host auto-executes `endLevel()` — empty nodes cost lives. Timer is not active during tutorial.

### Tutorial — 6 Levels (3 Phases × 2)
- Phase 1 (T1-T2): `hidePersonality=true`, all abilities disabled.
- Phase 2 (T3-T4): Colors/personalities visible and active.
- Phase 3 (T5-T6): Missions + points + abilities.
- Separate life pool (10 lives), never triggers gameOver.

---

## 5. Difficulty System

| Difficulty | Lives | Start Points | Range Signal Cost |
|-----------|-------|-------------|-------------------|
| Easy | 15 | 3 | 0 (free) |
| Normal | 12 | 2 | 2 |
| Hard | 9 | 1 | 3 |
| Expert | 6 | 0 | 3 |

Test Mode: checkbox at room creation gives 10,000 starting points.

---

## 6. Signal System — 4 Signals, Progressive Unlock

| Signal | Available From | Effect |
|--------|---------------|--------|
| Range | Level 1 (costs points) | Reveal your highest or lowest card |
| Pack/Manada | After completing a Pyramid level | Choose an animal class, reveal how many you hold |
| Median | After completing a Pyramid level | Show your median card |
| Color/Personality | After completing a Pyramid level | Like Pack but counting by personality |

Individual choice per unlock opportunity (each player picks which signal to unlock).

---

## 7. Mission System

42 missions across 4 pools by difficulty. 3 missions face-up per level = 12 visible. Toggle with `missionsEnabled` flag. Auto-verification engine in `missionEngine.js`.

---

## 8. Strategic Retreat

Once per game. Requires <50% nodes filled AND unanimous vote. Cost: `Math.ceil(sharedLives/2)` lives.

---

## 9. Project Architecture

```
bst-firebase/
├── index.html          — UI structure, tabs, topbar
├── styles.css          — All styles
└── js/
    ├── firebase-init.js   (43 lines)  — Firebase connection
    ├── gameData.js        (192 lines) — Cards, levels, personalities, missions, difficulty
    ├── gameLogic.js       (398 lines) — BST placement, Hyperactive reorder, Shy stack, Orderly
    ├── pyramidBlocks.js   (705 lines) — Floating blocks system, serialization, all Pyramid helpers
    ├── gameRoom.js        (2481 lines)— ALL Firebase logic, play flow, personality handlers
    ├── boardRender.js     (116 lines) — Tree/Pyramid visual rendering
    ├── cardRender.js      (66 lines)  — Individual card rendering
    ├── missionTracker.js  (125 lines) — Stats collection for mission verification
    ├── missionEngine.js   (206 lines) — 42 mission condition checkers
    ├── missionRender.js   (136 lines) — Mission pool UI
    ├── ui.js              (27 lines)  — Screen/tab navigation
    └── main.js            (19 lines)  — Entry point, auto-reconnect
```

### Data flow for a card play:
1. Player clicks card → `selectCard()` in gameRoom.js
2. Personality confirmation (if optional ability)
3. `playCard()` → resolves effective personality (Joker/Sacrifice copy)
4. Shy check (stack or continue)
5. **BST path:** `findBSTPosition()` → heap position
6. **Pyramid path:** `deserializePyramidFromFirebase()` → `insertValue()` → `tryInsertInRow()` → `serializePyramidForFirebase()`
7. Build `updates` object → single `Firebase.update()` call
8. All browsers receive update via `onValue()` listener → `renderAll()`

---

## 10. BST Algorithm

Uses heap-based binary tree: root at position 1, left child = 2×P, right child = 2×P+1.

`findBSTPosition(board, value, maxNodes)`: starts at root, compares value against each node, goes left (smaller) or right (larger) until finding an empty position or running out of tree.

Hyperactive in BST: removes last card from board, recalculates positions for both cards in swapped order using the same `findBSTPosition()`.

---

## 11. Pyramid Algorithm — Floating Blocks System

### Core concept
Each row is an array of "blocks" — groups of values that are known to be adjacent but whose absolute position may not be determined yet. Positions only anchor when a row is fully complete.

### The 4 insertion cases (`tryInsertInRow`):
1. **Empty row** → new single-value block
2. **Value < min** → new block at left extreme (if space)
3. **Value > max** → new block at right extreme (if space)
4. **Value between two adjacent blocks** → check accumulated index parity; if valid pair, fuse blocks and value goes up as child

### Accumulated index rule (Case 4):
```
leftEndIdx = accIdx + left.values.length - 1
if (leftEndIdx % 2 !== 0) → skip (not a valid heap pair)
```
This determines whether two adjacent blocks would share a parent in the heap.

### Bounce mechanism:
If a value doesn't fit in the base, try fusion-only in each upper row (never as first card or new extreme in non-base rows).

### Visual rendering (`resolveProvisional`):
Positions children ABOVE their actual parent pair using `childBlockId` links, not blind centering. This was a bug fix — without it, children appeared visually above the wrong pair.

### Hyperactive in Pyramid — Snapshot + Chain System:
- `pyramidStateBeforeLast`: snapshot before the last non-Hyperactive card
- `pyramidHyperactiveChain`: array of Hyperactive values played consecutively
- `pyramidLastNonHyperCard`: the fixed anchor (last non-Hyperactive card)
- On Hyperactive play: reconstruct from snapshot inserting `[newHyper, ...chain, anchor]`
- Verified with 211 randomized test sequences (chain lengths 1-4)

---

## 12. Firebase Serialization — Critical

Firebase Realtime Database converts JS arrays to objects with numeric keys AND drops empty arrays/objects. Two-layer protection:

### Rows:
Empty rows serialized as `{ _empty: true }` instead of `[]`.

### Block values:
Serialized as `valuesObj: {"0": val1, "1": val2}, valuesCount: N` instead of raw `values: [val1, val2]`. This was the ROOT CAUSE of the major "no cards playable" bug — `values.length` returned `undefined` on objects, making accumulated index calculations produce `NaN`.

### maxSlotsPerRow:
Deserialization handles both array and object forms.

### Debug logging:
`console.warn("[PyramidDebug]...")` at every rejection point in `tryInsertInRow`. `console.log("[PyramidSequence]...")` shows cumulative play sequence per level. `console.warn("[PyramidReject]...")` shows full state when a card is rejected.

---

## 13. Firebase Room Structure

```
rooms/{code}: {
  code, hostId, difficulty, phase, sharedLives, maxLives,
  currentLevel, usedRetreat, retreatVotes,
  isTutorial, tutorialLevel, missionsEnabled,
  signalChoicePending, signalChoicesMade,
  familiarPassPending, familiarPassChoices,
  shyStack,
  board,
  pyramidState, pyramidStateBeforeLast,
  pyramidHyperactiveChain, pyramidLastNonHyperCard,
  pyramidPlaySequence,
  deckRemaining,
  lastPlayedCard, lastPlayedBy, lastPlayedPos,
  loudTrigger, curiousPeek,
  levelTimerStart, levelTimerDurationSec,
  stats, missionPool,
  players/{pid}/{ name, hand, points, activeMission, unlockedSignals, ready },
  log/{pushId}/{ time, msg }
}
```

---

## 14. UI Features

- **Tabs:** Tablero, Misiones, Registro, Jugadores, 📖 Guía
- **Guía tab:** Static reference with all 10 personalities (colors, descriptions), placement rules (BST/Pyramid), and signal descriptions. Built once, never touches Firebase.
- **Level timer:** Visible in topbar, red blink in last 30 seconds. Auto-closes level on expiry.
- **Home button (🏠):** In topbar with confirm dialog. Clears `localStorage('bst_session')` before reload to prevent auto-reconnect.
- **Game over screen:** Shows victory/defeat with "Volver al inicio" button.
- **Last played card:** Golden pulsing border highlight on the board.
- **Test mode:** Checkbox at room creation gives 10,000 starting points.

---

## 15. Known Issues & Pending Work

### Bugs still being investigated:
- Pyramid: some card sequences may still produce unexpected rejections — debug logging (`[PyramidReject]`, `[PyramidSequence]`) now captures exact state for reproduction.
- Pyramid: visual rendering of non-full rows with complex block structures may occasionally misposition blocks.

### Not yet implemented:
- **Demolisher in Pyramid** — needs separate design for block system compatibility.
- **Physical board game print assets** — the final product form.

### Design discussions in progress:
- **Session length problem:** 8 sequential levels can take 60+ minutes. Two models proposed:
  - Model A: "Free menu" — pick any single level, play independently (3-12 min sessions)
  - Model B: "Short campaign" — pick a difficulty tier (Beginner/Advanced/Expert), play 3-4 levels with shared progression (15-25 min sessions)
  - Could combine both as separate modes.
- **Communication/cognitive load:** BST/Pyramid require more complex reasoning than The Mind's single ascending order. The silence is ambiguous (could mean high cards, no valid cards, or strategic waiting). Timer pressure helps force action. All UI aids must work in physical form too.

---

## 16. Development Practices

- **Pure functions separated from side effects:** `findBSTPosition`, `insertValue`, `getOrderlyNeighbors` etc. are pure and testable without Firebase.
- **Playwright testing:** Browser automation for verifying logic in the real page environment.
- **Regression battery:** Every bug fix case gets added to the test suite; full suite runs after every change.
- **Firebase serialization testing:** Simulated Firebase corruption (arrays→objects, null drops) in tests.

---

## 17. Deliverables Produced

- `bst-firebase.zip` — Complete web app (latest version with all fixes)
- `BST_Animals_Guia_Tecnica.docx` — 17-page technical guide document
- `BST_Animals_Misiones.xlsx` — 42 missions + 10 personalities spreadsheet
