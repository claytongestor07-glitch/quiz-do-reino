// Gera trilha e efeitos originais (sintetizados) em public/sons/. Sem custo e sem direitos de terceiros.
// Uso: node scripts/sons.mjs   (só recria o que não existe)
import fs from 'node:fs';
import path from 'node:path';
import {RAIZ, log} from './lib.mjs';

const SR = 44100;
const DIR = path.join(RAIZ, 'public', 'sons');
fs.mkdirSync(DIR, {recursive: true});

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

function salvarWav(nome, amostras) {
	const arq = path.join(DIR, nome);
	if (fs.existsSync(arq)) return;
	let pico = 0;
	for (const s of amostras) pico = Math.max(pico, Math.abs(s));
	const ganho = pico > 0 ? 0.89 / pico : 1;
	const buf = Buffer.alloc(44 + amostras.length * 2);
	buf.write('RIFF', 0); buf.writeUInt32LE(36 + amostras.length * 2, 4); buf.write('WAVE', 8);
	buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
	buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
	buf.write('data', 36); buf.writeUInt32LE(amostras.length * 2, 40);
	amostras.forEach((s, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s * ganho)) * 32767), 44 + i * 2));
	fs.writeFileSync(arq, buf);
	log('sons', `gerado ${nome}`);
}

// Nota tipo "caixinha de música": seno + harmônico com decaimento exponencial.
function sino(out, t0, midi, dur, vol) {
	const f = hz(midi);
	const ini = Math.floor(t0 * SR);
	const n = Math.floor(dur * SR);
	for (let i = 0; i < n && ini + i < out.length; i++) {
		const t = i / SR;
		const env = Math.min(1, t / 0.005) * Math.exp(-t * 3.2);
		out[ini + i] += vol * env * (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * 2 * f * t) + 0.08 * Math.sin(2 * Math.PI * 3 * f * t));
	}
}

// Acorde de fundo suave (triangular com ataque e liberação lentos).
function pad(out, t0, notas, dur, vol) {
	const ini = Math.floor(t0 * SR);
	const n = Math.floor(dur * SR);
	for (let i = 0; i < n && ini + i < out.length; i++) {
		const t = i / SR;
		const env = Math.min(1, t / 0.4) * Math.min(1, (dur - t) / 0.5);
		let s = 0;
		for (const m of notas) {
			const fase = (hz(m) * t) % 1;
			s += 4 * Math.abs(fase - 0.5) - 1;
		}
		out[ini + i] += vol * env * s / notas.length;
	}
}

function trilha(nome = 'trilha.wav', bpm = 96, percussao = false) {
	const tempo = 60 / bpm;
	const compassos = 16; // 4 voltas de I–V–vi–IV; ~40 s, tocada em loop
	const out = new Float32Array(Math.ceil(compassos * 4 * tempo * SR));
	const acordes = [[48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48]]; // C G Am F
	// Melodia pentatônica fixa (determinística): 8 notas por compasso em colcheias, com pausas.
	const frases = [
		[72, null, 76, 79, 76, null, 74, 72], [71, null, 74, 79, 74, null, 71, 67],
		[69, null, 72, 76, 72, null, 74, 76], [65, null, 69, 72, 74, null, 72, null],
	];
	for (let c = 0; c < compassos; c++) {
		const t = c * 4 * tempo;
		pad(out, t, acordes[c % 4], 4 * tempo, 0.18);
		sino(out, t, acordes[c % 4][0] - 12, 1.2, 0.22);
		sino(out, t + 2 * tempo, acordes[c % 4][0] - 12, 1.2, 0.16);
		const frase = frases[c % 4];
		const variacao = c >= 8 ? 12 : 0; // segunda metade uma oitava acima, mais leve
		frase.forEach((m, k) => m && sino(out, t + k * tempo / 2, m + variacao * (k % 2), 0.9, variacao ? 0.12 : 0.16));
	}
	if (percussao) {
		// Bumbo suave nos tempos e chimbal nas colcheias: energia de game show sem agredir
		let semente = 3;
		for (let b = 0; b < compassos * 8; b++) {
			const t0 = Math.floor((b * tempo / 2) * SR);
			if (b % 2 === 0) for (let i = 0; i < SR * 0.18 && t0 + i < out.length; i++) {
				const t = i / SR;
				out[t0 + i] += 0.5 * Math.sin(2 * Math.PI * (55 + 90 * Math.exp(-t * 30)) * t) * Math.exp(-t * 18);
			}
			for (let i = 0; i < SR * 0.04 && t0 + i < out.length; i++) {
				semente = (semente * 16807) % 2147483647;
				out[t0 + i] += (b % 2 ? 0.07 : 0.04) * (semente / 2147483647 * 2 - 1) * Math.exp(-i / SR * 120);
			}
		}
	}
	salvarWav(nome, out);
}

