// ════════════════════════════════════════════════════════════════
// GAME ROOM — Toda la lógica de sala y sincronización con Firebase
// ════════════════════════════════════════════════════════════════

const PLAYER_COLORS = ["#2E86AB","#E84855","#3BB273","#F18F01","#7B2D8B"];

let state = {
  roomCode: null,
  myId: null,
  myName: null,
  room: null,
  selectedCardId: null,
  selectedPos: null,
};

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function genPlayerId() {
  return "p_" + Math.random().toString(36).substring(2, 10);
}

// ── Crear sala ─────────────────────────────────────────────────────
async function createRoom() {
  const name = document.getElementById("hostName").value.trim();
  const difficulty = document.getElementById("hostDifficulty").value;
  if (!name) return alert("Escribe tu nombre");

  const { db, ref, set } = window.FB;
  const code = genCode();
  const myId = genPlayerId();
  const diff = window.GameData.DIFFICULTY[difficulty];

  const roomData = {
    code,
    hostId: myId,
    difficulty,
    phase: "lobby",
    sharedLives: diff.lives,
    maxLives: diff.lives,
    currentLevel: 1,
    usedRetreat: false,
    board: {},
    missionPool: null,
    players: {
      [myId]: {
        id: myId, name, points: diff.startPts,
        hand: {}, handCount: 0,
        activeMission: null, startMission: null,
        unlockedSignals: { Range: true },
        signal: null, ready: false,
      }
    },
    log: { [Date.now()]: { time: Date.now(), msg: name + " creó la sala" } },
  };

  await set(ref(db, "rooms/" + code), roomData);

  state.roomCode = code;
  state.myId = myId;
  state.myName = name;
  localStorage.setItem("bst_session", JSON.stringify({ code, myId, name }));

  document.getElementById("lobbyCode").textContent = code;
  window.UI.showLobby();
  listenToRoom(code);
}

// ── Unirse a sala ──────────────────────────────────────────────────
async function joinRoom() {
  const name = document.getElementById("joinName").value.trim();
  const code = document.getElementById("joinCode").value.trim().toUpperCase();
  if (!name) return window.UI.showJoinError("Escribe tu nombre");
  if (!code) return window.UI.showJoinError("Escribe el código de sala");

  const { db, ref, get, set } = window.FB;
  const roomRef = ref(db, "rooms/" + code);
  const snap = await get(roomRef);

  if (!snap.exists()) return window.UI.showJoinError("Sala no encontrada");
  const room = snap.val();
  if (room.phase !== "lobby") return window.UI.showJoinError("La partida ya comenzó");

  const playerCount = Object.keys(room.players || {}).length;
  if (playerCount >= 5) return window.UI.showJoinError("Sala llena (máximo 5)");

  const myId = genPlayerId();
  const diff = window.GameData.DIFFICULTY[room.difficulty];

  await set(ref(db, "rooms/" + code + "/players/" + myId), {
    id: myId, name, points: diff.startPts,
    hand: {}, handCount: 0,
    activeMission: null, startMission: null,
    unlockedSignals: { Range: true },
    signal: null, ready: false,
  });

  await addLog(code, name + " se unió a la sala");

  state.roomCode = code;
  state.myId = myId;
  state.myName = name;
  localStorage.setItem("bst_session", JSON.stringify({ code, myId, name }));

  document.getElementById("lobbyCode").textContent = code;
  window.UI.showLobby();
  listenToRoom(code);
}

// ── Reconexión automática (si recarga la página) ───────────────────
async function tryReconnect() {
  const saved = localStorage.getItem("bst_session");
  if (!saved) return false;
  const { code, myId, name } = JSON.parse(saved);

  const { db, ref, get } = window.FB;
  const snap = await get(ref(db, "rooms/" + code + "/players/" + myId));
  if (!snap.exists()) { localStorage.removeItem("bst_session"); return false; }

  state.roomCode = code;
  state.myId = myId;
  state.myName = name;
  listenToRoom(code);

  const roomSnap = await get(ref(db, "rooms/" + code));
  const room = roomSnap.val();
  if (room.phase === "lobby") {
    document.getElementById("lobbyCode").textContent = code;
    window.UI.showLobby();
  } else {
    window.UI.showGame();
  }
  return true;
}

