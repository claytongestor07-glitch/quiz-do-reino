# Roda na GPU gratuita do Kaggle (enviado por .github/workflows/kenji-referencias.yml com script=animais_3d).
# Ilustrações 3D de animais que não existem na Fluent Emoji (ou que o canal ainda não usou), no mesmo estilo de ícone 3D,
# para o quiz "Qual animal é esse?". SDXL 1.0 (OpenRAIL++, uso comercial permitido). O fundo branco é recortado depois.
# Lista em ANIMAIS (nome do arquivo: pedido em inglês). Saída: /kaggle/working/<nome>-<semente>.png
import os, subprocess, sys, threading, time

subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '-U', 'diffusers>=0.30', 'transformers', 'accelerate'], check=True)
import torch
from diffusers import AutoencoderKL, StableDiffusionXLPipeline

ESTILO = ('cute 3D emoji icon style, glossy clay render, soft studio lighting, vibrant colors, full body, centered, '
	'single animal, plain pure white background, high quality')
NEGATIVO = 'pattern, wallpaper, collage, repeated, many copies, text, watermark, logo, multiple animals, scenery, ground, shadow on wall, frame, border, human, scary, realistic photo, blurry'
ANIMAIS = {
	'capybara': 'a capybara', 'giant_anteater': 'a giant anteater with long snout and bushy tail', 'toucan': 'one toucan bird with black body, white chest and a big orange beak, perched',
	'hyacinth_macaw': 'a blue hyacinth macaw parrot', 'jaguar': 'a jaguar big cat with golden yellow fur and black rosette spots', 'golden_lion_tamarin': 'a small golden lion tamarin monkey, bright orange fur, tiny dark face, long tail, young and cute',
	'amazon_river_dolphin': 'a pink amazon river dolphin', 'maned_wolf': 'a maned wolf with long legs and red fur', 'armadillo': 'an armadillo',
	'coati': 'a coati with long snout and striped tail', 'platypus': 'a brown furry platypus with a flat duck bill and beaver tail', 'meerkat': 'a meerkat standing upright',
	'axolotl': 'a pink axolotl', 'pangolin': 'one brown pangolin standing on four legs, body covered in overlapping scales, long tail', 'ring_tailed_lemur': 'a ring-tailed lemur',
	'moose': 'a moose with big antlers', 'wild_boar': 'a wild boar', 'badger': 'a european badger with grey body and black and white striped face', 'goose': 'a white goose',
	'squid': 'one pink squid with long tentacles and big eyes', 'shrimp': 'a pink shrimp', 'water_buffalo': 'a water buffalo', 'seahorse': 'a seahorse',
	'starfish': 'one single big orange starfish with five arms and a cute face', 'rhea': 'a rhea bird', 'porcupine': 'a porcupine with quills', 'walrus': 'a walrus with tusks',
	'hyena': 'a spotted hyena', 'red_panda': 'one red panda with reddish fur, white face markings and a bushy striped tail', 'clownfish': 'an orange and white clownfish',
}
SEMENTES = [int(x) for x in os.environ.get('SEMENTES', '4,44').split(',')]
NOMES = [n for n in os.environ.get('ANIMAIS', ','.join(ANIMAIS)).split(',') if n in ANIMAIS]

def carregar(gpu):
	vae = AutoencoderKL.from_pretrained('madebyollin/sdxl-vae-fp16-fix', torch_dtype=torch.float16)
	pipe = StableDiffusionXLPipeline.from_pretrained('stabilityai/stable-diffusion-xl-base-1.0', vae=vae, torch_dtype=torch.float16, variant='fp16', use_safetensors=True).to(f'cuda:{gpu}')
	print(f'[gpu{gpu}] pronto', flush=True)
	return pipe

def trabalhador(gpu, pipe, tarefas):
	for nome, s in tarefas:
		t = time.time()
		img = pipe(prompt=f'{ANIMAIS[nome]}, {ESTILO}', negative_prompt=NEGATIVO, width=1024, height=1024, num_inference_steps=35,
			guidance_scale=7.0, generator=torch.Generator(f'cuda:{gpu}').manual_seed(s)).images[0]
		img.save(f'/kaggle/working/animal-{nome}-{s}.png')
		print(f'[gpu{gpu}] {nome}-{s}: {time.time() - t:.0f}s', flush=True)

tarefas = [(n, s) for n in NOMES for s in SEMENTES]
gpus = max(1, torch.cuda.device_count())
pipes = [carregar(g) for g in range(gpus)]
fios = [threading.Thread(target=trabalhador, args=(g, pipes[g], tarefas[g::gpus])) for g in range(gpus)]
for f in fios: f.start()
for f in fios: f.join()
print('fim', flush=True)
