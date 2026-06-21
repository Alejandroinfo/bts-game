// ════════════════════════════════════════════════════════════════
// GAME LOGIC — Ubicación automática en árbol BST y Pirámide
// ════════════════════════════════════════════════════════════════
//
// El jugador NUNCA elige posición. Solo elige qué carta jugar.
// La posición se calcula automáticamente según las reglas de cada
// estructura. Si no hay espacio válido, la carta no se puede jugar.
//
// board es un objeto { "1": card, "2": card, ... } indexado 1-based
// en orden de nivel (level-order), igual que un heap binario:
//   pos 1 = raíz/ápice
//   pos 2*p = hijo izquierdo de p
//   pos 2*p+1 = hijo derecho de p
// ════════════════════════════════════════════════════════════════

function parent(pos) { return Math.floor(pos / 2); }
function leftChild(pos) { return pos * 2; }
function rightChild(pos) { return pos * 2 + 1; }

function getNode(board, pos) {
  return (board && board[String(pos)]) || null;
}

// ────────────────────────────────────────────────────────────────
// BST — Baja desde la raíz comparando valores hasta encontrar
// el primer espacio vacío. Si llega al fondo sin espacio, no cabe.
// ────────────────────────────────────────────────────────────────
function findBSTPosition(board, value, maxNodes) {
  let pos = 1;
  while (pos <= maxNodes) {
    const node = getNode(board, pos);
    if (!node) return pos;
    if (value === node.number) return null;
    pos = value < node.number ? leftChild(pos) : rightChild(pos);
  }
  return null;
}

// ────────────────────────────────────────────────────────────────
// PIRÁMIDE — Modelo de "secuencia dinámica por fila".
//
// Cada fila (desde la base hacia el ápice) se trata como una
// secuencia de cartas YA COLOCADAS, ordenada de izquierda a
// derecha por valor. Esa secuencia se va llenando con el orden de
// llegada de las cartas, NO con posiciones de heap fijas desde el
// inicio.
//
// Regla de colocación para una carta nueva en una fila:
//   - Si la fila está vacía -> es la primera, se coloca sola.
//   - Si es menor que todas las de la fila -> se vuelve el nuevo
//     extremo izquierdo de esa fila.
//   - Si es mayor que todas las de la fila -> se vuelve el nuevo
//     extremo derecho de esa fila.
//   - Si cae EXACTAMENTE entre dos cartas que ya son vecinas
//     adyacentes en esa fila -> en vez de insertarse en esa fila,
//     SUBE como hijo de ese par, ocupando el slot de la fila
//     superior que corresponde a esas dos cartas. Las dos cartas
//     de abajo quedan fijas para siempre; el único espacio que se
//     genera entre ellas es ese slot de arriba.
//   - Si no cabe en ninguno de los casos anteriores (ej: cae entre
//     dos cartas que no son vecinas, o la fila superior ya está
//     ocupada en ese slot) -> no se puede jugar.
//
// Las "filas" se representan como listas ordenadas de nodos del
// heap; cada nodo del heap pertenece a una fila fija según su
// profundidad, pero CUÁLES posiciones de esa fila están en uso, y
// en qué orden, se decide dinámicamente según el valor.
// ────────────────────────────────────────────────────────────────

// Devuelve todas las posiciones de heap que pertenecen a una fila
// (profundidad) dada, en un árbol de `height` niveles.
// row=0 es la base (la fila más abajo), row=height-1 es el ápice.
function getRowPositions(height, row) {
  const depthFromTop = height - 1 - row; // profundidad real en el heap (0 = raíz/ápice)
  const start = Math.pow(2, depthFromTop);
  const end = Math.pow(2, depthFromTop + 1) - 1;
  const positions = [];
  for (let p = start; p <= end; p++) positions.push(p);
  return positions;
}

// Devuelve, para una fila dada, la lista de { pos, value } ya
// colocados, ordenada de izquierda a derecha (es decir, en el
// mismo orden que getRowPositions ya entrega, que coincide con
// el orden visual izquierda->derecha del heap).
function getRowSlots(board, height, row) {
  const positions = getRowPositions(height, row);
  const slots = [];
  for (const pos of positions) {
    const node = getNode(board, pos);
    if (node) slots.push({ pos, value: node.number });
  }
  return slots;
}

