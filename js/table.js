/* =========================================================
   table.js
   Sistema da mesa do primeiro site, adaptado para este visual 2D.

   O que faz:
   - 1 Mestre (GM) + 7 jogadores
   - sentar / levantar
   - travar / destravar a mesa (so o Mestre)
   - liberar a vez de um jogador (so o Mestre)
    - kit de dados (d4 d6 d8 d10 d% d12 d20), ate 4 por rolagem
    - cada dado tem forma/cor propria; numeros 100% aleatorios

   Por enquanto e single-player (voce ocupa os assentos sozinho).
   Depois da para ligar multiplayer sem mudar o visual.
   ========================================================= */

const tableSystem = {
  mySeat: null,          /* "GM", "P1"... ou null */
  locked: false,         /* mesa travada pelo mestre? */
  turnSeat: null,        /* de quem e a vez de rolar */
  rolling: false,        /* dado ainda girando? */
  panelOpen: false,      /* painel visivel? */
  pool: ["d20"],         /* ids dos dados montados (max MAX_DICE) */
  lastRoll: null,        /* ultimo resultado: lista de cada dado (sem soma) */
  pickSeat: "",          /* assento escolhido no select do mestre */
  /* quem esta em cada cadeira (nome do jogador ou null) */
  seats: { GM: null, P1: null, P2: null, P3: null, P4: null, P5: null, P6: null, P7: null }
};

function $(id) {
  return document.getElementById(id);
}

function playerName() {
  return (window.game && game.displayName) || "Jogador";
}

function isGM() {
  return tableSystem.mySeat === "GM";
}

function canRoll() {
  if (!tableSystem.mySeat || tableSystem.rolling) return false;
  if (isGM() && !tableSystem.turnSeat) return true;
  return tableSystem.turnSeat === tableSystem.mySeat;
}

function tableLockedForMe() {
  return !!(tableSystem.locked && tableSystem.mySeat && !isGM());
}

function nearTable() {
  if (!engine.map || engine.map.id !== "games") return false;
  const p = engine.player;
  const table = (engine.map.furniture || []).find((f) => f.label === "mesa");
  if (!table) return false;
  const box = {
    x: table.x * TILE - 18,
    y: table.y * TILE - 18,
    w: table.w * TILE + 36,
    h: table.h * TILE + 36
  };
  return aabb({ x: p.x, y: p.y, w: PLAYER_W, h: PLAYER_H }, box);
}

function renderTableUI() {
  $("my-seat-label").textContent = tableSystem.mySeat || "nenhum";
  $("gm-label").textContent = tableSystem.seats.GM || "ninguem";
  const turnEl = $("turn-label");
  if (turnEl) {
    const who = tableSystem.turnSeat ? tableSystem.seats[tableSystem.turnSeat] : null;
    turnEl.textContent = tableSystem.turnSeat
      ? (tableSystem.turnSeat + (who ? " (" + who + ")" : ""))
      : "ninguem";
  }
  const lockEl = $("lock-label");
  if (lockEl) lockEl.textContent = tableSystem.locked ? "travada" : "aberta";
  $("gm-area").classList.toggle("hidden", !isGM());
  $("btn-roll-dice").disabled = !canRoll() || !tableSystem.pool.length;
  const leaveBtn = $("btn-leave-seat");
  if (leaveBtn) leaveBtn.disabled = tableLockedForMe();
  renderDiceTray();

  const grid = $("seats-grid");
  grid.innerHTML = "";
  SEAT_ORDER.forEach((id) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "seat-btn";
    const who = tableSystem.seats[id];
    btn.textContent = who ? id + "\n(" + who + ")" : id + "\n(vazio)";
    if (who) btn.classList.add("occupied");
    if (tableSystem.mySeat === id) btn.classList.add("me");
    if (id === "GM") btn.classList.add("gm");
    if (tableSystem.turnSeat === id) btn.classList.add("turn");
    btn.addEventListener("click", () => sitOnSeat(id));
    grid.appendChild(btn);
  });

  const sel = $("turn-select");
  if (sel && document.activeElement !== sel) {
    const keep = tableSystem.pickSeat || sel.value;
    sel.innerHTML = "";
    SEAT_ORDER.forEach((id) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = id + (tableSystem.seats[id] ? " (" + tableSystem.seats[id] + ")" : " vazio");
      sel.appendChild(opt);
    });
    const pick = keep || tableSystem.turnSeat || "";
    if (pick && Array.from(sel.options).some((o) => o.value === pick)) sel.value = pick;
  }
}

function openTablePanel() {
  tableSystem.panelOpen = true;
  $("table-panel").classList.remove("hidden");
  renderTableUI();
}

function closeTablePanel() {
  tableSystem.panelOpen = false;
  $("table-panel").classList.add("hidden");
}

