// Utilitários comuns: caminhos, carregamento de episódio e log em logs/AAAA-MM-DD.log (JSON por linha).
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FPS = 30;

export function log(etapa, msg, extra = {}) {
	const dir = path.join(RAIZ, 'logs');
	fs.mkdirSync(dir, {recursive: true});
	const linha = {quando: new Date().toISOString(), etapa, msg, ...extra};
	fs.appendFileSync(path.join(dir, `${linha.quando.slice(0, 10)}.log`), JSON.stringify(linha) + '\n');
	console.log(`[${etapa}] ${msg}`);
}

export function episodio(id) {
	if (!id) throw new Error('Informe o episódio: ex. ep001-noe');
	const dir = path.join(RAIZ, 'episodios', id);
	const quiz = JSON.parse(fs.readFileSync(path.join(dir, 'quiz.json'), 'utf8'));
	return {id, dir, quiz};
}

export function duracaoAudio(arq) {
	const s = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arq]).toString().trim();
	const d = Number(s);
	if (!Number.isFinite(d) || d <= 0) throw new Error(`Duração inválida em ${arq}`);
	return d;
}

export const LETRAS = ['A', 'B', 'C'];
