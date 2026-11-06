# Roda na GPU gratuita do Kaggle (enviado por scripts/ci.mjs quando o narrar pede falas do Chatterbox).
# PENDENTES (injetado no início deste arquivo pelo ci.mjs): [{"arquivo": "<hash>.mp3", "texto": "..."}].
# Chatterbox Multilingual V3 (Resemble AI, licença MIT), português, tom animado para crianças.
# Saída: /kaggle/working/<hash>.wav
import subprocess, sys
subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'git+https://github.com/resemble-ai/chatterbox.git'], check=True)
# o chatterbox fixa a versão do torch; o torchvision do Kaggle fica incompatível e não é usado
subprocess.run([sys.executable, '-m', 'pip', 'uninstall', '-y', '-q', 'torchvision'], check=True)
import torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

try:
	modelo = ChatterboxMultilingualTTS.from_pretrained(device='cuda', t3_model='v3')
except TypeError:
	modelo = ChatterboxMultilingualTTS.from_pretrained(device='cuda')
for n, p in enumerate(PENDENTES, 1):
	wav = modelo.generate(p['texto'], language_id='pt', exaggeration=0.8, cfg_weight=0.4)
	ta.save(f"/kaggle/working/{p['arquivo'].rsplit('.', 1)[0]}.wav", wav, modelo.sr)
	print(f'{n}/{len(PENDENTES)}', flush=True)
print('fim', flush=True)
