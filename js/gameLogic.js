// ════════════════════════════════════════════════════════════════
// GAME LOGIC — v2
// ════════════════════════════════════════════════════════════════
// findBSTPosition es una copia literal de v1 (js/gameLogic.js),
// probada y sin cambios — board sigue indexado como objeto con
// claves STRING ("1","2",...), igual que v1, para mantener
// compatibilidad de convenciones entre ambas versiones.
//
// canAct / isVisibleTo / isValidPyramidPlacement son específicas
// de v2 (Escenario A) — ver BST_v2_Escenario_A_InformacionMixta.md.
// ════════════════════════════════════════════════════════════════

function getNode(board, pos) {
  return (board && board[String(pos)]) || null;
}

// ── BST — idéntica a v1 ──────────────────────────────────────────
function findBSTPosition(board, value, maxNodes) {
  let pos = 1;
  while (pos <= maxNodes) {
    const node = getNode(board, pos);
    if (!node) return pos;
    if (value === node.number) return null;
    pos = value < node.number ? pos * 2 : pos * 2 + 1;
  }
  return null;
}

function countChildren(board, pos) {
  let n = 0;
  if (getNode(board, pos * 2)) n++;
  if (getNode(board, pos * 2 + 1)) n++;
  return n;
}

// ── Pirámide v2: pirámide normal, base ancha abajo ───────────────────
// Misma forma heap (2^(h-1) → ... → 4 → 2 → 1) que BST, pero pensada
// "de abajo hacia arriba": pos 1 = vértice (arriba), 2p/2p+1 = el par
// fijo de hijos que lo sostiene (abajo). Reemplaza el sistema de
// floating blocks de v1 — ver razón en BST_v2_Escenario_Revelacion_Tardia.md
// §6, adoptada también para la Pirámide del Escenario A por ser más
// simple de entender e implementar.
//
// Reglas (point-and-click/drag manual, NO automático):
//   - Una carta puede jugarse en la BASE (fila más profunda) si hay
//     espacio libre ahí.
//   - Una carta puede jugarse como PADRE de un par fijo de hijos
//     (pos*2 y pos*2+1) solo si AMBOS hijos ya están jugados — el
//     padre nunca se juega antes que sus hijos, al revés que BST.
//   - El padre debe ser mayor que el hijo izquierdo (2p) y menor que
//     el hijo derecho (2p+1) — mismo heap-order de siempre, solo que
//     se verifica DESPUÉS de que los hijos ya existen, no antes.
//   - Por decisión explícita: el regulador (point-and-click) PERMITE
//     posiciones incoherentes con el valor — no bloquea, solo se
//     puede marcar/registrar para revisión manual por ahora. Esto se
//     endurecerá más adelante; hoy la validación es informativa.
function getPyramidBaseRow(height) {
  // La base (fila más ancha, más profunda en el heap) son las
  // posiciones [2^(height-1) .. 2^height - 1].
  const start = Math.pow(2, height - 1);
  const end = Math.pow(2, height) - 1;
  const positions = [];
  for (let p = start; p <= end; p++) positions.push(p);
  return positions;
}

function isPyramidBasePosition(pos, height) {
  return pos >= Math.pow(2, height - 1) && pos <= Math.pow(2, height) - 1;
}

function isValidPyramidPlacement(board, pos, value, height) {
  const maxNodes = Math.pow(2, height) - 1;
  if (pos < 1 || pos > maxNodes) return false;
  if (getNode(board, pos)) return false;

  if (isPyramidBasePosition(pos, height)) {
    // Base: siempre se puede jugar si el espacio está libre, sin
    // ninguna restricción de valor respecto a vecinos (eso se evalúa
    // después, cuando alguien intente jugar el padre encima).
    return true;
  }

  // No-base: es un slot de PADRE — exige que su par fijo de hijos
  // (2*pos y 2*pos+1) ya esté jugado. Si cualquiera de los dos falta,
  // todavía no es jugable (el regulador debería impedirlo; hoy se
  // permite igual y se marca como incoherente más abajo).
  const leftChild = getNode(board, pos * 2);
  const rightChild = getNode(board, pos * 2 + 1);
  if (!leftChild || !rightChild) return false; // hijos incompletos: ni siquiera el regulador debería dejar esto

  // Heap-order normal: padre > hijo izquierdo, padre < hijo derecho.
  if (value <= leftChild.number) return false;
  if (value >= rightChild.number) return false;
  return true;
}

// ── Visibilidad cruzada (Escenario A) ───────────────────────────────
// Una carta oculta para su dueño es visible para TODOS los demás
// jugadores (no solo un vecino) — la restricción real está en quién
// puede JUGARLA (canAct), no en quién puede verla. Ver
// BST_v2_Escenario_A_InformacionMixta.md §9.
function isVisibleTo(card, ownerId, viewerId) {
  if (ownerId === viewerId) return !card.hiddenFromOwner;
  return !!card.hiddenFromOwner;
}

// ── Agencia (Escenario A) ───────────────────────────────────────────
// ¿Puede `actingId` jugar esta carta de `ownerId`?
function canAct(level, ownerId, actingId, card, fixedNeighborOf) {
  if (ownerId === actingId) {
    if (!card.hiddenFromOwner) return true;
    return level.agency === "ownerAlways";
  }
  if (!card.hiddenFromOwner) return false;
  if (level.agency === "any") return true;
  if (level.agency === "fixedNeighbor") return fixedNeighborOf[ownerId] === actingId;
  return false; // "ownerAlways": nadie más puede jugar la carta de otro dueño
}

window.GameLogicV2 = {
  getNode, findBSTPosition, countChildren,
  isValidPyramidPlacement, isPyramidBasePosition, getPyramidBaseRow,
  isVisibleTo, canAct,
};
