// ════════════════════════════════════════════════════════════════
// MISSION ENGINE — Verifica automáticamente si un jugador cumplió
// la condición de su misión activa, y si es así, la completa solo
// (otorga +3 pts y activa la recompensa, sin que el jugador haga
// click en "Completar").
//
// checkMission(missionId, ctx) devuelve true/false.
// ctx = { room, stats, player, playerId, levelCfg, board, filled }
// ════════════════════════════════════════════════════════════════

function familiesCompleted(board, totalNodes) {
  // Cuenta cuántas "familias" (mismo cardClass, 10 cartas por clase)
  // están 100% representadas en el tablero actual.
  const classCounts = {};
  for (let pos = 1; pos <= totalNodes; pos++) {
    const node = board[String(pos)];
    if (node) classCounts[node.cardClass] = (classCounts[node.cardClass] || 0) + 1;
  }
  // Una familia completa requiere las 10 cartas de esa clase, lo
  // cual en la práctica solo es posible en niveles muy grandes;
  // para niveles pequeños interpretamos "familia completa dentro
  // del tablero" como: todas las cartas de esa clase que EXISTEN
  // en el mazo completo (10) están dentro del árbol actual.
  return Object.values(classCounts).filter(c => c >= 10).length;
}

function isLeafPosition(pos, totalNodes) {
  const lc = pos * 2, rc = pos * 2 + 1;
  return lc > totalNodes; // no tiene hijos posibles -> es hoja
}

function allLeavesFilled(board, totalNodes, height) {
  let allFilled = true;
  for (let pos = 1; pos <= totalNodes; pos++) {
    if (isLeafPosition(pos, totalNodes)) {
      if (!board[String(pos)]) { allFilled = false; break; }
    }
  }
  return allFilled;
}

function leftLeavesFilled(board, totalNodes) {
  // Las "hojas del lado izquierdo" = hojas cuyo camino desde la
  // raíz siempre giró a la izquierda en el primer paso, es decir,
  // todas las hojas que descienden de la posición 2 (hijo izq de la raíz).
  const leftSubtreeRoot = 2;
  if (leftSubtreeRoot > totalNodes) return false;
  let found = false, allFilled = true;
  for (let pos = leftSubtreeRoot; pos <= totalNodes; pos++) {
    // pertenece al subárbol izquierdo si su ancestro en profundidad 1 es 2
    let cur = pos;
    while (cur > 2) cur = Math.floor(cur / 2);
    if (cur !== 2) continue;
    if (isLeafPosition(pos, totalNodes)) {
      found = true;
      if (!board[String(pos)]) allFilled = false;
    }
  }
  return found && allFilled;
}

function pyramidBaseFull(board, height) {
  const start = Math.pow(2, height - 1);
  const end = Math.pow(2, height) - 1;
  for (let pos = start; pos <= end; pos++) {
    if (!board[String(pos)]) return false;
  }
  return true;
}

function pyramidTopRowsFull(board, height, rowsFromTop) {
  // Verifica que las `rowsFromTop` filas más cercanas al ápice
  // estén completamente llenas (ápice = fila 1).
  for (let depth = 0; depth < rowsFromTop; depth++) {
    const start = Math.pow(2, depth);
    const end = Math.pow(2, depth + 1) - 1;
    for (let pos = start; pos <= end && pos <= Math.pow(2, height) - 1; pos++) {
      if (!board[String(pos)]) return false;
    }
  }
  return true;
}

function countDistinctSignalTypes(signalCounter) {
  if (!signalCounter) return 0;
  return Object.values(signalCounter).filter(n => n > 0).length;
}

function totalSignalsUsed(signalCounter) {
  if (!signalCounter) return 0;
  return Object.values(signalCounter).reduce((a, b) => a + b, 0);
}

