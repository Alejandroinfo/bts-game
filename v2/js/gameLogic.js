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

// ════════════════════════════════════════════════════════════════
// ESCENARIO B — Revelación Tardía
// Ver docs/BST_v2_Escenario_Revelacion_Tardia.md para la spec completa.
// board sigue la misma convención que el resto del archivo: objeto con
// claves STRING ("1","2",...), nodos como { number, revealed }.
// ════════════════════════════════════════════════════════════════

// ── BST — cascada de revelación top-down ────────────────────────────
// Un nodo se revela cuando tiene sus 2 hijos jugados Y su propio padre
// ya está revelado (la raíz no tiene padre: le basta con sus 2 hijos).
// Caso especial: un nodo de la última fila (no puede tener hijos,
// excede la profundidad) se revela apenas su padre está revelado,
// sin esperar hijos que nunca podrá tener.
// Al revelarse, se valida contra el padre (heap-order BST). Si falla,
// se descarta el nodo + todo su subárbol (revelado o no). La cascada
// es siempre top-down: nunca se sigue bajando por una rama recién
// borrada en la misma pasada.
// Devuelve { discardedGroups: [[pos,...], ...], events: [...] }.
function resolveBSTCascade(board, maxNodes) {
  const discardedGroups = [];
  const events = [];
  const queue = [1];

  while (queue.length) {
    const pos = queue.shift();
    const node = getNode(board, pos);
    if (!node) continue;

    const isRoot = pos === 1;
    const parentNode = isRoot ? null : getNode(board, Math.floor(pos / 2));
    const parentRevealed = isRoot || (parentNode && parentNode.revealed);
    const isLeaf = pos * 2 > maxNodes; // última fila: no puede tener hijos
    const readyToReveal = isLeaf ? parentRevealed : (countChildren(board, pos) === 2 && parentRevealed);

    if (!node.revealed && readyToReveal) {
      node.revealed = true;
      events.push({ type: "reveal", pos, value: node.number });

      if (!isRoot) {
        const isLeftChild = pos % 2 === 0;
        const valid = isLeftChild ? node.number < parentNode.number : node.number > parentNode.number;
        if (!valid) {
          const subtree = collectSubtreePositions(board, pos, maxNodes);
          // Capturar valores ANTES de borrar — necesarios para que el
          // mazo de descarte conserve el número real de cada carta
          // (de lo contrario "robar" devolvería cartas sin valor).
          const discardedValues = {};
          subtree.forEach(p => {
            const n = getNode(board, p);
            if (n) discardedValues[p] = n.number;
          });
          discardedGroups.push(subtree);
          events.push({ type: "contradiction", pos, parentPos: Math.floor(pos / 2), subtree, discardedValues });
          subtree.forEach(p => { delete board[String(p)]; });
          continue; // no seguimos bajando por una rama recién borrada
        }
      }
    }
    if (getNode(board, pos * 2)) queue.push(pos * 2);
    if (getNode(board, pos * 2 + 1)) queue.push(pos * 2 + 1);
  }

  return { discardedGroups, events };
}

function collectSubtreePositions(board, pos, maxNodes) {
  const result = [];
  const stack = [pos];
  while (stack.length) {
    const p = stack.pop();
    if (p > maxNodes) continue;
    result.push(p);
    if (getNode(board, p * 2)) stack.push(p * 2);
    if (getNode(board, p * 2 + 1)) stack.push(p * 2 + 1);
  }
  return result;
}

// ── Pirámide-B — revelación simultánea de pareja + validación por fila ──
// A diferencia de isValidPyramidPlacement (Escenario A, que compara el
// padre contra cada hijo), B revela AMBOS hijos a la vez cuando se juega
// el padre, y valida cada hijo contra los demás hijos YA REVELADOS de su
// misma fila (toda la fila debe quedar ascendente izquierda→derecha).
function canPlayAsPyramidParentB(board, pos, height) {
  const maxNodes = Math.pow(2, height) - 1;
  if (isPyramidBasePosition(pos, height)) return false; // es base, no tiene hijos
  if (pos < 1 || pos > maxNodes) return false;
  if (getNode(board, pos)) return false; // ya ocupada
  return countChildren(board, pos) === 2;
}

