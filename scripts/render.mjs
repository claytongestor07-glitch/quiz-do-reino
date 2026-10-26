// Renderiza episódio + miniatura e valida o arquivo final. Só marca "pronto" se tudo passar.
// O Remotion desenha os quadros (Chrome) e o FFmpeg do sistema codifica: o FFmpeg embutido no Remotion exige macOS 15.
// Uso: node scripts/render.mjs ep001-noe [--trecho=0-1799] [--previa] [--short=3]
//   --trecho  renderiza só esse intervalo de quadros (teste rápido)
//   --previa  aceita narração com voz do Mac (nunca publicável)
//   --short   gera o Short vertical da pergunta N (reaproveita a narração do episódio)
//   --vertical gera o episódio inteiro na vertical (1080x1920), sem a chamada para o canal
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn, execFileSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {renderFrames, renderStill, selectComposition} from '@remotion/renderer';
import {RAIZ, FPS, duracaoAudio, log} from './lib.mjs';
import {validar} from './validar.mjs';
import {mixar} from './mixar.mjs';
import {montarShort} from './curto.mjs';

const id = process.argv[2];
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1] ?? process.argv.includes(`--${n}`);
const trecho = arg('trecho') || null;
const previa = Boolean(arg('previa'));
const short = Number(arg('short')) || 0;
const vertical = Boolean(arg('vertical')); // episódio inteiro em 1080x1920 (versão para celular, 5+ min)
// --blocos=a-b: renderiza só esses blocos e para (produção em paralelo no GitHub Actions; o último passo junta tudo)
const soBlocos = arg('blocos') ? arg('blocos').split('-').map(Number) : null;
// Navegadores em paralelo: 2 neste Mac (8 GB); mais nas máquinas do GitHub (RENDER_CONCORRENCIA)
const CONCORRENCIA = Number(process.env.RENDER_CONCORRENCIA) || 2;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browserExecutable = fs.existsSync(CHROME) ? CHROME : null;
// Renderização por software (gl: 'swangle') evita os mosaicos da GPU, mas é ~200x mais lenta; ver renderBloco
const chromiumOptions = {};
const canal = JSON.parse(fs.readFileSync(path.join(RAIZ, 'config', 'canal.json'), 'utf8'));

const erros = validar(id);
if (erros.length) {
	erros.forEach((e) => log('render', `ERRO roteiro: ${e}`));
	process.exit(1);
}
const base = short ? montarShort(id, short) : JSON.parse(fs.readFileSync(path.join(RAIZ, 'public', 'ep', id, 'timeline.json'), 'utf8'));
const timeline = vertical ? {...base, completo: true} : base;
const [LARG, ALT, COMP] = short || vertical ? [1080, 1920, 'Short'] : [1920, 1080, 'Episodio'];
if (timeline.voz === 'mac-previa' && !previa) {
	log('render', 'ERRO: narração é prévia (voz do Mac). Rode narrar.mjs com ElevenLabs/--edge ou use --previa');
	process.exit(1);
}

const saida = path.join(RAIZ, 'saida', id);
fs.mkdirSync(saida, {recursive: true});
const sufixo = (short ? `-short${short}` : vertical ? '-vertical' : '') + (trecho ? '-trecho' : timeline.voz === 'mac-previa' ? '-previa' : '');
const video = path.join(saida, `${id}${sufixo}.mp4`);
const wav = path.join(saida, `${id}${sufixo}-mix.wav`);
const inputProps = {id, timeline, semAudio: true};
const [primeiro, ultimo] = trecho ? trecho.split('-').map(Number) : [0, timeline.totalFrames - 1];
const inicio = Date.now();

mixar(timeline, wav);
log('render', `empacotando ${id}`);
const serveUrl = await bundle({entryPoint: path.join(RAIZ, 'src', 'index.ts'), publicDir: path.join(RAIZ, 'public')});
const comp = await selectComposition({serveUrl, id: COMP, inputProps, browserExecutable, chromiumOptions});

// Render em blocos: cada bloco abre um navegador novo (o Chrome acumula memória e cai em máquinas de 8 GB),
// vira um .mp4 só de vídeo e fica guardado. Se algo falhar, rodar de novo retoma do bloco que faltou.
const BLOCO = 1500; // quadros (50 s)
const total = ultimo - primeiro + 1;
const assinatura = crypto.createHash('sha1').update(JSON.stringify({timeline, primeiro, ultimo, chromiumOptions}) + fs.readFileSync(path.join(RAIZ, 'src', 'Speed.tsx')) + fs.readFileSync(path.join(RAIZ, 'src', 'Cenas.tsx'))).digest('hex').slice(0, 10);
const pastaBlocos = path.join(saida, `blocos${sufixo}-${assinatura}`);
fs.mkdirSync(pastaBlocos, {recursive: true});
let feitosAntes = 0;

