# Roda na GPU gratuita do Kaggle (enviado por .github/workflows/dancas.yml).
# Anima cada personagem recortado (public/personagens/clipe/*.png) com o LTX-Video (imagem → vídeo)
# sobre fundo verde liso; o GitHub depois remove o fundo e gera os loops transparentes.
# Saída: /kaggle/working/<personagem>-<passo>.mp4
import os, subprocess, sys, time

subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '-U', 'diffusers>=0.32', 'transformers', 'accelerate', 'sentencepiece', 'imageio-ffmpeg'], check=True)

import torch
from PIL import Image
from urllib.request import urlopen
from diffusers import LTXImageToVideoPipeline
from diffusers.utils import export_to_video

RAW = 'https://raw.githubusercontent.com/claytongestor07-glitch/quiz-do-reino/main/public/personagens/clipe/'
PERSONAGENS = os.environ.get('PERSONAGENS', 'davi-violao,menina,leleco').split(',')
PASSOS = {
	'pula': 'jumping up and down happily to the music, bouncing',
	'balanca': 'swaying side to side to the rhythm, cheerful dance',
	'palmas': 'clapping hands above the head and dancing',
	'gira': 'dancing and turning around joyfully',
	'bracos': 'waving both arms in the air, dancing happily',
}
ESCOLHIDOS = os.environ.get('PASSOS', ','.join(PASSOS)).split(',')
L, A = 512, 768  # múltiplos de 32
VERDE = (0, 255, 0)

def preparar(nome):
	im = Image.open(urlopen(RAW + nome + '.png')).convert('RGBA')
	im.thumbnail((int(L * 0.8), int(A * 0.82)))
	fundo = Image.new('RGB', (L, A), VERDE)
	fundo.paste(im, ((L - im.width) // 2, A - im.height - int(A * 0.05)), im)
	return fundo

dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
print('GPU:', torch.cuda.get_device_name(0), dtype, flush=True)
pipe = LTXImageToVideoPipeline.from_pretrained('Lightricks/LTX-Video', torch_dtype=dtype)
pipe.enable_model_cpu_offload()
pipe.vae.enable_tiling()

for nome in PERSONAGENS:
	img = preparar(nome)
	for passo in ESCOLHIDOS:
		t = time.time()
		prompt = (f'A cute 3D cartoon kids character {PASSOS[passo]}, full body visible, '
			'smooth looping dance animation, the same character, plain solid bright green background, static camera, '
			'high quality Pixar style animation')
		frames = pipe(image=img, prompt=prompt,
			negative_prompt='worst quality, blurry, distorted, deformed, extra limbs, camera movement, background change, text, watermark',
			width=L, height=A, num_frames=97, num_inference_steps=40, guidance_scale=3.0,
			generator=torch.Generator('cpu').manual_seed(7)).frames[0]
		export_to_video(frames, f'/kaggle/working/{nome}-{passo}.mp4', fps=24)
		print(f'{nome}-{passo}: {time.time() - t:.0f}s', flush=True)
