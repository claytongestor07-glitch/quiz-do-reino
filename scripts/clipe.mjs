// Clipe musical: música cantada (musicas/<id>/musica.wav, gerada por scripts/cantar.py) + cenas animadas cortadas na batida e letra em karaokê (src/Clipe.tsx).
// Uso: node scripts/clipe.mjs mu001-davi [--vertical | --short] [--dados]   (--dados: só gera public/clipe/<id>/clipe.json)
// --short: vertical só com o primeiro refrão (até 55 s), para Shorts; --trecho=20-50: só esse intervalo (prévia)
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
const ritmo = batida(audio, totalFrames);
const r2 = (v) => Math.round(v * 100) / 100;
const desenho = process.argv.includes('--desenho');

// Andamento: o intervalo entre bumbos que mais se repete (80–180 bpm) e a fase que mais acerta os bumbos
function andamento(r) {
	const nota = (L, t0) => { let s = 0; for (let t = t0; t < r.length; t += L) s += r[Math.round(t)] ?? 0; return s; };
	let melhor = {bpm: 120, inicio: 0, nota: -1};
	for (let bpm = 80; bpm <= 180; bpm += 0.5) {
		const L = (FPS * 60) / bpm;
		for (let t0 = 0; t0 < L; t0 += 0.5) {
			const n = nota(L, t0) / (r.length / L);
			if (n > melhor.nota) melhor = {bpm, inicio: t0 / FPS, nota: n};
		}
	}
	return melhor;
}

// Letra no tempo: palavras.json (scripts/alinhar.py, Whisper) quando existe; senão distribui pelo número de versos
const arqPalavras = path.join(dir, 'palavras.json');
let linhas;
if (fs.existsSync(arqPalavras)) {
	linhas = JSON.parse(fs.readFileSync(arqPalavras, 'utf8')).map((l) => ({parte: l.parte, palavras: l.palavras}));
} else {
	const pesos = musica.partes.map((p) => Math.max(1, p.letra.length));
	const soma = pesos.reduce((s, v) => s + v, 0);
	let t = 0;
	linhas = musica.partes.flatMap((p, k) => {
		const de = t, cada = (dur * pesos[k]) / soma / p.letra.length;
		t += (dur * pesos[k]) / soma;
		return p.letra.map((l, i) => {
			const ws = l.split(' '), ini = de + i * cada;
			return {parte: k, palavras: ws.map((w, j) => ({p: w, de: r2(ini + (j * cada * 0.85) / ws.length), ate: r2(ini + ((j + 1) * cada * 0.85) / ws.length)}))};
		});
	});
}
linhas = linhas.map((l) => ({...l, de: l.palavras[0].de, ate: l.palavras.at(-1).ate}));
// Cada parte começa um pouco antes da primeira palavra cantada nela
const partes = musica.partes.map((p, k) => {
	const primeira = linhas.find((l) => l.parte === k);
	return {de: k === 0 ? 0 : r2(Math.max(0, (primeira?.de ?? 0) - 0.6)), tipo: p.tipo, emojis: p.emojis, frase: p.frase};
});
for (let k = 1; k < partes.length; k++) partes[k].de = Math.max(partes[k].de, partes[k - 1].de + 1);

