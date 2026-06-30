// ════════════════════════════════════════════════════════════════
// CARD RENDER — Cartas en HTML/CSS puro (sin imágenes)
// ════════════════════════════════════════════════════════════════

function renderCard(card, {
  small = false,
  selected = false,
  faceDown = false,
  onClick = null,          // click en la carta -> jugarla de inmediato
  onSignalClick = null,    // click en el botón 📡 -> seleccionarla para señal
  hidePersonality = false, // Fase 1 del tutorial: solo números, sin color ni personalidad
} = {}) {
  const div = document.createElement("div");
  div.className = `bst-card ${small ? "small" : ""} ${selected ? "selected" : ""} ${faceDown ? "face-down" : ""}`;
  div.style.position = "relative";

  if (faceDown || !card) {
    div.textContent = "BST";
    if (onClick) div.onclick = onClick;
    return div;
  }

  const topBand = document.createElement("div");
  topBand.className = hidePersonality ? "band-top type-Gray" : `band-top type-${card.type}`;
  topBand.innerHTML = `<span>${card.number}</span><span>${card.number}</span>`;

  const numberDiv = document.createElement("div");
  numberDiv.className = "number";
  numberDiv.textContent = card.number;

  div.appendChild(topBand);
  div.appendChild(numberDiv);

  if (!small) {
    const classBar = document.createElement("div");
    classBar.className = "class-bar";
    classBar.textContent = card.cardClass;
    div.appendChild(classBar);
  }

  const persBand = document.createElement("div");
  if (hidePersonality) {
    persBand.className = "pers-band pers-Common";
    persBand.textContent = small ? "?" : "?";
  } else {
    persBand.className = `pers-band pers-${card.personality}`;
    persBand.textContent = small ? card.personality[0] : card.personality;
  }
  div.appendChild(persBand);

  if (onClick) div.onclick = onClick;

  // Botón pequeño de señal, esquina superior derecha (solo si se pasa el handler)
  if (onSignalClick && !small && !hidePersonality) {
    const sigBtn = document.createElement("button");
    sigBtn.className = "card-signal-btn";
    sigBtn.textContent = "📡";
    sigBtn.title = "Usar esta carta para una señal";
    sigBtn.onclick = (e) => { e.stopPropagation(); onSignalClick(); };
    div.appendChild(sigBtn);
  }

  return div;
}

window.CardRender = { renderCard };
