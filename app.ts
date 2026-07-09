import { obtenerViewStateInicial, buscarPagina, parsearTabla, extraerNuevoViewState, descargarPDF } from './src/scraper.ts';
/*async function main() {
	let viewState = await obtenerViewStateInicial();
	let registrosTotales: any[] = [];
	let dtFirst = 0;
	
	while (dtFirst < 30) {
		const xml = await buscarPagina(viewState, dtFirst);
		const registros = parsearTabla(xml);
		registrosTotales.push(...registros);
		console.log(`Se encontraron ${registros.length} registros`);
		viewState = extraerNuevoViewState(xml);
		console.log(`Página procesada, dtFirst=${dtFirst}, total acumulado=${registrosTotales.length}`);
		dtFirst += 10;
		await esperar(1500);
	}
	
	console.log(`Total de registros = ${registrosTotales.length}`);
	await descargarPDF(viewState, 'listarDetalleInfraccionRAAForm:dt:0:j_idt63', '153a6d2a-cbed-40ef-b8ef-cd2272b19867', 'prueba.pdf');
}*/

async function main() {
	let viewState = await obtenerViewStateInicial();

	const xml = await buscarPagina(viewState, 0);
	const registros = parsearTabla(xml);
	viewState = extraerNuevoViewState(xml);

	console.log('Primer registro:', registros[0]);

	await descargarPDF(
		viewState,
		registros[0].componente,
		registros[0].uuid,
		'prueba.pdf'
	);
}

function esperar(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

main();