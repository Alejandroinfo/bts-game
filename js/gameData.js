// ════════════════════════════════════════════════════════════════
// GAME DATA — Cartas, misiones, niveles, dificultad
// ════════════════════════════════════════════════════════════════

const CLASSES = ["Dog","Cat","Bear","Rabbit","Rat","Cow","Tiger","Lion","Shark","Sparrow"];

// ── Sistema fusionado Color + Personalidad ──────────────────────────────
// El dígito final del número (0-9) determina DIRECTAMENTE tanto el color
// como la personalidad de la carta. El índice en este array ES el nivel
// de potencia: 0 = más débil (Common), 9 = más fuerte (Demoledor).
const DIGIT_TO_PERSONALITY = [
  "Common",      // dígito 0 — potencia 0 (la más débil)
  "Loud",        // dígito 1 — potencia 1
  "Orderly",     // dígito 2 — potencia 2
  "Curious",     // dígito 3 — potencia 3
  "Familiar",    // dígito 4 — potencia 4
  "Shy",         // dígito 5 — potencia 5
  "Joker",       // dígito 6 — potencia 6
  "Sacrifice",   // dígito 7 — potencia 7
  "Hyperactive", // dígito 8 — potencia 8
  "Demolisher",  // dígito 9 — potencia 9 (la más fuerte)
];

const DIGIT_TO_COLOR = [
  "Gray",    // 0 — Common
  "Yellow",  // 1 — Loud
  "Green",   // 2 — Orderly
  "Orange",  // 3 — Curious
  "Blue",    // 4 — Familiar
  "Purple",  // 5 — Shy
  "Pink",    // 6 — Joker
  "White",   // 7 — Sacrifice
  "Red",     // 8 — Hyperactive
  "Black",   // 9 — Demolisher
];

export function personalityPower(personality) {
  return DIGIT_TO_PERSONALITY.indexOf(personality);
}

export function buildDeck() {
  return Array.from({ length: 100 }, (_, i) => {
    const n = i + 1;
    const lastDigit = n % 10; // 100 -> 0, igual que el resto de decenas
    const classIdx = Math.floor((n - 1) / 10);
    return {
      id: n,
      number: n,
      type: DIGIT_TO_COLOR[lastDigit],
      cardClass: CLASSES[classIdx],
      personality: DIGIT_TO_PERSONALITY[lastDigit],
    };
  });
}

export const PERSONALITY_INFO = {
  Common:      "Sin efecto especial. La más numerosa — estadísticamente predecible (potencia 0)",
  Loud:        "Al jugarse, todos los jugadores revelan brevemente su carta más alta (3 segundos) (potencia 1)",
  Orderly:     "Al jugarse, si su padre o algún hijo ya colocado tiene un valor con diferencia exacta de ±1, otorga +1 punto (potencia 2)",
  Curious:     "Al jugarse, se muestran a todos las 2 cartas de arriba del mazo (sin tomarlas). Luego vuelven al fondo (potencia 3)",
  Familiar:    "Si 2 Familiar se juegan seguidas, se activa un pase: todos los que tengan una Familiar en mano eligen cuál pasar a su vecino de la izquierda, simultáneamente (potencia 4)",
  Shy:         "Al jugarse no se coloca de inmediato: se apila (visible a todos) y espera. Se libera en orden inverso cuando alguien juegue una carta normal (potencia 5). Solo en BST por ahora — en Pirámide se juega como Common.",
  Joker:       "Copia la habilidad de la última carta jugada antes de ella. Si esa carta era Common, no pasa nada (potencia 6)",
  Sacrifice:   "Al jugarse, descarta otra carta de tu mano (no Common ni Sacrificio) y copia su habilidad (potencia 7)",
  Hyperactive: "Opcionalmente puede jugarse como si fuera ANTES que la última carta jugada, reubicándola (potencia 8). Solo en BST por ahora — en Pirámide se juega como Common.",
  Demolisher:  "Al jugarse, elimina cualquier carta ya colocada en el tablero. La posición queda vacía y debe rellenarse respetando padre e hijos (potencia 9, la más fuerte). Solo en BST por ahora — en Pirámide se juega como Common.",
};

export const LEVELS = [
  { level: 1, type: "BST",     height: 3, nodes: 7  },
  { level: 2, type: "Pyramid", height: 3, nodes: 7  },
  { level: 3, type: "BST",     height: 4, nodes: 15 },
  { level: 4, type: "Pyramid", height: 4, nodes: 15 },
  { level: 5, type: "BST",     height: 5, nodes: 31 },
  { level: 6, type: "Pyramid", height: 5, nodes: 31 },
  { level: 7, type: "BST",     height: 6, nodes: 63 },
  { level: 8, type: "Pyramid", height: 6, nodes: 63 },
];