// ── Helper: agregar entrada al log ──────────────────────────────────
async function addLog(code, msg) {
  const { db, ref, push, set } = window.FB;
  const logRef = push(ref(db, "rooms/" + code + "/log"));
  await set(logRef, { time: Date.now(), msg });
}

// ── Escuchar cambios en tiempo real ─────────────────────────────────
function listenToRoom(code) {
  const { db, ref, onValue } = window.FB;
  onValue(ref(db, "rooms/" + code), (snap) => {
    const room = snap.val();
    if (!room) return;
    state.room = room;
    renderAll();
  });
}

// ── Iniciar partida (host) ──────────────────────────────────────────
async function startGame() {
  const room = state.room;
  if (room.hostId !== state.myId) return;
  const players = Object.values(room.players || {});
  if (players.length < 2) return alert("Se necesitan al menos 2 jugadores");

  const { db, ref, update } = window.FB;
  const pool = window.GameData.buildMissionPool();

  await update(ref(db, "rooms/" + state.roomCode), {
    phase: "missionSelect",
    missionPool: pool,
  });
  await addLog(state.roomCode, "¡Partida iniciada! Fase de selección de misiones.");
  window.UI.showGame();
}

// ── Tomar misión del pool ────────────────────────────────────────────
async function takeMission(mission) {
  const room = state.room;
  const me = room.players[state.myId];
  const cost = parseInt(mission.cost);
  if (me.activeMission) return alert("Ya tienes una misión activa");
  if (me.points < cost) return alert("No tienes suficientes puntos");

  const { db, ref, update } = window.FB;

  const poolForLevel = (room.missionPool[mission.level] || []).filter(m => m.id !== mission.id);
  const poolUpdate = {};
  poolUpdate[mission.level] = poolForLevel;
  await update(ref(db, "rooms/" + state.roomCode + "/missionPool"), poolUpdate);

  await update(ref(db, "rooms/" + state.roomCode + "/players/" + state.myId), {
    activeMission: mission,
    points: me.points - cost,
  });

  await addLog(state.roomCode, me.name + " tomó una misión: \"" + mission.condition.substring(0,40) + "...\"");
}

// ── Marcar listo para jugar (reparte cartas cuando todos estén listos) ──
async function readyToPlay() {
  const { db, ref, update, get } = window.FB;
  await update(ref(db, "rooms/" + state.roomCode + "/players/" + state.myId), { ready: true });

  const snap = await get(ref(db, "rooms/" + state.roomCode));
  const room = snap.val();
  const players = Object.values(room.players || {});
  const allReady = players.every(p => p.ready);

  if (allReady) {
    await dealLevel(room);
  }
}

async function dealLevel(room) {
  const { db, ref, update } = window.FB;
  const levelCfg = window.GameData.LEVELS[room.currentLevel - 1];
  const playerIds = Object.keys(room.players);
  const count = window.GameData.cardsPerPlayer(levelCfg.nodes, playerIds.length);

  const deck = window.GameData.shuffle(window.GameData.buildDeck());

  let deckIdx = 0;
  const playerUpdates = {};
  for (const pid of playerIds) {
    const hand = {};
    for (let i = 0; i < count && deckIdx < deck.length; i++) {
      const card = deck[deckIdx++];
      hand[card.id] = card;
    }
    playerUpdates["players/" + pid + "/hand"] = hand;
    playerUpdates["players/" + pid + "/handCount"] = Object.keys(hand).length;
    playerUpdates["players/" + pid + "/ready"] = false;
    playerUpdates["players/" + pid + "/signal"] = null;
  }

  await update(ref(db, "rooms/" + state.roomCode), Object.assign({}, playerUpdates, {
    phase: "playing",
    board: {},
    deckRemaining: deck.slice(deckIdx),
    lastPlayedCard: null,
    lastPlayedBy: null,
  }));

  await addLog(state.roomCode,
    "Nivel " + room.currentLevel + " comienza! " + (levelCfg.type === "BST" ? "Árbol BST" : "Pirámide") + " — " + levelCfg.nodes + " nodos");
}

