import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, type CalculateMetadataFunction} from 'remotion';
import {TITULO} from './Speed';
import {carregarFonte} from './tema';

// Clipe musical (formato inspirado no canal Bento e Totó), com acabamento de canal profissional:
// - cenas animadas da arte do canal (public/cenas/<cena>.mp4, Wan 2.2 no Kaggle) cortadas no bumbo, com câmera lenta;
//   sem o vídeo da cena, usa o recorte da arte (public/personagens/clipe/arte.webp) com o mesmo movimento de câmera;
// - letra em karaokê, palavra por palavra no tempo da voz (musicas/<id>/palavras.json, Whisper);
// - abertura com título, frase do refrão em destaque, adesivos do tema e selo do canal.
// Dados em public/clipe/<id>/clipe.json, gerado por scripts/clipe.mjs. O áudio é mixado depois com o FFmpeg do sistema.
export type Parte = {de: number; tipo: 'intro' | 'verso' | 'refrao' | 'ponte' | 'final'; emojis: string[]; frase?: string};
export type Palavra = {p: string; de: number; ate: number};
export type Linha = {parte: number; de: number; ate: number; palavras: Palavra[]};
export type Tomada = {de: number; cena: string; video: boolean};
export type Cena = {recorte: [number, number, number]; foco: number};
export type Clipe = {id: string; titulo: string; totalFrames: number; batida: number[]; bpm?: number; inicioBatida?: number; roteiro?: string; partes: Parte[]; linhas: Linha[]; tomadas: Tomada[]; cenas: Record<string, Cena>};
export type PropsClipe = {id: string; clipe?: Clipe};

export const carregarClipe: CalculateMetadataFunction<PropsClipe> = async ({props}) => {
	const clipe: Clipe = props.clipe ?? (await (await fetch(staticFile(`clipe/${props.id}/clipe.json`))).json());
	return {durationInFrames: clipe.totalFrames, props: {...props, clipe}};
};

const LETRA = carregarFonte('Fredoka', 'fontes/fredoka.woff2', '600');
const ROXO = '#2b1d5c';
const AMARELO = '#ffd43b';
const contorno = (px: number, cor = ROXO) => ({WebkitTextStroke: `${px}px ${cor}`, paintOrder: 'stroke fill' as const});
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
const indiceEm = <T extends {de: number}>(lista: T[], s: number) => {
	let k = -1;
	lista.forEach((x, i) => { if (s >= x.de) k = i; });
	return k;
};

// Uma tomada: vídeo da cena (ou recorte da arte) enquadrado para 16:9 ou 9:16, com aproximação lenta da câmera
const Tomada: React.FC<{tomada: Tomada; cena: Cena; quadros: number; pulso: number}> = ({tomada, cena, quadros, pulso}) => {
	const frame = useCurrentFrame(); // relativo ao início da tomada (Sequence)
	const {width: W, height: H} = useVideoConfig();
	const zoom = interpolate(frame, [0, quadros], [1.02, 1.09]) * (1 + pulso * 0.012);
	const deriva = interpolate(frame, [0, quadros], [-1, 1]) * W * 0.008;
	let midia: React.ReactNode;
	if (tomada.video) {
		// Cena animada 832x480 (16:9). No vertical: a cena larga no meio e uma cópia desfocada cobrindo o fundo
		const fonte = staticFile(`cenas/${tomada.cena}.mp4`);
		const ritmo = Math.min(1, 3.3 / (quadros / 30));
		const largura = H > W ? W * 1.75 : W;
		const esquerda = H > W ? Math.min(0, Math.max(W - largura, W / 2 - cena.foco * largura)) : 0;
		midia = (
			<>
				{H > W && <OffthreadVideo muted src={fonte} playbackRate={ritmo} style={{position: 'absolute', inset: 0, width: W, height: H, objectFit: 'cover', filter: 'blur(28px) brightness(.85)', transform: 'scale(1.15)'}} />}
				<OffthreadVideo muted src={fonte} playbackRate={ritmo} style={{position: 'absolute', left: esquerda, top: H > W ? H * 0.44 - (largura * 9) / 32 : 0, width: largura, height: (largura * 9) / 16}} />
			</>
		);
	} else {
		const [x, y, w] = cena.recorte;
		const h = (w * 9) / 16;
		// pixels por unidade da arte (1200 x 600); no vertical abre mais o quadro para não ficar só um rosto
		const k = H > W ? Math.max(H / 600, H / (h * 2.2)) : W / w;
		const esquerda = H > W ? Math.min(0, Math.max(W - 1200 * k, W / 2 - (x + w * cena.foco) * k)) : -x * k;
		const topo = H > W ? Math.min(0, Math.max(H - 600 * k, H / 2 - (y + h / 2) * k)) : -y * k;
		midia = <Img src={staticFile('personagens/clipe/arte.webp')} style={{position: 'absolute', left: esquerda, top: topo, width: 1200 * k}} />;
	}
	return (
		<AbsoluteFill style={{overflow: 'hidden', filter: 'saturate(1.08) contrast(1.04)'}}>
			<AbsoluteFill style={{transform: `translateX(${deriva}px) scale(${zoom})`}}>{midia}</AbsoluteFill>
		</AbsoluteFill>
	);
};

