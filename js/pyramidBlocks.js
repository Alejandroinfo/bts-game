// ════════════════════════════════════════════════════════════════
// PYRAMID BLOCKS — Sistema de bloques flotantes con anclaje
// progresivo para la estructura de Pirámide.
//
// PROBLEMA QUE RESUELVE:
// En una pirámide construida dinámicamente (sin posiciones de heap
// fijas desde el inicio), un valor nuevo puede caer "entre" dos
// valores ya colocados sin que aún se sepa si ese par terminará en
// el lado izquierdo o derecho de la fila final. Por ejemplo: jugar
// 15, luego 25 (sube como hijo de 15... pero ¿con qué?), no se
// puede resolver hasta que el contexto se complete.
//
// MODELO:
// Cada fila es una lista de "bloques" ordenados de izquierda a
// derecha. Un bloque representa un grupo de valores que YA se sabe
// que son consecutivos entre sí en la fila final, pero cuya
// posición ABSOLUTA (empezando desde la izquierda de toda la fila)
// puede seguir sin determinarse hasta que la fila se complete o
// hasta que el bloque choque contra un límite.
//
// block = {
//   id: string único,
//   values: [v1, v2, ...] valores ordenados de este bloque (los que
//           son "hojas" de este bloque en ESTA fila),
//   childValue: number | null,  // el valor que subió como hijo de
//                                 este bloque (si ya se fusionó),
//   childBlockId: string | null, // id del bloque correspondiente
//                                 en la fila de arriba
// }
//
// pyramid = {
//   rows: [ [block, block, ...], [block, ...], ... ], // fila 0 = base
//   height: number,
//   maxSlotsPerRow: [n0, n1, ...], // cuántos slots tiene cada fila
// }
// ════════════════════════════════════════════════════════════════

let _blockIdCounter = 0;
function newBlockId() {
  return "b" + (_blockIdCounter++);
}

function createEmptyPyramid(height) {
  const rows = [];
  const maxSlotsPerRow = [];
  for (let r = 0; r < height; r++) {
    rows.push([]);
    maxSlotsPerRow.push(Math.pow(2, height - 1 - r));
  }
  return { rows, height, maxSlotsPerRow };
}

function rowMinValue(row) {
  return row[0].values[0];
}
function rowMaxValue(row) {
  const last = row[row.length - 1];
  return last.values[last.values.length - 1];
}

// Intenta insertar `value` en la fila `rowIndex`. Devuelve:
//   { ok: true, childValue: number|null, childGoesInRow: number }
//   { ok: false }
// Si el valor genera un hijo (fusiona dos bloques de tamaño 1), se
// devuelve childValue para que el llamador intente insertarlo en la
// fila de arriba recursivamente.
function tryInsertInRow(pyramid, rowIndex, value) {
  const row = pyramid.rows[rowIndex];
  const maxSlots = pyramid.maxSlotsPerRow[rowIndex];
  const currentSlots = row.reduce((sum, b) => sum + b.values.length, 0);

  if (row.length === 0) {
    const block = { id: newBlockId(), values: [value], childValue: null, childBlockId: null };
    row.push(block);
    return { ok: true, childValue: null, parentBlockId: null };
  }

  const minVal = rowMinValue(row);
  const maxVal = rowMaxValue(row);

  if (value < minVal) {
    if (currentSlots >= maxSlots) return { ok: false };
    const block = { id: newBlockId(), values: [value], childValue: null, childBlockId: null };
    row.unshift(block);
    return { ok: true, childValue: null, parentBlockId: null };
  }

  if (value > maxVal) {
    if (currentSlots >= maxSlots) return { ok: false };
    const block = { id: newBlockId(), values: [value], childValue: null, childBlockId: null };
    row.push(block);
    return { ok: true, childValue: null, parentBlockId: null };
  }

  let accIdx = 0;
  for (let i = 0; i < row.length - 1; i++) {
    const left = row[i];
    const right = row[i + 1];
    const leftEndIdx = accIdx + left.values.length - 1;
    accIdx += left.values.length;

    if (leftEndIdx % 2 !== 0) continue;

    const leftMax = left.values[left.values.length - 1];
    const rightMin = right.values[0];

    if (value > leftMax && value < rightMin) {
      if (left.childValue !== null || right.childValue !== null) continue;

      const merged = {
        id: newBlockId(),
        values: [...left.values, ...right.values],
        childValue: value,
        childBlockId: null
      };

      row.splice(i, 2, merged);

      return { ok: true, childValue: value, parentBlockId: merged.id };
    }
  }

  return { ok: false };
}


