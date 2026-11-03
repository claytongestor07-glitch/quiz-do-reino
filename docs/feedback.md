# Preferências do senhor (o roteirista lê antes de escrever)

Cada aprovação ou ajuste pedido entra aqui, para os próximos episódios seguirem o modelo aprovado.

## Já definido
- Estilo visual: game show "Adivinhe pelos Emojis" (referência: canal SpeedQuiz), cores vivas, emojis 3D, cronômetro, revelação em cartão.
- Narradora: Lulu, voz Kokoro Dora. Mascotes Lulu (ovelha) e Leleco (leão) nos cantos.
- 30 desafios por episódio (~8–9 min), público de 5 a 9 anos, Made for Kids.

## Ajustes pedidos
- 26/10/2026: vídeos longos em 16:9 com "quiz completo", ALTERNANDO formatos a cada episódio: "emoji" (Adivinhe pelos Emojis) e "abc" (pergunta com alternativas A, B, C), ambos no visual colorido do piloto.
- 26/10/2026: 3 Shorts verticais por episódio, terminando com "Quiz completo no canal", para levar público ao canal.
- 26/10/2026: todo vídeo precisa ter pelo menos 5 minutos. Mantém os Shorts curtos (alcance) E cria uma versão VERTICAL COMPLETA de cada episódio (mesmo quiz inteiro, 1080x1920, 5+ min).

## Nome do canal (senhor, 2026-10-26)
- O canal se chama **Quiz do Reino** (antes "Pequenos Sábios", nome já usado por outro canal).
- Abertura da Lulu: "Oi, criançada! Bem-vindos ao Quiz do Reino! Eu sou a Lulu! ..."
- Encerramento: quem passa de ~2/3 dos pontos "é craque do Reino!". Nunca usar "pequeno sábio".
- Trilha: `trilha-energia.wav` (150 BPM, agitada, "que gere dopamina").

## Mudança de formato (senhor, 2026-10-27)
- Referência: canal **Bento e Totó** (clipes musicais infantis de 2–3 min, 11 mi inscritos). O canal passa a ser de **clipes musicais cristãos** com Davi, Lulu e Leleco: músicas animadas e grudentas, refrão repetido, temas simples (bichos da arca, cores da criação, números, família, oração, gratidão).
- Coletâneas de 15–25 min juntando os clipes; Shorts com o refrão.
- Enquanto o novo formato não estiver pronto: NÃO escrever novos quizzes. Os quizzes já roteirizados terminam de ser publicados normalmente.
- 27/10/2026: produção automática de clipes LIGADA (senhor: "músicas evangélicas e educativas"). Personagens e cenário da nova arte (docs/arte/clipe.webp): Davi com violão + Lulu, a menina, Leleco e a Bíblia. Músicas cantadas pelo ACE-Step 1.5 na nuvem; letras originais, sempre ensinando algo (números, cores, criação, corpo, boas maneiras…).

## NOVO FORMATO OBRIGATÓRIO — quiz de animais em rodadas (senhor, 2026-11-03)
Tem prioridade sobre tudo acima que conflitar. Episódios em `quiz.json` com `"tipo": "abc"`, `"categoria": "animais"`, `"formato": "rodada"` (modelo: `episodios/ep009-rodada`). O `validar.mjs` cobra as regras marcadas com ✔.
- Canal exclusivamente de perguntas e respostas sobre **animais**: identificação, sons, alimentação, habitat, características, filhotes, movimentos e habilidades.
- Todo episódio começa com a **vinheta do Kiko** (`public/abertura/kiko.mp4`) e vai direto para a primeira pergunta. Sem abertura falada.
- ✔ **20 rodadas** por episódio. Cada rodada: pergunta simples → alternativas A, B e C **com nome e imagem** (✔ 3 imagens Fluent Emoji) → contagem de **5 s**, que só começa depois de ler a pergunta e as três alternativas → "A resposta certa é B: elefante!" com a certa destacada → próxima.
- Narração exatamente como o modelo: "Qual destes animais tem tromba? A: Girafa. B: Elefante. C: Zebra." … "A resposta certa é B: elefante!". ✔ Sem explicação, curiosidade, referência ou história entre as perguntas.
- Encerramento: uma frase curta de agradecimento ("Obrigado por jogar com a gente! Até o próximo quiz!").
- Público de 5 a 9 anos: português do Brasil, frases curtas, narração alegre e acolhedora. Nunca constranger quem errou.
- Sem verdadeiro ou falso, sem perguntas abertas, de opinião ou com mais de uma resposta possível. Sem pegadinhas nem informação duvidosa: conferir cada resposta.
- ✔ Uma única alternativa certa por pergunta; ✔ respostas distribuídas entre A, B e C (cada letra de 5 a 9 vezes, nunca 3 seguidas iguais); ✔ não repetir perguntas de episódios anteriores (registro em `docs/perguntas-animais.md`).
- A imagem de cada alternativa tem que ser exatamente o animal citado. As imagens das três alternativas não podem entregar qual é a certa.
- Entrega de cada episódio (no chat): 3 títulos, ideia de capa, tabela das 20 rodadas (Número | Pergunta | A | B | C | Resposta certa | Visual), narração completa, descrição curta e registro das perguntas.
- "CRIAR PRÓXIMO" = novo episódio completo nestas regras.
- 03/11/2026 — Ganchos com o Kiko (automáticos no `narrar.mjs`, frases variam por episódio): logo depois da vinheta ("Será que você acerta todas as 20?"), depois da 5ª ("Você está indo muito bem!"), na metade (chamada para curtir e seguir), depois da 15ª ("Reta final! Faltam só cinco!") e no fim (chamada para curtir e seguir, e então o agradecimento). Cada gancho dura de 2 a 5 s, com o Kiko na tela.
- A chamada para curtir e seguir sempre fala com o adulto ("peça para um adulto curtir o vídeo e seguir o canal"), porque os vídeos são "conteúdo para crianças" no YouTube. Continua proibido pedir comentários ou mandar para fora do YouTube.
