# BST Animals v2 — Estado de Decisiones de Diseño

> Documento vivo. Resume las decisiones tomadas en el chat "Decisiones generales" para dar contexto rápido a los chats hijos de cada escenario. Actualizar aquí cuando algo se confirme o cambie.

---

## 1. Motivación del v2

El v1 (ver `BST_Animals_Project_Knowledge.md`) es secuencial: 8 niveles obligatorios, sesiones de 60+ min, recompensas acumulativas entre niveles. El feedback de playtesting con amigos señaló que esto se siente forzado en tiempo/dedicación.

**Decisión:** pasar a un modelo de **escenarios aislados** (no secuenciales, sin progresión de recompensas entre ellos). Cada escenario es una "receta" autocontenida: tamaño de árbol(es), número de árboles, condición de victoria, y 1-2 mecánicas activas. Las misiones dejan de ser bonus opcional y pasan a ser **condición de victoria** del escenario (o parte de su setup inicial).

---

## 2. Decisiones ya confirmadas (transversales a todos los escenarios)

- **Mazo: 64 cartas** (no 100). Razón: 64 calza casi exacto con un árbol completo de altura 6 (63 nodos) vía heap-indexing, eliminando el sobrante de ~37 cartas que en v1 nunca cabían en el nivel más grande. También reduce el espacio mental de comparación para los jugadores.
- **Estructura de testing: 10 niveles por escenario**, variando profundidad/dificultad dentro de la misma familia mecánica, antes de mezclar familias entre sí.
- **Animales (clases por decada) y Colores/Personalidades: en hold**, descartados temporalmente del análisis para no introducir ruido mientras se valida el núcleo de las mecánicas de información. Cuando se retomen, ya hay una idea propuesta de simplificar de 10 colores a ~4 "zonas de calor" relativas al rango en juego (no fijas 1-100/1-64), en vez de 10 personalidades fijas.
- **Habilidades Shy, Hyperactive, Demolisher: en hold** — se consideran el núcleo de habilidades más interesante a futuro (cambian estructura espacial/temporal del juego, no solo dan bonus), pero su distribución y diseño exacto en v2 se decide después de validar los escenarios de información. Hay una habilidad nueva candidata aún sin definir, también en hold.
- **Sistema de puntos: eliminado** en v2 (era el soporte de Orderly y de las recompensas en v1). Cualquier mecánica que dependía de puntos necesita rediseñarse sin ellos cuando se retome (ej. Orderly podría convertirse en "revelación gratuita de una carta de tu mano" en vez de sumar puntos).
- **Mecánica de queue (orden de juego por ronda):** decisión de diseño que probablemente sea transversal a varios escenarios, no exclusiva de uno. Reglas ya fijadas:
  - Fase de declaración: cada jugador, **por turno** (no simultáneo-a-ciegas), elige una posición libre del 1 al número de jugadores para su carta de esa ronda. Posición ocupada = no se puede elegir (sin empates).
  - Fase de resolución de efectos: se revela el queue completo; ahí se aplican Demolisher (cancela una carta del queue → **vuelve a la mano de su dueño**, no se descarta permanentemente), Shy (retrasa una posición), Hyperactive (adelanta una posición). Si el destino de un efecto está ocupado, el efecto simplemente no se aplica (sin cadenas de desplazamiento).
  - Fase de ejecución: se juegan las cartas contra el tablero en orden de posición final 1, 2, 3...
  - Cartas que excedan la profundidad del árbol al momento de resolverse se descartan.

---

## 3. Escenarios de prueba definidos (cada uno en su propio chat)

### Escenario A — "Información Mixta"
Mano híbrida: cada jugador ve una parte de su propia mano y otra parte la ven los demás (originalmente propuesto como "ves la mano de tu vecino izquierdo"). Solo puedes jugar cartas de quien designe la regla de acceso (no necesariamente todo lo que ves) — esta restricción de **agencia** (quién puede jugar qué) es la palanca real de dificultad, más que el porcentaje de mano visible. Robo de cartas ligado a espacios libres en el árbol (n = espacios libres / jugadores + k según escenario/misión). Usa el sistema de queue.

→ Chat dedicado: **"BST v2: Escenario Información Mixta"**

### Escenario B — "Revelación Tardía"
Cada jugador ve su propia mano normalmente (sin mezcla con otros). Una carta jugada en el árbol no se revela a los demás hasta que tiene dos hijos. Al revelarse, si se descubre una contradicción (la carta no debía ir ahí), las cartas involucradas en el error se descartan. Vidas por nivel como margen de error (no derrota instantánea).

→ Chat dedicado: **"BST v2: Escenario Revelación Tardía"**

---

## 4. Ideas mencionadas pero no resueltas (pendientes, no descartadas)

- Draft de cartas al inicio del escenario (en vez de reparto puro al azar).
- Cartas de ayuda visibles en mesa para todos, que facilitan completar el nivel pero restan puntos obtenidos (pendiente de cómo rediseñar sin sistema de puntos).
- Comunicación con costo: dar información de la mano de otro a cambio de descartar una carta propia; costo debería escalar con cuánta información se revela (similar a la progresión Range/Pack/Median del v1).
- Variantes de "agencia limitada" para el Escenario A, en orden de complejidad creciente: vecino fijo (v1 de la idea) → vecino rotativo por ronda → acceso designado al azar/por carta especial. Se sugiere empezar con vecino fijo para la primera versión jugable.
- Modelo de niveles del v1 (Modelo A "menú libre" vs Modelo B "campaña corta") — probablemente resuelto por el cambio a escenarios aislados, pero no se ha confirmado explícitamente si se descarta del todo o convive como variante.

---

## 5. Cómo usar este documento en los chats hijos

Al abrir un chat nuevo para un escenario, basta con decir algo como:
> "Seguimos el diseño de BST v2, escenario [A/B]. Ver documento de decisiones generales para contexto."

Si Claude no tiene este archivo a mano en el chat nuevo, puede buscarlo con `conversation_search` (términos sugeridos: "BST v2 decisiones", "información mixta queue", "revelación tardía contradicción").
