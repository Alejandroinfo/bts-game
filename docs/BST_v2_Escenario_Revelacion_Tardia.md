# BST Animals v2 — Escenario B: Revelación Tardía

> Ver `BST_v2_Decisiones_Generales.md` para las decisiones transversales (mazo de 64, animales/colores en hold, habilidades en hold, sin sistema de puntos). Este escenario NO usa el sistema de queue del documento general — ver razón en sección 1. Cubre ambas familias mecánicas: BST (secciones 1-5) y Pirámide (sección 6) — cada una con su propia geometría y dirección de revelación, pero el mismo recurso de energía.

---

## 1. Concepto base

Cada jugador ve su propia mano con normalidad (sin mezcla con otros jugadores — a diferencia del Escenario A). Las cartas se juegan en el árbol de forma **simultánea y libre**: cada jugador juega cuando quiere, sin turnos ni fases de declaración.

**Por qué no usa queue:** el queue del documento general depende de que el orden de resolución se oculte hasta una fase de revelación posterior. En este escenario la incertidumbre ya vive en *el valor de las cartas en el tablero*, no en el orden de las jugadas — superponer ambos sería redundante y confuso. El orden real de juego (quién jugó qué y cuándo) es lo que determina las cascadas de revelación, así que necesita ser visible/secuencial, no oculto.

**Resolución de choques simultáneos (versión digital/Firebase):** se resuelve por orden de llegada al servidor — la primera jugada que el servidor procesa "gana" el espacio. Probabilidad de colisión real despreciable; no se diseña regla de desempate adicional.

**Secuenciación atómica de cada jugada:** cuando un jugador juega una carta, todo el proceso que dispara —revisar si algo se revela, validar contra el padre/fila, resolver contradicciones y descartes en cascada si los hay— ocurre como una sola unidad indivisible. **Ninguna acción de energía (robar, revelar, demoler) puede ejecutarse mientras ese proceso está en curso** — solo una vez que el tablero queda asentado después de la jugada. Esto evita ambigüedad sobre qué estado del tablero está viendo alguien que intenta reaccionar a mitad de una cascada.

---

## 2. Mecánica de revelación

Una carta jugada en el árbol queda oculta (boca abajo conceptualmente — solo el dueño original sabe qué jugó, si acaso lo recuerda) hasta que se cumplen **dos condiciones a la vez**:

1. El nodo tiene sus **dos hijos jugados** (los hijos en sí pueden seguir ocultos).
2. El **padre del nodo ya está revelado**.

La raíz no tiene padre, así que se revela en cuanto tiene sus dos hijos jugados — es la única condición de arranque para toda cascada.

**Cascada:** una sola jugada puede destrabar revelaciones en cadena. El orden de la cascada siempre es **de la raíz hacia las hojas** (top-down) — nunca de abajo hacia arriba. Si revelar un nodo padre destraba a un hijo que ya tenía sus propios hijos jugados, ese hijo se revela también en la misma cascada, y así sucesivamente.

---

## 3. Contradicción y descarte

Al revelarse un nodo, se compara su valor contra el de su padre (ya revelado) según la regla BST. Si el valor no es coherente con la posición (izquierda/derecha) que ocupa:

- **Se descarta el nodo que falló y todo su subárbol completo** (todos los descendientes de ese nodo, estén revelados o no).
- El padre que detectó la contradicción permanece revelado y válido — no se ve afectado.
- El/los espacios que quedan vacíos **vuelven a su estado inicial**: vacíos, sin restricción, jugables con total normalidad por cualquiera.
- Las cartas descartadas van a un **mazo de descarte aparte**, fuera de circulación normal. **No se reparten ni se roban automáticamente** — el grupo decide activamente si gasta energía en la acción "robar" (sección 4) para traer alguna de vuelta a una mano, o si intenta terminar el nivel con las cartas que ya tiene. Esto convierte el reabastecimiento en una decisión estratégica, no en un reciclaje pasivo.

---

## 4. Recurso compartido — Energía

Reemplaza al sistema de puntos (eliminado en v2). Es un recurso compartido por todo el grupo, con valor inicial configurable por nivel.

**Gasto por contradicción:**
- Cada carta descartada por una contradicción (el nodo que falló + cada carta de su subárbol) cuesta **1 punto de energía**.
- Energía llega a 0 → se pierde el nivel.

