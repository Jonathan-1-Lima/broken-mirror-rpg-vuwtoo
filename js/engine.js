/* =========================================================
   engine.js
   Motor 2D: desenha o mapa, move o player, camera e colisao.
   Nao sabe de mesa/D20 — isso fica em table.js.
   ========================================================= */

const engine = {
  canvas: null,
  ctx: null,
  map: null,
  solids: [],
  player: null,
  remotes: [],          /* outros jogadores da mesma sala (multiplayer) */
  camera: { x: 0, y: 0 },
  debug: false,
  frame: 0,
  running: false
};

const remoteSheets = Object.create(null);

function sheetForChar(charId) {
  if (!remoteSheets[charId]) {
    remoteSheets[charId] = buildSpriteSheet(findCharacter(charId).pal);
  }
  return remoteSheets[charId];
}

/* Dois retangulos se tocam? */
function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/* O pe do personagem bate em alguma parede/mesa? */
function collide(nx, ny, solids) {
  const box = { x: nx, y: ny + 14, w: PLAYER_W, h: PLAYER_H - 12 };
  return solids.some((s) => aabb(box, { x: s.px, y: s.py, w: s.pw, h: s.ph }));
}

/* Achou algum item da lista perto do player? (portas, interacoes) */
function overlapList(list, pad) {
  const p = engine.player;
  const box = { x: p.x - pad, y: p.y - pad, w: PLAYER_W + pad * 2, h: PLAYER_H + pad * 2 };
  return (list || []).find((item) => {
    const r = item.px != null
      ? { x: item.px, y: item.py, w: item.pw, h: item.ph }
      : { x: item.x * TILE, y: item.y * TILE, w: (item.w || 1) * TILE, h: (item.h || 1) * TILE };
    return aabb(box, r);
  });
}

function loadMap(id, spawn) {
  const map = MAPS[id];
  engine.map = map;
  engine.solids = getSolids(map);
  const s = spawn || map.spawn;
  engine.player.x = s.x;
  engine.player.y = s.y;
  engine.player.seated = false;
  engine.player.seatId = null;
  prepareNpcs(map);
  document.getElementById("hud-map").textContent = map.name;
}

function drawFloor() {
  const { ctx, map, camera } = engine;
  ctx.fillStyle = "#16131b";
  ctx.fillRect(0, 0, engine.canvas.width, engine.canvas.height);
  const ox = -camera.x;
  const oy = -camera.y;

  map.floors.forEach((f) => {
    ctx.fillStyle = f.color;
    ctx.fillRect(f.x * TILE + ox, f.y * TILE + oy, f.w * TILE, f.h * TILE);
  });

  /* xadrez suave no chao (so visual) */
  for (let y = 2; y < map.h - 1; y++) {
    for (let x = 2; x < map.w - 1; x++) {
      if ((x + y) % 2 === 0) {
        ctx.fillStyle = "rgba(255,255,255,.03)";
        ctx.fillRect(x * TILE + ox, y * TILE + oy, TILE, TILE);
      }
    }
  }

  (map.rugs || []).forEach((r) => {
    ctx.fillStyle = r.color;
    ctx.fillRect(r.x * TILE + ox, r.y * TILE + oy, r.w * TILE, r.h * TILE);
    ctx.strokeStyle = "rgba(217,164,65,.35)";
    ctx.strokeRect(r.x * TILE + ox + 6, r.y * TILE + oy + 6, r.w * TILE - 12, r.h * TILE - 12);
  });
}

function drawWalls() {
  const { ctx, map, camera } = engine;
  const ox = -camera.x;
  const oy = -camera.y;
  map.walls.forEach((w) => {
    ctx.fillStyle = "#1c1824";
    ctx.fillRect(w.x * TILE + ox, w.y * TILE + oy, w.w * TILE, w.h * TILE);
    ctx.fillStyle = "#2a2433";
    ctx.fillRect(w.x * TILE + ox, w.y * TILE + oy, w.w * TILE, 6);
  });
}

