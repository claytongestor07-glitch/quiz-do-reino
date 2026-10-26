import React from 'react';
import {Img, staticFile, useCurrentFrame} from 'remotion';

export type Humor = 'normal' | 'feliz' | 'pensando';

// Abertura da boca (0–1) no quadro atual, a partir do volume da fala calculado em scripts/narrar.mjs.
export const useBoca = (boca: number[] | undefined, atraso = 0) => {
	const frame = useCurrentFrame();
	return boca?.[frame - atraso] ?? 0;
};

const useCorpo = (humor: Humor, fase: number) => {
	const frame = useCurrentFrame();
	const balanco = Math.sin((frame + fase) / 11) * 6;
	const pulo = humor === 'feliz' ? -Math.abs(Math.sin((frame + fase) / 6)) * 34 : 0;
	const piscando = (frame + fase) % 95 >= 91;
	const inclinacao = humor === 'pensando' ? Math.sin(frame / 20) * 4 - 4 : Math.sin((frame + fase) / 23) * 2;
	return {y: balanco + pulo, piscando, inclinacao};
};

const Olho: React.FC<{x: number; y: number; piscando: boolean; olhar?: number}> = ({x, y, piscando, olhar = 0}) => (
	<g transform={`translate(${x} ${y}) scale(1 ${piscando ? 0.1 : 1})`}>
		<ellipse rx={15} ry={18} fill="#fff" />
		<circle cx={olhar * 4} cy={2} r={10} fill="#2b2240" />
		<circle cx={olhar * 4 + 4} cy={-3} r={3.5} fill="#fff" />
	</g>
);

const Boca: React.FC<{x: number; y: number; abertura: number; humor: Humor}> = ({x, y, abertura, humor}) =>
	abertura > 0.06 ? (
		<g transform={`translate(${x} ${y})`}>
			<ellipse rx={13 + abertura * 4} ry={3 + abertura * 15} fill="#8a1c3a" />
			<ellipse cy={2 + abertura * 8} rx={8} ry={2 + abertura * 5} fill="#ff7b9c" />
		</g>
	) : (
		<path d={humor === 'feliz' ? `M ${x - 18} ${y - 4} Q ${x} ${y + 20} ${x + 18} ${y - 4} Z` : `M ${x - 15} ${y} Q ${x} ${y + 12} ${x + 15} ${y}`}
			fill={humor === 'feliz' ? '#8a1c3a' : 'none'} stroke="#8a1c3a" strokeWidth={5} strokeLinecap="round" />
	);

// Personagens 3D recortados da arte do canal (public/personagens/, gerados por scripts/recortar.py):
// Davi com a ovelhinha Lulu (a narradora) e o leão Leleco. Fala = boca da timeline vira um "quique" de voz.
const Recorte: React.FC<{arquivo: string; largura: number; altura: number; humor: Humor; boca: number; fase: number; espelhar?: boolean}> = ({arquivo, largura, altura, humor, boca, fase, espelhar}) => {
	const c = useCorpo(humor, fase);
	const fala = boca > 0.06 ? boca : 0;
	return (
		<div style={{position: 'relative', width: largura, height: altura}}>
			<Img src={staticFile(`personagens/${arquivo}`)} style={{position: 'absolute', left: 0, bottom: 0, width: largura,
				transform: `translateY(${c.y - fala * 12}px) rotate(${c.inclinacao}deg) scale(${(1 + fala * 0.03) * (espelhar ? -1 : 1)}, ${1 + fala * 0.06})`,
				transformOrigin: '50% 100%', filter: 'drop-shadow(0 12px 14px rgba(0,0,0,.25))'}} />
		</div>
	);
};

// Davi e Lulu juntos (a narradora é a Lulu): mesma área de antes (300x360 por escala), um pouco mais larga.
export const Lulu: React.FC<{boca?: number; humor?: Humor; escala?: number; espelhar?: boolean}> = ({boca = 0, humor = 'normal', escala = 1, espelhar}) => (
	<Recorte arquivo="davi-lulu.png" largura={430 * escala} altura={360 * escala} humor={humor} boca={boca} fase={0} espelhar={espelhar} />
);

// Leleco, o leãozinho corajoso.
export const Leleco: React.FC<{boca?: number; humor?: Humor; escala?: number}> = ({boca = 0, humor = 'normal', escala = 1}) => (
	<Recorte arquivo="leleco.png" largura={300 * escala} altura={360 * escala} humor={humor} boca={boca} fase={37} />
);

// Arca de Noé (cenário do episódio 1; reutilizável em outros temas de Noé).
export const Arca: React.FC<{largura?: number}> = ({largura = 520}) => {
	const frame = useCurrentFrame();
	return (
		<svg width={largura} height={largura * 0.62} viewBox="0 0 520 320" style={{overflow: 'visible'}}>
			<g transform={`translate(0 ${Math.sin(frame / 14) * 7}) rotate(${Math.sin(frame / 19) * 2} 260 220)`}>
				<rect x={150} y={70} width={220} height={110} rx={10} fill="#f2c27b" stroke="#a8692e" strokeWidth={6} />
				<path d="M 130 78 L 260 18 L 390 78 Z" fill="#d9534f" stroke="#a33a36" strokeWidth={6} strokeLinejoin="round" />
				{[190, 260, 330].map((x) => <rect key={x} x={x - 22} y={100} width={44} height={40} rx={8} fill="#7cc8ff" stroke="#a8692e" strokeWidth={5} />)}
				<path d="M 20 170 L 500 170 Q 470 285 380 290 L 140 290 Q 50 285 20 170 Z" fill="#b8742f" stroke="#7a4a1c" strokeWidth={7} />
				{[200, 235, 268].map((y) => <path key={y} d={`M ${30 + (y - 170) / 3} ${y} L ${490 - (y - 170) / 3} ${y}`} stroke="#8f5822" strokeWidth={4} />)}
				<circle cx={215} cy={92} r={12} fill="#fff" /><circle cx={330} cy={92} r={10} fill="#ffcf5a" />
			</g>
			<path d={`M -40 ${290 + Math.sin(frame / 9) * 6} Q 60 ${270 + Math.sin(frame / 9) * 6} 130 290 T 260 290 T 390 290 T 560 290 L 560 330 L -40 330 Z`} fill="#4dabf7" opacity={0.9} />
		</svg>
	);
};
