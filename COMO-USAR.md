# Pequenos Sábios — como usar

Novo episódio: criar `episodios/<id>/quiz.json` (o Claude escreve; mesmo formato do `ep001-noe`) e rodar:

```bash
node scripts/produzir.mjs <id>              # valida, narra, renderiza vídeo + miniatura + 3 Shorts
touch episodios/<id>/APROVADO                # depois de assistir e aprovar
node scripts/publicar.mjs enviar <id> --quando=2026-11-01T09:00:00-03:00
```

| Comando | O que faz |
|---|---|
| `node scripts/validar.mjs <id>` | Confere roteiro: 15–20 perguntas, 3 alternativas, referências bíblicas, regras Made for Kids |
| `node scripts/narrar.mjs <id>` | Gera falas na ElevenLabs (cache: não cobra de novo o que já existe) |
| `node scripts/render.mjs <id>` | Renderiza e valida duração, resolução, volume e trechos pretos |
| `node scripts/render.mjs <id> --short=N` | Short vertical da pergunta N |
| `node scripts/publicar.mjs autorizar` | Uma vez: liga o canal (token em `~/.config/pequenos-sabios/`) |
| `node scripts/publicar.mjs metricas` | Registra visualizações em `logs/metricas.csv` |
| `npm run studio` | Abre o editor visual do Remotion |

- Falhou? Rode o mesmo comando de novo: cada etapa retoma do ponto em que parou. Os registros ficam em `logs/AAAA-MM-DD.log`.
- `config/canal.json` → `"publicacaoAutomatica": true` dispensa o arquivo APROVADO (só depois dos primeiros episódios aprovados).
- Trilha e efeitos são originais, sintetizados por `scripts/sons.mjs`. Personagens são vetoriais em `src/Personagens.tsx`.
- Este Mac (macOS 13) não roda o FFmpeg embutido no Remotion; a codificação usa o FFmpeg do sistema.
