// ════════════════════════════════════════════════════════════════
// UI — Navegación de pantallas y tabs
// ════════════════════════════════════════════════════════════════

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function showStart() { showScreen("screenStart"); }
function showHostSetup() { showScreen("screenHostSetup"); }
function showJoinSetup() { showScreen("screenJoinSetup"); document.getElementById("joinError").textContent = ""; }
function showLobby() { showScreen("screenLobby"); }
function showGame() { showScreen("screenGame"); }

function showTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
  document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add("active");
  document.getElementById("tab" + tabName.charAt(0).toUpperCase() + tabName.slice(1)).classList.add("active");
}

function showJoinError(msg) {
  document.getElementById("joinError").textContent = msg;
}

window.UI = { showStart, showHostSetup, showJoinSetup, showLobby, showGame, showTab, showJoinError };
