// ════════════════════════════════════════════════════════════════
// CARD RENDER — Cartas en HTML/CSS puro (sin imágenes)
// ════════════════════════════════════════════════════════════════

function renderCard(card, { small = false, selected = false, faceDown = false, onClick = null } = {}) {
  const div = document.createElement("div");
  div.className = `bst-card ${small ? "small" : ""} ${selected ? "selected" : ""} ${faceDown ? "face-down" : ""}`;

  if (faceDown || !card) {
    div.textContent = "BST";
    if (onClick) div.onclick = onClick;
    return div;
  }

  const topBand = document.createElement("div");
  topBand.className = `band-top type-${card.type}`;
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
  persBand.className = `pers-band pers-${card.personality}`;
  persBand.textContent = small ? card.personality[0] : card.personality;
  div.appendChild(persBand);

  if (onClick) div.onclick = onClick;
  return div;
}

window.CardRender = { renderCard };
