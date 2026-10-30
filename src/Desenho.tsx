import React from 'react';
import {AbsoluteFill, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Frase, Karaoke, Selo, Titulo, type Clipe, type Linha, type PropsClipe} from './Clipe';
import {TITULO} from './Speed';

// Clipe em desenho animado 2D (no estilo das músicas de gestos do Bento e Totó), todo desenhado em código:
// - personagens em SVG articulados (Davi, a ovelhinha Lulu, o leão Leleco e o gigante Golias): cabeça, braços,
//   olhos que piscam e boca que canta sílaba por sílaba no tempo da letra (palavras.json);
// - dança no compasso da música (bpm e fase medidos em scripts/clipe.mjs) e gestos puxados pela letra
//   ("palma" → palmas, "pula" → pulo, "gira" → giro, "pra cima" → mãos para o alto, "grande" → braços abertos);
// - cada verso encena a história (as cinco pedras, o coração valente, o gigante que cai tonto), com câmera que
//   corta e aproxima a cada linha cantada. O mundo é 1920x1080; no vertical a câmera acompanha o personagem.
const ROXO = '#2b1d5c';
const TRACO = {stroke: ROXO, strokeWidth: 6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const};
const PELE = '#f3b98a';
const aleatorio = (k: number) => {
	const x = Math.sin(k * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};
const limitar = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// ---------- tempo da música ----------

type Contexto = {s: number; frame: number; fps: number; batida: number; fase: number; linha?: Linha; iLinha: number; clipe: Clipe};

// Fase do compasso (1 = uma batida), a partir do bpm e do primeiro bumbo medidos na música
const faseDe = (clipe: Clipe, s: number) => (s - (clipe.inicioBatida ?? 0)) * ((clipe.bpm ?? 120) / 60);

// Abertura da boca cantando: abre e fecha uma vez por sílaba da palavra cantada agora
const bocaCantando = (linhas: Linha[], s: number) => {
	for (const l of linhas) {
		if (s < l.de - 0.05 || s > l.ate + 0.1) continue;
		for (const w of l.palavras) {
			if (s < w.de || s > w.ate + 0.04) continue;
			const silabas = Math.max(1, (w.p.toLowerCase().match(/[aeiouáéíóúâêôãõà]+/g) ?? []).length);
			const p = Math.min(0.999, (s - w.de) / Math.max(0.08, w.ate - w.de)) * silabas;
			return 0.25 + 0.75 * Math.sin(Math.PI * (p - Math.floor(p))) ** 0.7;
		}
	}
	return 0;
};

// ---------- pose e dança ----------

type Pose = {y: number; giro: number; escalaX: number; amassa: number; bracoE: number; bracoD: number; cotE: number; cotD: number; cabeca: number; boca: number; olhar: number; olharY: number; piscar: boolean};
type Gesto = 'leve' | 'danca' | 'palmas' | 'cima' | 'pula' | 'gira' | 'abre' | 'ora' | 'funda' | 'comemora' | 'cabeca' | 'joelho' | 'pe' | 'abraca' | 'corre' | 'aponta';

// Gesto puxado pela palavra cantada agora (ou pela linha) — o que as crianças imitam em casa
const gestoDaLetra = (linha: Linha | undefined, s: number, padrao: Gesto): Gesto => {
	if (!linha || s > linha.ate + 0.5) return padrao;
	const atual = linha.palavras.find((w) => s >= w.de - 0.15 && s <= w.ate + 0.35)?.p.toLowerCase() ?? '';
	const tudo = linha.palavras.map((w) => w.p.toLowerCase()).join(' ');
	// partes do corpo e ações (músicas de "cabeça, ombro, joelho e pé")
	if (/cabe[çc]a/.test(atual) && /m[ãa]o/.test(tudo)) return 'cabeca';
	if (/joelho/.test(atual)) return 'joelho';
	if (/^p[ée]s?[,!.]?$|pezinho/.test(atual) || /bate o p[ée]/.test(tudo)) return 'pe';
	if (/abra[çc]/.test(tudo)) return 'abraca';
	if (/corr|perninha/.test(tudo)) return 'corre';
	if (/olh|orelha|nariz|boquinha|escutar|cheirar/.test(tudo)) return 'aponta';
	if (/dan[çc]/.test(tudo)) return 'danca';
	if (/palma/.test(tudo)) return 'palmas';
	if (/gira/.test(tudo)) return 'gira';
	if (/cima/.test(tudo) && !/pula/.test(atual)) return 'cima';
	if (/grande/.test(atual)) return 'abre';
	if (/pula/.test(tudo)) return 'pula';
	return padrao;
};

const pose = (c: Contexto, gesto: Gesto, energia: number, semente: number, boca: number): Pose => {
	const b = c.fase + semente * 0.05;
	const meia = Math.abs(Math.sin(Math.PI * b)); // 0 na batida, 1 entre batidas
	const piscar = (c.frame + semente * 37) % 97 >= 93;
	const base: Pose = {y: 0, giro: 0, escalaX: 1, amassa: 0, bracoE: 12, bracoD: 12, cotE: 0, cotD: 0, cabeca: 0, boca, olhar: 0, olharY: 0, piscar};
	const lado = Math.sin((Math.PI * b) / 2);
	switch (gesto) {
		case 'leve':
			return {...base, y: -meia * 6 * energia, giro: lado * 3, cabeca: lado * 4, bracoE: 14 + meia * 6, bracoD: 14 + meia * 6};
		case 'danca':
			return {...base, y: -meia * 26 * energia, amassa: (1 - meia) * 0.06 * energia, giro: lado * 7 * energia, cabeca: -lado * 8,
				bracoE: 40 + Math.max(0, lado) * 110 * energia, bracoD: 40 + Math.max(0, -lado) * 110 * energia, cotE: 30 + meia * 30, cotD: 30 + meia * 30};
		case 'palmas': {
			const bate = Math.abs(Math.sin(Math.PI * b * 2));
			return {...base, y: -meia * 14, cabeca: lado * 6, bracoE: 70 + bate * 20, bracoD: 70 + bate * 20, cotE: 70 + bate * 25, cotD: 70 + bate * 25, amassa: (1 - meia) * 0.04};
		}
		case 'cima':
			return {...base, y: -meia * 18, giro: lado * 5, bracoE: 165 + lado * 12, bracoD: 165 - lado * 12, cabeca: lado * 6, olharY: -1};
		case 'pula':
			return {...base, y: -meia * 70, amassa: (1 - meia) * 0.12, bracoE: 70 + meia * 100, bracoD: 70 + meia * 100, olharY: -0.5};
		case 'gira':
			return {...base, y: -meia * 12, escalaX: Math.cos(Math.PI * b * 0.5), bracoE: 100, bracoD: 100, cabeca: lado * 5};
		case 'abre':
			return {...base, y: -meia * 20, bracoE: 125, bracoD: 125, cabeca: 0, amassa: -0.03};
		case 'ora':
			return {...base, y: -meia * 3, bracoE: 35, bracoD: 35, cotE: 115, cotD: 115, cabeca: 8, olhar: 0, olharY: -1, piscar: true};
		case 'funda':
			return {...base, y: -meia * 8, bracoE: 30, bracoD: 170, giro: -4, cabeca: -6, olhar: 1, olharY: -0.6};
		case 'cabeca':
			return {...base, y: -meia * 10, bracoE: 150, bracoD: 150, cotE: 105, cotD: 105, cabeca: lado * 6, amassa: (1 - meia) * 0.03};
		case 'joelho': {
			const desce = 1 - meia;
			return {...base, y: desce * 30, amassa: desce * 0.16, bracoE: 8, bracoD: 8, cotE: -25, cotD: -25, cabeca: 12 * desce, olharY: 0.8};
		}
		case 'pe':
			return {...base, y: -meia * 30, amassa: (1 - meia) * 0.16, giro: lado * 4, bracoE: 45, bracoD: 45, olharY: 0.5};
		case 'abraca':
			return {...base, y: -meia * 8, bracoE: 85, bracoD: 85, cotE: 95, cotD: 95, cabeca: 10 + lado * 6, piscar: meia > 0.6, amassa: -0.02};
		case 'corre': {
			const v = Math.sin(Math.PI * b * 2);
			return {...base, y: -Math.abs(v) * 22, giro: 4, bracoE: 40 + v * 50, bracoD: 40 - v * 50, cabeca: v * 3};
		}
		case 'aponta':
			return {...base, y: -meia * 10, bracoE: 14 + meia * 6, bracoD: 115, cotD: 75, cabeca: -lado * 6, olhar: -0.6};
		case 'comemora':
			return {...base, y: -meia * 50, amassa: (1 - meia) * 0.1, bracoE: 160 + lado * 15, bracoD: 160 - lado * 15, cabeca: lado * 8};
	}
};

// Corpo genérico: sombra no chão, amassa-e-estica no pouso, giro e espelhamento
const Corpo: React.FC<{x: number; y: number; escala: number; p: Pose; children: React.ReactNode; sombra?: number}> = ({x, y, escala, p, children, sombra = 70}) => (
	<g transform={`translate(${x} ${y}) scale(${escala})`}>
		<ellipse rx={sombra * (1 + p.y / 300)} ry={12} fill="rgba(30,20,60,.22)" />
		<g transform={`translate(0 ${p.y}) rotate(${p.giro}) scale(${(1 + p.amassa) * p.escalaX} ${1 - p.amassa})`}>{children}</g>
	</g>
);

const Olhos: React.FC<{dx: number; y: number; p: Pose; tam?: number}> = ({dx, y, p, tam = 1}) => (
	<>
		{[-dx, dx].map((x) => (
			<g key={x} transform={`translate(${x} ${y}) scale(${tam} ${tam * (p.piscar ? 0.08 : 1)})`}>
				<ellipse rx={19} ry={24} fill="#fff" {...TRACO} strokeWidth={4} />
				<circle cx={p.olhar * 6} cy={3 + p.olharY * 8} r={12} fill={ROXO} />
				<circle cx={p.olhar * 6 + 4} cy={-2 + p.olharY * 8} r={4.5} fill="#fff" />
			</g>
		))}
	</>
);

const Boca: React.FC<{y: number; abertura: number; larg?: number}> = ({y, abertura, larg = 1}) =>
	abertura > 0.05 ? (
		<g transform={`translate(0 ${y}) scale(${larg})`}>
			<ellipse rx={14 + abertura * 6} ry={4 + abertura * 18} fill="#7a1530" {...TRACO} strokeWidth={4} />
			<ellipse cy={3 + abertura * 10} rx={9} ry={2 + abertura * 6} fill="#ff7b9c" />
		</g>
	) : (
		<path d={`M ${-18 * larg} ${y - 4} Q 0 ${y + 18} ${18 * larg} ${y - 4} Z`} fill="#7a1530" {...TRACO} strokeWidth={4} />
	);

// Braço com pivô no ombro; ângulo 0 = para baixo, positivo = abrindo para fora
// cot = dobra do cotovelo (positivo = antebraço para dentro, em direção ao corpo/cabeça)
const Braco: React.FC<{x: number; y: number; ang: number; cot?: number; lado: 1 | -1; cor: string; mao: string; comp?: number; children?: React.ReactNode}> = ({x, y, ang, cot = 0, lado, cor, mao, comp = 72, children}) => {
	const meio = comp * 0.52;
	return (
		<g transform={`translate(${x} ${y}) rotate(${ang * lado})`}>
			<g transform={`translate(0 ${meio}) rotate(${cot * lado})`}>
				<rect x={-12} y={-12} width={24} height={comp - meio + 12} rx={12} fill={cor} {...TRACO} strokeWidth={5} />
				<circle cy={comp - meio + 4} r={16} fill={mao} {...TRACO} strokeWidth={5} />
				{children && <g transform={`translate(0 ${comp - meio + 4})`}>{children}</g>}
			</g>
			<rect x={-12} y={-6} width={24} height={meio + 12} rx={12} fill={cor} {...TRACO} strokeWidth={5} />
			<rect x={-7} y={meio - 6} width={14} height={14} fill={cor} />
		</g>
	);
};

// ---------- personagens ----------

const Davi: React.FC<{p: Pose; funda?: number; coracao?: number}> = ({p, funda = 0, coracao = 0}) => (
	<>
		{[-21, 21].map((x) => <g key={x}><rect x={x - 12} y={-86} width={24} height={82} rx={10} fill={PELE} {...TRACO} strokeWidth={5} /><rect x={x - 16} y={-14} width={32} height={14} rx={7} fill="#8d5a2b" {...TRACO} strokeWidth={4} /></g>)}
		<Braco x={-52} y={-168} ang={p.bracoE} cot={p.cotE} lado={1} cor={PELE} mao={PELE} />
		<Braco x={52} y={-168} ang={p.bracoD} cot={p.cotD} lado={-1} cor={PELE} mao={PELE}>
			{funda > 0 && <g transform={`rotate(${funda * 1440})`}><path d="M 0 0 L 0 46" stroke="#8d5a2b" strokeWidth={5} /><circle cy={50} r={11} fill="#9aa5b1" {...TRACO} strokeWidth={4} /></g>}
		</Braco>
		<path d="M -58 -180 Q -66 -110 -74 -72 L 74 -72 Q 66 -110 58 -180 Q 0 -196 -58 -180 Z" fill="#3d8bfd" {...TRACO} />
		<path d="M -40 -186 L 0 -150 L 40 -186" fill="none" stroke="#2f6fd1" strokeWidth={6} />
		<rect x={-66} y={-128} width={132} height={16} rx={6} fill="#8d5a2b" {...TRACO} strokeWidth={4} />
		{coracao > 0 && (
			<g transform={`translate(0 -150) scale(${coracao * (1 + Math.sin(coracao * 40) * 0.08)})`}>
				<circle r={44} fill="#ff6b8a" opacity={0.3} />
				<path d="M 0 16 C -30 -6 -22 -30 0 -16 C 22 -30 30 -6 0 16 Z" fill="#ff2e63" {...TRACO} strokeWidth={4} />
			</g>
		)}
		<g transform={`translate(0 -178) rotate(${p.cabeca})`}>
			<circle cx={-86} cy={-74} r={17} fill={PELE} {...TRACO} strokeWidth={5} />
			<circle cx={86} cy={-74} r={17} fill={PELE} {...TRACO} strokeWidth={5} />
			<circle cy={-80} r={90} fill={PELE} {...TRACO} />
			{[[-72, -128], [-42, -158], [0, -170], [42, -158], [72, -128], [-86, -96], [86, -96], [-20, -150], [22, -150]].map(([x, y], k) => <circle key={k} cx={x} cy={y} r={30} fill="#5a3418" {...TRACO} strokeWidth={5} />)}
			<path d="M -88 -110 Q 0 -150 88 -110 L 88 -100 Q 0 -130 -88 -100 Z" fill="#5a3418" />
			<Olhos dx={33} y={-76} p={p} />
			<path d="M -48 -112 Q -33 -120 -18 -112 M 18 -112 Q 33 -120 48 -112" fill="none" stroke={ROXO} strokeWidth={5} strokeLinecap="round" />
			<ellipse cx={-58} cy={-38} rx={16} ry={10} fill="#ff8fa3" opacity={0.6} />
			<ellipse cx={58} cy={-38} rx={16} ry={10} fill="#ff8fa3" opacity={0.6} />
			<Boca y={-28} abertura={p.boca} />
		</g>
	</>
);

const Lulu: React.FC<{p: Pose}> = ({p}) => (
	<>
		{[-36, -12, 12, 36].map((x) => <rect key={x} x={x - 8} y={-56} width={16} height={56} rx={7} fill="#4a3b5c" {...TRACO} strokeWidth={4} />)}
		{[[-50, -92], [-20, -112], [18, -112], [50, -92], [-40, -64], [0, -60], [40, -64], [0, -96]].map(([x, y], k) => <circle key={k} cx={x} cy={y} r={34} fill="#fffaf0" {...TRACO} strokeWidth={5} />)}
		<rect x={-52} y={-100} width={104} height={40} fill="#fffaf0" />
		<Braco x={-44} y={-104} ang={p.bracoE * 0.8} cot={p.cotE} lado={1} cor="#4a3b5c" mao="#4a3b5c" comp={36} />
		<Braco x={44} y={-104} ang={p.bracoD * 0.8} cot={p.cotD} lado={-1} cor="#4a3b5c" mao="#4a3b5c" comp={36} />
		<g transform={`translate(0 -128) rotate(${p.cabeca})`}>
			<ellipse cx={-56} cy={-40} rx={26} ry={13} fill="#c9a6b8" {...TRACO} strokeWidth={4} transform="rotate(-25 -56 -40)" />
			<ellipse cx={56} cy={-40} rx={26} ry={13} fill="#c9a6b8" {...TRACO} strokeWidth={4} transform="rotate(25 56 -40)" />
			<ellipse cy={-40} rx={52} ry={56} fill="#fde7d2" {...TRACO} />
			{[-26, 0, 26].map((x) => <circle key={x} cx={x} cy={-92} r={22} fill="#fffaf0" {...TRACO} strokeWidth={5} />)}
			<Olhos dx={22} y={-44} p={p} tam={0.82} />
			<ellipse cx={-36} cy={-16} rx={10} ry={7} fill="#ff8fa3" opacity={0.6} />
			<ellipse cx={36} cy={-16} rx={10} ry={7} fill="#ff8fa3" opacity={0.6} />
			<Boca y={-6} abertura={p.boca} larg={0.75} />
		</g>
	</>
);

const Leleco: React.FC<{p: Pose}> = ({p}) => (
	<>
		<path d={`M 40 -60 Q 110 -60 ${100 + Math.sin(p.giro) * 10} -130`} fill="none" stroke="#e8a317" strokeWidth={12} strokeLinecap="round" />
		<circle cx={100} cy={-136} r={16} fill="#d9480f" {...TRACO} strokeWidth={4} />
		{[-26, 26].map((x) => <rect key={x} x={x - 15} y={-70} width={30} height={70} rx={14} fill="#ffc94a" {...TRACO} strokeWidth={5} />)}
		<Braco x={-46} y={-140} ang={p.bracoE} cot={p.cotE} lado={1} cor="#ffc94a" mao="#ffd98a" comp={62} />
		<Braco x={46} y={-140} ang={p.bracoD} cot={p.cotD} lado={-1} cor="#ffc94a" mao="#ffd98a" comp={62} />
		<ellipse cy={-100} rx={58} ry={68} fill="#ffc94a" {...TRACO} />
		<ellipse cy={-86} rx={34} ry={42} fill="#fff1c9" />
		<g transform={`translate(0 -160) rotate(${p.cabeca})`}>
			{Array.from({length: 14}, (_, k) => {
				const a = (k / 14) * Math.PI * 2;
				return <circle key={k} cx={Math.cos(a) * 78} cy={-62 + Math.sin(a) * 78} r={34} fill={k % 2 ? '#e8590c' : '#f08c00'} {...TRACO} strokeWidth={5} />;
			})}
			<circle cy={-62} r={82} fill="#f08c00" />
			<circle cx={-52} cy={-122} r={18} fill="#ffc94a" {...TRACO} strokeWidth={5} />
			<circle cx={52} cy={-122} r={18} fill="#ffc94a" {...TRACO} strokeWidth={5} />
			<circle cy={-62} r={70} fill="#ffd166" {...TRACO} />
			<Olhos dx={28} y={-74} p={p} tam={0.9} />
			<ellipse cy={-30} rx={30} ry={22} fill="#fff1c9" />
			<path d="M -11 -44 L 11 -44 L 0 -32 Z" fill="#6b3a1f" {...TRACO} strokeWidth={3} />
			<Boca y={-18} abertura={p.boca} larg={0.85} />
		</g>
	</>
);

// Golias: grandão e engraçado (não assusta); cai tonto com estrelinhas girando
const Golias: React.FC<{p: Pose; tonto: number; frame: number}> = ({p, tonto, frame}) => (
	<>
		{[-40, 40].map((x) => <rect key={x} x={x - 26} y={-150} width={52} height={150} rx={18} fill="#8f8f9e" {...TRACO} />)}
		<Braco x={-92} y={-330} ang={p.bracoE} cot={p.cotE} lado={1} cor="#b08d57" mao={PELE} comp={130} />
		<Braco x={92} y={-330} ang={p.bracoD} cot={p.cotD} lado={-1} cor="#b08d57" mao={PELE} comp={130} />
		<path d="M -100 -350 Q -110 -220 -96 -140 L 96 -140 Q 110 -220 100 -350 Q 0 -380 -100 -350 Z" fill="#c9a227" {...TRACO} />
		{[-250, -200].map((y) => <path key={y} d={`M -100 ${y} Q 0 ${y + 20} 100 ${y}`} fill="none" stroke="#9c7a1d" strokeWidth={6} />)}
		<g transform={`translate(0 -350) rotate(${p.cabeca})`}>
			<circle cy={-90} r={92} fill={PELE} {...TRACO} />
			<path d="M -96 -110 Q 0 -230 96 -110 Z" fill="#9aa5b1" {...TRACO} />
			<path d="M 0 -170 Q 30 -240 70 -220" fill="none" stroke="#e03131" strokeWidth={16} strokeLinecap="round" />
			<path d="M -62 -60 Q -50 30 0 40 Q 50 30 62 -60 Q 30 -30 0 -36 Q -30 -30 -62 -60 Z" fill="#3b2a20" {...TRACO} strokeWidth={5} />
			<Olhos dx={30} y={-104} p={{...p, piscar: tonto > 0 ? false : p.piscar}} />
			{tonto > 0 && [-30, 30].map((x) => <path key={x} d={`M ${x - 12} -116 L ${x + 12} -92 M ${x + 12} -116 L ${x - 12} -92`} stroke={ROXO} strokeWidth={6} strokeLinecap="round" />)}
			<path d="M -56 -134 L -14 -122 M 56 -134 L 14 -122" stroke={ROXO} strokeWidth={8} strokeLinecap="round" />
			<ellipse cy={-74} rx={20} ry={16} fill="#e8956b" {...TRACO} strokeWidth={4} />
			<Boca y={-36} abertura={p.boca} larg={1.3} />
			{tonto > 0 && Array.from({length: 4}, (_, k) => {
				const a = frame / 8 + (k * Math.PI) / 2;
				return <text key={k} x={Math.cos(a) * 90} y={-200 + Math.sin(a) * 22} fontSize={44} textAnchor="middle" opacity={tonto}>⭐</text>;
			})}
		</g>
	</>
);

// ---------- cenário ----------

const Nuvem: React.FC<{x: number; y: number; e: number}> = ({x, y, e}) => (
	<g transform={`translate(${x} ${y}) scale(${e})`} opacity={0.95}>
		{[[-60, 10, 42], [-10, -14, 58], [50, 6, 46], [0, 22, 44]].map(([cx, cy, r], k) => <circle key={k} cx={cx} cy={cy} r={r} fill="#fff" />)}
	</g>
);

const Sol: React.FC<{frame: number; brilho: number}> = ({frame, brilho}) => (
	<g transform="translate(1660 190)">
		<circle r={170 + brilho * 80} fill="#fff3bf" opacity={0.35 + brilho * 0.3} />
		<g transform={`rotate(${frame * 0.6})`}>
			{Array.from({length: 12}, (_, k) => <path key={k} transform={`rotate(${k * 30})`} d="M -16 -110 L 0 -150 L 16 -110 Z" fill="#ffd43b" />)}
		</g>
		<circle r={96} fill="#ffd43b" {...TRACO} />
		<path d="M -40 -14 Q -28 -26 -16 -14 M 16 -14 Q 28 -26 40 -14" fill="none" stroke={ROXO} strokeWidth={6} strokeLinecap="round" />
		<path d="M -34 18 Q 0 52 34 18" fill="none" stroke={ROXO} strokeWidth={6} strokeLinecap="round" />
		<ellipse cx={-56} cy={14} rx={14} ry={9} fill="#ff922b" opacity={0.6} />
		<ellipse cx={56} cy={14} rx={14} ry={9} fill="#ff922b" opacity={0.6} />
	</g>
);

const Flor: React.FC<{x: number; y: number; cor: string; frame: number; pulso: number; k: number}> = ({x, y, cor, frame, pulso, k}) => (
	<g transform={`translate(${x} ${y}) rotate(${Math.sin((frame + k * 13) / 12) * 8})`}>
		<path d="M 0 0 L 0 -46" stroke="#2f9e44" strokeWidth={6} />
		<g transform={`translate(0 -50) scale(${1 + pulso * 0.15})`}>
			{Array.from({length: 5}, (_, i) => <circle key={i} cx={Math.cos((i * 2 * Math.PI) / 5) * 13} cy={Math.sin((i * 2 * Math.PI) / 5) * 13} r={11} fill={cor} />)}
			<circle r={8} fill="#ffd43b" />
		</g>
	</g>
);

// Céu, sol, nuvens, morros e chão florido; "palco" põe bandeirinhas, holofotes e confete (refrões)
const Cenario: React.FC<{c: Contexto; palco: number; noite: number; luz: number}> = ({c, palco, noite, luz}) => {
	const {frame} = c;
	const cores = ['#ff6b6b', '#ffd43b', '#4dabf7', '#69db7c', '#da77f2'];
	return (
		<>
			<defs>
				<linearGradient id="ceu" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor={noite > 0.5 ? '#5f4b8b' : '#6cc4ff'} />
					<stop offset="1" stopColor={noite > 0.5 ? '#c39bd3' : '#d8f1ff'} />
				</linearGradient>
			</defs>
			<rect x={-400} y={-300} width={2720} height={1700} fill="url(#ceu)" />
			{luz > 0 && Array.from({length: 7}, (_, k) => <path key={k} d={`M 960 -200 L ${200 + k * 250} 1100 L ${320 + k * 250} 1100 Z`} fill="#fff8d6" opacity={luz * 0.22} />)}
			<Sol frame={frame} brilho={c.batida * 0.6 + luz} />
			{[[200, 160, 1.1, 0.25], [800, 110, 0.8, 0.4], [1250, 230, 1, 0.3], [-100, 280, 0.9, 0.35]].map(([x, y, e, v], k) => (
				<Nuvem key={k} x={((x + frame * v) % 2400) - 240} y={y + Math.sin((frame + k * 50) / 40) * 8} e={e} />
			))}
			<path d="M -400 760 Q 200 540 700 720 T 1700 660 T 2400 720 L 2400 1400 L -400 1400 Z" fill="#a9e34b" />
			<path d="M -400 830 Q 400 680 1000 800 T 2400 780 L 2400 1400 L -400 1400 Z" fill="#82c91e" />
			{[[260, 760, 1], [1560, 740, 1.2]].map(([x, y, e], k) => (
				<g key={k} transform={`translate(${x} ${y}) scale(${e}) rotate(${Math.sin((frame + k * 30) / 30) * 2})`}>
					<rect x={-16} y={-120} width={32} height={130} rx={10} fill="#8d5a2b" {...TRACO} strokeWidth={5} />
					{[[-50, -150, 60], [40, -160, 66], [0, -210, 70]].map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} fill="#40c057" {...TRACO} strokeWidth={5} />)}
				</g>
			))}
			<path d="M -400 900 Q 960 840 2400 900 L 2400 1400 L -400 1400 Z" fill="#69c34a" />
			{Array.from({length: 26}, (_, k) => <Flor key={k} x={-200 + k * 90 + aleatorio(k) * 40} y={960 + aleatorio(k + 3) * 90} cor={cores[k % 5]} frame={frame} pulso={c.batida} k={k} />)}
			{palco > 0 && (
				<g opacity={palco}>
					{[0, 1].map((fio) => (
						<g key={fio}>
							<path d={`M -100 ${40 + fio * 70} Q 960 ${200 + fio * 70} 2020 ${40 + fio * 70}`} fill="none" stroke="#fff" strokeWidth={4} />
							{Array.from({length: 18}, (_, k) => {
								const t = (k + 0.5) / 18, x = -100 + t * 2120, y = 40 + fio * 70 + 4 * 160 * t * (1 - t);
								return <path key={k} transform={`translate(${x} ${y}) rotate(${Math.sin((frame + k * 9) / 10) * 6})`} d="M -24 0 L 24 0 L 0 46 Z" fill={cores[(k + fio * 2) % 5]} {...TRACO} strokeWidth={3} />;
							})}
						</g>
					))}
					{[-1, 1].map((l) => <path key={l} d={`M ${960 + l * 900} -100 L ${960 + l * 200 + Math.sin(frame / 25) * 160 * l} 1000 L ${960 + l * 420 + Math.sin(frame / 25) * 160 * l} 1000 Z`} fill="#fff" opacity={0.12 + c.batida * 0.1} />)}
					{Array.from({length: 46}, (_, k) => {
						const y = ((frame * (2 + aleatorio(k) * 3) + aleatorio(k + 9) * 1300) % 1300) - 150;
						const x = aleatorio(k + 4) * 1920 + Math.sin((frame + k * 17) / 14) * 30;
						return <rect key={k} x={x} y={y} width={14} height={22} rx={3} fill={cores[k % 5]} transform={`rotate(${frame * 6 + k * 40} ${x + 7} ${y + 11})`} />;
					})}
				</g>
			)}
		</>
	);
};

