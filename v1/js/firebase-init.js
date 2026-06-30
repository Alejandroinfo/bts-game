// ════════════════════════════════════════════════════════════════
// FIREBASE — Inicialización y conexión a Realtime Database
// ════════════════════════════════════════════════════════════════
//
// IMPORTANTE: Reemplaza firebaseConfig con tus propias credenciales.
// Ve a https://console.firebase.google.com → crea un proyecto nuevo
// llamado "bst-animals" (o el nombre que prefieras) → Realtime Database
// → Build → Create Database → modo "Test mode" para empezar.
//
// Luego en Project Settings → General → "Tus apps" → ícono </> (web)
// → Registrar app → copia el bloque firebaseConfig y pégalo abajo.
//
// ════════════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getDatabase, ref, set, get, update, remove, push,
  onValue, off, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

// ── Credenciales de bst-animals ─────────────────────────────────────
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

// Exponer en window para que los demás módulos lo usen fácilmente
// (mismo patrón que la app del Día del Padre)
window.FB = {
  db, ref, set, get, update, remove, push,
  onValue, off, runTransaction, serverTimestamp
};

console.log("Firebase inicializado correctamente");