// Renderiza quadros [a, b] como JPEG em `dir` (nome = número do quadro).
async function quadrosPara(dir, a, b, concurrency) {
	fs.mkdirSync(dir, {recursive: true});
	await renderFrames({
		serveUrl, composition: comp, inputProps, browserExecutable, chromiumOptions, outputDir: null, imageFormat: 'jpeg', jpegQuality: 92,
		frameRange: [a, b], concurrency, timeoutInMilliseconds: 300000, onStart: () => {}, onFrameUpdate: () => {},
		onFrameBuffer: (buf, quadro) => fs.writeFileSync(path.join(dir, `${String(quadro).padStart(6, '0')}.jpg`), buf),
	});
}

// Semelhança (PSNR, dB) entre dois quadros. Ruído normal da GPU fica acima de ~35 dB; quadro em mosaico fica muito abaixo.
const psnr = (x, y) => {
	const r = execFileSync('sh', ['-c', `ffmpeg -hide_banner -i "${x}" -i "${y}" -lavfi psnr -f null - 2>&1 | grep -o 'average:[0-9.inf]*'`]).toString();
	const v = r.split(':')[1];
	return v?.startsWith('inf') ? 99 : Number(v);
};
const SEMELHANTE = 30;

// A GPU desta máquina às vezes entrega quadros em mosaico. Verificação inteligente (1 passada):
// mede a semelhança de cada quadro com o anterior; um salto brusco fora das trocas de cena é suspeito.
// Os suspeitos (e o 1º quadro do bloco) são renderizados de novo; onde a nova versão difere, o original
// estava com defeito: é trocado e a checagem segue adiante até as versões voltarem a coincidir.
const SALTO = 16; // dB: quadros vizinhos normais ficam bem acima; mosaico fica abaixo
const trocasDeCena = new Set(timeline.cenas.flatMap((c) => [c.inicio - 1, c.inicio, c.inicio + 1]));

function psnrVizinhos(dir, a, b) {
	const log1 = `${dir}.vizinhos.log`;
	execFileSync('sh', ['-c', `ffmpeg -v error -framerate ${FPS} -start_number ${a} -i "${dir}/%06d.jpg" -framerate ${FPS} -start_number ${a + 1} -i "${dir}/%06d.jpg" -lavfi "psnr=stats_file='${log1}'" -f null -`]);
	const v = fs.readFileSync(log1, 'utf8').trim().split('\n').map((l) => Number(l.match(/psnr_avg:([0-9.inf]+)/)?.[1].replace('inf', '99')));
	fs.rmSync(log1, {force: true});
	return v; // v[k] = semelhança entre o quadro a+k e a+k+1
}

async function renderBloco(a, b, arq, concurrency) {
	const dirA = `${arq}.A`;
	await quadrosPara(dirA, a, b, concurrency);
	const viz = b > a ? psnrVizinhos(dirA, a, b) : [];
	const suspeitos = [a, ...viz.map((v, k) => [a + k + 1, v]).filter(([q, v]) => !(v >= SALTO) && !trocasDeCena.has(q)).map(([q]) => q)];
	const conferidos = new Set();
	let trocados = 0;
	for (const s of suspeitos) {
		let q = s;
		while (q <= b && !conferidos.has(q)) {
			// Confere em lotes de até 30 quadros para não abrir o navegador a cada quadro
			const fimLote = Math.min(b, q + 29);
			const dirC = `${arq}.C${q}`;
			await quadrosPara(dirC, q, fimLote, 1);
			let seguir = false;
			for (let k = q; k <= fimLote; k++) {
				conferidos.add(k);
				const nome = `${String(k).padStart(6, '0')}.jpg`;
				if (psnr(path.join(dirA, nome), path.join(dirC, nome)) >= SEMELHANTE) {
					seguir = false;
					break;
				}
				fs.copyFileSync(path.join(dirC, nome), path.join(dirA, nome));
				trocados++;
				seguir = k === fimLote;
			}
			fs.rmSync(dirC, {recursive: true, force: true});
			if (!seguir) break;
			q = fimLote + 1;
		}
	}
	if (trocados) log('render', `${id}: ${trocados} quadro(s) com defeito trocados no bloco (${suspeitos.length} suspeitos conferidos)`);
	execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-start_number', String(a), '-i', `${dirA}/%06d.jpg`,
		'-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), `${arq}.tmp.mp4`]);
	fs.renameSync(`${arq}.tmp.mp4`, arq);
	for (const d of fs.readdirSync(path.dirname(arq)).filter((n) => n.startsWith(path.basename(arq) + '.'))) fs.rmSync(path.join(path.dirname(arq), d), {recursive: true, force: true});
}

