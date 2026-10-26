// Formato "Adivinhe pelos Emojis" (estilo game show rápido): fundo de cor viva por desafio, cabeçalho com número,
// pistas em emojis 3D (Microsoft Fluent Emoji, MIT), barra de tempo e revelação em cartão.
// O mesmo visual serve ao formato "abc" (pergunta com alternativas A, B, C) e aos Shorts verticais.
import React from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Sequence} from 'remotion';
import {FONTE, aleatorio, carregarFonte, type Cena, type Timeline} from './tema';
import {Lulu, Leleco, useBoca} from './Personagens';

export const TITULO = carregarFonte('Lilita One', 'fontes/lilita.woff2');

const TINTA = '#24124f';
export const CORES = ['#17c3a5', '#2f6fe4', '#7b3fe4', '#1fb35a', '#ff7a1a', '#e8336d'];
export const corDe = (i: number) => CORES[i % CORES.length];
const arquivoEmoji = (nome: string) => `emoji/${nome.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.png`;

const contorno = (px: number, cor = TINTA): React.CSSProperties => ({WebkitTextStroke: `${px}px ${cor}`, paintOrder: 'stroke'});
const titulo: React.CSSProperties = {fontFamily: TITULO, color: '#fff', textTransform: 'uppercase', letterSpacing: 1};
const LETRAS = ['A', 'B', 'C'];
const COR_ALT = ['#ff5f5f', '#2f6fe4', '#f5b400'];
type QuizSpeed = {tipo?: string; chamada?: string; tema: string; icones?: string[]; perguntas: {pistas?: string[]; pergunta?: string; alternativas?: string[]; correta?: number; resposta?: string; explicacao: string; referencia: string}[]};
const ehAbc = (tl: Timeline) => (tl.quiz as unknown as QuizSpeed).tipo === 'abc';
const chamadaDe = (tl: Timeline) => (tl.quiz as unknown as QuizSpeed).chamada ?? (ehAbc(tl) ? 'Quiz Bíblico' : 'Adivinhe pelos emojis');
// Emojis de capa: "icones" do quiz (formato abc) ou as pistas do primeiro desafio (formato emoji)
const iconesDe = (tl: Timeline) => {
	const q = tl.quiz as unknown as QuizSpeed;
	return q.icones ?? q.perguntas[0].pistas ?? ['Open book', 'Red question mark'];
};
const unidade = (tl: Timeline) => (ehAbc(tl) ? 'perguntas' : 'desafios');

// Pergunta + alternativas (formato abc). revelar: mostra a certa em verde e apaga as outras.
const QuestaoABC: React.FC<{tl: Timeline; i: number; revelar?: boolean; visivel?: boolean; vertical?: boolean}> = ({tl, i, revelar, visivel, vertical}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const p = (tl.quiz as unknown as QuizSpeed).perguntas[i];
	const entrada = (k: number) => (visivel ? 1 : spring({frame: frame - 6 - k * 6, fps, config: {damping: 11}}));
	const destaque = revelar ? spring({frame: frame - 4, fps, config: {damping: 9}}) : 0;
	return (
		<div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: vertical ? 34 : 40, width: '100%'}}>
			<div style={{transform: `scale(${0.85 + entrada(0) * 0.15})`, opacity: Math.min(1, entrada(0) * 2), background: '#fff', borderRadius: 44, border: `9px solid ${TINTA}`, boxShadow: '0 12px 0 rgba(0,0,0,.2)',
				padding: vertical ? '34px 40px' : '30px 56px', maxWidth: vertical ? 960 : 1320, textAlign: 'center', fontFamily: FONTE, fontWeight: 700, fontSize: vertical ? 64 : 62, lineHeight: 1.15, color: TINTA}}>
				{p.pergunta}
			</div>
			<div style={{display: 'flex', flexDirection: vertical ? 'column' : 'row', gap: vertical ? 24 : 34, justifyContent: 'center', width: vertical ? 900 : 1500}}>
				{(p.alternativas ?? []).map((alt, k) => {
					const certa = p.correta === k;
					const e = entrada(k + 1);
					const apagar = revelar && !certa ? interpolate(frame, [4, 14], [1, 0.35], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1;
					const verde = revelar && certa && destaque > 0.05;
					return (
						<div key={k} style={{flex: 1, position: 'relative', display: 'flex', alignItems: 'center', gap: 22, background: '#fff', borderRadius: 36, padding: '20px 26px', minHeight: vertical ? 120 : 150,
							border: `9px solid ${verde ? '#1fb35a' : TINTA}`, boxShadow: `0 10px 0 ${verde ? '#13853f' : 'rgba(0,0,0,.2)'}`, opacity: apagar * Math.min(1, e * 2),
							transform: `translateY(${(1 - e) * 60}px) scale(${1 + (verde ? destaque * 0.08 : 0)})`}}>
							<div style={{...titulo, flex: 'none', width: 92, height: 92, borderRadius: 46, background: verde ? '#1fb35a' : COR_ALT[k], border: `6px solid ${TINTA}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 58, ...contorno(5)}}>{LETRAS[k]}</div>
							<span style={{fontFamily: FONTE, fontWeight: 700, fontSize: vertical ? 50 : 46, lineHeight: 1.1, color: TINTA}}>{alt}</span>
							{verde && <div style={{...titulo, position: 'absolute', top: -34, right: -22, width: 80, height: 80, borderRadius: 40, background: '#1fb35a', border: `6px solid ${TINTA}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52, transform: `scale(${destaque})`}}>✓</div>}
						</div>
					);
				})}
			</div>
		</div>
	);
};

