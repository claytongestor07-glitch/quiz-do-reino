# Roda na GPU gratuita do Kaggle (enviado por .github/workflows/kenji-referencias.yml com FICHAS=1).
# Fichas dos personagens do Kenji Studio a partir das referências aprovadas pelo senhor (kenji/*.jpg deste repositório):
# SDXL 1.0 + IP-Adapter Plus (a imagem de referência guia rosto, roupa e estilo; o texto pede vista ou expressão).
# Saída: /kaggle/working/<personagem>-<vista>-<semente>.png
import os, subprocess, sys, threading, time
from io import BytesIO
from urllib.request import urlopen

subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '-U', 'diffusers>=0.30', 'transformers', 'accelerate'], check=True)
import torch
from PIL import Image
from diffusers import AutoencoderKL, StableDiffusionXLPipeline
from transformers import CLIPVisionModelWithProjection

RAW = 'https://raw.githubusercontent.com/claytongestor07-glitch/quiz-do-reino/main/kenji/'
ESTILO = ('3D CGI animated feature film still, stylized 3D character, subsurface scattering skin, soft global illumination, '
	'plain light grey studio background, same character, same outfit, clean anatomy, five fingers per hand, highly detailed')
NEGATIVO = ('extra fingers, deformed hands, distorted face, different outfit, different hairstyle, photo, realistic photograph, '
	'anime, 2D, sketch, text, watermark, multiple characters, cropped')

DESCRICAO = {
	'kenji': '9-year-old boy with East Asian features, black hair combed up and back, shiny royal blue jacket with round gold badge, cream high-collar top, beige trousers, white sneakers',
	'vovo-hiro': '72-year-old grandfather with East Asian features, round black glasses, white moustache, olive green cardigan, grey trousers, brown shoes',
	'lia': '9-year-old Black girl, voluminous curly hair with red and white striped headband, red glasses, yellow polo shirt, denim overalls, red sneakers',
}
VISTAS = {
	'lado': ('full body side view profile, standing', 832, 1216),
	'costas': ('full body back view, seen from behind, standing', 832, 1216),
	'alegre': ('portrait, very happy laughing expression', 1024, 1024),
	'pensativo': ('portrait, thoughtful expression, hand on chin', 1024, 1024),
	'inseguro': ('portrait, insecure worried expression, looking down', 1024, 1024),
	'frustrado': ('portrait, frustrated pouting expression', 1024, 1024),
	'surpreso': ('portrait, surprised expression, mouth open', 1024, 1024),
	'orgulhoso': ('portrait, proud confident smile', 1024, 1024),
}
# Kenji tem a ficha completa; avô e Lia, as vistas e duas expressões
PEDIDOS = [(p, v) for p in DESCRICAO for v in VISTAS if p == 'kenji' or v in ('lado', 'costas', 'alegre', 'pensativo')]
SEMENTES = [5, 50]
REFS = {p: Image.open(BytesIO(urlopen(RAW + p + '.jpg').read())).convert('RGB') for p in DESCRICAO}

def carregar(gpu):
	enc = CLIPVisionModelWithProjection.from_pretrained('h94/IP-Adapter', subfolder='models/image_encoder', torch_dtype=torch.float16)
	vae = AutoencoderKL.from_pretrained('madebyollin/sdxl-vae-fp16-fix', torch_dtype=torch.float16)
	pipe = StableDiffusionXLPipeline.from_pretrained('stabilityai/stable-diffusion-xl-base-1.0', vae=vae, image_encoder=enc,
		torch_dtype=torch.float16, variant='fp16', use_safetensors=True)
	pipe.load_ip_adapter('h94/IP-Adapter', subfolder='sdxl_models', weight_name='ip-adapter-plus_sdxl_vit-h.safetensors')
	pipe.set_ip_adapter_scale(0.6)
	pipe.to(f'cuda:{gpu}')
	print(f'[gpu{gpu}] pronto', flush=True)
	return pipe

def trabalhador(gpu, pipe, tarefas):
	for (p, v), s in tarefas:
		t = time.time()
		pedido, L, A = VISTAS[v]
		img = pipe(prompt=f'{pedido} of {DESCRICAO[p]}, {ESTILO}', negative_prompt=NEGATIVO, ip_adapter_image=REFS[p],
			width=L, height=A, num_inference_steps=40, guidance_scale=6.0, generator=torch.Generator(f'cuda:{gpu}').manual_seed(s)).images[0]
		img.save(f'/kaggle/working/{p}-{v}-{s}.png')
		print(f'[gpu{gpu}] {p}-{v}-{s}: {time.time() - t:.0f}s', flush=True)

tarefas = [(pv, s) for pv in PEDIDOS for s in SEMENTES]
gpus = max(1, torch.cuda.device_count())
pipes = [carregar(g) for g in range(gpus)]
fios = [threading.Thread(target=trabalhador, args=(g, pipes[g], tarefas[g::gpus])) for g in range(gpus)]
for f in fios: f.start()
for f in fios: f.join()
print('fim', flush=True)