// ── Tutorial: 3 fases x 2 niveles (BST + Pirámide), siempre tamaño 3 ──────
// Fase 1 (T1-T2): solo números, sin colores/personalidades visibles ni activas
// Fase 2 (T3-T4): colores y personalidades visibles y activas
// Fase 3 (T5-T6): + pool de misiones, puntos, habilidades pagadas
export const TUTORIAL_LEVELS = [
  { level: 1, type: "BST",     height: 3, nodes: 7, phase: 1 },
  { level: 2, type: "Pyramid", height: 3, nodes: 7, phase: 1 },
  { level: 3, type: "BST",     height: 3, nodes: 7, phase: 2 },
  { level: 4, type: "Pyramid", height: 3, nodes: 7, phase: 2 },
  { level: 5, type: "BST",     height: 3, nodes: 7, phase: 3 },
  { level: 6, type: "Pyramid", height: 3, nodes: 7, phase: 3 },
];

export const TUTORIAL_PHASE_INFO = {
  1: { title: "Fase 1 — Solo números",
       message: "Aprende las reglas de colocación: el árbol BST baja por valor, la pirámide se construye lateralmente. Los colores y habilidades especiales no están activos todavía." },
  2: { title: "Fase 2 — ¡Colores y personalidades!",
       message: "Cada carta ahora muestra su color y personalidad. ¡Las habilidades especiales ya están activas! Observa qué hace cada una al jugarla." },
  3: { title: "Fase 3 — Misiones y puntos",
       message: "Se desbloquea el pool de misiones, los puntos personales, y las habilidades pagadas (robar carta, ganar vida, redibujar mano). ¡Ya conoces todo el juego!" },
};

export function cardsPerPlayer(nodes, playerCount) {
  return Math.ceil(nodes / playerCount);
}

export const DIFFICULTY = {
  Easy:   { lives: 15, startPts: 3, rangeSignalCost: 0 },
  Normal: { lives: 12, startPts: 2, rangeSignalCost: 2 },
  Hard:   { lives:  9, startPts: 1, rangeSignalCost: 3 },
  Expert: { lives:  6, startPts: 0, rangeSignalCost: 3 },
};

// Pozo de vidas independiente para el tutorial — separado del que se
// usará luego en los 8 niveles reales. Generoso, porque el objetivo
// es aprender, no morir por mala suerte mientras se descubren las reglas.
export const TUTORIAL_DIFFICULTY = { lives: 10, startPts: 2, rangeSignalCost: 1 };

export const SIGNALS_UNLOCKABLE = ["Range", "Pack", "Median", "Color"];