export const Raios: React.FC<{cor1: string; cor2: string; giro?: number}> = ({cor1, cor2, giro = 0.25}) => {
	const frame = useCurrentFrame();
	return (
		<AbsoluteFill style={{background: cor1}}>
			<svg width="100%" height="100%" viewBox="-960 -540 1920 1080" preserveAspectRatio="xMidYMid slice">
				<g transform={`rotate(${frame * giro})`}>
					{Array.from({length: 18}, (_, k) => {
						const a1 = (k / 18) * Math.PI * 2;
						const a2 = ((k + 0.5) / 18) * Math.PI * 2;
						return <path key={k} d={`M 0 0 L ${Math.cos(a1) * 1600} ${Math.sin(a1) * 1600} L ${Math.cos(a2) * 1600} ${Math.sin(a2) * 1600} Z`} fill={cor2} />;
					})}
				</g>
				<circle r={420} fill="url(#brilho)" />
				<defs><radialGradient id="brilho"><stop offset="0" stopColor="#fff" stopOpacity={0.45} /><stop offset="1" stopColor="#fff" stopOpacity={0} /></radialGradient></defs>
			</svg>
		</AbsoluteFill>
	);
};

const FundoCor: React.FC<{cor: string}> = ({cor}) => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const desloca = (frame * 0.6) % 160;
	const cols = Math.ceil(width / 160) + 2;
	const linhas = Math.ceil(height / 160) + 2;
	return (
		<AbsoluteFill style={{background: cor}}>
			<div style={{position: 'absolute', inset: -160, transform: `translate(${desloca}px, ${desloca}px)`}}>
				{Array.from({length: cols * linhas}, (_, k) => {
					const x = (k % cols) * 160;
					const y = Math.floor(k / cols) * 160;
					return <div key={k} style={{position: 'absolute', left: x, top: y, fontFamily: TITULO, fontSize: 84, color: '#fff', opacity: 0.1, transform: `rotate(${(aleatorio(k) - 0.5) * 40}deg)`}}>{k % 3 === 0 ? '★' : '?'}</div>;
				})}
			</div>
			<AbsoluteFill style={{background: 'radial-gradient(circle at 50% 45%, rgba(255,255,255,.22), rgba(0,0,0,.18) 80%)'}} />
		</AbsoluteFill>
	);
};

const Laterais: React.FC = () => (
	<>
		{[0, 1].map((lado) => (
			<div key={lado} style={{...titulo, ...contorno(8), position: 'absolute', top: 540, [lado ? 'right' : 'left']: 78, fontSize: 46, color: '#ffd43b', whiteSpace: 'nowrap',
				transform: `translate(${lado ? '50%' : '-50%'}, -50%) rotate(${lado ? 90 : -90}deg) translateY(${lado ? -30 : -30}px)`, transformOrigin: 'center'}}>
				Quiz do Reino
			</div>
		))}
	</>
);

