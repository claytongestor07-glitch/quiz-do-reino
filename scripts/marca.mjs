// Renderiza a foto de perfil e a capa do canal em saida/marca/. Uso: node scripts/marca.mjs
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
const R = '/Users/pro/PequenosSabios';
const browserExecutable = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const serveUrl = await bundle({entryPoint: path.join(R, 'src', 'index.ts'), publicDir: path.join(R, 'public')});
for (const [id, out, fmt] of [['Logo', 'logo.png', 'png'], ['Banner', 'capa.jpg', 'jpeg']]) {
	const composition = await selectComposition({serveUrl, id, inputProps: {}, browserExecutable});
	await renderStill({serveUrl, composition, inputProps: {}, browserExecutable, output: path.join(R, 'saida', 'marca', out), imageFormat: fmt, ...(fmt === 'jpeg' ? {jpegQuality: 90} : {})});
	console.log('ok', out);
}