// ── Jugar carta al tablero ───────────────────────────────────────────
async function playCard() {
  if (!state.selectedCardId || !state.selectedPos) return;
  const room = state.room;
  const me = room.players[state.myId];
  const card = me.hand[state.selectedCardId];
  if (!card) return;

  const levelCfg = window.GameData.LEVELS[room.currentLevel - 1];
  const pos = state.selectedPos;

  if (room.board[String(pos)]) return alert("Esa posición ya está ocupada");

  const valid = window.GameLogic.validatePlacement(
    room.board, pos, card.number, levelCfg.type, levelCfg.height
  );
  if (!valid) return alert("Posición inválida para la estructura del árbol");

  const { db, ref, update } = window.FB;
  const updates = {};

  updates["board/" + pos] = card;

  const newHand = Object.assign({}, me.hand);
  delete newHand[card.id];
  updates["players/" + state.myId + "/hand"] = newHand;
  updates["players/" + state.myId + "/handCount"] = Object.keys(newHand).length;

  let pointsDelta = 0;
  let logMsgs = [];

  if (pos === 1) {
    pointsDelta += 2;
    logMsgs.push(me.name + " jugó " + card.number + " como raíz! +2 pts");
  }

  if (card.personality === "Orderly" && pos > 1 && room.board[String(pos - 1)]) {
    pointsDelta += 1;
    logMsgs.push(me.name + " colocó una carta Ordenada secuencialmente! +1 pt");
  }

  updates["players/" + state.myId + "/points"] = me.points + pointsDelta;

  if (card.personality === "Loud") {
    updates.loudTrigger = { playerId: state.myId, playerName: me.name, time: Date.now() };
    logMsgs.push("🔊 ¡Carta RUIDOSA jugada por " + me.name + "!");
  }

  if (card.personality === "Familiar" && room.lastPlayedCard && room.lastPlayedCard.personality === "Familiar") {
    const ids = Object.keys(room.players);
    const lastIdx = ids.indexOf(room.lastPlayedBy);
    const nextId = ids[(lastIdx + 1) % ids.length];
    const nextPlayer = room.players[nextId];
    const deck = room.deckRemaining || [];
    if (nextPlayer && deck.length > 0) {
      const drawn = deck[deck.length - 1];
      const newDeck = deck.slice(0, -1);
      const nextHand = Object.assign({}, nextPlayer.hand);
      nextHand[drawn.id] = drawn;
      updates["players/" + nextId + "/hand"] = nextHand;
      updates["players/" + nextId + "/handCount"] = Object.keys(nextHand).length;
      updates.deckRemaining = newDeck;
      logMsgs.push("¡Cadena Familiar! " + nextPlayer.name + " roba 1 carta");
    }
  }

  updates.lastPlayedCard = card;
  updates.lastPlayedBy = state.myId;

  await update(ref(db, "rooms/" + state.roomCode), updates);
  for (const msg of logMsgs) await addLog(state.roomCode, msg);

  const newBoard = Object.assign({}, room.board);
  newBoard[pos] = card;
  const filled = window.GameLogic.countFilledNodes(newBoard);
  if (filled === levelCfg.nodes) {
    await completeLevel();
  }

  state.selectedCardId = null;
  state.selectedPos = null;
}

async function completeLevel() {
  const { db, ref, update, get } = window.FB;
  const snap = await get(ref(db, "rooms/" + state.roomCode));
  const room = snap.val();

  const playerUpdates = {};
  for (const pid in room.players) {
    const p = room.players[pid];
    playerUpdates["players/" + pid + "/points"] = (p.points || 0) + 1;
  }

  await update(ref(db, "rooms/" + state.roomCode), Object.assign({}, playerUpdates, {
    phase: "levelEnd",
  }));
  await addLog(state.roomCode, "🎉 ¡Nivel " + room.currentLevel + " completado! +1 pt para todos.");
}

