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

// ── Escenario B — Revelación Tardía — placeholder hasta spec cerrada ──
// Ver BST_v2_Escenario_B_Convenciones.md. NO representa dificultad real
// todavía; solo permite navegar la UI con revelación tardía simulada
// de forma mínima (regla fija: revela al tener 2 hijos).
export const LEVELS_B = [
  { id: 101, scenario: "B", label: "B1 (placeholder)", trees: [{ type: "bst", height: 3 }], extraCards: 2,
    revealThreshold: "twoChildren", contradictionPenalty: "discardInvolved", livesMargin: 5, freeCardsOnTable: 0, placeholder: true },
  { id: 102, scenario: "B", label: "B2 (placeholder)", trees: [{ type: "bst", height: 4 }], extraCards: 3,
    revealThreshold: "twoChildren", contradictionPenalty: "discardInvolved", livesMargin: 5, freeCardsOnTable: 0, placeholder: true },
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
