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

// Narração da produção automática: ElevenLabs (voz humana do canal) quando a chave existe; senão Kokoro, grátis e local.
export const NARRACAO = process.env.ELEVENLABS_API_KEY ? [] : ['--kokoro'];

// Trilhas trocadas depois da narração: episódios já narrados com uma trilha antiga saem com a nova, sem renarrar
// nem invalidar o cache dos quadros (a timeline não muda). Cada trilha tem volumes próprios conforme a altura.
const QUIZ = {arquivo: 'sons/trilha-quiz.mp3', volume: 0.25, volumeSobVoz: 0.06};
const TROCA = {'sons/trilha-rapida.wav': QUIZ, 'sons/trilha-energia.wav': QUIZ};
export const trilhaFinal = (tl) => TROCA[tl.trilha.arquivo] ?? tl.trilha;
// Licença CC BY 4.0: o crédito é obrigatório na descrição de todo vídeo que usa a trilha
export const creditoTrilha = (tl) => trilhaFinal(tl).arquivo === QUIZ.arquivo ? [
	'🎵 Música: "Monkeys Spinning Monkeys" e "Fluffing a Duck", de Kevin MacLeod (incompetech.com)',
	'Licença Creative Commons: By Attribution 4.0 — http://creativecommons.org/licenses/by/4.0/',
] : [];