// ── Avanzar al siguiente nivel ───────────────────────────────────────
async function nextLevel() {
  const room = state.room;
  if (room.hostId !== state.myId) return;

  const { db, ref, update } = window.FB;
  const newLevel = room.currentLevel + 1;

  if (newLevel > 8) {
    await update(ref(db, "rooms/" + state.roomCode), { phase: "gameOver", result: "victory" });
    await addLog(state.roomCode, "🏆 ¡VICTORIA! ¡Los 8 niveles completados!");
    return;
  }

  const pool = window.GameData.buildMissionPool();
  const playerUpdates = {};
  for (const pid in room.players) {
    const p = room.players[pid];
    playerUpdates["players/" + pid + "/points"] = (p.points || 0) + 1;
    playerUpdates["players/" + pid + "/ready"] = false;
  }

  await update(ref(db, "rooms/" + state.roomCode), Object.assign({}, playerUpdates, {
    currentLevel: newLevel,
    phase: "missionSelect",
    missionPool: pool,
  }));
  await addLog(state.roomCode, "Nivel " + newLevel + " — Fase de selección de misiones");
}

// ── Terminar nivel manualmente (host) con penalización ───────────────
async function endLevel() {
  const room = state.room;
  if (room.hostId !== state.myId) return;

  const levelCfg = window.GameData.LEVELS[room.currentLevel - 1];
  const filled = window.GameLogic.countFilledNodes(room.board);
  const empty = levelCfg.nodes - filled;

  const { db, ref, update } = window.FB;
  let newLives = room.sharedLives;

  if (empty > 0) {
    newLives -= empty;
    await addLog(state.roomCode, "Nivel terminado con " + empty + " nodos vacíos. -" + empty + " vidas (" + Math.max(newLives,0) + " restantes)");
  }

  if (newLives <= 0) {
    await update(ref(db, "rooms/" + state.roomCode), { sharedLives: 0, phase: "gameOver", result: "defeat" });
    await addLog(state.roomCode, "💀 DERROTA! El grupo se quedó sin vidas.");
    return;
  }

  await update(ref(db, "rooms/" + state.roomCode), { sharedLives: newLives, phase: "levelEnd" });
}

// ── Usar señal ─────────────────────────────────────────────────────
async function useSignal(signalType) {
  if (!state.selectedCardId) return alert("Selecciona una carta primero");
  const room = state.room;
  const me = room.players[state.myId];
  const card = me.hand[state.selectedCardId];
  if (!card) return;

  if (!me.unlockedSignals || !me.unlockedSignals[signalType]) {
    return alert("Señal " + signalType + " no desbloqueada aún");
  }

  let cost = 0;
  if (signalType === "Range") {
    cost = window.GameData.DIFFICULTY[room.difficulty].rangeSignalCost;
    if (me.points < cost) return alert("No tienes suficientes puntos");
  }

  const { db, ref, update } = window.FB;
  await update(ref(db, "rooms/" + state.roomCode + "/players/" + state.myId), {
    signal: { type: signalType, card: card },
    points: me.points - cost,
  });
  await addLog(state.roomCode, me.name + " usa señal " + signalType);
}

// ── Completar / abandonar misión activa ──────────────────────────────
async function completeMission() {
  const room = state.room;
  const me = room.players[state.myId];
  if (!me.activeMission) return;

  const { db, ref, update } = window.FB;
  await update(ref(db, "rooms/" + state.roomCode + "/players/" + state.myId), {
    points: me.points + 3,
    activeMission: null,
  });
  await addLog(state.roomCode, "⭐ " + me.name + " completó su misión! +3 pts");
}

async function abandonMission() {
  const room = state.room;
  const me = room.players[state.myId];
  if (!me.activeMission) return;

  const { db, ref, update } = window.FB;
  await update(ref(db, "rooms/" + state.roomCode + "/players/" + state.myId), { activeMission: null });
  await addLog(state.roomCode, me.name + " abandonó su misión (puntos perdidos)");
}

