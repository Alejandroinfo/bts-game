// ════════════════════════════════════════════════════════════════
// GAME ROOM — v2: sala multijugador real sobre Firebase (rooms_v2/)
// ════════════════════════════════════════════════════════════════
// Patrón de sala/código/reconexión copiado de v1 (js/gameRoom.js),
// adaptado para escribir bajo "rooms_v2/" en vez de "rooms/".
//
// Modelo de seguridad de información elegido (decisión explícita):
// "simple" — cada navegador recibe el estado COMPLETO de Firebase
// (todas las manos, ocultas o no) y decide del lado del cliente qué
// mostrar. No hay servidor que filtre por jugador. Aceptable para
// jugar con amigos de confianza; cualquiera podría ver todo abriendo
// la consola. Ver discusión en el chat de diseño antes de este código.
// ════════════════════════════════════════════════════════════════

import { LEVELS_A, LEVELS_B, getLevelById, totalSlots, slotsForTree,
         buildDeck, shuffle, fixedNeighborMap } from "./gameData.js";
import { findBSTPosition, isValidPyramidPlacement, isVisibleTo, canAct } from "./gameLogicWrapper.js";

const ROOT = "rooms_v2";

let state = {
  roomCode: null,
  myId: null,
  myName: null,
  room: null,
  selectedCard: null, // { ownerId, cardId, fromFree } carta elegida para declarar
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
  const scenario = document.getElementById("hostScenario").value; // "A" | "B"
  if (!name) return alert("Escribe tu nombre");

  const { db, ref, set } = window.FB;
  const code = genCode();
  const myId = genPlayerId();

  const roomData = {
    code,
    hostId: myId,
    scenario,
    phase: "lobby",
    levelId: null,
    players: {
      [myId]: { id: myId, name, ready: false },
    },
    log: { [Date.now()]: { time: Date.now(), msg: name + " creó la sala (Escenario " + scenario + ")" } },
  };

  await set(ref(db, ROOT + "/" + code), roomData);

  state.roomCode = code;
  state.myId = myId;
  state.myName = name;
  localStorage.setItem("bst_v2_session", JSON.stringify({ code, myId, name }));

  document.getElementById("lobbyCode").textContent = code;
  window.UIV2.showLobby();
  listenToRoom(code);
}

// ── Unirse a sala ──────────────────────────────────────────────────
async function joinRoom() {
  const name = document.getElementById("joinName").value.trim();
  const code = document.getElementById("joinCode").value.trim().toUpperCase();
  if (!name) return window.UIV2.showJoinError("Escribe tu nombre");
  if (!code) return window.UIV2.showJoinError("Escribe el código de sala");

  const { db, ref, get, set } = window.FB;
  const roomRef = ref(db, ROOT + "/" + code);
  const snap = await get(roomRef);

  if (!snap.exists()) return window.UIV2.showJoinError("Sala no encontrada");
  const room = snap.val();
  if (room.phase !== "lobby") return window.UIV2.showJoinError("La partida ya comenzó");

  const playerCount = Object.keys(room.players || {}).length;
  if (playerCount >= 5) return window.UIV2.showJoinError("Sala llena (máximo 5)");

  const myId = genPlayerId();
  await set(ref(db, ROOT + "/" + code + "/players/" + myId), { id: myId, name, ready: false });
  await addLog(code, name + " se unió a la sala");

  state.roomCode = code;
  state.myId = myId;
  state.myName = name;
  localStorage.setItem("bst_v2_session", JSON.stringify({ code, myId, name }));

  document.getElementById("lobbyCode").textContent = code;
  window.UIV2.showLobby();
  listenToRoom(code);
}

// ── Reconexión automática ───────────────────────────────────────────
async function tryReconnect() {
  const saved = localStorage.getItem("bst_v2_session");
  if (!saved) return false;
  const { code, myId, name } = JSON.parse(saved);

  const { db, ref, get } = window.FB;
  const snap = await get(ref(db, ROOT + "/" + code + "/players/" + myId));
  if (!snap.exists()) { localStorage.removeItem("bst_v2_session"); return false; }

  state.roomCode = code;
  state.myId = myId;
  state.myName = name;
  listenToRoom(code);

  const roomSnap = await get(ref(db, ROOT + "/" + code));
  const room = roomSnap.val();
  if (room.phase === "lobby") {
    document.getElementById("lobbyCode").textContent = code;
    window.UIV2.showLobby();
  } else {
    window.UIV2.showGame();
  }
  return true;
}

