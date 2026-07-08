import { http } from './client';
import * as cheerio from 'cheerio';

async function obtenerViewStateInicial(): Promise<string> {
	try {
		console.log('Iniciando petición GET a la OEFA');
		
		const responseGet = await http.get<string>('/repdig/consulta/consultaTfa.xhtml');
		const $ = cheerio.load(responseGet.data);
		const viewState = $('input[name="javax.faces.ViewState"]').val() as string;
		
		if (!viewState) {
			throw new Error('No se pudo encontrar el ViewState');
		}
		
		console.log('ViewState obtenido con éxito');
		return viewState;
	}
	catch (error) {
		console.error('Error obteniendo el ViewState inicial:', error);
		throw error;
	}
}

async function buscarPagina(viewState: string, dtFirst: number): Promise<string> {
	console.log('Preparando los datos para la búsqueda');
	
	const payload = new URLSearchParams();
	
	payload.append('javax.faces.partial.ajax', 'true');
	payload.append('javax.faces.source', 'listarDetalleInfraccionRAAForm:btnBuscar');
	payload.append('javax.faces.partial.execute', '@all');
	payload.append('javax.faces.partial.render', 'listarDetalleInfraccionRAAForm:pgLista listarDetalleInfraccionRAAForm:txtNroexp');
	payload.append('listarDetalleInfraccionRAAForm:btnBuscar', 'listarDetalleInfraccionRAAForm:btnBuscar');
	payload.append('listarDetalleInfraccionRAAForm', 'listarDetalleInfraccionRAAForm');
	payload.append('listarDetalleInfraccionRAAForm:txtNroexp', '');
	payload.append('listarDetalleInfraccionRAAForm:j_idt21', '');
	payload.append('listarDetalleInfraccionRAAForm:j_idt25', '');
	payload.append('listarDetalleInfraccionRAAForm:idsector', '');
	payload.append('listarDetalleInfraccionRAAForm:j_idt34', '');
	payload.append('listarDetalleInfraccionRAAForm:dt_first', dtFirst.toString());
	payload.append('listarDetalleInfraccionRAAForm:dt_scrollState', '0,0');
	payload.append('javax.faces.ViewState', viewState);
	
	console.log('Enviando petición POST con los filtros');
	const responsePost = await http.post<string>('/repdig/consulta/consultaTfa.xhtml', payload.toString());
	return responsePost.data;
}

function parsearTabla(xmlParcial: string): any[] {
	console.log('Procesando respuesta XML parcial de PrimeFaces');
	
	const $xml = cheerio.load(xmlParcial, { xmlMode: true });
	
	// 2. Buscamos la etiqueta <update> que contiene la tabla
	// PrimeFaces usualmente actualiza el contenedor de la lista ('listarDetalleInfraccionRAAForm:pgLista')
	const htmlContenido = $xml('update[id*="pgLista"]').text();
	
	if (!htmlContenido) {
		console.warn('No se encontró el bloque de actualización esperado en el XML. Intentando leer todo el contenido.');
		// Si no encuentra ese ID exacto, extraemos el texto de cualquier etiqueta <update>
		const cualquierUpdate = $xml('update').text();
		if (!cualquierUpdate) {
			console.error('El XML no contiene bloques <update> válidos.');
			return [];
		}
	}
	
	// 3. Ahora que tenemos el HTML real limpio (fuera del CDATA), 
	// creamos una NUEVA instancia de Cheerio en modo HTML normal.
	const $ = cheerio.load(htmlContenido || $xml('update').text());
	const registros: any[] = [];
	
	// 4. Buscamos las filas. Al estar aislados en el HTML real, 
	// podemos buscar directamente las etiquetas 'tr'
	const filas = $('tr');
	
	filas.each((index, elemento) => {
		if ($(elemento).hasClass('ui-datatable-empty-message')) return;
		const celdas = $(elemento).find('td');
		if (celdas.length === 0) return;
		
		const registro = {
			nro: $(celdas.get(0)).text().trim(),
			expediente: $(celdas.get(1)).text().trim(),
			administrado: $(celdas.get(2)).text().trim(),
			unidadFiscalizable: $(celdas.get(3)).text().trim(),
			sector: $(celdas.get(4)).text().trim(),
			resolucion: $(celdas.get(5)).text().trim(),
			archivoUrl: $(celdas).find('a').attr('href') || 'No tiene'
		};
		
		registros.push(registro);
	});
	
	return registros;
}

async function main() {
	const viewState = await obtenerViewStateInicial();
	const xml = await buscarPagina(viewState, 0);
	const registros = parsearTabla(xml);
	console.log(`Se encontraron ${registros.length} registros`);
	console.log(registros[0]); // mostramos el primero para inspeccionar
}

main();