// ── Gastar puntos en habilidades ──────────────────────────────────────
async function spendPoints(ability) {
  const room = state.room;
  const me = room.players[state.myId];
  const costs = { drawCard: 2, gainLife: 3, redrawHand: 4 };
  const cost = costs[ability];
  if (me.points < cost) return alert("No tienes suficientes puntos");

  const { db, ref, update } = window.FB;
  const updates = {};
  updates["players/" + state.myId + "/points"] = me.points - cost;

  if (ability === "drawCard") {
    const deck = room.deckRemaining || [];
    if (deck.length > 0) {
      const drawn = deck[deck.length - 1];
      updates["players/" + state.myId + "/hand/" + drawn.id] = drawn;
      updates["players/" + state.myId + "/handCount"] = me.handCount + 1;
      updates.deckRemaining = deck.slice(0, -1);
    }
  } else if (ability === "gainLife") {
    updates.sharedLives = Math.min(room.sharedLives + 1, room.maxLives + 3);
  } else if (ability === "redrawHand") {
    const oldCards = Object.values(me.hand || {});
    const deck = window.GameData.shuffle((room.deckRemaining || []).concat(oldCards));
    const count = Math.min(me.handCount, deck.length);
    const newHand = {};
    for (let i = 0; i < count; i++) newHand[deck[i].id] = deck[i];
    updates["players/" + state.myId + "/hand"] = newHand;
    updates.deckRemaining = deck.slice(count);
  }

  await update(ref(db, "rooms/" + state.roomCode), updates);
  await addLog(state.roomCode, me.name + " gastó " + cost + " pts en " + ability);
}

// ── Selección de carta/posición (estado local de UI) ──────────────────
function selectCard(cardId) {
  state.selectedCardId = state.selectedCardId === cardId ? null : cardId;
  state.selectedPos = null;
  renderAll();
}
function selectPosition(pos) {
  if (!state.selectedCardId) return alert("Selecciona una carta de tu mano primero");
  state.selectedPos = pos;
  renderAll();
}

// ── Render principal (llamado en cada cambio de Firebase) ─────────────
function renderAll() {
  const room = state.room;
  if (!room) return;

  if (room.phase === "lobby") {
    renderLobby(room);
  } else {
    window.UI.showGame();
    renderGame(room);
  }
}

function renderLobby(room) {
  document.getElementById("lobbyCode").textContent = room.code;
  const playersDiv = document.getElementById("lobbyPlayers");
  playersDiv.innerHTML = "";
  const players = Object.values(room.players || {});
  players.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "player-row";
    row.innerHTML = '<div class="player-dot" style="background:' + PLAYER_COLORS[i] + '"></div>' +
      '<span>' + p.name + ' ' + (i === 0 ? "(host)" : "") + ' ' + (p.id === state.myId ? "← tú" : "") + '</span>';
    playersDiv.appendChild(row);
  });

  const isHost = room.hostId === state.myId;
  const startBtn = document.getElementById("lobbyStartBtn");
  const waitMsg = document.getElementById("lobbyWaitMsg");
  if (isHost) {
    startBtn.style.display = players.length >= 2 ? "block" : "none";
    waitMsg.style.display = players.length >= 2 ? "none" : "block";
    waitMsg.textContent = "Esperando más jugadores (mínimo 2)...";
  } else {
    startBtn.style.display = "none";
    waitMsg.style.display = "block";
    waitMsg.textContent = "Esperando a que el host inicie la partida...";
  }
}

