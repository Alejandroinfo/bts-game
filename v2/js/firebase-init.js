// ════════════════════════════════════════════════════════════════
// FIREBASE — Inicialización y conexión a Realtime Database (v2)
// ════════════════════════════════════════════════════════════════
//
// Mismo proyecto Firebase que v1 (bst-animals). v2 usa una rama
// separada de la base de datos ("rooms_v2/") para no chocar nunca
// con las salas de v1 ("rooms/") — ver BST_v2 docs de diseño.
//
// ════════════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getDatabase, ref, set, get, update, remove, push,
  onValue, off, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

// ── Mismas credenciales que v1 (bst-animals) ────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyARoCr10qZP4M_fd_t__d4NUWmKL9pD6lc",
  authDomain: "bst-animals.firebaseapp.com",
  databaseURL: "https://bst-animals-default-rtdb.firebaseio.com",
  projectId: "bst-animals",
  storageBucket: "bst-animals.firebasestorage.app",
  messagingSenderId: "847465030363",
  appId: "1:847465030363:web:75074d592363a4a695e2fe"
};
// ─────────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

window.FB = {
  db, ref, set, get, update, remove, push,
  onValue, off, runTransaction, serverTimestamp
};

// Prefijo de rama exclusivo de v2 — todo gameRoom.js de v2 debe leer
// y escribir bajo "rooms_v2/{code}", nunca bajo "rooms/{code}" (eso
// es v1, intocable desde aquí).
window.FB_ROOT = "rooms_v2";

console.log("Firebase inicializado correctamente (v2 — rama rooms_v2/)");