const blocos = [];
for (let a = primeiro; a <= ultimo; a += BLOCO) blocos.push([a, Math.min(ultimo, a + BLOCO - 1)]);
for (const [k, [a, b]] of blocos.entries()) {
	if (soBlocos && (k < soBlocos[0] || k > soBlocos[1])) continue;
	const arq = path.join(pastaBlocos, `${String(k).padStart(3, '0')}.mp4`);
	if (!fs.existsSync(arq)) {
		for (let tentativa = 1; ; tentativa++) {
			try {
				await renderBloco(a, b, arq, tentativa === 1 ? CONCORRENCIA : 1);
				break;
			} catch (e) {
				for (const d of fs.readdirSync(pastaBlocos).filter((n) => n.startsWith(path.basename(arq) + '.'))) fs.rmSync(path.join(pastaBlocos, d), {recursive: true, force: true});
				// Navegador que caiu deixa processos órfãos ocupando memória; o Chrome do usuário (sem --headless) não é tocado
				try { execFileSync('pkill', ['-f', 'Google Chrome.*--headless']); } catch {}
				if (tentativa >= 3) throw e;
				log('render', `${id}: bloco ${k + 1} falhou (${e.message.split('\n')[0].slice(0, 120)}); tentando de novo com menos carga`);
			}
		}
	}
	feitosAntes += b - a + 1;
	log('render', `${id}: bloco ${k + 1}/${blocos.length} pronto, ${Math.floor((feitosAntes / total) * 100)}% (${Math.round((Date.now() - inicio) / 60000)} min)`);
}

if (soBlocos) {
	log('render', `${id}${sufixo}: blocos ${soBlocos.join('-')} prontos em ${path.relative(RAIZ, pastaBlocos)}`);
	process.exit(0);
}

const lista = path.join(pastaBlocos, 'lista.txt');
fs.writeFileSync(lista, blocos.map((_, k) => `file '${String(k).padStart(3, '0')}.mp4'`).join('\n'));
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', lista,
	'-ss', String(primeiro / FPS), '-t', String(total / FPS), '-i', wav,
	'-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
	'-movflags', '+faststart', `${video}.tmp.mp4`]);
fs.renameSync(`${video}.tmp.mp4`, video); // arquivo final só existe se o render terminou

// Validação técnica do resultado
const problemas = [];
const esperado = total / FPS;
const real = duracaoAudio(video);
if (Math.abs(real - esperado) > 0.5) problemas.push(`duração ${real.toFixed(1)}s, esperado ${esperado.toFixed(1)}s`);
const s = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height', '-of', 'json', video]).toString()).streams;
if (!s.some((x) => x.codec_type === 'audio')) problemas.push('sem trilha de áudio');
if (!s.some((x) => x.codec_type === 'video' && x.width === LARG && x.height === ALT)) problemas.push(`vídeo não é ${LARG}x${ALT}`);
const analise = execFileSync('sh', ['-c', `ffmpeg -hide_banner -i "${video}" -af volumedetect -f null - 2>&1`]).toString();
const media = Number(analise.match(/mean_volume: (-?[\d.]+)/)?.[1]);
const pico = Number(analise.match(/max_volume: (-?[\d.]+)/)?.[1]);
if (!(media > -30)) problemas.push(`áudio baixo demais (média ${media} dB)`);
if (pico > -0.1) problemas.push(`áudio estourando (pico ${pico} dB)`);
// Quadro todo preto/branco indica falha de renderização
const preto = execFileSync('sh', ['-c', `ffmpeg -hide_banner -i "${video}" -vf blackdetect=d=1:pix_th=0.1 -an -f null - 2>&1 | grep -c black_start || true`]).toString().trim();
if (Number(preto) > 0) problemas.push(`${preto} trecho(s) preto(s) de 1 s ou mais`);

if (!trecho && !short && !vertical) {
	const comp2 = await selectComposition({serveUrl, id: 'Thumbnail', inputProps, browserExecutable, chromiumOptions});
	const thumb = path.join(saida, `${id}-thumbnail.jpg`);
	await renderStill({serveUrl, composition: comp2, inputProps, browserExecutable, chromiumOptions, output: thumb, imageFormat: 'jpeg', jpegQuality: 88, scale: 2 / 3});
	if (fs.statSync(thumb).size > 2 * 1024 * 1024) problemas.push('miniatura passa de 2 MB (limite do YouTube)');
}
fs.rmSync(wav, {force: true});

const relatorio = {id, video: path.basename(video), duracaoMin: +(real / 60).toFixed(2), voz: timeline.voz, audio: {mediaDb: media, picoDb: pico}, problemas,
	minutosRender: Math.round((Date.now() - inicio) / 60000), pronto: problemas.length === 0 && !trecho && canal.vozesPublicaveis.includes(timeline.voz)};
fs.writeFileSync(path.join(saida, `relatorio${sufixo}.json`), JSON.stringify(relatorio, null, 1));
problemas.forEach((p) => log('render', `PROBLEMA ${id}: ${p}`));
log('render', `${id}: ${problemas.length ? 'REPROVADO' : 'aprovado'} (${relatorio.duracaoMin} min, ${relatorio.minutosRender} min de render)`);
// Blocos ficam guardados até o senhor aprovar o vídeo: um trecho com defeito visual pode ser refeito sozinho.
process.exit(problemas.length ? 1 : 0);
