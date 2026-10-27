import React from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, type CalculateMetadataFunction} from 'remotion';
import {Raios, TITULO} from './Speed';

// Clipe musical (formato inspirado no canal Bento e Totó): música cantada de 2–3 min com Davi, Lulu e Leleco dançando.
// Dados em public/clipe/<id>/clipe.json, gerado por scripts/clipe.mjs: a "batida" (0–1 por quadro) vem da própria música,
// então a dança acompanha o ritmo real. O áudio é mixado depois com o FFmpeg do sistema (como nos episódios).
export type Parte = {de: number; tipo: 'intro' | 'verso' | 'refrao' | 'final'; emojis: string[]; frase?: string};
export type Clipe = {id: string; titulo: string; totalFrames: number; batida: number[]; partes: Parte[]};
export type PropsClipe = {id: string; clipe?: Clipe};

export const carregarClipe: CalculateMetadataFunction<PropsClipe> = async ({props}) => {
	const clipe: Clipe = props.clipe ?? (await (await fetch(staticFile(`clipe/${props.id}/clipe.json`))).json());
	return {durationInFrames: clipe.totalFrames, props: {...props, clipe}};
};

const PALETAS: [string, string][] = [['#ff7a1a', '#ff9a3c'], ['#2f6fe4', '#4d8cff'], ['#e8336d', '#ff5a8a'], ['#17c3a5', '#3fdcc0'], ['#7b3fe4', '#9a66ff'], ['#1fb35a', '#3fd17a']];
const contorno = (px: number, cor = '#2b1d5c') => ({WebkitTextStroke: `${px}px ${cor}`, paintOrder: 'stroke fill' as const});
const arquivoEmoji = (nome: string) => `emoji/${nome.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.png`;
const aleatorio = (k: number) => {
	const x = Math.sin(k * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};

// Batida suavizada: sobe na hora do bumbo e cai devagar (evita tremedeira)
const useBatida = (batida: number[]) => {
	const f = useCurrentFrame();
	return Math.max(batida[f] ?? 0, (batida[f - 1] ?? 0) * 0.8, (batida[f - 2] ?? 0) * 0.6);
};

const parteAtual = (c: Clipe, s: number) => {
	let k = 0;
	c.partes.forEach((p, i) => { if (s >= p.de) k = i; });
	return k;
};

// Personagens da arte dos clipes (docs/arte/clipe.webp, recortados por scripts/recortar_clipe.py)
const FIGURA = {davi: ['davi-violao.png', 872], menina: ['menina.png', 500], leleco: ['leleco.png', 483], biblia: ['biblia.png', 809]} as const;
const Figura: React.FC<{nome: keyof typeof FIGURA; escala: number}> = ({nome, escala}) => (
	<Img src={staticFile(`personagens/clipe/${FIGURA[nome][0]}`)} style={{width: FIGURA[nome][1] * escala, display: 'block', filter: 'drop-shadow(0 14px 16px rgba(0,0,0,.28))'}} />
);

// Cenário da arte (castelo, cascata e notas) com zoom lento; desfocado de leve para destacar os personagens
const Cenario: React.FC = () => {
	const frame = useCurrentFrame();
	return (
		<AbsoluteFill style={{overflow: 'hidden'}}>
			<Img src={staticFile('personagens/clipe/cenario.jpg')} style={{width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(3px) saturate(1.15)',
				transform: `scale(${1.08 + Math.sin(frame / 240) * 0.04}) translateX(${Math.sin(frame / 300) * 20}px)`}} />
		</AbsoluteFill>
	);
};

// Emojis do tema flutuando e pulando no ritmo
const Emojis: React.FC<{nomes: string[]; pulso: number; semente: number}> = ({nomes, pulso, semente}) => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const vertical = height > width;
	const pos = vertical
		? [[0.18, 0.12], [0.82, 0.14], [0.12, 0.42], [0.88, 0.44], [0.5, 0.06]]
		: [[0.08, 0.16], [0.92, 0.18], [0.2, 0.08], [0.8, 0.07], [0.05, 0.55], [0.95, 0.58]];
	return (
		<>
			{pos.map(([x, y], k) => {
				const nome = nomes[k % nomes.length];
				const t = frame + k * 17;
				const tam = (vertical ? 190 : 170) * (1 + pulso * 0.18);
				return (
					<Img key={k} src={staticFile(arquivoEmoji(nome))} style={{position: 'absolute', width: tam, height: tam, left: x * width - tam / 2,
						top: y * height - tam / 2 + Math.sin(t / 13) * 22, transform: `rotate(${Math.sin((t + semente) / 19) * 14}deg)`,
						filter: 'drop-shadow(0 10px 12px rgba(0,0,0,.25))'}} />
				);
			})}
		</>
	);
};

