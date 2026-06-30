# BST Animals v2 — Escenario A: Información Mixta

> Documento de especificación. Depende de `BST_v2_Decisiones_Generales.md` para el contexto transversal (mazo de 64 cartas, sistema de queue, eliminación de puntos, habilidades en hold). Este documento cubre únicamente las decisiones propias del Escenario A, tomadas en el chat "BST v2: Escenario Información Mixta".

---

## 1. Concepto del escenario

Cada jugador tiene una mano dividida en dos categorías:

- **Cartas visibles para su dueño** — las ve normalmente, como en cualquier juego de cartas.
- **Cartas ocultas para su dueño** — su dueño no las ve, pero son visibles para los demás jugadores.

La proporción de cartas ocultas por jugador (no de espacios del tablero) varía entre niveles, de **20% a 80%**. La dificultad real no está en cuánto se oculta, sino en quién tiene permiso de actuar sobre lo que ve — ver la sección 3 (Agencia).

**Fuera de alcance para esta tanda de pruebas** (quedan en hold, ver `BST_v2_Decisiones_Generales.md` §2 y §4):
- Shy, Hyperactive, Demolisher.
- Colores/personalidades (todas las habilidades quedan grisadas en el setup, mismo patrón que `hidePersonality=true` de Tutorial Fase 1 en v1).
- Comunicación con costo, draft de cartas, cartas de ayuda.
- Sistema de puntos.

---

## 2. Reparto de cartas

- Reparto **carta por carta**, sin draw adicional más allá del setup inicial — igual que cualquier juego de cartas convencional.
- En el momento de repartir, cada carta se marca como visible u oculta para su dueño según el % objetivo del nivel. No se reparte primero un bloque de visibles y luego un bloque de ocultas: la marca se decide carta por carta durante el mismo reparto.
- El % oculto no siempre divide parejo entre jugadores (ej. 10 cartas ocultas repartidas entre 3 jugadores → alguien recibe 4, los otros 3). El remanente debe rotar de asiento en asiento entre niveles, para que no sea siempre el mismo jugador quien cargue con la carta oculta extra.
- **Cartas libres en mesa:** algunos niveles incluyen un número fijo de cartas boca arriba sobre la mesa, separadas del reparto de manos. Son jugables por **cualquier jugador, sin restricción de agencia**, independiente de la regla de agencia activa en ese nivel — funcionan como válvula de escape pura, no como una pieza más del sistema de restricción.

---

## 3. Agencia

La agencia define **quién puede jugar qué carta**, independiente de quién la vea. Es la palanca de dificultad principal del escenario — más relevante que el % oculto.

| Modo | Regla |
|------|-------|
| **Cualquiera** | Cualquier carta visible para alguien puede ser jugada por quien la vea. Sin restricción adicional. |
| **Vecino fijo** | Solo se puede jugar una carta oculta-para-su-dueño si quien la ve es su vecino fijo designado (relación fija para todo el nivel, no rotativa). |

El modo de agencia se define **por nivel**, no es una regla global del escenario.

**Variantes de agencia para etapas futuras** (no usadas en esta tanda, quedan documentadas para no perderlas — ver `BST_v2_Decisiones_Generales.md` §4):
1. Vecino fijo (la usada en esta tanda).
2. Vecino rotativo por ronda.
3. Acceso designado al azar o por carta especial.

Las cartas libres en mesa (sección 2) están exentas de cualquier regla de agencia activa en el nivel.

---

## 4. Sistema de Queue

Reutiliza la mecánica ya fijada en las decisiones generales, aplicada a este escenario:

1. **Declaración** — cada jugador, por turno (no simultáneo a ciegas), elige una posición libre del 1 al número de jugadores para su carta de esa ronda. Posición ocupada no se puede elegir.
2. **Resolución de efectos** — en esta tanda queda **vacía/no-op**, ya que Shy, Hyperactive y Demolisher están deshabilitados. La fase existe en el flujo de implementación para no tener que rediseñar el pipeline cuando esas habilidades se reactiven.
3. **Ejecución** — las cartas se juegan contra el tablero en orden de posición final 1, 2, 3...

