# BST Animals — Web App (Firebase + Vercel)

Juego cooperativo de cartas para 2-5 jugadores. Construye árboles BST y
pirámides en silencio. Mismo patrón que la app del Día del Padre:
HTML/JS plano + Firebase Realtime Database + Vercel.

## Paso 1 — Crear proyecto Firebase

1. Ve a https://console.firebase.google.com
2. **Crear proyecto** → nómbralo `bst-animals` (o el que prefieras)
3. Cuando termine, ve a **Build → Realtime Database → Create Database**
4. Elige modo de seguridad: **Test mode** (cualquiera puede leer/escribir —
   suficiente para jugar con amigos, no para producción pública)
5. Selecciona la región más cercana

## Paso 2 — Registrar la app web

1. En la página principal del proyecto, busca **"Tus apps"**
2. Click en el ícono **`</>`** (web)
3. Nombra la app (ej: `bst-animals-web`) → **Registrar app**
4. Cuando te pregunte **npm vs script tag**, elige **script tag**
   (igual que hicimos con la app del Día del Padre)
5. Copia el bloque `firebaseConfig` que te muestra

## Paso 3 — Pegar credenciales

Abre `js/firebase-init.js` y reemplaza el bloque `firebaseConfig` con el
que copiaste de Firebase:

```js
const firebaseConfig = {
  apiKey: "TU_API_KEY_REAL",
  authDomain: "bst-animals.firebaseapp.com",
  databaseURL: "https://bst-animals-default-rtdb.firebaseio.com",
  projectId: "bst-animals",
  storageBucket: "bst-animals.firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
};
```

## Paso 4 — Probar en local

Mismo flujo que usaste antes:

```bash
cd bst-firebase
vercel link        # conecta con un proyecto Vercel (crea uno si no existe)
vercel dev
```

Abre `http://localhost:3000` en dos pestañas para probar multijugador
tú solo antes de invitar a tus amigos.

## Paso 5 — Subir a producción

```bash
vercel --prod
```

O simplemente conecta el repo de GitHub a Vercel para que cada push
haga deploy automático (igual que configuramos en el proyecto anterior).

## Cómo jugar (resumen)

1. El host crea una sala → comparte el código de 5 letras
2. Los demás se unen con el código
3. Fase de misiones: cada jugador puede tomar 1 misión del pool visible
   pagando su costo, **antes** de ver su mano
4. Click en "Listo" → cuando todos estén listos, se reparten las cartas
5. Click en una carta de tu mano → click en una casilla del tablero
6. Usa señales para comunicarte (si están desbloqueadas)
7. El host termina el nivel cuando corresponda
8. Ganan completando los 8 niveles antes de que el pozo de vidas llegue a 0

## Estructura de archivos

```
bst-firebase/
├── index.html              ← Estructura HTML, todas las pantallas
├── styles.css               ← Todo el CSS
└── js/
    ├── firebase-init.js     ← Conexión a Firebase (PEGA TUS CREDENCIALES AQUÍ)
    ├── gameData.js          ← Cartas, misiones, niveles, dificultad
    ├── gameLogic.js         ← Validación de árbol BST y Pirámide
    ├── ui.js                ← Navegación entre pantallas
    ├── cardRender.js        ← Dibuja las cartas en HTML/CSS
    ├── boardRender.js       ← Dibuja el árbol/pirámide en HTML/CSS
    ├── missionRender.js     ← Dibuja el pool de misiones
    ├── gameRoom.js          ← Toda la lógica de sala + sincronización Firebase
    └── main.js              ← Punto de entrada, reconexión automática
```

## Notas técnicas

- **Sin imágenes**: todas las cartas se dibujan con HTML/CSS puro, carga instantánea
- **Reconexión automática**: si alguien recarga la página a mitad de partida,
  `localStorage` guarda su sesión y vuelve a conectarse solo
- **Validación en el cliente**: las reglas de BST/Pirámide se verifican en
  el navegador de quien juega la carta, antes de escribir a Firebase
- **Tiempo real**: cualquier cambio en Firebase se refleja instantáneamente
  en todos los navegadores conectados a la sala (vía `onValue`)

## Modo seguridad (para más adelante)

El modo "Test mode" de Firebase expira solas en 30 días y deja la base
de datos abierta a cualquiera con la URL. Para una versión más cerrada,
en Firebase Console → Realtime Database → Reglas, puedes usar:

```json
{
  "rules": {
    "rooms": {
      "$code": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

Esto sigue siendo abierto pero al menos no expira. Para autenticación
real (que solo jugadores de la sala puedan escribir) se necesitaría
Firebase Auth, que es un paso adicional no incluido en este MVP.
