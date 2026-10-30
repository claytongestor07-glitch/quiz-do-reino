# Histórias bíblicas animadas — formato novo do canal

Clipe musical que **conta uma história bíblica inteira**, com personagens fixos em 3D estilo Pixar e cenas animadas por IA (Kling).
Usa o mesmo pipeline dos clipes (`scripts/clipe.mjs` + `src/Clipe.tsx`): a música canta a história e as cenas seguem a ordem do roteiro.

Primeira história: **`musicas/mu005-moises`**, "Com Deus o Mar se Abre!" (Êxodo 2–15).
Ela está com o arquivo `IGNORAR`, então o GitHub Actions **não** produz nem publica sozinho. Só apague esse arquivo depois de assistir e aprovar.

## Arte de referência

- `docs/arte/moises-personagens.webp`: folha de personagens. É a referência de aparência de todos eles.
- `docs/arte/moises-roteiro.webp`: roteiro visual com as 8 cenas. De cada quadro sai o primeiro frame da cena animada.
- `public/personagens/moises/roteiro.webp`: o roteiro reduzido para 1200 px, usado na cena parada enquanto o vídeo dela não existe.

## Personagens fixos (sempre iguais em todas as cenas)

| Personagem | Aparência (manter nos prompts) |
|---|---|
| Moisés bebê | bebê de cabelo castanho cacheado, manta azul, cesto de vime |
| Moisés criança | menino de cabelo castanho cacheado, túnica creme, faixa azul, sandálias |
| Moisés adulto | barba castanha, cabelo cacheado, túnica creme, manto azul, cinto marrom, cajado de madeira |
| Miriã | cabelo castanho longo e cacheado, tiara dourada, vestido creme com manto rosa, pandeiro com fitas coloridas |
| Arão | barba grisalha, turbante branco e azul, túnica creme com colete azul e dourado |
| Faraó | nemés azul e dourado, colar largo dourado, túnica branca, capa vermelha |
| Princesa (filha do Faraó) | cabelo preto liso, tiara dourada com pedra turquesa, vestido branco, véu turquesa |
| Crianças hebreias 1, 2 e 3 | cabelo cacheado, túnicas creme, rosa ou azul, sandálias; sempre alegres |

## Cenas (`musicas/mu005-moises/cenas.json`)

| # | Cena | Parte da música |
|---|---|---|
| 1 | `moises-1-egito`: o povo sofria no Egito | intro e verso 1 |
| 2 | `moises-2-cesto`: Miriã põe Moisés no cesto | verso 1 |
| 3 | `moises-3-princesa`: a princesa encontra Moisés | verso 1 |
| 4 | `moises-4-chamado`: a sarça ardente | verso 2 |
| 5 | `moises-5-farao`: Moisés fala com o Faraó | verso 2 |
| 6 | `moises-6-mar`: Deus abre o mar | refrão |
| 7 | `moises-7-travessia`: o povo atravessa | refrão e final |
| 8 | `moises-8-miria`: Miriã canta e celebra | final |

## Como produzir no Mac

```bash
python3 scripts/cantar.py mu005-moises
```

```bash
python3 scripts/alinhar.py mu005-moises
```

```bash
CENAS=musicas/mu005-moises/cenas.json FAL_KEY=... FAL_DURACAO=10 python3 scripts/fal_cenas.py public/cenas
```

```bash
node scripts/clipe.mjs mu005-moises
```

```bash
node scripts/clipe.mjs mu005-moises --vertical
```

```bash
node scripts/clipe.mjs mu005-moises --short
```

Os comandos fazem, na ordem:
1. Cantam a música no ACE-Step.
2. Sincronizam a letra (karaokê).
3. Animam as 8 cenas no Kling 2.5 Turbo Pro, 10 s cada. `FAL_MODELO` troca o modelo.
4. Renderizam o clipe em 16:9.
5. Renderizam a versão vertical.
6. Renderizam o Short do refrão.

Depois de assistir, apague `musicas/mu005-moises/IGNORAR` para o Actions agendar a publicação.

## Qualidade: quadros em alta (recomendado)

Os quadros do roteiro têm só ~350 px de largura. Funcionam, mas o Kling rende muito mais com quadros em 1920x1080.
Gere cada um na mesma IA que criou as artes, **anexando a folha de personagens e o quadro do roteiro**, e salve como `docs/arte/moises/<cena>.png`.
O `fal_cenas.py` usa esse arquivo automaticamente no lugar do recorte.

Prompt base (troque o trecho entre colchetes pela descrição da cena, que está no campo `prompt` do `cenas.json`):

> Using the attached character sheet as the exact reference for every character's face, hair, clothes and colors, and the attached storyboard panel as the composition reference: [scene description]. 3D Pixar-style animated film still, warm cinematic light, rich detailed background, characters fully in frame, no text, no numbers, no captions. Wide 16:9, 1920x1080.

## Novas histórias (mesmo modelo)

1. Folha de personagens (de 8 a 10 personagens) e roteiro visual com 8 quadros, no mesmo estilo das artes de Moisés.
2. Salvar as artes em `docs/arte/<história>-personagens.webp` e `docs/arte/<história>-roteiro.webp`.
3. Criar `musicas/muNNN-<história>/` com `musica.json` (cada parte lista as suas `cenas`, na ordem), `cenas.json` e `IGNORAR`.
4. Mesmos comandos acima.

Fila sugerida: Davi e Golias, Daniel na cova dos leões, Jonas e o grande peixe, Noé e a arca (contada como história), José do Egito, nascimento de Jesus, Jesus acalma a tempestade, a multiplicação dos pães.

## Regras para monetizar (Made for Kids)

- **História fiel à Bíblia** e lição clara no fim (`licao` e `fonte` no `musica.json` vão para a descrição).
- **Conteúdo original:** letra, roteiro e montagem próprios em cada vídeo. O YouTube desmonetiza conteúdo repetitivo e produzido em massa, então nada de clipes iguais com só a letra trocada.
- **Personagens fixos e reconhecíveis:** são eles que criam fidelidade no público infantil.
- **Sempre as três versões:** 16:9 (longo), vertical completa e Short do refrão, mais uma coletânea a cada 5 ou 6 histórias.
- **Nada de violência explícita:** pragas, afogamento do exército e castigos ficam fora ou são só sugeridos.