// Trilha de game show agitada (150 BPM): bumbo 4x4, palmas, chimbal, baixo pulsante e melodia "chiclete".
// Os sintetizadores abaixam a cada bumbo (sidechain) para dar o "balanço"; saturação suave deixa mais encorpada.
function trilhaEnergia(nome, bpm = 150) {
	const tempo = 60 / bpm;
	const compassos = 16;
	const out = new Float32Array(Math.ceil(compassos * 4 * tempo * SR));
	const synth = new Float32Array(out.length);
	const acordes = [[48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48]]; // C G Am F
	// Gancho em semicolcheias (16 por compasso; null = pausa), repete com resposta no 2º e 4º compasso
	const ganchos = [
		[72, null, 72, 76, null, 79, null, 76, 77, null, 76, null, 74, null, 72, null],
		[71, null, 71, 74, null, 79, null, 74, 76, null, 74, null, 71, 72, 74, null],
		[69, null, 69, 72, null, 76, null, 72, 74, null, 72, null, 76, null, 79, null],
		[77, null, 76, 74, null, 72, null, 69, 72, null, 74, null, 76, 77, 79, null],
	];
	let semente = 11;
	const ruido = () => ((semente = (semente * 16807) % 2147483647) / 2147483647) * 2 - 1;
	const nota = (buf, t0, midi, dur, vol, forma) => {
		const f = hz(midi), ini = Math.floor(t0 * SR), n = Math.floor(dur * SR);
		for (let i = 0; i < n && ini + i < buf.length; i++) {
			const t = i / SR, fase = (f * t) % 1;
			const onda = forma === 'quadrada' ? (fase < 0.5 ? 1 : -1) * 0.6 : forma === 'serra' ? 2 * fase - 1 : Math.sin(2 * Math.PI * fase);
			const env = Math.min(1, t / 0.003) * Math.exp(-t * (forma === 'serra' ? 9 : 6)) * Math.min(1, (dur - t) / 0.01);
			buf[ini + i] += vol * env * onda;
		}
	};
	for (let c = 0; c < compassos; c++) {
		const t = c * 4 * tempo, ac = acordes[c % 4];
		const virada = c % 8 === 7; // último compasso de cada bloco de 8: virada de caixa + subida
		// Acorde em colcheias (stab brilhante) e baixo nos contratempos, oitavando
		for (let k = 0; k < 8; k++) {
			if (k % 2) for (const m of ac) nota(synth, t + k * tempo / 2, m + 12, tempo * 0.45, 0.07, 'serra');
			nota(synth, t + k * tempo / 2, ac[0] - 12 + (k % 2 ? 12 : 0), tempo * 0.48, 0.32, 'quadrada');
		}
		// Melodia: entra a partir do 3º compasso, uma oitava acima na segunda metade
		if (c >= 2) ganchos[c % 4].forEach((m, k) => m && nota(synth, t + k * tempo / 4, m + (c >= 8 ? 12 : 0), tempo * 0.5, c >= 8 ? 0.16 : 0.2, 'quadrada'));
		for (let b = 0; b < 4; b++) {
			const tb = t + b * tempo;
			// Bumbo
			const i0 = Math.floor(tb * SR);
			for (let i = 0; i < SR * 0.22 && i0 + i < out.length; i++) {
				const x = i / SR;
				out[i0 + i] += 0.95 * Math.sin(2 * Math.PI * (50 * x + 160 / 35 * (1 - Math.exp(-x * 35)))) * Math.exp(-x * 11);
			}
			// Palmas nos tempos 2 e 4 (na virada, caixa em semicolcheias crescendo)
			const golpes = virada && b >= 2 ? [0, 0.25, 0.5, 0.75].map((d) => tb + d * tempo) : b % 2 ? [tb] : [];
			for (const tp of golpes) {
				const j0 = Math.floor(tp * SR), forca = virada ? 0.25 + 0.35 * (tp - t) / (4 * tempo) : 0.45;
				for (let i = 0; i < SR * 0.12 && j0 + i < out.length; i++) out[j0 + i] += forca * ruido() * Math.exp(-i / SR * 28);
			}
			// Chimbal: fechado nas semicolcheias, aberto no contratempo
			for (let s = 0; s < 4; s++) {
				const h0 = Math.floor((tb + s * tempo / 4) * SR), aberto = s === 2;
				for (let i = 0; i < SR * (aberto ? 0.12 : 0.03) && h0 + i < out.length; i++) out[h0 + i] += (aberto ? 0.13 : 0.05) * ruido() * Math.exp(-i / SR * (aberto ? 25 : 140));
			}
		}
		// Subida de ruído na virada
		if (virada) {
			const r0 = Math.floor(t * SR), n = Math.floor(4 * tempo * SR);
			let lp = 0;
			for (let i = 0; i < n && r0 + i < out.length; i++) {
				const p = i / n;
				lp += (0.01 + 0.4 * p) * (ruido() - lp);
				out[r0 + i] += 0.25 * p * p * lp;
			}
		}
	}
	// Sidechain: sintetizadores somem no bumbo e voltam em ~0,18 s
	for (let i = 0; i < out.length; i++) {
		const desde = (i / SR) % tempo;
		out[i] += synth[i] * (0.35 + 0.65 * Math.min(1, desde / 0.18));
	}
	for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] * 1.6);
	salvarWav(nome, out);
}

