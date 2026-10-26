// Mixa voz + efeitos + trilha (com "ducking" sob a voz) a partir da timeline. Usa o FFmpeg do sistema só para decodificar.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {RAIZ, FPS, log} from './lib.mjs';

const SR = 44100;
const cache = new Map();

function decodificar(rel) {
	if (!cache.has(rel)) {
		const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', path.join(RAIZ, 'public', rel), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], {maxBuffer: 1 << 30});
		cache.set(rel, new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4));
	}
	return cache.get(rel);
}

// Trilhas trocadas depois da narração: episódios já narrados com a trilha antiga saem com a nova, sem renarrar
// nem invalidar o cache dos quadros (a timeline não muda). A nova é ~7 dB mais alta, daí os volumes próprios.
const TROCA = {'sons/trilha-rapida.wav': {arquivo: 'sons/trilha-energia.wav', volume: 0.15, volumeSobVoz: 0.04}};

export function mixar(tl, destino) {
	tl = {...tl, trilha: TROCA[tl.trilha.arquivo] ?? tl.trilha};
	const total = Math.ceil((tl.totalFrames / FPS) * SR);
	const mix = new Float32Array(total);
	const somar = (rel, quadro, vol) => {
		const a = decodificar(rel);
		const ini = Math.round((quadro / FPS) * SR);
		for (let k = 0; k < a.length && ini + k < total; k++) mix[ini + k] += a[k] * vol;
	};

	// Volume da trilha por amostra: abaixa sob a voz, com rampa de 0,25 s para não "pular".
	const alvo = new Float32Array(total).fill(tl.trilha.volume);
	for (const c of tl.cenas.filter((x) => x.audio)) {
		const ini = Math.round(((c.inicio + (c.atrasoAudio ?? 0)) / FPS) * SR);
		const fim = Math.min(total, Math.round(((c.inicio + c.duracao) / FPS) * SR));
		alvo.fill(tl.trilha.volumeSobVoz, Math.max(0, ini - SR * 0.15), fim);
	}
	const trilha = decodificar(tl.trilha.arquivo);
	const passo = 1 / (SR * 0.25);
	let v = tl.trilha.volume;
	for (let k = 0; k < total; k++) {
		v += Math.max(-passo, Math.min(passo, alvo[k] - v));
		mix[k] += trilha[k % trilha.length] * v;
	}

	for (const s of tl.sons) somar(s.arquivo, s.quadro, s.volume);
	for (const c of tl.cenas.filter((x) => x.audio)) somar(c.audio, c.inicio + (c.atrasoAudio ?? 0), 1);

	// Limitador suave: evita estouro onde voz e efeito coincidem.
	const buf = Buffer.alloc(44 + total * 2);
	buf.write('RIFF', 0); buf.writeUInt32LE(36 + total * 2, 4); buf.write('WAVE', 8);
	buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
	buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
	buf.write('data', 36); buf.writeUInt32LE(total * 2, 40);
	for (let k = 0; k < total; k++) buf.writeInt16LE(Math.round(Math.tanh(mix[k] * 1.1) * 0.95 * 32767), 44 + k * 2);
	fs.writeFileSync(destino, buf);
	log('mixar', `${tl.id}: ${(total / SR / 60).toFixed(1)} min de áudio, ${tl.sons.length} efeitos`);
}