function renderGame(room) {
  const levelCfg = window.GameData.LEVELS[room.currentLevel - 1];
  const me = room.players[state.myId];
  const players = Object.values(room.players || {});
  const isHost = room.hostId === state.myId;

  document.getElementById("topRoomCode").textContent = "Sala: " + room.code;
  document.getElementById("topLevelInfo").textContent =
    "Nivel " + room.currentLevel + "/8 — " + (levelCfg.type === "BST" ? "BST" : "Pirámide") + " (" + levelCfg.nodes + " nodos)";
  document.getElementById("topDifficulty").textContent = room.difficulty;
  document.getElementById("topLives").textContent = room.sharedLives;
  document.getElementById("topMaxLives").textContent = room.maxLives;

  const phaseLabels = { lobby:"Lobby", missionSelect:"Misiones", playing:"Jugando",
    levelEnd:"¡Nivel completo!", gameOver:"Fin del juego" };
  const phasePill = document.getElementById("topPhase");
  phasePill.textContent = phaseLabels[room.phase] || room.phase;
  phasePill.className = "phase-pill " + room.phase;

  const playersBar = document.getElementById("playersBar");
  playersBar.innerHTML = "";
  players.forEach((p, i) => {
    const chip = document.createElement("div");
    chip.className = "player-chip" + (p.id === state.myId ? " me" : "");
    chip.style.borderColor = PLAYER_COLORS[i];
    chip.innerHTML =
      '<div class="dot" style="background:' + PLAYER_COLORS[i] + '"></div>' +
      '<span>' + p.name + (p.id === state.myId ? " (tú)" : "") + '</span>' +
      '<span class="pts">★' + p.points + '</span>' +
      '<span>[' + (p.handCount || 0) + ']</span>' +
      (p.signal ? '<span class="signal-badge">' + p.signal.type + ': ' + (p.signal.card ? p.signal.card.number : "") + '</span>' : "");
    playersBar.appendChild(chip);
  });

  const loudFlash = document.getElementById("loudFlash");
  if (room.loudTrigger && Date.now() - room.loudTrigger.time < 3000) {
    loudFlash.style.display = "block";
    setTimeout(function() { loudFlash.style.display = "none"; }, 3000 - (Date.now() - room.loudTrigger.time));
  } else {
    loudFlash.style.display = "none";
  }

  renderBoardTab(room, levelCfg, me, isHost);
  renderMissionsTab(room, me);
  renderLogTab(room);
  renderPlayersTab(room, players, isHost);
  renderHandZone(room, me, isHost);
}

function renderBoardTab(room, levelCfg, me, isHost) {
  const tab = document.getElementById("tabBoard");
  tab.innerHTML = "";

  if (room.phase === "playing") {
    const panel = document.createElement("div");
    panel.className = "card-panel";

    const header = document.createElement("div");
    header.style.display = "flex"; header.style.alignItems = "center";
    header.style.gap = "12px"; header.style.marginBottom = "12px";
    header.innerHTML = '<span style="font-weight:bold">' +
      (levelCfg.type === "BST" ? "🌳 Árbol BST" : "🔺 Pirámide Invertida") + '</span>';

    if (state.selectedCardId && state.selectedPos) {
      const playBtn = document.createElement("button");
      playBtn.className = "btn btn-success btn-small";
      playBtn.textContent = "▶ Jugar carta en posición " + state.selectedPos;
      playBtn.onclick = playCard;
      header.appendChild(playBtn);
    } else if (state.selectedCardId) {
      const hint = document.createElement("span");
      hint.style.fontSize = "12px"; hint.style.color = "#F1C40F";
      hint.textContent = "→ Click en una casilla del tablero";
      header.appendChild(hint);
    }

    panel.appendChild(header);

    const boardDiv = document.createElement("div");
    window.BoardRender.renderBoard(boardDiv, room.board || {}, levelCfg, {
      selectedPos: state.selectedPos,
      onSelectPosition: selectPosition,
    });
    panel.appendChild(boardDiv);
    tab.appendChild(panel);
  }

  else if (room.phase === "levelEnd") {
    const banner = document.createElement("div");
    banner.className = "banner success";
    banner.innerHTML =
      '<div class="banner-icon">🎉</div>' +
      '<div class="banner-title">¡Nivel ' + room.currentLevel + ' completado!</div>' +
      '<div class="banner-sub">Todos los nodos colocados correctamente. +1 pt para todos.</div>';
    if (isHost && room.currentLevel < 8) {
      const btn = document.createElement("button");
      btn.className = "btn btn-primary";
      btn.style.width = "auto"; btn.style.padding = "10px 24px";
      btn.style.background = "#fff"; btn.style.color = "#1E8449";
      btn.textContent = "Siguiente Nivel →";
      btn.onclick = nextLevel;
      banner.appendChild(btn);
    }
    if (room.currentLevel === 8) {
      const win = document.createElement("div");
      win.style.fontSize = "24px"; win.style.marginTop = "8px";
      win.textContent = "🏆 ¡Ganaron el juego!";
      banner.appendChild(win);
    }
    tab.appendChild(banner);
  }

  else if (room.phase === "gameOver") {
    const banner = document.createElement("div");
    banner.className = "banner " + (room.result === "victory" ? "success" : "danger");
    banner.innerHTML =
      '<div class="banner-icon">' + (room.result === "victory" ? "🏆" : "💀") + '</div>' +
      '<div class="banner-title">' + (room.result === "victory" ? "¡Victoria!" : "Fin del juego") + '</div>' +
      '<div class="banner-sub">' + (room.result === "victory" ? "Completaron los 8 niveles" : "El grupo se quedó sin vidas") + '</div>';
    tab.appendChild(banner);
  }

  else if (room.phase === "missionSelect") {
    const panel = document.createElement("div");
    panel.className = "card-panel";
    panel.innerHTML = '<div style="font-size:16px;font-weight:bold;margin-bottom:4px;">' +
      'Selección de Misiones — Nivel ' + room.currentLevel + '</div>' +
      '<div style="font-size:12px;color:#aaa;margin-bottom:16px;">' +
      'Elige una misión antes de repartir cartas. Se repartirán cuando todos estén listos.</div>';

    const poolDiv = document.createElement("div");
    window.MissionRender.renderMissionPool(poolDiv, room.missionPool, {
      myPoints: room.players[state.myId] ? room.players[state.myId].points : 0,
      canTake: true,
      onTake: takeMission,
      activeMission: room.players[state.myId] ? room.players[state.myId].activeMission : null,
      onComplete: completeMission,
      onAbandon: abandonMission,
    });
    panel.appendChild(poolDiv);

    const readyBtn = document.createElement("button");
    readyBtn.className = "btn btn-secondary";
    readyBtn.style.width = "auto"; readyBtn.style.marginTop = "16px";
    readyBtn.style.padding = "10px 24px";
    const me = room.players[state.myId];
    readyBtn.textContent = me && me.ready ? "✓ Esperando a otros..." : "✓ Listo para jugar";
    readyBtn.disabled = !!(me && me.ready);
    readyBtn.onclick = readyToPlay;
    panel.appendChild(readyBtn);

    tab.appendChild(panel);
  }
}