// Busca, dentro de una fila, el primer slot de heap vacío que sea
// "compatible" para extender la secuencia hacia la izquierda o
// derecha del extremo dado. Como las posiciones de heap de una
// fila están fijas en cantidad (2^depth), simplemente usamos el
// siguiente slot vacío contiguo en la lista de posiciones de esa
// fila, en la dirección solicitada.
function findRowSlot(board, positions, filledSlots, direction) {
  // direction: 'left' o 'right'
  if (filledSlots.length === 0) {
    // Fila vacía: empezar por el slot central para dejar margen a ambos lados
    const mid = positions[Math.floor((positions.length - 1) / 2)];
    return getNode(board, mid) ? null : mid;
  }

  const filledPositions = filledSlots.map(s => s.pos);
  const idxInRow = (pos) => positions.indexOf(pos);

  if (direction === "left") {
    const leftmostIdx = idxInRow(filledSlots[0].pos);
    if (leftmostIdx <= 0) return null; // no hay más espacio a la izquierda en esta fila
    const candidate = positions[leftmostIdx - 1];
    return getNode(board, candidate) ? null : candidate;
  } else {
    const rightmostIdx = idxInRow(filledSlots[filledSlots.length - 1].pos);
    if (rightmostIdx >= positions.length - 1) return null; // no hay más espacio a la derecha
    const candidate = positions[rightmostIdx + 1];
    return getNode(board, candidate) ? null : candidate;
  }
}

// Encuentra, dentro de una fila ya con cartas, un par de vecinas
// ADYACENTES EN LA SECUENCIA (no necesariamente adyacentes en el
// heap) entre las cuales cae el valor nuevo. Si las encuentra,
// calcula la posición del "hijo" en la fila superior que les
// corresponde: el punto medio entre sus dos posiciones de heap,
// que siempre es válido porque ambas pertenecen a la misma rama.
function findParentSlotBetween(board, height, row, value, filledSlots) {
  // filledSlots viene ordenado izquierda->derecha por posición
  // VISUAL real en la fila (índice dentro de `positions`, la lista
  // completa de slots de heap de esa fila), no por orden de
  // llegada. Cada par de vecinas EN LA SECUENCIA genera un slot
  // fijo en la fila superior, determinado por la posición real que
  // esas dos cartas ocupan dentro de TODOS los slots posibles de su
  // fila: el slot de arriba en el índice floor(idxIzquierda / 2).
  // Esto es correcto sin importar el orden de llegada, porque el
  // índice se calcula sobre la posición final en la fila, no sobre
  // el orden en que filledSlots fue llenándose.

  const rowPositions = getRowPositions(height, row);
  const upperPositions = getRowPositions(height, row + 1);

  for (let i = 0; i < filledSlots.length - 1; i++) {
    const left = filledSlots[i];
    const right = filledSlots[i + 1];
    if (value > left.value && value < right.value) {
      const leftRowIdx = rowPositions.indexOf(left.pos);
      const rightRowIdx = rowPositions.indexOf(right.pos);

      // Deben ser físicamente adyacentes en la fila (columnas
      // consecutivas) para que exista UN slot de padre común.
      if (rightRowIdx !== leftRowIdx + 1) continue;

      const upperIdx = Math.floor(leftRowIdx / 2);
      const upperPos = upperPositions[upperIdx];

      if (upperPos === undefined) continue;
      if (getNode(board, upperPos)) continue; // ya ocupado

      return upperPos;
    }
  }
  return null;
}