function freeSignalsOnly(signalCounter, room) {
  // "Solo señales gratuitas" -> en este modelo, solo Range tiene
  // costo (según dificultad); Pack/Median/Color son gratis siempre.
  // Si usó Range con costo > 0 alguna vez, no cumple.
  const diff = window.GameData.DIFFICULTY[room.difficulty];
  if (diff.rangeSignalCost > 0 && signalCounter && signalCounter.Range > 0) return false;
  return true;
}

// ────────────────────────────────────────────────────────────────
// Tabla de verificadores: missionId -> función(ctx) => bool
// ────────────────────────────────────────────────────────────────
const VERIFIERS = {
  // [A] Estado existente
  3:  (ctx) => ctx.justPlayedRoot === true,
  5:  (ctx) => ctx.phase === "levelEnd" && ctx.player.points >= 3,
  8:  (ctx) => ctx.phase === "levelEnd" && !ctx.stats.spentPointsThisLevel?.[ctx.playerId],
  9:  (ctx) => ctx.phase === "levelEnd" && totalSignalsUsed(ctx.stats.signalsUsedThisLevel?.[ctx.playerId]) === 0,
  10: (ctx) => ctx.justPlacedOrderlySequential === true,
  12: (ctx) => ctx.phase === "levelEnd" && ctx.stats.noLivesLostLevels?.includes(ctx.room.currentLevel),
  19: (ctx) => ctx.phase === "levelEnd" && !ctx.stats.spentPointsThisLevel?.[ctx.playerId],
  23: (ctx) => ctx.phase === "levelEnd" && ctx.player.points >= 10,
  25: (ctx) => ctx.room.currentLevel >= 2 && checkPointsAcrossLevels(ctx, 1, 2, 15),
  30: (ctx) => ctx.phase === "levelEnd" && (ctx.player.handCount || 0) === 0,
  32: (ctx) => ctx.room.currentLevel >= 3 && checkPointsAcrossLevels(ctx, 1, 3, 15),
  34: (ctx) => ctx.room.currentLevel === 5 && ctx.room.sharedLives === ctx.room.maxLives,
  39: (ctx) => ctx.room.currentLevel >= 4 && checkPointsAcrossLevels(ctx, 1, 4, 20),
  42: (ctx) => ctx.room.currentLevel < 5 && ctx.player.points >= 30,

  // [B] Contadores
  1:  (ctx) => (ctx.stats.signalsUsedThisLevel?.[ctx.playerId]?.Range || 0) >= 1,
  6:  (ctx) => ctx.distinctClassesInHand >= 3,
  7:  (ctx) => ctx.justChainedFamiliar === true,
  11: (ctx) => ctx.phase === "levelEnd" && ctx.stats.groupSignalsThisLevel === 0,
  14: (ctx) => ctx.phase === "levelEnd" && ctx.stats.groupSignalsThisLevel === 1,
  15: (ctx) => ctx.phase === "levelEnd" && (ctx.stats.signalsUsedThisLevel?.[ctx.playerId]?.Range || 0) === 0,
  17: (ctx) => (ctx.stats.signalsUsedThisLevel?.[ctx.playerId]?.Pack || 0) === 1,
  20: (ctx) => ctx.maxSamePersonalityInHand >= 4,
  21: (ctx) => countDistinctSignalTypes(ctx.stats.signalsUsedThisLevel?.[ctx.playerId]) >= 2,
  24: (ctx) => ctx.phase === "levelEnd" && (ctx.stats.signalsUsedThisLevel?.[ctx.playerId]?.Range || 0) === 0,
  26: (ctx) => (ctx.stats.signalsUsedThisLevel?.[ctx.playerId]?.Median || 0) === 1,
  27: (ctx) => ctx.phase === "levelEnd" && (ctx.player.handCount || 0) === 0 && !ctx.stats.usedRedrawThisLevel?.[ctx.playerId],
  29: (ctx) => ctx.phase === "levelEnd" && ctx.isTopSignalUser === true,
  31: (ctx) => ctx.phase === "levelEnd" && !ctx.room.usedRetreat,
  33: (ctx) => ctx.room.currentLevel >= 4 && !ctx.room.usedRetreat,
  35: (ctx) => countDistinctSignalTypes(ctx.stats.signalsUsedThisLevel?.[ctx.playerId]) >= 4,
  36: (ctx) => ctx.stats.firstPlayerThisLevel === ctx.playerId && ctx.justPlayedCard === true && ctx.wasFirstThisLevel === true,
  38: (ctx) => (ctx.stats.pyramidsNoLivesLost || 0) >= 2,
  40: (ctx) => ctx.room.currentLevel >= 4 && checkAllLevelsFreeSignals(ctx, 1, 4),
  41: (ctx) => ctx.room.currentLevel >= 4 && checkNoLivesLostAcross(ctx, 1, 4),

  // [C] Análisis de tablero
  4:  (ctx) => leftLeavesFilled(ctx.board, ctx.levelCfg.nodes),
  13: (ctx) => allLeavesFilled(ctx.board, ctx.levelCfg.nodes, ctx.levelCfg.height),
  16: (ctx) => ctx.levelCfg.type === "Pyramid" && pyramidBaseFull(ctx.board, ctx.levelCfg.height),
  18: (ctx) => familiesCompleted(ctx.board, ctx.levelCfg.nodes) >= 1,
  22: (ctx) => ctx.levelCfg.type === "Pyramid" && pyramidTopRowsFull(ctx.board, ctx.levelCfg.height, 3),
  28: (ctx) => familiesCompleted(ctx.board, ctx.levelCfg.nodes) >= 2,
  37: (ctx) => ctx.levelCfg.type === "Pyramid" && !!ctx.board["1"] && ctx.justPlayedApex === true,

  // [D] Tiempo real
  2:  (ctx) => ctx.justPlayedCard === true && ctx.stats.firstCardPlayedBy === ctx.playerId &&
               (ctx.stats.firstCardPlayedAt - ctx.stats.levelStartTime) <= 30000,
};

