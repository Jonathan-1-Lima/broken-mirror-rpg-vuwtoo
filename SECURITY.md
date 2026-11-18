# Seguranca — Broken Mirror RPG

Este jogo foi pensado para uma mesa pequena (familia e amigos), nao para a internet aberta sem cuidado. Ainda assim, o codigo evita o basico que costuma dar problema.

## O que o servidor recusa

- codigo da sala so com A-Z e 0-9, no maximo 8 caracteres
- apelido curto, sem caracteres de controle
- chat limitado a 180 caracteres
- no maximo 4 dados por rolagem
- no maximo 8 pessoas por sala (veja `MAX_PLAYERS`)
- no maximo 20 mensagens por segundo por conexao
- personagem so se for um dos oficiais
- assento so se for GM ou P1-P7

Nao ha login. Nao ha senha para guardar. Nao ha banco.

## O que voce deve fazer ao publicar

1. Hospede em HTTPS. Sem isso, o navegador pode recusar o WebSocket seguro (`wss`).
2. Nao exponha o servidor de desenvolvimento na internet sem um proxy na frente.
3. Leia `TERMS.md` antes de subir no GitHub: la esta a titularidade, a LGPD e o que o Site nao coleta.
4. Se achar um buraco, avise em particular pelo GitHub do titular. Nao use a falha contra outras pessoas.

## Onde isso vive no codigo

- limites e validacao: `server.py` (topo do arquivo e `handle_msg`)
- cliente: `js/net.js`
- teto de jogadores no jogo: `js/data.js` (`MAX_PLAYERS`)