// Inserta un valor en la pirámide completa, empezando por la base
// (fila 0) y subiendo recursivamente si genera hijos.
// Devuelve { ok: bool }.
function deepCloneRows(rows) {
  return rows.map(row => row.map(block => ({ ...block, values: [...block.values] })));
}

// Variante de tryInsertInRow que SOLO intenta el Caso 4 (fusión).
// Se usa cuando un valor "rebota" hacia una fila superior porque la
// base (u otra fila inferior) lo rechazó — en ese caso, el valor
// JAMÁS puede convertirse en "primera carta" o "extremo" de la fila
// superior (eso solo es legítimo para valores que llegan como hijo
// real de una fusión, nunca para un valor que viene directamente
// del jugador intentando una fila a la que no le corresponde entrar
// como hoja).
function tryFusionOnlyInRow(pyramid, rowIndex, value) {
  const row = pyramid.rows[rowIndex];
  if (row.length < 2) return { ok: false };

  let accIdx = 0;
  for (let i = 0; i < row.length - 1; i++) {
    const left = row[i];
    const right = row[i + 1];
    const leftEndIdx = accIdx + left.values.length - 1;
    accIdx += left.values.length;

    if (leftEndIdx % 2 !== 0) continue;

    const leftMax = left.values[left.values.length - 1];
    const rightMin = right.values[0];

    if (value > leftMax && value < rightMin) {
      if (left.childValue !== null || right.childValue !== null) continue;

      const merged = {
        id: newBlockId(),
        values: [...left.values, ...right.values],
        childValue: value,
        childBlockId: null
      };

      row.splice(i, 2, merged);

      return { ok: true, childValue: value, parentBlockId: merged.id };
    }
  }

  return { ok: false };
}

function insertValue(pyramid, value) {
  // SIEMPRE se empieza a intentar desde la base (row 0), con todas
  // las reglas normales (hoja suelta, extremo, o fusión). Si la
  // base RECHAZA el valor por completo, se prueba si el valor
  // "rebota" hacia arriba: en las filas superiores SOLO se permite
  // la fusión (Caso 4) con bloques que YA existen ahí (hijos de
  // fusiones previas) — nunca como primera carta o extremo, porque
  // eso solo es legítimo para hijos que suben naturalmente desde
  // abajo, no para un valor que el jugador intenta meter "a la
  // fuerza" en una fila que no le corresponde como hoja.
  const rowsCopy = deepCloneRows(pyramid.rows);
  const testPyramid = { rows: rowsCopy, height: pyramid.height, maxSlotsPerRow: pyramid.maxSlotsPerRow };

  // Intento 1: flujo normal completo empezando en la base
  if (tryNormalCascade(testPyramid, 0, value)) {
    pyramid.rows = rowsCopy;
    return { ok: true };
  }

  // Intento 2: rebote — probar fusión-únicamente en cada fila
  // superior sucesiva, sobre una copia fresca cada vez.
  for (let startRow = 1; startRow < pyramid.height; startRow++) {
    const rowsCopy2 = deepCloneRows(pyramid.rows);
    const testPyramid2 = { rows: rowsCopy2, height: pyramid.height, maxSlotsPerRow: pyramid.maxSlotsPerRow };
    const result = tryFusionOnlyInRow(testPyramid2, startRow, value);
    if (result.ok) {
      if (tryNormalCascadeFromResult(testPyramid2, startRow, result)) {
        pyramid.rows = rowsCopy2;
        return { ok: true };
      }
    }
  }

  return { ok: false };
}

