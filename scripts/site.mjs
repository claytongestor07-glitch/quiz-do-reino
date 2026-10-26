// Publica a pasta site/ no Firebase Hosting do projeto, pela API REST oficial (sem login manual de CLI).
// A autorização é pedida uma vez no navegador (escopo firebase.hosting) e fica em ~/.config/pequenos-sabios/.
// Uso: node scripts/site.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {RAIZ, log} from './lib.mjs';

const CONF = path.join(os.homedir(), '.config', 'pequenos-sabios');
const TOKEN = path.join(CONF, 'token-hosting.json');
const c = JSON.parse(fs.readFileSync(path.join(CONF, 'client_secret.json'), 'utf8')).installed;
const PROJETO = c.project_id;
const API = 'https://firebasehosting.googleapis.com/v1beta1';

async function autorizar() {
	const verificador = crypto.randomBytes(32).toString('base64url');
	const desafio = crypto.createHash('sha256').update(verificador).digest('base64url');
	const estado = crypto.randomBytes(16).toString('hex');
	const redirect = 'http://127.0.0.1:8766';
	const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({client_id: c.client_id, redirect_uri: redirect, response_type: 'code', scope: 'https://www.googleapis.com/auth/firebase.hosting', access_type: 'offline', prompt: 'consent', state: estado, code_challenge: desafio, code_challenge_method: 'S256'})}`;
	const codigo = await new Promise((ok, falha) => {
		const srv = http.createServer((req, res) => {
			const q = new URL(req.url, redirect).searchParams;
			if (q.get('state') !== estado) return res.end('Estado inválido.');
			res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'});
			res.end('Site do Pequenos Sábios autorizado. Pode fechar esta aba.');
			srv.close();
			q.get('code') ? ok(q.get('code')) : falha(new Error(q.get('error') ?? 'sem código'));
		}).listen(8766, '127.0.0.1');
		console.log(`Abra e autorize:\n${url}`);
	});
	const t = await (await fetch('https://oauth2.googleapis.com/token', {method: 'POST', body: new URLSearchParams({code: codigo, client_id: c.client_id, client_secret: c.client_secret, redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verificador})})).json();
	if (!t.refresh_token) throw new Error(`sem refresh_token: ${t.error}`);
	fs.writeFileSync(TOKEN, JSON.stringify({refresh_token: t.refresh_token}), {mode: 0o600});
}

async function acesso() {
	if (!fs.existsSync(TOKEN)) await autorizar();
	const {refresh_token} = JSON.parse(fs.readFileSync(TOKEN, 'utf8'));
	const t = await (await fetch('https://oauth2.googleapis.com/token', {method: 'POST', body: new URLSearchParams({refresh_token, client_id: c.client_id, client_secret: c.client_secret, grant_type: 'refresh_token'})})).json();
	if (!t.access_token) {
		fs.rmSync(TOKEN, {force: true});
		throw new Error(`autorização do Hosting inválida (${t.error}); rode de novo`);
	}
	return t.access_token;
}

const token = await acesso();
const api = async (metodo, url, corpo) => {
	const r = await fetch(url.startsWith('http') ? url : `${API}/${url}`, {method: metodo, headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-goog-user-project': PROJETO}, body: corpo ? JSON.stringify(corpo) : undefined});
	const texto = await r.text();
	if (!r.ok) throw new Error(`${metodo} ${url}: ${r.status} ${texto.slice(0, 300)}`);
	return texto ? JSON.parse(texto) : {};
};

// Site padrão do projeto (criado junto com o Firebase); se não existir, cria
let site = `sites/${PROJETO}`;
const lista = await api('GET', `projects/${PROJETO}/sites`);
if (lista.sites?.length) site = lista.sites[0].name.replace(/^projects\/[^/]+\//, '');
else await api('POST', `projects/${PROJETO}/sites?siteId=${PROJETO}`, {});

const pasta = path.join(RAIZ, 'site');
const arquivos = {};
const conteudo = {};
for (const nome of fs.readdirSync(pasta)) {
	const gz = zlib.gzipSync(fs.readFileSync(path.join(pasta, nome)), {level: 9});
	const hash = crypto.createHash('sha256').update(gz).digest('hex');
	arquivos[`/${nome}`] = hash;
	conteudo[hash] = gz;
}
const versao = await api('POST', `${site}/versions`, {config: {headers: [{glob: '**', headers: {'Cache-Control': 'max-age=300'}}]}});
const pop = await api('POST', `${versao.name}:populateFiles`, {files: arquivos});
for (const hash of pop.uploadRequiredHashes ?? []) {
	const r = await fetch(`${pop.uploadUrl}/${hash}`, {method: 'POST', headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream'}, body: conteudo[hash]});
	if (!r.ok) throw new Error(`envio de ${hash.slice(0, 8)} falhou: ${r.status}`);
}
await api('PATCH', `${versao.name}?update_mask=status`, {status: 'FINALIZED'});
await api('POST', `${site}/releases?versionName=${versao.name}`, {message: 'Site do canal Pequenos Sábios'});
const id = site.split('/').pop();
log('site', `publicado: https://${id}.web.app (${Object.keys(arquivos).length} arquivos)`);