// ── Mission Data ──────────────────────────────────────────────────
export const MISSIONS = [
  { id:1,  level:"Level 1", cost:"1 pt",  type:"Communication", condition:"Usa la Señal de Rango al menos una vez en este nivel", reward:"La Señal de Rango te cuesta 1 pt en vez de 2 por el resto del juego" },
  { id:2,  level:"Level 1", cost:"1 pt",  type:"Economy",       condition:"Juega tu primera carta dentro de los primeros 30 segundos", reward:"+1 punto extra cada vez que seas el primero en jugar en un nivel" },
  { id:3,  level:"Level 1", cost:"1 pt",  type:"Structure",     condition:"Sé quien juegue la carta raíz del árbol", reward:"Cuando juegues la raíz ganas +3 pts en vez de +2" },
  { id:4,  level:"Level 1", cost:"1 pt",  type:"Structure",     condition:"Coloca correctamente las dos hojas del lado izquierdo", reward:"Una vez por partida puedes mover una carta jugada a una casilla vacía adyacente" },
  { id:5,  level:"Level 1", cost:"1 pt",  type:"Economy",       condition:"Termina el nivel con al menos 3 puntos personales", reward:"Gana 2 puntos extra al inicio del próximo nivel" },
  { id:6,  level:"Level 1", cost:"1 pt",  type:"Communication", condition:"Tén 3 Clases diferentes en tu mano al inicio de una ronda", reward:"Una vez por nivel puedes revelar el icono de Clase de una carta gratis" },
  { id:7,  level:"Level 1", cost:"1 pt",  type:"Structure",     condition:"Juega una carta Familiar inmediatamente seguida de otra Familiar", reward:"Tus cartas Familiar otorgan +1 punto extra cuando activan su efecto" },
  { id:8,  level:"Level 1", cost:"1 pt",  type:"Economy",       condition:"Completa el nivel sin gastar puntos en habilidades pagas", reward:"Gana 3 puntos extra inmediatamente" },
  { id:9,  level:"Level 1", cost:"1 pt",  type:"Communication", condition:"No uses ninguna señal durante el nivel", reward:"Tu primera señal de cada nivel no cuenta como tu acción de señal" },
  { id:10, level:"Level 1", cost:"1 pt",  type:"Structure",     condition:"Coloca una carta Ordenada como nodo secuencial", reward:"Las cartas Ordenadas otorgan +2 pts en vez de +1 por el resto del juego" },
  { id:11, level:"Level 1", cost:"2 pts", type:"Communication", condition:"Completa el nivel sin usar ninguna señal", reward:"Desbloquea la Señal de Manada sin necesidad de la misión colectiva" },
  { id:12, level:"Level 1", cost:"2 pts", type:"Economy",       condition:"Completa el nivel sin que el pozo pierda vidas", reward:"El grupo gana 1 vida al inicio del Nivel 3 del juego" },
  { id:13, level:"Level 1", cost:"2 pts", type:"Structure",     condition:"Coloca correctamente todas las hojas del árbol", reward:"Gana 2 puntos extra cada vez que completes todas las hojas" },
  { id:14, level:"Level 1", cost:"2 pts", type:"Communication", condition:"Completa el nivel con exactamente 1 señal usada por todo el grupo", reward:"Tus señales pueden indicar si una carta está en la mitad superior o inferior" },
  { id:15, level:"Level 1", cost:"2 pts", type:"Economy",       condition:"Termina la ronda sin haber usado la Señal de Rango", reward:"Gana 1 punto extra al inicio de la próxima ronda" },
  { id:16, level:"Level 2", cost:"1 pt",  type:"Structure",     condition:"Coloca correctamente toda la base de la pirámide", reward:"Roba 1 carta extra al inicio de los próximos dos niveles" },
  { id:17, level:"Level 2", cost:"1 pt",  type:"Communication", condition:"Usa la Señal de Manada por primera vez en este nivel", reward:"Cuando uses Señal de Manada, otro jugador también puede revelar su Clase gratis" },
  { id:18, level:"Level 2", cost:"1 pt",  type:"Structure",     condition:"Completa una familia completa (misma Clase) dentro de la pirámide", reward:"Cada familia completa otorga +1 punto extra" },
  { id:19, level:"Level 2", cost:"1 pt",  type:"Economy",       condition:"Termina el nivel sin comprar ninguna habilidad paga", reward:"Gana 2 puntos extra al inicio del próximo nivel" },
  { id:20, level:"Level 2", cost:"1 pt",  type:"Communication", condition:"Tén 4 o más cartas de la misma personalidad en mano", reward:"Una vez por nivel revela la personalidad de cualquier carta en tu mano" },
  { id:21, level:"Level 2", cost:"2 pts", type:"Communication", condition:"Usa al menos 2 señales diferentes durante el nivel", reward:"Desbloquea la Señal de Color sin necesidad de la misión colectiva" },
  { id:22, level:"Level 2", cost:"2 pts", type:"Structure",     condition:"Coloca correctamente las 3 filas superiores de la pirámide", reward:"Cuando juegues el ápice ganas +3 pts" },
  { id:23, level:"Level 2", cost:"2 pts", type:"Economy",       condition:"Acumula 10 o más puntos PERSONALES al final de este nivel", reward:"El costo de todas tus habilidades pagas se reduce en 1 pt (mínimo 1)" },
  { id:24, level:"Level 2", cost:"2 pts", type:"Communication", condition:"Completa el nivel sin usar señales de tipo Rango", reward:"La Señal de Mediana te cuesta 1 pt en vez de requerir desbloqueo colectivo" },
  { id:25, level:"Level 2", cost:"3 pts", type:"Economy",       condition:"Completa los primeros 2 niveles con al menos 15 puntos PERSONALES acumulados", reward:"El costo de ganar vidas del pozo baja de 3 a 2 pts" },
  { id:26, level:"Level 3", cost:"1 pt",  type:"Communication", condition:"Usa la Señal de Mediana por primera vez en este nivel", reward:"La Señal de Mediana ya no usa tu acción de señal esta ronda" },
  { id:27, level:"Level 3", cost:"1 pt",  type:"Economy",       condition:"Juega todas tus cartas sin descartar ni robar de nuevo", reward:"Roba 2 cartas extra al inicio del próximo nivel" },
  { id:28, level:"Level 3", cost:"1 pt",  type:"Structure",     condition:"Completa dos familias diferentes dentro del mismo árbol", reward:"Las familias completas otorgan +2 pts en vez de +1" },
  { id:29, level:"Level 3", cost:"1 pt",  type:"Communication", condition:"Sé el jugador que más señales usa durante el nivel", reward:"Puedes usar cualquier señal una vez por nivel sin costo de puntos" },
  { id:30, level:"Level 3", cost:"1 pt",  type:"Economy",       condition:"Termina el nivel con exactamente 0 cartas en mano", reward:"Roba 1 carta extra además del mínimo al inicio de cada nivel" },
  { id:31, level:"Level 3", cost:"2 pts", type:"Structure",     condition:"Completa el nivel sin usar la Retirada Estratégica", reward:"Si algún árbol se completa con 0 nodos vacíos ganas 4 pts extra" },
  { id:32, level:"Level 3", cost:"2 pts", type:"Economy",       condition:"Completa los primeros 3 niveles con al menos 15 puntos PERSONALES acumulados", reward:"El costo de ganar vidas del pozo baja de 3 a 2 pts" },
  { id:33, level:"Level 3", cost:"3 pts", type:"Structure",     condition:"Completa los Niveles 3 y 4 sin Retirada Estratégica", reward:"Una vez por partida reorganiza 3 cartas ya jugadas a posiciones válidas" },
  { id:34, level:"Level 3", cost:"3 pts", type:"Economy",       condition:"Llega al Nivel 5 con el pozo en su máximo inicial", reward:"El grupo empieza el Nivel 5 con 2 vidas extra" },
  { id:35, level:"Level 4", cost:"2 pts", type:"Communication", condition:"Usa las 4 señales diferentes en el mismo nivel", reward:"Puedes usar todas las señales sin costo una vez por nivel el resto del juego" },
  { id:36, level:"Level 4", cost:"2 pts", type:"Economy",       condition:"Juega la primera carta del nivel antes que cualquier otro jugador", reward:"Ganas +2 pts cada vez que seas el primero en jugar en un nivel" },
  { id:37, level:"Level 4", cost:"2 pts", type:"Structure",     condition:"Coloca correctamente el ápice de la pirámide en este nivel", reward:"El ápice cuenta como dos nodos completados para el cálculo de penalización de vidas" },
  { id:38, level:"Level 4", cost:"3 pts", type:"Structure",     condition:"Completa dos pirámides sin perder vidas en ninguna", reward:"En niveles Pirámide la penalización de vidas por nodos incompletos se reduce a la mitad" },
  { id:39, level:"Level 4", cost:"3 pts", type:"Economy",       condition:"Completa los primeros 4 niveles con al menos 20 puntos PERSONALES acumulados", reward:"Puedes comprar vidas del pozo por 2 pts en vez de 3" },
  { id:40, level:"Level 4", cost:"4 pts", type:"Communication", condition:"Completa los primeros 4 niveles usando solo señales gratuitas", reward:"Una vez por partida puedes decir en voz alta el rango exacto de tu mano" },
  { id:41, level:"Level 4", cost:"4 pts", type:"Structure",     condition:"Completa los primeros 4 niveles sin perder ninguna vida", reward:"Una vez por partida puedes rejugar un nivel sin Retirada y sin penalización" },
  { id:42, level:"Level 4", cost:"4 pts", type:"Economy",       condition:"Acumula 30 pts PERSONALES antes de empezar el Nivel 5", reward:"Ganas 8 pts inmediatamente y reduces el costo de tus habilidades en 1" },
];

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildMissionPool() {
  const byLevel = { "Level 1": [], "Level 2": [], "Level 3": [], "Level 4": [] };
  for (const m of MISSIONS) byLevel[m.level].push(m);
  const pool = {};
  for (const [lvl, missions] of Object.entries(byLevel)) {
    pool[lvl] = shuffle(missions).slice(0, 3);
  }
  return pool;
}

// Expose globally too (matches Father's Day app pattern of window.X access
// for simpler cross-module calls without import juggling everywhere)
window.GameData = {
  buildDeck, PERSONALITY_INFO, LEVELS, cardsPerPlayer,
  DIFFICULTY, SIGNALS_UNLOCKABLE, MISSIONS, shuffle, buildMissionPool,
  TUTORIAL_LEVELS, TUTORIAL_PHASE_INFO, TUTORIAL_DIFFICULTY, personalityPower,
};
