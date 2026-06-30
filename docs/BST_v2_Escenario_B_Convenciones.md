# BST Animals v2 — Convenciones técnicas para Escenario B (Revelación Tardía)

> Este documento NO es la spec de diseño del Escenario B (esa se está definiendo en su propio chat). Es un puente técnico: nombres de variables y estructura de datos que ya existen en el prototipo HTML (`bst-v2-selector.html`) para que, cuando la spec de B se cierre, el chat que la define pueda decir "usa estos mismos nombres" en vez de que alguien tenga que traducir después.

Si estás definiendo la spec de B en otro chat: pégale este documento a Claude ahí, junto con `BST_v2_Decisiones_Generales.md`.

---

## 1. Por qué existe este documento

El HTML ya implementa un selector Escenario A / Escenario B → nivel → tablero. Para A, los niveles están completamente definidos (`BST_v2_Escenario_A_InformacionMixta.md`). Para B, el HTML por ahora solo tiene una **estructura placeholder** con 2 niveles de ejemplo, usando nombres de variable consistentes con A donde el concepto es el mismo, y nombres nuevos donde B introduce algo que A no tiene (revelación condicionada, contradicción, vidas como margen).

Cuando la spec de B esté lista, lo ideal es que sus niveles se puedan describir con esta misma estructura de objeto, sin renombrar nada que ya exista.

---

## 2. Estructura de un nivel (objeto `LevelConfig`)

```js
{
  id: 11,                  // número de nivel, único cross-escenario (A usa 1-12, B debería seguir desde donde A termine, ej. 101+ para no chocar nunca, o el rango que prefieran)
  scenario: "B",           // "A" | "B"
  label: "B1 — ...",       // nombre corto mostrado en el selector

  // --- Estructura del tablero (compartido con A, mismos nombres) ---
  trees: [
    { type: "bst", height: 4 }      // type: "bst" | "pyramid"
    // un segundo objeto en el array = segundo árbol simultáneo, igual que en A
  ],

  // --- Cartas ---
  extraCards: 2,            // mismo concepto que en A: margen sobre el total de espacios
  freeCardsOnTable: 0,      // mismo concepto que en A: libres boca arriba, jugables por cualquiera

  // --- Campos específicos de A (no aplican a B, quedar en null/undefined está bien) ---
  hiddenFraction: null,     // en A: 0.2–0.8. En B no aplica (la mano no es híbrida en B)
  agency: null,             // en A: "any" | "fixedNeighbor" | "ownerAlways"

  // --- Campos específicos de B (nuevos, nombres propuestos — confirmar en la spec) ---
  revealThreshold: "twoChildren",  // condición para revelar una carta ya jugada. Placeholder: hoy solo existe "twoChildren" (la idea base del documento de decisiones generales). La spec de B puede agregar más valores aquí.
  contradictionPenalty: "discardInvolved", // qué pasa cuando se revela una contradicción. Placeholder actual: se descartan las cartas involucradas.
  livesMargin: 3            // vidas como margen de error para este nivel (no derrota instantánea). Número exacto pendiente de la spec de B.
}
```

**Por qué `hiddenFraction`/`agency` quedan en `null` para B:** en el Escenario A la dificultad se controla con "cuánto se oculta" + "quién puede jugar qué". En B, según la idea base, la mano de cada jugador es normal (sin mezcla) — la incertidumbre no viene de la mano, viene del **tablero**: una carta jugada no se revela hasta que tiene dos hijos. Si la spec de B termina necesitando algo equivalente a `agency` o `hiddenFraction`, mejor verificar en el chat de B si conceptualmente es lo mismo (y reusar el nombre) o es algo nuevo (y necesita nombre propio) antes de escribir código.

---

## 3. Conceptos de B que el HTML ya modela como UI, aunque la lógica de reglas no esté implementada

El HTML ya sabe **dibujar** lo siguiente, aunque las reglas que determinan cuándo pasa cada cosa todavía no están conectadas a ninguna lógica real de B:

- **Carta "jugada pero no revelada":** se renderiza en el tablero boca abajo, en su posición real del árbol (no en el queue — el queue es para antes de ejecutar, esto es post-ejecución pero pre-revelación). Variable en el HTML: `board[pos].revealed` (`true`/`false`). Mientras `revealed === false`, el valor de la carta no se muestra en pantalla aunque el HTML ya lo conoce internamente (para poder revelarlo después).
- **Conteo de hijos por nodo:** ya existe como función auxiliar (`countChildren(board, pos)`, reutilizando el heap-indexing de `findBSTPosition`) porque la condición base de revelación depende de esto. Si la spec de B define un umbral distinto a "dos hijos", esta función es el punto donde se conecta.
- **Contradicción:** el HTML tiene un evento `onReveal(pos)` que se dispara cuando una carta cumple la condición de revelación. Hoy ese evento solo muestra el valor; no valida si la carta "debía ir ahí" según las reglas de BST. La validación de contradicción y el descarte de cartas involucradas quedan sin implementar — son lo primero a conectar cuando la spec de B defina exactamente qué cuenta como contradicción.
- **Vidas como margen de error:** el HTML tiene un contador `sharedLives` visible en pantalla (mismo nombre que `sharedLives` en la estructura de Firebase de v1, ver `BST_Animals_Project_Knowledge.md` §13), pero ningún evento lo decrementa todavía para B.

---

## 4. Lo que la spec de B necesita definir para que esto deje de ser un placeholder

En orden de qué bloquea qué:

1. **Condición exacta de revelación** — ¿siempre "dos hijos", o varía por nivel/dificultad? (afecta `revealThreshold`)
2. **Qué exactamente es una "contradicción"** — ¿el valor revelado rompe el heap order respecto a sus vecinos ya revelados? ¿respecto a TODOS los nodos, revelados o no? Esto determina si `onReveal()` necesita ver todo el tablero o solo la vecindad inmediata.
3. **Qué cartas se descartan exactamente** — ¿solo la carta contradictoria, o también las que dependían de ella (sus hijos ya jugados)? Afecta cómo se implementa `contradictionPenalty`.
4. **Matriz de niveles** — misma lógica que A: variar estructura/profundidad y lo que sea el equivalente de dificultad en B (¿frecuencia de contradicciones esperada? ¿tamaño del árbol nada más?).
5. **Si existe algo como "agencia" o "% oculto" en B** — confirmar si aplica o si esos campos quedan permanentemente en `null` para este escenario.

---

## 5. Cómo cerrar el círculo

Cuando la spec de B esté lista en su chat:
1. Pedir ahí mismo que la spec quede en un .md con el mismo formato que `BST_v2_Escenario_A_InformacionMixta.md`.
2. Volver a este chat (o a uno con el HTML a mano) y pedir que se reemplace el placeholder de B por los niveles reales, usando esta misma estructura `LevelConfig`.
