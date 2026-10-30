// Publicação no YouTube pela API oficial (OAuth do próprio canal; sem bibliotecas extras).
// Credenciais ficam fora do projeto, em ~/.config/pequenos-sabios/ (permissão 600). Nada é impresso no terminal.
//
//   node scripts/publicar.mjs autorizar [--idioma=en|es]  uma vez: abre o consentimento do Google (com --idioma: canal
//                                                         separado daquele idioma, token em token-<idioma>.json)
//   node scripts/publicar.mjs enviar ep001-noe [--quando=2026-10-25T12:00:00-03:00]
//   node scripts/publicar.mjs metricas                    salva visualizações/likes em logs/metricas.csv
//   node scripts/publicar.mjs seo [--idioma=en|es]        descrição/palavras-chave/país do canal (config/canal.json → seo)
//                                                         e coloca os vídeos já enviados nas playlists de cada tema
//
// Regras de segurança:
//  - só envia se saida/<id>/relatorio.json tiver "pronto": true (render validado, voz ElevenLabs);
//  - enquanto config/canal.json tiver "publicacaoAutomatica": false, exige o arquivo episodios/<id>/APROVADO
//    (criado pelo senhor após assistir);
//  - Made for Kids sempre declarado; categoria Educação; nunca envia o mesmo episódio duas vezes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {RAIZ, FPS, episodio, log} from './lib.mjs';

const CONF = path.join(os.homedir(), '.config', 'pequenos-sabios');
const CLIENTE = path.join(CONF, 'client_secret.json');
// Um token por canal: português (token.json) e os canais separados em inglês e espanhol (token-en.json, token-es.json)
const tokenDe = (idioma) => path.join(CONF, idioma && idioma !== 'pt' ? `token-${idioma}.json` : 'token.json');
let TOKEN = tokenDe(process.argv.find((a) => a.startsWith('--idioma='))?.split('=')[1]);
// "youtube" libera playlists e a descrição do canal (seo); tokens antigos sem ele continuam enviando vídeos
const ESCOPOS = ['https://www.googleapis.com/auth/youtube', 'https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/yt-analytics.readonly'];
const canal = JSON.parse(fs.readFileSync(path.join(RAIZ, 'config', 'canal.json'), 'utf8'));

function cliente() {
	if (!fs.existsSync(CLIENTE)) throw new Error(`Falta ${CLIENTE} (baixe o JSON do cliente OAuth "App para computador" no Google Cloud)`);
	const c = JSON.parse(fs.readFileSync(CLIENTE, 'utf8'));
	return c.installed ?? c.web;
}

function salvarSeguro(arq, dados) {
	fs.mkdirSync(path.dirname(arq), {recursive: true, mode: 0o700});
	fs.writeFileSync(arq, JSON.stringify(dados), {mode: 0o600});
}