const Cabecalho: React.FC<{n: number; texto: string}> = ({n, texto}) => (
	<div style={{position: 'absolute', top: 34, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 26}}>
		<div style={{...titulo, width: 116, height: 116, borderRadius: 58, background: '#ff7a1a', border: `8px solid ${TINTA}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 62, ...contorno(6)}}>
			{String(n).padStart(2, '0')}
		</div>
		<div style={{...titulo, fontSize: 70, ...contorno(12)}}>{texto}</div>
	</div>
);

const Pistas: React.FC<{nomes: string[]; tamanho?: number; atraso?: number}> = ({nomes, tamanho = 340, atraso = 8}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	return (
		<div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: tamanho * 0.12}}>
			{nomes.map((nome, k) => {
				const s = spring({frame: frame - atraso - k * 12, fps, config: {damping: 9, mass: 0.7}});
				const flutua = Math.sin((frame + k * 20) / 14) * tamanho * 0.025;
				return (
					<React.Fragment key={k}>
						{k > 0 && <div style={{...titulo, fontSize: tamanho * 0.55, ...contorno(tamanho * 0.035), opacity: Math.min(1, s * 2), transform: `scale(${s})`}}>+</div>}
						<Img src={staticFile(arquivoEmoji(nome))} style={{width: tamanho, height: tamanho, transform: `translateY(${flutua}px) scale(${s}) rotate(${(1 - s) * -25}deg)`, filter: 'drop-shadow(0 18px 14px rgba(0,0,0,.28))'}} />
					</React.Fragment>
				);
			})}
		</div>
	);
};

const BarraTempo: React.FC<{restante: number; segundos?: number; largura?: number; base?: number}> = ({restante, segundos, largura = 1180, base = 46}) => {
	const urgente = restante < 0.35;
	return (
		<div style={{position: 'absolute', bottom: base, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18}}>
			<div style={{width: largura, height: 54, borderRadius: 30, background: TINTA, border: '7px solid #fff', overflow: 'hidden', boxShadow: '0 8px 0 rgba(0,0,0,.2)'}}>
				<div style={{width: `${restante * 100}%`, height: '100%', borderRadius: 24, background: urgente ? 'linear-gradient(#ff5f5f, #d6223b)' : 'linear-gradient(#ffe066, #ff9f1a)'}} />
			</div>
			{segundos !== undefined && (
				<div style={{...titulo, width: 96, height: 96, borderRadius: 48, background: urgente ? '#e8336d' : '#ffd43b', border: `7px solid ${TINTA}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 58, ...contorno(5)}}>{segundos}</div>
			)}
		</div>
	);
};

const Confete: React.FC = () => {
	const frame = useCurrentFrame();
	const cores = ['#ff6b6b', '#4dabf7', '#fcc419', '#51cf66', '#cc5de8', '#fff'];
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			{Array.from({length: 60}, (_, k) => {
				const x = aleatorio(k) * 1920 + Math.sin(frame / 8 + k) * 30;
				const y = -40 + frame * (10 + aleatorio(k + 50) * 8) - aleatorio(k + 99) * 260;
				return y > -40 && y < 1100 ? <div key={k} style={{position: 'absolute', left: x, top: y, width: 18, height: 28, borderRadius: 4, background: cores[k % 6], transform: `rotate(${frame * 9 + k * 40}deg)`}} /> : null;
			})}
		</AbsoluteFill>
	);
};

const Mascotes: React.FC<{boca?: number; humor?: 'normal' | 'feliz' | 'pensando'; escala?: number}> = ({boca = 0, humor = 'normal', escala = 0.62}) => (
	<>
		<div style={{position: 'absolute', left: 70, bottom: 120}}><Lulu boca={boca} humor={humor} escala={escala} /></div>
		<div style={{position: 'absolute', right: 70, bottom: 120}}><Leleco humor={humor} escala={escala} /></div>
	</>
);