function findPyramidPosition(board, value, height) {
  // Recorremos desde la base (row=0) hacia el ápice, intentando
  // colocar en cada fila. Si en la fila actual el valor cabe como
  // nuevo extremo (izq/der) o como primera carta, se coloca ahí.
  // Si cae entre dos vecinas de secuencia que SÍ son vecinas reales
  // de heap, sube como su hijo en la fila siguiente. Si no logra
  // colocarse en ninguna fila, la carta no se puede jugar.

  for (let row = 0; row < height; row++) {
    const positions = getRowPositions(height, row);
    const filled = getRowSlots(board, height, row);

    // La inserción DIRECTA (primera carta, extremo izq/der) solo
    // aplica a la BASE (row 0). Las filas superiores nunca se
    // llenan por inserción directa: solo reciben cartas que suben
    // desde la fila de abajo como hijo de un par de vecinas.
    if (row === 0) {
      const isFull = filled.length === positions.length;
      if (!isFull) {
        if (filled.length === 0) {
          const mid = positions[Math.floor((positions.length - 1) / 2)];
          if (!getNode(board, mid)) return mid;
        } else {
          const leftmost = filled[0];
          const rightmost = filled[filled.length - 1];

          if (value < leftmost.value) {
            const slot = findRowSlot(board, positions, filled, "left");
            if (slot !== null) return slot;
          } else if (value > rightmost.value) {
            const slot = findRowSlot(board, positions, filled, "right");
            if (slot !== null) return slot;
          }
        }
      }
    }

    // ¿Cae entre dos vecinas de secuencia? Intentar subir.
    const parentSlot = findParentSlotBetween(board, height, row, value, filled);
    if (parentSlot !== null) return parentSlot;

    // Si no se pudo colocar ni subir en esta fila, seguimos
    // revisando las filas superiores: el valor puede caer entre
    // dos cartas que ya subieron a una fila más alta (como en el
    // caso del ápice, que depende de pares ya resueltos en la fila
    // intermedia, no en la base).
  }

  return null;
}

// ────────────────────────────────────────────────────────────────
// Punto de entrada único
// ────────────────────────────────────────────────────────────────
function findAutoPosition(board, value, levelType, height) {
  const maxNodes = Math.pow(2, height) - 1;
  if (levelType === "BST") {
    return findBSTPosition(board, value, maxNodes);
  }
  return findPyramidPosition(board, value, height);
}

// ────────────────────────────────────────────────────────────────
// HYPERACTIVE — Simula que la carta se jugó ANTES que la última
// carta colocada, en vez de después. Solo afecta a esas dos
// cartas (la última jugada y la Hyperactiva); el resto del tablero
// se mantiene exactamente igual.
//
// Algoritmo:
//   1. Quitar del tablero la última carta jugada (lastPos)
//   2. Calcular dónde caería la carta Hyperactiva en ese tablero
//      reducido (sin la última)
//   3. Calcular dónde caería la carta removida en el tablero
//      resultante (ya con la Hyperactiva puesta)
//   4. Si AMBAS encuentran posición válida -> se puede usar
//      Hyperactive. Si cualquiera falla -> no se puede usar (la
//      habilidad es opcional, el jugador puede jugar normal).
//
// Devuelve null si no es válido, o
// { hyperPos, lastPos, lastValue } si sí lo es.
// ────────────────────────────────────────────────────────────────
function tryHyperactiveReorder(board, hyperValue, lastPos, lastValue, levelType, height) {
  // Tablero sin la última carta
  const reducedBoard = Object.assign({}, board);
  delete reducedBoard[String(lastPos)];

  // Paso 1: ¿dónde caería la Hyperactiva en el tablero reducido?
  const hyperPos = findAutoPosition(reducedBoard, hyperValue, levelType, height);
  if (hyperPos === null) return null;

  // Paso 2: colocar la Hyperactiva ahí, y recalcular dónde cae
  // ahora la carta que antes era la última.
  const boardWithHyper = Object.assign({}, reducedBoard, {
    [String(hyperPos)]: { number: hyperValue },
  });
  const newLastPos = findAutoPosition(boardWithHyper, lastValue, levelType, height);
  if (newLastPos === null) return null;

  return { hyperPos, newLastPos, lastValue };
}

// ────────────────────────────────────────────────────────────────
// SHY — Pila LIFO de cartas en espera. Una carta Shy NO se coloca
// de inmediato: se apila. Cuando se juega una carta NORMAL, se
// libera TODA la pila en orden LIFO (la última Shy apilada se
// coloca primero). Cada carta liberada se inserta con las reglas
// normales de auto-posición EN ESE MOMENTO; si para entonces ya no
// tiene espacio válido, se descarta (no vuelve a la mano).
//
// Límite dinámico: una carta Shy solo puede apilarse si el tamaño
// de la pila resultante (stackSize + 1) es ESTRICTAMENTE MENOR que
// la cantidad de espacios vacíos disponibles ANTES de jugarla. Si
// no se cumple, esa carta se juega como NORMAL (no se apila).
// ────────────────────────────────────────────────────────────────
function canStackShy(currentStackSize, emptySlotsBefore) {
  return (currentStackSize + 1) < emptySlotsBefore;
}

