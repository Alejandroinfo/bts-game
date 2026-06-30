// ════════════════════════════════════════════════════════════════
// UI — v2: render de pantallas (lobby, selección de nivel, juego)
// ════════════════════════════════════════════════════════════════
// Mismo patrón general que v1 (js/ui.js + render* de gameRoom.js):
// pantallas con clase .screen / .active, contenido inyectado vía
// innerHTML. No usa framework — coherente con el resto del repo.
// ════════════════════════════════════════════════════════════════

import { getLevelById, LEVELS_A, LEVELS_B, slotsForTree } from "./gameData.js";
import { isVisibleTo, canAct, isPyramidBasePosition, canPlayAsPyramidParentB } from "./gameLogicWrapper.js";

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function showStart() { showScreen("screenStart"); }
function showHostSetup() { showScreen("screenHostSetup"); }
function showJoinSetup() { showScreen("screenJoinSetup"); }
function showJoinError(msg) { document.getElementById("joinError").textContent = msg; }

function showLobby() { showScreen("screenLobby"); }
function showGame() { showScreen("screenGame"); }

// ── Render principal, llamado desde el listener de Firebase ─────────
function renderAll(state) {
  const room = state.room;
  if (!room) return;

  if (room.phase === "lobby") {
    renderLobby(state, room);
    showLobby();
  } else if (room.phase === "playing") {
    if (room.scenario === "B") renderGameB(state, room);
    else renderGame(state, room);
    showGame();
  }
}

