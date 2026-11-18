# Broken Mirror RPG

Um RPG de mesa em 2D que nasceu em casa, entre cadernos, dados e um espelho imaginario.

Nao e um produto de studio. E o resultado de um pai (Jonathan Lima) sentado com o filho para transformar desenhos, nomes e historias em um mundo que da para andar, conversar e jogar de verdade. A ideia original, os personagens e o tom do projeto vieram dessa parceria. A inteligencia artificial entrou depois, como ferramenta: para ajudar a organizar o codigo, a adaptar os retratos para o estilo chibi do mapa e a deixar o site leve o bastante para rodar no navegador.

Se voce chegou ate aqui por um portfolio, o que importa e isto: tem uma historia real atras da tela, tem decisoes tecnicas conscientes, e tem cuidado com quem vai jogar.

## O que o site faz

Broken Mirror e uma sessao de RPG digital, no estilo de uma sala compartilhada:

- tela inicial com o clima do espelho quebrado
- escolha de personagem com os retratos oficiais (Chindu, Milo, BigJonh, Void, Mimi, Skatt, Vodoll)
- duas salas em canvas 2D (Sala Principal e Sala de Jogos), ligadas por uma unica porta
- bots com falas simples, chat, espelho para trocar de avatar
- mesa com 1 mestre + 7 jogadores, kit de dados (d4, d6, d8, d10, d%, d12, d20)
- ate 4 dados por rolagem, cada um mostrando o proprio resultado (sem soma)
- poses no bonequinho (oi, amor, pensar, vitoria, raiva, respeito)
- multiplayer simples: quem digita o mesmo codigo da sala entra no mesmo mundo (ate 8 pessoas, facil de ampliar)

O jogo roda no navegador, no computador e no celular (joystick na tela).

## Como foi feito

O mapa nao e uma foto. E um canvas em tiles de 32px, com moveis desenhados no codigo e bonequinhos chibi gerados pelas cores de cada personagem. Os retratos reais ficam na tela de escolha e no HUD. Essa escolha foi de proposito: o mundo precisa ser leve, facil de incrementar e fiel ao desenho, sem parecer um recorte de imagem.

A mesa veio do primeiro site do projeto e foi refeita neste visual. O D20 (e os outros dados) usam `crypto.getRandomValues` para o numero ser de fato aleatorio.

O multiplayer e deliberadamente simples: um servidor Python entrega os arquivos e abre um WebSocket. Nao tem conta, nao tem e-mail, nao tem banco de dados. So um codigo da sala, um apelido e a posicao no mapa. Foi pensado para o filho chamar uns amigos, nao para escalar uma rede social.


## Creditos

- Personagens, conceitos e desenhos originais: o filho de Jonathan Lima (VuwToo / Kalleby)
- Sistema, codigo e adaptacao para a web: Jonathan Lima
- Apoio de ferramenta de IA na organizacao do codigo e na adaptacao chibi, sempre a partir dos originais da familia

Este repositorio e o registro de um projeto de pai e filho. Se voce e recrutador: obrigado por ler ate aqui. O codigo esta comentado de proposito, para o proximo passo (inclusive o de uma crianca crescendo) ser possivel.

## Licenca e termos

O codigo esta sob a licenca MIT (`LICENSE`). O uso do site publicado segue `TERMS.md`. Os personagens e a identidade visual original continuam da familia; a licenca do codigo nao transfere a marca Broken Mirror nem os retratos como se fossem de dominio publico.
