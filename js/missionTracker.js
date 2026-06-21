// ════════════════════════════════════════════════════════════════
// MISSION TRACKER — Registra estadísticas necesarias para verificar
// automáticamente las condiciones de las misiones.
//
// Todo el tracking vive en room.stats, con esta forma:
//
// room.stats = {
//   levelStartTime: <timestamp>,        // cuándo empezó el nivel actual (para timers)
//   firstCardPlayedAt: <timestamp|null>,// cuándo se jugó la primera carta del nivel
//   firstCardPlayedBy: <playerId|null>,
//   livesAtLevelStart: <number>,        // snapshot de vidas al iniciar el nivel
//   usedRedrawThisLevel: { [playerId]: bool },
//   spentPointsThisLevel: { [playerId]: bool }, // gastó CUALQUIER habilidad pagada
//   signalsUsedThisLevel: { [playerId]: { Range: n, Pack: n, Median: n, Color: n } },
//   groupSignalsThisLevel: n,           // total de señales usadas por TODO el grupo
//   pointsAtCheckpoints: { [levelNumber]: { [playerId]: points } }, // snapshot al final de cada nivel
//   noLivesLostLevels: [levelNumbers...], // niveles completados sin perder vidas
//   pyramidsNoLivesLost: n,              // contador acumulado de pirámides sin perder vidas
//   firstPlayerThisLevel: <playerId|null>,
// }
// ════════════════════════════════════════════════════════════════

function emptySignalCounter() {
  return { Range: 0, Pack: 0, Median: 0, Color: 0 };
}

function initStatsForNewGame() {
  return {
    levelStartTime: Date.now(),
    firstCardPlayedAt: null,
    firstCardPlayedBy: null,
    livesAtLevelStart: null, // se setea al repartir
    usedRedrawThisLevel: {},
    spentPointsThisLevel: {},
    signalsUsedThisLevel: {},
    groupSignalsThisLevel: 0,
    pointsAtCheckpoints: {},
    noLivesLostLevels: [],
    pyramidsNoLivesLost: 0,
    firstPlayerThisLevel: null,
  };
}

// Llamar al repartir cartas de un nivel nuevo (dealLevel)
function resetLevelStats(stats, currentLives) {
  return {
    ...stats,
    levelStartTime: Date.now(),
    firstCardPlayedAt: null,
    firstCardPlayedBy: null,
    livesAtLevelStart: currentLives,
    usedRedrawThisLevel: {},
    spentPointsThisLevel: {},
    signalsUsedThisLevel: {},
    groupSignalsThisLevel: 0,
    firstPlayerThisLevel: null,
  };
}

// Llamar cada vez que se juega una carta
function trackCardPlayed(stats, playerId) {
  const updates = {};
  if (stats.firstCardPlayedAt === null) {
    updates.firstCardPlayedAt = Date.now();
    updates.firstCardPlayedBy = playerId;
    updates.firstPlayerThisLevel = playerId;
  }
  return updates;
}

// Llamar cada vez que se usa una señal
function trackSignalUsed(stats, playerId, signalType) {
  const current = stats.signalsUsedThisLevel[playerId] || emptySignalCounter();
  const updated = { ...current, [signalType]: (current[signalType] || 0) + 1 };
  return {
    signalsUsedThisLevel: Object.assign({}, stats.signalsUsedThisLevel, {
      [playerId]: updated,
    }),
    groupSignalsThisLevel: (stats.groupSignalsThisLevel || 0) + 1,
  };
}

// Llamar cada vez que se gasta puntos en una habilidad (drawCard, gainLife, redrawHand)
function trackPointsSpent(stats, playerId, ability) {
  const updates = {
    spentPointsThisLevel: Object.assign({}, stats.spentPointsThisLevel, {
      [playerId]: true,
    }),
  };
  if (ability === "redrawHand") {
    updates.usedRedrawThisLevel = Object.assign({}, stats.usedRedrawThisLevel, {
      [playerId]: true,
    });
  }
  return updates;
}

// Llamar al final de cada nivel (levelEnd), antes de avanzar
function trackLevelEnd(stats, players, currentLevel, livesLost) {
  const updates = {};
  const pointsSnapshot = {};
  for (const [pid, p] of Object.entries(players)) {
    pointsSnapshot[pid] = p.points;
  }
  // IMPORTANTE: esto se mezcla luego con Object.assign sobre el objeto
  // `stats` completo (no es un path de Firebase con update()), así que
  // debe ser un objeto anidado real en JS, nunca una clave con "/".
  updates.pointsAtCheckpoints = Object.assign(
    {},
    stats.pointsAtCheckpoints,
    { [currentLevel]: pointsSnapshot }
  );

  if (livesLost === 0) {
    const noLivesLost = [...(stats.noLivesLostLevels || []), currentLevel];
    updates.noLivesLostLevels = noLivesLost;
  }

  return updates;
}

window.MissionTracker = {
  initStatsForNewGame, resetLevelStats, trackCardPlayed,
  trackSignalUsed, trackPointsSpent, trackLevelEnd, emptySignalCounter,
};