**Acciones que se pueden pagar con energía** (en cualquier momento, por cualquier jugador):

| Acción | Costo | Efecto |
|---|---|---|
| Robar una carta | 1 | Toma una carta del **mazo de descarte** y la lleva directo a la mano de quien paga (oculta, solo esa persona la ve). Es la única forma de recuperar cartas descartadas. |
| Revelar una carta de tu mano | 2 | La carta sale de tu mano (tu mano se reduce en 1) y pasa a una **zona común compartida**, boca arriba, visible para todos. Deja de contar como parte de la mano de nadie. |
| Demoler una carta no revelada del tablero | 1 por carta eliminada | Se retira del tablero **junto con todo su subárbol hacia las hojas** (misma dependencia que una caída por contradicción) y va al mazo de descarte. El costo total es igual al número de cartas que se llevan (la demolida + todo su subárbol) — mismo principio que el descarte por contradicción, sin un costo de "acción" separado. Los espacios quedan libres, sin restricción. |

**Zona común (cartas reveladas):**
- Cualquier carta que llega aquí (vía "revelar una carta de tu mano") queda boca arriba, sin límite de tiempo, hasta que **cualquier jugador, en cualquier momento**, decide jugarla en el árbol.
- Es funcionalmente un recurso del grupo — no tiene dueño desde el momento en que se revela.
- Nota de diseño: "robar (1) + revelar (2)" logra el mismo resultado final que una hipotética acción combinada "mostrar carta nueva del mazo boca arriba" (costo 3) — por eso no existe esa tercera acción combinada por separado, queda cubierta por la composición de las otras dos.

---

## 5. Condición de victoria/derrota

- **Victoria:** completar el árbol (todos los nodos llenos) con energía > 0 al final.
- **Derrota:** energía llega a 0 antes de completar el árbol.
- **Niveles "instantáneos" (difícil/experto):** no es una mecánica nueva — son simplemente niveles configurados con **energía inicial = 1**. El primer error descarta una carta, consume la única energía disponible, y el nivel se pierde. Esto permite explorar tanto el modelo permisivo (energía alta) como el modelo de tensión máxima (energía = 1) con la misma mecánica base, solo variando un parámetro de configuración por nivel.
- **Calibración de energía inicial:** rango 8-16, asociada al número de espacios vacíos del árbol (más nodos → más energía inicial de base, antes de aplicar el ajuste a 1 para niveles instantáneos).

---

## 6. Pirámide v2 — Mecánica adaptada (reemplaza floating blocks del v1)

**Cambio de arquitectura respecto al v1:** se descarta por completo el sistema de floating blocks (auto-acomodo de bloques flotantes que se fusionaban según valor). En v2, Pirámide usa una **pirámide normal** (base ancha abajo, vértice arriba — no invertida en el sentido visual), con **geometría fija predeterminada tipo heap invertido**: cada fila tiene exactamente la mitad de cartas que la fila inferior (16→8→4→2→1 para profundidad 5), con pares **fijos y no-superpuestos** — la misma estructura que el heap-indexing del BST, solo con la base ancha abajo en vez de la raíz arriba. El jugador elige cuándo y con qué carta llenar cada posición, pero no la forma de la pirámide ni qué par de hijos corresponde a qué padre.

### 6.1 Terminología (invertida respecto a la intuición BST)
- **Hijos** = cartas de una fila inferior.
- **Padre** = carta de la fila superior, jugada sobre un par de hijos adyacentes.
- (Nota: esto es opuesto a BST, donde el padre se juega primero y genera espacio para los hijos. En Pirámide, los hijos se juegan primero — boca abajo, ocultos — y el padre se juega después, sobre un par ya ocupado.)

### 6.2 Dónde se puede jugar una carta
Una carta nueva (oculta) se puede jugar en cualquiera de estas dos situaciones, a elección del jugador:
1. **En la base**, si hay espacios libres.
2. **Como padre de un par fijo de hijos** (posiciones 1-2, 3-4, 5-6... de la fila inferior — nunca pares deslizantes como 2-3) que ya están jugados (ocultos) y cuya posición geométrica les corresponde tener un padre ahí.

