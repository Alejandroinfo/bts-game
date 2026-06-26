// ════════════════════════════════════════════════════════════════
// GAME ROOM — Toda la lógica de sala y sincronización con Firebase
// ════════════════════════════════════════════════════════════════

const PLAYER_COLORS = ["#2E86AB","#E84855","#3BB273","#F18F01","#7B2D8B"];

// Devuelve la configuración del nivel actual, ya sea de tutorial
// (T1-T6) o del juego real (Nivel 1-8), según corresponda.
function getCurrentLevelCfg(room) {
  if (room.isTutorial && room.tutorialLevel != null) {
    return window.GameData.TUTORIAL_LEVELS[room.tutorialLevel - 1];
  }
  return window.GameData.LEVELS[room.currentLevel - 1];
}

// Fase 1 del tutorial (T1-T2): solo números, sin color ni personalidad
// visibles, y las habilidades especiales no tienen ningún efecto.
function isPhase1Tutorial(room) {
  if (!room.isTutorial || room.tutorialLevel == null) return false;
  const cfg = window.GameData.TUTORIAL_LEVELS[room.tutorialLevel - 1];
  return cfg.phase === 1;
}

let state = {
  roomCode: null,
  myId: null,
  myName: null,
  room: null,
  selectedCardId: null,   // carta elegida para SEÑALAR (no para jugar)
};