async function autorizar() {
	const c = cliente();
	const verificador = crypto.randomBytes(32).toString('base64url');
	const desafio = crypto.createHash('sha256').update(verificador).digest('base64url');
	const estado = crypto.randomBytes(16).toString('hex');
	const porta = 8765;
	const redirect = `http://127.0.0.1:${porta}`;
	const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({client_id: c.client_id, redirect_uri: redirect, response_type: 'code', scope: ESCOPOS.join(' '), access_type: 'offline', prompt: 'consent', state: estado, code_challenge: desafio, code_challenge_method: 'S256'})}`;
	const codigo = await new Promise((ok, falha) => {
		const srv = http.createServer((req, res) => {
			const q = new URL(req.url, redirect).searchParams;
			if (q.get('state') !== estado) return res.end('Estado inválido.');
			res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'});
			res.end('Pequenos Sábios autorizado. Pode fechar esta aba.');
			srv.close();
			q.get('code') ? ok(q.get('code')) : falha(new Error(q.get('error') ?? 'sem código'));
		}).listen(porta, '127.0.0.1');
		console.log(`Abra este endereço no navegador, com a conta do canal, e autorize:\n${url}`);
	});
	const r = await fetch('https://oauth2.googleapis.com/token', {method: 'POST', body: new URLSearchParams({code: codigo, client_id: c.client_id, client_secret: c.client_secret, redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verificador})});
	const t = await r.json();
	if (!t.refresh_token) throw new Error(`Google não devolveu refresh_token: ${t.error ?? r.status}`);
	salvarSeguro(TOKEN, {refresh_token: t.refresh_token});
	log('publicar', 'canal autorizado (token salvo em ~/.config/pequenos-sabios)');
}

async function acesso() {
	if (!fs.existsSync(TOKEN)) throw new Error('Rode antes: node scripts/publicar.mjs autorizar');
	const c = cliente();
	const {refresh_token} = JSON.parse(fs.readFileSync(TOKEN, 'utf8'));
	const r = await fetch('https://oauth2.googleapis.com/token', {method: 'POST', body: new URLSearchParams({refresh_token, client_id: c.client_id, client_secret: c.client_secret, grant_type: 'refresh_token'})});
	const t = await r.json();
	// App em modo de teste no Google: a autorização vence a cada 7 dias; basta rodar "autorizar" de novo
	if (!t.access_token) throw new Error(`Falha ao renovar acesso: ${t.error ?? r.status} (rode "node scripts/publicar.mjs autorizar" de novo)`);
	return t.access_token;
}

const mmss = (q) => `${Math.floor(q / FPS / 60)}:${String(Math.floor((q / FPS) % 60)).padStart(2, '0')}`;

export function metadados(id) {
	const {quiz} = episodio(id);
	const tl = JSON.parse(fs.readFileSync(path.join(RAIZ, 'public', 'ep', id, 'timeline.json'), 'utf8'));
	const capitulos = [`0:00 Abertura`, ...tl.cenas.filter((c) => c.tipo === 'numero').map((c) => `${mmss(c.inicio)} ${quiz.tipo === 'emoji' ? `Desafio ${c.i + 1}` : `Pergunta ${c.i + 1}`}`), `${mmss(tl.cenas.at(-1).inicio)} Lição de hoje`];
	const descricao = [
		quiz.tipo === 'emoji'
			? `Você consegue adivinhar o personagem ou a história da Bíblia só pelos emojis? São ${quiz.perguntas.length} desafios para crianças de 5 a 9 anos, com cronômetro e uma explicação bíblica em cada resposta.`
			: `${quiz.tema}: um quiz bíblico para crianças de 5 a 9 anos, com ${quiz.perguntas.length} perguntas, alternativas A, B e C, cronômetro e explicação de cada resposta.`,
		'', `Lição: ${quiz.licao}`, '', `Base bíblica: ${quiz.fonte}.`, '',
		'Assista junto com seu filho e conversem sobre cada resposta! 💛', '', ...capitulos, '',
		`${canal.nome}: aprender a Bíblia brincando.`, '', canal.hashtags.join(' '),
	].join('\n');
	return {
		snippet: {title: quiz.titulo, description: descricao.slice(0, 4900), tags: [...canal.tags, quiz.tema, `quiz ${quiz.tema}`, ...(quiz.tipo === 'emoji' ? ['adivinhe pelos emojis', 'quiz de emojis', 'adivinhe o personagem bíblico'] : [])].slice(0, 20), categoryId: '27', defaultLanguage: 'pt-BR', defaultAudioLanguage: 'pt-BR'},
		status: {privacyStatus: 'private', selfDeclaredMadeForKids: true, embeddable: true, license: 'youtube'},
	};
}

// Short: uma pergunta do episódio, vertical, menos de 60 s
export function metadadosShort(id, n) {
	const {quiz} = episodio(id);
	const p = quiz.perguntas[n - 1];
	const emoji = quiz.tipo === 'emoji';
	return {
		snippet: {
			// Título único por short: o tema entra no título (antes vários saíam iguais, "Que história é essa?")
			title: emoji ? `${quiz.pergunta ?? 'Quem é?'} ${quiz.tema} pelos Emojis 🤔 Desafio ${n} | Quiz Bíblico Infantil #shorts`.slice(0, 100) : `${p.pergunta} 🤔 | Quiz Bíblico Infantil #shorts`.slice(0, 100),
			description: [`Você sabe a resposta? Um desafio do quiz "${quiz.tema}" para crianças de 5 a 9 anos.`, '', `${canal.nome}: aprender a Bíblia brincando.`, '', [...canal.hashtags, '#shorts'].join(' ')].join('\n'),
			tags: [...canal.tags, quiz.tema, 'shorts'].slice(0, 20), categoryId: '27', defaultLanguage: 'pt-BR', defaultAudioLanguage: 'pt-BR',
		},
		status: {privacyStatus: 'private', selfDeclaredMadeForKids: true, embeddable: true, license: 'youtube'},
	};
}

