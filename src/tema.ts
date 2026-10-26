import {continueRender, delayRender, staticFile} from 'remotion';

// Fontes ficam em public/fontes/ (licença OFL): o render não depende de internet.
const fontesCarregadas = new Set<string>();
export const carregarFonte = (familia: string, arquivo: string, peso = '400') => {
	if (typeof FontFace === 'undefined' || fontesCarregadas.has(familia)) return familia;
	fontesCarregadas.add(familia);
	const espera = delayRender(`Carregando fonte ${familia}`);
	const fonte = new FontFace(familia, `url(${staticFile(arquivo)}) format('woff2')`, {weight: peso});
	fonte.load().then(() => {
		document.fonts.add(fonte);
		continueRender(espera);
	}).catch(() => continueRender(espera)); // sem a fonte, o texto sai na fonte padrão em vez de travar o render
	return familia;
};

export const FONTE = carregarFonte('Fredoka', 'fontes/fredoka.woff2', '300 700');

export const COR = {
	tinta: '#3a2e6b',
	ceuTopo: '#7cc8ff',
	ceuBase: '#e6f6ff',
	morro1: '#8bd47a',
	morro2: '#5fbb5c',
	certo: '#2fb344',
	cartao: '#ffffff',
	alternativas: ['#ff6b6b', '#4dabf7', '#fcc419'],
};

export const LETRAS = ['A', 'B', 'C'];

export type Cena = {
	tipo: 'abertura' | 'numero' | 'pergunta' | 'cronometro' | 'revelacao' | 'encerramento';
	inicio: number;
	duracao: number;
	i?: number;
	audio?: string;
	segundos?: number;
	atrasoAudio?: number;
	boca?: number[];
};

export type Pergunta = {pergunta: string; alternativas: string[]; correta: number; explicacao: string; referencia: string};
export type Quiz = {titulo: string; tema: string; licao: string; tipo?: 'emoji' | 'abc' | 'multipla'; cenario?: string; perguntas: Pergunta[]};
export type Som = {arquivo: string; quadro: number; volume: number};
export type Timeline = {
	id: string; totalFrames: number; tempoResposta: number; voz: string; quiz: Quiz; cenas: Cena[];
	sons: Som[]; trilha: {arquivo: string; volume: number; volumeSobVoz: number};
};

// Pseudoaleatório determinístico: o mesmo quadro sempre renderiza igual.
export const aleatorio = (semente: number) => {
	const x = Math.sin(semente * 12.9898) * 43758.5453;
	return x - Math.floor(x);
};
