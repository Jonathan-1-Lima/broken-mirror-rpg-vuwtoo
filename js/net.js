/* =========================================================
   net.js
   Multiplayer: HTTP /api (Render/HTTPS) e WebSocket /ws (local).
   Mesmo codigo da sala = mesmo mundo. Sem codigo, joga sozinho.
   ========================================================= */

window.net = {
  ws: null,
  id: null,
  connected: false,
  mode: "",
  room: "",
  lastSent: 0,
  pollTimer: 0,
  pending: null,
  seenDice: "",
  joinName: "",
  joinChar: ""
};

var net = window.net;

function netUrl() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return proto + "//" + location.host + "/ws";
}

function netLabel(text) {
  const el = document.getElementById("hud-room");
  if (el) el.textContent = text;
}

function othersOf(list) {
  return (list || []).filter((p) => p && p.id && p.id !== net.id);
}

net.send = function (obj) {
  if (!obj) return;
  if (net.mode === "ws" && net.ws && net.ws.readyState === 1) {
    try {
      net.ws.send(JSON.stringify(obj));
    } catch (err) { /* onclose trata */ }
    return;
  }
  if (net.mode === "http" && obj.type !== "state") net.pending = obj;
};

net.tick = function () {
  if (!net.connected || !engine.player || !engine.map) return;
  if (net.mode !== "ws") return;
  const now = performance.now();
  if (now - net.lastSent < 80) return;
  net.lastSent = now;
  net.send(net.snapshot());
};

net.snapshot = function () {
  const p = engine.player;
  if (!p) return { type: "state" };
  const now = performance.now();
  return {
    type: "state",
    x: Math.round(p.x),
    y: Math.round(p.y),
    dir: p.dir,
    walkFrame: p.walkFrame,
    seated: !!p.seated,
    seatId: p.seatId,
    mapId: engine.map ? engine.map.id : "hall",
    pose: p.pose && p.poseUntil > now ? p.pose : null
  };
};

function applyRemoteList(list) {
  engine.remotes = othersOf(list).map((r) => {
    const prev = (engine.remotes || []).find((p) => p.id === r.id) || {};
    let sheet = prev.sheet;
    try {
      sheet = sheet || sheetForChar(r.charId);
    } catch (err) {
      sheet = prev.sheet;
    }
    return {
      id: r.id,
      name: r.name,
      charId: r.charId,
      x: r.x,
      y: r.y,
      dir: r.dir || "front",
      walkFrame: r.walkFrame || 0,
      seated: !!r.seated,
      seatId: r.seatId,
      mapId: r.mapId || "hall",
      pose: r.pose || prev.pose,
      poseUntil: r.pose ? (prev.poseUntil || performance.now() + 1200) : 0,
      sheet: sheet
    };
  });
}

function applySeats(seats, locked, turnSeat) {
  if (seats) tableSystem.seats = Object.assign(tableSystem.seats, seats);
  if (locked != null) tableSystem.locked = locked;
  if (turnSeat !== undefined) tableSystem.turnSeat = turnSeat;
  if (tableSystem.panelOpen) renderTableUI();
}

function applyDice(msg) {
  if (!msg || !msg.items) return;
  const key = (msg.from || msg.name) + ":" + msg.items.map((i) => i.text).join(",");
  if (key === net.seenDice) return;
  net.seenDice = key;
  if (msg.from && msg.from === net.id) return;
  addChatMessage(msg.name, "rolou  " + diceLine(msg.items), "sys");
  animateDice(msg.items, true);
}