### 6.3 Revelación
Jugar una carta como padre sobre un par de hijos **revela ambos hijos simultáneamente** (no hay orden temporal entre ellos — a diferencia de BST, donde un padre se revela antes que sus hijos). El padre mismo NO se revela en este momento — solo se revelan los dos hijos que tenía debajo.

### 6.4 Validación
Al revelarse, cada hijo debe cumplir, respecto a los demás hijos *ya revelados* en su misma fila: ser mayor que todos los revelados a su izquierda, y menor que todos los revelados a su derecha. Es decir, la fila completa debe quedar en orden ascendente de izquierda a derecha una vez revelada en su totalidad.

### 6.5 Contradicción y descarte
Si la pareja de hijos recién revelada rompe el orden ascendente de la fila:
- **Se descartan las 3 cartas involucradas: el padre que disparó la revelación + ambos hijos.** No se salva ninguna de las dos, porque la revelación es simultánea y no hay jerarquía entre los hijos que permita culpar a uno solo.
- **Sin cascada hacia arriba:** es estructuralmente imposible que el padre que cae tenga a su vez su propio padre arriba, porque el padre acaba de jugarse en esta misma acción (no ha habido tiempo de jugar una carta encima de él todavía). Cada caída es siempre un evento aislado de exactamente 3 cartas.
- Los 3 espacios vuelven a su estado inicial (vacíos, sin restricción). Las 3 cartas van al mazo de descarte (mismo destino que en BST) — no se reparten ni se roban automáticamente, requiere gastar energía en "robar" para recuperarlas.

### 6.6 Demoler
Demoler una carta destruye también todo lo que **dependía de ella para haber sido jugado donde está** — en Pirámide eso significa todo lo que está hacia **arriba/el vértice** desde esa carta (sus padres, abuelos, etc.), porque un padre solo pudo jugarse ahí gracias a que esos hijos ya estaban en el tablero. Los hijos de la carta demolida (si la carta demolida era a su vez un padre) NO se destruyen — quedan intactos en el tablero, simplemente vuelven a no tener padre encima.

**Demoler en la base sin padre encima:** sí es posible — una carta de la base que todavía no tiene ningún padre jugado sobre ella se puede demoler igual, y en ese caso solo se elimina ella sola (no hay nada hacia el vértice que arrastrar). Uso táctico típico: demoler preventivamente una carta de la base que el jugador ya sabe (por su propia mano/memoria) que va a romper el orden ascendente respecto a otras cartas ya reveladas a su izquierda en la misma fila — evita pagar el costo de una caída completa de 3 cartas más adelante, a cambio de pagar solo 1 ahora.

(Contraste con BST, sección 4: ahí demoler destruye hacia las **hojas**, porque la dependencia es la inversa — un hijo solo pudo jugarse gracias a que su padre ya estaba puesto. Ambas reglas son la misma idea de fondo — destruir la carta + toda la cadena que existe sobre la base de que esa carta estuviera ahí — solo cambia la dirección geométrica según cómo se construye cada familia.)

### 6.7 Energía
Mismo sistema que BST (sección 4): cada carta descartada cuesta 1 energía, sea por contradicción o por demoler (en el caso de una caída por contradicción, siempre son exactamente 3 cartas a la vez = 3 energía). Robar y revelar cuestan igual que en BST (1 y 2 respectivamente); demoler ya no tiene costo de "acción" propio — su costo es 1 energía por cada carta que arrastra hacia el vértice (sección 6.6).

---

## 7. Niveles de prueba (10 por familia mecánica)

Siguiendo la estructura de testing del documento general (10 niveles por escenario, variando profundidad/dificultad antes de mezclar familias). Energía calibrada al rango 8-16, con el último nivel de cada serie llevando energía=1 como caso límite "instantáneo" (sección 5). Profundidad 3 = árbol/pirámide pequeño, 5 = grande.

### 7.1 BST

