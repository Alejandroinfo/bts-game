// ════════════════════════════════════════════════════════════════
// MAIN — v2 entry point (mismo patrón que v1)
// ════════════════════════════════════════════════════════════════

window.addEventListener("DOMContentLoaded", async () => {
  const reconnected = await window.GameRoomV2.tryReconnect();
  if (!reconnected) {
    window.UIV2.showStart();
  }
});
