# Roda na GPU gratuita do Kaggle (enviado por .github/workflows/cenas.yml).
# Anima recortes da arte do canal (docs/arte/clipe.webp) com o Wan 2.2 TI2V-5B (imagem → vídeo):
# cada recorte vira uma "cena" de ~3,4 s (close do Davi, da menina, do Leleco, plano geral, castelo...).
# Usa as duas T4 do Kaggle em paralelo (uma thread por GPU). Saída: /kaggle/working/<cena>.mp4 (832x480, 24 fps)
import json, os, subprocess, sys, time
from urllib.request import urlopen

os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'expandable_segments:True'
RAW = 'https://raw.githubusercontent.com/claytongestor07-glitch/quiz-do-reino/main/'
ARTE = RAW + 'docs/arte/clipe.webp'
L, A, QUADROS = 832, 480, 81

# Tabela única de cenas (também usada pelo clipe), src/cenas.json: recorte (x, y, largura na arte a 1200 px) e pedido
CENAS = {n: (tuple(c['recorte']), c['prompt']) for n, c in json.load(urlopen(RAW + 'src/cenas.json'))['cenas'].items()}
ESTILO = ' 3D Pixar style children animation, smooth natural motion, consistent characters, vibrant colors, high quality.'
NEGATIVO = ('worst quality, low quality, blurry, distorted, deformed face, extra fingers, extra limbs, morphing, flicker, '
	'text, watermark, subtitles, static image, still picture')

subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '-U', 'diffusers>=0.35', 'transformers', 'accelerate', 'ftfy', 'imageio-ffmpeg'], check=True)

import threading
from io import BytesIO
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

# 2. Um pipeline por GPU (o Kaggle dá duas T4), transformer em fp16 e VAE em fp32; carregados em série
#    (inicializar a CUDA em duas threads ao mesmo tempo dá "operation not permitted") e depois gerando em paralelo
def carregar(gpu):
	vae = AutoencoderKLWan.from_pretrained(MODELO, subfolder='vae', torch_dtype=torch.float32)
	pipe = WanImageToVideoPipeline.from_pretrained(MODELO, vae=vae, text_encoder=None, tokenizer=None, torch_dtype=torch.float16).to(f'cuda:{gpu}')
	if hasattr(pipe.vae, 'enable_tiling'): pipe.vae.enable_tiling()
	print(f'[gpu{gpu}] pronto: {torch.cuda.get_device_name(gpu)}', flush=True)
	return pipe

def trabalhador(gpu, pipe, nomes):
	dev = f'cuda:{gpu}'
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

gpus = min(max(1, torch.cuda.device_count()), len(escolhidas))
pipes = [carregar(g) for g in range(gpus)]
fios = [threading.Thread(target=trabalhador, args=(g, pipes[g], escolhidas[g::gpus])) for g in range(gpus)]
for f in fios: f.start()
for f in fios: f.join()