function sitOnSeat(seatId) {
  if (tableLockedForMe() && tableSystem.mySeat !== seatId) {
    toast("A mesa esta travada. Voce fica no assento.");
    return;
  }
  if (tableSystem.locked && !isGM() && tableSystem.mySeat !== seatId) {
    toast("A mesa esta travada pelo mestre.");
    return;
  }
  if (tableSystem.mySeat && tableSystem.mySeat !== seatId) {
    toast("Levante antes de trocar de lugar.");
    return;
  }
  if (tableSystem.seats[seatId] && tableSystem.mySeat !== seatId) {
    toast("Esse assento ja esta ocupado.");
    return;
  }

  const seat = (engine.map.seats || []).find((s) => s.id === seatId);
  if (!seat) return;

  if (tableSystem.mySeat) tableSystem.seats[tableSystem.mySeat] = null;
  tableSystem.mySeat = seatId;
  tableSystem.seats[seatId] = playerName();
  seat.occupied = true;

  engine.player.seated = true;
  engine.player.seatId = seatId;
  engine.player.x = seat.x * TILE;
  engine.player.y = seat.y * TILE - 10;
  engine.player.dir = "front";

  renderTableUI();
  toast(seatId === "GM" ? "Voce assumiu o lugar do Mestre." : "Voce se sentou. Aguarde o mestre.");
  if (window.net && net.connected) net.send({ type: "sit", seat: seatId });
}

function standUp() {
  if (tableLockedForMe()) {
    toast("A mesa esta travada. So emotes ate o mestre destravar.");
    return;
  }
  const p = engine.player;
  const seat = (engine.map.seats || []).find((s) => s.id === p.seatId);
  if (seat) seat.occupied = false;
  if (tableSystem.mySeat) tableSystem.seats[tableSystem.mySeat] = null;
  if (tableSystem.turnSeat === tableSystem.mySeat) tableSystem.turnSeat = null;

  const exit = (seat && seat.exit) || { dx: 0, dy: 1.4 };
  p.x += exit.dx * TILE;
  p.y += exit.dy * TILE;
  p.seated = false;
  p.seatId = null;
  tableSystem.mySeat = null;
  closeTablePanel();
  if (window.net && net.connected) net.send({ type: "stand" });
}

function findDie(id) {
  return DICE_TYPES.find((d) => d.id === id) || DICE_TYPES[DICE_TYPES.length - 1];
}

/* Inteiro aleatorio em [min, max] (inclusivo). crypto > Math.random. */
function randomInt(min, max) {
  const span = max - min + 1;
  if (window.crypto && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return min + (buf[0] % span);
  }
  return min + Math.floor(Math.random() * span);
}

function rollOne(type) {
  if (type.kind === "units") {
    const n = randomInt(0, 9);
    return { id: type.id, label: type.label, shape: type.shape, value: n, text: String(n) };
  }
  if (type.kind === "tens") {
    const n = randomInt(0, 9) * 10;
    return { id: type.id, label: type.label, shape: type.shape, value: n, text: n < 10 ? "00" : String(n) };
  }
  const n = randomInt(1, type.sides);
  return { id: type.id, label: type.label, shape: type.shape, value: n, text: String(n) };
}

/* ------------------------------------------------------------
   RESULTADO DOS DADOS  (onde mudar o que aparece na tela)
   - showDiceResults()  -> painel da mesa (os numerinhos de cada dado)
   - animateDice()      -> overlay grande, um numero em cima de cada forma
   Nao somamos os dados. Cada um mostra so o que tirou.
   ------------------------------------------------------------ */
function showDiceResults(items) {
  const box = $("dice-panel-result");
  if (!box) return;
  box.innerHTML = "";
  if (!items || !items.length) {
    const empty = document.createElement("span");
    empty.className = "pool-empty";
    empty.textContent = "nenhum resultado ainda";
    box.appendChild(empty);
    return;
  }
  items.forEach((item) => {
    const cell = document.createElement("div");
    cell.className = "die-result";
    const shape = document.createElement("span");
    shape.className = "die-shape " + item.shape;
    const val = document.createElement("b");
    val.textContent = item.text;
    const lab = document.createElement("em");
    lab.textContent = item.label;
    cell.append(shape, val, lab);
    box.appendChild(cell);
  });
}

function diceLine(items) {
  return (items || []).map((i) => i.label + " " + i.text).join("   ");
}

function addDie(id) {
  if (tableSystem.pool.length >= MAX_DICE) {
    toast("No maximo " + MAX_DICE + " dados por vez.");
    return;
  }
  tableSystem.pool.push(id);
  renderDiceTray();
}

function removeDie(index) {
  tableSystem.pool.splice(index, 1);
  renderDiceTray();
}

function clearDice() {
  tableSystem.pool = [];
  tableSystem.lastRoll = null;
  showDiceResults([]);
  renderDiceTray();
}