function renderMissionsTab(room, me) {
  const tab = document.getElementById("tabMissions");
  tab.innerHTML = "";
  const panel = document.createElement("div");
  panel.className = "card-panel";
  window.MissionRender.renderMissionPool(panel, room.missionPool, {
    myPoints: me ? me.points : 0,
    canTake: room.phase === "missionSelect",
    onTake: takeMission,
    activeMission: me ? me.activeMission : null,
    onComplete: completeMission,
    onAbandon: abandonMission,
  });
  tab.appendChild(panel);
}

function renderLogTab(room) {
  const tab = document.getElementById("tabLog");
  tab.innerHTML = "";
  const panel = document.createElement("div");
  panel.className = "card-panel";
  panel.innerHTML = '<div style="font-weight:bold;margin-bottom:8px;">Registro de Eventos</div>';

  const entries = Object.values(room.log || {}).sort(function(a, b) { return b.time - a.time; });
  for (const entry of entries.slice(0, 50)) {
    const div = document.createElement("div");
    div.className = "log-entry";
    const time = new Date(entry.time).toLocaleTimeString();
    div.innerHTML = '<span class="log-time">' + time + '</span>' + entry.msg;
    panel.appendChild(div);
  }
  tab.appendChild(panel);
}

function renderPlayersTab(room, players, isHost) {
  const tab = document.getElementById("tabPlayers");
  tab.innerHTML = "";
  const panel = document.createElement("div");
  panel.className = "card-panel";
  panel.innerHTML = '<div style="font-weight:bold;margin-bottom:12px;">Jugadores</div>';

  players.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "player-card";
    card.style.border = "1px solid " + PLAYER_COLORS[i];
    card.innerHTML =
      '<div class="player-card-head">' +
        '<div><span style="color:' + PLAYER_COLORS[i] + '">●</span> <strong>' + p.name + '</strong>' +
          (p.id === state.myId ? " (tú)" : "") + (i === 0 ? " 👑" : "") + '</div>' +
        '<div class="player-card-stats">' +
          '<span>★ ' + p.points + ' pts</span>' +
          '<span>🃏 ' + (p.handCount || 0) + ' cartas</span>' +
        '</div>' +
      '</div>' +
      (p.activeMission ? '<div class="player-card-mission">Misión: ' + p.activeMission.condition.substring(0,60) + '...</div>' : "") +
      (p.startMission ? '<div style="font-size:11px;color:#aaa;margin-top:2px;">Habilidad inicial: ' + p.startMission.reward.substring(0,60) + '...</div>' : "") +
      (p.signal ? '<div class="player-card-signal">📡 Señal ' + p.signal.type + ': carta ' + (p.signal.card ? p.signal.card.number : "") + ' (' + (p.signal.card ? p.signal.card.type : "") + ', ' + (p.signal.card ? p.signal.card.cardClass : "") + ')</div>' : "") +
      '<div style="margin-top:6px;">' +
        Object.keys(p.unlockedSignals || {}).map(function(s) { return '<span class="signal-tag">' + s + '</span>'; }).join("") +
      '</div>';
    panel.appendChild(card);
  });
  tab.appendChild(panel);
}

