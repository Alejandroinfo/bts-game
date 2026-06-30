// ════════════════════════════════════════════════════════════════
// GAME DATA — v2: mazo de 64 cartas, niveles de Escenario A y B
// ════════════════════════════════════════════════════════════════
// Decisiones transversales (ver BST_v2_Decisiones_Generales.md):
//   - Mazo de 64 cartas (no 100). Sin colores/personalidades (en hold).
//   - Sin sistema de puntos.
// Spec del Escenario A (ver BST_v2_Escenario_A_InformacionMixta.md):
//   - Mano híbrida + agencia + queue + 12 niveles de prueba.
// Estructura LevelConfig consistente con
// BST_v2_Escenario_B_Convenciones.md §2, para que B entre sin
// renombrar nada cuando su spec se cierre.
// ════════════════════════════════════════════════════════════════

export function buildDeck() {
  // Formato { id, number } igual a v1 (sin type/cardClass/personality,
  // esas dimensiones están en hold para v2).
  return Array.from({ length: 64 }, (_, i) => {
    const n = i + 1;
    return { id: n, number: n };
  });
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function slotsForTree(tree) {
  return Math.pow(2, tree.height) - 1;
}

export function totalSlots(level) {
  return level.trees.reduce((sum, t) => sum + slotsForTree(t), 0);
}

// ── Escenario A — Información Mixta — 12 niveles (spec cerrada) ──────
export const LEVELS_A = [
  { id: 1,  scenario: "A", label: "A1",  trees: [{ type: "bst", height: 3 }], extraCards: 2, hiddenFraction: 0.20, agency: "any",          freeCardsOnTable: 0 },
  { id: 2,  scenario: "A", label: "A2",  trees: [{ type: "bst", height: 3 }], extraCards: 2, hiddenFraction: 0.40, agency: "any",          freeCardsOnTable: 0 },
  { id: 3,  scenario: "A", label: "A3",  trees: [{ type: "bst", height: 3 }], extraCards: 1, hiddenFraction: 0.40, agency: "fixedNeighbor", freeCardsOnTable: 0 },
  { id: 4,  scenario: "A", label: "A4",  trees: [{ type: "pyramid", height: 3 }], extraCards: 1, hiddenFraction: 0.60, agency: "any",          freeCardsOnTable: 0 },
  { id: 5,  scenario: "A", label: "A5",  trees: [{ type: "pyramid", height: 3 }], extraCards: 1, hiddenFraction: 0.60, agency: "fixedNeighbor", freeCardsOnTable: 2 },
  { id: 6,  scenario: "A", label: "A6",  trees: [{ type: "bst", height: 4 }], extraCards: 3, hiddenFraction: 0.40, agency: "any",          freeCardsOnTable: 0 },
  { id: 7,  scenario: "A", label: "A7",  trees: [{ type: "bst", height: 4 }], extraCards: 2, hiddenFraction: 0.60, agency: "fixedNeighbor", freeCardsOnTable: 0 },
  { id: 8,  scenario: "A", label: "A8",  trees: [{ type: "bst", height: 3 }, { type: "bst", height: 3 }], extraCards: 2, hiddenFraction: 0.50, agency: "any", freeCardsOnTable: 2 },
  { id: 9,  scenario: "A", label: "A9",  trees: [{ type: "bst", height: 4 }, { type: "pyramid", height: 3 }], extraCards: 2, hiddenFraction: 0.70, agency: "fixedNeighbor", freeCardsOnTable: 0 },
  { id: 10, scenario: "A", label: "A10", trees: [{ type: "bst", height: 4 }], extraCards: 1, hiddenFraction: 0.80, agency: "any",          freeCardsOnTable: 0 },
  { id: 11, scenario: "A", label: "A11", trees: [{ type: "bst", height: 4 }], extraCards: 2, hiddenFraction: 0.50, agency: "ownerAlways", freeCardsOnTable: 0 },
  { id: 12, scenario: "A", label: "A12", trees: [{ type: "bst", height: 4 }, { type: "bst", height: 4 }], extraCards: 3, hiddenFraction: 0.50, agency: "ownerAlways", freeCardsOnTable: 0 },
];

// ── Escenario B — Revelación Tardía — 20 niveles (spec cerrada) ──────
// Ver docs/BST_v2_Escenario_Revelacion_Tardia.md. Misma geometría heap
// que BST para ambas familias (slotsForTree ya cubre esto sin cambios:
// Pirámide reusa tree.height con la fórmula 2^height-1, solo que el
// vértice queda en pos 1 y la base en la última fila — ver gameLogic.js
// para las funciones específicas de Pirámide-B).
// energy: energía inicial compartida (8-16; 1 = nivel "instantáneo").
// revealThreshold/contradictionPenalty se mantienen por compatibilidad
// con BST_v2_Escenario_B_Convenciones.md, pero la regla real vive en
// gameLogic.js (resolveBSTCascade / resolvePyramidParentPlay) — estos
// campos ya no controlan comportamiento, son metadata descriptiva.
export const LEVELS_B = [
  { id: 101, scenario: "B", label: "BST N1",  trees: [{ type: "bst", height: 3 }], energy: 16,
    revealThreshold: "twoChildren", contradictionPenalty: "discardSubtree" },
  { id: 102, scenario: "B", label: "BST N2",  trees: [{ type: "bst", height: 3 }, { type: "bst", height: 3 }], energy: 16,
    revealThreshold: "twoChildren", contradictionPenalty: "discardSubtree" },
  { id: 103, scenario: "B", label: "BST N3",  trees: [{ type: "bst", height: 4 }], energy: 14,
    revealThreshold: "twoChildren", contradictionPenalty: "discardSubtree" },
  { id: 104, scenario: "B", label: "BST N4",  trees: [{ type: "bst", height: 3 }], energy: 10,
    revealThreshold: "twoChildren", contradictionPenalty: "discardSubtree" },
  { id: 105, scenario: "B", label: "BST N5",  trees: [{ type: "bst", height: 4 }, { type: "bst", height: 4 }], energy: 14,
    revealThreshold: "twoChildren", contradictionPenalty: "discardSubtree" },
  { id: 106, scenario: "B", label: "BST N6",  trees: [{ type: "bst", height: 5 }], energy: 12,
    revealThreshold: "twoChildren", contradictionPenalty: "discardSubtree" },
  { id: 107, scenario: "B", label: "BST N7",  trees: [{ type: "bst", height: 4 }], energy: 8,
    revealThreshold: "twoChildren", contradictionPenalty: "discardSubtree" },
  { id: 108, scenario: "B", label: "BST N8",  trees: [{ type: "bst", height: 5 }, { type: "bst", height: 5 }], energy: 16,
    revealThreshold: "twoChildren", contradictionPenalty: "discardSubtree" },
  { id: 109, scenario: "B", label: "BST N9",  trees: [{ type: "bst", height: 5 }], energy: 9,
    revealThreshold: "twoChildren", contradictionPenalty: "discardSubtree" },
  { id: 110, scenario: "B", label: "BST N10", trees: [{ type: "bst", height: 4 }], energy: 1,
    revealThreshold: "twoChildren", contradictionPenalty: "discardSubtree" },

  { id: 111, scenario: "B", label: "Pirámide N1",  trees: [{ type: "pyramid", height: 3 }], energy: 16,
    revealThreshold: "onePairParent", contradictionPenalty: "discardTriple" },
  { id: 112, scenario: "B", label: "Pirámide N2",  trees: [{ type: "pyramid", height: 3 }, { type: "pyramid", height: 3 }], energy: 16,
    revealThreshold: "onePairParent", contradictionPenalty: "discardTriple" },
  { id: 113, scenario: "B", label: "Pirámide N3",  trees: [{ type: "pyramid", height: 4 }], energy: 14,
    revealThreshold: "onePairParent", contradictionPenalty: "discardTriple" },
  { id: 114, scenario: "B", label: "Pirámide N4",  trees: [{ type: "pyramid", height: 3 }], energy: 10,
    revealThreshold: "onePairParent", contradictionPenalty: "discardTriple" },
  { id: 115, scenario: "B", label: "Pirámide N5",  trees: [{ type: "pyramid", height: 4 }, { type: "pyramid", height: 4 }], energy: 14,
    revealThreshold: "onePairParent", contradictionPenalty: "discardTriple" },
  { id: 116, scenario: "B", label: "Pirámide N6",  trees: [{ type: "pyramid", height: 5 }], energy: 12,
    revealThreshold: "onePairParent", contradictionPenalty: "discardTriple" },
  { id: 117, scenario: "B", label: "Pirámide N7",  trees: [{ type: "pyramid", height: 4 }], energy: 8,
    revealThreshold: "onePairParent", contradictionPenalty: "discardTriple" },
  { id: 118, scenario: "B", label: "Pirámide N8",  trees: [{ type: "pyramid", height: 5 }, { type: "pyramid", height: 5 }], energy: 16,
    revealThreshold: "onePairParent", contradictionPenalty: "discardTriple" },
  { id: 119, scenario: "B", label: "Pirámide N9",  trees: [{ type: "pyramid", height: 5 }], energy: 9,
    revealThreshold: "onePairParent", contradictionPenalty: "discardTriple" },
  { id: 120, scenario: "B", label: "Pirámide N10", trees: [{ type: "pyramid", height: 4 }], energy: 1,
    revealThreshold: "onePairParent", contradictionPenalty: "discardTriple" },
];

export function getLevelById(id) {
  return [...LEVELS_A, ...LEVELS_B].find(l => l.id === id) || null;
}

export function fixedNeighborMap(playerIds) {
  // Vecino fijo = el siguiente jugador en la lista de la sala
  // (rotación simple, fija para todo el nivel).
  const map = {};
  for (let i = 0; i < playerIds.length; i++) {
    map[playerIds[i]] = playerIds[(i + 1) % playerIds.length];
  }
  return map;
}

window.GameDataV2 = {
  buildDeck, shuffle, slotsForTree, totalSlots,
  LEVELS_A, LEVELS_B, getLevelById, fixedNeighborMap,
};
