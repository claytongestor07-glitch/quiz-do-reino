// Planejamento da produção no GitHub Actions (.github/workflows/produzir.yml).
// Uso: node scripts/ci.mjs planejar [id]
//   Escolhe o próximo episódio pendente (ou o id pedido), prepara emojis + narração e escreve em $GITHUB_OUTPUT:
//   id      episódio escolhido ('' se a fila está vazia)
//   matriz  {"include": [{"variante": "", "blocos": "0-0"}, ...]}: um job por grupo de blocos de 1500 quadros
// O último job (finalizar) junta os blocos, gera os Shorts e envia, rodando scripts/automacao.mjs --episodio=<id>.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {RAIZ, log} from './lib.mjs';

const BLOCO = 1500; // igual a render.mjs
const POR_JOB = Number(process.env.BLOCOS_POR_JOB) || 1;
const SHORTS_POR_EPISODIO = 3;

const existe = (...p) => fs.existsSync(path.join(RAIZ, ...p));
const node = (...a) => execFileSync(process.execPath, a.map(String), {cwd: RAIZ, stdio: 'inherit'});
const saida = (k, v) => process.env.GITHUB_OUTPUT ? fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`) : console.log(`${k}=${v}`);

const completo = (id) => existe('episodios', id, 'publicado.json') && existe('episodios', id, 'publicado-vertical.json')
	&& fs.readdirSync(path.join(RAIZ, 'episodios', id)).filter((f) => /^publicado-short\d+\.json$/.test(f)).length >= SHORTS_POR_EPISODIO;

// Limite diário de envios do YouTube atingido há menos de 24 h: não adianta produzir agora
const limite = path.join(RAIZ, 'logs', 'limite-envio.json');
if (!process.argv[3] && fs.existsSync(limite) && Date.now() - Date.parse(JSON.parse(fs.readFileSync(limite, 'utf8')).quando) < 24 * 3600e3) {
	log('ci', 'limite diário de envios do YouTube: aguardando 24 h');
	saida('id', '');
	saida('matriz', JSON.stringify({include: [{variante: 'nada', blocos: '0-0'}]}));
	process.exit(0);
}

const pedido = process.argv[3];
const id = pedido || fs.readdirSync(path.join(RAIZ, 'episodios'))
	.filter((e) => existe('episodios', e, 'quiz.json') && !existe('episodios', e, 'IGNORAR') && !completo(e)).sort()
	// Inéditos primeiro (mesma ordem do robô)
	.sort((a, b) => existe('episodios', a, 'publicado.json') - existe('episodios', b, 'publicado.json'))[0];

if (!id) {
	log('ci', 'fila vazia: nenhum episódio pendente');
	saida('id', '');
	saida('matriz', JSON.stringify({include: [{variante: 'nada', blocos: '0-0'}]}));
	process.exit(0);
}

const quiz = JSON.parse(fs.readFileSync(path.join(RAIZ, 'episodios', id, 'quiz.json'), 'utf8'));
if (quiz.tipo === 'emoji' || quiz.tipo === 'abc') node('scripts/emojis.mjs', id);
node('scripts/validar.mjs', id);
node('scripts/narrar.mjs', id, '--kokoro');

const {totalFrames} = JSON.parse(fs.readFileSync(path.join(RAIZ, 'public', 'ep', id, 'timeline.json'), 'utf8'));
const nBlocos = Math.ceil(totalFrames / BLOCO);
const include = [];
for (const [variante, enviado] of [['', 'publicado.json'], ['--vertical', 'publicado-vertical.json']]) {
	if (existe('episodios', id, enviado)) continue;
	for (let a = 0; a < nBlocos; a += POR_JOB) include.push({variante, blocos: `${a}-${Math.min(nBlocos, a + POR_JOB) - 1}`});
}
if (!include.length) include.push({variante: 'nada', blocos: '0-0'}); // só faltam Shorts: o finalizar cuida
log('ci', `${id}: ${totalFrames} quadros, ${include.length} job(s) de render em paralelo`);
saida('id', id);
saida('matriz', JSON.stringify({include}));