// Ejecuta la cascada normal (hoja, extremo, o fusión) empezando en
// `startRow` con `value`. Devuelve true/false. Muta `pyramid` in-place.
function tryNormalCascade(pyramid, startRow, value, parentBlockId = null) {
  let currentRow = startRow;
  let currentValue = value;
  let currentParent = parentBlockId;

  while (currentRow < pyramid.height) {
    const result = tryInsertInRow(pyramid, currentRow, currentValue);
    if (!result.ok) return false;

    if (currentParent !== null) {
      const belowRow = pyramid.rows[currentRow - 1];
      const parentBlock = belowRow.find(b => b.id === currentParent);

      const childBlock = pyramid.rows[currentRow].find(b =>
        b.values.includes(currentValue) ||
        b.childValue === currentValue
      );

      if (parentBlock && childBlock) {
        parentBlock.childBlockId = childBlock.id;
      }
    }

    if (result.childValue === null) return true;

    currentParent = result.parentBlockId;
    currentValue = result.childValue;
    currentRow++;
  }

  return true;
}

// Continúa la cascada hacia arriba después de que un rebote ya
// generó un hijo en `startRow` (resultado `firstResult`).
function tryNormalCascadeFromResult(pyramid, startRow, firstResult) {
  return tryNormalCascade(
    pyramid,
    startRow + 1,
    firstResult.childValue,
    firstResult.parentBlockId
  );
}


// ────────────────────────────────────────────────────────────────
// RESOLUCIÓN DE POSICIONES DE HEAP
// ────────────────────────────────────────────────────────────────
// Una vez que se quiere conocer el "board" plano (para renderizar o
// guardar en Firebase), se recorre cada fila de abajo hacia arriba.
// Si una fila tiene TODOS sus bloques (suma de values == maxSlots),
// su orden izquierda->derecha YA define posiciones de heap fijas
// para esa fila. Si una fila NO está completa, sus bloques pueden
// no tener posición determinable aún -> se devuelven como "pending"
// y no se incluyen en el board (la carta del hijo tampoco, porque
// depende de la posición del bloque padre).

function getRowHeapPositions(height, rowIndexFromBase) {
  const depthFromTop = height - 1 - rowIndexFromBase;
  const start = Math.pow(2, depthFromTop);
  const end = Math.pow(2, depthFromTop + 1) - 1;
  const positions = [];
  for (let p = start; p <= end; p++) positions.push(p);
  return positions;
}

// Convierte la pirámide de bloques a un board plano {pos: card}.
// cardLookup: function(value) => card object (para reconstruir el
// objeto completo de carta, no solo el número).
function resolveToBoard(pyramid, cardLookup) {
  const board = {};
  const pending = []; // valores que no se pudieron anclar (informativo)

  for (let r = 0; r < pyramid.height; r++) {
    const row = pyramid.rows[r];
    const maxSlots = pyramid.maxSlotsPerRow[r];
    const filledSlots = row.reduce((sum, b) => sum + b.values.length, 0);
    const heapPositions = getRowHeapPositions(pyramid.height, r);

    if (filledSlots < maxSlots) {
      // Fila incompleta: NO se puede anclar con certeza. Caso
      // especial: si solo hay 1 bloque y maxSlots==1 (fila trivial,
      // como el ápice), sí se puede anclar directamente.
      if (maxSlots === 1 && row.length === 1) {
        const v = row[0].values[0];
        board[String(heapPositions[0])] = cardLookup(v);
      } else {
        for (const b of row) pending.push(...b.values);
      }
      continue;
    }

    // Fila completa -> anclaje directo, izquierda a derecha
    let posIdx = 0;
    for (const block of row) {
      for (const v of block.values) {
        board[String(heapPositions[posIdx])] = cardLookup(v);
        posIdx++;
      }
    }
  }

  return { board, pending };
}

