// ════════════════════════════════════════════════════════════════
// UI — v2: render de pantallas (lobby, selección de nivel, juego)
// ════════════════════════════════════════════════════════════════
// Mismo patrón general que v1 (js/ui.js + render* de gameRoom.js):
// pantallas con clase .screen / .active, contenido inyectado vía
// innerHTML. No usa framework — coherente con el resto del repo.
// ════════════════════════════════════════════════════════════════

import { getLevelById, LEVELS_A, LEVELS_B, slotsForTree } from "./gameData.js";
import { isVisibleTo, canAct, isPyramidBasePosition } from "./gameLogicWrapper.js";

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
    renderGame(state, room);
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

  document.getElementById("lobbyScenarioLabel").textContent =
    "Escenario " + room.scenario + (room.scenario === "A" ? " — Información Mixta" : " — Revelación Tardía (placeholder)");

  const levelArea = document.getElementById("lobbyLevelArea");
  if (!isHost) {
    levelArea.innerHTML = `<p class="hint">Esperando a que el host elija nivel e inicie la partida...</p>`;
    return;
  }

  const levels = room.scenario === "A" ? LEVELS_A : LEVELS_B;
  levelArea.innerHTML = `
    <p class="hint">Elegí nivel para empezar (sos el host):</p>
    <div class="level-list">
      ${levels.map(l => `
        <div class="level-pill ${l.placeholder ? "placeholder" : ""}" onclick="GameRoomV2.startGame(${l.id})">
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
  if (level.placeholder) tags.push(`<span class="micro-tag">placeholder</span>`);
  return tags.join("");
}

/* ---------------------- PANTALLA DE JUEGO ---------------------- */

function maxLivesForLevel(level) {
  return level.scenario === "B" ? (level.livesMargin || 5) : 5;
}

function renderGame(state, room) {
  const level = getLevelById(room.levelId);
  const playerIds = room.queueOrder;
  const myId = state.myId;

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
  document.getElementById("resolveQueueBtn").disabled = Object.values(room.queue || {}).every(q => !q || q._empty);
  document.getElementById("newRoundBtn").style.display = room.declarePhase ? "none" : "inline-block";
  document.getElementById("declareHint").textContent = room.declarePhase
    ? "Declarando — elegí una carta abajo (la tuya o la de otro jugador si tenés agencia) y después una posición libre del queue."
    : "Ronda ejecutada. Revisá el tablero y arrancá la próxima ronda.";
}

function renderOtherPlayers(state, room, level, playerIds, myId) {
  const others = playerIds.filter(pid => pid !== myId);
  document.getElementById("otherPlayersCol").innerHTML = others.map(pid => {
    const hand = (room.hands && room.hands[pid]) || [];
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
  const hand = (room.hands && room.hands[myId]) || [];
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
    const slot = room.queue ? room.queue[i] : null;
    if (!slot || slot._empty) {
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
  const board = (room.boardsByTree && room.boardsByTree[treeIdx]) || {};
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

window.UIV2 = {
  showStart, showHostSetup, showJoinSetup, showJoinError, showLobby, showGame, renderAll,
};

