# Recorta os personagens da arte do canal (docs/arte/canal.webp) com remoção de fundo (rembg, modelos locais).
# Gera em recortes/: <nome>-sam.png (SAM guiado por pontos) e <nome>-isnet.png (automático) para escolher o melhor.
import json, subprocess, sys
from pathlib import Path
from PIL import Image

arte = Image.open('docs/arte/canal.webp').convert('RGB')
saida = Path('recortes'); saida.mkdir(exist_ok=True)
# (nome, caixa x0,y0,x1,y1 na arte 1672x941, pontos dentro (1) e fora (0) do personagem, em coordenadas da arte)
alvos = [
    ('davi-lulu', (0, 250, 660, 860), [((300, 450), 1), ((90, 410), 1), ((230, 640), 1), ((500, 600), 1), ((420, 560), 1),
                                        ((320, 790), 0), ((60, 650), 0), ((500, 320), 0), ((330, 270), 0)]),
    ('leleco', (1180, 380, 1645, 860), [((1390, 560), 1), ((1300, 470), 1), ((1330, 700), 1), ((1520, 520), 1),
                                         ((1610, 700), 0), ((1500, 800), 0), ((1350, 810), 0), ((1260, 400), 0)]),
]
for nome, (x0, y0, x1, y1), pontos in alvos:
    corte = saida / f'{nome}-corte.png'
    arte.crop((x0, y0, x1, y1)).resize(((x1 - x0) * 2, (y1 - y0) * 2), Image.LANCZOS).save(corte)
    prompt = [{'type': 'point', 'data': [(x - x0) * 2, (y - y0) * 2], 'label': l} for (x, y), l in pontos]
    subprocess.run(['rembg', 'i', '-m', 'sam', '-x', json.dumps({'sam_prompt': prompt}), str(corte), str(saida / f'{nome}-sam.png')], check=True)
    subprocess.run(['rembg', 'i', '-m', 'isnet-general-use', str(corte), str(saida / f'{nome}-isnet.png')], check=True)
    print('ok', nome, file=sys.stderr)
