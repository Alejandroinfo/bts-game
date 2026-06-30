// ════════════════════════════════════════════════════════════════
// MISSION RENDER — Pool de misiones y misión activa
// ════════════════════════════════════════════════════════════════

const LVL_COLOR = {
  "Level 1": { acc:"#1A5276", bg:"#D6EAF8" },
  "Level 2": { acc:"#1E8449", bg:"#D5F5E3" },
  "Level 3": { acc:"#A04000", bg:"#FDEBD0" },
  "Level 4": { acc:"#922B21", bg:"#FADBD8" },
};
const TYPE_COLOR = {
  Communication: { bg:"#EBF5FB", txt:"#1A5276", label:"COMUNICACIÓN" },
  Economy:       { bg:"#EAFAF1", txt:"#1E8449", label:"ECONOMÍA" },
  Structure:     { bg:"#FEF9E7", txt:"#7D6608", label:"ESTRUCTURA" },
};

function renderMissionCard(mission, { myPoints = 0, canTake = false, onTake = null } = {}) {
  const lc = LVL_COLOR[mission.level] || { acc:"#555", bg:"#eee" };
  const tc = TYPE_COLOR[mission.type] || { bg:"#eee", txt:"#333", label:mission.type };
  const cost = parseInt(mission.cost);
  const affordable = myPoints >= cost;

  const div = document.createElement("div");
  div.className = "mission-card";
  div.style.border = `2px solid ${lc.acc}`;
  if (canTake && !affordable) div.style.opacity = "0.6";

  const lvlLabel = mission.level === "Level 1" ? "Nivel 1" :
                   mission.level === "Level 2" ? "Nivel 2" :
                   mission.level === "Level 3" ? "Nivel 3" : "Nivel 4";

  div.innerHTML = `
    <div class="m-header" style="background:${lc.acc}">
      <span class="lvl">${lvlLabel}</span>
      <span class="cost" style="color:${lc.acc}">${mission.cost}</span>
    </div>
    <div class="m-type" style="background:${tc.bg};color:${tc.txt}">${tc.label}</div>
    <div class="m-condition" style="border-bottom:1px solid ${lc.bg}">
      <div class="m-label">MISIÓN</div>
      <div class="m-text">${mission.condition}</div>
    </div>
    <div class="m-reward" style="background:${lc.bg}">
      <div class="m-label" style="color:${lc.acc}">RECOMPENSA</div>
      <div class="m-reward-text" style="color:${lc.acc}">★ ${mission.reward}</div>
    </div>
  `;

  if (canTake) {
    const btn = document.createElement("button");
    btn.className = "m-take-btn";
    btn.style.background = affordable ? lc.acc : "#ccc";
    btn.disabled = !affordable;
    btn.textContent = affordable ? `Tomar (${mission.cost})` : `Necesitas ${cost} pts`;
    if (affordable && onTake) btn.onclick = () => onTake(mission);
    div.appendChild(btn);
  }

  return div;
}

function renderMissionPool(container, pool, { myPoints = 0, canTake = false, onTake = null,
  activeMission = null, onComplete = null, onAbandon = null } = {}) {
  container.innerHTML = "";
  if (!pool) return;

  if (activeMission) {
    const box = document.createElement("div");
    box.className = "active-mission-box";
    box.innerHTML = `
      <div class="am-title">✅ Tu Misión Activa</div>
      <div class="am-cond">${activeMission.condition}</div>
      <div class="am-reward">Recompensa: ${activeMission.reward}</div>
    `;
    const btnRow = document.createElement("div");
    btnRow.style.display = "flex"; btnRow.style.gap = "8px";

    const completeBtn = document.createElement("button");
    completeBtn.className = "btn btn-success btn-small";
    completeBtn.textContent = "✓ Completar";
    completeBtn.onclick = onComplete;

    const abandonBtn = document.createElement("button");
    abandonBtn.className = "btn btn-danger btn-small";
    abandonBtn.textContent = "✗ Abandonar";
    abandonBtn.onclick = onAbandon;

    btnRow.appendChild(completeBtn);
    btnRow.appendChild(abandonBtn);
    box.appendChild(btnRow);
    container.appendChild(box);
  }

  const title = document.createElement("div");
  title.style.fontWeight = "bold"; title.style.fontSize = "13px";
  title.style.marginBottom = "8px"; title.style.color = "#fff";
  title.innerHTML = `Pool de Misiones
    <span style="font-weight:normal;font-size:10px;color:#aaa;margin-left:8px;">
      Elige antes de ver tu mano
    </span>`;
  container.appendChild(title);

  const poolDiv = document.createElement("div");
  poolDiv.className = "mission-pool";

  const levels = ["Level 1","Level 2","Level 3","Level 4"];
  const labels = { "Level 1":"Nivel 1", "Level 2":"Nivel 2", "Level 3":"Nivel 3", "Level 4":"Nivel 4" };

  for (const lvl of levels) {
    const col = document.createElement("div");
    col.className = "mission-col";
    const colTitle = document.createElement("div");
    colTitle.className = "mission-col-title";
    colTitle.style.color = LVL_COLOR[lvl]?.acc || "#fff";
    colTitle.textContent = labels[lvl];
    col.appendChild(colTitle);

    const missions = pool[lvl] || [];
    if (missions.length === 0) {
      const empty = document.createElement("div");
      empty.style.fontSize = "10px"; empty.style.color = "#aaa"; empty.style.fontStyle = "italic";
      empty.textContent = "Sin misiones disponibles";
      col.appendChild(empty);
    } else {
      for (const m of missions) {
        col.appendChild(renderMissionCard(m, {
          myPoints, canTake: canTake && !activeMission, onTake
        }));
      }
    }
    poolDiv.appendChild(col);
  }

  container.appendChild(poolDiv);
}

window.MissionRender = { renderMissionPool, renderMissionCard };
