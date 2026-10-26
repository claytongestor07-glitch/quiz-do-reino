// Painel ao vivo da produção no GitHub Actions: etapas, barra de progresso e tempo restante estimado.
// Uso: node scripts/painel.mjs   (atualiza a cada 15 s; Ctrl-C para sair)
import {execFileSync} from 'node:child_process';

const REPO = 'claytongestor07-glitch/quiz-do-reino';
const GH = '/Users/pro/bin/gh';
const api = (p) => JSON.parse(execFileSync(GH, ['api', `repos/${REPO}/${p}`], {encoding: 'utf8'}));
const min = (ms) => (ms < 60e3 ? `${Math.round(ms / 1e3)} s` : `${Math.floor(ms / 60e3)} min`);
const barra = (f, n = 30) => '█'.repeat(Math.round(f * n)) + '░'.repeat(n - Math.round(f * n));
// Durações típicas (min) para estimar o que ainda não começou; ajustadas pelo que já terminou
const TIPICO = {preparo: 6, narracao: 12, render: 40, final: 25};

function desenhar() {
	const [run] = api('actions/runs?per_page=1').workflow_runs;
	if (!run) return console.log('Nenhuma produção ainda.');
	const jobs = api(`actions/runs/${run.id}/jobs?per_page=100`).jobs;
	const agora = Date.now();
	const dur = (j) => (j.completed_at ? Date.parse(j.completed_at) : agora) - Date.parse(j.started_at ?? new Date(agora).toISOString());
	const plan = jobs.find((j) => j.name === 'planejar');
	const renders = jobs.filter((j) => j.name.startsWith('render'));
	const fin = jobs.find((j) => j.name === 'finalizar');
	const feitos = renders.filter((j) => j.status === 'completed');
	const mediaRender = feitos.length ? feitos.reduce((s, j) => s + dur(j), 0) / feitos.length : TIPICO.render * 60e3;

	const linhas = [];
	const icone = (j) => (!j ? '⏳' : j.status === 'completed' ? (j.conclusion === 'success' ? '✅' : '❌') : j.status === 'in_progress' ? '🔄' : '⏳');
	let restante = 0;
	// 1. Preparo + narração
	if (plan) {
		const etapa = (plan.steps ?? []).find((s) => s.status === 'in_progress')?.name ?? '';
		const fase = /preparar/.test(etapa) ? 'instalando ferramentas' : /planejar/.test(etapa) ? 'gerando a narração (voz Dora)' : etapa;
		linhas.push(`${icone(plan)} 1. Preparar e narrar       ${plan.status === 'completed' ? min(dur(plan)) : `${fase} · ${min(dur(plan))}`}`);
		if (plan.status !== 'completed') restante += Math.max(2, TIPICO.preparo + TIPICO.narracao - dur(plan) / 60e3) * 60e3;
	} else linhas.push('⏳ 1. Preparar e narrar');
	// 2. Render em paralelo
	if (renders.length) {
		const f = feitos.length / renders.length;
		linhas.push(`${feitos.length === renders.length ? '✅' : '🔄'} 2. Renderizar (paralelo)  ${barra(f)} ${feitos.length}/${renders.length} trechos`);
		const rodando = renders.filter((j) => j.status === 'in_progress');
		if (feitos.length < renders.length) restante += Math.max(0, mediaRender - (rodando.length ? Math.min(...rodando.map(dur)) : 0));
		const falhas = renders.filter((j) => j.conclusion === 'failure').length;
		if (falhas) linhas.push(`   ⚠️  ${falhas} trecho(s) falharam`);
	} else {
		linhas.push('⏳ 2. Renderizar (paralelo)');
		restante += TIPICO.render * 60e3;
	}
	// 3. Juntar, Shorts e envio
	if (fin) {
		const etapa = (fin.steps ?? []).find((s) => s.status === 'in_progress')?.name ?? '';
		linhas.push(`${icone(fin)} 3. Juntar, Shorts e envio  ${fin.status === 'completed' ? min(dur(fin)) : `${etapa} · ${min(dur(fin))}`}`);
		if (fin.status !== 'completed') restante += Math.max(1, TIPICO.final - dur(fin) / 60e3) * 60e3;
	} else {
		linhas.push('⏳ 3. Juntar, Shorts e envio');
		restante += TIPICO.final * 60e3;
	}

	const fim = run.status === 'completed';
	const titulo = run.display_title || run.name;
	console.clear();
	console.log(`QUIZ DO REINO · produção na nuvem         ${new Date().toLocaleTimeString('pt-BR')}`);
	console.log(`${titulo} · iniciada há ${min(agora - Date.parse(run.run_started_at))}`);
	console.log('─'.repeat(64));
	linhas.forEach((l) => console.log(l));
	console.log('─'.repeat(64));
	if (fim) console.log(run.conclusion === 'success' ? '🎉 PRONTO!' : `❌ Terminou com problema (${run.conclusion}). O Jarvis vai verificar.`);
	else console.log(`⏱  Falta aproximadamente: ${min(restante)}  (pronto por volta de ${new Date(agora + restante).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})})`);
	console.log(`\n${run.html_url}`);
}

for (;;) {
	try { desenhar(); } catch (e) { console.log('Sem conexão com o GitHub, tentando de novo…', String(e.message).slice(0, 80)); }
	await new Promise((r) => setTimeout(r, 15000));
}
