import {
	obtenerViewStateInicial,
	buscarPrimeraPagina,
	irAPagina,
	parsearTabla,
	extraerNuevoViewState,
	descargarPDF,
	limpiarNombreArchivo,
	esperar,
	conReintentos,
} from './src/scraper.ts';

async function main() {
	let viewState = await obtenerViewStateInicial();
	let dtFirst = 0;
	let totalDescargados = 0;
	let xml = await conReintentos(() => buscarPrimeraPagina(viewState), 'Búsqueda inicial');
	
	while (dtFirst < 30) {
		const registros = parsearTabla(xml);
		viewState = extraerNuevoViewState(xml);
		for (const registro of registros) {
			const nombreArchivo = limpiarNombreArchivo(`${registro.expediente}_${registro.resolucion}.pdf`);
			await conReintentos(() => descargarPDF(viewState, registro.componente, registro.uuid, nombreArchivo), `Descarga PDF ${registro.expediente}`);
			totalDescargados++;
			await esperar(1500);
		}
		
		console.log(`Página procesada, dtFirst=${dtFirst}, total descargados=${totalDescargados}`);
		dtFirst += 10;
		await esperar(1500);
		
		if (dtFirst < 30) {
			xml = await conReintentos(() => irAPagina(viewState, dtFirst), 'Búsqueda de siguientes páginas');	// Páginas siguientes con el evento de paginación real
		}
	}
	
	console.log(`Proceso terminado. Total de PDFs descargados: ${totalDescargados}`);
}

main();