function drawFurniture() {
  const { ctx, map, camera } = engine;
  const ox = -camera.x;
  const oy = -camera.y;
  (map.furniture || []).forEach((f) => {
    const x = f.x * TILE + ox;
    const y = f.y * TILE + oy;
    const w = f.w * TILE;
    const h = f.h * TILE;
    drawProp(ctx, f.kind || f.label, x, y, w, h, f.color);
  });

  (map.seats || []).forEach((s) => {
    const x = s.x * TILE + ox;
    const y = s.y * TILE + oy;
    ctx.fillStyle = s.role === "gm" ? "#7a1f1c" : "#2a3344";
    ctx.fillRect(x, y, 28, 22);
    ctx.fillStyle = s.occupied ? "#d9a441" : "#efe6d4";
    ctx.font = "700 9px Source Sans 3, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(s.role === "gm" ? "M" : "P", x + 14, y + 14);
  });
}

/* Desenha cada tipo de objeto. Para criar um novo, adicione um case. */
function drawProp(ctx, kind, x, y, w, h, color) {
  if (kind === "mirror") {
    ctx.fillStyle = "#1a222c";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#8aa0b8";
    ctx.fillRect(x + 6, y + 6, w - 12, h - 10);
    ctx.strokeStyle = "#c9d0d8";
    ctx.beginPath();
    ctx.moveTo(x + 18, y + 4);
    ctx.lineTo(x + w * 0.45, y + h - 4);
    ctx.moveTo(x + w * 0.6, y + 6);
    ctx.lineTo(x + w - 10, y + h - 6);
    ctx.stroke();
    ctx.fillStyle = "#e35a4f";
    ctx.fillRect(x + w * 0.5 - 2, y + 8, 3, h - 14);
    return;
  }
  if (kind === "table-rpg") {
    ctx.fillStyle = "#3a2418";
    ctx.fillRect(x - 4, y + h - 8, w + 8, 10);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#7a5338";
    ctx.fillRect(x + 8, y + 8, w - 16, h - 16);
    ctx.fillStyle = "#8d2d28";
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#efe6d4";
    ctx.font = "700 11px Cinzel, serif";
    ctx.textAlign = "center";
    ctx.fillText("D20", x + w / 2, y + h / 2 + 4);
    return;
  }
  if (kind === "fireplace") {
    ctx.fillStyle = "#2a1c18";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#7a2a1c";
    ctx.fillRect(x + 8, y + 10, w - 16, h - 14);
    ctx.fillStyle = "#d9a441";
    ctx.fillRect(x + w * 0.35, y + h * 0.45, 8, h * 0.4);
    ctx.fillStyle = "#e35a4f";
    ctx.fillRect(x + w * 0.5, y + h * 0.4, 8, h * 0.45);
    return;
  }
  if (kind === "shelf") {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#3a2418";
    ctx.fillRect(x + 4, y + 8, w - 8, 4);
    ctx.fillRect(x + 4, y + h * 0.55, w - 8, 4);
    ctx.fillStyle = "#8d2d28";
    ctx.fillRect(x + 8, y + 14, 10, 12);
    ctx.fillStyle = "#d9a441";
    ctx.fillRect(x + w - 20, y + 14, 10, 12);
    return;
  }
  if (kind === "armchair") {
    ctx.fillStyle = color;
    ctx.fillRect(x, y + 8, w, h - 8);
    ctx.fillStyle = "#5a3824";
    ctx.fillRect(x, y, 8, h);
    ctx.fillRect(x + w - 8, y, 8, h);
    return;
  }
  if (kind === "table-small") {
    ctx.fillStyle = "#3a2418";
    ctx.fillRect(x + 4, y + h - 6, 6, 6);
    ctx.fillRect(x + w - 10, y + h - 6, 6, 6);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h - 4);
    ctx.fillStyle = "#efe6d4";
    ctx.fillRect(x + 8, y + 6, 10, 8);
    return;
  }
  if (kind === "plant") {
    ctx.fillStyle = "#6b4a32";
    ctx.fillRect(x + w * 0.3, y + h * 0.55, w * 0.4, h * 0.45);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.4, w * 0.38, h * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (kind === "lantern") {
    ctx.fillStyle = "#2a2118";
    ctx.fillRect(x + w * 0.35, y, w * 0.3, h * 0.25);
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y + h * 0.22, w - 4, h * 0.55);
    ctx.fillStyle = "#efe6d4";
    ctx.fillRect(x + 4, y + h * 0.32, w - 8, 6);
    return;
  }
  if (kind === "barrel") {
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y, w - 4, h);
    ctx.fillStyle = "#3a2418";
    ctx.fillRect(x, y + 4, w, 3);
    ctx.fillRect(x, y + h - 8, w, 3);
    return;
  }
  if (kind === "crystal") {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h * 0.65);
    ctx.lineTo(x + w / 2, y + h);
    ctx.lineTo(x, y + h * 0.65);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (kind === "chest") {
    ctx.fillStyle = color;
    ctx.fillRect(x, y + 8, w, h - 8);
    ctx.fillStyle = "#d9a441";
    ctx.fillRect(x + w * 0.45, y + h * 0.45, 8, 10);
    ctx.fillStyle = "#3a2418";
    ctx.fillRect(x, y + 8, w, 4);
    return;
  }
  if (kind === "banner") {
    ctx.fillStyle = "#c9d0d8";
    ctx.fillRect(x + w * 0.45, y, 4, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y + 6, w, h * 0.7);
    return;
  }
  if (kind === "painting") {
    ctx.fillStyle = "#d9a441";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    return;
  }
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(0,0,0,.2)";
  ctx.fillRect(x, y + h - 6, w, 6);
}

