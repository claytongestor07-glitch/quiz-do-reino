# Roda na GPU gratuita do Kaggle (workflow kenji-referencias.yml com script=kenji_voz e env CHAVES=ep001).
# Kenji Studio — falas de um episódio com o Chatterbox Multilingual (Resemble AI, MIT), em português.
# Timbre de cada personagem vem de kenji/vozes/<voz>.wav (amostras Kokoro, Apache 2.0, com tom ajustado).
# Duas tomadas por fala (sementes 1 e 2). Saída: /kaggle/working/<id>-t<n>.wav
import json, os, subprocess, sys
from urllib.request import urlopen, urlretrieve
subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'git+https://github.com/resemble-ai/chatterbox.git'], check=True)
subprocess.run([sys.executable, '-m', 'pip', 'uninstall', '-y', '-q', 'torchvision'], check=True)
import torch, torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

RAW = 'https://raw.githubusercontent.com/claytongestor07-glitch/quiz-do-reino/main/kenji/'
PASTA = os.environ.get('CHAVES', 'ep001')
FALAS = json.load(urlopen(f'{RAW}{PASTA}/falas.json'))['falas']
so = [x for x in os.environ.get('FALAS', '').split(',') if x]
if so: FALAS = [f for f in FALAS if f['id'] in so]
vozes = {}
for v in {f['voz'] for f in FALAS if f['voz']}:
	vozes[v] = f'/kaggle/working/ref-{v}.wav'
	urlretrieve(f'{RAW}vozes/{v}.wav', vozes[v])
dev = 'cuda' if torch.cuda.is_available() else 'cpu'
try:
	modelo = ChatterboxMultilingualTTS.from_pretrained(device=dev, t3_model='v3')
except TypeError:
	modelo = ChatterboxMultilingualTTS.from_pretrained(device=dev)
for n, f in enumerate(FALAS, 1):
	for t in (1, 2):
		torch.manual_seed(t)
		extra = {'audio_prompt_path': vozes[f['voz']]} if f['voz'] else {}
		wav = modelo.generate(f['texto'], language_id='pt', exaggeration=f.get('emo', 0.6), cfg_weight=0.4, **extra)
		ta.save(f"/kaggle/working/{f['id']}-t{t}.wav", wav, modelo.sr)
	print(f"{n}/{len(FALAS)} {f['id']}", flush=True)
for v in vozes.values(): os.remove(v)
print('fim', flush=True)
