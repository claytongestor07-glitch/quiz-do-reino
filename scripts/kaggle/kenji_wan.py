# Roda na GPU gratuita do Kaggle (enviado por .github/workflows/kenji-referencias.yml com script=kenji_wan).
# Kenji Studio — planos animados em 16:9 com o motor do WanGP (Wan 2.2 I2V A14B, GGUF Q4 + LoRA Lightning de 4 passos).
# 1) Quadro-chave de cada plano: SDXL + IP-Adapter Plus guiado pela referência aprovada do personagem (personagem já
#    dentro do cenário, nada de recorte em camadas). 2) Wan 2.2 anima o quadro-chave (832x480, 81 quadros, 24 fps).
# Narração, legendas e trilha entram depois, na montagem. Saída: /kaggle/working/<plano>-chave.png e <plano>.mp4
import gc, os, subprocess, sys, time
from io import BytesIO
from urllib.request import urlopen

os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'expandable_segments:True'
subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '-U', 'diffusers>=0.35', 'transformers', 'accelerate', 'peft',
	'gguf', 'ftfy', 'imageio-ffmpeg'], check=True)
subprocess.run([sys.executable, '-m', 'pip', 'uninstall', '-q', '-y', 'torchao'])

import torch
from PIL import Image

RAW = 'https://raw.githubusercontent.com/claytongestor07-glitch/quiz-do-reino/main/kenji/'
L, A, QUADROS = 832, 480, 81
SAIDA = '/kaggle/working'

PERS = {
	'kenji': '9-year-old boy with East Asian features, black hair combed up and back, shiny royal blue zip jacket with round gold badge, cream high-collar top, beige trousers, white sneakers',
	'vovo-hiro': '72-year-old grandfather with East Asian features, round black glasses, white moustache, olive green cardigan over light green shirt, grey trousers, brown shoes',
	'lia': '9-year-old Black girl, voluminous curly hair with red and white striped headband, red glasses, yellow polo shirt, denim overalls, red sneakers',
}
CENARIO = 'peaceful backyard with a small shallow stream with smooth stones, green grass, wooden cabin and pine trees in the background, warm golden hour sunlight'
ESTILO = ('3D CGI animated feature film still, stylized 3D family movie, subsurface scattering, soft global illumination, '
	'cinematic composition, shallow depth of field, highly detailed, wide 16:9 frame')
NEG_IMG = ('extra fingers, deformed hands, distorted face, different outfit, photo, realistic photograph, anime, 2D, sketch, '
	'text, watermark, cropped head, dark, scary, two heads, duplicate person')
MOV = (' Keep the exact character design, outfit and 3D animated film style of the image. Smooth natural motion, expressive face, '
	'hair and grass moving in a light breeze, warm cinematic light, high quality.')
NEG_MOV = ('worst quality, low quality, blurry, distorted, deformed face, extra fingers, extra limbs, morphing, flicker, '
	'text, watermark, subtitles, static image, still picture, outfit change')

# plano: (referência, escala do IP-Adapter, quadro-chave, movimento)
PLANOS = {
	'p02-kenji-triste': ('kenji', 0.5,
		f'{PERS["kenji"]}, kneeling on the grass at the edge of the stream, holding a small wet blue toy car with both hands, sad expression looking down, medium shot, {CENARIO}',
		'The boy slowly lifts the wet blue toy car, water drips from it, he sighs sadly and lowers his head. Slow camera push-in.'),
	'p05-vovo-cha': ('vovo-hiro', 0.5,
		f'{PERS["vovo-hiro"]}, sitting on a fallen log beside the stream holding a cup of tea, warm kind smile, medium close-up, {CENARIO}',
		'The grandfather speaks gently with a warm smile and nods slowly, steam rises from the tea cup. Slow camera push-in.'),
	'p07-kenji-decidido': ('kenji', 0.5,
		f'{PERS["kenji"]}, sitting on the grass by the stream holding a wooden popsicle stick, determined hopeful smile, medium shot, {CENARIO}',
		'The boy looks at the popsicle stick in his hand, then lifts his head with a determined smile and nods. Gentle camera arc.'),
	'p10-por-do-sol': ('quintal', 0.4,
		'wide establishing shot of the backyard at sunset, small stream reflecting the golden sky, wooden cabin with warm lit windows, pine trees, no people',
		'Gentle crane shot rising slowly over the backyard at sunset, water sparkling, leaves moving softly in the wind.'),
}
# CHAVES=ep001: os quadros-chave já vêm prontos (feitos no Codex) de kenji/<CHAVES>/<plano>.jpg, com o movimento em
# kenji/<CHAVES>/planos.json; o SDXL não roda. Sem CHAVES, gera os quadros-chave de teste abaixo com SDXL.
PASTA = os.environ.get('CHAVES', '')
if PASTA:
	import json
	MOVS = json.load(urlopen(f'{RAW}{PASTA}/planos.json'))['planos']
	PLANOS = {p: (None, 0, None, m) for p, m in MOVS.items()}
escolhidos = [p for p in os.environ.get('PLANOS', ','.join(PLANOS)).split(',') if p in PLANOS]
chaves = {}
if PASTA:
	for p in escolhidos:
		chaves[p] = Image.open(BytesIO(urlopen(f'{RAW}{PASTA}/{p}.jpg').read())).convert('RGB').resize((L, A), Image.LANCZOS)
	print(f'{len(chaves)} quadros-chave prontos de {PASTA}', flush=True)
else:
	REFS = {r: Image.open(BytesIO(urlopen(RAW + r + '.jpg').read())).convert('RGB') for r in {PLANOS[p][0] for p in escolhidos}}

