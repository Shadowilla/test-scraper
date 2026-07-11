import fs from 'fs';
import path from 'path';
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
	registrarSinPDF,
} from './src/scraper.ts';

async function main() {
	let viewState = await obtenerViewStateInicial();
	let totalDescargados = 0;
	let paginasVaciasSeguidas = 0;
	let fallosPeticionSeguidos = 0;
		
	for (let dtFirst = 0; ; dtFirst += 10) {	// Total de registros
		let xml: string;
		
		try {
			if (dtFirst === 0) {
				xml = await conReintentos(() => buscarPrimeraPagina(viewState), 'Búsqueda inicial');
			}
			else {
				xml = await conReintentos(() => irAPagina(viewState, dtFirst), `Página dtFirst=${dtFirst}`);
			}
			fallosPeticionSeguidos = 0;	// Se resetea si la petición funciona
		}
		catch (error) {
			fallosPeticionSeguidos++;
			console.error(`No se pudo obtener la página dtFirst=${dtFirst} (${fallosPeticionSeguidos} fallo(s) de petición seguido(s)).`);
			if (fallosPeticionSeguidos >= 3) {
				console.error('3 páginas seguidas fallaron a nivel de petición (posible bloqueo del servidor) -> deteniendo el proceso.');
				break;
			}
			continue;
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
		
		for (const [indice, registro] of registros.entries()) {
			const numeroPagina = (dtFirst / 10) + 1;
			const numeroRegistroGlobal = dtFirst + indice + 1;
			
			if (registro.componente === 'No tiene' || registro.uuid === 'No tiene') {
				console.log(`[Página ${numeroPagina}, registro #${numeroRegistroGlobal}] ${registro.expediente}: sin PDF disponible, se omite.`);
				registrarSinPDF(numeroRegistroGlobal, registro.expediente, registro.resolucion);
				continue;
			}
			
			console.log(`[Página ${numeroPagina}, registro #${numeroRegistroGlobal}, total descargados: ${totalDescargados}] Descargando: ${registro.expediente}`);
			
			const nombreArchivo = limpiarNombreArchivo(`${registro.expediente}_${registro.resolucion}.pdf`);
			const rutaArchivo = path.join(process.cwd(), 'descargas', nombreArchivo);
			if (fs.existsSync(rutaArchivo)) {
				console.log(`[Página ${numeroPagina}, registro #${numeroRegistroGlobal}] ${registro.expediente}: ya descargado, se omite.`);
				totalDescargados++;
				continue;
			}
			
			try {
				await conReintentos(() => descargarPDF(viewState, registro.componente, registro.uuid, nombreArchivo), `Descarga PDF ${registro.expediente} (registro #${numeroRegistroGlobal})`);
				totalDescargados++;
			}
			catch (error) {
				console.error(`Se agotaron los reintentos para ${registro.expediente}, se continúa con el siguiente.`);
				registrarFalloDescarga(numeroRegistroGlobal, registro.expediente, registro.componente, registro.uuid, registro.resolucion);
			}
			await esperar(1500);
		}
		console.log(`Página procesada, dtFirst=${dtFirst}, total descargados=${totalDescargados}`);
		await esperar(1500);
	}
	console.log(`Proceso terminado. Total de PDFs descargados: ${totalDescargados}`);
}

main();