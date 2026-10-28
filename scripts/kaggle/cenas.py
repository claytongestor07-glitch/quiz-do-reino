# Roda na GPU gratuita do Kaggle (enviado por .github/workflows/cenas.yml).
# Anima recortes da arte do canal (docs/arte/clipe.webp) com o Wan 2.2 TI2V-5B (imagem → vídeo):
# cada recorte vira uma "cena" de ~3,4 s (close do Davi, da menina, do Leleco, plano geral, castelo...).
# Usa as duas T4 do Kaggle em paralelo (uma thread por GPU). Saída: /kaggle/working/<cena>.mp4 (832x480, 24 fps)
import json, os, subprocess, sys, time

os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'expandable_segments:True'
ARTE = 'https://raw.githubusercontent.com/claytongestor07-glitch/quiz-do-reino/main/docs/arte/clipe.webp'
L, A, QUADROS = 832, 480, 81

# Recortes em coordenadas da arte reduzida para 1200 px de largura (x, y, largura); altura = largura * 9/16
CENAS = {
	'davi': ((20, 110, 600), 'The curly haired boy strums his acoustic guitar and sings happily, bobbing his head to the music'),
	'davi-canta': ((120, 100, 420), 'Close-up: the curly haired boy sings joyfully with a big smile, moving his head to the rhythm'),
	'lulu': ((270, 270, 400), 'The fluffy white lamb bounces happily and smiles, wiggling its ears'),
	'menina': ((440, 150, 600), 'The girl in the pink dress sings and waves her arms joyfully, swaying side to side'),
	'menina-canta': ((560, 160, 380), 'Close-up: the girl with the pink bow sings happily and smiles, tilting her head'),
	'leleco': ((720, 230, 480), 'The friendly lion cub claps its paws and sways happily, smiling'),
	'duo-esquerda': ((0, 80, 800), 'The boy plays guitar while the lamb bounces next to him, both singing happily'),
	'duo-direita': ((500, 130, 700), 'The girl dances with raised arms next to the lion cub, who claps along'),
	'geral': ((66, 0, 1067), 'The children and animals sing and dance together happily, slow camera push in'),
	'geral-festa': ((0, 0, 1200), 'Everyone celebrates and dances, the music notes float and bounce in the air'),
	'castelo': ((780, 20, 400), 'Slow camera pan across the shining castle and the waterfall, birds flying, sunny day'),
	'biblia': ((350, 319, 500), 'The open Bible glows softly with golden sparkles floating up from the pages'),
}
ESTILO = ' 3D Pixar style children animation, smooth natural motion, consistent characters, vibrant colors, high quality.'
NEGATIVO = ('worst quality, low quality, blurry, distorted, deformed face, extra fingers, extra limbs, morphing, flicker, '
	'text, watermark, subtitles, static image, still picture')

subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '-U', 'diffusers>=0.35', 'transformers', 'accelerate', 'ftfy', 'imageio-ffmpeg'], check=True)

import threading
from io import BytesIO
from urllib.request import urlopen
import torch
from PIL import Image
from diffusers import AutoencoderKLWan, WanImageToVideoPipeline
from diffusers.utils import export_to_video

MODELO = 'Wan-AI/Wan2.2-TI2V-5B-Diffusers'
arte = Image.open(BytesIO(urlopen(ARTE).read())).convert('RGB')
k = arte.width / 1200
escolhidas = [c for c in os.environ.get('CENAS', ','.join(CENAS)).split(',') if c in CENAS]

# 1. Textos codificados uma vez na CPU (bf16) e o codificador sai da memória: a T4 (< sm80) não tem bf16 nativo
texto = WanImageToVideoPipeline.from_pretrained(MODELO, transformer=None, vae=None, torch_dtype=torch.bfloat16)
embeds = {}
with torch.no_grad():
	for nome in escolhidas:
		p, n = texto.encode_prompt(CENAS[nome][1] + ESTILO, NEGATIVO, device='cpu')
		embeds[nome] = (p.to(torch.float16), n.to(torch.float16))
del texto

# 2. Um pipeline por GPU (o Kaggle dá duas T4), transformer em fp16 e VAE em fp32; cenas divididas entre elas
def trabalhador(gpu, nomes):
	dev = f'cuda:{gpu}'
	vae = AutoencoderKLWan.from_pretrained(MODELO, subfolder='vae', torch_dtype=torch.float32)
	pipe = WanImageToVideoPipeline.from_pretrained(MODELO, vae=vae, text_encoder=None, tokenizer=None, torch_dtype=torch.float16).to(dev)
	if hasattr(pipe.vae, 'enable_tiling'): pipe.vae.enable_tiling()
	print(f'[gpu{gpu}] pronto: {torch.cuda.get_device_name(gpu)}', flush=True)
	for nome in nomes:
		t = time.time()
		(x, y, w), _ = CENAS[nome]
		img = arte.crop((int(x * k), int(y * k), int((x + w) * k), int((y + w * 9 / 16) * k))).resize((L, A), Image.LANCZOS)
		p, n = embeds[nome]
		frames = pipe(image=img, prompt_embeds=p.to(dev), negative_prompt_embeds=n.to(dev),
			height=A, width=L, num_frames=QUADROS, num_inference_steps=40, guidance_scale=5.0,
			generator=torch.Generator(dev).manual_seed(11)).frames[0]
		export_to_video(frames, f'/kaggle/working/{nome}.mp4', fps=24)
		print(f'[gpu{gpu}] {nome}: {time.time() - t:.0f}s', flush=True)

gpus = max(1, torch.cuda.device_count())
fios = []
for g in range(gpus):
	if escolhidas[g::gpus]:
		fios.append(threading.Thread(target=trabalhador, args=(g, escolhidas[g::gpus])))
		fios[-1].start()
		time.sleep(60)  # carrega um de cada vez para não estourar a RAM
for f in fios: f.join()
