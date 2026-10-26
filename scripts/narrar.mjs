// Gera a narração e a linha do tempo do episódio em public/ep/<id>/.
// Cada fala vira um arquivo nomeado pelo hash do texto: rodar de novo não gasta créditos com o que já existe.
// Uso: node scripts/narrar.mjs ep001-noe          (ElevenLabs; exige ELEVENLABS_API_KEY; voz em config/canal.json ou PS_VOICE_ID)
//      node scripts/narrar.mjs ep001-noe --azure  (voz Thalita via Azure Speech, licença comercial; exige AZURE_SPEECH_KEY/REGION)
//      node scripts/narrar.mjs ep001-noe --kokoro (voz local Kokoro Dora, grátis, licença Apache-2.0)
//      node scripts/narrar.mjs ep001-noe --edge   (voz neural Microsoft Thalita via edge-tts, sem chave)
//      node scripts/narrar.mjs ep001-noe --mac    (voz do Mac, só para prévia; o publicador recusa)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {RAIZ, FPS, LETRAS, episodio, duracaoAudio, log} from './lib.mjs';
import {validar} from './validar.mjs';

const EMOJI = episodio(process.argv[2]).quiz.tipo === 'emoji';
// segundos de cronômetro (briefing: 5–8); o formato de emojis é mais rápido, no estilo SpeedQuiz
const ABC = episodio(process.argv[2]).quiz.tipo === 'abc'; // pergunta com alternativas, no visual colorido
const SPEED = EMOJI || ABC;
const TEMPO_RESPOSTA = EMOJI ? 6 : ABC ? 7 : 8;
const MODELO = 'eleven_multilingual_v2';

const id = process.argv[2];
const mac = process.argv.includes('--mac');
const edge = process.argv.includes('--edge');
const azure = process.argv.includes('--azure');
const kokoro = process.argv.includes('--kokoro');
const VOZ_EDGE = 'pt-BR-ThalitaMultilingualNeural';
const erros = validar(id);
if (erros.length) {
	erros.forEach((e) => log('narrar', `ERRO roteiro: ${e}`));
	process.exit(1);
}
const {quiz} = episodio(id);
const canal = JSON.parse(fs.readFileSync(path.join(RAIZ, 'config', 'canal.json'), 'utf8'));
const provedor = mac ? 'mac' : edge ? 'edge' : azure ? 'azure' : kokoro ? 'kokoro' : 'elevenlabs';
const voz = mac ? 'Luciana' : kokoro ? 'pf_dora' : edge || azure ? VOZ_EDGE : process.env.PS_VOICE_ID || canal.voz?.id;
if (azure && (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION)) {
	log('narrar', 'ERRO: defina AZURE_SPEECH_KEY e AZURE_SPEECH_REGION no ~/.zshrc');
	process.exit(1);
}
if (provedor === 'elevenlabs' && (!process.env.ELEVENLABS_API_KEY || !voz)) {
	log('narrar', 'ERRO: defina ELEVENLABS_API_KEY no ~/.zshrc e a voz em config/canal.json, ou use --mac para prévia');
	process.exit(1);
}

const pastaEp = path.join(RAIZ, 'public', 'ep', id);
const pastaVoz = path.join(pastaEp, 'voz');
fs.mkdirSync(pastaVoz, {recursive: true});

// "Gênesis 6:8-9; 7:2" -> "Gênesis, capítulo 6, versículos 8 a 9, e capítulo 7, versículo 2"
function referenciaFalada(ref) {
	return ref.split(';').map((parte) => {
		const m = parte.trim().match(/^(.*?)\s*(\d+):(\d+)(?:-(\d+))?$/);
		if (!m) return parte.trim();
		const vers = m[4] ? `versículos ${m[3]} a ${m[4]}` : `versículo ${m[3]}`;
		return `${m[1] ? `${m[1]}, ` : ''}capítulo ${m[2]}, ${vers}`;
	}).join(', e ');
}

