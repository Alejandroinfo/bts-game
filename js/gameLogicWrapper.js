// ════════════════════════════════════════════════════════════════
// Wrapper de import — gameLogic.js (v2) se carga como script clásico
// (mismo patrón que v1) y cuelga sus funciones en window.GameLogicV2.
// Este wrapper las re-expone como exports de ES module para que
// gameRoom.js (que sí es module, por los imports de gameData.js)
// pueda usarlas con `import { ... } from "./gameLogicWrapper.js"`.
//
// IMPORTANTE: requiere que gameLogic.js se cargue ANTES que este
// wrapper en index.html (ver orden de <script> tags).
// ════════════════════════════════════════════════════════════════

export const findBSTPosition = (...args) => window.GameLogicV2.findBSTPosition(...args);
export const countChildren = (...args) => window.GameLogicV2.countChildren(...args);
export const isValidPyramidPlacement = (...args) => window.GameLogicV2.isValidPyramidPlacement(...args);
export const isPyramidBasePosition = (...args) => window.GameLogicV2.isPyramidBasePosition(...args);
export const isVisibleTo = (...args) => window.GameLogicV2.isVisibleTo(...args);
export const canAct = (...args) => window.GameLogicV2.canAct(...args);
