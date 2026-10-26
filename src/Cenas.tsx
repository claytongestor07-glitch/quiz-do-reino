import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Sequence} from 'remotion';
import {COR, FONTE, LETRAS, aleatorio, type Cena, type Timeline} from './tema';
import {Lulu, Leleco, Arca, useBoca} from './Personagens';

const texto: React.CSSProperties = {fontFamily: FONTE, color: COR.tinta, fontWeight: 700};

export const Fundo: React.FC = () => {
	const frame = useCurrentFrame();
	const {width} = useVideoConfig();
	return (
		<AbsoluteFill style={{background: `linear-gradient(${COR.ceuTopo}, ${COR.ceuBase} 70%)`}}>
			<svg width="100%" height="100%" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
				<g transform={`translate(1740 150) rotate(${frame / 3})`}>
					{Array.from({length: 12}, (_, k) => <rect key={k} x={-6} y={-150} width={12} height={46} rx={6} fill="#ffe066" transform={`rotate(${k * 30})`} />)}
					<circle r={86} fill="#ffd43b" />
				</g>
				{[0, 1, 2, 3].map((k) => {
					const x = ((k * 560 + frame * (0.6 + k * 0.15)) % (width + 600)) - 300;
					const y = 120 + k * 70;
					return (
						<g key={k} transform={`translate(${x} ${y}) scale(${0.8 + aleatorio(k) * 0.5})`} opacity={0.95}>
							<circle cx={0} cy={0} r={46} fill="#fff" /><circle cx={50} cy={-18} r={58} fill="#fff" /><circle cx={105} cy={0} r={44} fill="#fff" /><rect x={0} y={0} width={105} height={44} fill="#fff" />
						</g>
					);
				})}
				<path d="M 0 860 Q 420 700 900 840 T 1920 800 L 1920 1080 L 0 1080 Z" fill={COR.morro1} />
				<path d="M 0 950 Q 600 840 1200 950 T 1920 930 L 1920 1080 L 0 1080 Z" fill={COR.morro2} />
				{Array.from({length: 14}, (_, k) => (
					<g key={k} transform={`translate(${60 + k * 140 + aleatorio(k + 9) * 60} ${985 + aleatorio(k + 3) * 60})`}>
						{[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 9} cy={Math.sin((a * Math.PI) / 180) * 9} r={7} fill={['#ff8fab', '#fff', '#ffd43b'][k % 3]} />)}
						<circle r={5} fill="#f59f00" />
					</g>
				))}
			</svg>
		</AbsoluteFill>
	);
};

