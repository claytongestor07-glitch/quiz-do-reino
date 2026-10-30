# Gera as cenas dos clipes com modelos premium do fal.ai (Kling, Seedance...), a partir dos recortes da arte do canal.
# Uso: FAL_KEY=... python scripts/fal_cenas.py <pasta de saída> [cena,cena,...]   (sem lista = todas de src/cenas.json)
# Histórias: CENAS=musicas/mu004-moises/cenas.json python scripts/fal_cenas.py public/cenas   (recorta de 'arteOriginal' da cena;
# se existir docs/arte/<história>/<cena>.png, um quadro 16:9 em alta, ele é usado no lugar do recorte)
# FAL_MODELO escolhe o modelo (padrão Kling 2.5 Turbo Pro, imagem → vídeo); FAL_DURACAO = "5" ou "10" segundos.
# Fila do fal: POST queue.fal.run/<modelo> → consulta status_url até COMPLETED → baixa response_url → video.url
import base64, json, os, sys, time
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen
from PIL import Image

MODELO = os.environ.get('FAL_MODELO') or 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video'
DURACAO = os.environ.get('FAL_DURACAO') or '5'
CHAVE = os.environ['FAL_KEY']
ESTILO = (' Keep the exact characters and art style of the image. 3D Pixar style children music video, lively natural motion, '
	'expressive faces, hair and fur moving, gentle camera move, warm cinematic light, vibrant colors, premium animated film quality.')
NEGATIVO = 'deformed face, extra limbs, extra fingers, morphing, melting, flicker, blurry, distorted, text, watermark, static image'

saida = Path(sys.argv[1]); saida.mkdir(parents=True, exist_ok=True)
cenas = json.loads(Path(os.environ.get('CENAS') or 'src/cenas.json').read_text())['cenas']
escolhidas = [c for c in (sys.argv[2].split(',') if len(sys.argv) > 2 and sys.argv[2] else cenas) if c in cenas]
artes = {}
def arte_de(c):
	f = c.get('arteOriginal', 'docs/arte/clipe.webp')
	if f not in artes: artes[f] = Image.open(f).convert('RGB')
	return artes[f]

def pedir(url, corpo=None):
	req = Request(url, data=json.dumps(corpo).encode() if corpo is not None else None,
		headers={'Authorization': f'Key {CHAVE}', 'Content-Type': 'application/json'})
	with urlopen(req, timeout=120) as r: return json.loads(r.read())

def gerar(nome):
	hd = Path('docs/arte') / nome.split('-')[0] / f'{nome}.png'
	if hd.exists():
		img = Image.open(hd).convert('RGB')
		alt = img.width * 9 // 16
		img = img.crop((0, (img.height - alt) // 2, img.width, (img.height - alt) // 2 + alt)).resize((1280, 720), Image.LANCZOS)
	else:
		arte = arte_de(cenas[nome]); k = arte.width / 1200
		x, y, w = cenas[nome]['recorte']
		img = arte.crop((int(x * k), int(y * k), int((x + w) * k), int((y + w * 9 / 16) * k))).resize((1280, 720), Image.LANCZOS)
	buf = BytesIO(); img.save(buf, 'JPEG', quality=93)
	t = time.time()
	fila = pedir(f'https://queue.fal.run/{MODELO}', {
		'prompt': cenas[nome]['prompt'] + '.' + ESTILO, 'negative_prompt': NEGATIVO,
		'image_url': 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode(),
		'duration': DURACAO, 'aspect_ratio': '16:9'})
	while (s := pedir(fila['status_url'])['status']) != 'COMPLETED':
		if s not in ('IN_QUEUE', 'IN_PROGRESS'): raise RuntimeError(f'{nome}: {s}')
		time.sleep(10)
	video = pedir(fila['response_url'])['video']['url']
	(saida / f'{nome}.mp4').write_bytes(urlopen(video, timeout=300).read())
	print(f'{nome}: {time.time() - t:.0f}s', flush=True)

with ThreadPoolExecutor(4) as ex:
	list(ex.map(gerar, escolhidas))
