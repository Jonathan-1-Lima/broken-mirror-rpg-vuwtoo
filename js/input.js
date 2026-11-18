/* =========================================================
   input.js
   Teclado (PC) + joystick (celular).
   Nao move o player sozinho: so guarda o estado.
   O motor (engine.js) le isso a cada frame.
   ========================================================= */

const input = {
  keys: Object.create(null),
  vx: 0,              /* joystick horizontal (-1 a 1) */
  vy: 0,              /* joystick vertical (-1 a 1) */
  actionQueued: false /* E foi apertado neste frame? */
};

function bindKeyboard() {
  window.addEventListener("keydown", (e) => {
    input.keys[e.code] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
    /* Se estiver digitando no chat/nome, nao captura o resto */
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (e.code === "KeyE") queueAction();
    if (e.code === "KeyR" && window.tableSystem) tableSystem.tryRoll();
    if (e.code === "F1") {
      e.preventDefault();
      if (window.game) game.toggleDebug();
    }
    if (e.code.startsWith("Digit") && window.game) {
      const n = Number(e.code.replace("Digit", ""));
      if (n >= 1 && n <= EMOTES.length) game.showEmote(EMOTES[n - 1]);
    }
    const chatDock = document.getElementById("chat-dock");
    const chatClosed = !chatDock || chatDock.classList.contains("closed");
    if (e.code === "Enter" && chatClosed && window.game && game.openChat && document.getElementById("game").classList.contains("active")) {
      e.preventDefault();
      game.openChat();
      return;
    }
    if (e.code === "Escape") {
      if (window.game && game.closeChat) game.closeChat();
      if (window.tableSystem) tableSystem.closePanel();
      if (typeof showScreenKeepGame === "function") showScreenKeepGame();
    }
  });
  window.addEventListener("keyup", (e) => {
    input.keys[e.code] = false;
  });
}

function queueAction() {
  input.actionQueued = true;
}

function consumeAction() {
  if (input.actionQueued) {
    input.actionQueued = false;
    return true;
  }
  return false;
}

function keyboardVector() {
  let x = 0;
  let y = 0;
  if (input.keys.KeyA || input.keys.ArrowLeft) x -= 1;
  if (input.keys.KeyD || input.keys.ArrowRight) x += 1;
  if (input.keys.KeyW || input.keys.ArrowUp) y -= 1;
  if (input.keys.KeyS || input.keys.ArrowDown) y += 1;
  return { x, y };
}

/* Joystick virtual: arraste o circulo no canto inferior esquerdo. */
function bindStick() {
  const stick = document.getElementById("stick");
  const knob = document.getElementById("knob");
  if (!stick || !knob) return;
  let active = false;
  let origin = { x: 0, y: 0 };

  function pos(e) {
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX, y: t.clientY };
  }
  function start(e) {
    active = true;
    origin = pos(e);
    move(e);
  }
  function move(e) {
    if (!active) return;
    const p = pos(e);
    let dx = p.x - origin.x;
    let dy = p.y - origin.y;
    const max = 36;
    const len = Math.hypot(dx, dy) || 1;
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.vx = dx / max;
    input.vy = dy / max;
  }
  function end() {
    active = false;
    input.vx = 0;
    input.vy = 0;
    knob.style.transform = "translate(0,0)";
  }

  stick.addEventListener("pointerdown", start);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  stick.addEventListener("touchstart", (e) => { e.preventDefault(); start(e); }, { passive: false });
  window.addEventListener("touchmove", (e) => { if (active) e.preventDefault(); move(e); }, { passive: false });
  window.addEventListener("touchend", end);

  const actionBtn = document.getElementById("btn-action");
  if (actionBtn) actionBtn.addEventListener("click", queueAction);
  const emoteBtn = document.getElementById("btn-emote-mobile");
  if (emoteBtn) {
    emoteBtn.addEventListener("click", () => {
      document.getElementById("emote-bar").classList.toggle("hidden");
    });
  }
}

/* Junta teclado + joystick e devolve um vetor de movimento. */
function movement() {
  const k = keyboardVector();
  let x = k.x || input.vx;
  let y = k.y || input.vy;
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y };
}
