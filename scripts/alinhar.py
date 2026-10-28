# Sincroniza a letra com a voz cantada (karaokê): musicas/<id>/musica.wav + musica.json → musicas/<id>/palavras.json
# Uso: python scripts/alinhar.py <id>
# O Whisper reconhece as palavras com tempo; a letra conhecida é casada com o reconhecido (difflib) e as palavras
# que ele não ouviu ganham tempo por interpolação dentro da linha. Saída: [{parte, linha, palavras: [{p, de, ate}]}]
import difflib, json, re, sys, unicodedata
from pathlib import Path
from faster_whisper import WhisperModel

pasta = Path('musicas') / sys.argv[1]
musica = json.loads((pasta / 'musica.json').read_text())
audio = next(p for p in (pasta / 'musica.wav', pasta / 'musica.mp3') if p.exists())

def norm(w):
	w = unicodedata.normalize('NFD', w.lower())
	return re.sub(r'[^a-z0-9]', '', ''.join(c for c in w if unicodedata.category(c) != 'Mn'))

linhas = [(k, i, l) for k, parte in enumerate(musica['partes']) for i, l in enumerate(parte['letra'])]
letra = [(n, w) for n, (_, _, l) in enumerate(linhas) for w in l.split()]

modelo = WhisperModel('small', device='cpu', compute_type='int8')
segs, _ = modelo.transcribe(str(audio), language='pt', word_timestamps=True, vad_filter=False, beam_size=5,
	initial_prompt=' '.join(l for _, _, l in linhas)[:800])
ouvidas = [(norm(w.word), w.start, w.end) for s in segs for w in (s.words or []) if norm(w.word)]
print(f'{len(ouvidas)} palavras ouvidas, {len(letra)} na letra', flush=True)

tempos = [None] * len(letra)
sm = difflib.SequenceMatcher(None, [norm(w) for _, w in letra], [o[0] for o in ouvidas], autojunk=False)
for a, b, n in sm.get_matching_blocks():
	for j in range(n): tempos[a + j] = ouvidas[b + j][1:]
casadas = sum(t is not None for t in tempos)
print(f'{casadas}/{len(letra)} palavras casadas', flush=True)

# Interpola as que faltam entre vizinhas casadas (o fim da música vem da duração do áudio)
fim_audio = ouvidas[-1][2] + 2 if ouvidas else 120
conhecidas = [i for i, t in enumerate(tempos) if t]
for i, t in enumerate(tempos):
	if t: continue
	ant = max((j for j in conhecidas if j < i), default=None)
	pro = min((j for j in conhecidas if j > i), default=None)
	t0 = tempos[ant][1] if ant is not None else 0.5
	t1 = tempos[pro][0] if pro is not None else fim_audio
	na, np_ = (ant if ant is not None else -1), (pro if pro is not None else len(tempos))
	passo = (t1 - t0) / (np_ - na)
	tempos[i] = (t0 + passo * (i - na - 1), t0 + passo * (i - na))

saida, pos = [], 0
for n, (k, i, l) in enumerate(linhas):
	ws = l.split()
	saida.append({'parte': k, 'linha': i, 'palavras': [
		{'p': w, 'de': round(tempos[pos + j][0], 2), 'ate': round(tempos[pos + j][1], 2)} for j, w in enumerate(ws)]})
	pos += len(ws)
(pasta / 'palavras.json').write_text(json.dumps(saida, ensure_ascii=False, indent=1))
print('ok', pasta / 'palavras.json')