function renderLobby(state, room) {
  document.getElementById("lobbyCode").textContent = room.code;
  const isHost = room.hostId === state.myId;
  const players = Object.values(room.players || {});

  document.getElementById("lobbyPlayers").innerHTML = players.map(p =>
    `<div class="player-pill">${p.name}${p.id === room.hostId ? " 👑" : ""}</div>`
  ).join("");

  const levelArea = document.getElementById("lobbyLevelArea");
  if (!isHost) {
    document.getElementById("lobbyScenarioLabel").textContent =
      "Escenario " + room.scenario + (room.scenario === "A" ? " — Información Mixta" : " — Revelación Tardía");
    levelArea.innerHTML = `<p class="hint">Esperando a que el host elija nivel e inicie la partida...</p>`;
    return;
  }

  // El host puede cambiar de escenario directo en el lobby (también
  // aplica tras un reinicio, sin tener que crear una sala nueva).
  document.getElementById("lobbyScenarioLabel").innerHTML = `
    <label style="display:inline-flex; align-items:center; gap:8px;">
      Escenario:
      <select onchange="GameRoomV2.setScenario(this.value)">
        <option value="A" ${room.scenario === "A" ? "selected" : ""}>A — Información Mixta</option>
        <option value="B" ${room.scenario === "B" ? "selected" : ""}>B — Revelación Tardía</option>
      </select>
    </label>
  `;

  const levels = room.scenario === "A" ? LEVELS_A : LEVELS_B;
  levelArea.innerHTML = `
    <p class="hint">Elegí nivel para empezar (sos el host):</p>
    <div class="level-list">
      ${levels.map(l => `
        <div class="level-pill" onclick="GameRoomV2.startGame(${l.id})">
          <div class="lvl-num">NIVEL ${l.id}</div>
          <div class="lvl-name">${l.label}</div>
          <div class="lvl-tags">${levelTags(l)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function levelTags(level) {
  const tags = [];
  level.trees.forEach(t => tags.push(`<span class="micro-tag">${t.type === "bst" ? "BST" : "Pirámide"} h${t.height}</span>`));
  if (level.hiddenFraction != null) tags.push(`<span class="micro-tag">oculto ${Math.round(level.hiddenFraction*100)}%</span>`);
  if (level.agency) {
    const agLabel = { any: "agencia: cualquiera", fixedNeighbor: "agencia: vecino fijo", ownerAlways: "agencia: dueño siempre" }[level.agency];
    tags.push(`<span class="micro-tag">${agLabel}</span>`);
  }
  if (level.freeCardsOnTable) tags.push(`<span class="micro-tag">${level.freeCardsOnTable} libres</span>`);
  if (level.scenario === "B") {
    tags.push(`<span class="micro-tag" style="color:var(--accent);border-color:var(--accent);">⚡ ${level.energy}</span>`);
    if (level.energy === 1) tags.push(`<span class="micro-tag" style="color:var(--bad);border-color:var(--bad);">instantáneo</span>`);
  }
  return tags.join("");
}

/* ---------------------- PANTALLA DE JUEGO ---------------------- */

function maxLivesForLevel(level) {
  return level.scenario === "B" ? (level.livesMargin || 5) : 5;
}

function renderGame(state, room) {
  const level = getLevelById(room.levelId);
  if (!level) return; // nivel aún no resuelto / inconsistencia transitoria — esperar próximo onValue
  const playerIds = room.queueOrder;
  const myId = state.myId;

  document.getElementById("restartRoomBtn").style.display = room.hostId === myId ? "" : "none";

  document.getElementById("layoutA").style.display = "";
  document.getElementById("layoutB").style.display = "none";
  document.getElementById("endOverlayB").style.display = "none";

  document.getElementById("gameLevelLabel").textContent =
    level.scenario === "A" ? "ESCENARIO A — INFORMACIÓN MIXTA" : "ESCENARIO B — REVELACIÓN TARDÍA (placeholder)";
  document.getElementById("gameLevelTitle").textContent = "Nivel " + level.id + " · " + level.label;
  document.getElementById("gameLives").textContent =
    "♥ " + (maxLivesForLevel(level) - (room.livesUsed || 0)) + " / " + maxLivesForLevel(level);

  renderOtherPlayers(state, room, level, playerIds, myId);
  renderTableFree(room);
  renderBoards(level, room);
  renderQueue(room, playerIds);
  renderMyHand(state, room, level, myId);
  renderLog(room);

  document.getElementById("resolveQueueBtn").style.display = room.declarePhase ? "inline-block" : "none";
  document.getElementById("resolveQueueBtn").disabled = Object.values(room.queue).every(q => !q);
  document.getElementById("newRoundBtn").style.display = room.declarePhase ? "none" : "inline-block";
  document.getElementById("declareHint").textContent = room.declarePhase
    ? "Declarando — elegí una carta abajo (la tuya o la de otro jugador si tenés agencia) y después una posición libre del queue."
    : "Ronda ejecutada. Revisá el tablero y arrancá la próxima ronda.";
}

function renderOtherPlayers(state, room, level, playerIds, myId) {
  const others = playerIds.filter(pid => pid !== myId);
  document.getElementById("otherPlayersCol").innerHTML = others.map(pid => {
    const hand = room.hands[pid] || [];
    return `
      <div class="other-player">
        <div class="pname"><span>${room.players[pid]?.name || pid}</span></div>
        <div class="other-hand">
          ${hand.map(card => {
            const visible = isVisibleTo(card, pid, myId);
            if (!visible) return `<div class="card face-down">·</div>`;
            const clickable = room.declarePhase && canAct(level, pid, myId, card, room.fixedNeighborOf);
            return cardEl(card.number, true, clickable, clickable ? `GameRoomV2.selectCardToDeclare('${pid}','${card.id}',false)` : null);
          }).join("")}
        </div>
      </div>
    `;
  }).join("");
}

function renderTableFree(room) {
  const free = room.freeOnTable || [];
  document.getElementById("tableFreeRow").innerHTML = free.length === 0
    ? `<span class="empty-note">Sin cartas libres en este nivel.</span>`
    : free.map(c => cardEl(c.number, true, room.declarePhase, room.declarePhase ? `GameRoomV2.selectCardToDeclare(null,'${c.id}',true)` : null)).join("");
}

function renderMyHand(state, room, level, myId) {
  const hand = room.hands[myId] || [];
  document.getElementById("myHandRow").innerHTML = hand.map(card => {
    if (card.hiddenFromOwner) {
      const canPlayBlind = room.declarePhase && canAct(level, myId, myId, card, room.fixedNeighborOf);
      return `
        <div class="card-stack">
          <div class="card mine-hidden ${canPlayBlind ? "selectable" : ""}"
               ${canPlayBlind ? `onclick="GameRoomV2.selectCardToDeclare('${myId}','${card.id}',false)"` : ""} title="No sabés qué carta es">?</div>
          <div class="card-owner-tag">Vos</div>
        </div>`;
    }
    const clickable = room.declarePhase;
    return cardEl(card.number, true, clickable, clickable ? `GameRoomV2.selectCardToDeclare('${myId}','${card.id}',false)` : null);
  }).join("");

  const agencyNote = level.agency === "ownerAlways"
    ? "En este nivel SOLO vos podés jugar tus cartas ocultas (aunque no sepas el valor) — los demás ya las conocían."
    : level.agency === "fixedNeighbor"
      ? "Tu vecino fijo es quien puede jugar tus cartas ocultas."
      : "Cualquiera que vea tus cartas ocultas puede jugarlas.";
  document.getElementById("myHandHint").textContent = agencyNote;
}

function cardEl(value, faceUp, clickable, onclick) {
  const cls = ["card", faceUp ? "face-up" : "face-down", clickable ? "selectable" : ""].join(" ").trim();
  return `<div class="${cls}" ${onclick ? `onclick="${onclick}"` : ""}>${faceUp ? value : "?"}</div>`;
}

function renderQueue(room, playerIds) {
  const n = playerIds.length;
  let html = "";
  for (let i = 0; i < n; i++) {
    const slot = room.queue[i];
    if (!slot) {
      html += `<div class="queue-slot empty"><div class="qpos">${i+1}</div><div class="card face-down" ${room.declarePhase ? `onclick="GameRoomV2.declareToSlot(${i})"` : ""} style="${room.declarePhase ? 'cursor:pointer' : ''}">·</div><div class="qname">—</div></div>`;
    } else {
      const actingName = room.players[slot.actingId]?.name || "?";
      html += `<div class="queue-slot"><div class="qpos">${i+1}</div><div class="card face-down">${room.declarePhase ? "?" : slot.card.number}</div><div class="qname">${actingName}</div></div>`;
    }
  }
  document.getElementById("queueRow").innerHTML = html;
}

function renderBoards(level, room) {
  document.getElementById("boardsArea").innerHTML = level.trees.map((tree, i) => renderTreeBoard(tree, i, room)).join("");
}

function renderTreeBoard(tree, treeIdx, room) {
  const maxNodes = slotsForTree(tree);
  const board = room.boardsByTree[treeIdx] || {};
  const levelsCount = tree.height;
  const nodeR = 16;
  const vGap = 56;
  const width = Math.pow(2, levelsCount - 1) * 50 + 40;
  const height = levelsCount * vGap + 30;

  const coords = {};
  for (let lvl = 0; lvl < levelsCount; lvl++) {
    const countInLevel = Math.pow(2, lvl);
    const startPos = Math.pow(2, lvl);
    for (let k = 0; k < countInLevel; k++) {
      const pos = startPos + k;
      coords[pos] = { x: ((k + 0.5) / countInLevel) * width, y: 24 + lvl * vGap };
    }
  }

  let svg = `<svg class="tree-svg" viewBox="0 0 ${width} ${height}" width="${Math.min(width, 480)}" height="${height}">`;
  for (let pos = 1; pos < Math.pow(2, levelsCount - 1); pos++) {
    if (coords[pos] && coords[pos*2]) svg += `<line class="edge-line" x1="${coords[pos].x}" y1="${coords[pos].y}" x2="${coords[pos*2].x}" y2="${coords[pos*2].y}"/>`;
    if (coords[pos] && coords[pos*2+1]) svg += `<line class="edge-line" x1="${coords[pos].x}" y1="${coords[pos].y}" x2="${coords[pos*2+1].x}" y2="${coords[pos*2+1].y}"/>`;
  }
  const pendingHere = (room.pendingManualCard || []).some(p => p.treeIdx === treeIdx);
  for (let pos = 1; pos <= maxNodes; pos++) {
    const { x, y } = coords[pos];
    const occupant = board[String(pos)];
    const clickableManual = tree.type === "pyramid" && pendingHere && !occupant;
    const filledCls = occupant ? "node-filled" : "node-empty";
    const isBase = tree.type === "pyramid" && isPyramidBasePosition(pos, tree.height);
    const baseCls = isBase ? "node-pyramid-base" : "";
    svg += `<g class="node-slot ${clickableManual ? "clickable" : ""} ${filledCls} ${baseCls}" ${clickableManual ? `onclick="GameRoomV2.attemptManualPlacement(${treeIdx},${pos})"` : ""}>`;
    svg += `<rect x="${x-nodeR}" y="${y-nodeR}" width="${nodeR*2}" height="${nodeR*2}" rx="5"/>`;
    svg += occupant
      ? `<text class="node-text" x="${x}" y="${y+1}">${occupant.number}</text>`
      : `<text class="node-text node-hidden-text" x="${x}" y="${y+1}">${pos}</text>`;
    svg += `</g>`;
  }
  svg += `</svg>`;

  return `<div class="tree-board">
    <div class="tree-label">${tree.type === "bst" ? "BST · automático" : "Pirámide · vértice arriba, base abajo · manual (point-and-click, pares fijos)"} · altura ${tree.height}</div>
    ${svg}
  </div>`;
}

function renderLog(room) {
  const entries = Object.values(room.log || {}).sort((a,b) => b.time - a.time).slice(0, 60);
  document.getElementById("logPanel").innerHTML = entries.map(e =>
    `<div>${new Date(e.time).toLocaleTimeString()} — ${e.msg}</div>`
  ).join("");
}

// ════════════════════════════════════════════════════════════════
// ESCENARIO B — Revelación Tardía (render)
// ════════════════════════════════════════════════════════════════

function renderGameB(state, room) {
  const level = getLevelById(room.levelId);
  if (!level) return; // nivel aún no resuelto / inconsistencia transitoria — esperar próximo onValue
  const playerIds = room.queueOrder;
  const myId = state.myId;

  document.getElementById("restartRoomBtn").style.display = room.hostId === myId ? "" : "none";

  document.getElementById("layoutA").style.display = "none";
  document.getElementById("layoutB").style.display = "";

  document.getElementById("gameLevelLabel").textContent = "ESCENARIO B — REVELACIÓN TARDÍA";
  document.getElementById("gameLevelTitle").textContent = "Nivel " + level.id + " · " + level.label;
  document.getElementById("gameLives").textContent = ""; // B usa energía, no vidas — ver energyBadgeB

  const energy = room.energy;
  const energyBadge = document.getElementById("energyBadgeB");
  energyBadge.textContent = "⚡ " + energy + " / " + level.energy;
  energyBadge.classList.toggle("low", energy <= Math.ceil(level.energy * 0.25));
  document.getElementById("discardBadgeB").textContent = "🗑 descarte: " + (room.discardPile || []).length;

  renderOtherPlayersB(state, room, playerIds, myId);
  renderBoardsB(state, level, room);
  renderCommonZoneB(state, room);
  renderActionsPanelB(state, room);
  renderMyHandB(state, room, myId);
  renderLogB(room);
  renderEndOverlayB(room);
}

function renderOtherPlayersB(state, room, playerIds, myId) {
  const others = playerIds.filter(pid => pid !== myId);
  document.getElementById("otherPlayersColB").innerHTML = others.map(pid => {
    const hand = room.hands[pid] || [];
    return `
      <div class="other-player">
        <div class="pname"><span>${room.players[pid]?.name || pid}</span></div>
        <div class="other-hand">
          ${hand.map(() => `<div class="card face-down">·</div>`).join("")}
        </div>
      </div>
    `;
  }).join("");
}

function renderCommonZoneB(state, room) {
  const zone = room.commonZone || [];
  document.getElementById("commonZoneRowB").innerHTML = zone.length === 0
    ? `<span class="empty-note">vacía</span>`
    : zone.map(c => {
        const sel = state.selectedCard;
        const isSelected = sel && sel.source === "common" && String(sel.cardId) === String(c.id);
        return `<div class="card face-up common-zone-b ${isSelected ? "selected-b" : ""}" onclick="GameRoomV2.selectCardB('common', null, '${c.id}')">${c.number}</div>`;
      }).join("");
}

function renderMyHandB(state, room, myId) {
  const hand = room.hands[myId] || [];
  document.getElementById("myHandRowB").innerHTML = hand.map(c => {
    const sel = state.selectedCard;
    const isSelected = sel && sel.source === "hand" && sel.ownerId === myId && String(sel.cardId) === String(c.id);
    return `<div class="card face-up ${isSelected ? "selected-b" : ""}" onclick="GameRoomV2.selectCardB('hand', '${myId}', '${c.id}')">${c.number}</div>`;
  }).join("") || `<span class="empty-note">(sin cartas)</span>`;
}

function renderActionsPanelB(state, room) {
  const sel = state.selectedCard;
  const canReveal = sel && sel.source === "hand" && sel.ownerId === state.myId && room.energy >= 2;
  document.getElementById("drawBtnB").disabled = room.energy < 1 || (room.discardPile || []).filter(c => c.number !== null).length === 0;
  document.getElementById("revealBtnB").disabled = !canReveal;
  const demolishBtn = document.getElementById("demolishBtnB");
  demolishBtn.classList.toggle("active-mode", !!state.demolishMode);
  demolishBtn.textContent = state.demolishMode ? "💥 Cancelar demoler" : "💥 Demoler carta del tablero (⚡=cartas)";
  demolishBtn.disabled = room.energy < 1;
  document.getElementById("deselectBtnB").style.display = sel ? "" : "none";

  let hint = "";
  if (state.demolishMode) hint = "Modo demoler activo: hacé click en una carta oculta del tablero.";
  else if (sel) hint = "Carta " + (sel.source === "hand" ? "de tu mano" : "de la zona común") + " seleccionada — hacé click en el tablero para jugarla, o usá 'Revelar' si querés mandarla a la zona común.";
  document.getElementById("actionHintB").textContent = hint;
}

function renderLogB(room) {
  const entries = Object.values(room.log || {}).sort((a,b) => b.time - a.time).slice(0, 60);
  document.getElementById("logPanelB").innerHTML = entries.map(e =>
    `<div>${new Date(e.time).toLocaleTimeString()} — ${e.msg}</div>`
  ).join("");
}

function renderEndOverlayB(room) {
  const overlay = document.getElementById("endOverlayB");
  if (!room.endResult) { overlay.style.display = "none"; return; }
  overlay.style.display = "flex";
  const win = room.endResult === "win";
  const h2 = document.getElementById("endTitleB");
  h2.textContent = win ? "¡Nivel completado!" : "Energía agotada";
  h2.className = win ? "win" : "lose";
  document.getElementById("endSubtitleB").textContent = win
    ? "Tableros completos con energía restante."
    : "El grupo se quedó sin energía antes de terminar.";
}

function renderBoardsB(state, level, room) {
  document.getElementById("boardsAreaB").innerHTML = level.trees.map((tree, i) => renderTreeBoardB(state, tree, i, room)).join("");
}

function renderTreeBoardB(state, tree, treeIdx, room) {
  const maxNodes = slotsForTree(tree);
  const board = room.boardsByTree[treeIdx] || {};
  const levelsCount = tree.height;
  const nodeR = 16;
  const vGap = 56;
  const width = Math.pow(2, levelsCount - 1) * 50 + 40;
  const height = levelsCount * vGap + 30;

  const coords = {};
  for (let lvl = 0; lvl < levelsCount; lvl++) {
    const countInLevel = Math.pow(2, lvl);
    const startPos = Math.pow(2, lvl);
    for (let k = 0; k < countInLevel; k++) {
      const pos = startPos + k;
      coords[pos] = { x: ((k + 0.5) / countInLevel) * width, y: 24 + lvl * vGap };
    }
  }

  let svg = `<svg class="tree-svg" viewBox="0 0 ${width} ${height}" width="${Math.min(width, 480)}" height="${height}">`;
  for (let pos = 1; pos < Math.pow(2, levelsCount - 1); pos++) {
    if (coords[pos] && coords[pos*2]) svg += `<line class="edge-line" x1="${coords[pos].x}" y1="${coords[pos].y}" x2="${coords[pos*2].x}" y2="${coords[pos*2].y}"/>`;
    if (coords[pos] && coords[pos*2+1]) svg += `<line class="edge-line" x1="${coords[pos].x}" y1="${coords[pos].y}" x2="${coords[pos*2+1].x}" y2="${coords[pos*2+1].y}"/>`;
  }

  const sel = state.selectedCard;
  for (let pos = 1; pos <= maxNodes; pos++) {
    const { x, y } = coords[pos];
    const occupant = board[String(pos)];
    let clickAttr = "";
    let extraCls = "";

    if (state.demolishMode && occupant && !occupant.revealed) {
      extraCls = "demolish-target clickable";
      clickAttr = `onclick="GameRoomV2.demolishAtB(${treeIdx},${pos})"`;
    } else if (!state.demolishMode && sel) {
      if (tree.type === "bst" && !occupant) {
        // BST: la posición exacta la calcula la lógica; cualquier click
        // en el tablero juega la carta (igual que el prototipo standalone).
        extraCls = "clickable";
        clickAttr = `onclick="GameRoomV2.playSelectedCardBSTB(${treeIdx})"`;
      } else if (tree.type === "pyramid" && !occupant && isPyramidBasePosition(pos, tree.height)) {
        extraCls = "clickable";
        clickAttr = `onclick="GameRoomV2.playSelectedCardPyramidBaseB(${treeIdx},${pos})"`;
      } else if (tree.type === "pyramid" && !occupant && canPlayAsPyramidParentB(board, pos, tree.height)) {
        extraCls = "clickable";
        clickAttr = `onclick="GameRoomV2.playSelectedCardPyramidParentB(${treeIdx},${pos})"`;
      }
    }

    const filledCls = occupant ? (occupant.revealed ? "node-filled" : "node-filled-hidden") : "node-empty";
    const isBase = tree.type === "pyramid" && isPyramidBasePosition(pos, tree.height);
    const baseCls = isBase ? "node-pyramid-base" : "";
    svg += `<g class="node-slot ${extraCls} ${filledCls} ${baseCls}" ${clickAttr}>`;
    svg += `<rect x="${x-nodeR}" y="${y-nodeR}" width="${nodeR*2}" height="${nodeR*2}" rx="5"/>`;
    if (occupant && occupant.revealed) {
      svg += `<text class="node-text" x="${x}" y="${y+1}">${occupant.number}</text>`;
    } else if (occupant) {
      svg += `<text class="node-text" x="${x}" y="${y+1}">?</text>`;
    } else {
      svg += `<text class="node-text node-hidden-text" x="${x}" y="${y+1}">${pos}</text>`;
    }
    svg += `</g>`;
  }
  svg += `</svg>`;

  return `<div class="tree-board">
    <div class="tree-label">${tree.type === "bst" ? "BST · revelación tardía" : "Pirámide · base abajo, vértice arriba"} · altura ${tree.height}</div>
    ${svg}
  </div>`;
}

window.UIV2 = {
  showStart, showHostSetup, showJoinSetup, showJoinError, showLobby, showGame, renderAll,
};