let _firstCardTimerInterval = null; // setInterval del contador de 30s (misión #2)
let _levelTimerInterval = null; // setInterval del temporizador de nivel (3/6/9/12 min)

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
  const tutorialMode = document.getElementById("hostTutorialMode").checked;
  const missionsEnabled = document.getElementById("hostMissionsEnabled").checked;
  if (!name) return alert("Escribe tu nombre");

  const { db, ref, set } = window.FB;
  const code = genCode();
  const myId = genPlayerId();
  const diff = window.GameData.DIFFICULTY[difficulty];

  // Si está en modo tutorial, el pozo de vidas inicial es el del
  // tutorial (separado); se reinicia al pasar al Nivel 1 real.
  const startLives = tutorialMode ? window.GameData.TUTORIAL_DIFFICULTY.lives : diff.lives;
  const startPts = tutorialMode ? window.GameData.TUTORIAL_DIFFICULTY.startPts : diff.startPts;

  const roomData = {
    code,
    hostId: myId,
    difficulty,
    phase: "lobby",
    isTutorial: tutorialMode,
    tutorialLevel: tutorialMode ? 1 : null, // 1-6 durante el tutorial, null en modo normal
    missionsEnabled,
    sharedLives: startLives,
    maxLives: startLives,
    currentLevel: 1,
    usedRetreat: false,
    retreatVotes: {},
    signalChoicePending: false,
    signalChoicesMade: {},
    board: {},
    missionPool: null,
    stats: window.MissionTracker.initStatsForNewGame(),
    players: {
      [myId]: {
        id: myId, name, points: startPts,
        hand: {}, handCount: 0,
        activeMission: null, startMission: null,
        unlockedSignals: { Range: true },
        signal: null, ready: false,
      }
    },
    log: { [Date.now()]: { time: Date.now(), msg: name + " creó la sala" + (tutorialMode ? " (Modo Tutorial)" : "") } },
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
  const startPts = room.isTutorial ? window.GameData.TUTORIAL_DIFFICULTY.startPts : diff.startPts;

  await set(ref(db, "rooms/" + code + "/players/" + myId), {
    id: myId, name, points: startPts,
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

  const { db, ref, update, get } = window.FB;

  if (room.isTutorial) {
    // El tutorial Fase 1 (niveles T1-T2) no tiene pool de misiones ni
    // colores/personalidades activos — se va directo a repartir cartas.
    await update(ref(db, "rooms/" + state.roomCode), { phase: "tutorialIntro" });
    await addLog(state.roomCode, "🎓 ¡Tutorial iniciado! " + window.GameData.TUTORIAL_PHASE_INFO[1].title);
    window.UI.showGame();
    return;
  }

  if (room.missionsEnabled === false) {
    // Sin misiones: se elimina la fase intermedia por completo, se
    // reparten las cartas directo al iniciar la partida.
    await addLog(state.roomCode, "¡Partida iniciada sin misiones! Repartiendo cartas...");
    window.UI.showGame();
    const snap = await get(ref(db, "rooms/" + state.roomCode));
    await dealLevel(snap.val());
    return;
  }

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
  const isTutorial = !!room.isTutorial && room.tutorialLevel != null;
  const levelCfg = isTutorial
    ? window.GameData.TUTORIAL_LEVELS[room.tutorialLevel - 1]
    : window.GameData.LEVELS[room.currentLevel - 1];
  const playerIds = Object.keys(room.players);
  // En tutorial se reparte 1 carta extra por jugador respecto al cálculo normal
  const baseCount = window.GameData.cardsPerPlayer(levelCfg.nodes, playerIds.length);
  const count = isTutorial ? baseCount + 1 : baseCount;

  const deck = window.GameData.shuffle(window.GameData.buildDeck());

  let deckIdx = 0;
  const playerUpdates = {};
  const dealtHands = {}; // para verificar misiones de mano justo después
  for (const pid of playerIds) {
    const hand = {};
    for (let i = 0; i < count && deckIdx < deck.length; i++) {
      const card = deck[deckIdx++];
      hand[card.id] = card;
    }
    dealtHands[pid] = hand;
    playerUpdates["players/" + pid + "/hand"] = hand;
    playerUpdates["players/" + pid + "/handCount"] = Object.keys(hand).length;
    playerUpdates["players/" + pid + "/ready"] = false;
    playerUpdates["players/" + pid + "/signal"] = null;
  }

  const resetStats = window.MissionTracker.resetLevelStats(room.stats || {}, room.sharedLives);

  // Para niveles de Pirámide, el tablero se construye con el sistema
  // de bloques flotantes (ver pyramidBlocks.js) — necesita su propio
  // estado persistente además del board plano que se usa para
  // mostrar y para BST. Se serializa a una forma segura para
  // Firebase (que elimina arrays vacíos anidados).
  const pyramidState = levelCfg.type === "Pyramid"
    ? window.PyramidBlocks.serializePyramidForFirebase(
        window.PyramidBlocks.createEmptyPyramid(levelCfg.height))
    : null;

  await update(ref(db, "rooms/" + state.roomCode), Object.assign({}, playerUpdates, {
    phase: "playing",
    board: { "_init": true },
    pyramidState,
    pyramidStateBeforeLast: pyramidState, // mismo estado vacío al inicio
    pyramidHyperactiveChain: [], // valores Hyperactive acumulados desde la última carta normal
    pyramidLastNonHyperCard: null, // la última carta NO-Hyperactiva jugada (ancla fija de la cadena)
    pyramidPlaySequence: [], // secuencia completa de cartas jugadas en este nivel (para debug)
    deckRemaining: deck.slice(deckIdx),
    lastPlayedCard: null,
    lastPlayedBy: null,
    lastPlayedPos: null,
    shyStack: [],
    familiarPassPending: false,
    familiarPassChoices: {},
    retreatVotes: {},
    stats: resetStats,
    // Temporizador del nivel — no aplica durante el tutorial (igual
    // que la Retirada Estratégica, para que el aprendizaje no tenga
    // presión de tiempo).
    levelTimerStart: isTutorial ? null : Date.now(),
    levelTimerDurationSec: isTutorial ? null : levelCfg.timeLimitSec,
  }));

  const levelLabel = isTutorial
    ? "Tutorial " + room.tutorialLevel + "/6"
    : "Nivel " + room.currentLevel;
  await addLog(state.roomCode,
    levelLabel + " comienza! " + (levelCfg.type === "BST" ? "Árbol BST" : "Pirámide") + " — " + levelCfg.nodes + " nodos");

  // Verificar misiones que dependen de la mano recién repartida (#6, #20)
  // En Fase 1-2 del tutorial no hay misiones activas, así que este loop
  // simplemente no encuentra nada que verificar y no hace nada.
  for (const pid of playerIds) {
    const player = room.players[pid];
    if (!player.activeMission) continue;
    const hand = Object.values(dealtHands[pid]);
    const distinctClasses = new Set(hand.map(c => c.cardClass)).size;
    const persCounts = {};
    for (const c of hand) persCounts[c.personality] = (persCounts[c.personality] || 0) + 1;
    const maxSamePersonality = Math.max(0, ...Object.values(persCounts));

    const ctx = {
      room: Object.assign({}, room, { stats: resetStats }),
      stats: resetStats,
      player, playerId: pid,
      levelCfg, board: {},
      phase: "playing",
      distinctClassesInHand: distinctClasses,
      maxSamePersonalityInHand: maxSamePersonality,
    };
    const result = window.MissionEngine.checkAndAutoComplete(ctx);
    if (result?.completed) await autoCompleteMission(pid, result.missionId);
  }
}

// ── Jugar carta al tablero (posición 100% automática) ────────────────
// ── Jugar una carta Shy: se apila en vez de colocarse de inmediato ────
// La carta SÍ se muestra a todos (queda visible en room.shyStack) pero
// no ocupa posición en el tablero hasta que alguien juegue una carta
// normal que libere la pila completa (orden LIFO).
async function playShyCard(cardId, card) {
  const room = state.room;
  const me = room.players[state.myId];

  const { db, ref, update } = window.FB;
  const updates = {};

  const newHand = Object.assign({}, me.hand);
  delete newHand[cardId];
  updates["players/" + state.myId + "/hand"] = newHand;
  updates["players/" + state.myId + "/handCount"] = Object.keys(newHand).length;

  const shyStack = room.shyStack || [];
  updates.shyStack = [...shyStack, { playerId: state.myId, cardId: cardId, card }];

  await update(ref(db, "rooms/" + state.roomCode), updates);
  await addLog(state.roomCode,
    "🙈 " + me.name + " juega " + card.number + " (Tímida) — queda en espera, se mostrará a todos");

  state.selectedCardId = null;
}

async function playCard(cardId, useHyperactive, sacrificeCardId, demolishPos, useCurious) {
  const room = state.room;
  const me = room.players[state.myId];
  const card = me.hand[cardId];
  if (!card) return;

  if (room.familiarPassPending) {
    return alert("Hay una cadena Familiar activa: primero elige qué carta pasar (o espera a los demás)");
  }

  const levelCfg = getCurrentLevelCfg(room);
  const board = room.board || {};

  // ── JOKER y SACRIFICIO: determinar la personalidad EFECTIVA ────────────
  // Joker copia la última carta jugada. Sacrificio copia la personalidad
  // de una carta que el jugador descarta de su propia mano. Ambas pueden
  // encadenarse entre sí (Joker copiando Sacrificio, o viceversa).
  let effectivePersonality = isPhase1Tutorial(room) ? "Common" : card.personality;
  let sacrificedCard = null; // si se usó Sacrificio, qué carta se descartó

  if (effectivePersonality === "Joker") {
    const last = room.lastPlayedCard;
    if (!last || last.personality === "Common" || last.personality === "Joker") {
      effectivePersonality = "Common"; // sin efecto
    } else if (last.personality === "Sacrifice") {
      // Joker copia Sacrificio -> Joker también debe descartar una carta
      if (sacrificeCardId === "__none__") {
        effectivePersonality = "Common"; // sin opciones válidas, sin efecto
      } else if (!sacrificeCardId) {
        return openSacrificePicker(cardId, "Joker copia Sacrificio: elige qué carta descartar");
      } else {
        const discardCard = me.hand[sacrificeCardId];
        if (!discardCard || discardCard.id === cardId ||
            discardCard.personality === "Common" || discardCard.personality === "Sacrifice") {
          return alert("Carta inválida para descartar (no puede ser Common ni Sacrificio)");
        }
        effectivePersonality = discardCard.personality;
        sacrificedCard = discardCard;
      }
    } else {
      effectivePersonality = last.personality;
    }
  } else if (effectivePersonality === "Sacrifice") {
    if (sacrificeCardId === "__none__") {
      effectivePersonality = "Common"; // sin opciones válidas, sin efecto
    } else if (!sacrificeCardId) {
      return openSacrificePicker(cardId, "Elige qué carta de tu mano descartar para copiar su habilidad");
    } else {
      const discardCard = me.hand[sacrificeCardId];
      if (!discardCard || discardCard.id === cardId ||
          discardCard.personality === "Common" || discardCard.personality === "Sacrifice") {
        return alert("Carta inválida para descartar (no puede ser Common ni Sacrificio)");
      }
      effectivePersonality = discardCard.personality;
      sacrificedCard = discardCard;
    }
  }

  // ── SHY: si es Shy y hay margen para apilar, NO se coloca aún ──
  if (effectivePersonality === "Shy") {
    const shyStack = room.shyStack || [];
    let emptySlots;
    if (levelCfg.type === "BST") {
      emptySlots = levelCfg.nodes - window.GameLogic.countFilledNodes(board);
    } else {
      const currentPyramidStateForShy =
        window.PyramidBlocks.deserializePyramidFromFirebase(room.pyramidState) ||
        window.PyramidBlocks.createEmptyPyramid(levelCfg.height);
      emptySlots = levelCfg.nodes - window.PyramidBlocks.countFilledCards(currentPyramidStateForShy);
    }
    const canStack = window.GameLogic.canStackShy(shyStack.length, emptySlots);

    if (canStack) {
      return playShyCard(cardId, card);
    }
    // Si no hay margen, sigue el flujo normal más abajo (se juega como carta normal)
  }

  // ── DEMOLEDOR: elimina una carta ya colocada del tablero ────────────────
  // Esto ocurre ANTES de calcular dónde va la carta nueva, porque el hueco
  // que deja podría incluso ser la misma posición donde caiga la nueva.
  let demolishedCard = null;
  let workingBoard = board;
  if (effectivePersonality === "Demolisher" && levelCfg.type === "BST" && demolishPos !== "__none__") {
    if (demolishPos == null) {
      return openDemolisherPicker(cardId, useHyperactive, sacrificeCardId);
    }
    const target = board[String(demolishPos)];
    if (!target) return alert("Esa posición ya está vacía");
    demolishedCard = target;
    workingBoard = Object.assign({}, board);
    delete workingBoard[String(demolishPos)];
  }

  let pos;
  let reorderedLast = null; // { pos, value } si Hyperactive reubicó la carta anterior
  let pyramidStateAfter = null; // estado de bloques actualizado, solo para Pyramid
  let pyramidOrderlyNeighbors = []; // vecinos lógicos capturados antes de insertar, solo para Pyramid
  let pyramidSnapshotForNext = null; // estado "antes de esta jugada", a guardar para la próxima Hyperactiva
  let pyramidChainAfter = []; // cadena de Hyperactive acumuladas, a guardar para la próxima jugada
  let pyramidNewAnchorCard = null; // la carta NO-Hyperactiva a guardar como ancla, para la próxima jugada

  if (levelCfg.type === "BST") {
    // ── BST: heap fijo de siempre, sin cambios ──────────────────────────
    if (useHyperactive && effectivePersonality === "Hyperactive" && room.lastPlayedCard && room.lastPlayedPos) {
      const reorder = window.GameLogic.tryHyperactiveReorder(
        workingBoard, card.number, room.lastPlayedPos, room.lastPlayedCard.number,
        levelCfg.type, levelCfg.height
      );
      if (!reorder) {
        return alert("Hyperactive no se puede usar aquí: no hay una forma válida de reordenar");
      }
      pos = reorder.hyperPos;
      reorderedLast = { pos: reorder.newLastPos, value: reorder.lastValue, oldPos: room.lastPlayedPos };
    } else {
      pos = window.GameLogic.findAutoPosition(
        workingBoard, card.number, levelCfg.type, levelCfg.height
      );
    }
  } else {
    // ── PIRÁMIDE: sistema de bloques flotantes con anclaje progresivo ──
    // Demolisher no aplica aquí por ahora (la carta se juega como si
    // fuera Common en términos de posicionamiento).
    // room.pyramidState viene en formato serializado-seguro para
    // Firebase; hay que reconstruirlo a la estructura de trabajo.
    const currentPyramidState =
      window.PyramidBlocks.deserializePyramidFromFirebase(room.pyramidState) ||
      window.PyramidBlocks.createEmptyPyramid(levelCfg.height);

    if (useHyperactive && effectivePersonality === "Hyperactive" && room.pyramidLastNonHyperCard) {
      // Usar el snapshot guardado de ANTES de la última carta NO-
      // Hyperactiva, e insertar esta nueva Hyperactiva ANTES que
      // toda la cadena de Hyperactive ya acumuladas (si las hay),
      // terminando con la carta no-Hyperactiva como ancla final.
      // Ver tryHyperactiveReorderPyramid para el detalle completo.
      // IMPORTANTE: el ancla SIEMPRE es room.pyramidLastNonHyperCard
      // (la última carta NO-Hyperactiva), nunca room.lastPlayedCard
      // (que cambiaría con cada Hyperactiva de la cadena, rompiendo
      // la referencia correcta).
      const stateBeforeLast =
        window.PyramidBlocks.deserializePyramidFromFirebase(room.pyramidStateBeforeLast) ||
        window.PyramidBlocks.createEmptyPyramid(levelCfg.height);
      const existingChain = room.pyramidHyperactiveChain || [];
      const anchorValue = room.pyramidLastNonHyperCard.number;

      pyramidOrderlyNeighbors = window.PyramidBlocks.getOrderlyNeighbors(stateBeforeLast, card.number);

      const reorder = window.PyramidBlocks.tryHyperactiveReorderPyramid(
        stateBeforeLast, card.number, existingChain, anchorValue
      );
      if (!reorder) {
        return alert("Hyperactive no se puede usar aquí: no hay una forma válida de reordenar");
      }
      pyramidStateAfter = reorder.finalPyramid;
      reorderedLast = { value: anchorValue }; // marca informativa, sin pos de heap fija
      pos = null;
      // El snapshot "antes de la última NO-Hyperactiva" NO avanza —
      // sigue fijo mientras se acumulen Hyperactive consecutivas.
      pyramidSnapshotForNext = stateBeforeLast;
      // Esta Hyperactiva se agrega al FRENTE de la cadena (la más
      // reciente va primero, ver el orden de inserción en la función).
      pyramidChainAfter = [card.number, ...existingChain];
      // El ancla NO cambia mientras se acumulen Hyperactive consecutivas
      pyramidNewAnchorCard = room.pyramidLastNonHyperCard;
    } else {
      // Capturar vecinos lógicos ANTES de mutar (para el bono Orderly,
      // ver más abajo). Vecino lateral en la base, o si la carta cae
      // entre dos bloques y genera fusión, también se evalúa contra el
      // hijo de esa fusión cuando se calcule más adelante.
      pyramidOrderlyNeighbors = window.PyramidBlocks.getOrderlyNeighbors(currentPyramidState, card.number);

      // Clonar para no mutar el estado original hasta confirmar el éxito
      const pyramidCopy = JSON.parse(JSON.stringify(currentPyramidState));
      const insertResult = window.PyramidBlocks.insertValue(pyramidCopy, card.number);

      if (!insertResult.ok) {
        const _rejectRows = currentPyramidState.rows.map(function(row, ri) {
          if (row.length === 0) return "row" + ri + ": vacía";
          return "row" + ri + ": [" + row.map(function(b) {
            return b.values.join(",") + (b.childValue != null ? "→" + b.childValue : "");
          }).join("] [") + "]";
        }).join(" | ");
        const _seq = (room.pyramidPlaySequence || []).join(", ");
        console.warn("[PyramidReject] Carta " + card.number + " (" + card.personality + ") rechazada." +
          "\n  Secuencia previa: [" + _seq + "]" +
          "\n  Estado actual: " + _rejectRows);
        return alert("Esa carta no tiene un espacio válido en la pirámide ahora mismo");
      }

      pyramidStateAfter = pyramidCopy;
      pyramidSnapshotForNext = currentPyramidState;
      pyramidChainAfter = []; // una carta normal corta cualquier cadena de Hyperactive
      pyramidNewAnchorCard = card; // esta carta normal se vuelve el nuevo ancla
    }

    pos = null; // se resuelve más abajo via resolveToBoard/resolveProvisional
  }

  if (pos === null && levelCfg.type === "BST") {
    console.warn("[BSTReject] Carta " + card.number + " (" + card.personality + ") rechazada en BST.");
    return alert("Esa carta no tiene un espacio válido en el árbol/pirámide ahora mismo");
  }

  const { db, ref, update } = window.FB;
  const updates = {};
  let newBoardForPyramid = null; // solo se usa si levelCfg.type === "Pyramid"

  if (levelCfg.type === "BST") {
    if (demolishedCard) {
      updates["board/" + demolishPos] = null; // eliminar la carta demolida
    }
    updates["board/" + pos] = card;

    // Si Hyperactive reordenó, mover la carta anterior a su nueva posición
    if (reorderedLast) {
      updates["board/" + reorderedLast.oldPos] = null;
      updates["board/" + reorderedLast.pos] = room.lastPlayedCard;
    }
  } else {
    // Pirámide: el board completo se recalcula a partir del nuevo
    // estado de bloques. Usamos resolveProvisional para que SIEMPRE
    // se vea algo en pantalla, aunque la fila aún no esté anclada
    // con certeza (ver pyramidBlocks.js).
    // Se guarda también un snapshot del estado ANTES de esta jugada,
    // para que una futura carta Hyperactiva pueda "reordenarse" sin
    // necesitar deshacer fusiones (ver tryHyperactiveReorderPyramid).
    // El snapshot para la PRÓXIMA Hyperactiva siempre es "el estado
    // justo antes de ESTA jugada" — pyramidSnapshotForNext ya tiene
    // el valor correcto sin importar si esta jugada fue normal o un
    // reorder de Hyperactiva.
    updates.pyramidStateBeforeLast = window.PyramidBlocks.serializePyramidForFirebase(pyramidSnapshotForNext);
    updates.pyramidHyperactiveChain = pyramidChainAfter;
    updates.pyramidLastNonHyperCard = pyramidNewAnchorCard;
    // Acumular secuencia de jugadas para facilitar la reproducción de bugs
    const prevSequence = room.pyramidPlaySequence || [];
    const newSequence = [...prevSequence, card.number];
    updates.pyramidPlaySequence = newSequence;
    console.log("[PyramidSequence] Jugadas hasta ahora: [" + newSequence.join(", ") + "]");
    updates.pyramidState = window.PyramidBlocks.serializePyramidForFirebase(pyramidStateAfter);
    const cardLookup = (v) => {
      // Buscar la carta real jugada con ese número, para conservar
      // su personalidad/tipo/clase en el board (no solo el número).
      // El board anterior ya contiene tanto el ancla no-Hyperactiva
      // como cualquier Hyperactiva previa de la cadena, así que no
      // hace falta un caso especial — solo la carta nueva (`card`)
      // todavía no está en `board`.
      if (v === card.number) return card;
      for (const existing of Object.values(board)) {
        if (existing && existing.number === v) return existing;
      }
      return { number: v };
    };
    newBoardForPyramid = window.PyramidBlocks.resolveProvisional(pyramidStateAfter, cardLookup);
    updates.board = newBoardForPyramid;
  }

  const newHand = Object.assign({}, me.hand);
  delete newHand[card.id];
  if (sacrificedCard) delete newHand[sacrificedCard.id];
  updates["players/" + state.myId + "/hand"] = newHand;
  updates["players/" + state.myId + "/handCount"] = Object.keys(newHand).length;

  let pointsDelta = 0;
  let logMsgs = [];
  let justPlayedRoot = false;
  let justPlacedOrderlySequential = false;
  let justChainedFamiliar = false;
  let justPlayedApex = false;

  // ── Registro general de cada jugada (SIEMPRE, no solo para personalidades especiales) ──
  const _playDesc = levelCfg.type + " | " + me.name + " jugó " + card.number +
    " (" + card.personality + (effectivePersonality !== card.personality ? "→" + effectivePersonality : "") + ")" +
    (levelCfg.type === "BST" && pos != null ? " → pos " + pos : "");
  logMsgs.push(_playDesc);

  // Para Pirámide: log detallado del estado de bloques DESPUÉS de esta jugada,
  // visible en la consola del navegador para facilitar la reproducción de bugs.
  if (levelCfg.type === "Pyramid" && pyramidStateAfter) {
    const _rowsSummary = pyramidStateAfter.rows.map(function(row, ri) {
      if (row.length === 0) return "row" + ri + ": vacía";
      return "row" + ri + ": [" + row.map(function(b) {
        return b.values.join(",") + (b.childValue != null ? "→" + b.childValue : "");
      }).join("] [") + "]";
    }).join(" | ");
    console.log("[PyramidPlay] " + card.number + " jugada. Estado: " + _rowsSummary);
  }

  if (reorderedLast) {
    logMsgs.push("⚡ " + me.name + " usó Hiperactiva: " + card.number +
      " se jugó como si fuera antes que " + reorderedLast.value + " (que se reubicó)");
  }

  if (demolishedCard) {
    logMsgs.push("💥 " + me.name + " usó Demoledor: eliminó la carta " + demolishedCard.number + " del tablero");
  }

  if (sacrificedCard) {
    logMsgs.push("🃏 " + me.name + " descartó " + sacrificedCard.number + " (" + sacrificedCard.personality +
      ") para copiar su habilidad" + (card.personality === "Joker" ? " vía Joker" : ""));
  }

  // Detectar raíz/ápice: en BST es pos===1; en Pirámide, revisamos
  // si el board resuelto (estricto) ya tiene la posición 1 ocupada
  // con esta carta específica.
  const isRootOrApex = levelCfg.type === "BST"
    ? pos === 1
    : (() => {
        const strict = window.PyramidBlocks.resolveToBoard(pyramidStateAfter,
          (v) => v === card.number ? card : { number: v });
        return strict.board["1"] && strict.board["1"].number === card.number;
      })();

  if (isRootOrApex) {
    pointsDelta += 2;
    justPlayedRoot = true;
    if (levelCfg.type === "Pyramid") justPlayedApex = true;
    logMsgs.push(me.name + " jugó " + card.number + " como raíz! +2 pts");
  }

  const orderlyHasNeighborMatch = levelCfg.type === "BST"
    ? window.GameLogic.checkOrderlyBonus(board, pos, card.number)
    : pyramidOrderlyNeighbors.some(n => Math.abs(n - card.number) === 1);

  if (effectivePersonality === "Orderly" && orderlyHasNeighborMatch) {
    pointsDelta += 1;
    justPlacedOrderlySequential = true;
    logMsgs.push(me.name + " colocó " + card.number + " junto a un vecino consecutivo (Ordenada)! +1 pt");
  }

  updates["players/" + state.myId + "/points"] = me.points + pointsDelta;

  if (effectivePersonality === "Loud") {
    updates.loudTrigger = { playerId: state.myId, playerName: me.name, time: Date.now() };
    logMsgs.push("🔊 ¡Carta RUIDOSA jugada por " + me.name + "!");
  }

  // CURIOSA: muestra a todos las 2 cartas de arriba del mazo, luego
  // vuelven al fondo (no se sacan, no afectan el mazo a largo plazo).
  // Opcional: solo se activa si useCurious es true.
  if (effectivePersonality === "Curious" && useCurious) {
    const deckForPeek = room.deckRemaining || [];
    if (deckForPeek.length >= 1) {
      const peeked = deckForPeek.slice(-2); // las 2 de "arriba" (tope del mazo)
      updates.curiousPeek = {
        playerId: state.myId, playerName: me.name,
        cards: peeked, time: Date.now(),
      };
      logMsgs.push("👀 " + me.name + " usa Curiosa: muestra " + peeked.length + " carta(s) del mazo a todos");
    }
  }

  // FAMILIAR: 2 Familiar jugadas seguidas activan una fase de pase.
  // Todos los jugadores con al menos 1 Familiar en mano deben elegir
  // cuál pasar a su vecino de la izquierda (orden de la sala). El
  // intercambio se ejecuta simultáneo cuando todos hayan elegido.
  if (effectivePersonality === "Familiar" && room.lastPlayedCard && room.lastPlayedCard.personality === "Familiar") {
    updates.familiarPassPending = true;
    updates.familiarPassChoices = {};
    justChainedFamiliar = true;
    logMsgs.push("🔗 ¡Cadena Familiar! " + me.name + " y el jugador anterior activaron el pase. Todos con Familiar en mano deben elegir cuál pasar.");
  }

  updates.lastPlayedCard = card;
  updates.lastPlayedBy = state.myId;
  updates.lastPlayedPos = levelCfg.type === "BST" ? pos : null;

  // ── Liberar la pila de Shy pendiente (esta carta NO es Shy, o
  // era Shy pero se jugó como normal por falta de margen) ────────
  let boardAfterShy;
  let shyDiscardedMsgs = [];

  if (levelCfg.type === "BST") {
    boardAfterShy = Object.assign({}, workingBoard, { [String(pos)]: card });
    if (reorderedLast) {
      delete boardAfterShy[String(reorderedLast.oldPos)];
      boardAfterShy[String(reorderedLast.pos)] = room.lastPlayedCard;
    }

    const shyStack = room.shyStack || [];
    if (shyStack.length > 0) {
      const resolved = window.GameLogic.resolveShyStack(
        boardAfterShy, shyStack, levelCfg.type, levelCfg.height
      );
      for (const placement of resolved.placements) {
        updates["board/" + placement.pos] = placement.card;
        logMsgs.push("🙈 Se libera carta Shy " + placement.card.number + " → posición " + placement.pos);
      }
      for (const disc of resolved.discarded) {
        shyDiscardedMsgs.push("⚠️ Carta Shy " + disc.card.number + " ya no tenía espacio y se descartó");
      }
      updates.shyStack = []; // pila vacía tras liberar
      boardAfterShy = resolved.finalBoard;
    }
  } else {
    // Pirámide: el board ya se calculó completo arriba (newBoardForPyramid),
    // sobre pyramidStateAfter. Si hay pila de Shy pendiente, se libera
    // ahora insertando cada carta en cascada sobre ese mismo estado.
    boardAfterShy = newBoardForPyramid;

    const shyStack = room.shyStack || [];
    if (shyStack.length > 0) {
      const resolved = window.PyramidBlocks.resolveShyStackPyramid(pyramidStateAfter, shyStack);
      for (const placement of resolved.placements) {
        logMsgs.push("🙈 Se libera carta Shy " + placement.card.number + " en la pirámide");
      }
      for (const disc of resolved.discarded) {
        shyDiscardedMsgs.push("⚠️ Carta Shy " + disc.card.number + " ya no tenía espacio y se descartó");
      }
      updates.shyStack = []; // pila vacía tras liberar
      pyramidStateAfter = resolved.finalPyramid;
      updates.pyramidState = window.PyramidBlocks.serializePyramidForFirebase(pyramidStateAfter);

      const cardLookupAfterShy = (v) => {
        if (v === card.number) return card;
        for (const existing of Object.values(board)) {
          if (existing && existing.number === v) return existing;
        }
        for (const entry of shyStack) {
          if (entry.card.number === v) return entry.card;
        }
        return { number: v };
      };
      boardAfterShy = window.PyramidBlocks.resolveProvisional(pyramidStateAfter, cardLookupAfterShy);
      updates.board = boardAfterShy;
    }
  }

  // Tracking: primera carta del nivel (para misión #2 con timer y #36)
  const stats = room.stats || {};
  const wasFirstThisLevel = stats.firstCardPlayedAt === null;
  const trackUpdates = window.MissionTracker.trackCardPlayed(stats, state.myId);
  const newStatsAfterPlay = Object.assign({}, stats, trackUpdates);
  updates.stats = newStatsAfterPlay;

  await update(ref(db, "rooms/" + state.roomCode), updates);
  for (const msg of logMsgs) await addLog(state.roomCode, msg);
  for (const msg of shyDiscardedMsgs) await addLog(state.roomCode, msg);

  let newBoard, filled;
  if (levelCfg.type === "BST") {
    newBoard = boardAfterShy;
    filled = window.GameLogic.countFilledNodes(newBoard);
  } else {
    // Pirámide: solo cuentan como "llenos" los nodos que el sistema
    // de bloques ya pudo anclar con certeza (resolveToBoard estricto),
    // no la versión provisional que se usa solo para mostrar.
    const strict = window.PyramidBlocks.resolveToBoard(pyramidStateAfter,
      (v) => v === card.number ? card : { number: v });
    newBoard = strict.board;
    filled = Object.keys(newBoard).length;
  }

  // Verificar misión activa de quien jugó la carta, con el contexto
  // de lo que acaba de pasar en esta jugada.
  await runMissionCheck(state.myId, {
    board: newBoard,
    justPlayedCard: true,
    justPlayedRoot,
    justPlacedOrderlySequential,
    justChainedFamiliar,
    justPlayedApex,
    wasFirstThisLevel,
    stats: newStatsAfterPlay,
  });

  if (filled === levelCfg.nodes) {
    await completeLevel();
  }

  state.selectedCardId = null;
}

async function completeLevel() {
  const { db, ref, update, get } = window.FB;
  const snap = await get(ref(db, "rooms/" + state.roomCode));
  const room = snap.val();
  const levelCfg = getCurrentLevelCfg(room);

  const playerUpdates = {};
  for (const pid in room.players) {
    const p = room.players[pid];
    playerUpdates["players/" + pid + "/points"] = (p.points || 0) + 1;
  }

  // Nivel completado perfecto -> 0 vidas perdidas. Si era Pirámide,
  // suma al contador de "pirámides sin perder vidas" (misión #38).
  const stats = room.stats || {};
  const statUpdates = window.MissionTracker.trackLevelEnd(stats, room.players, room.currentLevel, 0);
  const newStats = Object.assign({}, stats, statUpdates);
  if (levelCfg.type === "Pyramid") {
    newStats.pyramidsNoLivesLost = (stats.pyramidsNoLivesLost || 0) + 1;
  }

  await update(ref(db, "rooms/" + state.roomCode), Object.assign({}, playerUpdates, {
    phase: "levelEnd",
    stats: newStats,
  }));
  await addLog(state.roomCode, "🎉 ¡Nivel " + room.currentLevel + " completado! +1 pt para todos.");

  // Verificar misiones "al final del nivel" para todos los jugadores
  const updatedRoom = Object.assign({}, room, { phase: "levelEnd", stats: newStats });
  for (const pid in room.players) {
    const player = Object.assign({}, room.players[pid], {
      points: (room.players[pid].points || 0) + 1,
    });
    await runMissionCheckFor(updatedRoom, pid, player, { phase: "levelEnd", stats: newStats });
  }

  await maybeOfferSignalChoice(room.currentLevel, room.isTutorial);
}

// ════════════════════════════════════════════════════════════════
// DESBLOQUEO DE SEÑALES — Al completar cada una de las 3 primeras
// Pirámides (niveles 2, 4, 6), cada jugador elige individualmente
// UNA señal nueva (Pack/Median/Color) que aún no tenga desbloqueada.
// No hay penalización por pasar; las señales no elegidas quedan
// disponibles para la siguiente oportunidad. No aplica en tutorial.
// ════════════════════════════════════════════════════════════════

const SIGNAL_UNLOCK_LEVELS = [2, 4, 6]; // niveles de Pirámide que ofrecen elección

async function maybeOfferSignalChoice(completedLevel, isTutorial) {
  if (isTutorial) return; // el tutorial no usa este sistema
  if (!SIGNAL_UNLOCK_LEVELS.includes(completedLevel)) return;

  const { db, ref, update } = window.FB;
  await update(ref(db, "rooms/" + state.roomCode), {
    signalChoicePending: true,
    signalChoicesMade: {}, // playerId -> signalType elegido (o "__skip__")
  });
  await addLog(state.roomCode,
    "📡 ¡Pirámide completada! Cada jugador puede elegir desbloquear una nueva señal.");
}

async function chooseSignalUnlock(signalType) {
  const room = state.room;
  if (!room.signalChoicePending) return;
  const me = room.players[state.myId];

  if (signalType !== "__skip__" && me.unlockedSignals && me.unlockedSignals[signalType]) {
    return alert("Ya tienes esa señal desbloqueada");
  }

  const { db, ref, update, get } = window.FB;
  const updates = {};
  updates["signalChoicesMade/" + state.myId] = signalType;
  if (signalType !== "__skip__") {
    updates["players/" + state.myId + "/unlockedSignals/" + signalType] = true;
  }

  await update(ref(db, "rooms/" + state.roomCode), updates);

  if (signalType !== "__skip__") {
    await addLog(state.roomCode, me.name + " desbloqueó la Señal de " + signalLabel(signalType));
  } else {
    await addLog(state.roomCode, me.name + " no eligió ninguna señal nueva esta vez");
  }

  // Si todos ya eligieron (o pasaron), cerrar la fase de elección
  const snap = await get(ref(db, "rooms/" + state.roomCode));
  const freshRoom = snap.val();
  const allChosen = Object.keys(freshRoom.players).every(
    pid => pid in (freshRoom.signalChoicesMade || {})
  );
  if (allChosen) {
    await update(ref(db, "rooms/" + state.roomCode), {
      signalChoicePending: false,
      signalChoicesMade: {},
    });
  }
}

function signalLabel(signalType) {
  const labels = { Range: "Rango", Pack: "Manada", Median: "Mediana", Color: "Color/Personalidad" };
  return labels[signalType] || signalType;
}

// Texto a mostrar para una señal activa, según su tipo: Range/Median
// muestran una carta concreta; Pack/Color muestran un conteo.
function formatSignalDisplay(signal) {
  if (!signal) return "";
  if (signal.type === "Pack" || signal.type === "Color") {
    return signalLabel(signal.type) + ": " + signal.count + "x " + signal.field;
  }
  if (signal.card) {
    return signalLabel(signal.type) + ": " + signal.card.number;
  }
  return signalLabel(signal.type);
}

// Variante de runMissionCheck que no depende de state.room (usa un
// snapshot explícito), útil cuando se revisan TODOS los jugadores
// de una vez, no solo state.myId.
async function runMissionCheckFor(room, playerId, player, extraCtx) {
  if (!player || !player.activeMission) return;
  const levelCfg = getCurrentLevelCfg(room);
  const ctx = Object.assign({
    room, stats: room.stats || {}, player, playerId,
    levelCfg, board: room.board || {}, phase: room.phase,
  }, extraCtx || {});

  const result = window.MissionEngine.checkAndAutoComplete(ctx);
  if (result?.completed) await autoCompleteMission(playerId, result.missionId);
}

// ── Avanzar al siguiente nivel ───────────────────────────────────────
async function nextLevel() {
  const room = state.room;
  if (room.hostId !== state.myId) return;

  const { db, ref, update } = window.FB;

  // ── Avance dentro del TUTORIAL (niveles T1-T6) ──────────────────────────
  if (room.isTutorial && room.tutorialLevel != null) {
    const newTutLevel = room.tutorialLevel + 1;

    if (newTutLevel > 6) {
      // Tutorial completo -> transición a los 8 niveles reales.
      // El pozo de vidas se REINICIA con la dificultad real elegida
      // (separado del pozo de práctica del tutorial).
      const diff = window.GameData.DIFFICULTY[room.difficulty];
      const playerUpdates = {};
      for (const pid in room.players) {
        playerUpdates["players/" + pid + "/points"] = diff.startPts;
        playerUpdates["players/" + pid + "/ready"] = false;
      }

      const baseUpdate = {
        isTutorial: false,
        tutorialLevel: null,
        currentLevel: 1,
        sharedLives: diff.lives,
        maxLives: diff.lives,
      };

      if (room.missionsEnabled === false) {
        await update(ref(db, "rooms/" + state.roomCode), Object.assign({}, playerUpdates, baseUpdate));
        await addLog(state.roomCode, "🎓 ¡Tutorial completado! Comienza la partida real (sin misiones) — Nivel 1/8");
        const { get } = window.FB;
        const snap = await get(ref(db, "rooms/" + state.roomCode));
        await dealLevel(snap.val());
        return;
      }

      const pool = window.GameData.buildMissionPool();
      await update(ref(db, "rooms/" + state.roomCode), Object.assign({}, playerUpdates, baseUpdate, {
        phase: "missionSelect",
        missionPool: pool,
      }));
      await addLog(state.roomCode, "🎓 ¡Tutorial completado! Comienza la partida real — Nivel 1/8");
      return;
    }

    const oldPhase = window.GameData.TUTORIAL_LEVELS[room.tutorialLevel - 1].phase;
    const newPhase = window.GameData.TUTORIAL_LEVELS[newTutLevel - 1].phase;
    const playerUpdates = {};
    for (const pid in room.players) {
      playerUpdates["players/" + pid + "/ready"] = false;
    }

    if (newPhase === 3 && oldPhase < 3 && room.missionsEnabled !== false) {
      // Entrando a Fase 3: se desbloquea el pool de misiones por primera vez
      const pool = window.GameData.buildMissionPool();
      await update(ref(db, "rooms/" + state.roomCode), Object.assign({}, playerUpdates, {
        tutorialLevel: newTutLevel,
        phase: "missionSelect",
        missionPool: pool,
      }));
    } else {
      // Fases 1-2, o Fase 3 con misiones desactivadas: directo al banner
      await update(ref(db, "rooms/" + state.roomCode), Object.assign({}, playerUpdates, {
        tutorialLevel: newTutLevel,
        phase: "tutorialIntro",
      }));
    }

    if (newPhase > oldPhase) {
      await addLog(state.roomCode, "🎓 " + window.GameData.TUTORIAL_PHASE_INFO[newPhase].title);
    } else {
      await addLog(state.roomCode, "Tutorial " + newTutLevel + "/6 comienza");
    }
    return;
  }

  // ── Avance normal (niveles 1-8 reales) ──────────────────────────────────
  const newLevel = room.currentLevel + 1;

  if (newLevel > 8) {
    await update(ref(db, "rooms/" + state.roomCode), { phase: "gameOver", result: "victory" });
    await addLog(state.roomCode, "🏆 ¡VICTORIA! ¡Los 8 niveles completados!");
    return;
  }

  const playerUpdates = {};
  for (const pid in room.players) {
    const p = room.players[pid];
    playerUpdates["players/" + pid + "/points"] = (p.points || 0) + 1;
    playerUpdates["players/" + pid + "/ready"] = false;
  }

  if (room.missionsEnabled === false) {
    await update(ref(db, "rooms/" + state.roomCode), Object.assign({}, playerUpdates, {
      currentLevel: newLevel,
    }));
    await addLog(state.roomCode, "Nivel " + newLevel + " comienza (sin misiones)");
    const { get } = window.FB;
    const snap = await get(ref(db, "rooms/" + state.roomCode));
    await dealLevel(snap.val());
    return;
  }

  const pool = window.GameData.buildMissionPool();
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
  if (room.phase !== "playing") return; // ya se cerró este nivel, evitar doble ejecución

  const levelCfg = getCurrentLevelCfg(room);
  const filled = window.GameLogic.countFilledNodes(room.board || {});
  const empty = levelCfg.nodes - filled;

  const { db, ref, update } = window.FB;
  let newLives = room.sharedLives;

  if (empty > 0) {
    newLives -= empty;
    await addLog(state.roomCode, "Nivel terminado con " + empty + " nodos vacíos. -" + empty + " vidas (" + Math.max(newLives,0) + " restantes)");
  }

  const livesLost = Math.max(0, empty);
  const stats = room.stats || {};
  const statUpdates = window.MissionTracker.trackLevelEnd(stats, room.players, room.currentLevel, livesLost);
  const newStats = Object.assign({}, stats, statUpdates);
  if (levelCfg.type === "Pyramid" && livesLost === 0) {
    newStats.pyramidsNoLivesLost = (stats.pyramidsNoLivesLost || 0) + 1;
  }

  if (newLives <= 0) {
    if (room.isTutorial) {
      // El tutorial nunca termina en derrota — se restauran las vidas
      // de práctica y se continúa, para que el aprendizaje no se corte.
      const restoredLives = window.GameData.TUTORIAL_DIFFICULTY.lives;
      await update(ref(db, "rooms/" + state.roomCode),
        { sharedLives: restoredLives, phase: "levelEnd", stats: newStats });
      await addLog(state.roomCode,
        "🎓 El pozo de práctica llegó a 0 — se restauran las vidas para seguir aprendiendo sin presión.");
    } else {
      await update(ref(db, "rooms/" + state.roomCode), { sharedLives: 0, phase: "gameOver", result: "defeat", stats: newStats });
      await addLog(state.roomCode, "💀 DERROTA! El grupo se quedó sin vidas.");
    }
    return;
  }

  await update(ref(db, "rooms/" + state.roomCode), { sharedLives: newLives, phase: "levelEnd", stats: newStats });

  // Verificar misiones "al final del nivel" para todos los jugadores
  const updatedRoom = Object.assign({}, room, { sharedLives: newLives, phase: "levelEnd", stats: newStats });
  for (const pid in room.players) {
    await runMissionCheckFor(updatedRoom, pid, room.players[pid], { phase: "levelEnd", stats: newStats });
  }

  await maybeOfferSignalChoice(room.currentLevel, room.isTutorial);
}

// ════════════════════════════════════════════════════════════════
// RETIRADA ESTRATÉGICA — Una vez por partida (no por nivel). Si
// menos del 50% de los nodos del nivel actual están colocados y
// TODOS los jugadores votan a favor, se pierde la mitad de las
// vidas actuales del pozo (redondeado hacia arriba), se recogen
// todas las cartas jugadas, se reparte de nuevo, y se reintenta el
// mismo nivel desde cero. Los puntos ya ganados se conservan. No
// cuesta puntos — el costo es exclusivamente en vidas.
// ════════════════════════════════════════════════════════════════

async function voteRetreat() {
  const room = state.room;
  if (room.usedRetreat) return alert("La Retirada Estratégica ya se usó una vez en esta partida");
  if (room.isTutorial) return alert("La Retirada Estratégica no está disponible durante el tutorial");

  const levelCfg = getCurrentLevelCfg(room);
  const filled = window.GameLogic.countFilledNodes(room.board || {});
  if (filled >= levelCfg.nodes / 2) {
    return alert("Solo se puede pedir Retirada si menos del 50% de los nodos están colocados (" +
      filled + "/" + levelCfg.nodes + " ya colocados)");
  }

  const { db, ref, update, get } = window.FB;
  const votes = Object.assign({}, room.retreatVotes || {}, { [state.myId]: true });

  await update(ref(db, "rooms/" + state.roomCode + "/retreatVotes"), votes);
  await addLog(state.roomCode,
    room.players[state.myId].name + " vota por la Retirada Estratégica (" +
    Object.keys(votes).length + "/" + Object.keys(room.players).length + ")");

  const allVoted = Object.keys(room.players).every(pid => votes[pid]);
  if (allVoted) {
    const snap = await get(ref(db, "rooms/" + state.roomCode));
    await resolveRetreat(snap.val());
  }
}

async function cancelRetreatVote() {
  const room = state.room;
  const { db, ref, update } = window.FB;
  const votes = Object.assign({}, room.retreatVotes || {});
  delete votes[state.myId];
  await update(ref(db, "rooms/" + state.roomCode + "/retreatVotes"), votes);
  await addLog(state.roomCode, room.players[state.myId].name + " retira su voto de Retirada");
}

async function resolveRetreat(room) {
  const { db, ref, update } = window.FB;

  const livesLost = Math.ceil(room.sharedLives / 2);
  const newLives = room.sharedLives - livesLost;

  await addLog(state.roomCode,
    "🏳 ¡Retirada Estratégica activada! El grupo pierde " + livesLost +
    " vidas (mitad del pozo, redondeado hacia arriba). Se reparte de nuevo este nivel.");

  if (newLives <= 0) {
    await update(ref(db, "rooms/" + state.roomCode),
      { sharedLives: 0, usedRetreat: true, retreatVotes: {}, phase: "gameOver", result: "defeat" });
    await addLog(state.roomCode, "💀 DERROTA! La Retirada dejó al grupo sin vidas.");
    return;
  }

  await update(ref(db, "rooms/" + state.roomCode), {
    sharedLives: newLives,
    usedRetreat: true,
    retreatVotes: {},
  });

  // Re-repartir el mismo nivel desde cero (puntos ya ganados se conservan,
  // solo se recogen las cartas jugadas y se vuelve a barajar el mazo).
  const refreshedRoom = Object.assign({}, room, { sharedLives: newLives, usedRetreat: true });
  await dealLevel(refreshedRoom);
}

// ── Usar señal ─────────────────────────────────────────────────────
async function useSignal(signalType) {
  const room = state.room;
  const me = room.players[state.myId];

  if (!me.unlockedSignals || !me.unlockedSignals[signalType]) {
    return alert("Señal " + signalType + " no desbloqueada aún");
  }

  let signalPayload = null;

  if (signalType === "Range") {
    if (!state.selectedCardId) return alert("Selecciona una carta primero");
    const card = me.hand[state.selectedCardId];
    if (!card) return;
    signalPayload = { type: "Range", card };
  } else if (signalType === "Pack" || signalType === "Color") {
    // Conteo: el jugador elige UNA Clase (Pack) o Personalidad (Color)
    // presente en su mano, y revela cuántas cartas tiene de esa.
    const hand = Object.values(me.hand || {});
    const field = signalType === "Pack" ? "cardClass" : "personality";
    const options = [...new Set(hand.map(c => c[field]))];
    if (options.length === 0) return alert("No tienes cartas en mano");

    const choice = prompt(
      "Señal de " + signalLabel(signalType) + ": elige una " +
      (signalType === "Pack" ? "Clase/animal" : "Personalidad") +
      " de tu mano para revelar cuántas tienes.\n\nOpciones: " + options.join(", ")
    );
    if (choice === null) return;
    const matched = options.find(o => o.toLowerCase() === choice.trim().toLowerCase());
    if (!matched) return alert("Esa opción no está en tu mano");

    const count = hand.filter(c => c[field] === matched).length;
    signalPayload = { type: signalType, field: matched, count };
  } else if (signalType === "Median") {
    const hand = Object.values(me.hand || {}).sort((a, b) => a.number - b.number);
    if (hand.length === 0) return alert("No tienes cartas en mano");
    const mid = Math.floor((hand.length - 1) / 2);
    let medianCard;
    if (hand.length % 2 === 0) {
      // Mano par: hay 2 "medianas", el jugador elige cuál mostrar
      const optA = hand[mid], optB = hand[mid + 1];
      const choice = prompt(
        "Señal de Mediana: tu mano tiene 2 cartas centrales. ¿Cuál quieres mostrar?\n\n" +
        "Opción A: " + optA.number + "   |   Opción B: " + optB.number +
        "\n\nEscribe A o B:"
      );
      if (choice === null) return;
      medianCard = choice.trim().toUpperCase() === "B" ? optB : optA;
    } else {
      medianCard = hand[mid];
    }
    signalPayload = { type: "Median", card: medianCard };
  } else {
    return alert("Señal desconocida");
  }

  let cost = 0;
  if (signalType === "Range") {
    cost = window.GameData.DIFFICULTY[room.difficulty].rangeSignalCost;
    if (me.points < cost) return alert("No tienes suficientes puntos");
  }

  const { db, ref, update } = window.FB;

  // Calcular nuevo objeto stats completo (más simple que paths parciales)
  const stats = room.stats || {};
  const prevCounter = (stats.signalsUsedThisLevel && stats.signalsUsedThisLevel[state.myId])
    || window.MissionTracker.emptySignalCounter();
  const newCounter = Object.assign({}, prevCounter, {
    [signalType]: (prevCounter[signalType] || 0) + 1,
  });
  const newStats = Object.assign({}, stats, {
    signalsUsedThisLevel: Object.assign({}, stats.signalsUsedThisLevel, {
      [state.myId]: newCounter,
    }),
    groupSignalsThisLevel: (stats.groupSignalsThisLevel || 0) + 1,
  });

  await update(ref(db, "rooms/" + state.roomCode), {
    ["players/" + state.myId + "/signal"]: signalPayload,
    ["players/" + state.myId + "/points"]: me.points - cost,
    stats: newStats,
  });

  await addLog(state.roomCode, me.name + " usa señal " + signalLabel(signalType));

  await runMissionCheck(state.myId, { stats: newStats });

  state.selectedCardId = null; // limpiar selección tras usar la señal
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

// ── Completar misión automáticamente (detectada por MissionEngine) ────
async function autoCompleteMission(playerId, missionId) {
  const room = state.room;
  const player = room.players[playerId];
  if (!player || !player.activeMission || player.activeMission.id !== missionId) return;

  const mission = player.activeMission;
  const { db, ref, update } = window.FB;
  await update(ref(db, "rooms/" + state.roomCode + "/players/" + playerId), {
    points: player.points + 3,
    activeMission: null,
  });
  await addLog(state.roomCode,
    "🤖 ¡Misión completada automáticamente para " + player.name + "! " +
    mission.condition.substring(0, 40) + "... +3 pts");
}

// ── Revisa la misión activa de un jugador y la completa si corresponde ──
async function runMissionCheck(playerId, extraCtx) {
  const room = state.room;
  const player = room.players[playerId];
  if (!player || !player.activeMission) return;

  const levelCfg = getCurrentLevelCfg(room);
  const ctx = Object.assign({
    room, stats: room.stats || {}, player, playerId,
    levelCfg, board: room.board || {}, phase: room.phase,
  }, extraCtx || {});

  const result = window.MissionEngine.checkAndAutoComplete(ctx);
  if (result?.completed) await autoCompleteMission(playerId, result.missionId);
}

// ════════════════════════════════════════════════════════════════
// FAMILIAR — Fase de pase de cartas
// ════════════════════════════════════════════════════════════════
//
// Cuando se activa (2 Familiar jugadas seguidas), cada jugador con
// al menos 1 carta Familiar en mano debe elegir cuál pasar a su
// vecino de la izquierda (orden de la lista de jugadores de la
// sala). El intercambio se ejecuta SIMULTÁNEO cuando todos los que
// pueden elegir ya eligieron (o se confirma que no tienen ninguna).

function leftNeighborId(room, playerId) {
  const ids = Object.keys(room.players);
  const idx = ids.indexOf(playerId);
  return ids[(idx + 1) % ids.length]; // "izquierda" = siguiente en la lista
}

// Cada jugador llama esto para elegir cuál Familiar pasar (o null
// si no tiene ninguna, lo cual se marca automáticamente igual).
async function chooseFamiliarToPass(cardId) {
  const room = state.room;
  if (!room.familiarPassPending) return;

  const { db, ref, update, get } = window.FB;
  await update(ref(db, "rooms/" + state.roomCode + "/familiarPassChoices"), {
    [state.myId]: cardId,
  });

  // Revisar si todos los que pueden elegir ya eligieron
  const snap = await get(ref(db, "rooms/" + state.roomCode));
  const freshRoom = snap.val();
  await maybeResolveFamiliarPass(freshRoom);
}

// Marca explícitamente "no tengo Familiar" para un jugador (se
// llama automáticamente desde el render si detecta que su mano no
// tiene ninguna Familiar, así no se queda esperando para siempre).
async function autoSkipFamiliarPass(playerId) {
  const room = state.room;
  if (!room.familiarPassPending) return;
  if (room.familiarPassChoices && playerId in room.familiarPassChoices) return; // ya decidido

  const { db, ref, update, get } = window.FB;
  await update(ref(db, "rooms/" + state.roomCode + "/familiarPassChoices"), {
    [playerId]: "__skip__", // no null (Firebase elimina nulls y la entrada desaparecería)
  });

  const snap = await get(ref(db, "rooms/" + state.roomCode));
  const freshRoom = snap.val();
  await maybeResolveFamiliarPass(freshRoom);
}

async function maybeResolveFamiliarPass(room) {
  if (!room.familiarPassPending) return;
  const playerIds = Object.keys(room.players);
  const choices = room.familiarPassChoices || {};

  const allDecided = playerIds.every(pid => pid in choices);
  if (!allDecided) return; // aún faltan jugadores por decidir

  const hands = {};
  for (const pid of playerIds) hands[pid] = room.players[pid].hand || {};

  const { newHands, totalPassed } = window.GameLogic.resolveFamiliarPass(playerIds, hands, choices);

  const { db, ref, update } = window.FB;
  const updates = {};
  for (const pid of playerIds) {
    updates["players/" + pid + "/hand"] = newHands[pid];
    updates["players/" + pid + "/handCount"] = Object.keys(newHands[pid]).length;
  }
  updates.familiarPassPending = false;
  updates.familiarPassChoices = {};

  await update(ref(db, "rooms/" + state.roomCode), updates);
  await addLog(state.roomCode,
    "🔗 Pase Familiar resuelto: " + totalPassed + " carta(s) pasaron a la izquierda simultáneamente.");
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

  // Tracking: gastó puntos en habilidad (afecta misiones #8, #19, #27)
  const stats = room.stats || {};
  const newStats = Object.assign({}, stats, {
    spentPointsThisLevel: Object.assign({}, stats.spentPointsThisLevel, {
      [state.myId]: true,
    }),
  });
  if (ability === "redrawHand") {
    newStats.usedRedrawThisLevel = Object.assign({}, stats.usedRedrawThisLevel, {
      [state.myId]: true,
    });
  }
  updates.stats = newStats;

  await update(ref(db, "rooms/" + state.roomCode), updates);
  await addLog(state.roomCode, me.name + " gastó " + cost + " pts en " + ability);
}

// ── Click en una carta de la mano: la juega de inmediato ──────────────
// No hay selección de posición - el lugar se calcula automáticamente
// según las reglas del BST o la Pirámide (ver gameLogic.js).
// Si la carta es Hyperactive y existe una jugada anterior que se
// puede reordenar, se le pregunta al jugador si quiere usar el
// efecto (es opcional).
function selectCard(cardId) {
  const room = state.room;
  if (!room || room.phase !== "playing") return;

  const me = room.players[state.myId];
  const card = me?.hand?.[cardId];

  // En Fase 1 del tutorial ninguna habilidad tiene efecto — se juega
  // siempre como carta normal, sin abrir ningún picker especial.
  if (isPhase1Tutorial(room)) {
    return playCard(cardId);
  }

  const levelCfg = getCurrentLevelCfg(room);

  if (card?.personality === "Hyperactive") {
    let reorder = null;
    let anchorNumber = null;

    if (levelCfg.type === "BST" && room.lastPlayedCard && room.lastPlayedPos != null) {
      anchorNumber = room.lastPlayedCard.number;
      reorder = window.GameLogic.tryHyperactiveReorder(
        room.board || {}, card.number, room.lastPlayedPos, anchorNumber,
        levelCfg.type, levelCfg.height
      );
    } else if (levelCfg.type === "Pyramid" && room.pyramidLastNonHyperCard) {
      // El ancla SIEMPRE es la última carta NO-Hyperactiva, nunca
      // room.lastPlayedCard (que cambiaría con cada Hyperactiva de
      // la cadena, rompiendo la referencia correcta).
      anchorNumber = room.pyramidLastNonHyperCard.number;
      const stateBeforeLast =
        window.PyramidBlocks.deserializePyramidFromFirebase(room.pyramidStateBeforeLast) ||
        window.PyramidBlocks.createEmptyPyramid(levelCfg.height);
      reorder = window.PyramidBlocks.tryHyperactiveReorderPyramid(
        stateBeforeLast, card.number, room.pyramidHyperactiveChain || [], anchorNumber
      );
    }
    if (reorder) {
      const useIt = confirm(
        "Esta carta es Hiperactiva. ¿Quieres jugarla como si hubiera sido ANTES que la última " +
        "carta jugada (" + anchorNumber + ")? Esto puede reubicar esa carta.\n\n" +
        "Aceptar = usar Hiperactiva   |   Cancelar = jugar normal"
      );
      return playCard(cardId, useIt);
    }
  }

  if (card?.personality === "Sacrifice") {
    const useIt = confirm(
      "Esta carta es Sacrificio. ¿Quieres descartar otra carta de tu mano para copiar su habilidad?\n\n" +
      "Aceptar = usar Sacrificio   |   Cancelar = jugar normal"
    );
    if (useIt) {
      return openSacrificePicker(cardId, "Sacrificio: elige qué carta de tu mano descartar para copiar su habilidad");
    }
    return playCard(cardId, false, "__none__");
  }

  if (levelCfg.type === "BST" && card?.personality === "Demolisher") {
    const useIt = confirm(
      "Esta carta es Demoledor. ¿Quieres eliminar una carta ya colocada en el tablero?\n\n" +
      "Aceptar = usar Demoledor   |   Cancelar = jugar normal"
    );
    if (useIt) {
      return openDemolisherPicker(cardId, false, undefined);
    }
    return playCard(cardId, false, undefined, "__none__");
  }

  if (card?.personality === "Curious") {
    const useIt = confirm(
      "Esta carta es Curiosa. ¿Quieres mostrar a todos las 2 cartas de arriba del mazo?\n\n" +
      "Aceptar = usar Curiosa   |   Cancelar = jugar normal"
    );
    return playCard(cardId, false, undefined, undefined, useIt);
  }

  playCard(cardId);
}

// ── Selector de carta a descartar (Sacrificio, o Joker copiando Sacrificio) ──
function openSacrificePicker(cardId, promptMsg) {
  const room = state.room;
  const me = room.players[state.myId];
  const validOptions = Object.values(me.hand || {}).filter(c =>
    c.id !== cardId && c.personality !== "Common" && c.personality !== "Sacrifice"
  );

  if (validOptions.length === 0) {
    alert("No tienes ninguna carta válida para descartar (no puede ser Common ni Sacrificio). " +
          "Esta habilidad no está disponible ahora — la carta se jugará sin efecto especial.");
    return playCard(cardId, false, "__none__");
  }

  const listText = validOptions
    .map(c => c.number + " (" + c.personality + ")")
    .join(", ");
  const choice = prompt(
    promptMsg + "\n\nOpciones disponibles: " + listText + "\n\nEscribe el NÚMERO de la carta a descartar:"
  );
  if (choice === null) return; // canceló

  const chosenNum = parseInt(choice, 10);
  const chosen = validOptions.find(c => c.number === chosenNum);
  if (!chosen) {
    alert("Número inválido o no está en la lista de opciones válidas.");
    return;
  }

  playCard(cardId, false, chosen.id);
}

// ── Selector de carta del tablero a eliminar (Demoledor) ───────────────
function openDemolisherPicker(cardId, useHyperactive, sacrificeCardId) {
  const room = state.room;
  const board = room.board || {};
  const occupied = Object.entries(board)
    .filter(([key, c]) => key !== "_init" && c)
    .map(([key, c]) => ({ pos: parseInt(key, 10), number: c.number }));

  if (occupied.length === 0) {
    alert("El tablero está vacío, no hay ninguna carta para eliminar. Esta habilidad no está disponible ahora.");
    return;
  }

  const listText = occupied.map(o => "#" + o.pos + "=" + o.number).join(", ");
  const choice = prompt(
    "Demoledor: elige qué carta eliminar del tablero (se descarta para siempre).\n\n" +
    "Cartas en el tablero: " + listText + "\n\nEscribe la POSICIÓN (#) de la carta a eliminar:"
  );
  if (choice === null) return; // canceló

  const chosenPos = parseInt(choice.replace("#", ""), 10);
  const found = occupied.find(o => o.pos === chosenPos);
  if (!found) {
    alert("Posición inválida o no está ocupada.");
    return;
  }

  playCard(cardId, useHyperactive, sacrificeCardId, chosenPos);
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

// ── Timer visible para la misión #2 (jugar primera carta en <30s) ─────
// ── Pila visible de cartas Tímidas pendientes ─────────────────────────
// ── Fase de pase Familiar: cada jugador elige cuál Familiar pasar ──────
// ── Elección de nueva señal al completar una Pirámide ──────────────────
function renderSignalChoiceZone(room, me) {
  const zone = document.getElementById("signalChoiceZone");

  if (!room.signalChoicePending) {
    zone.style.display = "none";
    return;
  }

  zone.style.display = "block";
  zone.innerHTML = "";

  const choices = room.signalChoicesMade || {};
  const myChoice = choices[state.myId];
  const myUnlocked = me?.unlockedSignals || {};
  const ALL_SIGNALS = ["Pack", "Median", "Color"];
  const available = ALL_SIGNALS.filter(s => !myUnlocked[s]);

  const title = document.createElement("div");
  title.className = "signal-choice-title";
  title.textContent = "📡 ¡Pirámide completada! Elige una nueva señal para desbloquear (opcional)";
  zone.appendChild(title);

  if (myChoice !== undefined) {
    const status = document.createElement("div");
    status.className = "familiar-pass-waiting";
    status.textContent = myChoice === "__skip__"
      ? "✅ Decidiste no elegir ninguna esta vez. Esperando a los demás..."
      : "✅ Desbloqueaste la Señal de " + signalLabel(myChoice) + ". Esperando a los demás...";
    zone.appendChild(status);
  } else if (available.length === 0) {
    const status = document.createElement("div");
    status.className = "familiar-pass-waiting";
    status.textContent = "Ya tienes las 3 señales avanzadas desbloqueadas.";
    zone.appendChild(status);
    chooseSignalUnlock("__skip__"); // nada que elegir, se auto-resuelve
  } else {
    const optionsDiv = document.createElement("div");
    optionsDiv.className = "signal-choice-options";
    for (const sig of available) {
      const btn = document.createElement("button");
      btn.className = "signal-choice-btn";
      btn.textContent = "📡 " + signalLabel(sig);
      btn.onclick = (function(s) { return function() { chooseSignalUnlock(s); }; })(sig);
      optionsDiv.appendChild(btn);
    }
    const skipBtn = document.createElement("button");
    skipBtn.className = "signal-choice-btn skip";
    skipBtn.textContent = "Pasar (no elegir ahora)";
    skipBtn.onclick = function() { chooseSignalUnlock("__skip__"); };
    optionsDiv.appendChild(skipBtn);
    zone.appendChild(optionsDiv);
  }

  const statusLine = document.createElement("div");
  statusLine.className = "signal-choice-status";
  const playerNames = Object.values(room.players).map(p => {
    const decided = p.id in choices;
    return (decided ? "✅ " : "⏳ ") + p.name;
  });
  statusLine.textContent = playerNames.join("   ");
  zone.appendChild(statusLine);
}

function renderFamiliarPassZone(room, me) {
  const zone = document.getElementById("familiarPassZone");

  if (!room.familiarPassPending) {
    zone.style.display = "none";
    return;
  }

  zone.style.display = "block";
  zone.innerHTML = "";

  const choices = room.familiarPassChoices || {};
  const myChoice = choices[state.myId];
  const myHand = Object.values(me?.hand || {});
  const myFamiliarCards = myHand.filter(c => c.personality === "Familiar");

  const title = document.createElement("div");
  title.className = "familiar-pass-title";
  title.textContent = "🔗 ¡Cadena Familiar activada! Elige una carta Familiar para pasar a tu vecino de la izquierda";
  zone.appendChild(title);

  if (myChoice !== undefined) {
    // Ya decidiste (eligió una carta, o se marcó que no tiene ninguna)
    const status = document.createElement("div");
    status.className = "familiar-pass-waiting";
    status.textContent = (myChoice && myChoice !== "__skip__")
      ? "✅ Elegiste pasar la carta " + (me.hand[myChoice]?.number ?? "?") + ". Esperando a los demás..."
      : "✅ No tienes cartas Familiar. Esperando a los demás...";
    zone.appendChild(status);
  } else if (myFamiliarCards.length === 0) {
    // No tiene ninguna Familiar -> se auto-marca sin que el jugador haga nada
    autoSkipFamiliarPass(state.myId);
    const status = document.createElement("div");
    status.className = "familiar-pass-waiting";
    status.textContent = "No tienes cartas Familiar, no pasas ninguna...";
    zone.appendChild(status);
  } else {
    // Tiene 1+ Familiar -> debe elegir cuál pasar
    const cardsDiv = document.createElement("div");
    cardsDiv.className = "familiar-pass-cards";
    for (const card of myFamiliarCards) {
      const cardEl = window.CardRender.renderCard(card, {
        onClick: (function(id) { return function() { chooseFamiliarToPass(id); }; })(card.id),
      });
      cardsDiv.appendChild(cardEl);
    }
    zone.appendChild(cardsDiv);
  }

  // Estado de todos los jugadores (quién ya decidió)
  const statusLine = document.createElement("div");
  statusLine.className = "familiar-pass-status";
  const playerNames = Object.values(room.players).map(p => {
    const decided = p.id in choices;
    return (decided ? "✅ " : "⏳ ") + p.name;
  });
  statusLine.textContent = playerNames.join("   ");
  zone.appendChild(statusLine);
}

function renderShyStackZone(room) {
  const zone = document.getElementById("shyStackZone");
  const stack = room.shyStack || [];

  if (room.phase !== "playing" || stack.length === 0) {
    zone.style.display = "none";
    return;
  }

  zone.style.display = "flex";
  zone.innerHTML = "";

  const label = document.createElement("span");
  label.className = "shy-stack-label";
  label.textContent = "🙈 PENDIENTES (Tímidas):";
  zone.appendChild(label);

  const cardsDiv = document.createElement("div");
  cardsDiv.className = "shy-stack-cards";
  // Mostrar en orden de liberación (LIFO): la última apilada primero
  for (let i = stack.length - 1; i >= 0; i--) {
    const entry = stack[i];
    const cardEl = document.createElement("div");
    cardEl.className = "shy-stack-card";
    cardEl.textContent = entry.card.number;
    cardsDiv.appendChild(cardEl);
  }
  zone.appendChild(cardsDiv);

  const hint = document.createElement("span");
  hint.className = "shy-stack-hint";
  hint.textContent = "se liberan en este orden cuando alguien juegue una carta normal";
  zone.appendChild(hint);
}

// ── Temporizador del nivel: 3/6/9/12 min según el tamaño (no aplica
// en tutorial). Si se agota, el HOST cierra el nivel automáticamente,
// igual que con el botón manual "Terminar Nivel" — los huecos vacíos
// restan vidas del pozo compartido. ───────────────────────────────────
function renderLevelTimer(room, isHost) {
  const timerEl = document.getElementById("levelTimer");

  if (_levelTimerInterval) {
    clearInterval(_levelTimerInterval);
    _levelTimerInterval = null;
  }

  const showTimer = room.phase === "playing" && room.levelTimerStart && room.levelTimerDurationSec;
  if (!showTimer) {
    timerEl.style.display = "none";
    return;
  }

  timerEl.style.display = "inline-block";

  function update() {
    const elapsedMs = Date.now() - room.levelTimerStart;
    const totalMs = room.levelTimerDurationSec * 1000;
    const remainingMs = Math.max(0, totalMs - elapsedMs);
    const minutes = Math.floor(remainingMs / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    timerEl.textContent = "⏱ " + minutes + ":" + String(seconds).padStart(2, "0");
    timerEl.classList.toggle("urgent", remainingMs <= 30000);

    if (remainingMs <= 0) {
      clearInterval(_levelTimerInterval);
      _levelTimerInterval = null;
      // Solo el host ejecuta el cierre automático, para que no se
      // dispare N veces (una por cada navegador conectado).
      if (isHost) endLevel();
    }
  }

  update();
  _levelTimerInterval = setInterval(update, 500);
}

function renderMissionTimer(room, me) {
  const timerEl = document.getElementById("missionTimer");
  if (_firstCardTimerInterval) {
    clearInterval(_firstCardTimerInterval);
    _firstCardTimerInterval = null;
  }

  const hasMission2 = me?.activeMission?.id === 2;
  const stats = room.stats || {};
  const alreadyPlayed = stats.firstCardPlayedAt !== null;
  const showTimer = room.phase === "playing" && hasMission2 && !alreadyPlayed;

  if (!showTimer) {
    timerEl.style.display = "none";
    return;
  }

  timerEl.style.display = "inline-block";

  function update() {
    const elapsed = Date.now() - (stats.levelStartTime || Date.now());
    const remaining = Math.max(0, 30000 - elapsed);
    const seconds = Math.ceil(remaining / 1000);
    timerEl.textContent = "⏱ " + seconds + "s para jugar primero";
    timerEl.classList.toggle("urgent", seconds <= 10);
    if (remaining <= 0) {
      clearInterval(_firstCardTimerInterval);
      _firstCardTimerInterval = null;
      timerEl.style.display = "none";
    }
  }

  update();
  _firstCardTimerInterval = setInterval(update, 250);
}

function renderGame(room) {
  const levelCfg = getCurrentLevelCfg(room);
  const me = room.players[state.myId];
  const players = Object.values(room.players || {});
  const isHost = room.hostId === state.myId;

  // Ocultar la pestaña de Misiones por completo si están desactivadas
  const missionsTabBtn = document.querySelector('.tab-btn[data-tab="missions"]');
  if (missionsTabBtn) {
    missionsTabBtn.style.display = (room.missionsEnabled === false) ? "none" : "";
  }

  document.getElementById("topRoomCode").textContent = "Sala: " + room.code;
  const levelLabel = (room.isTutorial && room.tutorialLevel != null)
    ? "Tutorial " + room.tutorialLevel + "/6"
    : "Nivel " + room.currentLevel + "/8";
  document.getElementById("topLevelInfo").textContent =
    levelLabel + " — " + (levelCfg.type === "BST" ? "BST" : "Pirámide") + " (" + levelCfg.nodes + " nodos)";
  document.getElementById("topDifficulty").textContent = room.isTutorial ? "🎓 Tutorial" : room.difficulty;
  document.getElementById("topLives").textContent = room.sharedLives;
  document.getElementById("topMaxLives").textContent = room.maxLives;

  renderLevelTimer(room, isHost);
  renderMissionTimer(room, me);
  renderShyStackZone(room);
  renderFamiliarPassZone(room, me);
  renderSignalChoiceZone(room, me);

  const phaseLabels = { lobby:"Lobby", missionSelect:"Misiones", playing:"Jugando",
    levelEnd:"¡Nivel completo!", gameOver:"Fin del juego", tutorialIntro:"Tutorial" };
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
      (p.signal ? '<span class="signal-badge">' + formatSignalDisplay(p.signal) + '</span>' : "");
    playersBar.appendChild(chip);
  });

  const loudFlash = document.getElementById("loudFlash");
  if (room.loudTrigger && Date.now() - room.loudTrigger.time < 3000) {
    loudFlash.style.display = "block";
    setTimeout(function() { loudFlash.style.display = "none"; }, 3000 - (Date.now() - room.loudTrigger.time));
  } else {
    loudFlash.style.display = "none";
  }

  const curiousFlash = document.getElementById("curiousFlash");
  if (room.curiousPeek && Date.now() - room.curiousPeek.time < 6000) {
    curiousFlash.style.display = "flex";
    curiousFlash.innerHTML = "";
    const label = document.createElement("span");
    label.className = "curious-flash-label";
    label.textContent = "👀 " + room.curiousPeek.playerName + " reveló el tope del mazo:";
    curiousFlash.appendChild(label);
    const cardsDiv = document.createElement("div");
    cardsDiv.className = "curious-flash-cards";
    for (const c of room.curiousPeek.cards) {
      cardsDiv.appendChild(window.CardRender.renderCard(c, { small: true }));
    }
    curiousFlash.appendChild(cardsDiv);
    setTimeout(function() { curiousFlash.style.display = "none"; }, 6000 - (Date.now() - room.curiousPeek.time));
  } else {
    curiousFlash.style.display = "none";
  }

  renderBoardTab(room, levelCfg, me, isHost);
  renderMissionsTab(room, me);
  renderLogTab(room);
  renderPlayersTab(room, players, isHost);
  renderGuideTab();
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

    const hint = document.createElement("span");
    hint.style.fontSize = "12px"; hint.style.color = "#aaa";
    hint.textContent = "Click en una carta de tu mano para jugarla — el lugar se calcula solo";
    header.appendChild(hint);

    panel.appendChild(header);

    const boardDiv = document.createElement("div");
    window.BoardRender.renderBoard(boardDiv, room.board || {}, levelCfg, {
      hidePersonality: isPhase1Tutorial(room),
    });
    panel.appendChild(boardDiv);
    tab.appendChild(panel);
  }

  else if (room.phase === "levelEnd") {
    const isTut = room.isTutorial && room.tutorialLevel != null;
    const banner = document.createElement("div");
    banner.className = "banner success";
    const titleText = isTut
      ? "¡Tutorial " + room.tutorialLevel + "/6 completado!"
      : "¡Nivel " + room.currentLevel + " completado!";
    banner.innerHTML =
      '<div class="banner-icon">🎉</div>' +
      '<div class="banner-title">' + titleText + '</div>' +
      '<div class="banner-sub">Todos los nodos colocados correctamente. +1 pt para todos.</div>';

    const canAdvance = isTut ? room.tutorialLevel <= 6 : room.currentLevel < 8;
    if (isHost && canAdvance) {
      const btn = document.createElement("button");
      btn.className = "btn btn-primary";
      btn.style.width = "auto"; btn.style.padding = "10px 24px";
      btn.style.background = "#fff"; btn.style.color = "#1E8449";
      btn.textContent = isTut
        ? (room.tutorialLevel === 6 ? "Comenzar partida real →" : "Siguiente →")
        : "Siguiente Nivel →";
      btn.onclick = nextLevel;
      banner.appendChild(btn);
    }
    if (!isTut && room.currentLevel === 8) {
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

    const btnContainer = document.createElement("div");
    btnContainer.style.cssText = "display:flex; gap:12px; justify-content:center; margin-top:16px;";

    const btnHome = document.createElement("button");
    btnHome.className = "btn";
    btnHome.textContent = "🏠 Volver al inicio";
    btnHome.onclick = function() { localStorage.removeItem('bst_session'); location.reload(); };
    btnContainer.appendChild(btnHome);

    tab.appendChild(btnContainer);
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

  else if (room.phase === "tutorialIntro") {
    const tutLevel = room.tutorialLevel || 1;
    const phaseNum = window.GameData.TUTORIAL_LEVELS[tutLevel - 1].phase;
    const phaseInfo = window.GameData.TUTORIAL_PHASE_INFO[phaseNum];

    const banner = document.createElement("div");
    banner.className = "banner success";
    banner.innerHTML =
      '<div class="banner-icon">🎓</div>' +
      '<div class="banner-title">' + phaseInfo.title + '</div>' +
      '<div class="banner-sub">' + phaseInfo.message + '</div>' +
      '<div style="font-size:12px;opacity:0.8;margin-top:8px;">Tutorial ' + tutLevel + '/6</div>';

    const readyBtn = document.createElement("button");
    readyBtn.className = "btn btn-primary";
    readyBtn.style.width = "auto"; readyBtn.style.padding = "10px 24px";
    readyBtn.style.background = "#fff"; readyBtn.style.color = "#1E8449";
    readyBtn.style.marginTop = "12px";
    const me = room.players[state.myId];
    readyBtn.textContent = me && me.ready ? "✓ Esperando a otros..." : "✓ Listo, repartir cartas";
    readyBtn.disabled = !!(me && me.ready);
    readyBtn.onclick = readyToPlay;
    banner.appendChild(readyBtn);

    tab.appendChild(banner);
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

// ── Guía del jugador (player sheet) ─────────────────────────────────────
// Contenido de referencia estático: no depende del estado de la sala,
// así que se construye una sola vez y se reutiliza. Cambiar a esta
// pestaña nunca toca room/Firebase — es 100% seguro consultarla en
// cualquier momento sin afectar la partida en curso.
let _guideTabBuilt = false;

function renderGuideTab() {
  if (_guideTabBuilt) return; // ya se construyó antes, no rehacer trabajo
  const tab = document.getElementById("tabGuide");
  tab.innerHTML = "";

  const HEX_BY_COLOR = {
    Gray: "#95A5A6", Yellow: "#F1C40F", Green: "#27AE60", Orange: "#E67E22",
    Blue: "#4472C4", Purple: "#8E44AD", Pink: "#F48FB1", White: "#BDC3C7",
    Red: "#C0392B", Black: "#2C3E50",
  };
  const COLOR_LABEL_ES = {
    Gray: "Gris", Yellow: "Amarillo", Green: "Verde", Orange: "Naranja",
    Blue: "Azul", Purple: "Morado", Pink: "Rosa", White: "Blanco",
    Red: "Rojo", Black: "Negro",
  };
  const PERSONALITY_LABEL_ES = {
    Common: "Common", Loud: "Loud (Ruidosa)", Orderly: "Orderly (Ordenada)",
    Curious: "Curious (Curiosa)", Familiar: "Familiar", Shy: "Shy (Tímida)",
    Joker: "Joker", Sacrifice: "Sacrifice (Sacrificio)",
    Hyperactive: "Hyperactive (Hiperactiva)", Demolisher: "Demolisher (Demoledora)",
  };
  const LIGHT_TEXT_COLORS = new Set(["Blue", "Red", "Purple", "Green", "Black"]);

  const panel = document.createElement("div");
  panel.className = "card-panel guide-panel";

  panel.innerHTML = `
    <div class="guide-title">📖 Guía del Jugador</div>
    <div class="guide-subtitle">Consúltala en cualquier momento — no afecta tu turno ni el estado de la partida.</div>
  `;

  // ── Sección 1: Personalidades, ordenadas por potencia (0-9) ──────────
  const persSection = document.createElement("div");
  persSection.className = "guide-section";
  persSection.innerHTML = `<div class="guide-section-title">Personalidades (el último dígito del número indica color y poder)</div>`;

  const persTable = document.createElement("div");
  persTable.className = "guide-personality-table";

  for (let digit = 0; digit <= 9; digit++) {
    const personality = window.GameData.DIGIT_TO_PERSONALITY[digit];
    const color = window.GameData.DIGIT_TO_COLOR[digit];
    const hex = HEX_BY_COLOR[color];
    const textColor = LIGHT_TEXT_COLORS.has(color) ? "#FFFFFF" : "#1A1A1A";
    const info = window.GameData.PERSONALITY_INFO[personality] || "";

    const row = document.createElement("div");
    row.className = "guide-personality-row";
    row.innerHTML = `
      <div class="guide-pers-swatch" style="background:${hex}; color:${textColor};">
        <span class="guide-pers-digit">${digit}</span>
      </div>
      <div class="guide-pers-text">
        <div class="guide-pers-name">${PERSONALITY_LABEL_ES[personality]} <span class="guide-pers-colorname">— ${COLOR_LABEL_ES[color]}</span></div>
        <div class="guide-pers-desc">${info}</div>
      </div>
    `;
    persTable.appendChild(row);
  }
  persSection.appendChild(persTable);
  panel.appendChild(persSection);

  // ── Sección 2: Reglas rápidas de colocación ───────────────────────────
  const rulesSection = document.createElement("div");
  rulesSection.className = "guide-section";
  rulesSection.innerHTML = `
    <div class="guide-section-title">Reglas de colocación</div>
    <div class="guide-rule-block">
      <div class="guide-rule-name">🌳 Árbol BST</div>
      <div class="guide-rule-text">Cada carta nueva se compara contra la raíz: si es menor, baja a la izquierda; si es mayor, baja a la derecha. Se repite en cada nodo hasta encontrar un espacio vacío. Si el camino llega a un nodo ocupado sin espacio, la carta no se puede jugar ahora.</div>
    </div>
    <div class="guide-rule-block">
      <div class="guide-rule-name">🔺 Pirámide</div>
      <div class="guide-rule-text">La base se llena ordenada de menor a mayor. Cuando una carta cae exactamente entre dos vecinas que ya son pareja fija, sube como su hijo a la fila de arriba. Una vez que dos cartas quedan emparejadas, esa relación es permanente — la otra vecina debe esperar una nueva pareja.</div>
    </div>
  `;
  panel.appendChild(rulesSection);

  // ── Sección 3: Señales ────────────────────────────────────────────────
  const signalsSection = document.createElement("div");
  signalsSection.className = "guide-section";
  signalsSection.innerHTML = `
    <div class="guide-section-title">Señales de comunicación</div>
    <div class="guide-signal-row"><b>Rango</b> — muestra tu carta más alta o más baja de la mano.</div>
    <div class="guide-signal-row"><b>Manada</b> — eliges una Clase/animal de tu mano y revela cuántas tienes.</div>
    <div class="guide-signal-row"><b>Mediana</b> — muestra tu carta del medio (si tu mano es par, elige cuál de las 2 medianas).</div>
    <div class="guide-signal-row"><b>Color/Personalidad</b> — igual que Manada, pero contando Personalidad en vez de Clase.</div>
  `;
  panel.appendChild(signalsSection);

  tab.appendChild(panel);
  _guideTabBuilt = true;
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
      (p.signal ? '<div class="player-card-signal">📡 ' + formatSignalDisplay(p.signal) + '</div>' : "") +
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
    if (state.selectedCardId && me.hand[state.selectedCardId]) {
      const sigHint = document.createElement("span");
      sigHint.style.fontSize = "11px"; sigHint.style.color = "#048A81";
      sigHint.textContent = "📡 Carta " + me.hand[state.selectedCardId].number + " lista para señal Rango:";
      toolbar.appendChild(sigHint);
    }
    for (const sig of Object.keys(me.unlockedSignals || {})) {
      const btn = document.createElement("button");
      btn.className = "toolbar-btn signal";
      btn.textContent = "📡 " + signalLabel(sig);
      btn.disabled = sig === "Range" && !state.selectedCardId;
      btn.title = sig === "Range" ? "Requiere seleccionar una carta primero" : "";
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

    if (!room.isTutorial && !room.usedRetreat) {
      const levelCfg = getCurrentLevelCfg(room);
      const filled = window.GameLogic.countFilledNodes(room.board || {});
      const canRetreat = filled < levelCfg.nodes / 2;
      const votes = room.retreatVotes || {};
      const iVoted = !!votes[state.myId];

      const retreatBtn = document.createElement("button");
      retreatBtn.className = "toolbar-btn retreat";
      retreatBtn.disabled = !canRetreat && !iVoted;
      retreatBtn.title = canRetreat
        ? "Retirada Estratégica: pierde la mitad de las vidas, se reparte de nuevo este nivel (1 vez por partida)"
        : "Solo disponible si menos del 50% de los nodos están colocados";
      retreatBtn.textContent = iVoted
        ? "🏳 Voto enviado (" + Object.keys(votes).length + "/" + Object.keys(room.players).length + ") — cancelar"
        : "🏳 Retirada (" + Object.keys(votes).length + "/" + Object.keys(room.players).length + ")";
      retreatBtn.onclick = iVoted ? cancelRetreatVote : voteRetreat;
      toolbar.appendChild(retreatBtn);
    }

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
    const canSignal = room.phase === "playing";
    const hidePers = isPhase1Tutorial(room);
    for (const card of handCards) {
      const cardEl = window.CardRender.renderCard(card, {
        selected: state.selectedCardId === card.id,
        onClick: (function(id) { return function() { selectCard(id); }; })(card.id),
        onSignalClick: (canSignal && !hidePers)
          ? (function(id) { return function() {
              state.selectedCardId = state.selectedCardId === id ? null : id;
              renderAll();
            }; })(card.id)
          : null,
        hidePersonality: hidePers,
      });
      cardsDiv.appendChild(cardEl);
    }
  }
}

window.GameRoom = {
  createRoom, joinRoom, tryReconnect, startGame, takeMission, readyToPlay,
  playCard, nextLevel, endLevel, useSignal, completeMission, abandonMission,
  spendPoints, selectCard, state,
};
