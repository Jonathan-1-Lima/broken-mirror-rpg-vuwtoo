/* =========================================================
   net.js
   Multiplayer simples (WebSocket).

   Como usar:
   - Na tela de escolha, digite o MESMO codigo da sala (ex.: MIRROR)
   - Ate MAX_PLAYERS pessoas (padrao 8). Para ampliar: js/data.js e server.py

   Sem codigo, o jogo continua sozinho (nao tenta conectar).

   O que viaja pela rede: posicao, mapa, pose, chat, dados, assento.
   Nada de senha, e-mail ou dado pessoal.
   ========================================================= */

const net = {
  ws: null,
  id: null,
  connected: false,
  room: "",
  lastSent: 0
};

function netUrl() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return proto + "//" + location.host + "/ws";
}

function netLabel(text) {
  const el = document.getElementById("hud-room");
  if (el) el.textContent = text;
}

net.send = function (obj) {
  if (!net.ws || net.ws.readyState !== 1) return;
  try {
    net.ws.send(JSON.stringify(obj));
  } catch (err) {
    /* conexao caiu no meio do envio: o onclose trata */
  }
};

net.tick = function () {
  if (!net.connected || !engine.player || !engine.map) return;
  const now = performance.now();
  if (now - net.lastSent < 80) return;
  net.lastSent = now;
  const p = engine.player;
  net.send({
    type: "state",
    x: Math.round(p.x),
    y: Math.round(p.y),
    dir: p.dir,
    walkFrame: p.walkFrame,
    seated: !!p.seated,
    seatId: p.seatId,
    mapId: engine.map.id,
    pose: p.pose && p.poseUntil > now ? p.pose : null
  });
};

function applyRemoteList(list) {
  engine.remotes = (list || []).map((r) => {
    const prev = (engine.remotes || []).find((p) => p.id === r.id) || {};
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
      sheet: sheetForChar(r.charId)
    };
  });
}

function applySeats(seats) {
  if (!seats) return;
  tableSystem.seats = Object.assign(tableSystem.seats, seats);
  if (tableSystem.panelOpen) renderTableUI();
}

function onNetMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch (err) {
    return;
  }
  if (msg.type === "welcome") {
    net.id = msg.id;
    net.connected = true;
    netLabel("sala " + net.room + "  " + msg.count + "/" + (msg.max || MAX_PLAYERS));
    applyRemoteList(msg.players);
    applySeats(msg.seats);
    addChatMessage("Sala", "Conectado. " + msg.count + " de " + (msg.max || MAX_PLAYERS) + " lugares.", "sys");
    return;
  }
  if (msg.type === "players") {
    applyRemoteList(msg.players);
    if (msg.count != null) netLabel("sala " + net.room + "  " + msg.count + "/" + (msg.max || MAX_PLAYERS));
    return;
  }
  if (msg.type === "seats") {
    applySeats(msg.seats);
    if (msg.locked != null) tableSystem.locked = msg.locked;
    if (msg.turnSeat !== undefined) tableSystem.turnSeat = msg.turnSeat;
    if (tableSystem.panelOpen) renderTableUI();
    return;
  }
  if (msg.type === "chat") {
    addChatMessage(msg.name, msg.text, msg.kind || "");
    return;
  }
  if (msg.type === "dice") {
    addChatMessage(msg.name, "rolou  " + diceLine(msg.items), "sys");
    animateDice(msg.items, true);
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
  }
}

net.join = function (room, name, charId) {
  net.room = (room || "").replace(/[^A-Z0-9]/gi, "").slice(0, 8).toUpperCase();
  if (!net.room) return;
  netLabel("conectando...");
  let ws;
  try {
    ws = new WebSocket(netUrl());
  } catch (err) {
    netLabel("solo");
    toast("Multiplayer indisponivel. Jogando sozinho.");
    return;
  }
  net.ws = ws;
  ws.onopen = function () {
    net.send({ type: "join", room: net.room, name: name, charId: charId });
  };
  ws.onmessage = function (ev) {
    onNetMessage(ev.data);
  };
  ws.onclose = function () {
    net.connected = false;
    engine.remotes = [];
    if (net.room) netLabel("sala " + net.room + " (offline)");
  };
  ws.onerror = function () {
    toast("Servidor da sala nao respondeu. Voce continua sozinho.");
    netLabel("solo");
  };
};