async function addLog(code, msg) {
  const { db, ref, push, set } = window.FB;
  const logRef = push(ref(db, ROOT + "/" + code + "/log"));
  await set(logRef, { time: Date.now(), msg });
}

function listenToRoom(code) {
  const { db, ref, onValue } = window.FB;
  onValue(ref(db, ROOT + "/" + code), (snap) => {
    const room = snap.val();
    if (!room) return;
    state.room = room;
    window.UIV2.renderAll(state);
  });
}

// ── Iniciar partida (host elige nivel y reparte UNA vez) ─────────────
// Reparto host-autoritativo: solo el host ejecuta dealLevel(), y el
// resultado se escribe a Firebase. Los demás navegadores SOLO leen
// vía onValue — nadie más corre su propio Math.random() de reparto,
// porque si cada navegador repartiera por su cuenta, cada jugador
// vería una mano distinta e inconsistente.
async function startGame(levelId) {
  const room = state.room;
  if (room.hostId !== state.myId) return alert("Solo el host puede iniciar la partida");
  const players = Object.values(room.players || {});
  if (players.length < 2) return alert("Se necesitan al menos 2 jugadores");

  const level = getLevelById(levelId);
  if (!level) return alert("Nivel inválido");

  await dealLevel(room, level);
}

async function dealLevel(room, level) {
  const { db, ref, update } = window.FB;
  const playerIds = Object.keys(room.players);
  const numPlayers = playerIds.length;

  const slots = totalSlots(level);
  const extra = level.extraCards || 0;
  const free = level.freeCardsOnTable || 0;
  const totalToDeal = slots + extra;

  const deck = shuffle(buildDeck());
  const freeOnTable = deck.splice(0, free);
  const dealtCards = deck.splice(0, totalToDeal);

  // Reparto carta por carta (round-robin), igual que cualquier juego
  // de cartas convencional — sin draw adicional más allá del setup.
  const hands = {};
  playerIds.forEach(pid => { hands[pid] = []; });
  dealtCards.forEach((card, idx) => {
    hands[playerIds[idx % numPlayers]].push(card);
  });

  // hiddenFraction: decide, carta por carta en el mismo reparto, si
  // queda oculta para su dueño. "ownerAlways" no usa ocultamiento de
  // mano (la gracia de ese modo es otra). Remanente de redondeo rota
  // de jugador en jugador usando una semilla aleatoria por partida,
  // para no cargar siempre al mismo con la carta oculta extra.
  const hiddenFrac = level.agency === "ownerAlways" ? 0 : (level.hiddenFraction || 0);
  const rotationSeed = Math.floor(Math.random() * 1000);

  playerIds.forEach((pid, pIdx) => {
    const hand = hands[pid];
    const numHidden = Math.round(hand.length * hiddenFrac);
    const order = hand.map((_, i) => i);
    for (let k = 0; k < order.length; k++) {
      const j = (k + rotationSeed + pIdx) % order.length;
      [order[k], order[j]] = [order[j], order[k]];
    }
    const hiddenIdxSet = new Set(order.slice(0, numHidden));
    hands[pid] = hand.map((card, i) => ({
      id: card.id, number: card.number,
      hiddenFromOwner: hiddenIdxSet.has(i),
    }));
  });

  // Firebase Realtime Database elimina del árbol cualquier campo cuyo
  // valor sea un objeto/array VACÍO ({} o []) — ver
  // BST_Animals_Project_Knowledge.md §12 (mismo bug que v1 ya tuvo y
  // resolvió). Un tablero recién repartido es {} por cada árbol, así
  // que sin este marcador, boardsByTree completo podía desaparecer al
  // guardarse, dejando `room.boardsByTree` como `undefined` y
  // crasheando el render en cualquier navegador que recibiera ese
  // snapshot. Se serializa cada árbol vacío como { _empty: true } en
  // vez de {} — mismo patrón que usa v1 para filas vacías de Pyramid.
  const boardsByTree = level.trees.map(() => ({ _empty: true }));
  // Mismo problema que boardsByTree: Firebase BORRA cualquier campo
  // cuyo valor sea null (es literalmente su forma de borrar algo). Un
  // queue recién reseteado es {0: null, 1: null, ...} — si se
  // escribiera así, Firebase podría eliminar el campo "queue" entero,
  // dejando `room.queue` como `undefined` y crasheando cualquier
  // `Object.keys(room.queue)` / `Object.values(room.queue)` en
  // cualquier navegador conectado. Se usa { _empty: true } como
  // marcador de slot vacío, igual que con boardsByTree.
  const queue = {};
  playerIds.forEach((_, i) => { queue[i] = { _empty: true }; });

  await update(ref(db, ROOT + "/" + state.roomCode), {
    phase: "playing",
    levelId: level.id,
    hands,
    freeOnTable,
    boardsByTree,
    pendingManualCard: [],
    invalidPlacements: [],
    queue,
    queueOrder: playerIds, // orden fijo de jugadores para indexar el queue por posición
    declarePhase: true,
    currentDeclarer: 0,
    livesUsed: 0,
    fixedNeighborOf: fixedNeighborMap(playerIds),
  });

  await addLog(state.roomCode, "Nivel " + level.label + " repartido — mazo de 64, " + numPlayers + " jugadores.");
  window.UIV2.showGame();
}

