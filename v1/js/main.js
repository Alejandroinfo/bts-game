// ════════════════════════════════════════════════════════════════
// MAIN — Punto de entrada
// ════════════════════════════════════════════════════════════════

window.addEventListener("DOMContentLoaded", async () => {
  // Intentar reconexión automática (si recargaste la página a mitad de partida)
  const reconnected = await window.GameRoom.tryReconnect();
  if (!reconnected) {
    window.UI.showStart();
  }

  // Enter key support en inputs
  document.getElementById("hostName")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") window.GameRoom.createRoom();
  });
  document.getElementById("joinCode")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") window.GameRoom.joinRoom();
  });
});
