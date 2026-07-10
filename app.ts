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
	registrarFalloDescarga,
} from './src/scraper.ts';

async function main() {
	let viewState = await obtenerViewStateInicial();
	let totalDescargados = 0;
	let paginasVaciasSeguidas = 0;
		
	for (let dtFirst = 0; ; dtFirst += 10) {	// Total de registros
	//for (let dtFirst = 0; dtFirst < 30; dtFirst += 10) {	// 30 registros de prueba
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
		
		if (registros.length === 0) {
			paginasVaciasSeguidas++;
			console.log(`Página dtFirst=${dtFirst} sin registros (${paginasVaciasSeguidas} vacía(s) seguida(s)).`);
			
			if (paginasVaciasSeguidas >= 2) {
				console.log('Dos páginas vacías consecutivas -> se asume fin de la lista -> deteniendo el proceso.');
				break;
			}
			
			await esperar(1500);
			continue;   // Salta a página siguiente sin intentar descargar (no hay nada que descargar)
		}
		
		paginasVaciasSeguidas = 0;
		
		for (const registro of registros) {
			const numeroPagina = (dtFirst / 10) + 1;
			console.log(`[Página ${numeroPagina}, total descargados: ${totalDescargados}] Descargando: ${registro.expediente}`);
			try {
				const nombreArchivo = limpiarNombreArchivo(`${registro.expediente}_${registro.resolucion}.pdf`);
				await conReintentos(() => descargarPDF(viewState, registro.componente, registro.uuid, nombreArchivo), `Descarga PDF ${registro.expediente}`);
				totalDescargados++;
			}
			catch (error) {
				console.error(`Se agotaron los reintentos para ${registro.expediente}, se continúa con el siguiente.`);
				registrarFalloDescarga(registro.expediente, registro.componente, registro.uuid, registro.resolucion);
			}
			await esperar(1500);
		}
		console.log(`Página procesada, dtFirst=${dtFirst}, total descargados=${totalDescargados}`);
		await esperar(1500);
	}
	console.log(`Proceso terminado. Total de PDFs descargados: ${totalDescargados}`);
}

main();