// Brilhos suaves subindo (só no refrão)
const Brilhos: React.FC<{pulso: number}> = ({pulso}) => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			{Array.from({length: 22}, (_, k) => {
				const vel = 1.2 + aleatorio(k) * 1.6;
				const y = height - ((frame * vel + aleatorio(k + 5) * height) % (height + 60));
				const x = aleatorio(k + 2) * width + Math.sin((frame + k * 30) / 30) * 24;
				const tam = 8 + aleatorio(k + 7) * 14;
				return <div key={k} style={{position: 'absolute', left: x, top: y, width: tam, height: tam, borderRadius: '50%',
					background: '#fff7cc', opacity: 0.35 + pulso * 0.35, boxShadow: `0 0 ${tam * 2}px #ffe066`}} />;
			})}
		</AbsoluteFill>
	);
};

// Letra em karaokê: a linha cantada num balão; cada palavra acende em amarelo no tempo da voz
export const Karaoke: React.FC<{linhas: Linha[]}> = ({linhas}) => {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const vertical = height > width;
	const s = frame / fps;
	const k = indiceEm(linhas, s - 0.25);
	if (k < 0) return null;
	const linha = linhas[k];
	const fim = Math.min((linhas[k + 1]?.de ?? Infinity) - 0.1, linha.ate + 1.2);
	if (s > fim) return null;
	const entra = spring({frame: frame - Math.round((linha.de - 0.25) * fps), fps, config: {damping: 14, mass: 0.6}});
	const sai = interpolate(s, [fim - 0.15, fim], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const tam = vertical ? 76 : 70;
	return (
		<div style={{position: 'absolute', left: 0, right: 0, bottom: vertical ? height * 0.2 : height * 0.07, display: 'flex', justifyContent: 'center',
			opacity: sai, transform: `translateY(${(1 - entra) * 40}px) scale(${0.9 + entra * 0.1})`}}>
			<div style={{maxWidth: width * (vertical ? 0.9 : 0.8), padding: vertical ? '22px 34px' : '18px 40px', borderRadius: 999, background: 'rgba(43,29,92,.72)',
				boxShadow: '0 12px 30px rgba(0,0,0,.3), inset 0 0 0 4px rgba(255,255,255,.18)', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 18px'}}>
				{linha.palavras.map((w, j) => {
					const cantada = s >= w.de;
					const ativa = cantada && s < w.ate + 0.05;
					const pulo = ativa ? spring({frame: frame - Math.round(w.de * fps), fps, config: {damping: 8, mass: 0.4}}) : 0;
					return <span key={j} style={{fontFamily: LETRA, fontWeight: 600, fontSize: tam, lineHeight: 1.25, color: cantada ? AMARELO : '#fff',
						display: 'inline-block', transform: `translateY(${-pulo * 8 + (ativa ? 8 : 0)}px) scale(${ativa ? 1.08 : 1})`, textShadow: '0 4px 0 rgba(0,0,0,.25)'}}>{w.p}</span>;
				})}
			</div>
		</div>
	);
};

// Frase do refrão em destaque por ~2,5 s no começo de cada refrão
export const Frase: React.FC<{texto: string; desde: number; pulso: number}> = ({texto, desde, pulso}) => {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const vertical = height > width;
	const t = frame - desde;
	if (t < 0 || t > fps * 2.6) return null;
	const sai = interpolate(t, [fps * 2.2, fps * 2.6], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return (
		<div style={{position: 'absolute', top: vertical ? height * 0.14 : height * 0.08, width: '100%', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 28px', opacity: sai}}>
			{texto.split(' ').map((p, k) => {
				const s = spring({frame: t - k * 5, fps, config: {damping: 10, mass: 0.6}});
				return <span key={k} style={{fontFamily: TITULO, fontSize: (vertical ? 128 : 124) * (1 + pulso * 0.04), color: k % 2 ? '#fff' : AMARELO, ...contorno(12),
					display: 'inline-block', transform: `scale(${s}) rotate(${(k % 2 ? 1 : -1) * 3}deg)`, filter: 'drop-shadow(0 10px 12px rgba(0,0,0,.35))'}}>{p}</span>;
			})}
		</div>
	);
};

// Adesivos do tema (emojis da parte) entrando nos cantos e balançando de leve
const Adesivos: React.FC<{nomes: string[]; desde: number; pulso: number}> = ({nomes, desde, pulso}) => {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const vertical = height > width;
	const tam = vertical ? 150 : 132;
	const lugares = vertical ? [[0.12, 0.3], [0.88, 0.33]] : [[0.06, 0.2], [0.94, 0.24]];
	return (
		<>
			{lugares.map(([x, y], k) => {
				const s = spring({frame: frame - desde - 6 - k * 6, fps, config: {damping: 9}});
				const nome = nomes[k % nomes.length];
				return <Img key={k} src={staticFile(arquivoEmoji(nome))} style={{position: 'absolute', width: tam, height: tam, left: x * width - tam / 2,
					top: y * height - tam / 2 + Math.sin((frame + k * 20) / 14) * 10, transform: `scale(${s * (1 + pulso * 0.08)}) rotate(${Math.sin((frame + k * 40) / 22) * 10}deg)`,
					filter: 'drop-shadow(0 8px 10px rgba(0,0,0,.3))'}} />;
			})}
		</>
	);
};

// Selo do canal no canto
export const Selo: React.FC = () => {
	const {width, height} = useVideoConfig();
	const vertical = height > width;
	return (
		<div style={{position: 'absolute', left: vertical ? 40 : 36, top: vertical ? 70 : 30, padding: '8px 22px', borderRadius: 999, background: 'rgba(43,29,92,.55)',
			fontFamily: TITULO, fontSize: 34, color: '#fff', letterSpacing: 1, boxShadow: 'inset 0 0 0 3px rgba(255,255,255,.2)'}}>
			👑 QUIZ DO REINO
		</div>
	);
};

// Abertura e final: logo e título da música
export const Titulo: React.FC<{titulo: string; desde: number; ate: number}> = ({titulo, desde, ate}) => {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const vertical = height > width;
	const s = spring({frame: frame - desde, fps, config: {damping: 11}});
	const s2 = spring({frame: frame - desde - 8, fps, config: {damping: 9}});
	const sai = interpolate(frame, [ate - 10, ate], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return (
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: sai, background: `radial-gradient(ellipse at center, rgba(43,29,92,${0.45 * s}) 0%, rgba(43,29,92,0) 70%)`}}>
			<div style={{textAlign: 'center', marginTop: vertical ? -height * 0.18 : -height * 0.06}}>
				<div style={{fontFamily: TITULO, fontSize: vertical ? 64 : 58, color: '#fff', letterSpacing: 3, ...contorno(8), transform: `scale(${s})`}}>👑 QUIZ DO REINO</div>
				<div style={{fontFamily: TITULO, fontSize: vertical ? 132 : 150, lineHeight: 1, color: AMARELO, ...contorno(16), maxWidth: width * 0.86,
					transform: `scale(${s2}) rotate(-2deg)`, filter: 'drop-shadow(0 14px 16px rgba(0,0,0,.4))'}}>{titulo}</div>
			</div>
		</AbsoluteFill>
	);
};

export const Clipe: React.FC<PropsClipe> = ({clipe}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const pulso = useBatida(clipe?.batida ?? []);
	if (!clipe) return null;
	const s = frame / fps;
	const k = Math.max(0, indiceEm(clipe.partes, s));
	const parte = clipe.partes[k];
	const desde = Math.round(parte.de * fps);
	const ate = Math.round((clipe.partes[k + 1]?.de ?? clipe.totalFrames / fps) * fps);
	const kt = Math.max(0, indiceEm(clipe.tomadas, s));
	const quadroDe = (i: number) => Math.round(clipe.tomadas[i].de * fps);
	const quadroAte = (i: number) => (clipe.tomadas[i + 1] ? quadroDe(i + 1) : clipe.totalFrames);
	const vinheta = parte.tipo === 'intro' || parte.tipo === 'final';
	// Troca de cena: dissolve curto; no início do refrão, clarão branco
	const dissolve = interpolate(frame - quadroDe(kt), [0, 5], [0, 1], {extrapolateRight: 'clamp'});
	const clarao = parte.tipo === 'refrao' ? interpolate(frame - desde, [0, 8], [0.7, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;
	return (
		<AbsoluteFill style={{background: ROXO, overflow: 'hidden'}}>
			{[kt - 1, kt].filter((i) => i >= 0).map((i) => (
				<Sequence key={i} from={quadroDe(i)} durationInFrames={quadroAte(i) - quadroDe(i) + 6} layout="none">
					<AbsoluteFill style={{opacity: i === kt && kt > 0 ? dissolve : 1}}>
						<Tomada tomada={clipe.tomadas[i]} cena={clipe.cenas[clipe.tomadas[i].cena]} quadros={quadroAte(i) - quadroDe(i)} pulso={pulso} />
					</AbsoluteFill>
				</Sequence>
			))}
			{/* Vinheta cinematográfica */}
			<AbsoluteFill style={{background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(20,10,50,.45) 100%)'}} />
			{parte.tipo === 'refrao' && <Brilhos pulso={pulso} />}
			{!vinheta && <Adesivos nomes={parte.emojis} desde={desde} pulso={pulso} />}
			{parte.tipo === 'refrao' && parte.frase && <Frase texto={parte.frase} desde={desde} pulso={pulso} />}
			{vinheta ? <Titulo titulo={clipe.titulo} desde={desde} ate={ate} /> : <Selo />}
			<Karaoke linhas={clipe.linhas} />
			<AbsoluteFill style={{background: '#fff', opacity: clarao}} />
		</AbsoluteFill>
	);
};

// Miniatura: arte completa do canal, título enorme com contorno e dois adesivos do tema
export const MiniaturaClipe: React.FC<PropsClipe> = ({clipe}) => {
	if (!clipe) return null;
	const emojis = [...new Set(clipe.partes.flatMap((p) => p.emojis))].slice(0, 2);
	return (
		<AbsoluteFill style={{overflow: 'hidden'}}>
			<Img src={staticFile('personagens/clipe/arte.webp')} style={{position: 'absolute', width: 1920, top: 1080 - 960, filter: 'saturate(1.1) contrast(1.05)'}} />
			<AbsoluteFill style={{background: 'linear-gradient(rgba(43,29,92,.65) 0%, rgba(43,29,92,0) 40%)'}} />
			<div style={{position: 'absolute', top: 36, width: '100%', textAlign: 'center', fontFamily: TITULO, fontSize: 176, lineHeight: 0.95, color: AMARELO, ...contorno(22),
				filter: 'drop-shadow(0 14px 14px rgba(0,0,0,.45))', transform: 'rotate(-2deg)', padding: '0 80px', boxSizing: 'border-box'}}>
				{clipe.titulo}
			</div>
			{emojis.map((e, k) => (
				<Img key={k} src={staticFile(arquivoEmoji(e))} style={{position: 'absolute', width: 190, height: 190, left: [40, 1690][k], top: 300, transform: `rotate(${k ? 12 : -12}deg)`, filter: 'drop-shadow(0 10px 12px rgba(0,0,0,.35))'}} />
			))}
		</AbsoluteFill>
	);
};