// Notinhas musicais subindo de quem canta
const Notas: React.FC<{x: number; y: number; frame: number; ativo: number}> = ({x, y, frame, ativo}) => (
	<>
		{ativo > 0 && Array.from({length: 4}, (_, k) => {
			const t = ((frame + k * 22) % 88) / 88;
			return <text key={k} x={x + Math.sin(t * 7 + k) * 40 + (k - 1.5) * 30} y={y - t * 220} fontSize={58} fill={['#da77f2', '#4dabf7', '#ff6b6b', '#fab005'][k]}
				opacity={ativo * Math.sin(Math.PI * t)} stroke={ROXO} strokeWidth={3} paintOrder="stroke" fontWeight={700}>{k % 2 ? '♪' : '♫'}</text>;
		})}
	</>
);

// ---------- direção: o que acontece em cada parte ----------

type Plano = {z: number; x: number; y: number};
const LARGO: Plano = {z: 1, x: 960, y: 540};

// Miniatura: o trio comemorando no palco, título enorme e dois adesivos do tema
export const MiniaturaDesenho: React.FC<PropsClipe> = ({clipe}) => {
	if (!clipe) return null;
	const c: Contexto = {s: 0, frame: 40, fps: 30, batida: 0.6, fase: 0.5, iLinha: 0, clipe};
	const emojis = [...new Set(clipe.partes.flatMap((p) => p.emojis))].slice(0, 2);
	const pD = {...pose(c, 'comemora', 1, 0, 0.8), y: -30};
	const pL = {...pose(c, 'abre', 1, 3, 0.6), y: -10};
	const pK = {...pose(c, 'cima', 1, 6, 0.7), y: -20};
	return (
		<AbsoluteFill style={{background: ROXO}}>
			<svg width={1920} height={1080} viewBox="0 0 1920 1080">
				<g transform="translate(960 640) scale(1.25) translate(-960 -540)">
					<Cenario c={c} palco={1} noite={0} luz={0.4} />
					<Corpo x={560} y={930} escala={1.35} p={pL} sombra={80}><Lulu p={pL} /></Corpo>
					<Corpo x={1360} y={925} escala={1.4} p={pK}><Leleco p={pK} /></Corpo>
					<Corpo x={960} y={940} escala={1.5} p={pD}><Davi p={pD} /></Corpo>
				</g>
				{emojis.map((nome, k) => (
					<image key={k} href={staticFile(`emoji/${nome.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.png`)} x={k ? 1660 : 60} y={360} width={200} height={200}
						transform={`rotate(${k ? 12 : -12} ${k ? 1760 : 160} 460)`} />
				))}
			</svg>
			<div style={{position: 'absolute', top: 30, width: '100%', textAlign: 'center', fontFamily: TITULO, fontSize: 170, lineHeight: 0.95, color: '#ffd43b',
				WebkitTextStroke: `22px ${ROXO}`, paintOrder: 'stroke fill', filter: 'drop-shadow(0 14px 14px rgba(0,0,0,.45))', transform: 'rotate(-2deg)', padding: '0 80px', boxSizing: 'border-box'}}>
				{clipe.titulo}
			</div>
		</AbsoluteFill>
	);
};

