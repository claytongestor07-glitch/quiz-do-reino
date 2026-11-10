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
	# 4º lote (ep017)
	'mandrill': 'a mandrill monkey with colorful blue and red face',
	'gibbon': 'a gibbon ape with long arms',
	'proboscis_monkey': 'a proboscis monkey with a big nose',
	'baboon': 'a baboon',
	'warthog': 'a warthog with tusks',
	'wildebeest': 'a wildebeest',
	'hermit_crab': 'a hermit crab inside a seashell',
	'mantis_shrimp': 'a colorful mantis shrimp',
	'moray_eel': 'a green moray eel',
	'electric_eel': 'an electric eel with tiny sparks',
	'piranha': 'a red bellied piranha fish with teeth',
	'catfish': 'a catfish with long whiskers',
	'goldfish': 'an orange goldfish',
	'betta_fish': 'a blue betta fish with flowing fins',
	'opossum': 'an opossum',
	'spider_monkey': 'a spider monkey hanging by its tail',
	'hornbill': 'a hornbill bird with a big casque on its beak',
	'secretary_bird': 'a secretary bird with long legs and feather crest',
	'shoebill': 'a shoebill stork with a huge shoe shaped beak',
	'roadrunner': 'a roadrunner bird running',
	'moth': 'a fluffy moth',
	'slug': 'a yellow slug',
	'centipede': 'a centipede with many legs',
	'dingo': 'a dingo wild dog',
	'aye_aye': 'an aye-aye lemur with big eyes and long finger',
	'fossa': 'a fossa from madagascar',
	'binturong': 'a binturong bearcat',
	'slow_loris': 'a slow loris with huge round eyes',
	'sun_bear': 'a sun bear with a yellow chest patch',
	'wolverine': 'a wolverine animal',
	# 3º lote (ep016)
	'dragonfly': 'a dragonfly with shiny wings',
	'firefly': 'a firefly with a glowing tail',
	'grasshopper': 'a green grasshopper',
	'stick_insect': 'a stick insect that looks like a twig',
	'caterpillar': 'a green caterpillar',
	'reindeer': 'a reindeer with antlers',
	'yak': 'a hairy yak',
	'gazelle': 'a gazelle',
	'cassowary': 'a cassowary bird with blue head and helmet',
	'quokka': 'a smiling quokka',
	'anglerfish': 'a deep sea anglerfish with a glowing lure',
	'sea_urchin': 'a purple sea urchin with spines',
	'nautilus': 'a nautilus with a striped spiral shell',
	'salamander': 'a yellow and black fire salamander',
	'ocelot': 'an ocelot wild cat with spots',
	'caracal': 'a caracal wild cat with long black ear tufts',
	'aardvark': 'an aardvark with long ears and snout',
	'mongoose': 'a mongoose',
	'serval': 'a serval wild cat with big ears',
	'ibex': 'an ibex mountain goat with long curved horns',
	'flying_squirrel': 'a flying squirrel gliding',
	'ferret': 'a ferret',
	'echidna': 'an echidna with spines and long snout',
	'kookaburra': 'a kookaburra bird',
	'cockatoo': 'a white cockatoo with yellow crest',
	'heron': 'a grey heron',
	'stork': 'a white stork with red beak',
	'albatross': 'an albatross with long wings',
	'kingfisher': 'a colorful kingfisher bird',
	'lionfish': 'a striped lionfish with long fins',
	# 2º lote (ep015)
	'tapir': 'a south american tapir with a short trunk',
	'marmoset': 'a small marmoset monkey with white ear tufts',
	'howler_monkey': 'a red howler monkey',
	'hummingbird': 'a colorful hummingbird flying',
	'woodpecker': 'a woodpecker with a red head',
	'pelican': 'a white pelican with a big bill pouch',
	'ostrich': 'an ostrich',
	'puffin': 'a puffin with an orange beak',
	'vulture': 'a black vulture bird',
	'chameleon': 'a green chameleon with a curled tail',
	'iguana': 'a green iguana',
	'komodo_dragon': 'a komodo dragon lizard',
	'manatee': 'a gentle grey manatee',
	'narwhal': 'a narwhal with a long spiral tusk',
	'manta_ray': 'a manta ray swimming',
	'orca': 'an orca killer whale, black and white',
	'beluga': 'a white beluga whale',
	'swordfish': 'a swordfish',
	'okapi': 'an okapi with striped legs',
	'cheetah': 'a cheetah',
	'lynx': 'a lynx with ear tufts',
	'snow_leopard': 'a snow leopard with thick tail',
	'tasmanian_devil': 'a tasmanian devil',
	'wombat': 'a wombat',
	'kiwi_bird': 'a brown kiwi bird with a long beak',
	'tarsier': 'a tarsier with huge round eyes',
	'mole': 'a mole with big digging paws',
	'chinchilla': 'a grey chinchilla',
	'guinea_pig': 'a guinea pig',
	'praying_mantis': 'a green praying mantis',
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