| Nivel | Profundidad | Árboles | Nodos totales | Energía inicial | Foco de prueba |
|---|---|---|---|---|---|
| 1 | 3 (7 nodos c/u) | 1 | 7 | 16 | Introductorio — energía alta, aprender la revelación básica |
| 2 | 3 (7 nodos c/u) | 2 | 14 | 16 | Dos árboles en paralelo, sin presión de energía |
| 3 | 4 (15 nodos c/u) | 1 | 15 | 14 | Sube profundidad, cascadas más largas posibles |
| 4 | 3 (7 nodos c/u) | 1 | 7 | 10 | Mismo tamaño que N1, energía más ajustada |
| 5 | 4 (15 nodos c/u) | 2 | 30 | 14 | Dos árboles medianos simultáneos |
| 6 | 5 (31 nodos c/u) | 1 | 31 | 12 | Árbol grande — cascadas profundas, 1 solo foco |
| 7 | 4 (15 nodos c/u) | 1 | 15 | 8 | Energía apretada — fuerza usar robar/revelar a propósito |
| 8 | 5 (31 nodos c/u) | 2 | 62 | 16 | Dos árboles grandes, energía alta compensa el volumen |
| 9 | 5 (31 nodos c/u) | 1 | 31 | 9 | Árbol grande con energía apretada — máxima tensión "normal" |
| 10 | 4 (15 nodos c/u) | 1 | 15 | 1 | **Instantáneo** — un solo error pierde el nivel |

### 7.2 Pirámide

Misma geometría heap invertido que BST (sección 6) → mismos totales de nodos por profundidad (7, 15, 31), solo organizados con la base ancha abajo en vez de la raíz arriba.

| Nivel | Profundidad (filas) | Pirámides | Nodos totales | Energía inicial | Foco de prueba |
|---|---|---|---|---|---|
| 1 | 3 (4-2-1 = 7 nodos c/u) | 1 | 7 | 16 | Introductorio — energía alta, aprender padre-revela-hijos |
| 2 | 3 (7 nodos c/u) | 2 | 14 | 16 | Dos pirámides en paralelo, sin presión de energía |
| 3 | 4 (8-4-2-1 = 15 nodos c/u) | 1 | 15 | 14 | Sube profundidad, más filas para coordinar |
| 4 | 3 (7 nodos c/u) | 1 | 7 | 10 | Mismo tamaño que N1, energía más ajustada |
| 5 | 4 (15 nodos c/u) | 2 | 30 | 14 | Dos pirámides medianas simultáneas |
| 6 | 5 (16-8-4-2-1 = 31 nodos c/u) | 1 | 31 | 12 | Pirámide grande — más decisiones de "dónde poner el padre" |
| 7 | 4 (15 nodos c/u) | 1 | 15 | 8 | Energía apretada — fuerza usar robar/revelar a propósito |
| 8 | 5 (31 nodos c/u) | 2 | 62 | 16 | Dos pirámides grandes, energía alta compensa el volumen |
| 9 | 5 (31 nodos c/u) | 1 | 31 | 9 | Pirámide grande con energía apretada — máxima tensión "normal" |
| 10 | 4 (15 nodos c/u) | 1 | 15 | 1 | **Instantáneo** — un solo error pierde el nivel |

**Notas de la serie:**
- N1-N2 y N4 mantienen el mismo tamaño de árbol/pirámide para aislar el efecto de la energía sola (N1 vs N4) y de jugar 2 a la vez (N1 vs N2).
- N7 es el primer punto donde la energía es lo bastante ajustada como para que decidir robar/revelar/demoler importe de verdad, antes de llegar al extremo de N10.
- N8 es el nivel más grande del set (62 nodos en ambas familias, ya que comparten geometría) — sirve para detectar si la cascada de revelación o la coordinación de "dos tableros a la vez" se vuelve abrumadora en mesa física.
- Tamaño y energía evolucionan independientes — no son una sola "dificultad" lineal, lo que permite aislar qué variable es la que realmente afecta la dificultad percibida en playtesting.
- BST y Pirámide comparten exactamente los mismos totales de nodos por nivel (misma geometría heap, solo invertida) — esto facilita comparar directamente la dificultad percibida entre ambas familias mecánicas en playtesting, sin que el tamaño del tablero sea una variable de confusión.

---

## 8. Pendiente / no resuelto todavía

Sin pendientes abiertos por ahora — los cuatro puntos quedaron resueltos: zona común sin límite explícito (la energía ya la regula), secuenciación atómica de demoler/revelar (sección 1), demoler en base sin padre confirmado (sección 6.6), y geometría de Pirámide confirmada como heap invertido (sección 6, 7.2).