function renderDiceTray() {
  const kinds = $("dice-kinds");
  const pool = $("dice-pool");
  if (!kinds || !pool) return;
  kinds.innerHTML = "";
  DICE_TYPES.forEach((t) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "die-pick";
    btn.disabled = tableSystem.pool.length >= MAX_DICE;
    const shape = document.createElement("span");
    shape.className = "die-shape " + t.shape;
    const lab = document.createElement("em");
    lab.textContent = t.label;
    btn.append(shape, lab);
    btn.addEventListener("click", () => addDie(t.id));
    kinds.appendChild(btn);
  });

  pool.innerHTML = "";
  if (!tableSystem.pool.length) {
    const empty = document.createElement("span");
    empty.className = "pool-empty";
    empty.textContent = "Nenhum dado na bandeja";
    pool.appendChild(empty);
  } else {
    tableSystem.pool.forEach((id, i) => {
      const t = findDie(id);
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "die-chip";
      chip.title = "remover";
      const shape = document.createElement("span");
      shape.className = "die-shape tiny " + t.shape;
      const lab = document.createElement("em");
      lab.textContent = t.label;
      chip.append(shape, lab);
      chip.addEventListener("click", () => removeDie(i));
      pool.appendChild(chip);
    });
  }
  const rollBtn = $("btn-roll-dice");
  if (rollBtn) rollBtn.disabled = !canRoll() || !tableSystem.pool.length;
}

function animateDice(items, fromNet) {
  tableSystem.rolling = true;
  const rollBtn = $("btn-roll-dice");
  if (rollBtn) rollBtn.disabled = true;
  const layer = $("dice-layer");
  const row = $("dice-row");
  const label = $("dice-label");
  layer.classList.remove("hidden");
  label.textContent = "rolando...";
  showDiceResults([]);

  row.innerHTML = "";
  items.forEach((item) => {
    const wrap = document.createElement("div");
    wrap.className = "die-face";
    const shape = document.createElement("span");
    shape.className = "die-shape spin " + item.shape;
    const num = document.createElement("b");
    num.textContent = "";
    wrap.append(shape, num);
    row.appendChild(wrap);
  });

  setTimeout(() => {
    Array.from(row.children).forEach((wrap, i) => {
      wrap.querySelector(".die-shape").classList.remove("spin");
      wrap.querySelector("b").textContent = items[i].text;
    });
    label.textContent = items.length > 1 ? "cada dado" : "resultado";
    showDiceResults(items);
    tableSystem.rolling = false;
    tableSystem.lastRoll = { items };
    renderTableUI();

    const only20 = items.length === 1 && items[0].id === "d20";
    const msg = only20 && items[0].value === 20
      ? "Acerto critico!  d20 20"
      : only20 && items[0].value === 1
        ? "Falha critica...  d20 1"
        : diceLine(items);
    toast(msg);
    if (!fromNet) addChatMessage(playerName(), "rolou  " + diceLine(items), "sys");
    setTimeout(() => layer.classList.add("hidden"), 1800);
  }, 900);
}

function tryRoll() {
  if (!engine.player || !engine.player.seated) {
    toast("Sente-se na mesa para rolar o dado.");
    return;
  }
  if (!canRoll()) {
    toast("Espere o mestre liberar a sua vez.");
    return;
  }
  if (!tableSystem.pool.length) {
    toast("Monte pelo menos um dado na bandeja.");
    return;
  }
  const items = tableSystem.pool.map((id) => rollOne(findDie(id)));
  animateDice(items, false);
  if (window.net && net.connected) net.send({ type: "dice", items, name: playerName() });
}

function bindTableUI() {
  $("btn-close-table").addEventListener("click", closeTablePanel);
  $("btn-leave-seat").addEventListener("click", standUp);
  $("btn-roll-dice").addEventListener("click", tryRoll);
  $("btn-clear-dice").addEventListener("click", clearDice);
  renderDiceTray();
  showDiceResults([]);
  $("btn-lock").addEventListener("click", () => {
    if (!isGM()) {
      toast("Sente no lugar do Mestre para travar a mesa.");
      return;
    }
    tableSystem.locked = true;
    renderTableUI();
    toast("Mesa travada. Jogadores ficam no assento (so emotes).");
    if (window.net && net.connected) net.send({ type: "lock", locked: true });
  });
  $("btn-unlock").addEventListener("click", () => {
    if (!isGM()) return;
    tableSystem.locked = false;
    renderTableUI();
    toast("Mesa destrava.");
    if (window.net && net.connected) net.send({ type: "lock", locked: false });
  });
  const turnSel = $("turn-select");
  if (turnSel) {
    turnSel.addEventListener("change", () => {
      tableSystem.pickSeat = turnSel.value;
    });
  }
  $("btn-grant-turn").addEventListener("click", () => {
    if (!isGM()) return;
    const seat = tableSystem.pickSeat || $("turn-select").value;
    if (!seat) {
      toast("Escolha um assento.");
      return;
    }
    if (!tableSystem.seats[seat]) {
      toast("Esse assento esta vazio.");
      return;
    }
    tableSystem.pickSeat = seat;
    tableSystem.turnSeat = seat;
    renderTableUI();
    toast("Vez liberada: " + seat + " (" + tableSystem.seats[seat] + ")");
    if (window.net && net.connected) net.send({ type: "turn", seat: seat });
  });
}

tableSystem.openPanel = openTablePanel;
tableSystem.closePanel = closeTablePanel;
tableSystem.tryRoll = tryRoll;
tableSystem.nearTable = nearTable;
tableSystem.standUp = standUp;
tableSystem.lockedForMe = tableLockedForMe;