// ── Declarar una carta en una posición del queue ─────────────────────
async function selectCardToDeclare(ownerId, cardId, fromFree) {
  const room = state.room;
  if (!room.declarePhase) return;

  if (!fromFree) {
    const card = ((room.hands || {})[ownerId] || []).find(c => String(c.id) === String(cardId));
    if (!card) return;
    if (!canAct(getLevelById(room.levelId), ownerId, state.myId, card, room.fixedNeighborOf)) {
      await addLog(state.roomCode, state.myName + " no tiene agencia para jugar esa carta.");
      return;
    }
  }
  state.selectedCard = { ownerId: fromFree ? null : ownerId, cardId, fromFree: !!fromFree };
  window.UIV2.renderAll(state); // actualización puramente local, no toca Firebase
}

async function declareToSlot(slotIdx) {
  const room = state.room;
  if (!room.declarePhase) return;
  if (room.queue[slotIdx] && !room.queue[slotIdx]._empty) { await addLog(state.roomCode, "Posición " + (slotIdx + 1) + " ya ocupada — sin empates."); return; }
  if (!state.selectedCard) { await addLog(state.roomCode, "Elegí primero una carta antes de declarar posición."); return; }

  const { db, ref, update } = window.FB;
  const sel = state.selectedCard;
  let card;
  if (sel.fromFree) {
    card = (room.freeOnTable || []).find(c => String(c.id) === String(sel.cardId));
  } else {
    card = ((room.hands || {})[sel.ownerId] || []).find(c => String(c.id) === String(sel.cardId));
  }
  if (!card) { state.selectedCard = null; return; }

  const queueUpdate = {};
  queueUpdate["queue/" + slotIdx] = { ownerId: sel.fromFree ? null : sel.ownerId, actingId: state.myId, card, fromFree: sel.fromFree };

  await update(ref(db, ROOT + "/" + state.roomCode), queueUpdate);
  await addLog(state.roomCode, state.myName + " declaró en posición " + (slotIdx + 1) +
    (sel.fromFree ? " (carta libre)" : sel.ownerId === state.myId ? " (carta propia)" : " (carta de otro jugador)"));

  state.selectedCard = null;
  window.UIV2.renderAll(state);
}

