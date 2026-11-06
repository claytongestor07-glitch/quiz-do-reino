# Roda na GPU gratuita do Kaggle (enviado por .github/workflows/kenji-referencias.yml com script=chatterbox_teste).
# Teste da voz Chatterbox Multilingual V3 (Resemble AI, licença MIT, uso comercial permitido) em português,
# com frases do quiz e dois níveis de emoção. Saída: /kaggle/working/voz-<n>-<emocao>.wav
import subprocess, sys
subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'chatterbox-tts'], check=True)
import torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

FRASES = [
	'Número sete! Qual animal é esse?',
	'É a capivara! Sabia que ela é o maior roedor do mundo e adora nadar?',
	'Muito bem! Você está indo muito bem, continua comigo!',
	'Chegamos na metade! Se você está gostando, peça para um adulto curtir o vídeo e seguir o canal!',
]
modelo = ChatterboxMultilingualTTS.from_pretrained(device='cuda', t3_model='v3')
for n, frase in enumerate(FRASES, 1):
	for nome, emocao in [('calma', 0.5), ('animada', 0.8)]:
		wav = modelo.generate(frase, language_id='pt', exaggeration=emocao, cfg_weight=0.4)
		ta.save(f'/kaggle/working/voz-{n}-{nome}.wav', wav, modelo.sr)
		print(n, nome, flush=True)
print('fim', flush=True)