// ────────────────────────────────────────────────────────────────
// RESOLUCIÓN PROVISIONAL (solo para mostrar en pantalla)
// ────────────────────────────────────────────────────────────────
// A diferencia de resolveToBoard (que es estricta y solo ancla filas
// 100% completas), esta función SIEMPRE asigna una posición visual
// a cada bloque, aunque la fila no esté llena. Las cartas se centran
// dentro de los slots disponibles de esa fila, en su orden lógico
// izquierda->derecha. Esto es solo para que el jugador vea algo
// mientras la base se completa — NO se debe usar para validar
// nuevas jugadas (usar resolveToBoard para eso).
function resolveProvisional(pyramid, cardLookup) {
  const board = {};

  for (let r = 0; r < pyramid.height; r++) {
    const row = pyramid.rows[r];
    if (row.length === 0) continue;

    const maxSlots = pyramid.maxSlotsPerRow[r];
    const filledSlots = row.reduce((sum, b) => sum + b.values.length, 0);
    const heapPositions = getRowHeapPositions(pyramid.height, r);

    // Centrar el grupo de bloques dentro de los slots disponibles
    const startOffset = Math.floor((maxSlots - filledSlots) / 2);

    let posIdx = startOffset;
    for (const block of row) {
      for (const v of block.values) {
        const heapPos = heapPositions[posIdx];
        if (heapPos !== undefined) board[String(heapPos)] = cardLookup(v);
        posIdx++;
      }
    }
  }

  return board;
}

// ────────────────────────────────────────────────────────────────
// LAYOUT VISUAL PROVISIONAL — para mostrar algo en pantalla incluso
// antes de que una fila esté completamente anclada. Cada fila se
// devuelve como una lista de celdas ordenadas de izquierda a
// derecha (por el orden lógico actual de los bloques), cada una
// con su valor y si esa fila ya está anclada definitivamente.
//
// Esto es solo para RENDER — la fuente de verdad de posiciones de
// heap reales sigue siendo resolveToBoard, que se usa para guardar
// en Firebase y para toda la lógica de juego.
// ────────────────────────────────────────────────────────────────
function resolveToVisualLayout(pyramid, cardLookup) {
  const rows = [];
  for (let r = 0; r < pyramid.height; r++) {
    const row = pyramid.rows[r];
    const maxSlots = pyramid.maxSlotsPerRow[r];
    const filledSlots = row.reduce((sum, b) => sum + b.values.length, 0);
    const anchored = filledSlots >= maxSlots;

    const cells = [];
    for (const block of row) {
      for (const v of block.values) {
        cells.push({ value: v, card: cardLookup(v), anchored });
      }
    }
    rows.push({ cells, anchored, maxSlots });
  }
  return rows;
}

// ────────────────────────────────────────────────────────────────
// API simplificada para uso externo: simula jugar una secuencia de
// valores y devuelve el board final + qué falló (si algo falló).
// ────────────────────────────────────────────────────────────────
function buildPyramidFromSequence(height, sequence) {
  const pyramid = createEmptyPyramid(height);
  const results = [];
  for (const value of sequence) {
    const res = insertValue(pyramid, value);
    results.push({ value, ok: res.ok });
  }
  const { board, pending } = resolveToBoard(pyramid, (v) => ({ number: v }));
  return { pyramid, results, board, pending };
}

// ────────────────────────────────────────────────────────────────
// SERIALIZACIÓN SEGURA PARA FIREBASE
// ────────────────────────────────────────────────────────────────
// Firebase Realtime Database ELIMINA arrays vacíos anidados al
// guardarlos (los trata como null/ausentes). La estructura interna
// de `pyramid.rows` es un array de arrays, que frecuentemente
// contiene filas vacías ([]) — esto corrompe el estado al guardarlo
// y volver a leerlo. Estas funciones convierten la estructura a una
// forma 100% segura (solo objetos con claves string, nunca arrays
// vacíos) antes de escribir a Firebase, y la reconstruyen al leer.

