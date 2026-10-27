# Converte os vídeos de dança do Kaggle (fundo verde) em loops transparentes para os clipes.
# Uso: python scripts/dancas_alpha.py <pasta com .mp4>  → public/personagens/clipe/dancas/<nome>.webm
# Remove o fundo quadro a quadro (rembg isnet) e emenda ida + volta para o loop não "pular".
import subprocess, sys, tempfile
from pathlib import Path
from PIL import Image
from rembg import new_session, remove

entrada = Path(sys.argv[1])
destino = Path('public/personagens/clipe/dancas')
destino.mkdir(parents=True, exist_ok=True)
sessao = new_session('isnet-general-use')

for mp4 in sorted(entrada.glob('*.mp4')):
	with tempfile.TemporaryDirectory() as tmp:
		tmp = Path(tmp)
		subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-i', mp4, tmp / 'q%04d.png'], check=True)
		quadros = sorted(tmp.glob('q*.png'))
		for q in quadros:
			remove(Image.open(q), session=sessao).save(q)
		# ida e volta: quadros 1..N e N-1..2
		for i, q in enumerate(quadros[-2:0:-1]):
			(tmp / f'q{len(quadros) + i + 1:04d}.png').write_bytes(q.read_bytes())
		saida = destino / f'{mp4.stem}.webm'
		subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-y', '-framerate', '24', '-i', tmp / 'q%04d.png',
			'-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '32', '-auto-alt-ref', '0', saida], check=True)
		print(saida, flush=True)
