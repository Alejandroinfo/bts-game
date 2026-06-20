// ════════════════════════════════════════════════════════════════
// GAME LOGIC — Validación de árbol BST y Pirámide
// ════════════════════════════════════════════════════════════════

function parent(pos) { return Math.floor(pos / 2); }
function leftChild(pos) { return pos * 2; }
function rightChild(pos) { return pos * 2 + 1; }

// board es un objeto { "1": card, "2": null, ... } (Firebase no soporta
// arrays con huecos de forma confiable, usamos objeto con keys string)

function getNode(board, pos) {
  return board[String(pos)] || null;
}

function validateBSTPlacement(board, pos, value) {
  let cur = pos;
  while (cur > 1) {
    const p = parent(cur);
    const pNode = getNode(board, p);
    if (!pNode) return false; // el padre debe existir ya
    const pVal = pNode.number;
    if (cur === leftChild(p) && value >= pVal) return false;
    if (cur === rightChild(p) && value <= pVal) return false;
    cur = p;
  }
  return true;
}

function validatePyramidPlacement(board, pos, value, height) {
  const lc = leftChild(pos);
  const rc = rightChild(pos);
  const maxNodes = Math.pow(2, height) - 1;

  const lcNode = lc <= maxNodes ? getNode(board, lc) : null;
  const rcNode = rc <= maxNodes ? getNode(board, rc) : null;

  if (lcNode && value <= lcNode.number) return false;
  if (rcNode && value >= rcNode.number) return false;

  const p = parent(pos);
  if (p >= 1) {
    const pNode = getNode(board, p);
    if (pNode) {
      const pVal = pNode.number;
      if (pos === leftChild(p) && value >= pVal) return false;
      if (pos === rightChild(p) && value <= pVal) return false;
    }
  }
  return true;
}

function validatePlacement(board, pos, value, levelType, height) {
  if (levelType === "BST") return validateBSTPlacement(board, pos, value);
  return validatePyramidPlacement(board, pos, value, height);
}

function countFilledNodes(board) {
  return Object.values(board || {}).filter(c => c !== null && c !== undefined).length;
}

function countEmptyNodes(board, totalNodes) {
  return totalNodes - countFilledNodes(board);
}

window.GameLogic = {
  parent, leftChild, rightChild, getNode,
  validateBSTPlacement, validatePyramidPlacement, validatePlacement,
  countFilledNodes, countEmptyNodes,
};