async function falar(texto) {
	const hash = crypto.createHash('sha1').update(`${provedor === 'elevenlabs' ? MODELO : provedor}|${voz}|${texto}`).digest('hex').slice(0, 12);
	const arq = path.join(pastaVoz, `${hash}.mp3`);
	if (!fs.existsSync(arq)) {
		const tmp = `${arq}.tmp`;
		if (kokoro) {
			// Kokoro local (modelo Apache-2.0): grátis, sem internet, uso comercial permitido
			const wav = `${arq}.wav`;
			execFileSync(path.join(RAIZ, '.venv-kokoro', 'bin', 'python'), ['-I', path.join(RAIZ, 'scripts', 'kokoro_tts.py'), voz, '0.95', wav, texto], {stdio: ['ignore', 'ignore', 'pipe']});
			execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', wav, '-ar', '44100', '-b:a', '160k', '-f', 'mp3', tmp]);
			fs.rmSync(wav);
		} else if (azure) {
			// Azure Speech: mesma voz Thalita, com licença comercial (plano gratuito: 500 mil caracteres/mês)
			const esc = texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
			const ssml = `<speak version="1.0" xml:lang="pt-BR"><voice name="${voz}"><prosody rate="-5%" pitch="+8Hz">${esc}</prosody></voice></speak>`;
			for (let tentativa = 1; ; tentativa++) {
				const r = await fetch(`https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
					method: 'POST', body: ssml,
					headers: {'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-48khz-192kbitrate-mono-mp3', 'User-Agent': 'pequenos-sabios'},
				});
				if (r.ok) {
					fs.writeFileSync(tmp, Buffer.from(await r.arrayBuffer()));
					break;
				}
				if (tentativa >= 4 || (r.status < 500 && r.status !== 429)) throw new Error(`Azure ${r.status}: ${(await r.text()).slice(0, 200)}`);
				log('narrar', `Azure ${r.status}, nova tentativa ${tentativa + 1}/4`);
				await new Promise((ok) => setTimeout(ok, 2000 * tentativa));
			}
		} else if (edge) {
			// Tom um pouco mais alto e ritmo calmo: mais amigável para crianças
			for (let tentativa = 1; ; tentativa++) {
				try {
					execFileSync(path.join(RAIZ, '.venv', 'bin', 'edge-tts'), ['--voice', voz, '--rate=-5%', '--pitch=+8Hz', '--text', texto, '--write-media', tmp], {stdio: ['ignore', 'ignore', 'pipe']});
					break;
				} catch (e) {
					if (tentativa >= 5) throw new Error(`edge-tts falhou 5 vezes: ${e.stderr?.toString().trim().split('\n').at(-1)}`);
					log('narrar', `edge-tts falhou, nova tentativa ${tentativa + 1}/5`);
					await new Promise((ok) => setTimeout(ok, 3000 * tentativa));
				}
			}
		} else if (mac) {
			const aiff = `${arq}.aiff`;
			execFileSync('say', ['-v', voz, '-r', '165', '-o', aiff, '--', texto]);
			execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', aiff, '-ar', '44100', '-b:a', '128k', '-f', 'mp3', tmp]);
			fs.rmSync(aiff);
		} else {
			for (let tentativa = 1; ; tentativa++) {
				const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voz}?output_format=mp3_44100_128`, {
					method: 'POST',
					headers: {'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json'},
					body: JSON.stringify({text: texto, model_id: MODELO, language_code: 'pt', voice_settings: {stability: 0.55, similarity_boost: 0.8, style: 0.35, speed: 0.92}}),
				});
				if (r.ok) {
					fs.writeFileSync(tmp, Buffer.from(await r.arrayBuffer()));
					break;
				}
				const corpo = (await r.text()).slice(0, 200);
				if (tentativa >= 4 || (r.status < 500 && r.status !== 429)) throw new Error(`ElevenLabs ${r.status}: ${corpo}`);
				log('narrar', `ElevenLabs ${r.status}, nova tentativa ${tentativa + 1}/4`);
				await new Promise((ok) => setTimeout(ok, 2000 * tentativa));
			}
		}
		fs.renameSync(tmp, arq); // só aparece completo: uma falha no meio não deixa arquivo corrompido no cache
		log('narrar', `fala gerada (${texto.length} caracteres)`, {arquivo: path.basename(arq)});
	}
	return {audio: `ep/${id}/voz/${path.basename(arq)}`, segundos: duracaoAudio(arq), boca: envelope(arq)};
}

// Volume da fala por quadro (0–1), usado para mexer a boca dos personagens.
function envelope(arq) {
	const taxa = 8000;
	const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', arq, '-ac', '1', '-ar', String(taxa), '-f', 's16le', '-'], {maxBuffer: 1 << 28});
	const porQuadro = taxa / FPS;
	const total = Math.floor(pcm.length / 2 / porQuadro);
	const rms = Array.from({length: total}, (_, q) => {
		let soma = 0;
		const ini = Math.floor(q * porQuadro);
		const fim = Math.floor((q + 1) * porQuadro);
		for (let k = ini; k < fim; k++) soma += (pcm.readInt16LE(k * 2) / 32768) ** 2;
		return Math.sqrt(soma / (fim - ini));
	});
	const pico = Math.max(...rms, 1e-6);
	return rms.map((v) => Math.round(Math.min(1, (v / pico) * 1.3) * 100) / 100);
}