function renderHandZone(room, me, isHost) {
  const handZone = document.getElementById("handZone");
  const showHand = room.phase === "playing" || room.phase === "missionSelect";
  handZone.style.display = showHand ? "block" : "none";
  if (!showHand || !me) return;

  const toolbar = document.getElementById("handToolbar");
  toolbar.innerHTML = "";

  const label = document.createElement("span");
  label.className = "label";
  const handCards = Object.values(me.hand || {});
  label.textContent = "Tu Mano (" + handCards.length + " cartas)";
  toolbar.appendChild(label);

  const pts = document.createElement("span");
  pts.className = "pts";
  pts.textContent = "★ " + me.points + " pts";
  toolbar.appendChild(pts);

  if (room.phase === "playing") {
    for (const sig of Object.keys(me.unlockedSignals || {})) {
      const btn = document.createElement("button");
      btn.className = "toolbar-btn signal";
      btn.textContent = "📡 " + sig;
      btn.disabled = !state.selectedCardId;
      btn.onclick = (function(s) { return function() { useSignal(s); }; })(sig);
      toolbar.appendChild(btn);
    }

    const drawBtn = document.createElement("button");
    drawBtn.className = "toolbar-btn ability";
    drawBtn.textContent = "+Carta (2pts)";
    drawBtn.onclick = function() { spendPoints("drawCard"); };
    toolbar.appendChild(drawBtn);

    const lifeBtn = document.createElement("button");
    lifeBtn.className = "toolbar-btn ability";
    lifeBtn.textContent = "+Vida (3pts)";
    lifeBtn.onclick = function() { spendPoints("gainLife"); };
    toolbar.appendChild(lifeBtn);

    if (isHost) {
      const endBtn = document.createElement("button");
      endBtn.className = "toolbar-btn danger";
      endBtn.style.marginLeft = "auto";
      endBtn.textContent = "Terminar Nivel";
      endBtn.onclick = endLevel;
      toolbar.appendChild(endBtn);
    }
  }

  const cardsDiv = document.getElementById("handCards");
  cardsDiv.innerHTML = "";
  if (handCards.length === 0) {
    const empty = document.createElement("div");
    empty.style.color = "#555"; empty.style.fontSize = "13px"; empty.style.padding = "8px 0";
    empty.textContent = "Sin cartas en mano";
    cardsDiv.appendChild(empty);
  } else {
    for (const card of handCards) {
      const cardEl = window.CardRender.renderCard(card, {
        selected: state.selectedCardId === card.id,
        onClick: (function(id) { return function() { selectCard(id); }; })(card.id),
      });
      cardsDiv.appendChild(cardEl);
    }
  }
}

window.GameRoom = {
  createRoom, joinRoom, tryReconnect, startGame, takeMission, readyToPlay,
  playCard, nextLevel, endLevel, useSignal, completeMission, abandonMission,
  spendPoints, selectCard, selectPosition, state,
};
