#!/usr/bin/env python3
"""Capa (miniatura 1280x720) com o Kiko: animal misterioso em silhueta com "?", pergunta grande e quantidade.

Uso: python scripts/capa_kiko.py <episodio> [saida.jpg]
Lê de episodios/<id>/quiz.json o campo "capa" (opcional): {"texto", "misterio", "revelado", "faixa", "cor"};
sem ele, usa a chamada, os ícones e a faixa do quiz. Precisa de Pillow.
"""
import json, math, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
FONTES = [str(RAIZ / 'public' / 'fontes' / 'lilita.ttf'), '/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf']
FONTE = next(f for f in FONTES if Path(f).exists())
TINTA = '#24124f'
CORES = ['#2f6fe4', '#7b3fe4', '#17c3a5', '#ff7a1a', '#e8336d', '#1fb35a']
W, H = 1280, 720


def emoji(nome):
    arq = ''.join(ch if ch.isalnum() else '_' for ch in nome.lower())
    while '__' in arq: arq = arq.replace('__', '_')
    return Image.open(RAIZ / 'public' / 'emoji' / f'{arq.strip("_")}.png').convert('RGBA')


def aparar(im):
    return im.crop(im.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox())


def fonte(t): return ImageFont.truetype(FONTE, t)


def raios(cor):
    base = Image.new('RGB', (W, H), cor); d = ImageDraw.Draw(base)
    clara = tuple(min(255, int(int(cor[i:i + 2], 16) * 1.18 + 12)) for i in (1, 3, 5))
    cx, cy = 820, 420
    for k in range(28):
        a1, a2 = k / 28 * 2 * math.pi, (k + 0.5) / 28 * 2 * math.pi
        d.polygon([(cx, cy), (cx + 2000 * math.cos(a1), cy + 2000 * math.sin(a1)), (cx + 2000 * math.cos(a2), cy + 2000 * math.sin(a2))], fill=clara)
    brilho = Image.new('L', (W, H), 0); ImageDraw.Draw(brilho).ellipse((cx - 380, cy - 300, cx + 380, cy + 300), fill=150)
    return Image.composite(Image.new('RGB', (W, H), 'white'), base, brilho.filter(ImageFilter.GaussianBlur(110)))


def redimensionar(im, alt, larg_max):
    im = aparar(im); im = im.resize((int(im.width * alt / im.height), alt), Image.LANCZOS)
    if im.width > larg_max: im = im.resize((larg_max, int(im.height * larg_max / im.width)), Image.LANCZOS)
    return im


def colar(fundo, im, xy):
    s = im.getchannel('A').filter(ImageFilter.GaussianBlur(10)).point(lambda v: int(v * 0.4))
    fundo.paste((20, 20, 60), (xy[0] + 10, xy[1] + 14), s)
    fundo.paste(im, xy, im)


def capa(ep):
    q = json.loads((RAIZ / 'episodios' / ep / 'quiz.json').read_text())
    c = q.get('capa', {})
    icones = q.get('icones') or []
    texto = c.get('texto') or (q.get('chamada') or 'Qual animal é esse?').upper()
    misterio = c.get('misterio') or icones[0]
    revelado = c.get('revelado') if 'revelado' in c else (icones[1] if len(icones) > 1 else None)
    faixa = (c.get('faixa') or q.get('faixa') or f'{len(q["perguntas"])} desafios').upper()
    cor = c.get('cor') or CORES[sum(map(ord, ep)) % len(CORES)]
    img = raios(cor); d = ImageDraw.Draw(img)
    # animal misterioso: silhueta preta com contorno branco e um "?" gigante
    m = redimensionar(emoji(misterio), 420, 500)
    x, y = 820 - m.width // 2, 430 - m.height // 2
    silhueta = m.getchannel('A').point(lambda v: 255 if v > 60 else 0).filter(ImageFilter.MedianFilter(5))
    img.paste((255, 255, 255), (x, y), silhueta.filter(ImageFilter.MaxFilter(17)))
    img.paste((18, 14, 40), (x, y), silhueta)
    d.text((820, 420), '?', font=fonte(290), fill='#ffd43b', stroke_width=16, stroke_fill=TINTA, anchor='mm')
    # um animal colorido de "dica" no canto
    if revelado:
        r = redimensionar(emoji(revelado), 180, 220).rotate(-10, expand=True, resample=Image.BICUBIC)
        colar(img, r, (W - r.width - 30, 400))
    # Kiko apontando o mistério
    colar(img, redimensionar(Image.open(RAIZ / 'public' / 'kiko-capa.png').convert('RGBA'), 560, 520), (10, 175))
    # pergunta no topo
    tam = 92 if len(texto) <= 20 else 76
    d.text((W // 2 + 40, 80), texto, font=fonte(tam), fill='white', stroke_width=12, stroke_fill=TINTA, anchor='mm')
    # quantidade
    f = fonte(50); w = d.textlength(faixa, font=f)
    d.rounded_rectangle((W - w - 110, 626, W - 36, 698), radius=36, fill='#e8336d', outline=TINTA, width=7)
    d.text((W - 73 - w / 2, 662), faixa, font=f, fill='white', anchor='mm')
    return img.convert('RGB')


if __name__ == '__main__':
    ep = sys.argv[1]
    saida = sys.argv[2] if len(sys.argv) > 2 else str(RAIZ / 'episodios' / ep / 'miniatura.jpg')
    capa(ep).save(saida, quality=92)
    print(saida)