function rowPositionsOfB(pos) {
  const level = Math.floor(Math.log2(pos));
  const rowStart = Math.pow(2, level);
  const rowEnd = Math.pow(2, level + 1) - 1;
  const out = [];
  for (let p = rowStart; p <= rowEnd; p++) out.push(p);
  return out;
}

function validateChildAgainstRowB(board, pos) {
  const rowPositions = rowPositionsOfB(pos);
  const idx = rowPositions.indexOf(pos);
  const node = getNode(board, pos);
  if (!node) return true;
  for (let i = 0; i < idx; i++) {
    const other = getNode(board, rowPositions[i]);
    if (other && other.revealed && !(node.number > other.number)) return false;
  }
  for (let i = idx + 1; i < rowPositions.length; i++) {
    const other = getNode(board, rowPositions[i]);
    if (other && other.revealed && !(node.number < other.number)) return false;
  }
  return true;
}

// Llamar justo después de colocar la carta del padre en `parentPos`.
// Revela ambos hijos y valida. Si falla, descarta padre+2 hijos (evento
// aislado de 3 cartas, sin cascada hacia arriba — estructuralmente
// imposible que el padre recién jugado ya tenga su propio padre).
function resolvePyramidParentPlay(board, parentPos) {
  const leftPos = parentPos * 2;
  const rightPos = parentPos * 2 + 1;
  const left = getNode(board, leftPos);
  const right = getNode(board, rightPos);
  left.revealed = true;
  right.revealed = true;

  const leftOk = validateChildAgainstRowB(board, leftPos);
  const rightOk = validateChildAgainstRowB(board, rightPos);

  if (!leftOk || !rightOk) {
    const discarded = [parentPos, leftPos, rightPos];
    const discardedValues = {
      [parentPos]: getNode(board, parentPos).number,
      [leftPos]: left.number,
      [rightPos]: right.number,
    };
    delete board[String(parentPos)];
    delete board[String(leftPos)];
    delete board[String(rightPos)];
    return { ok: false, discarded, discardedValues };
  }
  return { ok: true, revealedNow: [leftPos, rightPos] };
}

// ── Demoler ──────────────────────────────────────────────────────────
// BST: destruye la carta + su subárbol hacia las HOJAS.
// Devuelve { group: [pos,...], values: {pos: number, ...} } o null.
function demolishBST(board, pos, maxNodes) {
  const node = getNode(board, pos);
  if (!node || node.revealed) return null;
  const group = collectSubtreePositions(board, pos, maxNodes);
  const values = {};
  group.forEach(p => { const n = getNode(board, p); if (n) values[p] = n.number; });
  group.forEach(p => delete board[String(p)]);
  return { group, values };
}

// Pirámide-B: destruye la carta + todo lo que está hacia el VÉRTICE
// (sus padres, abuelos...). Los hijos de la carta demolida (si era a su
// vez un padre) NO se destruyen.
function demolishPyramid(board, pos) {
  const node = getNode(board, pos);
  if (!node || node.revealed) return null;
  const group = [pos];
  let p = pos;
  while (p > 1) {
    p = Math.floor(p / 2);
    if (getNode(board, p)) group.push(p);
    else break;
  }
  const values = {};
  group.forEach(p2 => { const n = getNode(board, p2); if (n) values[p2] = n.number; });
  group.forEach(p2 => delete board[String(p2)]);
  return { group, values };
}

window.GameLogicV2 = {
  getNode, findBSTPosition, countChildren,
  isValidPyramidPlacement, isPyramidBasePosition, getPyramidBaseRow,
  isVisibleTo, canAct,
  resolveBSTCascade, resolvePyramidParentPlay, demolishBST, demolishPyramid,
  canPlayAsPyramidParentB,
};
