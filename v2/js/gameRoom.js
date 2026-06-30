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
import { findBSTPosition, isValidPyramidPlacement, isVisibleTo, canAct,
         resolveBSTCascade, resolvePyramidParentPlay, demolishBST, demolishPyramid,
         canPlayAsPyramidParentB, isPyramidBasePosition } from "./gameLogicWrapper.js";

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

// ── Cambiar escenario en el lobby (host) ────────────────────────────
async function setScenario(scenario) {
  const room = state.room;
  if (!room || room.hostId !== state.myId) return;
  if (room.phase !== "lobby") return; // solo se cambia en lobby, no a mitad de partida
  const { db, ref, update } = window.FB;
  await update(ref(db, ROOT + "/" + state.roomCode), { scenario });
}

// ── Reiniciar partida (host) ─────────────────────────────────────────
// Vuelve la sala al lobby SIN perder la lista de jugadores ni el código
// de sala — todos los jugadores ya conectados quedan automáticamente en
// el lobby (vía su propio listener de Firebase, sin reingresar el
// código) en cuanto phase vuelve a "lobby". Pensado como vía de escape
// barata: errores de juego, ganas de cambiar de nivel/escenario, o
// simplemente no querer terminar el nivel en curso, sin el costo de
// crear una sala nueva y que todos vuelvan a unirse a mano.
async function restartRoom() {
  const room = state.room;
  if (!room || room.hostId !== state.myId) return alert("Solo el host puede reiniciar la partida");
  if (!confirm("¿Reiniciar partida? Se vuelve al lobby — se puede elegir otro nivel o escenario. Los jugadores conectados no necesitan reunirse de nuevo.")) return;

  const { db, ref, update, remove } = window.FB;
  // Limpiar todos los campos de partida en curso (A y B) sin tocar
  // players/hostId/code/scenario (scenario se mantiene; el host puede
  // cambiarlo después desde el lobby con setScenario si quiere).
  await update(ref(db, ROOT + "/" + state.roomCode), {
    phase: "lobby",
    levelId: null,
    endResult: null,
    // Escenario A
    declarePhase: false,
    queue: null,
    queueOrder: null,
    currentDeclarer: null,
    board: null,
    boardsByTree: null,
    hands: null,
    tableFree: null,
    lives: null,
    // Escenario B
    energy: null,
    discardPile: null,
    commonZone: null,
  });
  await addLog(state.roomCode, "— Partida reiniciada por el host — de vuelta al lobby —");

  state.selectedCard = null;
  state.demolishMode = false;
  window.UIV2.showLobby();
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

  if (level.scenario === "B") await dealLevelB(room, level);
  else await dealLevel(room, level);
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

  const boardsByTree = level.trees.map(() => ({}));
  const queue = {};
  playerIds.forEach((_, i) => { queue[i] = null; });

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
    const card = (room.hands[ownerId] || []).find(c => String(c.id) === String(cardId));
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
  if (room.queue[slotIdx]) { await addLog(state.roomCode, "Posición " + (slotIdx + 1) + " ya ocupada — sin empates."); return; }
  if (!state.selectedCard) { await addLog(state.roomCode, "Elegí primero una carta antes de declarar posición."); return; }

  const { db, ref, update } = window.FB;
  const sel = state.selectedCard;
  let card;
  if (sel.fromFree) {
    card = room.freeOnTable.find(c => String(c.id) === String(sel.cardId));
  } else {
    card = (room.hands[sel.ownerId] || []).find(c => String(c.id) === String(sel.cardId));
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
  let hands = JSON.parse(JSON.stringify(room.hands));
  let freeOnTable = [...room.freeOnTable];
  let boardsByTree = JSON.parse(JSON.stringify(room.boardsByTree));
  let pendingManualCard = [...(room.pendingManualCard || [])];
  const queueOrder = room.queueOrder;
  const logMsgs = [];

  Object.keys(room.queue).sort((a,b)=>Number(a)-Number(b)).forEach(slotIdx => {
    const slot = room.queue[slotIdx];
    if (!slot) return;
    const value = slot.card.number;

    if (slot.fromFree) {
      freeOnTable = freeOnTable.filter(c => String(c.id) !== String(slot.card.id));
    } else {
      hands[slot.ownerId] = hands[slot.ownerId].filter(c => String(c.id) !== String(slot.card.id));
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
  room.queueOrder.forEach((_, i) => { queue[i] = null; });
  await update(ref(db, ROOT + "/" + state.roomCode), { declarePhase: true, queue, currentDeclarer: 0 });
  await addLog(state.roomCode, "— Nueva ronda de declaración —");
}

// ════════════════════════════════════════════════════════════════
// ESCENARIO B — Revelación Tardía (sin queue: jugada simultánea libre)
// ════════════════════════════════════════════════════════════════
// A diferencia de A, B NO usa fase de declaración/queue (ver
// docs/BST_v2_Escenario_Revelacion_Tardia.md §1: la incertidumbre vive
// en el VALOR de las cartas, no en el orden de juego — superponer
// ambos sería redundante). Cada jugador actúa cuando quiere, escribe
// directo a Firebase. Choques simultáneos se resuelven por orden de
// llegada al servidor (Realtime Database serializa updates en la
// misma ruta automáticamente) — no se diseña regla de desempate extra.
//
// Estructura de sala para B en Firebase (bajo rooms_v2/{code}):
//   energy: número actual (compartido)
//   discardPile: [{id,number}, ...] — cartas descartadas, fuente de "robar"
//   commonZone: [{id,number}, ...] — cartas reveladas de una mano, sin dueño
//   boardsByTree: [{ "1": {number,revealed}, ... }, ...] — igual forma que A
//   demolishMode: { [playerId]: bool } — modo demoler activado por jugador (solo local en UI, no necesita Firebase, pero se deja por si se quiere sincronizar visualmente)

async function dealLevelB(room, level) {
  const { db, ref, update } = window.FB;
  const playerIds = Object.keys(room.players);
  const numPlayers = playerIds.length;

  const deck = shuffle(buildDeck());
  const hands = {};
  playerIds.forEach(pid => { hands[pid] = []; });
  deck.forEach((card, idx) => {
    hands[playerIds[idx % numPlayers]].push({ id: card.id, number: card.number });
  });

  const boardsByTree = level.trees.map(() => ({}));

  await update(ref(db, ROOT + "/" + state.roomCode), {
    phase: "playing",
    levelId: level.id,
    hands,
    boardsByTree,
    energy: level.energy,
    discardPile: [],
    commonZone: [],
    queueOrder: playerIds, // se reusa solo para listar jugadores, sin fases de queue
    endResult: null,
  });

  await addLog(state.roomCode, "Nivel " + level.label + " repartido (Escenario B) — energía inicial " + level.energy +
    (level.energy === 1 ? " (¡instantáneo!)" : "") + ".");
  window.UIV2.showGame();
}

function maxNodesForTreeB(level, treeIdx) {
  return slotsForTree(level.trees[treeIdx]);
}

function checkEndConditionsB(room, level, boardsByTree, energy) {
  if (energy <= 0) return "lose";
  const allFull = level.trees.every((tree, idx) => {
    const maxNodes = maxNodesForTreeB(level, idx);
    const board = boardsByTree[idx];
    for (let p = 1; p <= maxNodes; p++) if (!board[String(p)]) return false;
    return true;
  });
  return allFull ? "win" : null;
}

function selectCardB(source, ownerId, cardId) {
  // source: "hand" | "common". Selección puramente local (no Firebase).
  if (source === "hand" && ownerId !== state.myId) return; // solo tu propia mano
  state.selectedCard = { source, ownerId, cardId };
  window.UIV2.renderAll(state);
}

function deselectCardB() {
  state.selectedCard = null;
  window.UIV2.renderAll(state);
}

function takeSelectedCardValue(room) {
  const sel = state.selectedCard;
  if (!sel) return null;
  if (sel.source === "hand") {
    return (room.hands[sel.ownerId] || []).find(c => String(c.id) === String(sel.cardId)) || null;
  }
  return (room.commonZone || []).find(c => String(c.id) === String(sel.cardId)) || null;
}

function removeSelectedCardFromSource(room, hands, commonZone) {
  const sel = state.selectedCard;
  if (sel.source === "hand") {
    hands[sel.ownerId] = hands[sel.ownerId].filter(c => String(c.id) !== String(sel.cardId));
  } else {
    return commonZone.filter(c => String(c.id) !== String(sel.cardId));
  }
  return commonZone;
}

// ── Jugar carta en BST (posición decidida por valor, automática) ────
async function playSelectedCardBSTB(treeIdx) {
  const room = state.room;
  const level = getLevelById(room.levelId);
  const card = takeSelectedCardValue(room);
  if (!card) return;

  const { db, ref, update } = window.FB;
  const hands = JSON.parse(JSON.stringify(room.hands));
  let commonZone = [...(room.commonZone || [])];
  commonZone = removeSelectedCardFromSource(room, hands, commonZone);

  const boardsByTree = JSON.parse(JSON.stringify(room.boardsByTree));
  const board = boardsByTree[treeIdx];
  const maxNodes = maxNodesForTreeB(level, treeIdx);
  const pos = findBSTPosition(board, card.number, maxNodes);

  let discardPile = [...(room.discardPile || [])];
  let energy = room.energy;
  const logMsgs = [];

  if (pos === null) {
    discardPile.push(card);
    logMsgs.push("Carta " + card.number + " excede la profundidad del árbol " + (treeIdx + 1) + " — se descarta (sin costo de energía).");
  } else {
    board[String(pos)] = { number: card.number, revealed: false };
    logMsgs.push("Carta jugada en árbol " + (treeIdx + 1) + ", posición " + pos + " (oculta).");

    const { discardedGroups, events } = resolveBSTCascade(board, maxNodes);
    events.forEach(e => {
      if (e.type === "contradiction") {
        logMsgs.push("¡Contradicción! Posición " + e.pos + " no encajaba bajo su padre (pos " + e.parentPos + "). Se descartan " + e.subtree.length + " carta(s).");
        energy -= e.subtree.length;
        logMsgs.push("Energía -" + e.subtree.length + " por contradicción. Quedan " + energy + ".");
        e.subtree.forEach(pos => {
          discardPile.push({ id: "discarded_" + Date.now() + "_" + Math.random(), number: e.discardedValues[pos] });
        });
      }
    });
  }

  const endResult = checkEndConditionsB(room, level, boardsByTree, energy);

  await update(ref(db, ROOT + "/" + state.roomCode), { hands, commonZone, boardsByTree, discardPile, energy, endResult });
  for (const msg of logMsgs) await addLog(state.roomCode, msg);
  if (endResult) await addLog(state.roomCode, endResult === "win" ? "¡Nivel completado!" : "Energía agotada — nivel perdido.");

  state.selectedCard = null;
  window.UIV2.renderAll(state);
}

// ── Pirámide-B: jugar en la base (posición libre elegida por jugador) ──
async function playSelectedCardPyramidBaseB(treeIdx, pos) {
  const room = state.room;
  const level = getLevelById(room.levelId);
  const tree = level.trees[treeIdx];
  const board = room.boardsByTree[treeIdx];
  if (board[String(pos)]) return; // ocupado
  if (!isPyramidBasePosition(pos, tree.height)) return;

  const card = takeSelectedCardValue(room);
  if (!card) return;

  const { db, ref, update } = window.FB;
  const hands = JSON.parse(JSON.stringify(room.hands));
  let commonZone = removeSelectedCardFromSource(room, hands, [...(room.commonZone || [])]);
  const boardsByTree = JSON.parse(JSON.stringify(room.boardsByTree));
  boardsByTree[treeIdx][String(pos)] = { number: card.number, revealed: false };

  await update(ref(db, ROOT + "/" + state.roomCode), { hands, commonZone, boardsByTree });
  await addLog(state.roomCode, "Carta jugada en la base del tablero " + (treeIdx + 1) + ", posición " + pos + " (oculta).");

  state.selectedCard = null;
  window.UIV2.renderAll(state);
}

// ── Pirámide-B: jugar como padre de un par fijo ya completo ─────────
async function playSelectedCardPyramidParentB(treeIdx, pos) {
  const room = state.room;
  const level = getLevelById(room.levelId);
  const tree = level.trees[treeIdx];
  const board = room.boardsByTree[treeIdx];
  if (!canPlayAsPyramidParentB(board, pos, tree.height)) return;

  const card = takeSelectedCardValue(room);
  if (!card) return;

  const { db, ref, update } = window.FB;
  const hands = JSON.parse(JSON.stringify(room.hands));
  let commonZone = removeSelectedCardFromSource(room, hands, [...(room.commonZone || [])]);
  const boardsByTree = JSON.parse(JSON.stringify(room.boardsByTree));
  const treeBoard = boardsByTree[treeIdx];
  treeBoard[String(pos)] = { number: card.number, revealed: false };

  const res = resolvePyramidParentPlay(treeBoard, pos);
  let discardPile = [...(room.discardPile || [])];
  let energy = room.energy;
  const logMsgs = [];

  if (!res.ok) {
    energy -= 3;
    res.discarded.forEach(pos => {
      discardPile.push({ id: "discarded_" + Date.now() + "_" + Math.random(), number: res.discardedValues[pos] });
    });
    logMsgs.push("¡Contradicción! Pareja no quedó en orden ascendente en tablero " + (treeIdx + 1) + ". Se descartan 3 cartas (padre + ambos hijos). Energía -3, quedan " + energy + ".");
  } else {
    logMsgs.push("Pareja revelada en tablero " + (treeIdx + 1) + " — orden válido.");
  }

  const endResult = checkEndConditionsB(room, level, boardsByTree, energy);

  await update(ref(db, ROOT + "/" + state.roomCode), { hands, commonZone, boardsByTree, discardPile, energy, endResult });
  for (const msg of logMsgs) await addLog(state.roomCode, msg);
  if (endResult) await addLog(state.roomCode, endResult === "win" ? "¡Nivel completado!" : "Energía agotada — nivel perdido.");

  state.selectedCard = null;
  window.UIV2.renderAll(state);
}

// ── Acciones de energía ──────────────────────────────────────────────
async function actionDrawB() {
  const room = state.room;
  if (room.energy < 1) return;
  const discardPile = [...(room.discardPile || [])];
  const idx = discardPile.findIndex(c => c.number !== null);
  if (idx === -1) { await addLog(state.roomCode, "El mazo de descarte está vacío — no hay nada que robar."); return; }
  const card = discardPile.splice(idx, 1)[0];

  const { db, ref, update } = window.FB;
  const hands = JSON.parse(JSON.stringify(room.hands));
  hands[state.myId].push(card);
  const energy = room.energy - 1;

  await update(ref(db, ROOT + "/" + state.roomCode), { hands, discardPile, energy });
  await addLog(state.roomCode, state.myName + " robó una carta del descarte a su mano. Energía -1, quedan " + energy + ".");
  window.UIV2.renderAll(state);
}

async function actionRevealFromHandB() {
  const room = state.room;
  const sel = state.selectedCard;
  if (!sel || sel.source !== "hand" || sel.ownerId !== state.myId) return;
  if (room.energy < 2) return;

  const card = takeSelectedCardValue(room);
  if (!card) return;

  const { db, ref, update } = window.FB;
  const hands = JSON.parse(JSON.stringify(room.hands));
  hands[state.myId] = hands[state.myId].filter(c => String(c.id) !== String(card.id));
  const commonZone = [...(room.commonZone || []), card];
  const energy = room.energy - 2;

  await update(ref(db, ROOT + "/" + state.roomCode), { hands, commonZone, energy });
  await addLog(state.roomCode, state.myName + " reveló la carta " + card.number + " a la zona común. Energía -2, quedan " + energy + ".");

  state.selectedCard = null;
  window.UIV2.renderAll(state);
}

function activateDemolishModeB() {
  state.demolishMode = !state.demolishMode;
  state.selectedCard = null;
  window.UIV2.renderAll(state);
}

async function demolishAtB(treeIdx, pos) {
  if (!state.demolishMode) return;
  const room = state.room;
  const level = getLevelById(room.levelId);
  const tree = level.trees[treeIdx];
  const boardsByTree = JSON.parse(JSON.stringify(room.boardsByTree));
  const board = boardsByTree[treeIdx];

  const result = tree.type === "bst"
    ? demolishBST(board, pos, maxNodesForTreeB(level, treeIdx))
    : demolishPyramid(board, pos);
  if (!result) return;
  const { group, values } = result;

  const { db, ref, update } = window.FB;
  let discardPile = [...(room.discardPile || [])];
  group.forEach(p => discardPile.push({ id: "discarded_" + Date.now() + "_" + Math.random(), number: values[p] }));
  const energy = room.energy - group.length;

  const endResult = checkEndConditionsB(room, level, boardsByTree, energy);

  await update(ref(db, ROOT + "/" + state.roomCode), { boardsByTree, discardPile, energy, endResult });
  await addLog(state.roomCode, "Demolida posición " + pos + " en tablero " + (treeIdx + 1) + " — arrastró " + group.length + " carta(s). Energía -" + group.length + ", quedan " + energy + ".");
  if (endResult) await addLog(state.roomCode, endResult === "win" ? "¡Nivel completado!" : "Energía agotada — nivel perdido.");

  state.demolishMode = false;
  window.UIV2.renderAll(state);
}

window.GameRoomV2 = {
  state, createRoom, joinRoom, tryReconnect, listenToRoom, startGame,
  selectCardToDeclare, declareToSlot, resolveQueue, attemptManualPlacement, startNewRound,
  setScenario, restartRoom,
  // Escenario B
  selectCardB, deselectCardB, playSelectedCardBSTB, playSelectedCardPyramidBaseB,
  playSelectedCardPyramidParentB, actionDrawB, actionRevealFromHandB,
  activateDemolishModeB, demolishAtB,
};
