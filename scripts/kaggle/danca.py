# Roda na GPU gratuita do Kaggle (enviado por .github/workflows/dancas.yml).
# Anima cada personagem recortado (public/personagens/clipe/*.png) com o LTX-Video (imagem → vídeo)
# sobre fundo verde liso; o GitHub depois remove o fundo e gera os loops transparentes.
# Saída: /kaggle/working/<personagem>-<passo>.mp4
import os, subprocess, sys, time
os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'expandable_segments:True'

subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '-U', 'diffusers>=0.32', 'transformers', 'accelerate', 'sentencepiece', 'imageio-ffmpeg'], check=True)

import torch
from PIL import Image
from urllib.request import urlopen
from diffusers import LTXImageToVideoPipeline
from diffusers.utils import export_to_video

RAW = 'https://raw.githubusercontent.com/claytongestor07-glitch/quiz-do-reino/main/public/personagens/clipe/'
PERSONAGENS = os.environ.get('PERSONAGENS', 'davi-violao,menina,leleco').split(',')
# Movimentos curtos e no lugar: pulos grandes fazem o modelo deformar o personagem
PASSOS = {
	'balanca': 'sways gently side to side to the music, smiling, staying in the same place',
	'pula': 'does small happy bounces in place to the beat, smiling',
	'palmas': 'claps hands happily to the beat, staying in the same place',
	'cabeca': 'nods the head to the rhythm and smiles, small body movement',
	'bracos': 'raises one arm and waves happily, staying in the same place',
}
QUEM = {
	'davi-violao': 'a cute cartoon boy with curly brown hair holding an acoustic guitar, sitting next to a fluffy white lamb',
	'menina': 'a cute cartoon girl with a pink dress',
	'leleco': 'a cute cartoon lion cub with a golden mane',
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

# T4/P100 (< sm80) só "emulam" bf16: a atenção cai no modo lento que estoura a memória; fp16 usa o kernel econômico
dtype = torch.bfloat16 if torch.cuda.get_device_capability()[0] >= 8 else torch.float16
print('GPU:', torch.cuda.get_device_name(0), dtype, flush=True)
pipe = LTXImageToVideoPipeline.from_pretrained('a-r-r-o-w/LTX-Video-0.9.1-diffusers', torch_dtype=dtype)
pipe.enable_model_cpu_offload()
pipe.vae.enable_tiling()

for nome in PERSONAGENS:
	img = preparar(nome)
	for passo in ESCOLHIDOS:
		t = time.time()
		prompt = (f'{QUEM.get(nome, "a cute cartoon character")} {PASSOS[passo]}. Full body visible, the character keeps '
			'the same look, smooth gentle animation, plain solid bright green background, static camera, 3D Pixar style')
		frames = pipe(image=img, prompt=prompt,
			negative_prompt='worst quality, blurry, motion blur, distorted, deformed face, morphing, extra limbs, jumping out of frame, camera movement, background change, text, watermark',
			width=L, height=A, num_frames=49, num_inference_steps=50, guidance_scale=3.0,
			decode_timestep=0.03, decode_noise_scale=0.025,
			generator=torch.Generator('cpu').manual_seed(7)).frames[0]
		export_to_video(frames, f'/kaggle/working/{nome}-{passo}.mp4', fps=24)
		print(f'{nome}-{passo}: {time.time() - t:.0f}s', flush=True)