function efeitos() {
	const tick = new Float32Array(Math.floor(0.06 * SR));
	for (let i = 0; i < tick.length; i++) tick[i] = Math.sin(2 * Math.PI * 1800 * i / SR) * Math.exp(-i / SR * 90);
	salvarWav('tick.wav', tick);

	const acerto = new Float32Array(Math.floor(1.4 * SR));
	[72, 76, 79, 84].forEach((m, k) => sino(acerto, k * 0.09, m, 1.2, 0.5));
	salvarWav('acerto.wav', acerto);

	const fim = new Float32Array(Math.floor(0.6 * SR));
	sino(fim, 0, 79, 0.6, 0.6); sino(fim, 0, 67, 0.6, 0.4);
	salvarWav('tempo-esgotado.wav', fim);

	const whoosh = new Float32Array(Math.floor(0.45 * SR));
	let semente = 7, lp = 0;
	for (let i = 0; i < whoosh.length; i++) {
		semente = (semente * 16807) % 2147483647;
		const ruido = semente / 2147483647 * 2 - 1;
		const p = i / whoosh.length;
		lp += (0.02 + 0.25 * p) * (ruido - lp); // filtro que abre: som de "vush"
		whoosh[i] = lp * Math.sin(Math.PI * p);
	}
	salvarWav('whoosh.wav', whoosh);

	const pop = new Float32Array(Math.floor(0.15 * SR));
	for (let i = 0; i < pop.length; i++) {
		const t = i / SR;
		pop[i] = Math.sin(2 * Math.PI * (300 + 900 * Math.exp(-t * 40)) * t) * Math.exp(-t * 30);
	}
	salvarWav('pop.wav', pop);
}

trilha();
trilha('trilha-rapida.wav', 124, true);
trilhaEnergia('trilha-energia.wav');
efeitos();
