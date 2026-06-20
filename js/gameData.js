// ════════════════════════════════════════════════════════════════
// GAME DATA — Cartas, misiones, niveles, dificultad
// ════════════════════════════════════════════════════════════════

const TYPES = ["Blue","Red","Green","Yellow","Purple","Orange","Pink","Black","White","Gray"];
const CLASSES = ["Dog","Cat","Bear","Rabbit","Rat","Cow","Tiger","Lion","Shark","Sparrow"];

const PERSONALITY_DIST = {
  Familiar:    [1,2,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73],
  Hyperactive: [3,6,12,21,42,51,57,84],
  Shy:         [9,18,27,33,36,39,45,54,63,66,69,72,78,81,87,90,93,99],
  Orderly:     [5,10,15,20,25,30,35,40,50,55,60,65,70,75,85,95,100],
  Loud:        [8,16,24,32,44,48,56,64,76,80,88,96],
  Common:      [], // filled below
};

function buildPersonalityMap() {
  const assigned = new Set([
    ...PERSONALITY_DIST.Familiar, ...PERSONALITY_DIST.Hyperactive,
    ...PERSONALITY_DIST.Shy, ...PERSONALITY_DIST.Orderly, ...PERSONALITY_DIST.Loud,
  ]);
  for (let n = 1; n <= 100; n++) if (!assigned.has(n)) PERSONALITY_DIST.Common.push(n);

  const map = {};
  for (const [pers, nums] of Object.entries(PERSONALITY_DIST)) {
    for (const n of nums) map[n] = pers;
  }
  return map;
}
const PERSONALITY_MAP = buildPersonalityMap();

export function buildDeck() {
  return Array.from({ length: 100 }, (_, i) => {
    const n = i + 1;
    const typeIdx = (n - 1) % 10;
    const classIdx = Math.floor((n - 1) / 10);
    return {
      id: n,
      number: n,
      type: TYPES[typeIdx],
      cardClass: CLASSES[classIdx],
      personality: PERSONALITY_MAP[n] || "Common",
    };
  });
}