const CenaNumero: React.FC<{cena: Cena}> = ({cena}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const s = spring({frame, fps, config: {damping: 8, mass: 0.6}});
	return (
		<AbsoluteFill>
			<Raios cor1="#ffc61a" cor2="#ffd84d" giro={1.2} />
			<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
				<div style={{...titulo, fontSize: 470, lineHeight: 1, color: '#eaf4ff', ...contorno(26, '#1f3c88'), transform: `scale(${s}) rotate(${(1 - s) * -30}deg)`}}>{(cena.i ?? 0) + 1}</div>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

const CenaDesafio: React.FC<{tl: Timeline; cena: Cena; cronometro?: boolean}> = ({tl, cena, cronometro}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const i = cena.i ?? 0;
	const p = tl.quiz.perguntas[i] as unknown as {pistas: string[]};
	const boca = useBoca(cena.boca, cena.atrasoAudio);
	const restante = cronometro ? Math.max(0, 1 - frame / (tl.tempoResposta * fps)) : 1;
	return (
		<AbsoluteFill>
			<FundoCor cor={corDe(i)} />
			<Laterais />
			<Cabecalho n={i + 1} texto={chamadaDe(tl)} />
			<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', paddingBottom: ehAbc(tl) ? 90 : 40}}>
				{ehAbc(tl) ? <QuestaoABC tl={tl} i={i} visivel={cronometro} /> : <Pistas nomes={p.pistas} tamanho={380} atraso={cronometro ? -100 : 8} />}
			</AbsoluteFill>
			<Mascotes boca={boca} humor={cronometro ? 'pensando' : 'normal'} />
			<BarraTempo restante={restante} segundos={cronometro ? Math.max(1, Math.ceil(tl.tempoResposta - frame / fps)) : undefined} />
		</AbsoluteFill>
	);
};

const CenaRevelacao: React.FC<{tl: Timeline; cena: Cena}> = ({tl, cena}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const i = cena.i ?? 0;
	const p = tl.quiz.perguntas[i] as unknown as {pistas: string[]; resposta: string; explicacao: string; referencia: string; pergunta?: string};
	const boca = useBoca(cena.boca, cena.atrasoAudio);
	const s = spring({frame, fps, config: {damping: 11}});
	const selo = spring({frame: frame - 10, fps, config: {damping: 8}});
	if (ehAbc(tl)) {
		const cartao = spring({frame: frame - 18, fps, config: {damping: 11}});
		return (
			<AbsoluteFill>
				<FundoCor cor={corDe(i)} />
				<Laterais />
				<Cabecalho n={i + 1} texto={chamadaDe(tl)} />
				<div style={{position: 'absolute', top: 175, left: 0, right: 0}}><QuestaoABC tl={tl} i={i} revelar visivel /></div>
				<div style={{position: 'absolute', top: 660, left: 330, right: 330, opacity: Math.min(1, cartao * 2), transform: `translateY(${(1 - cartao) * 50}px)`,
					background: '#fff', borderRadius: 40, border: `8px solid ${TINTA}`, padding: '22px 40px', textAlign: 'center', fontFamily: FONTE, fontWeight: 600, fontSize: 42, lineHeight: 1.22, color: TINTA}}>
					{p.explicacao}
					<div style={{marginTop: 12}}><span style={{...titulo, fontSize: 36, background: '#e8336d', borderRadius: 30, padding: '6px 28px', border: `5px solid ${TINTA}`, display: 'inline-block', transform: `scale(${selo})`, ...contorno(4)}}>📖 {p.referencia}</span></div>
				</div>
				<Mascotes boca={boca} humor="feliz" />
				<Sequence durationInFrames={70}><Confete /></Sequence>
			</AbsoluteFill>
		);
	}
	return (
		<AbsoluteFill>
			<FundoCor cor={corDe(i)} />
			<Laterais />
			<Cabecalho n={i + 1} texto={chamadaDe(tl)} />
			<div style={{position: 'absolute', top: 175, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
				<Pistas nomes={p.pistas} tamanho={110} atraso={-100} />
			</div>
			<div style={{position: 'absolute', top: 300, left: 360, right: 360, height: 470, transform: `scale(${0.6 + s * 0.4})`, opacity: Math.min(1, s * 2),
				background: 'radial-gradient(circle at 50% 30%, #ffffff, #eef3ff)', borderRadius: 48, border: '10px solid #fff', boxShadow: '0 16px 0 rgba(0,0,0,.18)',
				display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 50px', textAlign: 'center'}}>
				<div style={{fontFamily: TITULO, fontSize: p.resposta.length > 16 ? 100 : 140, lineHeight: 1, color: corDe(i), ...contorno(10, TINTA)}}>{p.resposta}</div>
				<div style={{fontFamily: FONTE, fontWeight: 600, fontSize: 48, lineHeight: 1.2, color: TINTA, marginTop: 26}}>{p.explicacao}</div>
			</div>
			<div style={{position: 'absolute', top: 742, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
				<div style={{...titulo, fontSize: 44, background: '#e8336d', borderRadius: 40, padding: '10px 40px', border: `6px solid ${TINTA}`, transform: `scale(${selo})`, ...contorno(5)}}>📖 {p.referencia}</div>
			</div>
			<Mascotes boca={boca} humor="feliz" />
			<Sequence durationInFrames={70}><Confete /></Sequence>
		</AbsoluteFill>
	);
};

const CenaAbertura: React.FC<{tl: Timeline; cena: Cena}> = ({tl, cena}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const boca = useBoca(cena.boca, cena.atrasoAudio);
	const q = tl.quiz as unknown as QuizSpeed;
	const palavras = chamadaDe(tl).split(' ');
	return (
		<AbsoluteFill>
			<Raios cor1="#2f6fe4" cor2="#4a86f0" />
			<div style={{position: 'absolute', top: 60, width: '100%', textAlign: 'center'}}>
				{palavras.map((w, k) => {
					const s = spring({frame: frame - k * 5, fps, config: {damping: 8}});
					return <span key={k} style={{...titulo, display: 'inline-block', margin: '0 18px', fontSize: 132, color: k === palavras.length - 1 ? '#ffd43b' : '#fff', ...contorno(14), transform: `translateY(${(1 - s) * -240}px)`}}>{w}</span>;
				})}
				<div style={{marginTop: 18, transform: `scale(${spring({frame: frame - 22, fps, config: {damping: 9}})})`}}>
					<span style={{...titulo, fontSize: 64, background: '#e8336d', borderRadius: 44, padding: '8px 44px', border: `7px solid ${TINTA}`, ...contorno(5)}}>{q.tema} · {tl.quiz.perguntas.length} {unidade(tl)}</span>
				</div>
			</div>
			<div style={{position: 'absolute', top: 470, left: 0, right: 0}}>
				<Pistas nomes={iconesDe(tl)} tamanho={300} atraso={30} />
			</div>
			<div style={{position: 'absolute', left: 60, bottom: 20}}><Lulu boca={boca} humor="feliz" escala={1.05} /></div>
			<div style={{position: 'absolute', right: 60, bottom: 20}}><Leleco humor="feliz" escala={1.05} /></div>
		</AbsoluteFill>
	);
};

const CenaEncerramento: React.FC<{tl: Timeline; cena: Cena}> = ({tl, cena}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const boca = useBoca(cena.boca, cena.atrasoAudio);
	const n = tl.quiz.perguntas.length;
	const faixas = [
		{txt: `0 a ${Math.round(n / 3)}: Aprendiz`, cor: '#4dabf7', e: 'Ewe'},
		{txt: `${Math.round(n / 3) + 1} a ${Math.round((2 * n) / 3)}: Explorador`, cor: '#ff7a1a', e: 'Lion'},
		{txt: `${Math.round((2 * n) / 3) + 1} a ${n}: Craque do Reino`, cor: '#1fb35a', e: 'Crown'},
	];
	return (
		<AbsoluteFill>
			<Raios cor1="#7b3fe4" cor2="#8f5cf0" />
			<div style={{...titulo, position: 'absolute', top: 60, width: '100%', textAlign: 'center', fontSize: 110, ...contorno(14)}}>Quantos você acertou?</div>
			<div style={{position: 'absolute', top: 250, left: 430, right: 430, display: 'flex', flexDirection: 'column', gap: 26}}>
				{faixas.map((f, k) => {
					const s = spring({frame: frame - 15 - k * 10, fps, config: {damping: 10}});
					return (
						<div key={k} style={{display: 'flex', alignItems: 'center', gap: 24, background: '#fff', borderRadius: 40, padding: '14px 30px', border: `7px solid ${TINTA}`, transform: `translateX(${(1 - s) * 900}px)`}}>
							<Img src={staticFile(arquivoEmoji(f.e))} style={{width: 96, height: 96}} />
							<span style={{fontFamily: TITULO, fontSize: 60, color: f.cor, ...contorno(6, TINTA)}}>{f.txt}</span>
						</div>
					);
				})}
			</div>
			<div style={{position: 'absolute', bottom: 70, left: 420, right: 420, textAlign: 'center', fontFamily: FONTE, fontWeight: 700, fontSize: 44, color: '#fff', opacity: interpolate(frame, [40, 60], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>{tl.quiz.licao}</div>
			<div style={{position: 'absolute', left: 60, bottom: 20}}><Lulu boca={boca} humor="feliz" escala={1.05} /></div>
			<div style={{position: 'absolute', right: 60, bottom: 20}}><Leleco humor="feliz" escala={1.05} /></div>
		</AbsoluteFill>
	);
};

export const RenderCenaSpeed: React.FC<{tl: Timeline; cena: Cena}> = ({tl, cena}) => {
	switch (cena.tipo) {
		case 'abertura': return <CenaAbertura tl={tl} cena={cena} />;
		case 'numero': return <CenaNumero cena={cena} />;
		case 'pergunta': return <CenaDesafio tl={tl} cena={cena} />;
		case 'cronometro': return <CenaDesafio tl={tl} cena={cena} cronometro />;
		case 'revelacao': return <CenaRevelacao tl={tl} cena={cena} />;
		case 'encerramento': return <CenaEncerramento tl={tl} cena={cena} />;
	}
};

export const ThumbnailSpeed: React.FC<{tl: Timeline}> = ({tl}) => {
	const q = tl.quiz as unknown as QuizSpeed;
	const palavras = chamadaDe(tl).split(' ');
	return (
		<AbsoluteFill>
			<Raios cor1={ehAbc(tl) ? '#7b3fe4' : '#2f6fe4'} cor2={ehAbc(tl) ? '#8f5cf0' : '#4a86f0'} giro={0} />
			<div style={{position: 'absolute', top: 40, width: '100%', textAlign: 'center'}}>
				{palavras.map((w, k) => <span key={k} style={{...titulo, margin: '0 16px', fontSize: 150, color: k === palavras.length - 1 ? '#ffd43b' : '#fff', ...contorno(16)}}>{w}</span>)}
			</div>
			<div style={{position: 'absolute', top: 330, left: 0, right: 0}}><Pistas nomes={iconesDe(tl)} tamanho={480} atraso={-100} /></div>
			<div style={{position: 'absolute', bottom: 40, width: '100%', textAlign: 'center'}}>
				<span style={{...titulo, fontSize: 84, background: '#e8336d', borderRadius: 60, padding: '10px 56px', border: `9px solid ${TINTA}`, ...contorno(8)}}>{q.tema}</span>
			</div>
		</AbsoluteFill>
	);
};

// Short vertical (1080x1920): uma pergunta do episódio, montada para o celular, com chamada para o quiz completo
// Versão vertical completa (5+ min): abertura e encerramento próprios para o celular, sem a chamada para o canal
const completo = (tl: Timeline) => Boolean((tl as unknown as {completo?: boolean}).completo);

const AberturaVertical: React.FC<{tl: Timeline; cena: Cena}> = ({tl, cena}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const boca = useBoca(cena.boca, cena.atrasoAudio);
	const palavras = chamadaDe(tl).split(' ');
	return (
		<AbsoluteFill>
			<Raios cor1="#2f6fe4" cor2="#4a86f0" />
			<div style={{position: 'absolute', top: 170, width: '100%', textAlign: 'center', padding: '0 40px'}}>
				{palavras.map((w, k) => {
					const s = spring({frame: frame - k * 5, fps, config: {damping: 8}});
					return <div key={k} style={{...titulo, fontSize: 150, lineHeight: 1.02, color: k === palavras.length - 1 ? '#ffd43b' : '#fff', ...contorno(16), transform: `translateY(${(1 - s) * -300}px)`}}>{w}</div>;
				})}
				<div style={{marginTop: 30, transform: `scale(${spring({frame: frame - 22, fps, config: {damping: 9}})})`}}>
					<span style={{...titulo, display: 'inline-block', fontSize: 56, lineHeight: 1.15, background: '#e8336d', borderRadius: 44, padding: '10px 40px', border: `7px solid ${TINTA}`, ...contorno(5)}}>{tl.quiz.tema}<br />{tl.quiz.perguntas.length} {unidade(tl)}</span>
				</div>
			</div>
			<div style={{position: 'absolute', top: 1000, left: 0, right: 0}}><Pistas nomes={iconesDe(tl)} tamanho={260} atraso={30} /></div>
			<div style={{position: 'absolute', left: 40, bottom: 90}}><Lulu boca={boca} humor="feliz" escala={1.05} /></div>
			<div style={{position: 'absolute', right: 40, bottom: 90}}><Leleco humor="feliz" escala={1.05} /></div>
		</AbsoluteFill>
	);
};

const EncerramentoVertical: React.FC<{tl: Timeline; cena: Cena}> = ({tl, cena}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const boca = useBoca(cena.boca, cena.atrasoAudio);
	const n = tl.quiz.perguntas.length;
	const faixas = [
		{txt: `0 a ${Math.round(n / 3)}: Aprendiz`, cor: '#4dabf7', e: 'Ewe'},
		{txt: `${Math.round(n / 3) + 1} a ${Math.round((2 * n) / 3)}: Explorador`, cor: '#ff7a1a', e: 'Lion'},
		{txt: `${Math.round((2 * n) / 3) + 1} a ${n}: Craque do Reino`, cor: '#1fb35a', e: 'Crown'},
	];
	return (
		<AbsoluteFill>
			<Raios cor1="#7b3fe4" cor2="#8f5cf0" />
			<div style={{...titulo, position: 'absolute', top: 160, width: '100%', textAlign: 'center', fontSize: 120, lineHeight: 1.02, ...contorno(14)}}>Quantos você<br />acertou?</div>
			<div style={{position: 'absolute', top: 500, left: 70, right: 70, display: 'flex', flexDirection: 'column', gap: 30}}>
				{faixas.map((f, k) => {
					const s = spring({frame: frame - 15 - k * 10, fps, config: {damping: 10}});
					return (
						<div key={k} style={{display: 'flex', alignItems: 'center', gap: 24, background: '#fff', borderRadius: 40, padding: '16px 30px', border: `7px solid ${TINTA}`, transform: `translateX(${(1 - s) * 1100}px)`}}>
							<Img src={staticFile(arquivoEmoji(f.e))} style={{width: 100, height: 100}} />
							<span style={{fontFamily: TITULO, fontSize: 60, color: f.cor, ...contorno(6, TINTA)}}>{f.txt}</span>
						</div>
					);
				})}
			</div>
			<div style={{position: 'absolute', top: 1080, left: 80, right: 80, textAlign: 'center', fontFamily: FONTE, fontWeight: 700, fontSize: 52, lineHeight: 1.25, color: '#fff', ...contorno(8), opacity: interpolate(frame, [40, 60], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>{tl.quiz.licao}</div>
			<div style={{position: 'absolute', left: 40, bottom: 90}}><Lulu boca={boca} humor="feliz" escala={1.05} /></div>
			<div style={{position: 'absolute', right: 40, bottom: 90}}><Leleco humor="feliz" escala={1.05} /></div>
		</AbsoluteFill>
	);
};

const CenaVertical: React.FC<{tl: Timeline; cena: Cena}> = ({tl, cena}) => {
	if (cena.tipo === 'numero') return <CenaNumero cena={cena} />;
	if (cena.tipo === 'abertura') return <AberturaVertical tl={tl} cena={cena} />;
	if (cena.tipo === 'encerramento') return <EncerramentoVertical tl={tl} cena={cena} />;
	return <DesafioVertical tl={tl} cena={cena} />;
};

const DesafioVertical: React.FC<{tl: Timeline; cena: Cena}> = ({tl, cena}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const i = cena.i ?? 0;
	const p = tl.quiz.perguntas[i] as unknown as {pistas: string[]; resposta: string; explicacao: string; referencia: string};
	const boca = useBoca(cena.boca, cena.atrasoAudio);
	const revelar = cena.tipo === 'revelacao';
	const cronometro = cena.tipo === 'cronometro';
	const restante = cronometro ? Math.max(0, 1 - frame / (tl.tempoResposta * fps)) : revelar ? 0 : 1;
	const s = spring({frame: frame - 10, fps, config: {damping: 11}});
	const pulso = 1 + Math.sin(frame / 6) * 0.04;
	return (
		<AbsoluteFill>
			<FundoCor cor={corDe(i)} />
			<div style={{position: 'absolute', top: 110, width: '100%', textAlign: 'center'}}>
				<span style={{...titulo, fontSize: 52, background: '#e8336d', borderRadius: 40, padding: '8px 36px', border: `6px solid ${TINTA}`, ...contorno(5)}}>Quiz Bíblico</span>
				<div style={{...titulo, marginTop: 24, fontSize: 92, lineHeight: 1.02, color: '#ffd43b', padding: '0 40px', ...contorno(12)}}>{ehAbc(tl) ? 'Você sabe?' : chamadaDe(tl)}</div>
			</div>
			<div style={{position: 'absolute', top: ehAbc(tl) ? 460 : revelar ? 520 : 640, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40}}>
				{ehAbc(tl) ? (
					<QuestaoABC tl={tl} i={i} vertical revelar={revelar} visivel={cena.tipo !== 'pergunta'} />
				) : (
					<>
						<Pistas nomes={p.pistas} tamanho={revelar ? 220 : 400} atraso={cena.tipo === 'pergunta' ? 8 : -100} />
						{revelar && (
							<div style={{transform: `scale(${0.6 + s * 0.4})`, opacity: Math.min(1, s * 2), background: '#fff', borderRadius: 44, border: `9px solid ${TINTA}`, padding: '26px 40px', width: 900, textAlign: 'center'}}>
								<div style={{fontFamily: TITULO, fontSize: p.resposta.length > 16 ? 84 : 110, lineHeight: 1, color: corDe(i), ...contorno(9)}}>{p.resposta}</div>
							</div>
						)}
					</>
				)}
				{revelar && (
					<div style={{opacity: Math.min(1, s * 2), background: '#fff', borderRadius: 36, border: `7px solid ${TINTA}`, padding: '18px 34px', width: 900, textAlign: 'center', fontFamily: FONTE, fontWeight: 600, fontSize: 42, lineHeight: 1.2, color: TINTA}}>
						{p.explicacao}
						<div style={{marginTop: 10, fontFamily: TITULO, fontSize: 36, color: '#e8336d'}}>📖 {p.referencia}</div>
					</div>
				)}
			</div>
			<div style={{position: 'absolute', left: 60, bottom: 250}}><Lulu boca={boca} humor={revelar ? 'feliz' : cronometro ? 'pensando' : 'normal'} escala={0.8} /></div>
			<div style={{position: 'absolute', right: 60, bottom: 250}}><Leleco humor={revelar ? 'feliz' : cronometro ? 'pensando' : 'normal'} escala={0.8} /></div>
			{!revelar && <BarraTempo restante={restante} segundos={cronometro ? Math.max(1, Math.ceil(tl.tempoResposta - frame / fps)) : undefined} largura={800} base={580} />}
			{!completo(tl) && <div style={{position: 'absolute', bottom: 120, width: '100%', textAlign: 'center'}}>
				<span style={{...titulo, display: 'inline-block', fontSize: 58, background: '#1fb35a', borderRadius: 50, padding: '14px 44px', border: `7px solid ${TINTA}`, transform: `scale(${revelar ? pulso : 1})`, ...contorno(6)}}>▶ Quiz completo no canal!</span>
			</div>}
			{revelar && <Sequence durationInFrames={70}><Confete /></Sequence>}
		</AbsoluteFill>
	);
};

export const ShortSpeed: React.FC<{tl: Timeline}> = ({tl}) => (
	<AbsoluteFill>
		{tl.cenas.map((c, k) => (
			<Sequence key={k} from={c.inicio} durationInFrames={c.duracao} premountFor={15}>
				<CenaVertical tl={tl} cena={c} />
			</Sequence>
		))}
	</AbsoluteFill>
);
