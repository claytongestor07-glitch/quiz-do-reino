# Recorta os personagens da arte dos clipes (docs/arte/clipe.webp, 1774x887) e reconstrói o cenário sem eles (LaMa).
# Saída em recortes/: <nome>.png (SAM guiado por pontos), <nome>-isnet.png (automático) e cenario.jpg.
import numpy as np
from pathlib import Path
from PIL import Image, ImageFilter
from rembg import new_session, remove
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
total = np.zeros((arte.height, arte.width), np.uint8)
for nome, (x0, y0, x1, y1), pontos in alvos:
    corte = arte.crop((x0, y0, x1, y1))
    prompt = [{'type': 'point', 'data': [x - x0, y - y0], 'label': l} for (x, y), l in pontos]
    rgba = remove(corte, session=sam, sam_prompt=prompt)
    rgba.crop(rgba.getbbox()).save(saida / f'{nome}.png')
    remove(corte, session=isnet).save(saida / f'{nome}-isnet.png')
    m = np.array(rgba)[:, :, 3]
    total[y0:y1, x0:x1] = np.maximum(total[y0:y1, x0:x1], m)
    print('ok', nome, flush=True)
mascara = Image.fromarray(np.where(total > 20, 255, 0).astype(np.uint8)).filter(ImageFilter.MaxFilter(25))
mascara.save(saida / 'mascara.png')
SimpleLama()(arte, mascara).save(saida / 'cenario.jpg', quality=92)
print('ok cenario', flush=True)