Cartas que excedan la profundidad del árbol al momento de resolverse se descartan (regla heredada, sin cambios).

---

## 5. Cartas extra (margen sobre los espacios del árbol)

La condición de victoria es completar el árbol. Si el total de cartas en mano + mesa fuera exactamente igual a los espacios del árbol, el margen de error sería demasiado ajustado. Se agrega un número de **cartas extra** sobre el total de espacios, dependiente de la dificultad del nivel:

- El extra se calcula como `ceil(espacios × %extra)`.
- El % extra **decrece** a medida que sube la dificultad del nivel (más margen en los niveles fáciles, menos en los difíciles).
- El objetivo de este margen es mantener la importancia del juego en el **orden** en que se juegan las cartas, no en la simple disponibilidad de cartas suficientes.

---

## 6. Interfaz de testing

| Estructura | Modo de colocación | Manejo de errores |
|-----------|--------------------|--------------------|
| **BST** | Automático — reutiliza `findBSTPosition()` de v1, sin cambios. | No aplica (la posición la decide el algoritmo). |
| **Pirámide** | Manual, point-and-click/drag. El jugador elige la posición. | Se permite colocar en posiciones inválidas — **no se bloquea la jugada**. Se registra en consola (ej. tag `[PyramidInvalidPlacementAllowed]`) junto con: posición elegida, jugador, carta. Sugerido (no obligatorio): un indicador visual sutil (ej. borde rojo tenue) en la carta mal colocada. El regulador (point-and-click) por ahora permite incoherencias activamente; se endurecerá más adelante una vez validado en mesa. |

**Geometría de Pirámide — actualizado:** se adopta la geometría de "pirámide normal" definida en `BST_v2_Escenario_Revelacion_Tardia.md` §6 (vértice arriba, base ancha abajo, pares fijos no-deslizantes 1-2/3-4/5-6..., misma forma heap 2^(h-1)→...→4→2→1) en lugar del sistema de floating blocks de v1. Los hijos se juegan primero (en la base o como hijos ya existentes), el padre se juega después sobre un par ya completo. Esto reemplaza cualquier validación BST-style anterior para Pirámide — la regla de coherencia ahora es: padre > hijo izquierdo y padre < hijo derecho, exigiendo ambos hijos ya jugados antes de permitir el padre (aunque, por la decisión de "incoherencia permitida", el sistema deja jugar el padre igual si los hijos faltan o el valor no calza, solo lo marca).

Razón del modo manual en Pirámide: en v1 el sistema automático mostró pocos errores en pruebas previas para BST; para Pirámide se prefiere no bloquear el flujo de playtest por errores de lógica, y además la geometría de pares fijos es más simple de entender en mesa que el sistema de floating blocks de v1 (ver `BST_Animals_Project_Knowledge.md` §15).

---

## 7. Habilidades y personalidades en el setup

Todas las habilidades (Shy, Hyperactive, Demolisher) y personalidades/colores aparecen **grisadas / no seleccionables** en el setup de la sala — mismo patrón visual y funcional que `hidePersonality=true` en Tutorial Fase 1 de v1. No se trata de ocultarlas silenciosamente: deben verse como opción presente pero inactiva, para que quede claro que es una decisión de testing y no una ausencia de funcionalidad.

---

## 8. Matriz de 10 niveles de prueba

Calculada para **3 jugadores** (ajustar proporcionalmente si la mesa de prueba tiene otro número).