// ── Resolver queue (fase de efectos no-op por ahora) y ejecutar ───────
async function resolveQueue() {
  const room = state.room;
  const { db, ref, update } = window.FB;
  const level = getLevelById(room.levelId);

  await update(ref(db, ROOT + "/" + state.roomCode), { declarePhase: false });
  await addLog(state.roomCode, "Queue resuelto (sin efectos activos) — ejecutando en orden 1, 2, 3…");

  // Ejecutar en orden 1..N. Se relee el room actualizado a cada paso
  // vía variables locales (no via Firebase de nuevo) porque venimos
  // del listener — `room` ya es el estado más reciente conocido.
  let hands = JSON.parse(JSON.stringify(room.hands || {}));
  let freeOnTable = [...(room.freeOnTable || [])];
  let boardsByTree = JSON.parse(JSON.stringify(room.boardsByTree));
  let pendingManualCard = [...(room.pendingManualCard || [])];
  const queueOrder = room.queueOrder;
  const logMsgs = [];

  Object.keys(room.queue || {}).sort((a,b)=>Number(a)-Number(b)).forEach(slotIdx => {
    const slot = room.queue[slotIdx];
    if (!slot || slot._empty) return;
    const value = slot.card.number;

    if (slot.fromFree) {
      freeOnTable = freeOnTable.filter(c => String(c.id) !== String(slot.card.id));
    } else {
      hands[slot.ownerId] = (hands[slot.ownerId] || []).filter(c => String(c.id) !== String(slot.card.id));
    }

    let placed = false;
    for (let treeIdx = 0; treeIdx < level.trees.length && !placed; treeIdx++) {
      const tree = level.trees[treeIdx];
      const maxNodes = slotsForTree(tree);
      const board = boardsByTree[treeIdx];

      if (tree.type === "bst") {
        const pos = findBSTPosition(board, value, maxNodes);
        if (pos === null) continue;
        board[String(pos)] = { number: value };
        delete board._empty; // ya no está vacío, limpiar el marcador de este árbol específico
        logMsgs.push("Pos.queue " + (Number(slotIdx)+1) + ": carta " + value + " → BST árbol " + (treeIdx+1) + ", nodo " + pos + " (automático).");
        placed = true;
      } else {
        pendingManualCard.push({ treeIdx, value });
        logMsgs.push("Pos.queue " + (Number(slotIdx)+1) + ": carta " + value + " → Pirámide árbol " + (treeIdx+1) + ", pendiente de colocación manual.");
        placed = true;
      }
    }
    if (!placed) logMsgs.push("Pos.queue " + (Number(slotIdx)+1) + ": carta " + value + " excede la profundidad disponible — se descarta.");
  });

  await update(ref(db, ROOT + "/" + state.roomCode), { hands, freeOnTable, boardsByTree, pendingManualCard });
  for (const msg of logMsgs) await addLog(state.roomCode, msg);
}

async function attemptManualPlacement(treeIdx, pos) {
  const room = state.room;
  const pending = (room.pendingManualCard || []).find(p => p.treeIdx === treeIdx);
  if (!pending) return;

  const level = getLevelById(room.levelId);
  const tree = level.trees[treeIdx];
  const boardsByTree = JSON.parse(JSON.stringify(room.boardsByTree));
  const board = boardsByTree[treeIdx];
  const valid = isValidPyramidPlacement(board, pos, pending.value, tree.height);

  board[String(pos)] = { number: pending.value };
  delete board._empty; // ya no está vacío, limpiar el marcador de este árbol específico
  const newPending = (room.pendingManualCard || []).filter(p => p !== pending);
  const invalidPlacements = [...(room.invalidPlacements || [])];

  const { db, ref, update } = window.FB;
  if (!valid) {
    invalidPlacements.push({ treeIdx, pos, value: pending.value });
    await update(ref(db, ROOT + "/" + state.roomCode), { boardsByTree, pendingManualCard: newPending, invalidPlacements });
    await addLog(state.roomCode, "[PyramidInvalidPlacementAllowed] carta " + pending.value + " colocada en nodo " + pos +
      " (árbol " + (treeIdx+1) + ") — posición NO válida según heap-order. No se bloqueó, queda registrado.");
  } else {
    await update(ref(db, ROOT + "/" + state.roomCode), { boardsByTree, pendingManualCard: newPending });
    await addLog(state.roomCode, "Carta " + pending.value + " colocada en nodo " + pos + " (árbol " + (treeIdx+1) + ") — posición válida.");
  }
}

async function startNewRound() {
  const room = state.room;
  const { db, ref, update } = window.FB;
  const queue = {};
  room.queueOrder.forEach((_, i) => { queue[i] = { _empty: true }; });
  await update(ref(db, ROOT + "/" + state.roomCode), { declarePhase: true, queue, currentDeclarer: 0 });
  await addLog(state.roomCode, "— Nueva ronda de declaración —");
}

window.GameRoomV2 = {
  state, createRoom, joinRoom, tryReconnect, listenToRoom, startGame,
  selectCardToDeclare, declareToSlot, resolveQueue, attemptManualPlacement, startNewRound,
};
