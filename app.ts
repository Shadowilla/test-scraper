import { obtenerViewStateInicial, buscarPagina, parsearTabla } from './src/scraper.ts';

async function main() {
	const viewState = await obtenerViewStateInicial();
	const xml = await buscarPagina(viewState, 0);
	const registros = parsearTabla(xml);
	console.log(`Se encontraron ${registros.length} registros`);
	console.log(registros[0]); // Primer registro para inspección
}

main();