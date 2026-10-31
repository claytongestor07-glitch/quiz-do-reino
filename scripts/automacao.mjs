// Robô da fila: chamado pelo launchd a cada 30 min. Para cada episódio pendente (ordem alfabética):
//   emojis → narração (Kokoro Dora) → render verificado → 1 Short → envio agendado ao YouTube.
// Um só robô por vez (trava em logs/automacao.lock). Episódios com o arquivo IGNORAR ficam de fora.
// Agenda: 2 episódios por dia (09:00 e 17:00) e até 6 Shorts (3 por episódio), horário de Brasília.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {RAIZ, NARRACAO, log} from './lib.mjs';
import {proximoHorario, reservar} from './agenda.mjs';

const TRAVA = path.join(RAIZ, 'logs', 'automacao.lock');
const ALERTA = path.join(RAIZ, 'logs', 'ALERTA.txt');
const SHORTS_POR_EPISODIO = 3;

// Trava: se outro robô está vivo, sai sem fazer nada
fs.mkdirSync(path.dirname(TRAVA), {recursive: true});
if (fs.existsSync(TRAVA)) {
	const pid = Number(fs.readFileSync(TRAVA, 'utf8'));
	try {
		process.kill(pid, 0);
		process.exit(0);
	} catch {}
}
// Render manual em andamento (fora do robô): não disputar a máquina
try {
	// Só processos node de verdade (não shells que apenas citam o nome do script)
	execFileSync('pgrep', ['-f', '^(/usr/local/bin/)?node (/Users/pro/PequenosSabios/)?scripts/render\\.mjs']);
	process.exit(0);
} catch {}
fs.writeFileSync(TRAVA, String(process.pid));
process.on('exit', () => fs.rmSync(TRAVA, {force: true}));

const node = (...a) => execFileSync(process.execPath, a.map(String), {cwd: RAIZ, stdio: 'inherit'});
const ler = (...p) => JSON.parse(fs.readFileSync(path.join(RAIZ, ...p), 'utf8'));
const existe = (...p) => fs.existsSync(path.join(RAIZ, ...p));
const alerta = (msg) => {
	fs.appendFileSync(ALERTA, `${new Date().toISOString()} ${msg}\n`);
	log('automacao', `ALERTA: ${msg}`);
};

// Perguntas dos Shorts: escolha fixa por episódio (sempre as mesmas se o robô rodar de novo), espalhadas pelo quiz
const perguntasDosShorts = (id, n) => {
	const base = parseInt(crypto.createHash('sha1').update(id).digest('hex').slice(0, 6), 16);
	return Array.from({length: SHORTS_POR_EPISODIO}, (_, k) => ((base + Math.floor((k * n) / SHORTS_POR_EPISODIO)) % n) + 1);
};

