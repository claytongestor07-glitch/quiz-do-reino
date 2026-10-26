// Baixa os emojis 3D (Microsoft Fluent Emoji, licença MIT) usados por um episódio para public/emoji/.
// Uso: node scripts/emojis.mjs ep001-emojis   (só baixa os que faltam; sai com erro se algum nome não existir)
import fs from 'node:fs';
import path from 'node:path';
import {RAIZ, episodio, log} from './lib.mjs';

const BASE = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets';
const DIR = path.join(RAIZ, 'public', 'emoji');
fs.mkdirSync(DIR, {recursive: true});

export const arquivoEmoji = (nome) => `${nome.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.png`;

export async function baixarEmojis(nomes) {
	const faltando = [];
	for (const nome of new Set(nomes)) {
		const destino = path.join(DIR, arquivoEmoji(nome));
		if (fs.existsSync(destino)) continue;
		const base = nome.toLowerCase().replace(/ /g, '_');
		const pasta = encodeURIComponent(nome);
		// Emojis com tom de pele ficam em Default/
		const urls = [`${BASE}/${pasta}/3D/${base}_3d.png`, `${BASE}/${pasta}/Default/3D/${base}_3d_default.png`];
		let ok = false;
		for (const url of urls) {
			const r = await fetch(url);
			if (r.ok) {
				fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
				ok = true;
				break;
			}
		}
		if (!ok) faltando.push(nome);
		else log('emojis', `baixado ${nome}`);
	}
	return faltando;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const {quiz} = episodio(process.argv[2]);
	const faltando = await baixarEmojis([...(quiz.icones ?? []), ...quiz.perguntas.flatMap((p) => p.pistas ?? [])]);
	if (faltando.length) {
		log('emojis', `ERRO: não encontrados no Fluent Emoji: ${faltando.join(', ')}`);
		process.exit(1);
	}
	log('emojis', 'todos os emojis disponíveis');
}