// Envio retomável (se a conexão cair, continua de onde parou)
async function subir(token, video, corpo, id) {
	const tamanho = fs.statSync(video).size;
	const ini = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
		method: 'POST', headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Length': String(tamanho), 'X-Upload-Content-Type': 'video/mp4'}, body: JSON.stringify(corpo),
	});
	if (!ini.ok) throw new Error(`YouTube recusou o início do envio: ${ini.status} ${(await ini.text()).slice(0, 300)}`);
	const sessao = ini.headers.get('location');
	let resposta;
	for (let tentativa = 1; tentativa <= 5; tentativa++) {
		const status = await fetch(sessao, {method: 'PUT', headers: {Authorization: `Bearer ${token}`, 'Content-Range': `bytes */${tamanho}`}});
		const enviado = status.status === 308 ? Number(status.headers.get('range')?.split('-')[1] ?? -1) + 1 : 0;
		if (status.ok) { resposta = await status.json(); break; }
		log('publicar', `${id}: enviando a partir de ${Math.round(enviado / 1e6)} MB (tentativa ${tentativa})`);
		const blob = (await fs.openAsBlob(video)).slice(enviado);
		const r = await fetch(sessao, {method: 'PUT', headers: {Authorization: `Bearer ${token}`, 'Content-Range': `bytes ${enviado}-${tamanho - 1}/${tamanho}`}, body: blob});
		if (r.ok) { resposta = await r.json(); break; }
		if (r.status < 500 && r.status !== 308) throw new Error(`Envio falhou: ${r.status} ${(await r.text()).slice(0, 300)}`);
		await new Promise((ok) => setTimeout(ok, 5000 * tentativa));
	}
	if (!resposta?.id) throw new Error('Envio não concluído após 5 tentativas');
	return resposta;
}

const TEXTOS = {
	pt: {codigo: 'pt-BR', short: 'Música Infantil Cristã', celular: 'Versão Celular', letra: '🎶 Letra:', licao: 'Lição', fonte: 'Base bíblica',
		descricao: (t) => `${t}: música infantil cristã para cantar e dançar com Davi, Lulu e Leleco!`, hashtags: ['#MúsicaInfantil', '#LouvorInfantil'],
		tags: ['música infantil cristã', 'louvor infantil', 'música gospel infantil', 'desenho infantil cristão', 'música para crianças']},
	en: {codigo: 'en', short: 'Christian Kids Song', celular: 'Phone Version', letra: '🎶 Lyrics:', licao: 'Lesson', fonte: 'Bible story',
		descricao: (t) => `${t}: a Christian song for kids to sing and dance along with David, Lulu and Leleco!`, hashtags: ['#KidsSongs', '#ChristianKidsSongs', '#BibleStoriesForKids'],
		tags: ['christian kids songs', 'bible songs for kids', 'kids worship songs', 'sunday school songs', 'nursery rhymes', 'kids songs', 'bible stories for kids', 'cartoon for kids']},
	es: {codigo: 'es', short: 'Canción Infantil Cristiana', celular: 'Versión Celular', letra: '🎶 Letra:', licao: 'Lección', fonte: 'Historia bíblica',
		descricao: (t) => `${t}: ¡una canción cristiana para que los niños canten y bailen con David, Lulu y Leleco!`, hashtags: ['#CancionesInfantiles', '#CancionesCristianasParaNiños', '#BibliaParaNiños'],
		tags: ['canciones cristianas para niños', 'canciones infantiles cristianas', 'alabanza infantil', 'canciones bíblicas para niños', 'canciones infantiles', 'historias bíblicas para niños', 'dibujos animados cristianos']},
};