function serializePyramidForFirebase(pyramid) {
  const rowsObj = {};
  for (let r = 0; r < pyramid.rows.length; r++) {
    const row = pyramid.rows[r];
    if (row.length === 0) {
      rowsObj[String(r)] = { _empty: true };
    } else {
      const blocksObj = {};
      for (let i = 0; i < row.length; i++) {
        blocksObj[String(i)] = row[i];
      }
      rowsObj[String(r)] = { _empty: false, blocks: blocksObj, count: row.length };
    }
  }
  return {
    rows: rowsObj,
    height: pyramid.height,
    maxSlotsPerRow: pyramid.maxSlotsPerRow,
  };
}

function deserializePyramidFromFirebase(serialized) {
  if (!serialized || !serialized.rows) {
    // Estado nunca guardado todavía -> pirámide vacía nueva
    return null;
  }
  const height = serialized.height;
  const rows = [];
  for (let r = 0; r < height; r++) {
    const rowData = serialized.rows[String(r)];
    if (!rowData || rowData._empty) {
      rows.push([]);
    } else {
      const count = rowData.count || 0;
      const row = [];
      for (let i = 0; i < count; i++) {
        const block = rowData.blocks[String(i)];
        if (block) row.push(block);
      }
      rows.push(row);
    }
  }
  return { rows, height, maxSlotsPerRow: serialized.maxSlotsPerRow };
}

// ────────────────────────────────────────────────────────────────
// ORDERLY (Pirámide) — Calcula, SIN MUTAR el estado, cuáles son los
// valores vecinos lógicos relevantes de `value` si se insertara
// ahora en la base de la pirámide. Devuelve un array de números
// (puede tener 0, 1 o 2 elementos):
//   - El bloque inmediatamente a la izquierda y/o derecha de donde
//     value caería en la secuencia de la base (vecino lateral).
//   - Si value generaría una fusión (Caso 4), también se incluye el
//     valor que sería su HIJO directo en la fila de arriba, si esa
//     posición ya tiene un bloque colocado ahí (vecino por fusión
//     ya existente, poco común pero posible si ese hijo se jugó
//     "rebotando" antes de que el padre se confirmara).
//
// Esta función es de solo lectura — se usa para el bono de puntos,
// nunca para decidir si la jugada es válida (eso lo decide
// tryInsertInRow/insertValue, que sigue siendo la única fuente de
// verdad sobre si la carta cabe).
// ────────────────────────────────────────────────────────────────
// Cuenta cuántas cartas en total ya están colocadas en TODAS las
// filas (sin importar si están ancladas o solo flotando). Útil para
// el límite dinámico de la pila de Shy, que necesita saber cuántos
// espacios totales quedan vacíos en la pirámide completa.
function countFilledCards(pyramid) {
  let total = 0;
  for (const row of pyramid.rows) {
    for (const block of row) total += block.values.length;
  }
  return total;
}

function getOrderlyNeighbors(pyramid, value) {
  const neighbors = [];
  const row = pyramid.rows[0]; // Orderly solo mira la fila base, donde se insertan las cartas nuevas

  if (!row || row.length === 0) return neighbors;

  const minVal = rowMinValue(row);
  const maxVal = rowMaxValue(row);

  if (value < minVal) {
    neighbors.push(row[0].values[0]); // el que era el extremo izquierdo
    return neighbors;
  }
  if (value > maxVal) {
    const last = row[row.length - 1];
    neighbors.push(last.values[last.values.length - 1]); // extremo derecho anterior
    return neighbors;
  }

  // Buscar entre qué dos bloques caería (vecino lateral en ambos lados)
  for (let i = 0; i < row.length - 1; i++) {
    const left = row[i];
    const right = row[i + 1];
    const leftMax = left.values[left.values.length - 1];
    const rightMin = right.values[0];
    if (value > leftMax && value < rightMin) {
      neighbors.push(leftMax, rightMin);
      break;
    }
  }

  return neighbors;
}

