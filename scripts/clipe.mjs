// Clipe musical: música cantada (musicas/<id>/musica.wav, gerada por scripts/cantar.py) + Davi, Lulu e Leleco dançando no ritmo (src/Clipe.tsx).
// Uso: node scripts/clipe.mjs mu001-davi [--vertical | --short] [--dados]   (--dados: só gera public/clipe/<id>/clipe.json)
// --short: vertical só com o primeiro refrão (até 55 s), para Shorts
// A dança segue a "batida" medida na própria música (energia dos graves por quadro), não um BPM fixo.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {renderFrames, renderStill, selectComposition} from '@remotion/renderer';
import {RAIZ, FPS, duracaoAudio, log} from './lib.mjs';
import {baixarEmojis} from './emojis.mjs';

const id = process.argv[2];
const short = process.argv.includes('--short');
const vertical = short || process.argv.includes('--vertical');
const dir = path.join(RAIZ, 'musicas', id);
const musica = JSON.parse(fs.readFileSync(path.join(dir, 'musica.json'), 'utf8'));
const audio = ['musica.wav', 'musica.mp3'].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f)) ?? path.join(dir, 'musica.wav');
if (!fs.existsSync(audio)) throw new Error(`Falta a música: ${audio}`);

// Batida: energia dos graves (até 150 Hz) por quadro, só a subida (ataque do bumbo), normalizada para 0–1
function batida(arq, quadros) {
	const TAXA = 3000;
	const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', arq, '-af', 'lowpass=f=150,lowpass=f=150', '-ac', '1', '-ar', String(TAXA), '-f', 's16le', '-'], {maxBuffer: 1 << 28});
	const amostras = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length >> 1);
	const porQuadro = TAXA / FPS;
	const rms = Array.from({length: quadros}, (_, f) => {
		let s = 0;
		const a = Math.floor(f * porQuadro);
		for (let i = a; i < a + porQuadro && i < amostras.length; i++) s += amostras[i] ** 2;
		return Math.sqrt(s / porQuadro);
	});
	const ataque = rms.map((v, f) => Math.max(0, v - (rms[f - 1] ?? v) * 0.9 - (rms[f - 2] ?? v) * 0.1));
	const ref = [...ataque].sort((x, y) => x - y)[Math.floor(quadros * 0.97)] || 1;
	return ataque.map((v) => Math.round(Math.min(1, v / ref) * 100) / 100);
}

const dur = duracaoAudio(audio);
const totalFrames = Math.ceil(dur * FPS);
// Partes distribuídas pelo número de versos (a intro e o final ficam curtos)
const pesos = musica.partes.map((p) => Math.max(1, p.letra.length));
const soma = pesos.reduce((s, v) => s + v, 0);
let t = 0;
const partes = musica.partes.map((p, k) => {
	const de = p.de ?? t;
	t = de + (dur * pesos[k]) / soma;
	return {de: Math.round(de * 100) / 100, tipo: p.tipo, emojis: p.emojis, frase: p.frase};
});
const faltando = await baixarEmojis(partes.flatMap((p) => p.emojis));
if (faltando.length) throw new Error(`Emojis inexistentes no Fluent: ${faltando.join(', ')}`);
const clipe = {id, titulo: musica.titulo, totalFrames, batida: batida(audio, totalFrames), partes};
const pub = path.join(RAIZ, 'public', 'clipe', id);
fs.mkdirSync(pub, {recursive: true});
fs.writeFileSync(path.join(pub, 'clipe.json'), JSON.stringify(clipe));
log('clipe', `${id}: ${dur.toFixed(1)} s, ${partes.length} partes`);
if (process.argv.includes('--dados')) process.exit(0);

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browserExecutable = fs.existsSync(CHROME) ? CHROME : null;
const inputProps = {id, clipe};
const serveUrl = await bundle({entryPoint: path.join(RAIZ, 'src', 'index.ts'), publicDir: path.join(RAIZ, 'public')});
const comp = await selectComposition({serveUrl, id: vertical ? 'ClipeVertical' : 'Clipe', inputProps, browserExecutable});
const refrao = partes.find((p) => p.tipo === 'refrao');
const [ini, fim] = short ? [Math.max(0, Math.round(((refrao?.de ?? 0) - 1.5) * FPS)), Math.min(totalFrames - 1, Math.round(((refrao?.de ?? 0) + 53.5) * FPS))] : [0, totalFrames - 1];
const quadros = fs.mkdtempSync(path.join(os.tmpdir(), `clipe-${id}-`));
const inicio = Date.now();
let feitos = 0;
await renderFrames({
	serveUrl, composition: comp, inputProps, browserExecutable, outputDir: null, frameRange: [ini, fim], imageFormat: 'jpeg', jpegQuality: 90,
	concurrency: Number(process.env.RENDER_CONCORRENCIA) || 2, timeoutInMilliseconds: 300000, onStart: () => {},
	onFrameUpdate: (n) => { if (n - feitos >= 300) { feitos = n; log('clipe', `${n}/${fim - ini + 1} quadros`); } },
	onFrameBuffer: (buf, q) => fs.writeFileSync(path.join(quadros, `${String(q).padStart(6, '0')}.jpg`), buf),
});
const saida = path.join(RAIZ, 'saida', 'clipes');
fs.mkdirSync(saida, {recursive: true});
const video = path.join(saida, `${id}${short ? '-short' : vertical ? '-vertical' : ''}.mp4`);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-start_number', String(ini), '-i', `${quadros}/%06d.jpg`, '-ss', String(ini / FPS), '-i', audio,
	'-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-af', `afade=t=in:d=0.3,afade=t=out:st=${Math.max(0, (fim - ini) / FPS - 1.2)}:d=1.2`, '-shortest', '-movflags', '+faststart', video]);
fs.rmSync(quadros, {recursive: true, force: true});
if (!vertical) {
	const mini = await selectComposition({serveUrl, id: 'MiniaturaClipe', inputProps, browserExecutable});
	await renderStill({serveUrl, composition: mini, inputProps, browserExecutable, output: path.join(saida, `${id}.jpg`), imageFormat: 'jpeg', jpegQuality: 88, scale: 2 / 3});
}
log('clipe', `pronto: ${video} em ${Math.round((Date.now() - inicio) / 60000)} min`);