export const PERSONALITY_INFO = {
  Familiar:    "Si juegas dos cartas Familiar consecutivas, el siguiente jugador roba 1 carta",
  Hyperactive: "Se puede jugar inmediatamente después de cualquier carta, como si fuera la primera",
  Shy:         "No puede ser objetivo de señales de información de otros jugadores",
  Orderly:     "Si se coloca secuencialmente en el árbol, otorga +1 punto",
  Loud:        "Al jugarse, todos los jugadores revelan brevemente su carta más alta (3 segundos)",
  Common:      "Sin efecto especial. La más numerosa — estadísticamente predecible",
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

export function cardsPerPlayer(nodes, playerCount) {
  return Math.ceil(nodes / playerCount);
}

export const DIFFICULTY = {
  Easy:   { lives: 15, startPts: 3, rangeSignalCost: 0 },
  Normal: { lives: 12, startPts: 2, rangeSignalCost: 2 },
  Hard:   { lives:  9, startPts: 1, rangeSignalCost: 3 },
  Expert: { lives:  6, startPts: 0, rangeSignalCost: 3 },
};

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
  { id:23, level:"Level 2", cost:"2 pts", type:"Economy",       condition:"Acumula 10 o más puntos al final de este nivel", reward:"El costo de todas tus habilidades pagas se reduce en 1 pt (mínimo 1)" },
  { id:24, level:"Level 2", cost:"2 pts", type:"Communication", condition:"Completa el nivel sin usar señales de tipo Rango", reward:"La Señal de Mediana te cuesta 1 pt en vez de requerir desbloqueo colectivo" },
  { id:25, level:"Level 2", cost:"3 pts", type:"Economy",       condition:"Completa los primeros 2 niveles con al menos 15 puntos acumulados", reward:"El costo de ganar vidas del pozo baja de 3 a 2 pts" },
  { id:26, level:"Level 3", cost:"1 pt",  type:"Communication", condition:"Usa la Señal de Mediana por primera vez en este nivel", reward:"La Señal de Mediana ya no usa tu acción de señal esta ronda" },
  { id:27, level:"Level 3", cost:"1 pt",  type:"Economy",       condition:"Juega todas tus cartas sin descartar ni robar de nuevo", reward:"Roba 2 cartas extra al inicio del próximo nivel" },
  { id:28, level:"Level 3", cost:"1 pt",  type:"Structure",     condition:"Completa dos familias diferentes dentro del mismo árbol", reward:"Las familias completas otorgan +2 pts en vez de +1" },
  { id:29, level:"Level 3", cost:"1 pt",  type:"Communication", condition:"Sé el jugador que más señales usa durante el nivel", reward:"Puedes usar cualquier señal una vez por nivel sin costo de puntos" },
  { id:30, level:"Level 3", cost:"1 pt",  type:"Economy",       condition:"Termina el nivel con exactamente 0 cartas en mano", reward:"Roba 1 carta extra además del mínimo al inicio de cada nivel" },
  { id:31, level:"Level 3", cost:"2 pts", type:"Structure",     condition:"Completa el nivel sin usar la Retirada Estratégica", reward:"Si algún árbol se completa con 0 nodos vacíos ganas 4 pts extra" },
  { id:32, level:"Level 3", cost:"2 pts", type:"Economy",       condition:"Completa los primeros 3 niveles con al menos 15 puntos acumulados", reward:"El costo de ganar vidas del pozo baja de 3 a 2 pts" },
  { id:33, level:"Level 3", cost:"3 pts", type:"Structure",     condition:"Completa los Niveles 3 y 4 sin Retirada Estratégica", reward:"Una vez por partida reorganiza 3 cartas ya jugadas a posiciones válidas" },
  { id:34, level:"Level 3", cost:"3 pts", type:"Economy",       condition:"Llega al Nivel 5 con el pozo en su máximo inicial", reward:"El grupo empieza el Nivel 5 con 2 vidas extra" },
  { id:35, level:"Level 4", cost:"2 pts", type:"Communication", condition:"Usa las 4 señales diferentes en el mismo nivel", reward:"Puedes usar todas las señales sin costo una vez por nivel el resto del juego" },
  { id:36, level:"Level 4", cost:"2 pts", type:"Economy",       condition:"Juega la primera carta del nivel antes que cualquier otro jugador", reward:"Ganas +2 pts cada vez que seas el primero en jugar en un nivel" },
  { id:37, level:"Level 4", cost:"2 pts", type:"Structure",     condition:"Coloca correctamente el ápice de la pirámide en este nivel", reward:"El ápice cuenta como dos nodos completados para el cálculo de penalización de vidas" },
  { id:38, level:"Level 4", cost:"3 pts", type:"Structure",     condition:"Completa dos pirámides sin perder vidas en ninguna", reward:"En niveles Pirámide la penalización de vidas por nodos incompletos se reduce a la mitad" },
  { id:39, level:"Level 4", cost:"3 pts", type:"Economy",       condition:"Completa los primeros 4 niveles con al menos 20 puntos acumulados", reward:"Puedes comprar vidas del pozo por 2 pts en vez de 3" },
  { id:40, level:"Level 4", cost:"4 pts", type:"Communication", condition:"Completa los primeros 4 niveles usando solo señales gratuitas", reward:"Una vez por partida puedes decir en voz alta el rango exacto de tu mano" },
  { id:41, level:"Level 4", cost:"4 pts", type:"Structure",     condition:"Completa los primeros 4 niveles sin perder ninguna vida", reward:"Una vez por partida puedes rejugar un nivel sin Retirada y sin penalización" },
  { id:42, level:"Level 4", cost:"4 pts", type:"Economy",       condition:"Acumula 30 pts antes de empezar el Nivel 5", reward:"Ganas 8 pts inmediatamente y reduces el costo de tus habilidades en 1" },
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
};
