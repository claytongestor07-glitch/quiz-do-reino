// Agenda de publicação (logs/agenda.json), compartilhada pelos quizzes (automacao.mjs) e pelos clipes (clipes.mjs).
// Horários de Brasília por tipo de vídeo; cada horário recebe um só vídeo.
import fs from 'node:fs';
import path from 'node:path';
import {RAIZ} from './lib.mjs';

const AGENDA = path.join(RAIZ, 'logs', 'agenda.json');
export const HORARIOS = {
	episodio: ['09:00', '17:00'], vertical: ['10:00', '18:00'], short: ['08:00', '11:00', '13:00', '15:00', '19:00', '21:00'],
	clipe: ['12:00', '16:00'], clipeVertical: ['14:00', '20:00'],
};

const ler = () => (fs.existsSync(AGENDA) ? JSON.parse(fs.readFileSync(AGENDA, 'utf8')) : []);

// Próximo horário livre (>= agora + 1 h) para o tipo pedido
export function proximoHorario(tipo) {
	const ocupados = new Set(ler().map((a) => a.quando));
	const minimo = Date.now() + 3600e3;
	for (let d = 0; d < 60; d++) {
		const dia = new Date(Date.now() + d * 86400e3).toLocaleDateString('sv-SE', {timeZone: 'America/Sao_Paulo'});
		for (const h of HORARIOS[tipo]) {
			const quando = `${dia}T${h}:00-03:00`;
			if (new Date(quando).getTime() >= minimo && !ocupados.has(quando)) return quando;
		}
	}
	throw new Error('agenda cheia nos próximos 60 dias');
}

export const reservar = (quando, item) => {
	const agenda = ler();
	agenda.push({quando, item});
	fs.mkdirSync(path.dirname(AGENDA), {recursive: true});
	fs.writeFileSync(AGENDA, JSON.stringify(agenda, null, 1));
};
