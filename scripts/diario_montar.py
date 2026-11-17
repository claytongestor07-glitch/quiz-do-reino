#!/usr/bin/env python3
"""Monta o episódio do dia a partir das imagens geradas no Kaggle (produção diária, .github/workflows/diario.yml).

Uso: python scripts/diario_montar.py <pasta dos recortes> <notas.json> <episodio>
Para cada animal escolhe a melhor imagem entre as sementes: um bicho só (sem "padrão" de vários), bem recortado e com a
maior nota do CLIP para o pedido. Grava public/emoji/ia_<id>.png e episodios/<episodio>/quiz.json com nome, curiosidade e
lugar do catálogo (config/catalogo-animais.json). Sai com código 2 se sobrarem menos de 20 animais aprovados.
"""
import json, random, sys
from collections import deque
from pathlib import Path
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
MINIMO, MAXIMO = 20, 26
TITULOS = ['Incríveis', 'Curiosos', 'Surpreendentes', 'do Mundo Todo', 'Diferentões', 'Raros', 'Fascinantes']


def componentes(im):
    """(fração da maior parte, cobertura, caixa da maior parte em pixels da imagem)"""
    a = im.getchannel('A').resize((256, 256)).load()
    vis = [[False] * 256 for _ in range(256)]
    partes, total = [], 0
    for x in range(256):
        for y in range(256):
            if a[x, y] > 24 and not vis[x][y]:
                fila, vis[x][y], n, x0, y0, x1, y1 = deque([(x, y)]), True, 0, x, y, x, y
                while fila:
                    cx, cy = fila.popleft(); n += 1
                    x0, y0, x1, y1 = min(x0, cx), min(y0, cy), max(x1, cx), max(y1, cy)
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if 0 <= nx < 256 and 0 <= ny < 256 and not vis[nx][ny] and a[nx, ny] > 24:
                            vis[nx][ny] = True; fila.append((nx, ny))
                partes.append((n, x0, y0, x1, y1)); total += n
    if not partes: return 0, 0, None
    n, x0, y0, x1, y1 = max(partes)
    k = im.width / 256
    return n / total, total / 65536, (int(x0 * k), int(y0 * k), int((x1 + 1) * k), int((y1 + 1) * k))


def main():
    recortes, notas, ep = Path(sys.argv[1]), json.loads(Path(sys.argv[2]).read_text()), sys.argv[3]
    catalogo = {a['id']: a for a in json.loads((RAIZ / 'config' / 'catalogo-animais.json').read_text())}
    aprovados = []
    pedidos = {p.stem.removeprefix('animal-').rsplit('-', 1)[0] for p in recortes.glob('animal-*.png')}
    for aid, animal in catalogo.items():
        if aid not in pedidos: continue
        melhores = []
        for arq in recortes.glob(f'animal-{aid}-*.png'):
            nota = notas.get(arq.stem.removeprefix('animal-'))
            if not nota or nota['alvo'] < 0.6 or nota['padrao'] > 0.25 or nota['pessoa'] > 0.25 or nota['texto'] > 0.25:
                continue
            im = Image.open(arq).convert('RGBA')
            fracao, cobertura, caixa = componentes(im)
            if fracao < 0.9 or not 0.03 < cobertura < 0.75:
                continue
            melhores.append((nota['similaridade'], arq, caixa, im))
        if not melhores:
            print(f'descartado: {aid}', flush=True)
            continue
        _, arq, caixa, im = max(melhores, key=lambda m: m[0])
        im = im.crop(caixa); im.thumbnail((512, 512))
        tela = Image.new('RGBA', (512, 512), (0, 0, 0, 0)); tela.paste(im, ((512 - im.width) // 2, (512 - im.height) // 2), im)
        tela.save(RAIZ / 'public' / 'emoji' / f'ia_{aid}.png')
        largura, altura = im.size
        aprovados.append({'animal': animal, 'proporcao': largura / altura})
        print(f'aprovado: {aid} ({arq.name})', flush=True)
        if len(aprovados) >= MAXIMO: break
    if len(aprovados) < MINIMO:
        print(f'só {len(aprovados)} animais aprovados (mínimo {MINIMO}); episódio não montado', flush=True)
        sys.exit(2)
    numero = int(ep[2:5])
    random.Random(numero).shuffle(aprovados)
    # capa: o mistério é um animal de silhueta larga (corpo inteiro), a dica é outro bem colorido
    misterio = next((a for a in aprovados if 0.8 < a['proporcao'] < 1.8), aprovados[0])['animal']
    revelado = next(a['animal'] for a in aprovados if a['animal'] is not misterio)
    n = len(aprovados)
    quiz = {
        'id': ep, 'tipo': 'emoji', 'categoria': 'animais', 'canal': 'Quiz do Reino', 'marca': 'Reino Animal', 'selo': '🐾',
        'craque': 'Craque dos Animais', 'tema': 'Animais', 'fonte': 'Curiosidades de animais (texto infantil próprio)',
        'pergunta': 'Qual animal é esse?', 'unico': True,
        'titulo': f'🐾 Qual Animal é Esse? {n} Animais {TITULOS[numero % len(TITULOS)]}! | Quiz de Animais para Crianças',
        'chamada': 'QUAL ANIMAL É ESSE?', 'faixa': f'{n} Animais',
        'icones': [f"IA {misterio['id']}", f"IA {revelado['id']}"],
        'capa': {'texto': 'QUAL ANIMAL É ESSE?', 'misterio': f"IA {misterio['id']}", 'revelado': f"IA {revelado['id']}", 'faixa': f'{n} animais'},
        'licao': 'Cada animal tem um jeito especial de viver, e todos são importantes para a natureza!',
        'abertura': f'Oi, criançada! Hoje tem {n} animais novinhos! Olhe bem e descubra: qual animal é esse? Vamos lá!',
        'encerramento': 'Que craque! Quantos animais você acertou? Conte para a família e até o próximo quiz!',
        'perguntas': [{'pistas': [f"IA {a['animal']['id']}"], 'resposta': a['animal']['nome'], 'explicacao': a['animal']['curiosidade'],
                       'referencia': a['animal']['onde']} for a in aprovados],
    }
    pasta = RAIZ / 'episodios' / ep
    pasta.mkdir(parents=True, exist_ok=True)
    (pasta / 'quiz.json').write_text(json.dumps(quiz, ensure_ascii=False, indent=1))
    print(f'{ep}: {n} animais', flush=True)


if __name__ == '__main__':
    main()
