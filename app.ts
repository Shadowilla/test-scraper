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
	registrarError,
} from './src/scraper.ts';

async function main() {
	let viewState = await obtenerViewStateInicial();
	let totalDescargados = 0;
		
	//for (let dtFirst = 0; dtFirst < 1760; dtFirst += 10) {	// Total de registros
	for (let dtFirst = 0; dtFirst < 30; dtFirst += 10) {	// 30 registros de prueba
		let xml: string;
		
		try {
			if (dtFirst === 0) {
				xml = await conReintentos(() => buscarPrimeraPagina(viewState), 'Búsqueda inicial');
			}
			else {
				xml = await conReintentos(() => irAPagina(viewState, dtFirst), `Página dtFirst=${dtFirst}`);
			}
		}
		catch (error) {
			console.error(`No se pudo obtener la página dtFirst=${dtFirst}, se omite y se continúa con la siguiente.`);
			continue;	// Salta directo a la próxima vuelta del for (página siguiente), con el próximo dtFirst
		}
		
		const registros = parsearTabla(xml);
		viewState = extraerNuevoViewState(xml);
		
		for (const registro of registros) {
			try {
				const nombreArchivo = limpiarNombreArchivo(`${registro.expediente}_${registro.resolucion}.pdf`);
				await conReintentos(() => descargarPDF(viewState, registro.componente, registro.uuid, nombreArchivo), `Descarga PDF ${registro.expediente}`);
				totalDescargados++;
			}
			catch (error) {
				console.error(`Se agotaron los reintentos para ${registro.expediente}, se continúa con el siguiente.`);
			}
			await esperar(1500);
		}
		console.log(`Página procesada, dtFirst=${dtFirst}, total descargados=${totalDescargados}`);
		await esperar(1500);
	}
	console.log(`Proceso terminado. Total de PDFs descargados: ${totalDescargados}`);
}
	
	/*while (dtFirst < 30) {
		const registros = parsearTabla(xml);
		viewState = extraerNuevoViewState(xml);
		for (const registro of registros) {
			try {
				const nombreArchivo = limpiarNombreArchivo(`${registro.expediente}_${registro.resolucion}.pdf`);
				await conReintentos(() => descargarPDF(viewState, registro.componente, registro.uuid, nombreArchivo), `Descarga PDF ${registro.expediente}`);
				totalDescargados++;
			}
			catch (error) {
				console.error(`Se agotaron los reintentos para ${registro.expediente}, se continúa con el siguiente.`);
			}
			await esperar(1500);
		}
		
		console.log(`Página procesada, dtFirst=${dtFirst}, total descargados=${totalDescargados}`);
		dtFirst += 10;
		await esperar(1500);
		
		if (dtFirst < 30) {
			try {
				xml = await conReintentos(() => irAPagina(viewState, dtFirst), 'Búsqueda de siguientes páginas');	// Páginas siguientes con el evento de paginación real
			}
			catch (error) {
				console.error(`No se pudo obtener la página con dtFirst=${dtFirst}, se detiene el proceso.`);
				break;
			}
		}
	}
	console.log(`Proceso terminado. Total de PDFs descargados: ${totalDescargados}`);
}*/

main();