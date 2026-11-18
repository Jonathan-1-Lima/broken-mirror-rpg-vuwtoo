/* =========================================================
   sprites.js
   Desenha o bonequinho 2D (chibi) usando as cores de cada personagem.
   Nao usa foto no mapa: o mapa e pixel art gerada aqui.
   A foto original so aparece na tela de escolha (veja ui.js).
   ========================================================= */

/* Cria um canvas pequeno para guardar um frame do personagem. */
function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

/* Desenha 1 pose do chibi.
   dir: "front" | "back" | "left" | "right"
   frame: 0 ou 1 (pernas se mexendo)
   seated: true = sentado na mesa
   pose: id da pose (wave, heart, think, cheer, mad, bow) ou vazio */
function drawChibi(ctx, pal, dir, frame, seated, pose) {
  const x = 5;
  const y = seated ? 10 : pose === "bow" ? 10 : 4;
  ctx.clearRect(0, 0, 32, 40);

  /* sombra no chao */
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.beginPath();
  ctx.ellipse(16, 36, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (seated) {
    ctx.fillStyle = pal.pants;
    ctx.fillRect(x + 2, y + 16, 18, 10);
    ctx.fillStyle = pal.shirt;
    ctx.fillRect(x + 3, y + 10, 16, 10);
  } else {
    const step = frame ? 2 : 0;
    ctx.fillStyle = pal.pants;
    if (dir === "left" || dir === "right") {
      ctx.fillRect(x + 5, y + 20, 6, 10);
      ctx.fillRect(x + 12, y + 20 + (frame ? -step : step), 6, 10);
    } else {
      ctx.fillRect(x + 4, y + 20 + (frame ? step : 0), 7, 10);
      ctx.fillRect(x + 11, y + 20 + (frame ? 0 : step), 7, 10);
    }
    ctx.fillStyle = pal.shirt;
    ctx.fillRect(x + 3, y + 12, 16, 11);
  }

  /* cabeca */
  ctx.fillStyle = pal.skin;
  ctx.fillRect(x + 6, y + 4, 12, 11);

  /* cabelo */
  ctx.fillStyle = pal.hair;
  if (dir === "back") {
    ctx.fillRect(x + 5, y + 1, 14, 12);
  } else {
    ctx.fillRect(x + 5, y + 1, 14, 6);
    ctx.fillRect(x + 5, y + 6, 3, 7);
    ctx.fillRect(x + 16, y + 6, 3, 7);
  }

  if (dir !== "back") {
    ctx.fillStyle = pal.eyes;
    const ox = dir === "left" ? -1 : dir === "right" ? 1 : 0;
    ctx.fillRect(x + 8 + ox, y + 8, 2, 2);
    ctx.fillRect(x + 14 + ox, y + 8, 2, 2);
    ctx.fillStyle = pal.accent;
    ctx.fillRect(x + 9, y + 12, 6, 2);
  }

  /* detalhe no peito (cor de destaque do personagem) */
  ctx.fillStyle = pal.accent;
  ctx.fillRect(x + 9, y + 14, 6, 2);

  if (!seated && !pose) {
    ctx.fillStyle = pal.skin;
    if (dir === "left") ctx.fillRect(x, y + 14, 4, 5);
    else if (dir === "right") ctx.fillRect(x + 18, y + 14, 4, 5);
    else {
      ctx.fillRect(x + 1, y + 14, 4, 5);
      ctx.fillRect(x + 17, y + 14, 4, 5);
    }
  }

  if (pose) drawPoseExtras(ctx, pal, x, y, pose);
}

/* Bracos / detalhe extra de cada pose. Edite aqui para mudar o gesto. */
function drawPoseExtras(ctx, pal, x, y, pose) {
  ctx.fillStyle = pal.skin;
  if (pose === "wave") {
    ctx.fillRect(x + 1, y + 14, 4, 5);
    ctx.fillRect(x + 18, y + 4, 4, 12);
    ctx.fillRect(x + 20, y + 2, 5, 3);
  } else if (pose === "heart") {
    ctx.fillRect(x + 6, y + 14, 4, 5);
    ctx.fillRect(x + 12, y + 14, 4, 5);
    ctx.fillStyle = "#e35a4f";
    ctx.fillRect(x + 10, y - 1, 3, 3);
    ctx.fillRect(x + 13, y - 1, 3, 3);
    ctx.fillRect(x + 11, y + 1, 4, 3);
  } else if (pose === "think") {
    ctx.fillRect(x + 1, y + 14, 4, 5);
    ctx.fillRect(x + 17, y + 8, 4, 8);
    ctx.fillStyle = pal.accent;
    ctx.fillRect(x + 20, y + 4, 3, 3);
  } else if (pose === "cheer") {
    ctx.fillRect(x - 1, y + 2, 4, 14);
    ctx.fillRect(x + 19, y + 2, 4, 14);
    ctx.fillStyle = pal.accent;
    ctx.fillRect(x + 9, y - 2, 2, 2);
    ctx.fillRect(x + 13, y - 2, 2, 2);
  } else if (pose === "mad") {
    ctx.fillRect(x - 1, y + 16, 5, 5);
    ctx.fillRect(x + 18, y + 16, 5, 5);
    ctx.fillStyle = "#e35a4f";
    ctx.fillRect(x + 8, y + 7, 3, 1);
    ctx.fillRect(x + 13, y + 7, 3, 1);
  } else if (pose === "bow") {
    ctx.fillRect(x + 4, y + 16, 4, 4);
    ctx.fillRect(x + 14, y + 16, 4, 4);
  }
}

/* Gera todas as poses de um personagem de uma vez.
   sheet.front[0], sheet.front[1], sheet.back..., sheet.sit */
function buildSpriteSheet(pal) {
  const dirs = ["front", "back", "left", "right"];
  const sheet = {};
  dirs.forEach((dir) => {
    sheet[dir] = [0, 1].map((frame) => {
      const { c, ctx } = makeCanvas(32, 40);
      drawChibi(ctx, pal, dir, frame, false);
      return c;
    });
  });
  const sit = makeCanvas(32, 40);
  drawChibi(sit.ctx, pal, "front", 0, true);
  sheet.sit = sit.c;
  /* Poses dos emotes (teclas 1-6). A chave e o campo pose de EMOTES. */
  sheet.pose = {};
  ["wave", "heart", "think", "cheer", "mad", "bow"].forEach((pose) => {
    const p = makeCanvas(32, 40);
    drawChibi(p.ctx, pal, "front", 0, false, pose);
    sheet.pose[pose] = p.c;
  });
  return sheet;
}

/* Mini retrato 2D (usado no HUD, se precisar). */
function portraitChibi(pal) {
  const { c, ctx } = makeCanvas(64, 80);
  ctx.scale(2, 2);
  drawChibi(ctx, pal, "front", 0, false);
  return c;
}
