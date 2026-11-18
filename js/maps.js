/* =========================================================
   maps.js
   Dois mapas em tiles: Sala Principal e Sala de Jogos.
   1 porta liga as duas salas.

   Como ler um retangulo:
     { x: 4, y: 4, w: 3, h: 2 }  = tile (4,4), largura 3, altura 2

   kind = tipo visual (engine.js desenha)
   solid: false = da para atravessar (quadro, planta pequena, banner)
   ========================================================= */

const MAPS = {
  hall: {
    id: "hall",
    name: "Sala Principal",
    w: 28,
    h: 18,
    spawn: { x: 14 * TILE, y: 13.2 * TILE },
    floors: [
      { x: 2, y: 2, w: 24, h: 14, color: "#3b3344" },
      { x: 3, y: 3, w: 22, h: 12, color: "#4a4154" }
    ],
    rugs: [
      { x: 10, y: 7, w: 8, h: 5, color: "#6a3040" }
    ],
    walls: [
      { x: 2, y: 2, w: 24, h: 1 },
      { x: 2, y: 15, w: 10, h: 1 },
      { x: 16, y: 15, w: 10, h: 1 },
      { x: 2, y: 2, w: 1, h: 14 },
      { x: 25, y: 2, w: 1, h: 14 }
    ],
    furniture: [
      { x: 4, y: 3.2, w: 3, h: 2.2, color: "#6b4a32", kind: "shelf", label: "estante" },
      { x: 21, y: 3.2, w: 3, h: 2.2, color: "#6b4a32", kind: "shelf", label: "estante" },
      { x: 12, y: 3.15, w: 4, h: 1.55, color: "#2d3a48", kind: "mirror", label: "espelho", solid: false },
      { x: 16.4, y: 3.15, w: 2.8, h: 1.7, color: "#8d3a22", kind: "fireplace", label: "lareira" },
      { x: 8.2, y: 3.15, w: 2.2, h: 1.1, color: "#2a2430", kind: "painting", label: "quadro", solid: false },
      { x: 8.4, y: 5.6, w: 2.2, h: 1.5, color: "#6b4a32", kind: "table-small", label: "mesa de cartas" },
      { x: 17.6, y: 5.6, w: 2.2, h: 1.5, color: "#6b4a32", kind: "table-small", label: "mesa de cha" },
      { x: 12, y: 8.6, w: 4, h: 1.6, color: "#5a3b28", kind: "table-small", label: "mesa baixa" },
      { x: 5, y: 9.2, w: 2, h: 2, color: "#8d5a38", kind: "armchair", label: "poltrona" },
      { x: 21, y: 9.2, w: 2, h: 2, color: "#8d5a38", kind: "armchair", label: "poltrona" },
      { x: 3.25, y: 7.2, w: 0.9, h: 1.3, color: "#d9a441", kind: "lantern", label: "lampiao", solid: false },
      { x: 23.9, y: 7.2, w: 0.9, h: 1.3, color: "#d9a441", kind: "lantern", label: "lampiao", solid: false },
      { x: 3.3, y: 12.2, w: 1.1, h: 1.3, color: "#6f8f6a", kind: "plant", label: "vaso" },
      { x: 23.6, y: 12.2, w: 1.1, h: 1.3, color: "#6f8f6a", kind: "plant", label: "vaso" },
      { x: 9.4, y: 12.4, w: 1.3, h: 1.3, color: "#6b4a32", kind: "barrel", label: "barril" },
      { x: 17.4, y: 12.4, w: 1.2, h: 1.2, color: "#8aa0b8", kind: "crystal", label: "cristal", solid: false }
    ],
    doors: [
      { x: 12, y: 15, w: 4, h: 1, to: "games", spawn: { x: 14 * TILE, y: 3.4 * TILE }, label: "Sala de Jogos" }
    ],
    seats: [],
    /* Bots da sala principal. lines = falas ciclicas ao apertar E. */
    npcs: [
      {
        id: "tomo",
        name: "Tomo",
        charId: "skatt",
        x: 6.3,
        y: 5.8,
        dir: "front",
        patrol: 1.6,
        lines: [
          "Essa estante guarda os cadernos das sessoes antigas.",
          "Se perder o rumo, a porta dourada leva a mesa.",
          "Hoje o mestre prometeu um D20 novo."
        ]
      },
      {
        id: "kira",
        name: "Kira",
        charId: "mimi",
        x: 16.8,
        y: 5.3,
        dir: "front",
        patrol: 0,
        lines: [
          "A lareira e o coracao da casa.",
          "Quando o fogo crepita, a historia comeca.",
          "Fica a vontade. Aqui ninguem julga o dado baixo."
        ]
      },
      {
        id: "lila",
        name: "Lila",
        charId: "vodoll",
        x: 21.3,
        y: 11.4,
        dir: "left",
        patrol: 1.4,
        lines: [
          "O espelho quebrado troca seu reflexo, se voce quiser.",
          "Eu costuro os fios das historias. Voce so precisa sentar.",
          "Se cansar desta forma, volte ao espelho."
        ]
      }
    ],
    interacts: [
      { x: 12, y: 3.1, w: 4, h: 2.2, action: "mirror", message: "O espelho espera um novo reflexo." },
      { x: 4, y: 3.2, w: 3, h: 2.2, action: "look", message: "Cadernos, dados e retratos feitos a mao. Um post-it: 'hoje tem sessao'." },
      { x: 16.4, y: 3.15, w: 2.8, h: 2, action: "look", message: "A lareira aquece a sala. Alguem deixou um copo de cha na pedra." },
      { x: 8.4, y: 5.6, w: 2.2, h: 1.5, action: "look", message: "Cartas espalhadas: um rei de espadas e um coringa sorrindo." },
      { x: 17.6, y: 5.6, w: 2.2, h: 1.5, action: "look", message: "Bule, duas xicaras. Ainda esta quente." },
      { x: 12, y: 8.6, w: 4, h: 1.6, action: "look", message: "No centro do tapete, um mapa rabiscado com tinta vermelha." }
    ]
  },

  games: {
    id: "games",
    name: "Sala de Jogos",
    w: 28,
    h: 18,
    spawn: { x: 14 * TILE, y: 3.6 * TILE },
    floors: [
      { x: 2, y: 2, w: 24, h: 14, color: "#2b2430" },
      { x: 3, y: 3, w: 22, h: 12, color: "#352c3a" }
    ],
    rugs: [
      { x: 8, y: 6, w: 12, h: 8, color: "#3e2a22" }
    ],
    walls: [
      { x: 2, y: 2, w: 10, h: 1 },
      { x: 16, y: 2, w: 10, h: 1 },
      { x: 2, y: 15, w: 24, h: 1 },
      { x: 2, y: 2, w: 1, h: 14 },
      { x: 25, y: 2, w: 1, h: 14 }
    ],
    furniture: [
      { x: 9, y: 7, w: 10, h: 5, color: "#5a3b28", kind: "table-rpg", label: "mesa", solid: true },
      { x: 3.2, y: 3.3, w: 2.4, h: 2.4, color: "#6b4a32", kind: "shelf", label: "modulo de fichas" },
      { x: 22.4, y: 3.3, w: 2.4, h: 2.4, color: "#6b4a32", kind: "shelf", label: "modulo de mapas" },
      { x: 5.8, y: 3.15, w: 1.4, h: 2, color: "#8d2d28", kind: "banner", label: "estandarte", solid: false },
      { x: 20.8, y: 3.15, w: 1.4, h: 2, color: "#2a5f86", kind: "banner", label: "estandarte", solid: false },
      { x: 17.2, y: 3.15, w: 2.2, h: 1.1, color: "#2a2430", kind: "painting", label: "quadro", solid: false },
      { x: 3.3, y: 7.2, w: 2.2, h: 1.8, color: "#6b4a32", kind: "table-small", label: "bandeja de dados" },
      { x: 22.5, y: 7.2, w: 2.2, h: 1.8, color: "#6b4a32", kind: "table-small", label: "caixa de tokens" },
      { x: 3.3, y: 12.2, w: 2, h: 1.6, color: "#5a3b28", kind: "chest", label: "bau de dados" },
      { x: 22.6, y: 12.2, w: 1.3, h: 1.4, color: "#6f8f6a", kind: "plant", label: "vaso" },
      { x: 6.4, y: 13.1, w: 1.2, h: 1.2, color: "#6b4a32", kind: "barrel", label: "barril" },
      { x: 20.6, y: 13.1, w: 1.2, h: 1.2, color: "#8aa0b8", kind: "crystal", label: "cristal", solid: false },
      { x: 3.2, y: 9.6, w: 0.9, h: 1.3, color: "#d9a441", kind: "lantern", label: "lampiao", solid: false },
      { x: 23.9, y: 9.6, w: 0.9, h: 1.3, color: "#d9a441", kind: "lantern", label: "lampiao", solid: false }
    ],
    doors: [
      { x: 12, y: 2, w: 4, h: 1, to: "hall", spawn: { x: 14 * TILE, y: 13.6 * TILE }, label: "Sala Principal" }
    ],
    seats: [
      { id: "GM", x: 13.2, y: 6.15, role: "gm", label: "Mestre", exit: { dx: 0, dy: -1.4 } },
      { id: "P1", x: 9.3, y: 7.3, role: "player", label: "Jogador 1", exit: { dx: -1.6, dy: 0 } },
      { id: "P2", x: 9.3, y: 9.1, role: "player", label: "Jogador 2", exit: { dx: -1.6, dy: 0 } },
      { id: "P3", x: 9.3, y: 10.8, role: "player", label: "Jogador 3", exit: { dx: -1.6, dy: 0 } },
      { id: "P4", x: 18.2, y: 7.3, role: "player", label: "Jogador 4", exit: { dx: 1.6, dy: 0 } },
      { id: "P5", x: 18.2, y: 9.1, role: "player", label: "Jogador 5", exit: { dx: 1.6, dy: 0 } },
      { id: "P6", x: 18.2, y: 10.8, role: "player", label: "Jogador 6", exit: { dx: 1.6, dy: 0 } },
      { id: "P7", x: 13.2, y: 11.35, role: "player", label: "Jogador 7", exit: { dx: 0, dy: 1.6 } }
    ],
    npcs: [
      {
        id: "guia",
        name: "Guia",
        charId: "chindu",
        x: 5.4,
        y: 5.6,
        dir: "front",
        patrol: 1.5,
        lines: [
          "A mesa espera. Aperte E perto dela para sentar.",
          "O mestre libera a vez. Sem vez, o D20 nao gira.",
          "Se quiser outro corpo, volte ao espelho da sala principal."
        ]
      },
      {
        id: "nilo",
        name: "Nilo",
        charId: "void",
        x: 5.2,
        y: 11.3,
        dir: "right",
        patrol: 1.2,
        lines: [
          "Neste bau moram os dados que ja viram criticos.",
          "Um 1 nao e o fim. E so um virar de pagina.",
          "Silencio na mesa. A historia precisa de espaco."
        ]
      },
      {
        id: "brasa",
        name: "Brasa",
        charId: "milo",
        x: 21.6,
        y: 11.2,
        dir: "left",
        patrol: 1.2,
        lines: [
          "Tokens, minis, mapas. Tudo isso e so o palco.",
          "Quer um conselho? Fale com o grupo no chat.",
          "Eu fico por aqui se precisar de um empurrão."
        ]
      }
    ],
    interacts: [
      { x: 13, y: 8.5, w: 2, h: 2, action: "look", message: "No centro da mesa, um D20 espera a vez do mestre." },
      { x: 3.3, y: 7.2, w: 2.2, h: 1.8, action: "look", message: "Uma bandeja com d4, d6, d8... e o d20 no meio." },
      { x: 22.5, y: 7.2, w: 2.2, h: 1.8, action: "look", message: "Fichas de iniciativa e tokens de condicao." },
      { x: 3.3, y: 12.2, w: 2, h: 1.6, action: "look", message: "O bau range. Dentro, dados de cores diferentes." },
      { x: 3.2, y: 3.3, w: 2.4, h: 2.4, action: "look", message: "Fichas de personagem em branco, prontas para a proxima campanha." }
    ]
  }
};

function rectsToWorld(list) {
  return (list || []).map((r) => ({
    ...r,
    px: r.x * TILE,
    py: r.y * TILE,
    pw: r.w * TILE,
    ph: r.h * TILE
  }));
}

/* Solidos: paredes + moveis com solid !== false. */
function getSolids(map) {
  return [
    ...rectsToWorld(map.walls),
    ...rectsToWorld((map.furniture || []).filter((f) => f.solid !== false))
  ];
}

function findCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}
