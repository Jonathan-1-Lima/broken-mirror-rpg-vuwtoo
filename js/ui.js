/* =========================================================
   ui.js
   Telas (inicio, origem, escolha), avisos, chat e troca de avatar.
   ========================================================= */

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

/* Volta para o jogo se a tela de escolha foi aberta pelo espelho. */
function showScreenKeepGame() {
  const select = document.getElementById("select");
  if (select.classList.contains("active") && engine.running) {
    const startBtn = document.getElementById("btn-start");
    startBtn.textContent = "Entrar na sala principal";
    showScreen("game");
    game.uiLocked = false;
  }
}

function toast(text, ms) {
  const el = document.getElementById("toast");
  el.textContent = text;
  el.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), ms || 2600);
}

function renderChars() {
  const grid = document.getElementById("char-grid");
  grid.innerHTML = "";
  CHARACTERS.forEach((ch) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "char-card";
    if (game.character && game.character.id === ch.id) card.classList.add("selected");

    const img = document.createElement("img");
    img.src = ch.portrait;
    img.alt = ch.name;
    img.width = 64;
    img.height = 64;

    const name = document.createElement("strong");
    name.textContent = ch.name;
    const role = document.createElement("span");
    role.textContent = ch.role;

    card.append(img, name, role);
    card.addEventListener("click", () => {
      game.character = ch;
      document.querySelectorAll(".char-card").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      syncStart();
    });
    grid.appendChild(card);
  });
}

function syncStart() {
  const name = document.getElementById("player-name").value.trim();
  document.getElementById("btn-start").disabled = !(game.character && name);
}

function renderEmotes() {
  const list = document.getElementById("emote-list");
  list.innerHTML = "";
  EMOTES.forEach((e, i) => {
    const b = document.createElement("button");
    b.type = "button";
    const k = document.createElement("small");
    k.textContent = String(i + 1);
    b.append(k, document.createTextNode(" " + e.label));
    b.addEventListener("click", () => game.showEmote(e));
    list.appendChild(b);
  });
}

function addChatMessage(name, msg, kind) {
  const box = document.getElementById("chat-messages");
  if (!box) return;
  const el = document.createElement("div");
  el.className = "chat-msg" + (kind ? " " + kind : "");
  const meta = document.createElement("div");
  meta.className = "meta";
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  meta.textContent = name + " · " + time;
  const text = document.createElement("div");
  text.textContent = msg;
  el.append(meta, text);
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

function bindChat() {
  const dock = document.getElementById("chat-dock");
  const toggle = document.getElementById("btn-chat-toggle");
  const form = document.getElementById("chat-form");
  const inputEl = document.getElementById("chat-input");
  const hudBtn = document.getElementById("btn-chat");

  function setClosed(closed) {
    dock.classList.toggle("closed", closed);
    toggle.textContent = closed ? "Abrir" : "Fechar";
    game.uiLocked = !closed || tableSystem.panelOpen;
    if (!closed) setTimeout(() => inputEl.focus(), 40);
    else inputEl.blur();
  }

  game.openChat = function () {
    setClosed(false);
  };
  game.closeChat = function () {
    setClosed(true);
  };

  toggle.addEventListener("click", () => setClosed(!dock.classList.contains("closed")));
  if (hudBtn) hudBtn.addEventListener("click", () => setClosed(dock.classList.contains("closed")));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (!text) return;
    addChatMessage(game.displayName || "Voce", text);
    if (window.net && net.connected) net.send({ type: "chat", text: text });
    if (typeof bumpActive === "function") bumpActive();
    inputEl.value = "";
  });
}

function bindScreens() {
  document.getElementById("btn-enter").addEventListener("click", () => showScreen("select"));
  document.getElementById("btn-story").addEventListener("click", () => showScreen("story"));
  document.getElementById("btn-story-play").addEventListener("click", () => showScreen("select"));
  document.getElementById("btn-story-back").addEventListener("click", () => showScreen("landing"));
  document.getElementById("player-name").addEventListener("input", syncStart);
  document.getElementById("btn-start").addEventListener("click", startGame);
  document.getElementById("btn-emotes").addEventListener("click", () => {
    document.getElementById("emote-bar").classList.toggle("hidden");
  });
  document.getElementById("btn-help").addEventListener("click", () => {
    document.getElementById("help-card").classList.toggle("hidden");
  });
  document.getElementById("btn-help-close").addEventListener("click", () => {
    document.getElementById("help-card").classList.add("hidden");
  });
}

function applyCharacter(ch) {
  game.character = ch;
  if (engine.player) engine.player.sheet = buildSpriteSheet(ch.pal);
  const hud = document.getElementById("hud-char");
  hud.innerHTML = "";
  const mini = document.createElement("img");
  mini.src = ch.portrait;
  mini.alt = ch.name;
  hud.appendChild(mini);
}

function openMirrorSelect() {
  game.uiLocked = true;
  game.changingAvatar = true;
  const startBtn = document.getElementById("btn-start");
  startBtn.textContent = "Confirmar reflexo";
  document.getElementById("player-name").value = game.displayName;
  renderChars();
  syncStart();
  showScreen("select");
  toast("Escolha outro reflexo no espelho.");
}