const Entrar: React.FC<{atraso?: number; de?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({atraso = 0, de = 60, children, style}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const s = spring({frame: frame - atraso, fps, config: {damping: 12, mass: 0.6}});
	return <div style={{...style, opacity: Math.min(1, s * 1.5), transform: `translateY(${(1 - s) * de}px) scale(${0.85 + s * 0.15})`}}>{children}</div>;
};

const Personagens: React.FC<{boca?: number; humor?: 'normal' | 'feliz' | 'pensando'; entrada?: boolean}> = ({boca = 0, humor = 'normal', entrada}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const s = entrada ? spring({frame, fps, config: {damping: 14}}) : 1;
	return (
		<>
			<div style={{position: 'absolute', left: 40 - (1 - s) * 500, bottom: 10}}><Lulu boca={boca} humor={humor} escala={1.05} /></div>
			<div style={{position: 'absolute', right: 40 - (1 - s) * 500, bottom: 10}}><Leleco humor={humor === 'pensando' ? 'pensando' : humor} escala={1.05} /></div>
		</>
	);
};



const Selo: React.FC<{i: number; total: number}> = ({i, total}) => (
	<div style={{...texto, position: 'absolute', top: 36, left: 60, background: '#fff', borderRadius: 40, padding: '10px 30px', fontSize: 36, boxShadow: '0 6px 0 rgba(58,46,107,.18)'}}>
		Pergunta {i + 1} de {total}
	</div>
);

const CartaoPergunta: React.FC<{texto: string; visivel?: boolean}> = ({texto: t, visivel}) => (
	<Entrar atraso={visivel ? -100 : 0} style={{position: 'absolute', top: 120, left: 210, right: 210}}>
		<div style={{...texto, background: COR.cartao, borderRadius: 40, padding: '38px 50px', fontSize: 66, textAlign: 'center', lineHeight: 1.15, boxShadow: '0 12px 0 rgba(58,46,107,.15)'}}>{t}</div>
	</Entrar>
);

const Alternativas: React.FC<{opcoes: string[]; correta?: number; revelar?: number; visivel?: boolean}> = ({opcoes, correta, revelar = 0, visivel}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	return (
		<div style={{position: 'absolute', top: 400, left: 120, right: 120, display: 'flex', gap: 40, justifyContent: 'center'}}>
			{opcoes.map((op, k) => {
				const certa = correta === k;
				const destaque = certa ? spring({frame: frame - revelar, fps, config: {damping: 9}}) : 0;
				const apagar = correta !== undefined && !certa ? interpolate(frame - revelar, [0, 10], [1, 0.35], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1;
				return (
					<Entrar key={k} atraso={visivel ? -100 : 8 + k * 7} style={{flex: 1, maxWidth: 520, opacity: apagar}}>
						<div style={{...texto, position: 'relative', display: 'flex', alignItems: 'center', gap: 24, background: '#fff', borderRadius: 36, padding: '26px 28px', minHeight: 140, fontSize: 46, lineHeight: 1.1,
							border: `8px solid ${certa && destaque > 0.05 ? COR.certo : COR.alternativas[k]}`, transform: `scale(${1 + destaque * 0.1})`, boxShadow: `0 10px 0 ${certa && destaque > 0.05 ? '#1f8a32' : 'rgba(58,46,107,.15)'}`}}>
							<div style={{flex: 'none', width: 88, height: 88, borderRadius: 44, background: COR.alternativas[k], color: '#fff', fontSize: 56, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{LETRAS[k]}</div>
							<span>{op}</span>
							{certa && destaque > 0.05 && (
								<div style={{position: 'absolute', top: -34, right: -24, width: 76, height: 76, borderRadius: 38, background: COR.certo, color: '#fff', fontSize: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${destaque})`}}>✓</div>
							)}
						</div>
					</Entrar>
				);
			})}
		</div>
	);
};

const Cronometro: React.FC<{segundos: number}> = ({segundos}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const restante = Math.max(0, segundos - frame / fps);
	const n = Math.ceil(restante);
	const pulso = 1 + 0.08 * Math.max(0, 1 - ((frame / fps) % 1) * 4);
	const cor = restante > 3 ? '#4dabf7' : '#ff6b6b';
	const C = 2 * Math.PI * 110;
	return (
		<div style={{position: 'absolute', left: 0, right: 0, top: 650, display: 'flex', justifyContent: 'center'}}>
			<svg width={280} height={280} viewBox="-140 -140 280 280" style={{transform: `scale(${pulso})`}}>
				<circle r={128} fill="#fff" />
				<circle r={110} fill="none" stroke="#e7e3f5" strokeWidth={22} />
				<circle r={110} fill="none" stroke={cor} strokeWidth={22} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - restante / segundos)} transform="rotate(-90)" />
				<text y={36} textAnchor="middle" style={{...texto, fontSize: 110, fill: cor}}>{n || '!'}</text>
			</svg>
		</div>
	);
};

const Confete: React.FC = () => {
	const frame = useCurrentFrame();
	const cores = ['#ff6b6b', '#4dabf7', '#fcc419', '#51cf66', '#cc5de8', '#ff922b'];
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			{Array.from({length: 70}, (_, k) => {
				const x = aleatorio(k) * 1920 + Math.sin(frame / 8 + k) * 30;
				const y = -40 + frame * (9 + aleatorio(k + 50) * 8) - aleatorio(k + 99) * 300;
				return y > -40 && y < 1100 ? <div key={k} style={{position: 'absolute', left: x, top: y, width: 18, height: 28, borderRadius: 4, background: cores[k % 6], transform: `rotate(${frame * 9 + k * 40}deg)`}} /> : null;
			})}
		</AbsoluteFill>
	);
};

const CenaAbertura: React.FC<{tl: Timeline; cena: Cena}> = ({tl, cena}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const boca = useBoca(cena.boca, cena.atrasoAudio);
	const nome = 'Quiz do Reino';
	return (
		<AbsoluteFill>
			<div style={{position: 'absolute', top: 70, width: '100%', textAlign: 'center'}}>
				{nome.split('').map((l, k) => {
					const s = spring({frame: frame - k * 2, fps, config: {damping: 8}});
					return <span key={k} style={{...texto, display: 'inline-block', fontSize: 150, color: COR.alternativas[k % 3], WebkitTextStroke: '6px #fff', paintOrder: 'stroke', transform: `translateY(${(1 - s) * -200 + Math.sin((frame + k * 5) / 10) * 6}px)`, whiteSpace: 'pre'}}>{l}</span>;
				})}
				<Entrar atraso={25}><div style={{...texto, fontSize: 64, marginTop: 10}}>Quiz Bíblico: {tl.quiz.tema}</div></Entrar>
			</div>
			<Entrar atraso={35} style={{position: 'absolute', top: 470, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}><Arca largura={600} /></Entrar>
			<Personagens boca={boca} entrada />
		</AbsoluteFill>
	);
};

const CenaNumero: React.FC<{tl: Timeline; cena: Cena}> = ({tl, cena}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const s = spring({frame, fps, config: {damping: 9}});
	const i = cena.i ?? 0;
	return (
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
			<div style={{...texto, transform: `scale(${s}) rotate(${(1 - s) * -20}deg)`, background: COR.alternativas[i % 3], color: '#fff', borderRadius: 60, padding: '40px 90px', textAlign: 'center', boxShadow: '0 16px 0 rgba(58,46,107,.2)', marginBottom: 200}}>
				<div style={{fontSize: 60}}>Pergunta</div>
				<div style={{fontSize: 190, lineHeight: 1}}>{i + 1}</div>
			</div>
			<Personagens humor="normal" />
			<Selo i={i} total={tl.quiz.perguntas.length} />
		</AbsoluteFill>
	);
};

const CenaPergunta: React.FC<{tl: Timeline; cena: Cena; cronometro?: boolean}> = ({tl, cena, cronometro}) => {
	const p = tl.quiz.perguntas[cena.i ?? 0];
	const boca = useBoca(cena.boca, cena.atrasoAudio);
	return (
		<AbsoluteFill>
			<Selo i={cena.i ?? 0} total={tl.quiz.perguntas.length} />
			<CartaoPergunta texto={p.pergunta} visivel={cronometro} />
			<Alternativas opcoes={p.alternativas} visivel={cronometro} />
			{cronometro && <Cronometro segundos={tl.tempoResposta} />}
			<Personagens boca={boca} humor={cronometro ? 'pensando' : 'normal'} />
		</AbsoluteFill>
	);
};

const CenaRevelacao: React.FC<{tl: Timeline; cena: Cena}> = ({tl, cena}) => {
	const p = tl.quiz.perguntas[cena.i ?? 0];
	const boca = useBoca(cena.boca, cena.atrasoAudio);
	return (
		<AbsoluteFill>
			<Selo i={cena.i ?? 0} total={tl.quiz.perguntas.length} />
			<CartaoPergunta texto={p.pergunta} visivel />
			<Alternativas opcoes={p.alternativas} correta={p.correta} revelar={2} visivel />
			<Entrar atraso={30} style={{position: 'absolute', top: 640, left: 400, right: 400}}>
				<div style={{...texto, background: '#fff', borderRadius: 36, padding: '30px 40px', fontSize: 40, fontWeight: 600, lineHeight: 1.25, textAlign: 'center', boxShadow: '0 10px 0 rgba(58,46,107,.15)'}}>
					{p.explicacao}
					<div style={{display: 'inline-block', marginTop: 16, background: '#ffe8a3', borderRadius: 24, padding: '6px 24px', fontSize: 34, fontWeight: 700}}>📖 {p.referencia}</div>
				</div>
			</Entrar>
			<Personagens boca={boca} humor="feliz" />
			<Sequence from={2} durationInFrames={80}><Confete /></Sequence>
		</AbsoluteFill>
	);
};

const CenaEncerramento: React.FC<{tl: Timeline; cena: Cena}> = ({tl, cena}) => {
	const frame = useCurrentFrame();
	const boca = useBoca(cena.boca, cena.atrasoAudio);
	const cores = ['#ff6b6b', '#ff922b', '#fcc419', '#51cf66', '#4dabf7', '#845ef7'];
	const progresso = interpolate(frame, [0, 60], [0, 1], {extrapolateRight: 'clamp'});
	return (
		<AbsoluteFill>
			<svg width="1920" height="1080" style={{position: 'absolute'}}>
				{cores.map((c, k) => {
					const r = 760 - k * 42;
					const L = Math.PI * r;
					return <path key={k} d={`M ${960 - r} 1000 A ${r} ${r} 0 0 1 ${960 + r} 1000`} fill="none" stroke={c} strokeWidth={42} strokeDasharray={L} strokeDashoffset={L * (1 - progresso)} />;
				})}
			</svg>
			<Entrar atraso={20} style={{position: 'absolute', top: 330, left: 380, right: 380}}>
				<div style={{...texto, background: '#fff', borderRadius: 40, padding: '34px 46px', textAlign: 'center', boxShadow: '0 12px 0 rgba(58,46,107,.15)'}}>
					<div style={{fontSize: 44, color: '#845ef7'}}>Lição de hoje</div>
					<div style={{fontSize: 52, lineHeight: 1.2, marginTop: 10}}>{tl.quiz.licao}</div>
				</div>
			</Entrar>
			<Entrar atraso={50} style={{position: 'absolute', top: 120, width: '100%', textAlign: 'center'}}>
				<div style={{...texto, fontSize: 96, color: '#fff', WebkitTextStroke: '5px #845ef7', paintOrder: 'stroke'}}>Até o próximo quiz!</div>
			</Entrar>
			<Personagens boca={boca} humor="feliz" />
		</AbsoluteFill>
	);
};

export const RenderCena: React.FC<{tl: Timeline; cena: Cena}> = ({tl, cena}) => {
	switch (cena.tipo) {
		case 'abertura': return <CenaAbertura tl={tl} cena={cena} />;
		case 'numero': return <CenaNumero tl={tl} cena={cena} />;
		case 'pergunta': return <CenaPergunta tl={tl} cena={cena} />;
		case 'cronometro': return <CenaPergunta tl={tl} cena={cena} cronometro />;
		case 'revelacao': return <CenaRevelacao tl={tl} cena={cena} />;
		case 'encerramento': return <CenaEncerramento tl={tl} cena={cena} />;
	}
};