const f = (s) => Math.round(s * FPS);
const cenas = [];
const sons = []; // efeitos: fonte única para a prévia no Remotion e para o mixer final (scripts/mixar.mjs)
let inicio = 0;
const som = (nome, quadro, volume) => sons.push({arquivo: `sons/${nome}.wav`, quadro: inicio + quadro, volume});
const EFEITOS = {
	abertura: () => (som('whoosh', 0, 0.6), som('acerto', 30, 0.4)),
	numero: () => (som('whoosh', 0, 0.6), som('pop', 6, 0.6)),
	pergunta: () => SPEED && (som('pop', 8, 0.6), som('pop', 20, 0.6), som('pop', 32, 0.4)),
	cronometro: () => {
		for (let k = 0; k < TEMPO_RESPOSTA; k++) som('tick', k * FPS, 0.5);
		som('tempo-esgotado', TEMPO_RESPOSTA * FPS - 2, 0.6);
	},
	revelacao: () => som('acerto', 2, 0.55),
	encerramento: () => som('acerto', 10, 0.4),
};
const adicionar = (cena, segundos) => {
	EFEITOS[cena.tipo]?.();
	cenas.push({...cena, inicio, duracao: f(segundos)});
	inicio += f(segundos);
};

const abertura = await falar(quiz.abertura);
adicionar({tipo: 'abertura', ...abertura, atrasoAudio: f(2.5)}, 2.5 + abertura.segundos + 0.8);

for (const [i, p] of quiz.perguntas.entries()) {
	if (ABC) {
		adicionar({tipo: 'numero', i}, 0.9);
		const enunciado = await falar(`Pergunta número ${i + 1}! ${p.pergunta} ${p.alternativas.map((a, k) => `Letra ${LETRAS[k]}: ${a}.`).join(' ')}`);
		adicionar({tipo: 'pergunta', i, ...enunciado, atrasoAudio: f(0.2)}, 0.2 + enunciado.segundos + 0.3);
		adicionar({tipo: 'cronometro', i}, TEMPO_RESPOSTA);
		const resposta = await falar(`Resposta certa: letra ${LETRAS[p.correta]}, ${p.alternativas[p.correta]}! ${p.explicacao}`);
		adicionar({tipo: 'revelacao', i, ...resposta, atrasoAudio: f(0.4)}, 0.4 + resposta.segundos + 0.9);
		continue;
	}
	if (EMOJI) {
		adicionar({tipo: 'numero', i}, 0.9);
		const enunciado = await falar(`Número ${i + 1}! ${quiz.pergunta ?? 'Quem é?'}`);
		adicionar({tipo: 'pergunta', i, ...enunciado, atrasoAudio: f(0.2)}, Math.max(1.6, 0.2 + enunciado.segundos + 0.2));
		adicionar({tipo: 'cronometro', i}, TEMPO_RESPOSTA);
		const resposta = await falar(`É... ${p.resposta}! ${p.explicacao}`);
		adicionar({tipo: 'revelacao', i, ...resposta, atrasoAudio: f(0.4)}, 0.4 + resposta.segundos + 0.9);
		continue;
	}
	adicionar({tipo: 'numero', i}, 1.6);
	const enunciado = await falar(`Pergunta número ${i + 1}! ${p.pergunta} ${p.alternativas.map((a, k) => `Letra ${LETRAS[k]}: ${a}.`).join(' ')}`);
	adicionar({tipo: 'pergunta', i, ...enunciado}, enunciado.segundos + 0.5);
	adicionar({tipo: 'cronometro', i}, TEMPO_RESPOSTA);
	const resposta = await falar(`A resposta certa é... letra ${LETRAS[p.correta]}: ${p.alternativas[p.correta]}! ${p.explicacao} Isso está em ${referenciaFalada(p.referencia)}.`);
	adicionar({tipo: 'revelacao', i, ...resposta, atrasoAudio: f(0.6)}, 0.6 + resposta.segundos + 1.0);
}

const encerramento = await falar(quiz.encerramento);
adicionar({tipo: 'encerramento', ...encerramento}, encerramento.segundos + 4);

const timeline = {id, fps: FPS, totalFrames: inicio, voz: {mac: 'mac-previa', edge: 'microsoft-thalita', azure: 'azure-thalita', kokoro: 'kokoro-dora', elevenlabs: 'elevenlabs'}[provedor], tempoResposta: TEMPO_RESPOSTA, quiz, cenas, sons, trilha: SPEED ? {arquivo: 'sons/trilha-energia.wav', volume: 0.15, volumeSobVoz: 0.04} : {arquivo: 'sons/trilha.wav', volume: 0.2, volumeSobVoz: 0.07}};
fs.writeFileSync(path.join(pastaEp, 'timeline.json'), JSON.stringify(timeline, null, 1));
log('narrar', `${id}: ${cenas.length} cenas, ${(inicio / FPS / 60).toFixed(1)} min (${timeline.voz})`);