async function processar(id) {
	const quiz = ler('episodios', id, 'quiz.json');
	if (quiz.tipo === 'emoji' || quiz.tipo === 'abc') node('scripts/emojis.mjs', id);
	node('scripts/validar.mjs', id);

	const tl = existe('public', 'ep', id, 'timeline.json') && ler('public', 'ep', id, 'timeline.json');
	// Narração já pronta (ex.: feita pelo planejar no CI) é reaproveitada se a voz for publicável e o roteiro não mudou
	if (!tl || !ler('config', 'canal.json').vozesPublicaveis.includes(tl.voz) || JSON.stringify(tl.quiz) !== JSON.stringify(quiz)) node('scripts/narrar.mjs', id, ...NARRACAO);

	const rel = existe('saida', id, 'relatorio.json') && ler('saida', id, 'relatorio.json');
	const tlTempo = fs.statSync(path.join(RAIZ, 'public', 'ep', id, 'timeline.json')).mtimeMs;
	const videoOk = rel?.pronto && existe('saida', id, rel.video) && fs.statSync(path.join(RAIZ, 'saida', id, rel.video)).mtimeMs > tlTempo;
	// Já enviado: a versão 16:9 não precisa ser refeita (ex.: renarração por troca de marca só afeta as versões ainda não enviadas)
	if (!videoOk && !existe('episodios', id, 'publicado.json')) {
		try { execFileSync('pkill', ['-f', 'Google Chrome.*--headless']); } catch {}
		node('scripts/render.mjs', id);
	}

	// Versão vertical completa do episódio (regra do senhor: todo vídeo com 5+ min)
	const relV = existe('saida', id, 'relatorio-vertical.json') && ler('saida', id, 'relatorio-vertical.json');
	if (!relV?.pronto) node('scripts/render.mjs', id, '--vertical');

	const shorts = perguntasDosShorts(id, quiz.perguntas.length);
	for (const n of shorts) {
		const relS = existe('saida', id, `relatorio-short${n}.json`) && ler('saida', id, `relatorio-short${n}.json`);
		if (!relS?.pronto) node('scripts/render.mjs', id, `--short=${n}`);
	}

	// --sem-envio: só produz (prévia para o senhor assistir antes de ligar o envio)
	if (process.argv.includes('--sem-envio')) return log('automacao', `${id} produzido; envio desligado nesta rodada`);
	if (!fs.existsSync(path.join(process.env.HOME, '.config', 'pequenos-sabios', 'token.json'))) return alerta('canal não autorizado: rode node scripts/publicar.mjs autorizar');
	// Fase de aprovação: o vídeo fica pronto e espera o senhor assistir (arquivo episodios/<id>/APROVADO libera o envio)
	const canal = ler('config', 'canal.json');
	if (!canal.publicacaoAutomatica && !existe('episodios', id, 'APROVADO')) {
		const marca = path.join(RAIZ, 'episodios', id, '.avisado');
		if (!fs.existsSync(marca)) {
			fs.writeFileSync(marca, new Date().toISOString());
			fs.appendFileSync(path.join(RAIZ, 'logs', 'PARA-APROVAR.txt'), `${new Date().toISOString()} ${id}: saida/${id}/${id}.mp4 + vertical saida/${id}/${id}-vertical.mp4 + Shorts ${shorts.map((n) => `saida/${id}/${id}-short${n}.mp4`).join(', ')}\n`);
			try { execFileSync('osascript', ['-e', `display notification "Episódio ${id} pronto para aprovação" with title "Quiz do Reino"`]); } catch {}
		}
		return log('automacao', `${id} pronto; aguardando aprovação do senhor`);
	}
	for (const [arquivo, tipo, extra] of [['publicado.json', 'episodio', []], ['publicado-vertical.json', 'vertical', ['--vertical']], ...shorts.map((n) => [`publicado-short${n}.json`, 'short', [`--short=${n}`]])]) {
		if (existe('episodios', id, arquivo)) continue;
		// A versão vertical tem aprovação própria (APROVADO-vertical) enquanto o modelo dela não for validado pelo senhor
		if (tipo === 'vertical' && !canal.publicacaoAutomatica && !existe('episodios', id, 'APROVADO-vertical')) continue;
		const quando = proximoHorario(tipo);
		try {
			node('scripts/publicar.mjs', 'enviar', id, `--quando=${quando}`, ...extra);
			reservar(quando, `${id}${extra.length ? extra[0].replace('--short=', '-short').replace('--vertical', '-vertical') : ''}`);
			try { execFileSync('osascript', ['-e', `display notification "${id} ${tipo} agendado para ${new Date(quando).toLocaleString('pt-BR')}" with title "Quiz do Reino"`]); } catch {}
		} catch (e) {
			if (/autorizar|invalid_grant/i.test(String(e.stdout ?? '') + e.message)) alerta('autorização do YouTube venceu: rode node scripts/publicar.mjs autorizar');
			// Limite diário de envios (canal sem verificação por telefone): para por hoje; a nuvem só tenta de novo em 24 h
			if (fs.readFileSync(path.join(RAIZ, 'logs', new Date().toISOString().slice(0, 10) + '.log'), 'utf8').includes('uploadLimitExceeded')) {
				fs.writeFileSync(path.join(RAIZ, 'logs', 'limite-envio.json'), JSON.stringify({quando: new Date().toISOString()}));
				return log('automacao', `${id}: limite diário de envios do YouTube atingido; o restante sobe em 24 h`);
			}
			throw e;
		}
	}
	// Enviado: blocos e áudio intermediário só ocupam disco
	for (const f of fs.readdirSync(path.join(RAIZ, 'saida', id))) if (/^blocos-|-mix\.wav$/.test(f)) fs.rmSync(path.join(RAIZ, 'saida', id, f), {recursive: true, force: true});
}

// Ferramentas obrigatórias: sem elas tudo falharia em cascata; melhor avisar uma vez e parar
for (const [cmd, arg] of [['ffmpeg', '-version'], ['ffprobe', '-version']]) {
	try {
		execFileSync(cmd, [arg], {stdio: 'ignore'});
	} catch {
		alerta(`${cmd} não encontrado no PATH do robô (${process.env.PATH}); ajuste o plist do launchd`);
		process.exit(1);
	}
}

const episodios = fs.readdirSync(path.join(RAIZ, 'episodios')).filter((e) => existe('episodios', e, 'quiz.json') && !existe('episodios', e, 'IGNORAR')).sort()
	// Episódios inéditos primeiro: versões extras de um já publicado (ex.: vertical) não atrasam os novos
	.sort((a, b) => existe('episodios', a, 'publicado.json') - existe('episodios', b, 'publicado.json'));
// --episodio=<id>: só esse (no GitHub Actions cada execução cuida de um episódio já renderizado em paralelo)
const so = process.argv.find((a) => a.startsWith('--episodio='))?.split('=')[1];
let falhas = 0;
for (const id of episodios.filter((e) => !so || e === so)) {
	if (existe('episodios', id, 'publicado.json') && existe('episodios', id, 'publicado-vertical.json') && fs.readdirSync(path.join(RAIZ, 'episodios', id)).filter((f) => /^publicado-short\d+\.json$/.test(f)).length >= SHORTS_POR_EPISODIO) continue;
	try {
		log('automacao', `processando ${id}`);
		await processar(id);
		log('automacao', `${id} concluído`);
	} catch (e) {
		falhas++;
		log('automacao', `${id} falhou; tento de novo na próxima rodada (${String(e.message).split('\n')[0].slice(0, 160)})`);
	}
}
try { node('scripts/publicar.mjs', 'miniaturas'); } catch {}
const pendentes = episodios.filter((e) => !existe('episodios', e, 'publicado.json')).length;
if (pendentes === 0) log('automacao', 'fila vazia: aguardando novos roteiros');
process.exit(falhas ? 1 : 0);