function checkPointsAcrossLevels(ctx, fromLevel, toLevel, minPoints) {
  const checkpoints = ctx.stats.pointsAtCheckpoints || {};
  for (let lvl = fromLevel; lvl <= toLevel; lvl++) {
    const snap = checkpoints[lvl];
    if (!snap || (snap[ctx.playerId] || 0) < minPoints) return false;
  }
  return true;
}

function checkNoLivesLostAcross(ctx, fromLevel, toLevel) {
  const noLivesLost = ctx.stats.noLivesLostLevels || [];
  for (let lvl = fromLevel; lvl <= toLevel; lvl++) {
    if (!noLivesLost.includes(lvl)) return false;
  }
  return true;
}

function checkAllLevelsFreeSignals(ctx, fromLevel, toLevel) {
  // Simplificación: revisamos solo el nivel actual; un tracking
  // histórico completo de "señales gratis por nivel" requeriría
  // guardar snapshots por nivel, que no se trackean hoy. Se deja
  // como aproximación basada en el nivel actual.
  return freeSignalsOnly(ctx.stats.signalsUsedThisLevel?.[ctx.playerId], ctx.room);
}

// ────────────────────────────────────────────────────────────────
// Punto de entrada: revisa la misión activa del jugador y la
// completa automáticamente si su condición ya se cumple.
// Devuelve { completed: bool, missionId } o null si no aplica.
// ────────────────────────────────────────────────────────────────
function checkAndAutoComplete(ctx) {
  const mission = ctx.player.activeMission;
  if (!mission) return null;

  const verifier = VERIFIERS[mission.id];
  if (!verifier) return null; // sin verificador automático -> queda manual

  try {
    if (verifier(ctx)) {
      return { completed: true, missionId: mission.id };
    }
  } catch (e) {
    console.warn("Error verificando misión", mission.id, e);
  }
  return null;
}

window.MissionEngine = { checkAndAutoComplete, VERIFIERS, familiesCompleted };
