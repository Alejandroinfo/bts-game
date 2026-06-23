// ════════════════════════════════════════════════════════════════
// GAME LOGIC — BST + Pirámide basada en PyramidBlocks
// ════════════════════════════════════════════════════════════════
//
// Este archivo mantiene la lógica BST original intacta,
// pero reemplaza COMPLETAMENTE la lógica de pirámide por
// PyramidBlocks, que es la fuente de verdad.
//
// El tablero (board) se convierte a un estado PyramidBlocks,
// se inserta el valor, y luego se convierte de vuelta a board.
//
// Esto garantiza que:
//   - BST funciona igual que antes
//   - Pirámide usa el sistema correcto (bloques flotantes)
//   - Hyperactive y Shy funcionan en ambos niveles
//
// ════════════════════════════════════════════════════════════════


// ────────────────────────────────────────────────────────────────
// BST — Igual que antes
// ────────────────────────────────────────────────────────────────

function parent(pos) { return Math.floor(pos / 2); }
function leftChild(pos) { return pos * 2; }
function rightChild(pos) { return pos * 2 + 1; }

function getNode(board, pos) {
  return (board && board[String(pos)]) || null;
}

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



// ════════════════════════════════════════════════════════════════
// PIRÁMIDE — NUEVA IMPLEMENTACIÓN BASADA EN PyramidBlocks
// ════════════════════════════════════════════════════════════════
//
// Necesitamos convertir entre:
//   board (heap plano)  ↔  PyramidBlocks (bloques flotantes)
//
// El board es solo para render y Firebase.
// PyramidBlocks es la lógica real.
//
// ════════════════════════════════════════════════════════════════


// Convierte board → PyramidBlocks
function boardToPyramid(board, height) {
  const pyramid = PyramidBlocks.createEmptyPyramid(height);

  // Insertar cada carta del board en orden de heap
  const entries = Object.entries(board)
    .filter(([k, v]) => v && v.number !== undefined)
    .map(([k, v]) => ({ pos: Number(k), value: v.number }))
    .sort((a, b) => a.pos - b.pos);

  for (const { value } of entries) {
    const res = PyramidBlocks.insertValue(pyramid, value);
    if (!res.ok) {
      console.warn("Error reconstruyendo pirámide desde board:", value);
    }
  }

  return pyramid;
}


// Convierte PyramidBlocks → board
function pyramidToBoard(pyramid) {
  const { board } = PyramidBlocks.resolveToBoard(
    pyramid,
    (v) => ({ number: v })
  );
  return board;
}


// Inserta un valor en la pirámide usando PyramidBlocks
function findPyramidPosition(board, value, height) {
  const pyramid = boardToPyramid(board, height);

  const result = PyramidBlocks.insertValue(pyramid, value);
  if (!result.ok) return null;

  const newBoard = pyramidToBoard(pyramid);

  // Encontrar dónde quedó el valor
  for (const pos in newBoard) {
    if (newBoard[pos].number === value) return Number(pos);
  }

  return null;
}



// ════════════════════════════════════════════════════════════════
// PUNTO DE ENTRADA ÚNICO
// ════════════════════════════════════════════════════════════════

function findAutoPosition(board, value, levelType, height) {
  if (levelType === "BST") {
    const maxNodes = Math.pow(2, height) - 1;
    return findBSTPosition(board, value, maxNodes);
  }

  // Pirámide → usar PyramidBlocks
  return findPyramidPosition(board, value, height);
}



// ════════════════════════════════════════════════════════════════
// HYPERACTIVE — Reordenamiento usando PyramidBlocks en pirámide
// ════════════════════════════════════════════════════════════════