function onNetMessage(msg) {
  if (!msg || !msg.type) return;
  if (msg.type === "welcome") {
    net.id = msg.id;
    net.connected = true;
    netLabel("sala " + net.room + "  " + msg.count + "/" + (msg.max || MAX_PLAYERS));
    applyRemoteList(msg.players);
    applySeats(msg.seats, msg.locked, msg.turnSeat);
    if (engine.player && msg.x != null) {
      engine.player.x = msg.x;
      engine.player.y = msg.y;
    }
    addChatMessage("Sala", "Conectado. " + msg.count + " de " + (msg.max || MAX_PLAYERS) + " na sala.", "sys");
    return;
  }
  if (msg.type === "players") {
    applyRemoteList(msg.players);
    if (msg.count != null) netLabel("sala " + net.room + "  " + msg.count + "/" + (msg.max || MAX_PLAYERS));
    return;
  }
  if (msg.type === "sync") {
    net.connected = true;
    applyRemoteList(msg.players);
    applySeats(msg.seats, msg.locked, msg.turnSeat);
    if (msg.count != null) netLabel("sala " + net.room + "  " + msg.count + "/" + (msg.max || MAX_PLAYERS));
    (msg.events || []).forEach(onNetMessage);
    return;
  }
  if (msg.type === "seats") {
    applySeats(msg.seats, msg.locked, msg.turnSeat);
    return;
  }
  if (msg.type === "chat") {
    addChatMessage(msg.name, msg.text, msg.kind || "");
    return;
  }
  if (msg.type === "dice") {
    applyDice(msg);
    return;
  }
  if (msg.type === "pose") {
    const who = (engine.remotes || []).find((r) => r.id === msg.id);
    if (who) {
      who.pose = msg.pose;
      who.poseUntil = performance.now() + (msg.ms || 1800);
    }
    return;
  }
  if (msg.type === "full") {
    toast(msg.reason || "Sala cheia.");
    netLabel("sala cheia");
    return;
  }
  if (msg.type === "error") {
    toast(msg.reason || "Nao foi possivel entrar.");
    if (msg.reason && msg.reason.indexOf("expirada") >= 0) {
      net.connected = false;
      if (net.room && net.joinName) joinHttp(net.room, net.joinName, net.joinChar);
    }
  }
}

function postApi(path, body, cb) {
  fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then((res) => res.json()).then(cb).catch(() => cb(null));
}

function startPoll() {
  if (net.pollTimer) {
    clearTimeout(net.pollTimer);
    net.pollTimer = 0;
  }
  if (net.mode === "ws" && net.connected) return;
  net.mode = "http";
  const body = { id: net.id, state: net.snapshot() };
  if (net.pending) {
    body.event = net.pending;
    net.pending = null;
  }
  postApi("/api/sync", body, (msg) => {
    if (!msg) {
      netLabel("sala " + net.room + " (offline)");
      net.pollTimer = setTimeout(startPoll, 900);
      return;
    }
    onNetMessage(msg);
    net.pollTimer = setTimeout(startPoll, 220);
  });
}

function joinHttp(room, name, charId) {
  postApi("/api/join", { room: room, name: name, charId: charId }, (msg) => {
    if (!msg || (msg.type !== "welcome" && msg.type !== "sync")) {
      toast("Servidor da sala nao respondeu. Recarregue a pagina (Ctrl+F5) no link do Render.");
      netLabel("solo");
      return;
    }
    net.mode = "http";
    onNetMessage(msg);
    startPoll();
  });
}

net.join = function (room, name, charId) {
  net.room = (room || "").replace(/[^A-Z0-9]/gi, "").slice(0, 8).toUpperCase();
  net.joinName = name || "Jogador";
  net.joinChar = charId || "chindu";
  if (!net.room) {
    netLabel("solo");
    return;
  }
  net.connected = false;
  net.id = null;
  net.mode = "";
  if (net.pollTimer) {
    clearTimeout(net.pollTimer);
    net.pollTimer = 0;
  }
  if (net.ws) {
    try { net.ws.close(); } catch (err) { /* ok */ }
    net.ws = null;
  }
  netLabel("conectando...");

  /* HTTPS (Render): HTTP primeiro. O proxy costuma engolir o WebSocket caseiro. */
  if (location.protocol === "https:") {
    joinHttp(net.room, net.joinName, net.joinChar);
    return;
  }

  let ws;
  try {
    ws = new WebSocket(netUrl());
  } catch (err) {
    joinHttp(net.room, net.joinName, net.joinChar);
    return;
  }
  net.ws = ws;
  const fallback = setTimeout(() => {
    if (net.connected) return;
    try { ws.close(); } catch (err) { /* ok */ }
    joinHttp(net.room, net.joinName, net.joinChar);
  }, 1200);
  ws.onopen = function () {
    net.mode = "ws";
    net.send({ type: "join", room: net.room, name: net.joinName, charId: net.joinChar });
  };
  ws.onmessage = function (ev) {
    clearTimeout(fallback);
    let msg;
    try { msg = JSON.parse(ev.data); } catch (err) { return; }
    onNetMessage(msg);
  };
  ws.onclose = function () {
    if (net.mode === "ws") {
      net.connected = false;
      engine.remotes = [];
      if (net.room) joinHttp(net.room, net.joinName, net.joinChar);
    }
  };
  ws.onerror = function () {
    /* o timeout cai no HTTP */
  };
};