// Clipe musical (musicas/<id>/musica.json): variante '' (16:9), 'vertical' (celular) ou 'short' (refrão, < 60 s)
async function enviarClipe(id, quando, variante) {
	const dir = path.join(RAIZ, 'musicas', id);
	const m = JSON.parse(fs.readFileSync(path.join(dir, 'musica.json'), 'utf8'));
	const sufixo = variante ? `-${variante}` : '';
	const registro = path.join(dir, `publicado${sufixo}.json`);
	if (fs.existsSync(registro)) return log('publicar', `${id}${sufixo} já foi enviado; nada a fazer`);
	const video = path.join(RAIZ, 'saida', 'clipes', `${id}${sufixo}.mp4`);
	const letra = m.partes.filter((p) => p.tipo !== 'final').flatMap((p) => [...p.letra, '']).join('\n');
	// Versões em inglês/espanhol vão para o canal daquele idioma (token próprio), com textos no idioma
	const L = TEXTOS[m.idioma ?? 'pt'];
	TOKEN = tokenDe(m.idioma);
	const titulo = variante === 'short' ? `${m.titulo} 🎵 ${L.short} #shorts` : variante === 'vertical' ? `${m.tituloYoutube} | ${L.celular}` : m.tituloYoutube;
	const ptBR = !m.idioma || m.idioma === 'pt';
	const corpo = {
		snippet: {
			title: titulo.slice(0, 100),
			description: [m.descricao ?? L.descricao(m.titulo), '', m.licao ? `${L.licao}: ${m.licao}` : '', m.fonte ? `${L.fonte}: ${m.fonte}.` : '', '',
				L.letra, letra, ptBR ? `${canal.nome}: louvor e Bíblia para crianças.` : '', '', [...(ptBR ? canal.hashtags : []), ...L.hashtags, ...(variante === 'short' ? ['#shorts'] : [])].join(' ')].filter((l, k, a) => l || a[k - 1]).join('\n').slice(0, 4900),
			tags: [...L.tags, m.titulo, ...(m.tags ?? []), ...(ptBR ? canal.tags : [])].slice(0, 20),
			categoryId: '10', defaultLanguage: L.codigo, defaultAudioLanguage: L.codigo,
		},
		status: {privacyStatus: 'private', selfDeclaredMadeForKids: true, embeddable: true, license: 'youtube'},
	};
	if (quando) corpo.status.publishAt = new Date(quando).toISOString();
	const token = await acesso();
	const resposta = await subir(token, video, corpo, id);
	fs.writeFileSync(registro, JSON.stringify({videoId: resposta.id, enviadoEm: new Date().toISOString(), publicarEm: corpo.status.publishAt ?? null}, null, 1));
	log('publicar', `${id}${sufixo} enviado: https://youtu.be/${resposta.id}`, {videoId: resposta.id});
	if (variante !== 'vertical') await naPlaylist(token, m.idioma, variante === 'short' ? 'shorts' : 'musicas', resposta.id);
	if (variante === 'short') return;
	const thumb = path.join(RAIZ, 'saida', 'clipes', `${id}.jpg`);
	const t = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${resposta.id}`, {method: 'POST', headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg'}, body: fs.readFileSync(thumb)});
	if (!t.ok) {
		// Canal sem verificação: guarda a capa e tenta de novo em cada rodada (miniaturas())
		fs.copyFileSync(thumb, path.join(dir, `miniatura${sufixo}.jpg`));
		fs.writeFileSync(path.join(dir, `MINIATURA-PENDENTE${sufixo}`), resposta.id);
	}
	log('publicar', t.ok ? `${id}${sufixo}: miniatura aplicada` : `${id}${sufixo}: miniatura recusada (${t.status}); tento de novo depois`);
}

async function enviar(id, quando, short = 0, vertical = false) {
	const {dir} = episodio(id);
	const saida = path.join(RAIZ, 'saida', id);
	const sufixo = short ? `-short${short}` : vertical ? '-vertical' : '';
	const registro = path.join(dir, `publicado${sufixo}.json`);
	if (fs.existsSync(registro)) return log('publicar', `${id}${sufixo} já foi enviado (${JSON.parse(fs.readFileSync(registro, 'utf8')).videoId}); nada a fazer`);
	const rel = JSON.parse(fs.readFileSync(path.join(saida, `relatorio${sufixo}.json`), 'utf8'));
	if (!rel.pronto) throw new Error(`${id} não passou na validação: ${rel.problemas.join('; ') || 'voz de prévia'}`);
	if (!canal.publicacaoAutomatica && !fs.existsSync(path.join(dir, 'APROVADO'))) throw new Error(`${id} aguarda aprovação: assista e crie episodios/${id}/APROVADO`);

	const corpo = short ? metadadosShort(id, short) : metadados(id);
	if (vertical) corpo.snippet.title = `${corpo.snippet.title.replace(/ \| Quiz Bíblico Infantil$/, '')} | Versão Celular`.slice(0, 100);
	if (quando) corpo.status.publishAt = new Date(quando).toISOString(); // fica privado e o YouTube publica sozinho nessa hora
	const token = await acesso();
	const resposta = await subir(token, path.join(saida, rel.video), corpo, id);
	fs.writeFileSync(registro, JSON.stringify({videoId: resposta.id, enviadoEm: new Date().toISOString(), publicarEm: corpo.status.publishAt ?? null}, null, 1));
	log('publicar', `${id}${sufixo} enviado: https://youtu.be/${resposta.id}`, {videoId: resposta.id});
	if (!vertical) await naPlaylist(token, 'pt', short ? 'shorts' : episodio(id).quiz.tipo === 'emoji' ? 'emojis' : 'quiz', resposta.id);
	if (short) return; // Shorts usam um quadro do próprio vídeo como capa

	const thumb = path.join(saida, `${id}-thumbnail.jpg`);
	const t = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${resposta.id}`, {method: 'POST', headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg'}, body: fs.readFileSync(thumb)});
	const pendente = path.join(dir, 'MINIATURA-PENDENTE');
	// Guarda a miniatura junto do roteiro (vai para o repositório): na nuvem a pasta saida/ some ao fim da execução
	if (!t.ok) fs.copyFileSync(thumb, path.join(dir, 'miniatura.jpg'));
	if (t.ok) fs.rmSync(pendente, {force: true});
	else fs.writeFileSync(pendente, resposta.id); // o robô tenta de novo em cada rodada
	log('publicar', t.ok ? `${id}: miniatura aplicada` : `${id}: miniatura recusada (${t.status}); o canal precisa estar verificado por telefone (youtube.com/verify); tento de novo depois`);
}

// Reaplica miniaturas recusadas antes (ex.: canal ainda não verificado por telefone)
async function miniaturas() {
	const token = await acesso();
	for (const ep of fs.readdirSync(path.join(RAIZ, 'episodios'))) {
		const pendente = path.join(RAIZ, 'episodios', ep, 'MINIATURA-PENDENTE');
		if (!fs.existsSync(pendente)) continue;
		const videoId = fs.readFileSync(pendente, 'utf8').trim();
		const arquivo = [path.join(RAIZ, 'episodios', ep, 'miniatura.jpg'), path.join(RAIZ, 'saida', ep, `${ep}-thumbnail.jpg`)].find((f) => fs.existsSync(f));
		if (!arquivo) {
			log('publicar', `${ep}: miniatura pendente sem arquivo (episodios/${ep}/miniatura.jpg)`);
			continue;
		}
		const t = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`, {method: 'POST', headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg'}, body: fs.readFileSync(arquivo)});
		if (t.ok) {
			fs.rmSync(pendente);
			fs.rmSync(path.join(RAIZ, 'episodios', ep, 'miniatura.jpg'), {force: true});
			log('publicar', `${ep}: miniatura aplicada`);
		}
	}
	const musicas = path.join(RAIZ, 'musicas');
	for (const mu of fs.existsSync(musicas) ? fs.readdirSync(musicas) : []) {
		// versões de outros idiomas estão em outros canais (outro token): ficam para quando houver rotina por canal
		const idioma = fs.existsSync(path.join(musicas, mu, 'musica.json')) ? JSON.parse(fs.readFileSync(path.join(musicas, mu, 'musica.json'), 'utf8')).idioma : undefined;
		if (idioma && idioma !== 'pt') continue;
		for (const f of fs.readdirSync(path.join(musicas, mu)).filter((f) => f.startsWith('MINIATURA-PENDENTE'))) {
			const sufixo = f.replace('MINIATURA-PENDENTE', '');
			const pendente = path.join(musicas, mu, f);
			const capa = path.join(musicas, mu, `miniatura${sufixo}.jpg`);
			const t = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${fs.readFileSync(pendente, 'utf8').trim()}`, {method: 'POST', headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg'}, body: fs.readFileSync(capa)});
			if (t.ok) {
				fs.rmSync(pendente);
				fs.rmSync(capa, {force: true});
				log('publicar', `${mu}${sufixo}: miniatura aplicada`);
			}
		}
	}
}

async function api(token, metodo, rota, corpo) {
	const r = await fetch(`https://www.googleapis.com/youtube/v3/${rota}`, {method: metodo, headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'}, body: corpo && JSON.stringify(corpo)});
	const d = await r.json().catch(() => ({}));
	if (!r.ok) throw new Error(`${rota.split('?')[0]}: ${d.error?.message ?? r.status}`);
	return d;
}

// Playlists por tema (config/canal.json → seo.<idioma>.playlists): aparecem na busca e encadeiam um vídeo no outro.
// Achadas pelo título a cada uso (sem guardar ids), criadas se faltarem. Falha aqui nunca derruba o envio.
async function playlist(token, idioma, chave) {
	const p = canal.seo?.[idioma ?? 'pt']?.playlists?.[chave];
	if (!p) return null;
	const minhas = await api(token, 'GET', 'playlists?part=snippet&mine=true&maxResults=50');
	const achada = minhas.items?.find((i) => i.snippet.title === p.titulo);
	if (achada) return achada.id;
	const nova = await api(token, 'POST', 'playlists?part=snippet,status', {snippet: {title: p.titulo, description: p.descricao, defaultLanguage: canal.seo[idioma ?? 'pt'].idioma}, status: {privacyStatus: 'public'}});
	log('publicar', `playlist criada: ${p.titulo}`);
	return nova.id;
}

async function naPlaylist(token, idioma, chave, videoId) {
	try {
		const id = await playlist(token, idioma, chave);
		if (id) await api(token, 'POST', 'playlistItems?part=snippet', {snippet: {playlistId: id, resourceId: {kind: 'youtube#video', videoId}}});
	} catch (e) {
		log('publicar', `playlist ${chave}: ${e.message} (autorização antiga sem o escopo "youtube": rode autorizar de novo)`);
	}
}

// Ajusta o canal para busca: descrição, palavras-chave, país e idioma; e põe nas playlists os vídeos que ainda não estão
async function seo() {
	const idioma = process.argv.find((a) => a.startsWith('--idioma='))?.split('=')[1] ?? 'pt';
	const s = canal.seo?.[idioma];
	if (!s) throw new Error(`config/canal.json não tem seo.${idioma}`);
	const token = await acesso();
	const ch = (await api(token, 'GET', 'channels?part=brandingSettings,contentDetails&mine=true')).items[0];
	const palavras = s.palavrasChave.map((k) => (k.includes(' ') ? `"${k}"` : k)).join(' ').slice(0, 500);
	await api(token, 'PUT', 'channels?part=brandingSettings', {id: ch.id, brandingSettings: {channel: {...ch.brandingSettings.channel, description: s.descricao, keywords: palavras, defaultLanguage: s.idioma, country: s.pais}}});
	// Uma só tradução, no idioma do canal: as antigas usavam outros nomes ("Pequenos Sábios", "Little Wise Ones")
	await api(token, 'PUT', 'channels?part=localizations', {id: ch.id, localizations: {[s.idioma.replace('-', '_')]: {title: s.nome, description: s.descricao}}});
	log('publicar', `canal ${s.nome}: descrição, palavras-chave e país (${s.pais}) atualizados`);

	const enviados = [];
	for (let pagina = ''; ;) {
		const d = await api(token, 'GET', `playlistItems?part=snippet&maxResults=50&playlistId=${ch.contentDetails.relatedPlaylists.uploads}${pagina && `&pageToken=${pagina}`}`);
		enviados.push(...d.items.map((i) => ({id: i.snippet.resourceId.videoId, titulo: i.snippet.title})));
		if (!(pagina = d.nextPageToken)) break;
	}
	for (const chave of Object.keys(s.playlists)) {
		const alvo = s.playlists[chave].regra && new RegExp(s.playlists[chave].regra, 'i');
		const pl = await playlist(token, idioma, chave);
		const ja = new Set((await api(token, 'GET', `playlistItems?part=contentDetails&maxResults=50&playlistId=${pl}`)).items.map((i) => i.contentDetails.videoId));
		// Versões celular repetem o vídeo horizontal: ficam fora das playlists
		const novos = enviados.filter((v) => alvo?.test(v.titulo) && !/Versão Celular|Phone Version|Versión Celular/.test(v.titulo) && !ja.has(v.id));
		for (const v of novos.reverse()) await api(token, 'POST', 'playlistItems?part=snippet', {snippet: {playlistId: pl, resourceId: {kind: 'youtube#video', videoId: v.id}}});
		log('publicar', `playlist ${s.playlists[chave].titulo}: +${novos.length} vídeo(s)`);
	}
}

async function metricas() {
	const token = await acesso();
	const ids = fs.readdirSync(path.join(RAIZ, 'episodios')).flatMap((ep) => fs.readdirSync(path.join(RAIZ, 'episodios', ep)).filter((f) => /^publicado.*\.json$/.test(f)).map((f) => [`${ep}${f.replace(/^publicado|\.json$/g, '')}`, JSON.parse(fs.readFileSync(path.join(RAIZ, 'episodios', ep, f), 'utf8')).videoId]));
	if (!ids.length) return log('metricas', 'nenhum vídeo publicado ainda');
	const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,status&id=${ids.map(([, v]) => v).join(',')}`, {headers: {Authorization: `Bearer ${token}`}});
	const d = await r.json();
	const csv = path.join(RAIZ, 'logs', 'metricas.csv');
	if (!fs.existsSync(csv)) fs.writeFileSync(csv, 'data,episodio,videoId,status,visualizacoes,likes\n');
	const hoje = new Date().toISOString().slice(0, 10);
	for (const v of d.items ?? []) {
		const ep = ids.find(([, id]) => id === v.id)[0];
		fs.appendFileSync(csv, `${hoje},${ep},${v.id},${v.status.privacyStatus},${v.statistics.viewCount ?? 0},${v.statistics.likeCount ?? 0}\n`);
	}
	log('metricas', `${d.items?.length ?? 0} vídeos registrados em logs/metricas.csv`);
}

const [acao, id] = process.argv.slice(2);
const quando = process.argv.find((a) => a.startsWith('--quando='))?.split('=')[1];
try {
	if (acao === 'autorizar') await autorizar();
	else if (acao === 'enviar') await enviar(id, quando, Number(process.argv.find((a) => a.startsWith('--short='))?.split('=')[1]) || 0, process.argv.includes('--vertical'));
	else if (acao === 'clipe') await enviarClipe(id, quando, process.argv.includes('--vertical') ? 'vertical' : process.argv.includes('--short') ? 'short' : '');
	else if (acao === 'metricas') await metricas();
	else if (acao === 'miniaturas') await miniaturas();
	else if (acao === 'seo') await seo();
	else if (acao === 'descricao') console.log(JSON.stringify(metadados(id), null, 1));
	else console.log('Ações: autorizar | enviar <id> [--quando=ISO] | metricas | seo [--idioma=en|es] | descricao <id>');
} catch (e) {
	log('publicar', `ERRO: ${e.message}`);
	process.exit(1);
}