function drawDoors() {
  const { ctx, map, camera } = engine;
  const ox = -camera.x;
  const oy = -camera.y;
  map.doors.forEach((d) => {
    ctx.fillStyle = "#d9a441";
    ctx.fillRect(d.x * TILE + ox, d.y * TILE + oy, d.w * TILE, d.h * TILE);
    ctx.fillStyle = "#2b2118";
    ctx.fillRect(d.x * TILE + ox + 8, d.y * TILE + oy + 4, d.w * TILE - 16, d.h * TILE - 8);
  });
}

function currentSprite(who) {
  const sheet = who.sheet;
  if (who.pose && who.poseUntil > performance.now() && sheet.pose && sheet.pose[who.pose]) {
    return sheet.pose[who.pose];
  }
  if (who.seated) return sheet.sit;
  const dir = sheet[who.dir] ? who.dir : "front";
  return sheet[dir][who.walkFrame || 0];
}

function drawPlayer() {
  const { ctx, player, camera } = engine;
  const img = currentSprite(player);
  ctx.drawImage(img, player.x - camera.x - 5, player.y - camera.y - 8);
  drawNameTag(ctx, game.displayName, player.x - camera.x + PLAYER_W / 2, player.y - camera.y - 10);
}

function stepRemotes() {
  (engine.remotes || []).forEach((r) => {
    if (!r || r.tx == null) return;
    if (r.seated) {
      r.x = r.tx;
      r.y = r.ty;
      r.walkFrame = 0;
      return;
    }
    const dx = r.tx - r.x;
    const dy = r.ty - r.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 90) {
      r.x = r.tx;
      r.y = r.ty;
      r.walkFrame = 0;
      return;
    }
    if (dist < 0.6) {
      r.x = r.tx;
      r.y = r.ty;
      r.walkFrame = 0;
      return;
    }
    const step = Math.min(dist, SPEED * 1.2);
    r.x += (dx / dist) * step;
    r.y += (dy / dist) * step;
    if (Math.abs(dx) > Math.abs(dy)) r.dir = dx < 0 ? "left" : "right";
    else r.dir = dy < 0 ? "back" : "front";
    if (engine.frame % 8 === 0) r.walkFrame = r.walkFrame ? 0 : 1;
  });
}

