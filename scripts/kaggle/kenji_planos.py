# Roda na GPU gratuita do Kaggle (enviado por .github/workflows/kenji-referencias.yml com script=kenji_planos).
# Peças do piloto do Kenji Studio em 2.5D: cenários sem pessoas (guiados pela referência do quintal) e poses dos
# personagens em fundo liso (guiadas pela referência de cada um), para recortar e montar em camadas.
# SDXL 1.0 + IP-Adapter Plus. Saída: /kaggle/working/<fundo|pose>-<nome>-<semente>.png
import os, subprocess, sys, threading, time
from io import BytesIO
from urllib.request import urlopen

subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '-U', 'diffusers>=0.30', 'transformers', 'accelerate'], check=True)
import torch
from PIL import Image
from diffusers import AutoencoderKL, StableDiffusionXLPipeline
from transformers import CLIPVisionModelWithProjection

RAW = 'https://raw.githubusercontent.com/claytongestor07-glitch/quiz-do-reino/main/kenji/'
ESTILO = ('3D CGI animated feature film still, stylized 3D, subsurface scattering, soft global illumination, warm golden hour light '
	'from the left, cinematic, highly detailed')
NEGATIVO = ('extra fingers, deformed hands, distorted face, different outfit, photo, realistic photograph, anime, 2D, sketch, '
	'text, watermark, cropped, dark, scary')
LISO = 'plain light grey studio background, full body, same character, same outfit, clean anatomy, five fingers per hand'

PERS = {
	'kenji': '9-year-old boy with East Asian features, black hair combed up and back, shiny royal blue jacket with round gold badge, cream high-collar top, beige trousers, white sneakers',
	'vovo-hiro': '72-year-old grandfather with East Asian features, round black glasses, white moustache, olive green cardigan, grey trousers, brown shoes',
	'lia': '9-year-old Black girl, voluminous curly hair with red and white striped headband, red glasses, yellow polo shirt, denim overalls, red sneakers',
}
# nome: (referência, pedido, escala do IP-Adapter). Escala menor deixa a pose seguir o texto.
PECAS = {
	'fundo-geral': ('quintal', 'wide view of the backyard with a small shallow stream with smooth stones, fallen log bench beside the stream, wooden cabin in the background, no people', 0.5),
	'fundo-agua': ('quintal', 'very low camera at water level, close-up of a small shallow stream with smooth stones and green grass banks, blurred backyard behind, no people', 0.4),
	'fundo-ceu': ('quintal', 'low angle view of a glowing golden sunset sky with soft pink clouds above tree tops, no people', 0.3),
	'fundo-ponte-palitos': ('quintal', 'close-up at water level of a small blue toy car on a fragile bridge made of wooden popsicle sticks spanning a tiny stream, no people', 0.35),
	'fundo-ponte-triangulos': ('quintal', 'close-up at water level of a small blue toy car on a sturdy bridge made of popsicle sticks glued in triangles spanning a tiny stream, a flat stone supporting the middle, no people', 0.35),
	'fundo-maos': (None, 'macro close-up of children\'s hands gluing wooden popsicle sticks into triangles on the grass, golden hour', 0),
	'pose-kenji-ajoelhado': ('kenji', f'{PERS["kenji"]}, kneeling on the ground holding a small wet blue toy car with both hands, sad expression, looking down, {LISO}', 0.45),
	'pose-kenji-frustrado': ('kenji', f'{PERS["kenji"]}, standing, frustrated frown, arms crossed, {LISO}', 0.45),
	'pose-kenji-sentado': ('kenji', f'{PERS["kenji"]}, sitting on the ground hugging his knees, curious expression, three-quarter view, {LISO}', 0.45),
	'pose-kenji-olhando-ceu': ('kenji', f'{PERS["kenji"]}, standing, looking up at the sky with a hopeful smile, three-quarter view, {LISO}', 0.45),
	'pose-kenji-decidido': ('kenji', f'{PERS["kenji"]}, standing holding a wooden popsicle stick in one hand, determined smile, {LISO}', 0.45),
	'pose-kenji-vibrando': ('kenji', f'{PERS["kenji"]}, jumping with both arms raised, very happy cheering, {LISO}', 0.45),
	'pose-vovo-sentado': ('vovo-hiro', f'{PERS["vovo-hiro"]}, sitting holding a cup of tea, warm smile, three-quarter view, {LISO}', 0.45),
	'pose-vovo-apontando': ('vovo-hiro', f'{PERS["vovo-hiro"]}, standing pointing up at the sky with one hand, gentle smile, three-quarter view, {LISO}', 0.45),
	'pose-vovo-pedra': ('vovo-hiro', f'{PERS["vovo-hiro"]}, bending down holding a flat stone with both hands, {LISO}', 0.45),
	'pose-lia-caderno': ('lia', f'{PERS["lia"]}, standing holding an open sketchbook showing drawings of triangles, explaining with a smile, {LISO}', 0.45),
	'pose-lia-vibrando': ('lia', f'{PERS["lia"]}, jumping with both arms raised, very happy cheering, {LISO}', 0.45),
}
SEMENTES = [9, 99]
REFS = {r: Image.open(BytesIO(urlopen(RAW + r + '.jpg').read())).convert('RGB') for r in ('kenji', 'vovo-hiro', 'lia', 'quintal')}
BRANCO = Image.new('RGB', (224, 224), 'white')

def carregar(gpu):
	enc = CLIPVisionModelWithProjection.from_pretrained('h94/IP-Adapter', subfolder='models/image_encoder', torch_dtype=torch.float16)
	vae = AutoencoderKL.from_pretrained('madebyollin/sdxl-vae-fp16-fix', torch_dtype=torch.float16)
	pipe = StableDiffusionXLPipeline.from_pretrained('stabilityai/stable-diffusion-xl-base-1.0', vae=vae, image_encoder=enc,
		torch_dtype=torch.float16, variant='fp16', use_safetensors=True)
	pipe.load_ip_adapter('h94/IP-Adapter', subfolder='sdxl_models', weight_name='ip-adapter-plus_sdxl_vit-h.safetensors')
	pipe.to(f'cuda:{gpu}')
	print(f'[gpu{gpu}] pronto', flush=True)
	return pipe

def trabalhador(gpu, pipe, tarefas):
	for nome, s in tarefas:
		t = time.time()
		ref, pedido, escala = PECAS[nome]
		pipe.set_ip_adapter_scale(escala)
		# fundos em 9:16 (cenário do Short); poses em retrato para recorte
		L, A = (768, 1344) if nome.startswith('fundo') else (832, 1216)
		img = pipe(prompt=f'{pedido}, {ESTILO}', negative_prompt=NEGATIVO, ip_adapter_image=REFS[ref] if ref else BRANCO,
			width=L, height=A, num_inference_steps=40, guidance_scale=6.0, generator=torch.Generator(f'cuda:{gpu}').manual_seed(s)).images[0]
		img.save(f'/kaggle/working/{nome}-{s}.png')
		print(f'[gpu{gpu}] {nome}-{s}: {time.time() - t:.0f}s', flush=True)

tarefas = [(n, s) for n in PECAS for s in SEMENTES]
gpus = max(1, torch.cuda.device_count())
pipes = [carregar(g) for g in range(gpus)]
fios = [threading.Thread(target=trabalhador, args=(g, pipes[g], tarefas[g::gpus])) for g in range(gpus)]
for f in fios: f.start()
for f in fios: f.join()
print('fim', flush=True)