# 1. Quadros-chave de teste (SDXL + IP-Adapter) — 1344x768 e recorte para 832x480
if not PASTA:
	from diffusers import AutoencoderKL, StableDiffusionXLPipeline
	from transformers import CLIPVisionModelWithProjection
	enc = CLIPVisionModelWithProjection.from_pretrained('h94/IP-Adapter', subfolder='models/image_encoder', torch_dtype=torch.float16)
	vae_xl = AutoencoderKL.from_pretrained('madebyollin/sdxl-vae-fp16-fix', torch_dtype=torch.float16)
	xl = StableDiffusionXLPipeline.from_pretrained('stabilityai/stable-diffusion-xl-base-1.0', vae=vae_xl, image_encoder=enc,
		torch_dtype=torch.float16, variant='fp16', use_safetensors=True)
	xl.load_ip_adapter('h94/IP-Adapter', subfolder='sdxl_models', weight_name='ip-adapter-plus_sdxl_vit-h.safetensors')
	xl.to('cuda:0')
	for p in escolhidos:
		t = time.time()
		ref, escala, quadro, _ = PLANOS[p]
		xl.set_ip_adapter_scale(escala)
		img = xl(prompt=f'{quadro}, {ESTILO}', negative_prompt=NEG_IMG, ip_adapter_image=REFS[ref], width=1344, height=768,
			num_inference_steps=40, guidance_scale=6.0, generator=torch.Generator('cuda:0').manual_seed(9)).images[0]
		img = img.resize((840, 480), Image.LANCZOS).crop((4, 0, 4 + L, A))
		img.save(f'{SAIDA}/{p}-chave.png')
		chaves[p] = img
		print(f'chave {p}: {time.time() - t:.0f}s', flush=True)
	del xl, enc, vae_xl
	gc.collect(); torch.cuda.empty_cache()

# 2. Animação com Wan 2.2 I2V A14B (mesma montagem do cenas14b.py do Quiz do Reino)
from diffusers import AutoencoderKLWan, GGUFQuantizationConfig, WanImageToVideoPipeline, WanTransformer3DModel
from diffusers.utils import export_to_video
from huggingface_hub import hf_hub_download
MODELO = 'Wan-AI/Wan2.2-I2V-A14B-Diffusers'
GGUF = 'QuantStack/Wan2.2-I2V-A14B-GGUF'
RAPIDO = 'lightx2v/Wan2.2-Lightning'
PASTA_RAPIDO = 'Wan2.2-I2V-A14B-4steps-lora-rank64-Seko-V1'

texto = WanImageToVideoPipeline.from_pretrained(MODELO, transformer=None, transformer_2=None, vae=None, torch_dtype=torch.bfloat16)
embeds = {}
with torch.no_grad():
	for p in escolhidos:
		e, n = texto.encode_prompt(PLANOS[p][3] + MOV, NEG_MOV, device='cpu')
		embeds[p] = (e.to(torch.float16), n.to(torch.float16))
del texto
gc.collect()
print('textos prontos', flush=True)

def especialista(nivel, sub):
	arq = hf_hub_download(GGUF, f'{nivel}/Wan2.2-I2V-A14B-{nivel}-Q4_K_M.gguf')
	return WanTransformer3DModel.from_single_file(arq, quantization_config=GGUFQuantizationConfig(compute_dtype=torch.float16),
		config=MODELO, subfolder=sub, torch_dtype=torch.float16)

vae = AutoencoderKLWan.from_pretrained(MODELO, subfolder='vae', torch_dtype=torch.float32)
pipe = WanImageToVideoPipeline.from_pretrained(MODELO, transformer=especialista('HighNoise', 'transformer'),
	transformer_2=especialista('LowNoise', 'transformer_2'), vae=vae, text_encoder=None, tokenizer=None, torch_dtype=torch.float16)
pipe.load_lora_weights(RAPIDO, weight_name=f'{PASTA_RAPIDO}/high_noise_model.safetensors', adapter_name='rapido')
pipe.load_lora_weights(RAPIDO, weight_name=f'{PASTA_RAPIDO}/low_noise_model.safetensors', adapter_name='rapido_2', load_into_transformer_2=True)
pipe.set_adapters(['rapido', 'rapido_2'], adapter_weights=[0.75, 1.0])
from accelerate.hooks import AlignDevicesHook, add_hook_to_module
segunda = 'cuda:1' if torch.cuda.device_count() > 1 else 'cuda:0'
for modulo, dev in ((pipe.transformer, 'cuda:0'), (pipe.transformer_2, segunda), (pipe.vae, 'cuda:0')):
	modulo.to(dev)
	add_hook_to_module(modulo, AlignDevicesHook(execution_device=dev, io_same_device=True))
if hasattr(pipe.vae, 'enable_tiling'): pipe.vae.enable_tiling()
print(f'wan pronto: {torch.cuda.device_count()}x {torch.cuda.get_device_name(0)}', flush=True)

ff = __import__('imageio_ffmpeg').get_ffmpeg_exe()
for p in escolhidos:
	t = time.time()
	e, n = embeds[p]
	frames = pipe(image=chaves[p], prompt_embeds=e.to('cuda:0'), negative_prompt_embeds=n.to('cuda:0'), height=A, width=L,
		num_frames=QUADROS, num_inference_steps=4, guidance_scale=2.5, guidance_scale_2=1.0,
		generator=torch.Generator('cuda:0').manual_seed(11)).frames[0]
	bruto = f'{SAIDA}/{p}-16.mp4'
	export_to_video(frames, bruto, fps=16)
	subprocess.run([ff, '-v', 'error', '-y', '-i', bruto, '-vf', 'minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:vsbmc=1',
		'-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', f'{SAIDA}/{p}.mp4'], check=True)
	os.remove(bruto)
	print(f'{p}: {time.time() - t:.0f}s', flush=True)
print('fim', flush=True)