function drawRemotes() {
  const { ctx, camera, map } = engine;
  (engine.remotes || []).forEach((r) => {
    if (!r || (r.mapId && r.mapId !== map.id)) return;
    r.sheet = r.sheet || sheetForChar(r.charId);
    const img = currentSprite(r);
    ctx.drawImage(img, r.x - camera.x - 5, r.y - camera.y - 8);
    drawNameTag(ctx, r.name, r.x - camera.x + PLAYER_W / 2, r.y - camera.y - 10);
  });
}

function drawNameTag(ctx, name, x, y) {
  if (!name) return;
  ctx.font = "700 10px Source Sans 3, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(8,7,12,.7)";
  const w = Math.max(36, ctx.measureText(name).width + 8);
  ctx.fillRect(x - w / 2, y - 10, w, 12);
  ctx.fillStyle = "#efe6d4";
  ctx.fillText(name, x, y);
}

function drawNpcs() {
  const { ctx, map, camera } = engine;
  (map.npcs || []).forEach((npc) => {
    const sheet = npc.sheet;
    const img = sheet[npc.dir][npc.walkFrame || 0];
    const x = npc.px - camera.x;
    const y = npc.py - camera.y;
    ctx.drawImage(img, x - 5, y - 8);
    drawNameTag(ctx, npc.name, x + PLAYER_W / 2, y - 10);
  });
}

function drawDebug() {
  if (!engine.debug) return;
  const { ctx, camera, map, solids, player } = engine;
  const ox = -camera.x;
  const oy = -camera.y;
  ctx.lineWidth = 1;
  solids.forEach((s) => {
    ctx.strokeStyle = "#ff4d6d";
    ctx.strokeRect(s.px + ox, s.py + oy, s.pw, s.ph);
  });
  (map.doors || []).forEach((d) => {
    ctx.strokeStyle = "#4dff88";
    ctx.strokeRect(d.x * TILE + ox, d.y * TILE + oy, d.w * TILE, d.h * TILE);
  });
  (map.interacts || []).forEach((i) => {
    ctx.strokeStyle = "#4dc3ff";
    ctx.strokeRect(i.x * TILE + ox, i.y * TILE + oy, i.w * TILE, i.h * TILE);
  });
  (map.seats || []).forEach((s) => {
    ctx.strokeStyle = "#ffe14d";
    ctx.strokeRect(s.x * TILE + ox, s.y * TILE + oy, 28, 22);
  });
  (map.npcs || []).forEach((n) => {
    ctx.strokeStyle = "#c084fc";
    ctx.strokeRect(n.px + ox, n.py + 14 + oy, PLAYER_W, PLAYER_H - 12);
  });
  ctx.strokeStyle = "#ffffff";
  ctx.strokeRect(player.x + ox, player.y + 14 + oy, PLAYER_W, PLAYER_H - 12);
}

function updateCamera() {
  const { canvas, map, player, camera } = engine;
  const mapW = map.w * TILE;
  const mapH = map.h * TILE;
  camera.x = player.x + PLAYER_W / 2 - canvas.width / 2;
  camera.y = player.y + PLAYER_H / 2 - canvas.height / 2;
  camera.x = Math.max(0, Math.min(camera.x, mapW - canvas.width));
  camera.y = Math.max(0, Math.min(camera.y, mapH - canvas.height));
  if (mapW < canvas.width) camera.x = (mapW - canvas.width) / 2;
  if (mapH < canvas.height) camera.y = (mapH - canvas.height) / 2;
}

