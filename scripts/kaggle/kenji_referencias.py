# Roda na GPU gratuita do Kaggle (enviado por .github/workflows/kenji-referencias.yml).
# Gera candidatas a imagem de referência dos personagens do Kenji Studio com o SDXL 1.0
# (licença CreativeML OpenRAIL++-M, uso comercial permitido). FLUX ficou de fora: precisa de bf16, que a T4 não tem.
# Saída: /kaggle/working/<nome>-<semente>.png (3 sementes por pedido, para o senhor escolher)
import os, subprocess, sys, threading, time

subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '-U', 'diffusers>=0.30', 'transformers', 'accelerate'], check=True)
import torch
from diffusers import AutoencoderKL, StableDiffusionXLPipeline

ESTILO = ('stylized 3D animated family film character, original design, soft global illumination, warm cinematic light, '
	'natural skin materials, gentle expressive eyes, clean anatomy, five fingers per hand, highly detailed, octane render')
NEGATIVO = ('extra fingers, deformed hands, distorted face, asymmetrical eyes, horror, dark, scary, text, watermark, logo, '
	'blurry, low quality, photo, realistic photograph, multiple characters, cropped feet')
FUNDO = 'plain light grey studio background'

KENJI = ('9-year-old boy with East Asian features, round face, warm dark-brown almond eyes, thick expressive eyebrows, '
	'short straight black hair with fringe swept to one side and one cowlick on top, royal blue zip jacket with white cuffs, '
	'off-white t-shirt, beige trousers, white sneakers with blue stripe, friendly curious smile')
VOVO = ('72-year-old grandfather with East Asian features, kind smile lines, thin round gold-rimmed glasses, short grey moustache, '
	'thinning grey hair, olive green cardigan over white shirt, charcoal trousers, brown leather shoes, calm slightly stooped posture')
LIA = ('9-year-old Black girl with voluminous curly hair held by a yellow headband, red-framed glasses, denim overalls over '
	'red and white striped t-shirt, red sneakers, bright clever smile, holding a small sketchbook')

# nome: (prompt, largura, altura)
PEDIDOS = {
	'kenji-corpo': (f'full body front view of {KENJI}, standing, {FUNDO}', 832, 1216),
	'kenji-rosto': (f'portrait close-up of {KENJI}, {FUNDO}', 1024, 1024),
	'kenji-ficha': (f'character turnaround sheet of {KENJI}, three views side by side: front, side, back, same character, {FUNDO}', 1344, 768),
	'vovo-corpo': (f'full body front view of {VOVO}, standing, {FUNDO}', 832, 1216),
	'vovo-rosto': (f'portrait close-up of {VOVO}, {FUNDO}', 1024, 1024),
	'lia-corpo': (f'full body front view of {LIA}, standing, {FUNDO}', 832, 1216),
	'quintal': ('backyard of a grandfather\'s house at golden hour, small shallow stream about one meter wide with smooth stones, '
		'green lawn, fallen log used as a bench, small wooden carpentry workshop in the background, warm cozy atmosphere, no people, '
		'stylized 3D animated family film environment, cinematic lighting, depth of field', 832, 1216),
}
SEMENTES = [7, 21, 42]

MODELO = 'stabilityai/stable-diffusion-xl-base-1.0'

def carregar(gpu):
	# VAE corrigido para fp16 (o original gera imagens pretas em fp16)
	vae = AutoencoderKL.from_pretrained('madebyollin/sdxl-vae-fp16-fix', torch_dtype=torch.float16)
	pipe = StableDiffusionXLPipeline.from_pretrained(MODELO, vae=vae, torch_dtype=torch.float16, variant='fp16', use_safetensors=True).to(f'cuda:{gpu}')
	print(f'[gpu{gpu}] pronto: {torch.cuda.get_device_name(gpu)}', flush=True)
	return pipe

def trabalhador(gpu, pipe, tarefas):
	for nome, semente in tarefas:
		t = time.time()
		prompt, L, A = PEDIDOS[nome]
		img = pipe(prompt=f'{prompt}, {ESTILO}', negative_prompt=NEGATIVO, width=L, height=A, num_inference_steps=40,
			guidance_scale=6.5, generator=torch.Generator(f'cuda:{gpu}').manual_seed(semente)).images[0]
		img.save(f'/kaggle/working/{nome}-{semente}.png')
		print(f'[gpu{gpu}] {nome}-{semente}: {time.time() - t:.0f}s', flush=True)

tarefas = [(n, s) for n in PEDIDOS for s in SEMENTES]
gpus = max(1, torch.cuda.device_count())
pipes = [carregar(g) for g in range(gpus)]
fios = [threading.Thread(target=trabalhador, args=(g, pipes[g], tarefas[g::gpus])) for g in range(gpus)]
for f in fios: f.start()
for f in fios: f.join()
print('fim', flush=True)