// Libera la pila completa en orden LIFO sobre un tablero dado.
// stack = [{ playerId, cardId, card }, ...] en orden de inserción
// (el último elemento es el que se liberará PRIMERO).
// Devuelve { placements: [{ pos, card, playerId, cardId }], discarded: [...] }
function resolveShyStack(board, stack, levelType, height) {
  const placements = [];
  const discarded = [];
  let workingBoard = Object.assign({}, board);

  // Recorrer la pila de atrás hacia adelante (LIFO: último entra, primero sale)
  for (let i = stack.length - 1; i >= 0; i--) {
    const entry = stack[i];
    const pos = findAutoPosition(workingBoard, entry.card.number, levelType, height);
    if (pos === null) {
      discarded.push(entry);
    } else {
      workingBoard[String(pos)] = entry.card;
      placements.push({ pos, card: entry.card, playerId: entry.playerId, cardId: entry.cardId });
    }
  }

  return { placements, discarded, finalBoard: workingBoard };
}

// ────────────────────────────────────────────────────────────────
// FAMILIAR — Resolución pura del pase simultáneo de cartas.
//
// playerIds: array en el orden de la lista de jugadores de la sala
// hands: { playerId: { cardId: card, ... }, ... } — manos actuales
// choices: { playerId: cardId | null, ... } — qué eligió pasar
//          cada jugador (null = no tenía ninguna Familiar)
//
// "Izquierda" = siguiente jugador en la lista (circular).
//
// Devuelve { newHands, totalPassed } sin mutar los objetos de
// entrada, para que sea fácil testear sin efectos secundarios.
// ────────────────────────────────────────────────────────────────
function resolveFamiliarPass(playerIds, hands, choices) {
  const newHands = {};
  for (const pid of playerIds) {
    newHands[pid] = Object.assign({}, hands[pid] || {});
  }

  // Paso 1: quitar de cada mano la carta elegida (si eligió alguna)
  const passedCard = {};
  for (const pid of playerIds) {
    const cardId = choices[pid];
    if (cardId && newHands[pid][cardId]) {
      passedCard[pid] = newHands[pid][cardId];
      delete newHands[pid][cardId];
    } else {
      passedCard[pid] = null;
    }
  }

  // Paso 2: repartir a cada vecino de la izquierda lo que le toca
  let totalPassed = 0;
  for (let i = 0; i < playerIds.length; i++) {
    const pid = playerIds[i];
    const card = passedCard[pid];
    if (!card) continue;
    const targetId = playerIds[(i + 1) % playerIds.length]; // izquierda = siguiente en la lista
    newHands[targetId][card.id] = card;
    totalPassed++;
  }

  return { newHands, totalPassed };
}

// ────────────────────────────────────────────────────────────────
// ORDERLY — Al jugar una carta Ordenada, otorga +1pt si su padre
// o alguno de sus hijos YA colocados en el árbol tiene una
// diferencia EXACTA de ±1 respecto a su valor. Se evalúa solo en
// el instante en que se coloca la carta (no retroactivo).
// ────────────────────────────────────────────────────────────────
function checkOrderlyBonus(board, pos, value) {
  const p = parent(pos);
  const lc = leftChild(pos);
  const rc = rightChild(pos);

  const neighbors = [getNode(board, p), getNode(board, lc), getNode(board, rc)]
    .filter(n => n !== null);

  return neighbors.some(n => Math.abs(n.number - value) === 1);
}

function countFilledNodes(board) {
  return Object.entries(board || {})
    .filter(([key, c]) => key !== "_init" && c !== null && c !== undefined)
    .length;
}

function countEmptyNodes(board, totalNodes) {
  return totalNodes - countFilledNodes(board);
}

window.GameLogic = {
  parent, leftChild, rightChild, getNode,
  findBSTPosition, findPyramidPosition, findAutoPosition,
  getRowPositions, getRowSlots, checkOrderlyBonus, tryHyperactiveReorder,
  canStackShy, resolveShyStack, resolveFamiliarPass,
  countFilledNodes, countEmptyNodes,
};
