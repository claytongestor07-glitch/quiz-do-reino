# Voz local Kokoro (modelo Apache-2.0): gera fala em português do Brasil sem internet nem conta.
# Uso: .venv-kokoro/bin/python -I scripts/kokoro_tts.py <voz> <velocidade> <saida.wav> "<texto>"
import sys
from pathlib import Path
import wave
import numpy as np
from kokoro_onnx import Kokoro

raiz = Path(__file__).resolve().parent.parent / 'modelos' / 'kokoro'
voz, velocidade, saida, texto = sys.argv[1], float(sys.argv[2]), sys.argv[3], sys.argv[4]
kokoro = Kokoro(str(raiz / 'kokoro-v1.0.int8.onnx'), str(raiz / 'voices-v1.0.bin'))
amostras, taxa = kokoro.create(texto, voice=voz, speed=velocidade, lang='pt-br')
pcm = (np.clip(amostras, -1, 1) * 32767).astype('<i2')
with wave.open(saida, 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(taxa)
    w.writeframes(pcm.tobytes())
