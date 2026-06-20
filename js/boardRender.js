// ════════════════════════════════════════════════════════════════
// BOARD RENDER — Árbol BST y Pirámide visual
// ════════════════════════════════════════════════════════════════

function getTreeLayout(height) {
  const nodes = [];
  for (let row = 0; row < height; row++) {
    const count = Math.pow(2, row);
    const start = Math.pow(2, row);
    for (let i = 0; i < count; i++) {
      nodes.push({ pos: start + i, row, col: i, totalInRow: count });
    }
  }
  return nodes;
}

function renderBoard(container, board, levelConfig, { selectedPos = null, onSelectPosition = null } = {}) {
  container.innerHTML = "";
  if (!levelConfig) return;

  const { height, nodes: totalNodes, type: levelType } = levelConfig;
  const layout = getTreeLayout(height);

  const CARD_W = 58, CARD_H = 82, V_GAP = 24;
  const bottomCount = Math.pow(2, height - 1);
  const boardW = bottomCount * (CARD_W + 10) + 10;
  const boardH = height * (CARD_H + V_GAP) + V_GAP;

  const wrap = document.createElement("div");
  wrap.className = "board-wrap";
  const canvas = document.createElement("div");
  canvas.className = "board-canvas";
  canvas.style.width = boardW + "px";
  canvas.style.height = boardH + "px";

  function nodeXY(row, col, totalInRow) {
    const spacing = boardW / totalInRow;
    const cx = spacing * col + spacing / 2;
    const cy = levelType === "Pyramid"
      ? (height - 1 - row) * (CARD_H + V_GAP) + V_GAP
      : row * (CARD_H + V_GAP) + V_GAP;
    return { cx, cy };
  }

  // Lines (drawn first, below cards)
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("style", `position:absolute;top:0;left:0;width:${boardW}px;height:${boardH}px;`);
  for (const { pos, row, col, totalInRow } of layout) {
    const lc = pos * 2, rc = pos * 2 + 1;
    if (lc > totalNodes) continue;
    const { cx: px, cy: py } = nodeXY(row, col, totalInRow);
    const lcNode = layout.find(n => n.pos === lc);
    const rcNode = layout.find(n => n.pos === rc);

    for (const childNode of [lcNode, rcNode]) {
      if (!childNode) continue;
      const { cx: ccx, cy: ccy } = nodeXY(childNode.row, childNode.col, childNode.totalInRow);
      const y1 = levelType === "Pyramid" ? py : py + CARD_H;
      const y2 = levelType === "Pyramid" ? ccy + CARD_H : ccy;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", px); line.setAttribute("y1", y1);
      line.setAttribute("x2", ccx); line.setAttribute("y2", y2);
      line.setAttribute("stroke", "#555"); line.setAttribute("stroke-width", "2");
      svg.appendChild(line);
    }
  }
  canvas.appendChild(svg);

  // Nodes (cards or empty slots)
  for (const { pos, row, col, totalInRow } of layout) {
    const { cx, cy } = nodeXY(row, col, totalInRow);
    const card = board[String(pos)] || null;

    const nodeDiv = document.createElement("div");
    nodeDiv.style.position = "absolute";
    nodeDiv.style.left = (cx - CARD_W / 2) + "px";
    nodeDiv.style.top = cy + "px";
    nodeDiv.style.width = CARD_W + "px";
    nodeDiv.style.height = CARD_H + "px";

    if (card) {
      const cardEl = window.CardRender.renderCard(card, { small: true });
      nodeDiv.appendChild(cardEl);
    } else {
      const slot = document.createElement("div");
      slot.className = "board-slot" + (selectedPos === pos ? " selected" : "");
      slot.style.width = "100%"; slot.style.height = "100%";
      const posLabel = levelType === "BST"
        ? (pos === 1 ? "raíz" : pos % 2 === 0 ? "< padre" : "> padre")
        : (pos === 1 ? "ápice" : "");
      slot.innerHTML = `<span class="plus">+</span><span class="pos-label">#${pos}</span>
        <span class="pos-label" style="color:#777">${posLabel}</span>`;
      if (onSelectPosition) slot.onclick = () => onSelectPosition(pos);
      nodeDiv.appendChild(slot);
    }
    canvas.appendChild(nodeDiv);
  }

  wrap.appendChild(canvas);
  container.appendChild(wrap);
}

window.BoardRender = { renderBoard, getTreeLayout };
