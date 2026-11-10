// Planejamento da produção no GitHub Actions (.github/workflows/produzir.yml).
// Uso: node scripts/ci.mjs planejar [id]
//   Escolhe o próximo episódio pendente (ou o id pedido), prepara emojis + narração e escreve em $GITHUB_OUTPUT:
//   id      episódio escolhido ('' se a fila está vazia)
//   matriz  {"include": [{"variante": "", "blocos": "0-0"}, ...]}: um job por grupo de blocos de 1500 quadros
// O último job (finalizar) junta os blocos, gera os Shorts e envia, rodando scripts/automacao.mjs --episodio=<id>.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {RAIZ, NARRACAO, VERTICAL, SHORTS_POR_EPISODIO, ativo, log} from './lib.mjs';

const BLOCO = 1500; // igual a render.mjs
const POR_JOB = Number(process.env.BLOCOS_POR_JOB) || 1;

const esperar = (s) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, s * 1000);

function vozesNoKaggle(id) {
	const pasta = path.join(RAIZ, 'public', 'ep', id, 'voz');
	const lista = path.join(pasta, 'pendentes-chatterbox.json');
	const usuario = execFileSync('python3', ['-c', "import kaggle; print(kaggle.api.get_config_value('username') or '')"], {encoding: 'utf8'}).trim();
	if (!usuario) throw new Error('Kaggle sem usuário: confira o segredo KAGGLE_API_TOKEN');
	const k = fs.mkdtempSync(path.join(RAIZ, 'kaggle-voz-'));
	const kernel = `${usuario}/quiz-do-reino-voz`;
	fs.writeFileSync(path.join(k, 'voz.py'), `PENDENTES = ${fs.readFileSync(lista, 'utf8')}\n${fs.readFileSync(path.join(RAIZ, 'scripts', 'kaggle', 'chatterbox_narrar.py'), 'utf8')}`);
	fs.writeFileSync(path.join(k, 'kernel-metadata.json'), JSON.stringify({id: kernel, title: 'quiz-do-reino-voz', code_file: 'voz.py', language: 'python', kernel_type: 'script', is_private: true, enable_gpu: true, enable_internet: true, machine_shape: 'NvidiaTeslaT4'}));
	log('ci', `${id}: gerando ${JSON.parse(fs.readFileSync(lista, 'utf8')).length} fala(s) com o Chatterbox no Kaggle`);
	const esperadas = JSON.parse(fs.readFileSync(lista, 'utf8')).map((p) => p.arquivo.replace(/\.mp3$/, '.wav'));
	const saidaK = path.join(k, 'saida');
	const envio = spawnSync('kaggle', ['kernels', 'push', '-p', k], {encoding: 'utf8'});
	process.stdout.write(envio.stdout + envio.stderr);
	if (/quota/i.test(envio.stdout + envio.stderr)) {
		// cota semanal de GPU esgotada: mesma voz no processador do runner (mais lento)
		log('ci', `${id}: sem cota de GPU no Kaggle; gerando a voz no processador`);
		fs.mkdirSync(saidaK, {recursive: true});
		execFileSync('pip', ['install', '-q', 'git+https://github.com/resemble-ai/chatterbox.git'], {stdio: 'inherit'});
		execFileSync('python', [path.join(RAIZ, 'scripts', 'chatterbox_cpu.py'), lista, saidaK], {stdio: 'inherit'});
		return converter(esperadas, saidaK, pasta, lista, k);
	}
	if (envio.status !== 0) throw new Error('kaggle kernels push falhou');
	// Logo após o envio, o status e a saída ainda podem ser da versão anterior do kernel (outro episódio):
	// só segue quando a saída tem todas as falas pedidas agora
	esperar(120);
	for (let i = 0; ; i++) {
		if (i >= 120) throw new Error('Kaggle não devolveu as falas em 60 minutos');
		const s = execFileSync('kaggle', ['kernels', 'status', kernel], {encoding: 'utf8'});
		if (/ERROR|CANCEL/i.test(s)) throw new Error(`Kaggle: ${s.trim()}`);
		if (/COMPLETE/i.test(s)) {
			fs.rmSync(saidaK, {recursive: true, force: true});
			execFileSync('kaggle', ['kernels', 'output', kernel, '-p', saidaK], {stdio: 'ignore'});
			if (esperadas.every((w) => fs.existsSync(path.join(saidaK, w)))) break;
		}
		esperar(30);
	}
	converter(esperadas, saidaK, pasta, lista, k);
}

function converter(esperadas, saidaK, pasta, lista, k) {
	for (const wav of esperadas) {
		execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', path.join(saidaK, wav), '-af', 'loudnorm=I=-16:TP=-1.5', '-ar', '44100', '-b:a', '160k', path.join(pasta, wav.replace(/\.wav$/, '.mp3'))]);
	}
	fs.rmSync(lista);
	fs.rmSync(k, {recursive: true, force: true});
}

const existe = (...p) => fs.existsSync(path.join(RAIZ, ...p));
const node = (...a) => execFileSync(process.execPath, a.map(String), {cwd: RAIZ, stdio: 'inherit'});
const saida = (k, v) => process.env.GITHUB_OUTPUT ? fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`) : console.log(`${k}=${v}`);

const completo = (id) => existe('episodios', id, 'publicado.json') && (!VERTICAL || existe('episodios', id, 'publicado-vertical.json'))
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
	.filter((e) => existe('episodios', e, 'quiz.json') && !existe('episodios', e, 'IGNORAR') && ativo(e) && !completo(e)).sort()
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
// Chatterbox: o narrar sai com código 3 listando as falas que faltam; elas são geradas na GPU do Kaggle e o narrar roda de novo
for (let rodada = 1; ; rodada++) {
	try {
		node('scripts/narrar.mjs', id, ...NARRACAO);
		break;
	} catch (e) {
		if (e.status !== 3 || rodada > 2) throw e;
		vozesNoKaggle(id);
	}
}

const {totalFrames} = JSON.parse(fs.readFileSync(path.join(RAIZ, 'public', 'ep', id, 'timeline.json'), 'utf8'));
const nBlocos = Math.ceil(totalFrames / BLOCO);
const include = [];
for (const [variante, enviado] of [['', 'publicado.json'], ...(VERTICAL ? [['--vertical', 'publicado-vertical.json']] : [])]) {
	if (existe('episodios', id, enviado)) continue;
	for (let a = 0; a < nBlocos; a += POR_JOB) include.push({variante, blocos: `${a}-${Math.min(nBlocos, a + POR_JOB) - 1}`});
}
if (!include.length) include.push({variante: 'nada', blocos: '0-0'}); // só faltam Shorts: o finalizar cuida
log('ci', `${id}: ${totalFrames} quadros, ${include.length} job(s) de render em paralelo`);
saida('id', id);
saida('matriz', JSON.stringify({include}));
