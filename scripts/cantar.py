# Canta a música de musicas/<id>/musica.json com o modelo aberto ACE-Step 1.5 (servidor local em localhost:8001,
# iniciado pelo workflow .github/workflows/clipes.yml) e salva musicas/<id>/musica.wav (WAV: o servidor não precisa de FFmpeg).
# Uso: python3 scripts/cantar.py mu001-davi
import json, sys, time, urllib.request
from pathlib import Path

ROTULO = {'intro': 'Intro', 'verso': 'Verse', 'refrao': 'Chorus', 'ponte': 'Bridge', 'final': 'Outro'}
dir = Path('musicas') / sys.argv[1]
m = json.loads((dir / 'musica.json').read_text(encoding='utf-8'))
letra = '\n\n'.join(f"[{ROTULO.get(p['tipo'], 'Verse')}]\n" + '\n'.join(p['letra']) for p in m['partes'])

def post(caminho, dados):
    r = urllib.request.Request(f'http://localhost:8001{caminho}', json.dumps(dados).encode(), {'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(r, timeout=600))

t = post('/release_task', {'prompt': m['estilo'], 'lyrics': letra, 'audio_duration': m.get('duracao', 120),
                           'vocal_language': 'pt', 'thinking': True, 'batch_size': 1, 'audio_format': 'wav'})
tid = (t.get('data') or t)['task_id']
inicio = time.time()
while True:
    time.sleep(20)
    item = (post('/query_result', {'task_id_list': [tid]}).get('data') or [{}])[0]
    if item.get('status') in (1, 2):
        break
    print(f'cantando… {int(time.time() - inicio)} s', flush=True)
if item['status'] == 2:
    sys.exit(f"ACE-Step falhou: {item.get('progress_text', '')[:300]}")
res = item['result']
res = json.loads(res) if isinstance(res, str) else res
arq = (res[0] if isinstance(res, list) else res)['file']
urllib.request.urlretrieve(arq if arq.startswith('http') else f'http://localhost:8001{arq}', dir / 'musica.wav')
print(f'pronto: {dir / "musica.wav"} em {int(time.time() - inicio)} s')
