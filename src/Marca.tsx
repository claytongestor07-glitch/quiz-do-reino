// Identidade do canal: foto de perfil (Logo) e capa do YouTube (Banner), no mesmo estilo dos episódios.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {Raios, TITULO} from './Speed';
import {FONTE} from './tema';
import {Lulu, Leleco} from './Personagens';

const TINTA = '#24124f';
const contorno = (px: number, cor = TINTA): React.CSSProperties => ({WebkitTextStroke: `${px}px ${cor}`, paintOrder: 'stroke'});
const emoji = (nome: string) => staticFile(`emoji/${nome.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.png`);

// 800x800; o YouTube recorta em círculo, então tudo importante fica no centro
export const Logo: React.FC = () => (
	<AbsoluteFill>
		<Raios cor1="#2f6fe4" cor2="#4a86f0" giro={0} />
		<Img src={emoji('Crown')} style={{position: 'absolute', left: 310, top: 40, width: 180, height: 180, filter: 'drop-shadow(0 10px 10px rgba(0,0,0,.3))'}} />
		<div style={{position: 'absolute', left: 20, top: 175}}><Lulu humor="feliz" escala={0.95} /></div>
		<div style={{position: 'absolute', right: 20, top: 175}}><Leleco humor="feliz" escala={0.95} /></div>
		<div style={{position: 'absolute', bottom: 120, width: '100%', textAlign: 'center'}}>
			<span style={{fontFamily: TITULO, fontSize: 96, color: '#ffd43b', textTransform: 'uppercase', lineHeight: 0.95, display: 'inline-block', ...contorno(12)}}>
				Quiz do<br />Reino
			</span>
		</div>
	</AbsoluteFill>
);

// 2560x1440; área segura do YouTube (aparece em todos os aparelhos): 1546x423 no centro
export const Banner: React.FC = () => {
	const enfeites: [string, number, number, number][] = [
		['Rainbow', 230, 280, -12], ['Ship', 2080, 300, 10], ['Lion', 330, 1020, 8], ['Dove', 2120, 1010, -10],
		['Crown', 700, 200, -8], ['Folded hands', 1830, 160, 0], ['Sparkles', 330, 640, 0], ['Red heart', 2240, 650, 12],
		['Bread', 760, 1180, -8], ['Fish', 1780, 1200, 10],
	];
	return (
		<AbsoluteFill>
			<Raios cor1="#2f6fe4" cor2="#4a86f0" giro={0} />
			{enfeites.map(([n, x, y, r]) => <Img key={n} src={emoji(n)} style={{position: 'absolute', left: x - 110, top: y - 110, width: 220, height: 220, transform: `rotate(${r}deg)`, filter: 'drop-shadow(0 14px 12px rgba(0,0,0,.25))'}} />)}
			{/* faixa central = área segura */}
			<div style={{position: 'absolute', left: 507, top: 508, width: 1546, height: 423, display: 'flex', alignItems: 'center', justifyContent: 'space-evenly', gap: 0}}>
				<div style={{marginTop: 30}}><Lulu humor="feliz" escala={0.72} /></div>
				<div style={{textAlign: 'center'}}>
					<div style={{fontFamily: TITULO, fontSize: 128, lineHeight: 1, whiteSpace: 'nowrap', color: '#ffd43b', textTransform: 'uppercase', ...contorno(16)}}><Img src={emoji('Crown')} style={{width: 120, height: 120, verticalAlign: 'middle', marginRight: 16}} />Quiz do Reino</div>
					<div style={{display: 'inline-block', marginTop: 22, fontFamily: TITULO, fontSize: 50, whiteSpace: 'nowrap', color: '#fff', background: '#e8336d', borderRadius: 50, padding: '8px 40px', border: `8px solid ${TINTA}`, textTransform: 'uppercase', ...contorno(6)}}>Quiz Bíblico para Crianças</div>
					<div style={{marginTop: 18, fontFamily: FONTE, fontWeight: 700, fontSize: 42, whiteSpace: 'nowrap', color: '#fff', ...contorno(8)}}>Novos desafios todos os dias!</div>
				</div>
				<div style={{marginTop: 30}}><Leleco humor="feliz" escala={0.72} /></div>
			</div>
		</AbsoluteFill>
	);
};
