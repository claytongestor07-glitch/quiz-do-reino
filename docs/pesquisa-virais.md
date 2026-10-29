# Pesquisa: o que prende as crianças (out/2026)

## Referências
- **Bento e Totó:** 10,7 mi de inscritos, cerca de 350 mi de views por mês e uns US$ 236 mil por mês estimados ([vidIQ](https://vidiq.com/youtube-stats/channel/@bentoetoto/)). Faz desenho 2D simples, com personagens fixos e músicas de gesto e rotina.
- **Mundo Bita:** 22,9 bi de views ([Meio & Mensagem](https://www.meioemensagem.com.br/midia/30-canais-brasileiros-engajam-criancas-youtube)).
- **ECA Digital (vigente desde 17/03/2026):** canais com criança protagonista perdem espaço. Personagem animado é o caminho seguro.
- **Cocomelon:** cores fortes, repetição, músicas familiares e troca de estímulo assim que a atenção cai ([YourStory](https://yourstory.com/2024/10/kids-obsessed-cocomelon-strategy-addiction)).

## Regras para os próximos clipes
1. **Gancho nos primeiros 3 s:**
   - Um personagem chama a criança pelo nome do grupo ("Ê, criançada!") e já faz um gesto.
   - Não usar tela de título parada.
2. **Música de gesto:** a letra manda e o personagem faz junto, para a criança imitar em casa.
   - Palavras: palma, pula, gira, mãozinha pra cima, abre os braços.
   - O motor já entende essas palavras em src/Desenho.tsx.
3. **Refrão repetido:** de 3 a 4 vezes, com 2 frases curtas que dão para cantar em 1 ouvida.
4. **Encenar a história linha a linha:**
   - O que a letra diz aparece na tela (pedras, coração, gigante caindo).
   - A câmera corta a cada linha.
5. **Personagens fixos:** Davi, Lulu e Leleco sempre iguais (desenho em código e não IA), o que cria vínculo e reconhecimento na miniatura.
6. **Duração:**
   - Clipe principal de 2 a 3 min.
   - Compilações de 30 a 60 min juntando os clipes (é onde os grandes canais somam horas de exibição).
   - Shorts com o refrão.
7. **Dólar:**
   - Versões em inglês e espanhol da mesma música e da mesma animação. Só a voz e a letra mudam, e o desenho é reaproveitado.
   - É a forma mais barata de chegar a públicos com CPM maior.

## Ferramentas avaliadas
- **Remotion (em uso):**
  - Animação em código, com controle total, e já é o motor do canal.
  - O novo motor está em src/Desenho.tsx: personagens articulados, boca por sílaba e dança no bpm medido.
- **[OpenMontage](https://github.com/calesthio/OpenMontage):**
  - Licença AGPL, ~72 mil estrelas.
  - Sistema de produção de vídeo com agente, com rigs SVG + GSAP.
  - Boa fonte de ideias de rig e poses. A licença AGPL exige cuidado ao copiar código.
- **Rive (@remotion/rive):** personagens com boca por fonema via máquina de estados. É o próximo nível de acabamento se desenharmos os personagens no editor do Rive.
- **Motion Canvas / Revideo:** bons para explicativos. Não compensam trocar o Remotion ([comparação](https://www.pkgpulse.com/guides/remotion-vs-motion-canvas-vs-revideo-programmatic-video-2026)).