function stepPlayer() {
  const p = engine.player;
  const chatOpen = document.getElementById("chat-dock") && !document.getElementById("chat-dock").classList.contains("closed");
  if (p.seated || (window.tableSystem && tableSystem.panelOpen) || (window.game && game.uiLocked) || chatOpen) return;
  if (p.poseUntil && p.poseUntil > performance.now()) return;
  const m = movement();
  if (m.x || m.y) {
    if (Math.abs(m.x) > Math.abs(m.y)) p.dir = m.x < 0 ? "left" : "right";
    else p.dir = m.y < 0 ? "back" : "front";
    if (engine.frame % 10 === 0) p.walkFrame = p.walkFrame ? 0 : 1;
    const nx = p.x + m.x * SPEED;
    const ny = p.y + m.y * SPEED;
    if (!collide(nx, p.y, engine.solids)) p.x = nx;
    if (!collide(p.x, ny, engine.solids)) p.y = ny;
    if (typeof bumpActive === "function") bumpActive();
    const mapW = engine.map.w * TILE;
    const mapH = engine.map.h * TILE;
    p.x = Math.max(TILE, Math.min(p.x, mapW - TILE - PLAYER_W));
    p.y = Math.max(TILE, Math.min(p.y, mapH - TILE - PLAYER_H));
  } else {
    p.walkFrame = 0;
  }
}

function resizeCanvas() {
  const c = engine.canvas;
  c.width = window.innerWidth;
  c.height = window.innerHeight;
  engine.ctx.imageSmoothingEnabled = false;
}

function loop() {
  if (!engine.running) return;
  engine.frame++;
  stepPlayer();
  stepRemotes();
  updateCamera();
  const ctx = engine.ctx;
  ctx.clearRect(0, 0, engine.canvas.width, engine.canvas.height);
  drawFloor();
  drawWalls();
  drawDoors();
  drawFurniture();
  stepNpcs();
  drawNpcs();
  drawRemotes();
  drawPlayer();
  drawDebug();
  if (window.game) game.afterFrame();
  requestAnimationFrame(loop);
}

/* Prepara os bots da sala: sprite 2D + posicao em pixels. */
function prepareNpcs(map) {
  (map.npcs || []).forEach((npc) => {
    const ch = findCharacter(npc.charId);
    npc.sheet = buildSpriteSheet(ch.pal);
    npc.px = npc.x * TILE;
    npc.py = npc.y * TILE;
    npc.homeX = npc.px;
    npc.walkFrame = 0;
    npc.lineIndex = npc.lineIndex || 0;
    npc.dir = npc.dir || "front";
  });
}

/* Bots andam um pouco de um lado para o outro (patrol em tiles). */
function stepNpcs() {
  (engine.map.npcs || []).forEach((npc) => {
    const range = (npc.patrol || 0) * TILE;
    if (!range) {
      npc.walkFrame = 0;
      return;
    }
    if (!npc.vx) npc.vx = 0.35;
    npc.px += npc.vx;
    if (npc.px > npc.homeX + range || npc.px < npc.homeX - range) {
      npc.vx *= -1;
      npc.px += npc.vx;
    }
    npc.dir = npc.vx < 0 ? "left" : "right";
    if (engine.frame % 12 === 0) npc.walkFrame = npc.walkFrame ? 0 : 1;
  });
}

function nearNpc() {
  const p = engine.player;
  const box = { x: p.x - 10, y: p.y - 10, w: PLAYER_W + 20, h: PLAYER_H + 20 };
  return (engine.map.npcs || []).find((npc) =>
    aabb(box, { x: npc.px, y: npc.py, w: PLAYER_W, h: PLAYER_H })
  );
}

function startEngine(player) {
  engine.canvas = document.getElementById("world");
  engine.ctx = engine.canvas.getContext("2d");
  engine.player = player;
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  loadMap("hall");
  engine.running = true;
  requestAnimationFrame(loop);
}
