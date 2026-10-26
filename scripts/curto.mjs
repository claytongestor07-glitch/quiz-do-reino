// Monta a linha do tempo de um Short (1 pergunta: enunciado + cronômetro + revelação) a partir do episódio.
// Reaproveita as falas já geradas: nenhum crédito extra de voz.
// Uso (normalmente chamado pelo render): node scripts/curto.mjs ep001-noe 3
import fs from 'node:fs';
import path from 'node:path';
import {RAIZ, FPS} from './lib.mjs';

export const CRONOMETRO_SHORT = 5; // segundos

export function montarShort(id, n) {
	const tl = JSON.parse(fs.readFileSync(path.join(RAIZ, 'public', 'ep', id, 'timeline.json'), 'utf8'));
	const i = n - 1;
	const escolhidas = tl.cenas.filter((c) => c.i === i && ['pergunta', 'cronometro', 'revelacao'].includes(c.tipo));
	if (escolhidas.length !== 3) throw new Error(`Pergunta ${n} não existe em ${id}`);
	const cenas = [];
	const sons = [];
	let inicio = 0;
	for (const c of escolhidas) {
		const duracao = c.tipo === 'cronometro' ? CRONOMETRO_SHORT * FPS : c.duracao;
		// efeitos da cena original que caem dentro da nova duração
		for (const s of tl.sons) if (s.quadro >= c.inicio && s.quadro < c.inicio + c.duracao && s.quadro - c.inicio < duracao) sons.push({...s, quadro: inicio + s.quadro - c.inicio});
		if (c.tipo === 'cronometro') sons.push({arquivo: 'sons/tempo-esgotado.wav', quadro: inicio + duracao - 2, volume: 0.6});
		cenas.push({...c, inicio, duracao});
		inicio += duracao;
	}
	const short = {...tl, id: `${id}-short${n}`, totalFrames: inicio, tempoResposta: CRONOMETRO_SHORT, cenas, sons, short: n};
	if (short.totalFrames / FPS > 59) throw new Error(`Short ${n} passa de 59 s (${(short.totalFrames / FPS).toFixed(0)} s)`);
	return short;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const s = montarShort(process.argv[2], Number(process.argv[3]));
	console.log(`${s.id}: ${(s.totalFrames / FPS).toFixed(1)} s, ${s.sons.length} efeitos`);
}