// Tomadas: a cada ~3 s troca de cena, cortando no bumbo mais forte por perto; cenas escolhidas pelo tipo da parte.
// História (musicas/<id>/cenas.json existe): cenas próprias da história, e cada parte passa pelas suas cenas na ordem do roteiro
const historia = fs.existsSync(path.join(dir, 'cenas.json'));
const {cenas: CENAS} = JSON.parse(fs.readFileSync(historia ? path.join(dir, 'cenas.json') : path.join(RAIZ, 'src', 'cenas.json'), 'utf8'));
const comVideo = (n) => fs.existsSync(path.join(RAIZ, 'public', 'cenas', `${n}.mp4`));
const tomadas = [];
let semente = [...id].reduce((s, c) => s + c.charCodeAt(0), 0);
partes.forEach((p, k) => {
	const fim = partes[k + 1]?.de ?? dur;
	const tipo = p.tipo === 'ponte' ? 'ponte' : p.tipo;
	const pool = historia ? [] : Object.keys(CENAS).filter((n) => CENAS[n].partes.includes(tipo));
	const fixas = tipo === 'intro' ? ['castelo', 'geral'] : tipo === 'final' ? ['geral-festa', 'castelo'] : tipo === 'refrao' ? ['geral-festa'] : [];
	let t = p.de, i = 0;
	while (t < fim - 0.8) {
		let corte = Math.min(fim, t + 3);
		if (fim - corte < 1.6) corte = fim;
		else {
			// bumbo mais forte a até 0,4 s do corte ideal
			const a = Math.round((corte - 0.4) * FPS), b = Math.round((corte + 0.4) * FPS);
			let melhor = Math.round(corte * FPS);
			for (let f = a; f <= b; f++) if ((ritmo[f] ?? 0) > (ritmo[melhor] ?? 0)) melhor = f;
			corte = melhor / FPS;
		}
		let cena;
		if (historia) cena = musica.partes[k].cenas[i % musica.partes[k].cenas.length];
		else {
			cena = fixas[i] ?? pool[(semente++ * 7) % pool.length];
			if (cena === tomadas.at(-1)?.cena) cena = pool[(semente++ * 7 + 3) % pool.length];
		}
		tomadas.push({de: r2(t), cena, video: comVideo(cena)});
		t = corte; i++;
	}
});
const faltando = await baixarEmojis(partes.flatMap((p) => p.emojis));
if (faltando.length) throw new Error(`Emojis inexistentes no Fluent: ${faltando.join(', ')}`);
const {bpm, inicio: inicioBatida} = andamento(ritmo);
const clipe = {id, titulo: musica.titulo, totalFrames, batida: ritmo, bpm, inicioBatida: r2(inicioBatida), partes, linhas, tomadas, cenas: CENAS};
const pub = path.join(RAIZ, 'public', 'clipe', id);
fs.mkdirSync(pub, {recursive: true});
fs.writeFileSync(path.join(pub, 'clipe.json'), JSON.stringify(clipe));
log('clipe', `${id}: ${dur.toFixed(1)} s, ${bpm} bpm, ${partes.length} partes, ${tomadas.length} tomadas (${tomadas.filter((t) => t.video).length} animadas), letra ${fs.existsSync(arqPalavras) ? 'sincronizada' : 'estimada'}`);
if (process.argv.includes('--dados')) process.exit(0);

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browserExecutable = fs.existsSync(CHROME) ? CHROME : null;
const inputProps = {id, clipe};
const serveUrl = await bundle({entryPoint: path.join(RAIZ, 'src', 'index.ts'), publicDir: path.join(RAIZ, 'public')});
const comp = await selectComposition({serveUrl, id: `Clipe${desenho ? 'Desenho' : ''}${vertical ? 'Vertical' : ''}`, inputProps, browserExecutable, port: Number(process.env.REMOTION_PORTA) || null});
const refrao = partes.find((p) => p.tipo === 'refrao');
const trecho = process.argv.find((a) => a.startsWith('--trecho='))?.slice(9).split('-').map(Number);
const [ini, fim] = trecho ? [Math.round(trecho[0] * FPS), Math.min(totalFrames - 1, Math.round(trecho[1] * FPS))] : short ? [Math.max(0, Math.round(((refrao?.de ?? 0) - 1.5) * FPS)), Math.min(totalFrames - 1, Math.round(((refrao?.de ?? 0) + 53.5) * FPS))] : [0, totalFrames - 1];
const quadros = fs.mkdtempSync(path.join(os.tmpdir(), `clipe-${id}-`));
const inicio = Date.now();
let feitos = 0;
await renderFrames({
	serveUrl, composition: comp, inputProps, browserExecutable, port: Number(process.env.REMOTION_PORTA) || null, outputDir: null, frameRange: [ini, fim], imageFormat: 'jpeg', jpegQuality: 90,
	concurrency: Number(process.env.RENDER_CONCORRENCIA) || 2, timeoutInMilliseconds: 300000, onStart: () => {},
	onFrameUpdate: (n) => { if (n - feitos >= 300) { feitos = n; log('clipe', `${n}/${fim - ini + 1} quadros`); } },
	onFrameBuffer: (buf, q) => fs.writeFileSync(path.join(quadros, `${String(q).padStart(6, '0')}.jpg`), buf),
});
const saida = path.join(RAIZ, 'saida', 'clipes');
fs.mkdirSync(saida, {recursive: true});
const video = path.join(saida, `${id}${desenho ? '-desenho' : ''}${short ? '-short' : vertical ? '-vertical' : ''}${trecho ? '-trecho' : ''}.mp4`);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-start_number', String(ini), '-i', `${quadros}/%06d.jpg`, '-ss', String(ini / FPS), '-i', audio,
	'-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-af', `afade=t=in:d=0.3,afade=t=out:st=${Math.max(0, (fim - ini) / FPS - 1.2)}:d=1.2`, '-shortest', '-movflags', '+faststart', video]);
fs.rmSync(quadros, {recursive: true, force: true});
if (!vertical) {
	const mini = await selectComposition({serveUrl, id: 'MiniaturaClipe', inputProps, browserExecutable, port: Number(process.env.REMOTION_PORTA) || null});
	await renderStill({serveUrl, composition: mini, inputProps, browserExecutable, port: Number(process.env.REMOTION_PORTA) || null, output: path.join(saida, `${id}.jpg`), imageFormat: 'jpeg', jpegQuality: 88, scale: 2 / 3});
}
log('clipe', `pronto: ${video} em ${Math.round((Date.now() - inicio) / 60000)} min`);
