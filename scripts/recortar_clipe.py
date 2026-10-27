# Recorta os personagens da arte dos clipes (docs/arte/clipe.webp, 1774x887) e reconstrói o cenário sem eles (LaMa).
# Saída em recortes/: <nome>.png (SAM guiado por pontos), <nome>-isnet.png (automático) e cenario.jpg.
import numpy as np
import torch
from pathlib import Path
from PIL import Image, ImageFilter
from rembg import new_session, remove
from scipy import ndimage
from simple_lama_inpainting import SimpleLama

arte = Image.open('docs/arte/clipe.webp').convert('RGB')
saida = Path('recortes'); saida.mkdir(exist_ok=True)
sam, isnet = new_session('sam'), new_session('isnet-general-use')
# (nome, caixa x0,y0,x1,y1, pontos dentro (1) e fora (0), em coordenadas da arte)
alvos = [
    ('davi-violao', (0, 140, 890, 800), [((470, 360), 1), ((420, 220), 1), ((150, 570), 1), ((300, 500), 1), ((300, 700), 1), ((700, 560), 1), ((690, 450), 1),
                                          ((60, 250), 0), ((820, 250), 0), ((720, 780), 0), ((40, 790), 0), ((880, 600), 0)]),
    ('menina', (800, 230, 1330, 790), [((1020, 400), 1), ((880, 300), 1), ((1060, 640), 1), ((1270, 380), 1), ((850, 470), 1), ((1230, 700), 1),
                                        ((1150, 250), 0), ((1400, 560), 0), ((900, 770), 0), ((1300, 260), 0)]),
    ('leleco', (1160, 360, 1700, 810), [((1400, 520), 1), ((1300, 430), 1), ((1480, 700), 1), ((1215, 600), 1), ((1625, 700), 1),
                                         ((1700, 450), 0), ((1250, 790), 0), ((1180, 680), 0), ((1680, 800), 0)]),
    ('biblia', (480, 690, 1340, 887), [((700, 760), 1), ((1100, 760), 1), ((920, 850), 1), ((300, 860), 0), ((1500, 860), 0)]),
]
# Qual recorte usar em cada um (conferido a olho): o automático acertou o Davi com violão; o SAM acertou os outros
MELHOR = {'davi-violao': 'isnet', 'menina': 'sam', 'leleco': 'sam', 'biblia': 'sam'}

def limpar(rgba):
    # Só o maior pedaço (tira restos soltos, como notas musicais vizinhas) e bordas semitransparentes
    a = np.array(rgba)
    rotulos, n = ndimage.label(a[:, :, 3] > 40)
    if n > 1:
        maior = 1 + np.argmax(ndimage.sum(np.ones_like(rotulos), rotulos, range(1, n + 1)))
        a[:, :, 3] = np.where(rotulos == maior, a[:, :, 3], 0)
    img = Image.fromarray(a)
    return img.crop(img.getbbox())

final = saida / 'final'; final.mkdir(exist_ok=True)
total = np.zeros((arte.height, arte.width), np.uint8)
for nome, (x0, y0, x1, y1), pontos in alvos:
    corte = arte.crop((x0, y0, x1, y1))
    prompt = [{'type': 'point', 'data': [x - x0, y - y0], 'label': l} for (x, y), l in pontos]
    feitos = {'sam': remove(corte, session=sam, sam_prompt=prompt), 'isnet': remove(corte, session=isnet)}
    for tipo, rgba in feitos.items():
        rgba.save(saida / f'{nome}-{tipo}.png')
    escolhido = feitos[MELHOR[nome]]
    limpar(escolhido).save(final / f'{nome}.png')
    m = np.array(escolhido)[:, :, 3]
    total[y0:y1, x0:x1] = np.maximum(total[y0:y1, x0:x1], m)
    print('ok', nome, flush=True)
# O modelo LaMa foi salvo em GPU: força a carga na CPU (as máquinas do GitHub não têm placa de vídeo)
_carregar = torch.jit.load
torch.jit.load = lambda f, *a, **k: _carregar(f, map_location='cpu')
mascara = Image.fromarray(np.where(total > 20, 255, 0).astype(np.uint8)).filter(ImageFilter.MaxFilter(31))
mascara.save(saida / 'mascara.png')
# LaMa preenche buracos grandes melhor em resolução menor; depois volta ao tamanho original
meio = (arte.width // 2, arte.height // 2)
cenario = SimpleLama(device=torch.device('cpu'))(arte.resize(meio, Image.LANCZOS), mascara.resize(meio, Image.NEAREST))
cenario.resize(arte.size, Image.LANCZOS).save(final / 'cenario.jpg', quality=92)
print('ok cenario', flush=True)