| Nv | Estructura | Espacios | Extra | Total mano | % oculto | Agencia | Libres en mesa |
|----|-----------|---------:|------:|------------:|---------:|---------|---------------:|
| 1 | 1 BST h3 | 7 | +2 | 9 | 20% | Cualquiera | 0 |
| 2 | 1 BST h3 | 7 | +2 | 9 | 40% | Cualquiera | 0 |
| 3 | 1 BST h3 | 7 | +1 | 8 | 40% | Vecino fijo | 0 |
| 4 | 1 Pirámide h3 | 7 | +1 | 8 | 60% | Cualquiera | 0 |
| 5 | 1 Pirámide h3 | 7 | +1 | 8 | 60% | Vecino fijo | 2 |
| 6 | 1 BST h4 | 15 | +3 | 18 | 40% | Cualquiera | 0 |
| 7 | 1 BST h4 | 15 | +2 | 17 | 60% | Vecino fijo | 0 |
| 8 | 2 BST h3 | 14 | +2 | 16 | 50% | Cualquiera | 2 |
| 9 | 1 BST h4 + 1 Pirámide h3 | 22 | +2 | 24 | 70% | Vecino fijo | 0 |
| 10 | 1 BST h4 | 15 | +1 | 16 | 80% | Cualquiera | 0 |

**Notas de diseño de la matriz:**
- "h3"/"h4" = altura del árbol (3 o 4), espacios = 2^h − 1 (heredado del mismo cálculo de v1: h3=7, h4=15).
- El nivel 10 combina el % oculto más alto con la agencia menos restrictiva — fue diseñado como diagnóstico para la pregunta abierta de exceso de información (ver sección 9), pero **se juega y se anota exactamente igual que los otros 9 niveles, sin tratamiento especial**. Si el playtest revela algo distinto ahí, debe aparecer al comparar resultados entre niveles, no por estar buscándolo de antemano.
- Cada nivel cambia preferentemente uno o dos ejes a la vez respecto al anterior, para que los resultados del playtest sean más fáciles de atribuir a una causa específica.

---

## 9. Discusión abierta: exceso de información (no resuelta, registrada para referencia)

Pregunta planteada: con la mano híbrida, ¿se está filtrando demasiada información y el escenario se vuelve demasiado fácil?

**Razonamiento acordado hasta ahora:**
- Una vez que una carta es visible, se ve completa — no hay forma de ofuscar el valor como sí ocurría con las señales abstraídas de v1 (ej. "tu carta más alta" sin revelar cuál). Por lo tanto, la palanca de dificultad real no es "cuánto se oculta" sino "qué tan poco se puede hacer con lo que se ve" — eso es exactamente lo que controla la **agencia** (sección 3).
- El rompecabezas de BST Animals nunca fue "adivinar valores", sino coordinar el **orden** de juego bajo comunicación restringida. Conocer el valor de una carta no resuelve cuándo conviene jugarla, especialmente con el sistema de queue y el margen de cartas extra (sección 5).
- **Decisión para esta tanda:** no se agrega ninguna mecánica nueva de mitigación (ni costo de comunicación, ni fuzzing de valores) todavía. El nivel 10 funciona como el experimento real: si el grupo lo siente trivial, eso da evidencia concreta de cuándo aparece el problema, sin mezclar variables nuevas en la primera demo.
- **Mitigación candidata ya identificada para si el problema se confirma:** comunicación con costo (descartar una carta propia para revelar información de otro jugador) — ver `BST_v2_Decisiones_Generales.md` §4. No se incluye de entrada porque mezclaría tres variables nuevas (% oculto, agencia, costo de comunicación) en la misma demo.

---

## 10. Cómo usar este documento

Para retomar este escenario en un chat nuevo:
> "Seguimos el diseño de BST v2, escenario Información Mixta. Ver `BST_v2_Escenario_A_InformacionMixta.md` y `BST_v2_Decisiones_Generales.md` para contexto."

Si Claude no tiene este archivo a mano, puede buscarlo con `conversation_search` (términos sugeridos: "información mixta agencia vecino fijo", "matriz 10 niveles BST v2", "exceso de información BST").
