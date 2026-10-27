import React from 'react';
import {AbsoluteFill, Composition, Still, Sequence, Html5Audio, staticFile, type CalculateMetadataFunction} from 'remotion';
import {COR, FONTE, type Timeline} from './tema';
import {Fundo, RenderCena} from './Cenas';
import {RenderCenaSpeed, ThumbnailSpeed, ShortSpeed} from './Speed';
import {Logo, Banner} from './Marca';
import {Lulu, Leleco, Arca} from './Personagens';
import {Clipe, MiniaturaClipe, carregarClipe} from './Clipe';

// semAudio: o render final desenha só a imagem; o áudio é mixado por scripts/mixar.mjs com o FFmpeg do sistema
// (o FFmpeg embutido no Remotion exige macOS 15).
type Props = {id: string; timeline?: Timeline; semAudio?: boolean};
// Formatos no visual colorido de game show (Speed.tsx)
const SPEED = new Set(['emoji', 'abc']);

const carregar: CalculateMetadataFunction<Props> = async ({props}) => {
	const timeline: Timeline = props.timeline ?? (await (await fetch(staticFile(`ep/${props.id}/timeline.json`))).json());
	return {durationInFrames: timeline.totalFrames, props: {...props, timeline}};
};

const Audio: React.FC<{tl: Timeline}> = ({tl}) => {
	const comVoz = tl.cenas.filter((c) => c.audio);
	return (
		<>
			{comVoz.map((c, k) => (
				<Sequence key={`v${k}`} from={c.inicio + (c.atrasoAudio ?? 0)} layout="none"><Html5Audio src={staticFile(c.audio!)} /></Sequence>
			))}
			{tl.sons.map((s, k) => (
				<Sequence key={`s${k}`} from={s.quadro} layout="none"><Html5Audio src={staticFile(s.arquivo)} volume={s.volume} /></Sequence>
			))}
			{/* Trilha em loop; abaixa enquanto alguém fala */}
			<Html5Audio src={staticFile(tl.trilha.arquivo)} loop
				volume={(f) => (comVoz.some((c) => f >= c.inicio + (c.atrasoAudio ?? 0) && f < c.inicio + c.duracao) ? tl.trilha.volumeSobVoz : tl.trilha.volume)} />
		</>
	);
};

const Episodio: React.FC<Props> = ({timeline: tl, semAudio}) => {
	if (!tl) return null;
	return (
		<AbsoluteFill>
			{!SPEED.has(tl.quiz.tipo ?? '') && <Fundo />}
			{tl.cenas.map((c, k) => (
				<Sequence key={k} from={c.inicio} durationInFrames={c.duracao} premountFor={15}>
					{SPEED.has(tl.quiz.tipo ?? '') ? <RenderCenaSpeed tl={tl} cena={c} /> : <RenderCena tl={tl} cena={c} />}
				</Sequence>
			))}
			{!semAudio && <Audio tl={tl} />}
		</AbsoluteFill>
	);
};

