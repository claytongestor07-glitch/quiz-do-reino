// Pipeline completo de um episódio, retomável: cada etapa pula o que já está pronto.
//   validar → narrar (ElevenLabs, com cache) → render + miniatura → 3 Shorts → publicar (se aprovado)
// Uso: node scripts/produzir.mjs ep002-daniel [--sem-shorts] [--publicar]
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {RAIZ, log} from './lib.mjs';

const id = process.argv[2];
const flags = new Set(process.argv.slice(3));
const node = (...a) => execFileSync(process.execPath, a.map(String), {cwd: RAIZ, stdio: 'inherit'});
const existe = (...p) => fs.existsSync(path.join(RAIZ, ...p));

try {
	node('scripts/validar.mjs', id);
	node('scripts/narrar.mjs', id); // falas já geradas vêm do cache
	const rel = existe('saida', id, 'relatorio.json') && JSON.parse(fs.readFileSync(path.join(RAIZ, 'saida', id, 'relatorio.json'), 'utf8'));
	const timeline = fs.statSync(path.join(RAIZ, 'public', 'ep', id, 'timeline.json')).mtimeMs;
	const video = rel && existe('saida', id, rel.video) && fs.statSync(path.join(RAIZ, 'saida', id, rel.video)).mtimeMs;
	if (!rel?.pronto || !video || video < timeline) node('scripts/render.mjs', id);
	else log('produzir', `${id}: vídeo já renderizado e aprovado; pulando render`);

	if (!flags.has('--sem-shorts')) {
		const n = JSON.parse(fs.readFileSync(path.join(RAIZ, 'episodios', id, 'quiz.json'), 'utf8')).perguntas.length;
		for (const q of [1, Math.ceil(n / 2), n - 1]) if (!existe('saida', id, `${id}-short${q}.mp4`)) node('scripts/render.mjs', id, `--short=${q}`);
	}
	if (flags.has('--publicar')) node('scripts/publicar.mjs', 'enviar', id);
	log('produzir', `${id}: concluído`);
} catch (e) {
	log('produzir', `${id}: parou com erro; rode o mesmo comando de novo para retomar (${e.message.split('\n')[0]})`);
	process.exit(1);
}