export const ClipeDesenho: React.FC<PropsClipe> = ({clipe}) => {
	const frame = useCurrentFrame();
	const {fps, width: W, height: H} = useVideoConfig();
	if (!clipe) return null;
	const s = frame / fps;
	const vertical = H > W;
	const batida = Math.max(clipe.batida[frame] ?? 0, (clipe.batida[frame - 1] ?? 0) * 0.8, (clipe.batida[frame - 2] ?? 0) * 0.6);
	const iParte = Math.max(0, clipe.partes.reduce((k, p, i) => (s >= p.de ? i : k), -1));
	const parte = clipe.partes[iParte];
	const desde = Math.round(parte.de * fps);
	const ate = Math.round((clipe.partes[iParte + 1]?.de ?? clipe.totalFrames / fps) * fps);
	const ordem = clipe.partes.slice(0, iParte + 1).filter((p) => p.tipo === parte.tipo).length; // 1º verso, 2º verso...
	const linhasParte = clipe.linhas.filter((l) => l.parte === iParte);
	const iLinha = Math.max(0, linhasParte.reduce((k, l, i) => (s >= l.de - 0.3 ? i : k), -1));
	const linha = linhasParte[iLinha];
	const c: Contexto = {s, frame, fps, batida, fase: faseDe(clipe, s), linha, iLinha, clipe};
	const canta = bocaCantando(clipe.linhas, s);
	const desdeLinha = (i: number) => Math.round(((linhasParte[i]?.de ?? parte.de) - 0.3) * fps);

	// Padrões por parte; versos encenam a letra linha a linha
	const historia = parte.tipo !== 'verso' ? parte.tipo : clipe.roteiro === 'davi' ? (ordem === 1 ? 'pedras' : 'gigante') : 'objetos';
	const festa = parte.tipo === 'refrao' || parte.tipo === 'ponte' || parte.tipo === 'final';
	const energia = festa ? 1 : parte.tipo === 'intro' ? 0.7 : 0.45;
	const gestoBase: Gesto = festa ? 'danca' : 'leve';
	const g = gestoDaLetra(linha, s, gestoBase);
	let gDavi: Gesto = g, coracao = 0, funda = 0, pedras = 0, luz = 0;
	let golias: {x: number; queda: number; grito: number; tonto: number; pedra: number} | null = null;
	let planos: Plano[] = [LARGO];
	if (historia === 'pedras') {
		planos = [{z: 1.75, x: 960, y: 640}, {z: 1.4, x: 960, y: 650}, {z: 1.2, x: 900, y: 640}, {z: 1, x: 960, y: 540}];
		if (iLinha === 1) coracao = spring({frame: frame - desdeLinha(1), fps, config: {damping: 9}});
		if (iLinha === 2) { pedras = interpolate(frame - desdeLinha(2), [8, 8 + fps * 1.6], [0, 5], limitar); gDavi = 'funda'; funda = interpolate(frame - desdeLinha(2), [fps * 1.6, fps * 3.2], [0, 1], limitar); }
		if (iLinha === 3) { luz = interpolate(frame - desdeLinha(3), [0, 20], [0, 1], limitar); gDavi = 'cima'; }
	} else if (historia === 'gigante') {
		const entra = interpolate(frame - desdeLinha(0), [0, fps * 1.2], [0, 1], limitar);
		const tiro = desdeLinha(2) + Math.round(fps * 1.1);
		const pedra = interpolate(frame, [tiro, tiro + 14], [0, 1], limitar);
		const queda = spring({frame: frame - tiro - 14, fps, config: {damping: 14, mass: 1.4}});
		golias = {x: interpolate(entra, [0, 1], [2400, 1450]), queda, grito: iLinha === 0 && frame - desdeLinha(0) > fps * 0.8 ? canta : 0, tonto: iLinha >= 3 ? 1 : queda > 0.9 ? 1 : 0, pedra};
		planos = [{z: 0.88, x: 1150, y: 470}, {z: 1.55, x: 660, y: 600}, {z: 0.86, x: 1180, y: 500}, {z: 0.9, x: 1160, y: 520}];
		if (iLinha === 1) gDavi = 'ora';
		if (iLinha === 2) { gDavi = 'funda'; funda = interpolate(frame, [tiro - fps, tiro], [0, 1], limitar); }
		if (iLinha === 3) gDavi = 'comemora';
	} else if (historia === 'objetos') {
		planos = [{z: 1.5, x: 960, y: 560}, {z: 1.15, x: 860, y: 560}, {z: 1.5, x: 1060, y: 560}, {z: 1, x: 960, y: 540}];
	} else if (festa) {
		planos = [LARGO, {z: 1.3, x: 760, y: 600}, {z: 1.3, x: 1180, y: 600}, {z: 1.08, x: 960, y: 560}];
	}

	// Câmera: corta a cada linha cantada, com aproximação suave e um pulinho no bumbo
	const alvo = planos[Math.min(iLinha, planos.length - 1)];
	const antes = planos[Math.max(0, Math.min(iLinha - 1, planos.length - 1))];
	const mov = iLinha === 0 ? 1 : spring({frame: frame - desdeLinha(iLinha), fps, config: {damping: 20, mass: 0.8}});
	const tremor = golias ? (interpolate(frame - desdeLinha(0), [0, fps * 1.2], [1, 0], limitar) * (iLinha === 0 ? 1 : 0) + interpolate(golias.queda, [0.85, 1], [0, 1], limitar) * interpolate(frame - desdeLinha(2) - fps * 2, [0, 15], [1, 0], limitar)) : 0;
	let z = interpolate(mov, [0, 1], [antes.z, alvo.z]) * (1 + batida * 0.012) * interpolate(frame - desde, [0, ate - desde], [1, 1.04], limitar);
	let cx = interpolate(mov, [0, 1], [antes.x, alvo.x]) + Math.sin(frame * 2.1) * 14 * tremor;
	const cy = interpolate(mov, [0, 1], [antes.y, alvo.y]) + Math.cos(frame * 2.7) * 10 * tremor;
	if (vertical) { z *= 1.15; cx = Math.min(1920 - W / 2 / z, Math.max(W / 2 / z, cx)); }

	const bocaDavi = parte.tipo === 'verso' && golias?.grito ? 0 : canta;
	const coro = festa || parte.tipo === 'intro' ? canta : 0;
	const entrada = (k: number) => (parte.tipo === 'intro' ? spring({frame: frame - desde - 20 - k * 12, fps, config: {damping: 10}}) : 1);
	const pDavi = pose(c, gDavi, energia, 0, bocaDavi);
	const pLulu = pose(c, festa ? g : 'leve', energia, 3, coro);
	const pLeleco = pose(c, festa ? g : historia === 'gigante' && iLinha === 3 ? 'comemora' : 'leve', energia, 6, coro);
	const xs = golias ? [640, 900, 300] : [960, 600, 1330];
	const palco = festa ? interpolate(frame - desde, [0, 10], [0, 1], limitar) : 0;
	// Troca de parte: íris (círculo) fechando e abrindo, como nos desenhos clássicos
	const prox = Math.round((clipe.partes[iParte + 1]?.de ?? 1e9) * fps);
	const iris = Math.min(interpolate(frame - desde, [0, 9], [0, 1], limitar), interpolate(prox - frame, [0, 9], [0, 1], limitar));
	const clarao = parte.tipo === 'refrao' ? interpolate(frame - desde, [0, 8], [0.6, 0], limitar) : 0;
	const pedraXY = golias ? [interpolate(golias.pedra, [0, 1], [xs[0] + 80, golias.x - 10]), 640 - Math.sin(Math.PI * golias.pedra) * 260 - golias.pedra * 120] : [0, 0];

	return (
		<AbsoluteFill style={{background: ROXO, overflow: 'hidden'}}>
			<svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
				<g transform={`translate(${W / 2} ${H / 2}) scale(${z}) translate(${-cx} ${-cy})`}>
					<Cenario c={c} palco={palco} noite={golias && golias.queda < 0.5 && iLinha < 2 ? 1 : 0} luz={luz} />
					{golias && (
						<g transform={`translate(${golias.x} 900) rotate(${golias.queda * 78}) translate(0 0)`}>
							<Corpo x={0} y={0} escala={1.55} sombra={110} p={{...pose(c, 'leve', 0.5, 9, golias.grito), bracoE: golias.grito ? 70 : 20, bracoD: golias.grito ? 70 : 20, cabeca: golias.queda * -10}}>
								<Golias p={{...pose(c, 'leve', 0.5, 9, golias.grito), bracoE: golias.grito ? 70 : 20, bracoD: golias.grito ? 70 : 20}} tonto={golias.tonto} frame={frame} />
							</Corpo>
						</g>
					)}
					{golias && golias.pedra > 0 && golias.pedra < 1 && <circle cx={pedraXY[0]} cy={pedraXY[1]} r={16} fill="#9aa5b1" {...TRACO} strokeWidth={4} />}
					{golias && golias.pedra >= 1 && golias.queda < 0.6 && (
						<text x={golias.x - 40} y={380} fontSize={120} fontFamily={TITULO} fill="#ffd43b" stroke={ROXO} strokeWidth={10} paintOrder="stroke" textAnchor="middle"
							transform={`rotate(-10 ${golias.x - 40} 380)`}>POF!</text>
					)}
					<g transform={`translate(0 ${(1 - entrada(1)) * 500})`}><Corpo x={xs[1]} y={930} escala={1.35} p={pLulu} sombra={80}><Lulu p={pLulu} /></Corpo></g>
					<g transform={`translate(0 ${(1 - entrada(2)) * 500})`}><Corpo x={xs[2]} y={925} escala={1.4} p={pLeleco}><Leleco p={pLeleco} /></Corpo></g>
					<g transform={`translate(0 ${(1 - entrada(0)) * 500})`}>
						<Corpo x={xs[0]} y={940} escala={1.5} p={pDavi}><Davi p={pDavi} funda={funda} coracao={coracao} /></Corpo>
					</g>
					{pedras > 0 && Array.from({length: Math.ceil(pedras)}, (_, k) => {
						const e = Math.min(1, pedras - k) ;
						return <ellipse key={k} cx={xs[0] + 150 + k * 55} cy={900 - Math.abs(Math.sin(Math.PI * e)) * 60} rx={26 * e} ry={19 * e} fill="#adb5bd" {...TRACO} strokeWidth={4} />;
					})}
					{historia === 'objetos' && parte.emojis.slice(0, Math.min(parte.emojis.length, iLinha + 1)).map((nome, k) => {
						const e = spring({frame: frame - desdeLinha(k), fps, config: {damping: 9}});
						const px = [700, 1220, 960][k % 3], py = [330, 300, 210][k % 3] + Math.sin((frame + k * 25) / 16) * 14;
						return (
							<g key={k} transform={`translate(${px} ${py}) scale(${e * (1 + batida * 0.06)}) rotate(${Math.sin((frame + k * 30) / 20) * 8})`}>
								<circle r={112} fill="#fff" opacity={0.55} />
								<image href={staticFile(`emoji/${nome.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.png`)} x={-90} y={-90} width={180} height={180} />
							</g>
						);
					})}
					<Notas x={xs[0]} y={330} frame={frame} ativo={bocaDavi > 0 ? 1 : 0} />
				</g>
			</svg>
			<AbsoluteFill style={{background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(20,10,50,.35) 100%)'}} />
			{parte.tipo === 'refrao' && parte.frase && <Frase texto={parte.frase} desde={desde} pulso={batida} />}
			{parte.tipo === 'intro' || parte.tipo === 'final' ? <Titulo titulo={clipe.titulo} desde={desde} ate={Math.min(ate, desde + fps * 3)} /> : <Selo />}
			<Karaoke linhas={clipe.linhas} />
			<AbsoluteFill style={{background: '#fff', opacity: clarao}} />
			{iris < 1 && (
				<svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
					<defs><mask id="iris"><rect width={W} height={H} fill="#fff" /><circle cx={W / 2} cy={H / 2} r={Math.hypot(W, H) * 0.55 * iris} fill="#000" /></mask></defs>
					<rect width={W} height={H} fill={ROXO} mask="url(#iris)" />
				</svg>
			)}
		</AbsoluteFill>
	);
};