const Thumbnail: React.FC<Props> = ({timeline: tl}) => tl && SPEED.has(tl.quiz.tipo ?? '') ? <ThumbnailSpeed tl={tl} /> : (
	<AbsoluteFill>
		<Fundo />
		<div style={{position: 'absolute', top: 40, width: '100%', textAlign: 'center', fontFamily: FONTE, fontWeight: 700}}>
			<div style={{display: 'inline-block', background: '#ff6b6b', color: '#fff', borderRadius: 40, padding: '8px 40px', fontSize: 70}}>QUIZ BÍBLICO</div>
			<div style={{fontSize: 170, lineHeight: 1, marginTop: 20, color: '#ffd43b', WebkitTextStroke: '14px #3a2e6b', paintOrder: 'stroke'}}>{tl?.quiz.tema.toUpperCase()}</div>
		</div>
		<div style={{position: 'absolute', top: 420, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}><Arca largura={720} /></div>
		<div style={{position: 'absolute', left: 30, bottom: 0}}><Lulu humor="feliz" escala={1.6} /></div>
		<div style={{position: 'absolute', right: 30, bottom: 0}}><Leleco humor="feliz" escala={1.6} /></div>
		<div style={{position: 'absolute', right: 330, top: 330, background: '#fcc419', color: COR.tinta, fontFamily: FONTE, fontWeight: 700, fontSize: 46, borderRadius: 110, width: 210, height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: 1, transform: 'rotate(-12deg)'}}>
			{tl?.quiz.perguntas.length}<br />perguntas
		</div>
	</AbsoluteFill>
);

// Short vertical: formatos coloridos (emoji, abc) têm layout próprio; o formato antigo mostra a cena 16:9 no centro.
const Short: React.FC<Props> = ({timeline: tl, semAudio}) => {
	if (!tl) return null;
	if (SPEED.has(tl.quiz.tipo ?? '')) return <><ShortSpeed tl={tl} />{!semAudio && <Audio tl={tl} />}</>;
	const n = (tl.cenas[0].i ?? 0) + 1;
	return (
		<AbsoluteFill style={{background: `linear-gradient(${COR.ceuTopo}, #b9e4ff)`}}>
			<div style={{position: 'absolute', top: 150, width: '100%', textAlign: 'center', fontFamily: FONTE, fontWeight: 700}}>
				<div style={{display: 'inline-block', background: '#ff6b6b', color: '#fff', borderRadius: 40, padding: '10px 44px', fontSize: 64}}>QUIZ BÍBLICO</div>
				<div style={{fontSize: 92, lineHeight: 1.05, marginTop: 24, color: '#ffd43b', WebkitTextStroke: '10px #3a2e6b', paintOrder: 'stroke'}}>{tl.quiz.tema}</div>
				<div style={{fontSize: 56, marginTop: 16, color: COR.tinta}}>Você sabe a resposta? 🤔</div>
			</div>
			<div style={{position: 'absolute', top: 640, left: 0, width: 1920, height: 1080, transform: 'scale(0.5625)', transformOrigin: 'top left', borderRadius: 60, overflow: 'hidden'}}>
				<Episodio timeline={tl} semAudio={semAudio} id={tl.id} />
			</div>
			<div style={{position: 'absolute', bottom: 160, width: '100%', textAlign: 'center', fontFamily: FONTE, fontWeight: 700, fontSize: 52, color: COR.tinta}}>
				Pergunta {n} do quiz completo no canal!
			</div>
		</AbsoluteFill>
	);
};

export const Root: React.FC = () => (
	<>
		<Composition id="Episodio" component={Episodio} width={1920} height={1080} fps={30} durationInFrames={300} defaultProps={{id: 'ep001-noe'}} calculateMetadata={carregar} />
		<Composition id="Short" component={Short} width={1080} height={1920} fps={30} durationInFrames={300} defaultProps={{id: 'ep001-noe'}} calculateMetadata={async ({props}) => ({durationInFrames: props.timeline?.totalFrames ?? 300})} />
		<Composition id="Clipe" component={Clipe} width={1920} height={1080} fps={30} durationInFrames={300} defaultProps={{id: 'mu001-davi'}} calculateMetadata={carregarClipe} />
		<Composition id="ClipeVertical" component={Clipe} width={1080} height={1920} fps={30} durationInFrames={300} defaultProps={{id: 'mu001-davi'}} calculateMetadata={carregarClipe} />
		<Still id="MiniaturaClipe" component={MiniaturaClipe} width={1920} height={1080} defaultProps={{id: 'mu001-davi'}} calculateMetadata={carregarClipe} />
		<Still id="Logo" component={Logo} width={800} height={800} />
		<Still id="Banner" component={Banner} width={2560} height={1440} />
		<Still id="Thumbnail" component={Thumbnail} width={1920} height={1080} defaultProps={{id: 'ep001-noe'}} calculateMetadata={carregar} />
	</>
);