function tryHyperactiveReorder(board, hyperValue, lastPos, lastValue, levelType, height) {
  if (levelType === "BST") {
    // BST usa la lógica original
    const reducedBoard = { ...board };
    delete reducedBoard[String(lastPos)];

    const hyperPos = findAutoPosition(reducedBoard, hyperValue, "BST", height);
    if (hyperPos === null) return null;

    const boardWithHyper = {
      ...reducedBoard,
      [String(hyperPos)]: { number: hyperValue }
    };

    const newLastPos = findAutoPosition(boardWithHyper, lastValue, "BST", height);
    if (newLastPos === null) return null;

    return { hyperPos, newLastPos, lastValue };
  }

  // PIRÁMIDE — usar PyramidBlocks
  const pyramidBefore = boardToPyramid(board, height);

  // Quitar la última carta
  const boardReduced = { ...board };
  delete boardReduced[String(lastPos)];
  const pyramidReduced = boardToPyramid(boardReduced, height);

  // Insertar Hyperactiva primero
  const res1 = PyramidBlocks.insertValue(pyramidReduced, hyperValue);
  if (!res1.ok) return null;

  // Insertar la carta removida
  const res2 = PyramidBlocks.insertValue(pyramidReduced, lastValue);
  if (!res2.ok) return null;

  // Convertir a board para encontrar posiciones
  const newBoard = pyramidToBoard(pyramidReduced);

  let hyperPos = null;
  let newLastPos = null;

  for (const pos in newBoard) {
    if (newBoard[pos].number === hyperValue) hyperPos = Number(pos);
    if (newBoard[pos].number === lastValue) newLastPos = Number(pos);
  }

  if (hyperPos === null || newLastPos === null) return null;

  return { hyperPos, newLastPos, lastValue };
}



// ════════════════════════════════════════════════════════════════
// SHY — Igual que antes, pero usando PyramidBlocks en pirámide
// ════════════════════════════════════════════════════════════════

function canStackShy(currentStackSize, emptySlotsBefore) {
  return (currentStackSize + 1) < emptySlotsBefore;
}

function resolveShyStack(board, stack, levelType, height) {
  if (levelType === "BST") {
    // Lógica original
    const placements = [];
    const discarded = [];
    let workingBoard = { ...board };

    for (let i = stack.length - 1; i >= 0; i--) {
      const entry = stack[i];
      const pos = findAutoPosition(workingBoard, entry.card.number, "BST", height);
      if (pos === null) {
        discarded.push(entry);
      } else {
        workingBoard[String(pos)] = entry.card;
        placements.push({ pos, card: entry.card, playerId: entry.playerId, cardId: entry.cardId });
      }
    }

    return { placements, discarded, finalBoard: workingBoard };
  }

  // PIRÁMIDE — usar PyramidBlocks
  let pyramid = boardToPyramid(board, height);
  const placements = [];
  const discarded = [];

  for (let i = stack.length - 1; i >= 0; i--) {
    const entry = stack[i];
    const res = PyramidBlocks.insertValue(pyramid, entry.card.number);
    if (!res.ok) {
      discarded.push(entry);
    } else {
      placements.push({ card: entry.card, playerId: entry.playerId, cardId: entry.cardId });
    }
  }

  const finalBoard = pyramidToBoard(pyramid);
  return { placements, discarded, finalBoard };
}



// ════════════════════════════════════════════════════════════════
// FAMILIAR — Igual que antes
// ════════════════════════════════════════════════════════════════

function resolveFamiliarPass(playerIds, hands, choices) {
  const newHands = {};
  for (const pid of playerIds) {
    newHands[pid] = { ...(hands[pid] || {}) };
  }

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

  let totalPassed = 0;
  for (let i = 0; i < playerIds.length; i++) {
    const pid = playerIds[i];
    const card = passedCard[pid];
    if (!card) continue;
    const targetId = playerIds[(i + 1) % playerIds.length];
    newHands[targetId][card.id] = card;
    totalPassed++;
  }

  return { newHands, totalPassed };
}



// ════════════════════════════════════════════════════════════════
// ORDERLY — Igual que antes
// ════════════════════════════════════════════════════════════════

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



// ════════════════════════════════════════════════════════════════
// EXPORT
// ════════════════════════════════════════════════════════════════

window.GameLogic = {
  parent, leftChild, rightChild, getNode,
  findBSTPosition, findPyramidPosition, findAutoPosition,
  tryHyperactiveReorder, canStackShy, resolveShyStack,
  resolveFamiliarPass, checkOrderlyBonus,
  countFilledNodes, countEmptyNodes,
};
