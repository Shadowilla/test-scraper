import { obtenerViewStateInicial, parsearTabla, extraerNuevoViewState, descargarPDF,  limpiarNombreArchivo, buscarPrimeraPagina, irAPagina} from './src/scraper.ts';
async function main() {
	let viewState = await obtenerViewStateInicial();
	let dtFirst = 0;
	let totalDescargados = 0;
	let xml = await buscarPrimeraPagina(viewState);
	
	while (dtFirst < 30) {
		const registros = parsearTabla(xml);
		viewState = extraerNuevoViewState(xml);
		for (const registro of registros) {
			const nombreArchivo = limpiarNombreArchivo(`${registro.expediente}_${registro.resolucion}.pdf`);
			await descargarPDF(viewState, registro.componente, registro.uuid, nombreArchivo);
			totalDescargados++;
			await esperar(1500);
		}
		
		console.log(`Página procesada, dtFirst=${dtFirst}, total descargados=${totalDescargados}`);
		dtFirst += 10;
		await esperar(1500);
		
		if (dtFirst < 30) {
			xml = await irAPagina(viewState, dtFirst);	// Páginas siguientes con el evento de paginación real
		}
	}
	
	console.log(`Proceso terminado. Total de PDFs descargados: ${totalDescargados}`);
}

function esperar(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

main();