// ────────────────────────────────────────────────────────────────
// SHY (Pirámide) — Libera la pila completa en orden LIFO, igual que
// la versión de BST (ver gameLogic.js resolveShyStack), pero usando
// insertValue del sistema de bloques en vez de un heap fijo. Cada
// carta liberada se intenta insertar en el momento de liberarse; si
// para entonces ya no tiene espacio válido, se descarta.
//
// stack = [{ playerId, cardId, card }, ...], el último elemento es
// el que se libera PRIMERO (LIFO).
// Devuelve { placements: [{ card, playerId, cardId }], discarded, finalPyramid }.
// No muta `pyramid` — trabaja sobre una copia interna.
// ────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────
// HYPERACTIVE (Pirámide) — Simula que la carta se jugó ANTES que la
// última carta NO-Hyperactiva colocada, usando un SNAPSHOT del
// estado de bloques justo antes de aplicar esa última jugada normal
// (en vez de intentar "deshacer" una fusión, lo cual no es posible
// sin guardar más historial — ver la explicación completa en la
// guía técnica).
//
// Soporta CADENAS de Hyperactive consecutivas: si se juegan varias
// Hyperactive una tras otra sin que nadie juegue una carta normal de
// por medio, cada nueva Hyperactiva se inserta ANTES que todas las
// anteriores de la cadena, simulando el orden completo invertido.
// Ejemplo: 15(normal), 20(hyper), 40(hyper) se simula como si el
// orden real hubiera sido 40, 20, 15.
//
// stateBeforeLast: el pyramidState justo antes de la última carta
//   NO-Hyperactiva jugada (se mantiene FIJO mientras se acumulen
//   Hyperactive consecutivas — nunca avanza hasta que se juegue una
//   carta normal de nuevo).
// hyperValue: el número de la carta Hyperactiva que se está jugando ahora.
// chain: array de valores Hyperactive ya jugados en esta cadena, en
//   el orden en que se jugaron (el más antiguo primero). Vacío si
//   esta es la primera Hyperactiva de la cadena.
// lastNonHyperValue: el número de la última carta NO-Hyperactiva
//   jugada (el "ancla" final de la cadena).
//
// Devuelve null si no es válido, o { finalPyramid } si sí lo es.
// No muta ningún estado de entrada.
// ────────────────────────────────────────────────────────────────
function tryHyperactiveReorderPyramid(stateBeforeLast, hyperValue, chain, lastNonHyperValue) {
  const working = JSON.parse(JSON.stringify(stateBeforeLast));

  // Orden de inserción: la Hyperactiva nueva primero, luego la
  // cadena existente (que YA está en orden "más reciente primero",
  // ver cómo se construye en gameRoom.js: [card.number, ...existingChain]),
  // y al final el ancla no-Hyperactiva.
  const insertionOrder = [hyperValue, ...chain, lastNonHyperValue];

  for (const value of insertionOrder) {
    const result = insertValue(working, value);
    if (!result.ok) return null;
  }

  return { finalPyramid: working };
}

function resolveShyStackPyramid(pyramid, stack) {
  const placements = [];
  const discarded = [];
  let workingPyramid = JSON.parse(JSON.stringify(pyramid));

  for (let i = stack.length - 1; i >= 0; i--) {
    const entry = stack[i];
    const result = insertValue(workingPyramid, entry.card.number);
    if (!result.ok) {
      discarded.push(entry);
    } else {
      placements.push({ card: entry.card, playerId: entry.playerId, cardId: entry.cardId });
    }
  }

  return { placements, discarded, finalPyramid: workingPyramid };
}

window.PyramidBlocks = {
  createEmptyPyramid, insertValue, tryInsertInRow,
  resolveToBoard, resolveProvisional, getRowHeapPositions,
  buildPyramidFromSequence, getOrderlyNeighbors, countFilledCards,
  resolveShyStackPyramid, tryHyperactiveReorderPyramid,
  serializePyramidForFirebase, deserializePyramidFromFirebase,
};
