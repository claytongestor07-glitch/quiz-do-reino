# Lê o segredo KAGGLE_API_TOKEN (chave nova KGAT_… ou o conteúdo do kaggle.json) e imprime as variáveis
# de ambiente que a CLI do Kaggle entende (com 'mascarar': os comandos ::add-mask::). Só o formato vai para o log (stderr); os valores são mascarados.
import json, os, sys

t = os.environ.get('KAGGLE_API_TOKEN', '').strip()
saida = {}
if t.startswith('{'):
	d = json.loads(t)
	saida = {'KAGGLE_USERNAME': d['username'], 'KAGGLE_KEY': d['key'], 'KAGGLE_API_TOKEN': ''}
	print('chave: kaggle.json', file=sys.stderr)
else:
	saida = {'KAGGLE_API_TOKEN': ''.join(t.split())}
	print('chave:', 'nova (KGAT_)' if t.startswith('KGAT_') else f'formato desconhecido ({len(t)} caracteres, começa com {t[:1]!r})', file=sys.stderr)
for k, v in saida.items():
	if 'mascarar' in sys.argv:  # comando do GitHub Actions: esconde o valor em todos os logs
		if v and k != 'KAGGLE_USERNAME': print(f'::add-mask::{v}')
	else: print(f'{k}={v}')
