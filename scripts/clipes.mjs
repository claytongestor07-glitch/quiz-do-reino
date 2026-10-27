// Produção dos clipes musicais no GitHub Actions (.github/workflows/clipes.yml).
//   node scripts/clipes.mjs proximo [id]   escreve id=<próxima música pendente> em $GITHUB_OUTPUT ('' = nada a fazer)
//   node scripts/clipes.mjs enviar <id>     agenda no YouTube o que falta: clipe 16:9, versão celular e Short do refrão
// Respeita o limite diário de envios do YouTube (logs/limite-envio.json, mesmo arquivo dos quizzes).
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {RAIZ, log} from './lib.mjs';
import {proximoHorario, reservar} from './agenda.mjs';

const MUSICAS = path.join(RAIZ, 'musicas');
const VARIANTES = [['', 'clipe'], ['vertical', 'clipeVertical'], ['short', 'short']];
const existe = (...p) => fs.existsSync(path.join(MUSICAS, ...p));
const completa = (id) => VARIANTES.every(([v]) => existe(id, `publicado${v ? `-${v}` : ''}.json`));
const LIMITE = path.join(RAIZ, 'logs', 'limite-envio.json');
const saida = (k, v) => (process.env.GITHUB_OUTPUT ? fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`) : console.log(`${k}=${v}`));

const [acao, pedido] = process.argv.slice(2);
if (acao === 'proximo') {
	if (!pedido && fs.existsSync(LIMITE) && Date.now() - Date.parse(JSON.parse(fs.readFileSync(LIMITE, 'utf8')).quando) < 24 * 3600e3) {
		log('clipes', 'limite diário de envios do YouTube: aguardando 24 h');
		saida('id', '');
	} else {
		const id = pedido || fs.readdirSync(MUSICAS).filter((m) => existe(m, 'musica.json') && !existe(m, 'IGNORAR') && !completa(m)).sort()[0] || '';
		log('clipes', id ? `próxima música: ${id}` : 'nenhuma música pendente');
		saida('id', id);
	}
} else if (acao === 'enviar') {
	const id = pedido;
	for (const [v, tipo] of VARIANTES) {
		if (existe(id, `publicado${v ? `-${v}` : ''}.json`)) continue;
		const quando = proximoHorario(tipo);
		try {
			execFileSync(process.execPath, ['scripts/publicar.mjs', 'clipe', id, `--quando=${quando}`, ...(v ? [`--${v}`] : [])], {cwd: RAIZ, stdio: 'inherit'});
			reservar(quando, `${id}${v ? `-${v}` : ''}`);
		} catch (e) {
			const hoje = path.join(RAIZ, 'logs', `${new Date().toISOString().slice(0, 10)}.log`);
			if (fs.existsSync(hoje) && fs.readFileSync(hoje, 'utf8').includes('uploadLimitExceeded')) {
				fs.writeFileSync(LIMITE, JSON.stringify({quando: new Date().toISOString()}));
				log('clipes', `${id}: limite diário de envios do YouTube atingido; o restante sobe em 24 h`);
				break;
			}
			throw e;
		}
	}
} else {
	console.error('Uso: node scripts/clipes.mjs proximo [id] | enviar <id>');
	process.exit(1);
}
