# Roda na GPU gratuita do Kaggle (enviado por .github/workflows/cenas.yml com motor=cenas14b.py).
# Versão de qualidade máxima grátis: Wan 2.2 I2V A14B (o modelo grande, dois especialistas de 14B) quantizado em GGUF Q4_K_M
# para caber na T4, com o LoRA Lightning (4 passos em vez de 40). Mesma tabela de cenas (src/cenas.json) e mesma saída
# do cenas.py: /kaggle/working/<cena>.mp4 (832x480, 16 fps do modelo reamostrado a 24 fps).
import json, os, subprocess, sys, time
from urllib.request import urlopen

os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'expandable_segments:True'
RAW = 'https://raw.githubusercontent.com/claytongestor07-glitch/quiz-do-reino/main/'
ARTE = RAW + 'docs/arte/clipe.webp'
L, A, QUADROS = 832, 480, 81

CENAS = {n: (tuple(c['recorte']), c['prompt']) for n, c in json.load(urlopen(RAW + 'src/cenas.json'))['cenas'].items()}
# Energia: o LoRA de 4 passos acalma o movimento; o pedido insiste em dança e o especialista de ruído alto (que decide o
# movimento) roda com LoRA mais fraco e guia de texto (CFG) — custa ~50% mais tempo por cena
ENERGIA = ' The characters dance energetically to the music: big joyful arm movements, bouncing, swaying, jumping, clapping, head bobbing.'
ESTILO = (ENERGIA + ' Keep the exact characters and art style of the image. 3D Pixar style children music video, lively natural motion, '
	'expressive faces, hair and fur moving, gentle camera move, warm cinematic light, vibrant colors, high quality.')
NEGATIVO = ('worst quality, low quality, blurry, distorted, deformed face, extra fingers, extra limbs, morphing, flicker, '
	'text, watermark, subtitles, static image, still picture')

subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '-U', 'diffusers>=0.35', 'transformers', 'accelerate', 'peft',
	'gguf', 'ftfy', 'imageio-ffmpeg'], check=True)
# o torchao antigo do Kaggle faz o peft recusar o LoRA ("only versions above 0.16.0"); não usamos torchao
subprocess.run([sys.executable, '-m', 'pip', 'uninstall', '-q', '-y', 'torchao'])

from io import BytesIO
import torch
from PIL import Image
from diffusers import AutoencoderKLWan, GGUFQuantizationConfig, WanImageToVideoPipeline, WanTransformer3DModel
from diffusers.utils import export_to_video
from huggingface_hub import hf_hub_download

MODELO = 'Wan-AI/Wan2.2-I2V-A14B-Diffusers'
GGUF = 'QuantStack/Wan2.2-I2V-A14B-GGUF'
RAPIDO = 'lightx2v/Wan2.2-Lightning'
PASTA_RAPIDO = 'Wan2.2-I2V-A14B-4steps-lora-rank64-Seko-V1'
arte = Image.open(BytesIO(urlopen(ARTE).read())).convert('RGB')
k = arte.width / 1200
escolhidas = [c for c in os.environ.get('CENAS', ','.join(CENAS)).split(',') if c in CENAS]

# 1. Textos na CPU (bf16) e o codificador sai da memória antes de carregar os 14B
texto = WanImageToVideoPipeline.from_pretrained(MODELO, transformer=None, transformer_2=None, vae=None, torch_dtype=torch.bfloat16)
embeds = {}
with torch.no_grad():
	for nome in escolhidas:
		p, n = texto.encode_prompt(CENAS[nome][1] + '.' + ESTILO, NEGATIVO, device='cpu')
		embeds[nome] = (p.to(torch.float16), n.to(torch.float16))
del texto
print('textos prontos', flush=True)

# 2. Os dois especialistas (ruído alto / baixo) em GGUF, VAE em fp32, LoRA Lightning em cada um.
#    Cada especialista fica numa T4 (o Kaggle dá duas); ganchos do accelerate levam as entradas para a placa certa e
#    devolvem a saída onde estava (a descarga automática para a CPU deixava tensores na CPU e quebrava)
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
print(f'pronto: {torch.cuda.device_count()}x {torch.cuda.get_device_name(0)}', flush=True)

for nome in escolhidas:
	t = time.time()
	(x, y, w), _ = CENAS[nome]
	img = arte.crop((int(x * k), int(y * k), int((x + w) * k), int((y + w * 9 / 16) * k))).resize((L, A), Image.LANCZOS)
	p, n = embeds[nome]
	frames = pipe(image=img, prompt_embeds=p.to('cuda:0'), negative_prompt_embeds=n.to('cuda:0'), height=A, width=L, num_frames=QUADROS,
		num_inference_steps=4, guidance_scale=2.5, guidance_scale_2=1.0,
		generator=torch.Generator('cuda:0').manual_seed(11)).frames[0]
	bruto = f'/kaggle/working/{nome}-16.mp4'
	export_to_video(frames, bruto, fps=16)
	# 16 fps nativos → 24 fps com interpolação de movimento (fica fluido no clipe)
	ff = __import__('imageio_ffmpeg').get_ffmpeg_exe()
	subprocess.run([ff, '-v', 'error', '-y', '-i', bruto, '-vf', "minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:vsbmc=1",
		'-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', f'/kaggle/working/{nome}.mp4'], check=True)
	os.remove(bruto)
	print(f'{nome}: {time.time() - t:.0f}s', flush=True)