// Confete e estrelas caindo
const Confete: React.FC<{pulso: number}> = ({pulso}) => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const cores = ['#ffd43b', '#ff6b6b', '#4dabf7', '#69db7c', '#fff', '#da77f2'];
	return (
		<>
			{Array.from({length: 36}, (_, k) => {
				const vel = 2 + aleatorio(k) * 3;
				const y = ((frame * vel + aleatorio(k + 9) * height) % (height + 80)) - 40;
				const x = aleatorio(k + 3) * width + Math.sin((frame + k * 20) / 25) * 30;
				const estrela = k % 4 === 0;
				return estrela
					? <div key={k} style={{position: 'absolute', left: x, top: y, fontSize: 40 * (1 + pulso * 0.5), color: '#ffe066', opacity: 0.9}}>★</div>
					: <div key={k} style={{position: 'absolute', left: x, top: y, width: 16, height: 24, borderRadius: 4, background: cores[k % cores.length], transform: `rotate(${frame * (k % 2 ? 6 : -6) + k * 40}deg)`}} />;
			})}
		</>
	);
};

// Palco com luzes que piscam na batida
const Palco: React.FC<{pulso: number; cor: string}> = ({pulso, cor}) => {
	const {width, height} = useVideoConfig();
	const frame = useCurrentFrame();
	const topo = height * (height > width ? 0.78 : 0.86);
	return (
		<>
			<div style={{position: 'absolute', left: -width * 0.1, width: width * 1.2, top: topo, height: height, borderRadius: '50% 50% 0 0', background: `linear-gradient(${cor}, #2b1d5c)`, boxShadow: '0 -10px 40px rgba(0,0,0,.25)'}} />
			{Array.from({length: 9}, (_, k) => {
				const acesa = (Math.floor(frame / 8) + k) % 3 === 0;
				return <div key={k} style={{position: 'absolute', top: topo + 18, left: width * (0.08 + k * 0.105), width: 26, height: 26, borderRadius: 13,
					background: acesa ? '#ffe066' : '#fff', opacity: acesa ? 0.6 + pulso * 0.4 : 0.35, boxShadow: acesa ? '0 0 24px #ffe066' : 'none'}} />;
			})}
		</>
	);
};

// Personagens dançando: pulam no bumbo e balançam de um lado para o outro
const Dancarino: React.FC<{children: React.ReactNode; pulso: number; fase: number; x: number; base: number}> = ({children, pulso, fase, x, base}) => {
	const frame = useCurrentFrame();
	const balanco = Math.sin((frame + fase) / 9);
	return (
		<div style={{position: 'absolute', left: x, bottom: base, transform: `translateX(-50%) translateY(${-pulso * 46}px) rotate(${balanco * 7}deg) scale(${1 + pulso * 0.05}, ${1 - pulso * 0.04})`, transformOrigin: '50% 100%'}}>
			{children}
		</div>
	);
};

