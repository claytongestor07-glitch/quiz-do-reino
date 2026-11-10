# Plano B da voz (quando a cota semanal de GPU do Kaggle acaba): Chatterbox Multilingual (MIT) no processador
# do próprio GitHub Actions. Mais lento, mesma voz. Uso: python scripts/chatterbox_cpu.py <pendentes.json> <pasta de saída>
import json, sys
import torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

pendentes = json.load(open(sys.argv[1]))
try:
	modelo = ChatterboxMultilingualTTS.from_pretrained(device='cpu', t3_model='v3')
except TypeError:
	modelo = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
for n, p in enumerate(pendentes, 1):
	wav = modelo.generate(p['texto'], language_id='pt', exaggeration=0.8, cfg_weight=0.4)
	ta.save(f"{sys.argv[2]}/{p['arquivo'].rsplit('.', 1)[0]}.wav", wav, modelo.sr)
	print(f'[voz-cpu] {n}/{len(pendentes)}', flush=True)
