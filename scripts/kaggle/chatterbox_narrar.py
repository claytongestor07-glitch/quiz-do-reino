# Roda na GPU gratuita do Kaggle (enviado por scripts/ci.mjs quando o narrar pede falas do Chatterbox).
# PENDENTES (injetado no início deste arquivo pelo ci.mjs): [{"arquivo": "<hash>.mp3", "texto": "..."}].
# Chatterbox Multilingual V3 (Resemble AI, licença MIT), português, tom animado para crianças.
# Saída: /kaggle/working/<hash>.wav
import subprocess, sys
subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'git+https://github.com/resemble-ai/chatterbox.git'], check=True)
# o chatterbox fixa a versão do torch; o torchvision do Kaggle fica incompatível e não é usado
subprocess.run([sys.executable, '-m', 'pip', 'uninstall', '-y', '-q', 'torchvision'], check=True)
import torchaudio as ta
from urllib.request import urlretrieve
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

try:
	modelo = ChatterboxMultilingualTTS.from_pretrained(device='cuda', t3_model='v3')
except TypeError:
	modelo = ChatterboxMultilingualTTS.from_pretrained(device='cuda')
# voz do Kiko (tirada da vinheta com o Demucs): todas as falas saem com o mesmo timbre do mascote
KIKO = '/kaggle/working/kiko-voz.wav'
urlretrieve('https://raw.githubusercontent.com/claytongestor07-glitch/quiz-do-reino/main/public/abertura/kiko-voz.wav', KIKO)
for n, p in enumerate(PENDENTES, 1):
	wav = modelo.generate(p['texto'], language_id='pt', audio_prompt_path=KIKO, exaggeration=0.7, cfg_weight=0.4)
	ta.save(f"/kaggle/working/{p['arquivo'].rsplit('.', 1)[0]}.wav", wav, modelo.sr)
	print(f'{n}/{len(PENDENTES)}', flush=True)
import os
os.remove(KIKO)
print('fim', flush=True)