// Frase do refrão, palavra por palavra, quicando na batida
const Frase: React.FC<{texto: string; pulso: number; desde: number}> = ({texto, pulso, desde}) => {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const vertical = height > width;
	const palavras = texto.split(' ');
	return (
		<div style={{position: 'absolute', top: vertical ? height * 0.2 : height * 0.06, width: '100%', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 26px', padding: '0 60px', boxSizing: 'border-box'}}>
			{palavras.map((p, k) => {
				const s = spring({frame: frame - desde - k * 4, fps, config: {damping: 9, mass: 0.6}});
				return <span key={k} style={{fontFamily: TITULO, fontSize: (vertical ? 120 : 118) * (1 + pulso * 0.06), color: ['#ffd43b', '#fff', '#69db7c', '#ff8fab'][k % 4], ...contorno(16),
					transform: `scale(${s}) rotate(${(k % 2 ? 1 : -1) * 4}deg)`, display: 'inline-block', textShadow: '0 10px 0 rgba(0,0,0,.2)'}}>{p}</span>;
			})}
		</div>
	);
};

// Título da música na abertura e no final
const Titulo: React.FC<{titulo: string; desde: number}> = ({titulo, desde}) => {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const vertical = height > width;
	const s = spring({frame: frame - desde, fps, config: {damping: 10}});
	return (
		<AbsoluteFill style={{alignItems: 'center', justifyContent: vertical ? 'flex-start' : 'center', paddingTop: vertical ? height * 0.16 : 0}}>
			<div style={{transform: `scale(${s}) rotate(-3deg)`, textAlign: 'center', marginTop: vertical ? 0 : -height * 0.28}}>
				<div style={{fontFamily: TITULO, fontSize: 64, color: '#fff', ...contorno(10), letterSpacing: 2}}>QUIZ DO REINO 👑</div>
				<div style={{fontFamily: TITULO, fontSize: vertical ? 120 : 140, lineHeight: 1, color: '#ffd43b', ...contorno(20), maxWidth: width * 0.86, textShadow: '0 12px 0 rgba(0,0,0,.25)'}}>{titulo}</div>
			</div>
		</AbsoluteFill>
	);
};

export const Clipe: React.FC<PropsClipe> = ({clipe}) => {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const pulso = useBatida(clipe?.batida ?? []);
	if (!clipe) return null;
	const k = parteAtual(clipe, frame / fps);
	const parte = clipe.partes[k];
	const desde = Math.round(parte.de * fps);
	const [c1, c2] = PALETAS[k % PALETAS.length];
	const vertical = height > width;
	const entrada = interpolate(frame - desde, [0, 8], [1.15, 1], {extrapolateRight: 'clamp'});
	const refrao = parte.tipo === 'refrao';
	return (
		<AbsoluteFill style={{overflow: 'hidden'}}>
			<AbsoluteFill style={{transform: `scale(${(1 + pulso * 0.025) * entrada})`}}>
				{refrao ? <Raios cor1={c1} cor2={c2} giro={0.4 + pulso * 0.3} /> : <Cenario />}
			</AbsoluteFill>
			<Confete pulso={pulso} />
			<Emojis nomes={parte.emojis} pulso={pulso} semente={k * 31} />
			{refrao && <Palco pulso={pulso} cor={c2} />}
			<Dancarino pulso={pulso} fase={0} x={vertical ? width * 0.45 : width * 0.25} base={vertical ? height * 0.36 : height * 0.06}>
				<Figura nome="davi" escala={vertical ? 1.05 : 0.82} />
			</Dancarino>
			<Dancarino pulso={pulso} fase={15} x={vertical ? width * 0.7 : width * 0.56} base={vertical ? height * 0.08 : height * 0.08}>
				<Figura nome="menina" escala={vertical ? 1.2 : 1.12} />
			</Dancarino>
			<Dancarino pulso={pulso} fase={30} x={vertical ? width * 0.25 : width * 0.82} base={vertical ? height * 0.07 : height * 0.04}>
				<Figura nome="leleco" escala={vertical ? 1.1 : 1.05} />
			</Dancarino>
			{!vertical && <div style={{position: 'absolute', left: width * 0.5, bottom: -20, transform: `translateX(-50%) scale(${1 + pulso * 0.03})`}}><Figura nome="biblia" escala={0.85} /></div>}
			{parte.tipo === 'refrao' && parte.frase && <Frase texto={parte.frase} pulso={pulso} desde={desde} />}
			{(parte.tipo === 'intro' || parte.tipo === 'final') && <Titulo titulo={clipe.titulo} desde={desde} />}
			{/* Flash branco curto na troca de parte */}
			<AbsoluteFill style={{background: '#fff', opacity: interpolate(frame - desde, [0, 6], [k ? 0.5 : 0, 0], {extrapolateRight: 'clamp'})}} />
		</AbsoluteFill>
	);
};

// Miniatura no estilo dos canais de clipes: título enorme, personagens e emojis
export const MiniaturaClipe: React.FC<PropsClipe> = ({clipe}) => {
	if (!clipe) return null;
	const emojis = [...new Set(clipe.partes.flatMap((p) => p.emojis))].slice(0, 4);
	return (
		<AbsoluteFill>
			<Cenario />
			<div style={{position: 'absolute', top: 40, width: '100%', textAlign: 'center', fontFamily: TITULO, fontSize: 170, lineHeight: 0.95, color: '#ffd43b', ...contorno(24), textShadow: '0 14px 0 rgba(0,0,0,.25)', transform: 'rotate(-3deg)', padding: '0 60px', boxSizing: 'border-box'}}>
				{clipe.titulo}
			</div>
			{emojis.map((e, k) => (
				<Img key={k} src={staticFile(arquivoEmoji(e))} style={{position: 'absolute', width: 200, height: 200, left: [60, 1660, 120, 1600][k], top: [520, 520, 820, 820][k], transform: `rotate(${k % 2 ? 12 : -12}deg)`, filter: 'drop-shadow(0 10px 12px rgba(0,0,0,.3))'}} />
			))}
			<div style={{position: 'absolute', left: 30, bottom: 10}}><Figura nome="davi" escala={1.05} /></div>
			<div style={{position: 'absolute', left: 900, bottom: 0}}><Figura nome="menina" escala={1.25} /></div>
			<div style={{position: 'absolute', left: 1380, bottom: 0}}><Figura nome="leleco" escala={1.1} /></div>
		</AbsoluteFill>
	);
};
