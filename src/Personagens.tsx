import React from 'react';
import {useCurrentFrame} from 'remotion';

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

// Lulu, a ovelhinha curiosa (narradora).
export const Lulu: React.FC<{boca?: number; humor?: Humor; escala?: number; espelhar?: boolean}> = ({boca = 0, humor = 'normal', escala = 1, espelhar}) => {
	const c = useCorpo(humor, 0);
	const la = [[70, 170], [110, 140], [160, 128], [210, 140], [245, 175], [250, 225], [215, 262], [160, 272], [105, 262], [62, 225]];
	return (
		<svg width={300 * escala} height={360 * escala} viewBox="0 0 300 360" style={{overflow: 'visible'}}>
			<g transform={`translate(0 ${c.y}) rotate(${c.inclinacao} 150 300) ${espelhar ? 'translate(300 0) scale(-1 1)' : ''}`}>
				{[95, 130, 175, 210].map((x) => <rect key={x} x={x - 9} y={270} width={18} height={62} rx={9} fill="#5b4a5f" />)}
				{la.map(([x, y], k) => <circle key={k} cx={x} cy={y} r={46} fill="#ffffff" stroke="#e4e0f0" strokeWidth={4} />)}
				<circle cx={155} cy={205} r={78} fill="#ffffff" />
				<ellipse cx={92} cy={118} rx={34} ry={17} fill="#f6c6d2" transform="rotate(-25 92 118)" />
				<ellipse cx={208} cy={118} rx={34} ry={17} fill="#f6c6d2" transform="rotate(25 208 118)" />
				<ellipse cx={150} cy={130} rx={62} ry={70} fill="#fbe3d4" />
				{[[118, 64], [150, 54], [182, 64], [134, 74], [166, 74]].map(([x, y], k) => <circle key={k} cx={x} cy={y} r={22} fill="#fff" stroke="#e4e0f0" strokeWidth={3} />)}
				<Olho x={127} y={125} piscando={c.piscando} olhar={humor === 'pensando' ? 1 : 0} />
				<Olho x={173} y={125} piscando={c.piscando} olhar={humor === 'pensando' ? 1 : 0} />
				<circle cx={106} cy={156} r={11} fill="#ff9fb5" opacity={0.7} />
				<circle cx={194} cy={156} r={11} fill="#ff9fb5" opacity={0.7} />
				<ellipse cx={150} cy={150} rx={8} ry={5} fill="#c9849a" />
				<Boca x={150} y={172} abertura={boca} humor={humor} />
				<path d="M 128 190 Q 150 206 172 190 L 168 210 Q 150 220 132 210 Z" fill="#ff6b9a" />
			</g>
		</svg>
	);
};

// Leleco, o leãozinho corajoso.
export const Leleco: React.FC<{boca?: number; humor?: Humor; escala?: number}> = ({boca = 0, humor = 'normal', escala = 1}) => {
	const c = useCorpo(humor, 37);
	const juba = Array.from({length: 14}, (_, k) => {
		const a = (k / 14) * Math.PI * 2;
		return [150 + Math.cos(a) * 88, 135 + Math.sin(a) * 88];
	});
	return (
		<svg width={300 * escala} height={360 * escala} viewBox="0 0 300 360" style={{overflow: 'visible'}}>
			<g transform={`translate(0 ${c.y}) rotate(${-c.inclinacao} 150 300)`}>
				<path d="M 230 290 Q 285 280 278 230" stroke="#e8a33d" strokeWidth={12} fill="none" strokeLinecap="round" />
				<circle cx={278} cy={226} r={14} fill="#b8642a" />
				<ellipse cx={150} cy={278} rx={82} ry={62} fill="#ffc94d" />
				<ellipse cx={150} cy={290} rx={46} ry={36} fill="#fff1c9" />
				{[105, 195].map((x) => <ellipse key={x} cx={x} cy={334} rx={26} ry={16} fill="#ffc94d" />)}
				{juba.map(([x, y], k) => <circle key={k} cx={x} cy={y} r={40} fill={k % 2 ? '#d9772b' : '#c4622a'} />)}
				<circle cx={98} cy={72} r={22} fill="#ffc94d" /><circle cx={98} cy={72} r={11} fill="#ff9f68" />
				<circle cx={202} cy={72} r={22} fill="#ffc94d" /><circle cx={202} cy={72} r={11} fill="#ff9f68" />
				<circle cx={150} cy={135} r={76} fill="#ffcf5a" />
				<Olho x={124} y={118} piscando={c.piscando} olhar={humor === 'pensando' ? -1 : 0} />
				<Olho x={176} y={118} piscando={c.piscando} olhar={humor === 'pensando' ? -1 : 0} />
				<path d="M 110 96 Q 124 88 138 96 M 162 96 Q 176 88 190 96" stroke="#8a4a1f" strokeWidth={5} fill="none" strokeLinecap="round" />
				<ellipse cx={136} cy={162} rx={22} ry={17} fill="#fff4dc" />
				<ellipse cx={164} cy={162} rx={22} ry={17} fill="#fff4dc" />
				<path d="M 138 146 L 162 146 L 150 160 Z" fill="#6b3a1f" />
				<circle cx={100} cy={150} r={11} fill="#ff9f68" opacity={0.6} />
				<circle cx={200} cy={150} r={11} fill="#ff9f68" opacity={0.6} />
				<Boca x={150} y={184} abertura={boca} humor={humor} />
			</g>
		</svg>
	);
};

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
