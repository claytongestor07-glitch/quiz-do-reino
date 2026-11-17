// Produção diária automática (.github/workflows/diario.yml): um episódio novo de "Qual animal é esse?" por dia,
// publicado sem esperar aprovação (autorização do senhor em 2026-11-17).
//
//   node scripts/diario.mjs planejar
//     Escolhe os próximos animais do catálogo (config/catalogo-animais.json) que o canal ainda não usou.
//     - 22 ou mais disponíveis: modo "novos" (as imagens 3D são geradas no Kaggle e escolhidas por scripts/diario_montar.py);
//     - menos que isso: modo "sombra", que reaproveita animais 3D já usados num quiz de silhuetas (sem GPU).
//     Escreve em $GITHUB_OUTPUT: modo, ep, animais (lista para o Kaggle) e pedidos (JSON id → pedido em inglês).
import fs from 'node:fs';
import path from 'node:path';
import {RAIZ, log} from './lib.mjs';

const MIN_NOVOS = 22;
const POR_EPISODIO = 30; // pedidos ao Kaggle; alguns são descartados na escolha automática
const SOMBRAS = 22;

const saida = (k, v) => process.env.GITHUB_OUTPUT ? fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`) : console.log(`${k}=${v}`);
const quizzes = () => fs.readdirSync(path.join(RAIZ, 'episodios')).filter((e) => fs.existsSync(path.join(RAIZ, 'episodios', e, 'quiz.json')))
	.map((e) => ({ep: e, quiz: JSON.parse(fs.readFileSync(path.join(RAIZ, 'episodios', e, 'quiz.json'), 'utf8'))}));
const chave = (nome) => nome.toLowerCase().replace(/^ia /, '').replace(/[^a-z0-9]+/g, '_');

// Número do próximo episódio: o maior epNNN existente + 1
function proximoEp(sufixo) {
	const n = Math.max(...fs.readdirSync(path.join(RAIZ, 'episodios')).map((e) => Number(e.match(/^ep(\d+)/)?.[1] ?? 0)));
	return `ep${String(n + 1).padStart(3, '0')}-${sufixo}`;
}

// Embaralhamento estável por semente (o mesmo episódio sempre sai na mesma ordem)
function embaralhar(lista, semente) {
	const a = [...lista];
	let s = semente;
	for (let i = a.length - 1; i > 0; i--) {
		s = (s * 9301 + 49297) % 233280;
		const j = Math.floor((s / 233280) * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function planejar() {
	const todos = quizzes();
	const usados = new Set(todos.flatMap(({quiz}) => quiz.perguntas.flatMap((p) => [...(p.pistas ?? []), ...(p.imagens ?? [])]).map(chave)));
	const respostas = new Set(todos.flatMap(({quiz}) => quiz.perguntas.map((p) => (p.resposta ?? '').toLowerCase())));
	const catalogo = JSON.parse(fs.readFileSync(path.join(RAIZ, 'config', 'catalogo-animais.json'), 'utf8'));
	const livres = catalogo.filter((a) => !usados.has(a.id) && !respostas.has(a.nome.toLowerCase()));
	if (livres.length >= MIN_NOVOS) {
		const lote = livres.slice(0, POR_EPISODIO);
		const ep = proximoEp('qual-animal');
		log('diario', `${ep}: ${lote.length} animais novos do catálogo (restam ${livres.length - lote.length})`);
		saida('modo', 'novos');
		saida('ep', ep);
		saida('animais', lote.map((a) => a.id).join(','));
		saida('pedidos', JSON.stringify(Object.fromEntries(lote.map((a) => [a.id, a.prompt]))));
		return;
	}
	// Catálogo esgotado: quiz de sombras com animais 3D já usados, sem repetir sombras até passar por todos
	const ep = proximoEp('sombra');
	const desafios = new Map();
	for (const {quiz} of todos) {
		if (!quiz.unico || quiz.sombra) continue;
		for (const p of quiz.perguntas) if (p.pistas?.[0]?.startsWith('IA ')) desafios.set(p.pistas[0], p);
	}
	const jaSombra = new Set(todos.filter(({quiz}) => quiz.sombra && quiz.unico).flatMap(({quiz}) => quiz.perguntas.map((p) => p.pistas[0])));
	let candidatos = [...desafios.keys()].filter((k) => !jaSombra.has(k));
	if (candidatos.length < 20) candidatos = [...desafios.keys()];
	const escolha = embaralhar(candidatos, Number(ep.slice(2, 5))).slice(0, SOMBRAS).map((k) => desafios.get(k));
	const n = escolha.length;
	const quiz = {
		id: ep, tipo: 'emoji', categoria: 'animais', canal: 'Quiz do Reino', marca: 'Reino Animal', selo: '🐾', craque: 'Craque dos Animais',
		tema: 'Animais', fonte: 'Curiosidades de animais (texto infantil próprio)', pergunta: 'De quem é essa sombra?', sombra: true, unico: true,
		titulo: `🔍 De Quem é Essa Sombra? ${n} Animais Misteriosos! | Quiz de Animais para Crianças`,
		chamada: 'DE QUEM É A SOMBRA?', faixa: `${n} Sombras`, icones: [escolha[0].pistas[0], escolha[1].pistas[0]],
		capa: {texto: 'DE QUEM É A SOMBRA?', misterio: escolha[0].pistas[0], revelado: escolha[1].pistas[0], faixa: `${n} sombras`},
		licao: 'Cada animal tem um formato único: olhando com atenção, a gente descobre tudo!',
		abertura: `Oi, criançada! Hoje o desafio é pela sombra! São ${n} animais misteriosos. Olhe bem o formato e descubra: de quem é essa sombra? Vamos lá!`,
		encerramento: 'Uau, que olhos espertos! Quantas sombras você acertou? Conte para a família e até o próximo quiz!',
		perguntas: escolha.map(({pistas, resposta, explicacao, referencia}) => ({pistas, resposta, explicacao, referencia})),
	};
	fs.mkdirSync(path.join(RAIZ, 'episodios', ep), {recursive: true});
	fs.writeFileSync(path.join(RAIZ, 'episodios', ep, 'quiz.json'), JSON.stringify(quiz, null, 1));
	log('diario', `${ep}: catálogo esgotado; quiz de sombras com ${n} animais já desenhados`);
	saida('modo', 'sombra');
	saida('ep', ep);
}

if (process.argv[2] === 'planejar') planejar();
else console.log('uso: node scripts/diario.mjs planejar');
