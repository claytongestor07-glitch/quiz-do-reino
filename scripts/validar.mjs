// Valida o roteiro antes de gastar créditos de voz ou tempo de render. Sai com código 1 se houver erro.
// Uso: node scripts/validar.mjs ep001-noe
import fs from 'node:fs';
import path from 'node:path';
import {RAIZ, episodio, log} from './lib.mjs';
import {arquivoEmoji} from './emojis.mjs';

const LIVROS = /^(Gênesis|Êxodo|Levítico|Números|Deuteronômio|Ester|Neemias|Esdras|Josué|Juízes|Rute|1 Samuel|2 Samuel|1 Reis|2 Reis|Salmos|Provérbios|Isaías|Jeremias|Daniel|Jonas|Mateus|Marcos|Lucas|João|Atos|Romanos|1 Coríntios|Gálatas|Efésios|Filipenses|Colossenses|Hebreus|Tiago|1 Pedro|1 João) \d+(:\d+(-\d+)?)?$/;
const PROIBIDO = /inscreva|clique no link|comente|comentário|compre|whatsapp|instagram/i; // Made for Kids: sem pedir comentários nem levar para fora

export function validar(id) {
	const {quiz} = episodio(id);
	const erros = [];
	const n = quiz.perguntas?.length ?? 0;
	const emoji = quiz.tipo === 'emoji';
	const abc = quiz.tipo === 'abc'; // alternativas no visual colorido: mais perguntas, textos mais curtos
	const [min, max] = emoji ? [20, 60] : abc ? [20, 30] : [15, 20];
	if (n < min || n > max) erros.push(`precisa de ${min} a ${max} ${emoji ? 'desafios' : 'perguntas'} (tem ${n})`);
	(quiz.icones ?? []).forEach((e) => !fs.existsSync(path.join(RAIZ, 'public', 'emoji', arquivoEmoji(e))) && erros.push(`ícone "${e}" não baixado (rode scripts/emojis.mjs)`));
	for (const campo of ['titulo', 'tema', 'abertura', 'encerramento', 'licao']) if (!quiz[campo]?.trim()) erros.push(`campo vazio: ${campo}`);
	if (quiz.titulo && quiz.titulo.length > 100) erros.push('título passa de 100 caracteres (limite do YouTube)');
	const vistas = new Set();
	quiz.perguntas?.forEach((p, i) => {
		const q = `P${i + 1}`;
		if (emoji) {
			if (!Array.isArray(p.pistas) || p.pistas.length < 2 || p.pistas.length > 3) erros.push(`${q}: precisa de 2 ou 3 pistas`);
			p.pistas?.forEach((e) => !fs.existsSync(path.join(RAIZ, 'public', 'emoji', arquivoEmoji(e))) && erros.push(`${q}: emoji "${e}" não baixado (rode scripts/emojis.mjs)`));
			if (!p.resposta?.trim() || p.resposta.length > 28) erros.push(`${q}: resposta vazia ou longa demais (máx. 28)`);
			const chave = `${p.pistas?.join('+')}`;
			if (vistas.has(chave) || vistas.has(p.resposta)) erros.push(`${q}: desafio repetido`);
			vistas.add(chave); vistas.add(p.resposta);
			if (!p.explicacao?.trim()) erros.push(`${q}: falta explicação`);
		} else {
			if (!p.pergunta?.trim().endsWith('?')) erros.push(`${q}: pergunta deve terminar com "?"`);
			if (vistas.has(p.pergunta)) erros.push(`${q}: pergunta repetida`);
			vistas.add(p.pergunta);
			if (p.alternativas?.length !== 3) erros.push(`${q}: precisa de exatamente 3 alternativas`);
			if (new Set(p.alternativas).size !== p.alternativas?.length) erros.push(`${q}: alternativas repetidas`);
			if (!Number.isInteger(p.correta) || p.correta < 0 || p.correta > 2) erros.push(`${q}: "correta" deve ser 0, 1 ou 2`);
			const [maxAlt, maxPerg] = abc ? [30, 90] : [42, 70];
			p.alternativas?.forEach((a, k) => a.length > maxAlt && erros.push(`${q}: alternativa ${k + 1} longa demais para a tela (${a.length} > ${maxAlt})`));
			if (p.pergunta?.length > maxPerg) erros.push(`${q}: pergunta longa demais para a tela (${p.pergunta.length} > ${maxPerg})`);
			if (!p.explicacao?.trim()) erros.push(`${q}: falta explicação`);
		}
		for (const ref of (p.referencia ?? '').split(';').map((r) => r.trim())) {
			// "Gênesis 6:19; 7:2" — a segunda parte herda o livro
			const completa = /^\d/.test(ref) && !/^\d \D/.test(ref) ? `${p.referencia.split(' ')[0]} ${ref}` : ref;
			if (!LIVROS.test(completa)) erros.push(`${q}: referência bíblica inválida "${ref}"`);
		}
	});
	const textos = [quiz.abertura, quiz.encerramento, ...(quiz.perguntas ?? []).flatMap((p) => [p.pergunta, p.resposta, p.explicacao, ...(p.alternativas ?? [])])];
	textos.forEach((t) => PROIBIDO.test(t ?? '') && erros.push(`texto viola Made for Kids: "${t.slice(0, 50)}…"`));
	if (!emoji) {
		const dist = [0, 0, 0];
		quiz.perguntas?.forEach((p) => dist[p.correta]++);
		if (Math.max(...dist) > n * 0.5) erros.push(`respostas certas concentradas numa letra (${dist.join('/')})`);
	}
	return erros;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const id = process.argv[2];
	const erros = validar(id);
	if (erros.length) {
		erros.forEach((e) => log('validar', `ERRO ${id}: ${e}`));
		process.exit(1);
	}
	log('validar', `${id} aprovado`);
}
