# BST Animals — Repo

## Estructura

```
/                  ← v2 (lo que la gente ve al entrar al sitio)
/v2/               ← copia idéntica de v2, accesible explícitamente
/v1/               ← v1 completa, intacta, sin enlace visible desde la portada
```

v1 sigue funcionando igual que siempre si alguien visita `tu-dominio.vercel.app/v1/`
directamente, pero ya no es la página de entrada.

## v2 — qué es

Prototipo multijugador real (Firebase Realtime Database) del Escenario A
("Información Mixta") del diseño v2. Ver los documentos de diseño:
- `BST_v2_Decisiones_Generales.md`
- `BST_v2_Escenario_A_InformacionMixta.md`
- `BST_v2_Escenario_Revelacion_Tardia.md` (Escenario B, spec cerrada, 20 niveles)

### Modelo de seguridad de información (decisión explícita)

v2 usa el modelo **"simple"**: cada navegador recibe el estado COMPLETO de la
sala desde Firebase (todas las manos, ocultas o no) y decide del lado del
cliente qué mostrar. No hay servidor que filtre por jugador — cualquiera
podría ver toda la información abriendo la consola del navegador. Esto es
aceptable jugando con amigos de confianza. Si en el futuro se necesita que
sea imposible "hacer trampa" mirando la consola, hay que migrar a un modelo
donde un backend decida qué le manda a cada cliente — eso es trabajo nuevo,
no una extensión de lo que hay hoy.

## Firebase — una sola base de datos para v1 y v2

v2 usa el **mismo proyecto Firebase que v1** (`bst-animals`), pero bajo una
rama separada de la base de datos: `rooms_v2/` en vez de `rooms/`. No hay
forma de que una sala de v1 choque con una de v2 — son ramas distintas del
mismo árbol, como dos carpetas separadas.

Las credenciales ya están en `js/firebase-init.js` (mismas que v1). Si en
algún momento se decide separar a un proyecto Firebase propio para v2, solo
hay que reemplazar el `firebaseConfig` en ese archivo (y en `/v2/js/` y
`/v1/js/` si se quiere mantenerlas todas sincronizadas).

### Reglas de seguridad de Firebase

Si las reglas de Realtime Database de v1 son del tipo "todo público" (modo
test), v2 funciona igual sin tocar nada. Si en algún momento se restringen
las reglas, hay que asegurarse de que `rooms_v2/` tenga permisos de
lectura/escritura equivalentes a los de `rooms/`.

## Reparto de cartas — host-autoritativo

El reparto (`dealLevel` en `js/gameRoom.js`) lo ejecuta **solo el host**,
una vez, y el resultado se escribe a Firebase. Los demás navegadores solo
leen vía `onValue` — ningún otro navegador corre su propio `Math.random()`
de reparto. Esto es necesario para que todos vean exactamente las mismas
manos; fue verificado explícitamente en testing antes de esta entrega.

## Despliegue (Vercel)

Es un sitio estático sin build step, igual que v1. Cualquier carpeta con
un `index.html` se sirve directo. Subir esta carpeta completa (reemplazando
el contenido actual del repo) y Vercel debería servir todo sin configuración
adicional.

## Niveles

- **Escenario A**: 12 niveles, spec cerrada (ver `BST_v2_Escenario_A_InformacionMixta.md`).
  BST automático, Pirámide manual con point-and-click (posiciones inválidas
  permitidas y solo registradas en log, no bloquean el flujo). Usa el
  sistema de queue (declaración por turno → resolución → ejecución).
- **Escenario B**: 20 niveles (10 BST + 10 Pirámide), spec cerrada (ver
  `BST_v2_Escenario_Revelacion_Tardia.md`). Jugada simultánea libre, SIN
  queue (la incertidumbre vive en el valor de las cartas, no en el orden
  de juego). Mecánica de energía compartida (8-16, o 1 en niveles
  "instantáneos"): revelación tardía con cascada top-down en BST,
  revelación simultánea de pares en Pirámide, descarte de subárbol/triple
  ante contradicción, y 3 acciones pagables con energía (robar, revelar
  a zona común, demoler).

## Reinicio de partida

El host tiene un botón "↺ Reiniciar" visible durante el juego (en ambos
escenarios) que vuelve la sala al lobby sin perder el código de sala ni
la lista de jugadores conectados. Todos los demás jugadores pasan
automáticamente al lobby vía su propio listener de Firebase — nadie
tiene que reingresar el código. Desde el lobby, el host puede además
cambiar de escenario (A↔B) antes de elegir nivel e iniciar de nuevo.
Pensado como vía de escape barata ante errores de juego o ganas de
cambiar de nivel, sin el costo de crear una sala nueva.

## Limitaciones conocidas de este prototipo

- Si el host pierde conexión SIN usar el botón de reiniciar (cierre
  accidental de pestaña, caída de red), nadie más puede repartir el
  siguiente nivel hasta que el host vuelva a conectarse (reconexión
  automática vía `localStorage`, ya soportada) — no hay traspaso de rol
  de host a otro jugador todavía.
- Niveles con 2 árboles: la carta se intenta colocar en el primer árbol con
  espacio libre, en el orden en que aparecen en `level.trees` — no hay
  todavía una regla de diseño sobre "a cuál árbol va cada carta" cuando hay
  más de uno. Queda anotado como pendiente de diseño, no es un bug.
- Pirámide usa una validación de heap-order simplificada para este
  prototipo (no es el sistema completo de floating blocks de v1).
