/* =========================================================
   data.js
   Dados fixos do jogo (personagens, emotes, tamanho do tile).
   Se quiser mudar um personagem, edite so este arquivo.
   ========================================================= */

/* Tamanho de 1 quadrado do mapa, em pixels.
   O mapa e desenhado em "tiles": 1 tile = 32px. */
const TILE = 32;

/* Tamanho do bonequinho no canvas (chibi 2D). */
const PLAYER_W = 22;
const PLAYER_H = 28;

/* Velocidade de caminhada. Aumente para andar mais rapido. */
const SPEED = 2.35;

/* Personagens oficiais do Broken Mirror.
   - portrait: imagem real (aparece na tela de escolha)
   - pal: cores usadas para desenhar o chibi 2D no mapa
   Para deixar o 2D mais parecido, ajuste skin/hair/shirt/pants/accent. */
const CHARACTERS = [
  {
    id: "chindu",
    name: "Chindu",
    role: "Sombra",
    portrait: "img/avatar/chindu/chindu-frente-96x96.png",
    pal: {
      skin: "#3c303c",
      hair: "#18141c",
      shirt: "#2a1838",
      pants: "#140c18",
      accent: "#6533ee",
      eyes: "#cbb6ff"
    }
  },
  {
    id: "milo",
    name: "Milo",
    role: "Sabio",
    portrait: "img/avatar/milo/milo-frente-96x96.png",
    pal: {
      skin: "#c99574",
      hair: "#3c2418",
      shirt: "#8d3a22",
      pants: "#30180c",
      accent: "#ff4444",
      eyes: "#2a180c"
    }
  },
  {
    id: "bigJonh",
    name: "BigJonh",
    role: "Guardiao",
    portrait: "img/avatar/bigJonh/bigJonh-frente-96x96.png",
    pal: {
      skin: "#8a6a4a",
      hair: "#1a120c",
      shirt: "#3a2418",
      pants: "#140c08",
      accent: "#ffaa00",
      eyes: "#ffe08a"
    }
  },
  {
    id: "void",
    name: "Void",
    role: "Vazio",
    portrait: "img/avatar/void/void-frente-96x96.png",
    pal: {
      skin: "#2a2428",
      hair: "#0a0a10",
      shirt: "#1a1420",
      pants: "#08080c",
      accent: "#00bfff",
      eyes: "#8a2be2"
    }
  },
  {
    id: "mimi",
    name: "Mimi",
    role: "Estrela",
    portrait: "img/avatar/mimi/mimi-frente-96x96.png",
    pal: {
      skin: "#f4f4f8",
      hair: "#181824",
      shirt: "#2a1838",
      pants: "#0c0c18",
      accent: "#b366ff",
      eyes: "#3a2048"
    }
  },
  {
    id: "skatt",
    name: "Skatt",
    role: "Bussola",
    portrait: "img/avatar/skatt/skatt-frente-96x96.png",
    pal: {
      skin: "#e0b07a",
      hair: "#3c240c",
      shirt: "#b49078",
      pants: "#30180c",
      accent: "#00e5ff",
      eyes: "#2a180c"
    }
  },
  {
    id: "vodoll",
    name: "Vodoll",
    role: "Marionete",
    portrait: "img/avatar/vodoll/vodoll-frente-96x96.png",
    pal: {
      skin: "#d8cccc",
      hair: "#6c1830",
      shirt: "#8d2d48",
      pants: "#482424",
      accent: "#ff4fd8",
      eyes: "#3a1020"
    }
  }
];

/* Poses / emotes (teclas 1 a 6).
   pose = nome da folha em sprites.js (sheet.pose[id]).
   Para adicionar uma pose nova: 1) item aqui  2) desenho em drawPose() */
const EMOTES = [
  { id: "wave", label: "Oi", pose: "wave" },
  { id: "heart", label: "Amor", pose: "heart" },
  { id: "think", label: "Pensar", pose: "think" },
  { id: "cheer", label: "Vitoria", pose: "cheer" },
  { id: "mad", label: "Raiva", pose: "mad" },
  { id: "bow", label: "Respeito", pose: "bow" }
];

/* Quantas pessoas cabem na mesma sala. Mude aqui E em server.py (MAX_PLAYERS). */
const MAX_PLAYERS = 8;

/* Ordem dos assentos da mesa (1 Mestre + 7 jogadores). */
const SEAT_ORDER = ["GM", "P1", "P2", "P3", "P4", "P5", "P6", "P7"];

/* Quantos dados da para rolar de uma vez (evita bagunca visual). */
const MAX_DICE = 4;

/* Kit de dados da mesa. Cada um tem forma/cor propria no CSS (.die-shape.<shape>).
   kind:
     standard = 1 ate sides
     units    = d10 de unidades (0-9)
     tens     = d10 de dezenas (00, 10, ... 90) — junta com units para percentil */
const DICE_TYPES = [
  { id: "d4", label: "d4", sides: 4, kind: "standard", shape: "d4" },
  { id: "d6", label: "d6", sides: 6, kind: "standard", shape: "d6" },
  { id: "d8", label: "d8", sides: 8, kind: "standard", shape: "d8" },
  { id: "d10", label: "d10", sides: 10, kind: "units", shape: "d10" },
  { id: "d10t", label: "d%", sides: 10, kind: "tens", shape: "d10t" },
  { id: "d12", label: "d12", sides: 12, kind: "standard", shape: "d12" },
  { id: "d20", label: "d20", sides: 20, kind: "standard", shape: "d20" }
];
