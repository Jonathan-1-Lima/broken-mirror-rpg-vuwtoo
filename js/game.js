/* =========================================================
   game.js
   Liga tudo: personagem, mapa, E (porta / mesa / bot / espelho), chat.
   ========================================================= */

const game = {
  character: null,
  displayName: "",
  roomCode: "",
  emoteUntil: 0,
  uiLocked: false,
  changingAvatar: false
};

/* Pose do bonequinho (teclas 1-6). Para mudar a duracao, altere 1800. */
game.showEmote = function (emote) {
  if (!engine.player || !emote) return;
  engine.player.pose = emote.pose;
  engine.player.poseUntil = performance.now() + 1800;
  game.emoteUntil = engine.player.poseUntil;
  const bar = document.getElementById("emote-bar");
  if (bar) bar.classList.add("hidden");
  if (window.net && net.connected) net.send({ type: "pose", pose: emote.pose, ms: 1800 });
};

game.toggleDebug = function () {
  engine.debug = !engine.debug;
  document.getElementById("debug").classList.toggle("hidden", !engine.debug);
};

function talkToNpc(npc) {
  const line = npc.lines[npc.lineIndex % npc.lines.length];
  npc.lineIndex += 1;
  toast(npc.name + ": " + line, 3800);
  addChatMessage(npc.name, line, "npc");
}

game.afterFrame = function () {
  const p = engine.player;
  const door = overlapList(engine.map.doors, 6);
  const inter = overlapList(engine.map.interacts, 4);
  const npc = nearNpc();
  const atTable = tableSystem.nearTable();
  const prompt = document.getElementById("prompt");
  let text = "";

  if (tableSystem.panelOpen || game.uiLocked) text = "";
      else if (p.seated) text = "E: abrir mesa   R: rolar dados";
  else if (door) text = "E: entrar em " + door.label;
  else if (atTable) text = "E: sentar na mesa";
  else if (npc) text = "E: falar com " + npc.name;
  else if (inter && inter.action === "mirror") text = "E: trocar de personagem";
  else if (inter) text = "E: olhar";

  if (text) {
    prompt.textContent = text;
    prompt.classList.remove("hidden");
  } else {
    prompt.classList.add("hidden");
  }

  if (consumeAction()) {
    if (tableSystem.panelOpen) {
      tableSystem.closePanel();
    } else if (p.seated || atTable) {
      tableSystem.openPanel();
    } else if (door) {
      loadMap(door.to, door.spawn);
      tableSystem.closePanel();
      toast("Voce entrou em " + MAPS[door.to].name);
    } else if (npc) {
      talkToNpc(npc);
    } else if (inter && inter.action === "mirror") {
      openMirrorSelect();
    } else if (inter) {
      toast(inter.message, 4200);
      addChatMessage("Sala", inter.message, "sys");
    }
  }

  if (engine.frame % 5 === 0 && window.net && net.connected) net.tick();

  if (engine.debug) {
    document.getElementById("debug-info").textContent =
      engine.map.id + "  x:" + p.x.toFixed(0) + " y:" + p.y.toFixed(0) + "  " + p.dir + (p.seated ? "  SIT" : "");
  }
};

function startGame() {
  const name = document.getElementById("player-name").value.trim();
  const room = (document.getElementById("room-code").value || "").trim().toUpperCase();
  game.displayName = name;
  game.roomCode = room;
  applyCharacter(game.character);
  document.getElementById("hud-name").textContent = name;
  const roomHud = document.getElementById("hud-room");
  if (roomHud) roomHud.textContent = room ? ("sala " + room) : "solo";

  if (game.changingAvatar && engine.running) {
    game.changingAvatar = false;
    game.uiLocked = false;
    document.getElementById("btn-start").textContent = "Entrar na sala principal";
    showScreen("game");
    toast("O espelho aceitou o novo reflexo: " + game.character.name);
    addChatMessage("Espelho", "Agora voce e " + game.character.name + ".", "sys");
    if (window.net && net.connected) net.send({ type: "avatar", charId: game.character.id });
    return;
  }

  showScreen("game");
  startEngine({
    x: 0,
    y: 0,
    dir: "front",
    walkFrame: 0,
    seated: false,
    seatId: null,
    pose: null,
    poseUntil: 0,
    sheet: buildSpriteSheet(game.character.pal)
  });
  toast("Bem-vindo, " + name + ". Va ate a porta dourada.");
  addChatMessage("Sala", "Bem-vindo a Broken Mirror, " + name + ".", "sys");
  if (room && window.net) net.join(room, name, game.character.id);
}

function boot() {
  renderChars();
  renderEmotes();
  bindKeyboard();
  bindStick();
  bindScreens();
  bindTableUI();
  bindChat();
}

boot();
