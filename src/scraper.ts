import { http } from './client';
import * as cheerio from 'cheerio';

export async function obtenerViewStateInicial(): Promise<string> {
	try {
		console.log('Iniciando petición GET a la OEFA');
		
		// Se descarga HTML desde la página de consultas,
		// se carga en Cheerio para explorarlo,
		// y se busca/extrae el campo que contiene al ViewState 
		const responseGet = await http.get<string>('/repdig/consulta/consultaTfa.xhtml');
		const $ = cheerio.load(responseGet.data);
		const viewState = $('input[name="javax.faces.ViewState"]').val() as string;
		
		// Se valida si el input ya no existe
		if (!viewState) {
			throw new Error('No se pudo encontrar el ViewState');
		}
		
		console.log('ViewState obtenido con éxito');
		return viewState;
	}
	catch (error) {
		// Captura y muestra si hay problemas de red o conexión con la página
		console.error('Error obteniendo el ViewState inicial:', error);
		throw error;
	}
}

export async function buscarPagina(viewState: string, dtFirst: number): Promise<string> {
	console.log('Preparando los datos para la búsqueda');
	
	// Se preparan los parámetros obligatorios del formulario (payload),
	// especificando el número de página a consultar con dtFirst,
	// y se envía una petición POST para obtener los resultados de la búsqueda
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

export function parsearTabla(xmlParcial: string): any[] {
	console.log('Procesando respuesta XML parcial de PrimeFaces');
	
	// Se carga la respuesta del servidor en modo XML,
	// y se extrae el texto HTML oculto dentro de la etiqueta <update>
	const $xml = cheerio.load(xmlParcial, { xmlMode: true });
	const htmlContenido = $xml('update[id*="pgLista"]').text();
	
	// Control de errores en caso de que la estructura del XML cambie,
	// intentando buscar cualquier bloque de actualización alternativo
	if (!htmlContenido) {
		console.warn('No se encontró el bloque de actualización esperado en el XML. Intentando leer todo el contenido.');
		const cualquierUpdate = $xml('update').text();
		if (!cualquierUpdate) {
			console.error('El XML no contiene bloques <update> válidos.');
			return [];
		}
	}
	
	// Se crea una nueva instancia de Cheerio ya con el HTML aislado,
	// y se seleccionan todas las filas (tr) de la tabla limpia
	const $ = cheerio.load(htmlContenido || $xml('update').text());
	const registros: any[] = [];
	const filas = $('tr');
	
	// Se recorre cada fila descartando las vacías,
	// se extrae el texto de las celdas (td) y se arma el objeto final
	filas.each((index, elemento) => {
		if ($(elemento).hasClass('ui-datatable-empty-message')) return;
		const celdas = $(elemento).find('td');
		if (celdas.length === 0) return;
		
		// Se lee el atributo 'onclick' del enlace <a> dentro de las celdas
		const onclickTexto = $(celdas).find('a').attr('onclick') || '';
		
		// Se extraen los datos de 'onclick'
		const datosDescarga = extraerDatosDescarga(onclickTexto);
		
		const registro = {
			nro: $(celdas.get(0)).text().trim(),
			expediente: $(celdas.get(1)).text().trim(),
			administrado: $(celdas.get(2)).text().trim(),
			unidadFiscalizable: $(celdas.get(3)).text().trim(),
			sector: $(celdas.get(4)).text().trim(),
			resolucion: $(celdas.get(5)).text().trim(),
			componente: datosDescarga ? datosDescarga.componente : 'No tiene',
			uuid: datosDescarga ? datosDescarga.uuid : 'No tiene'
		};
		
		registros.push(registro);
	});
	
	return registros;
}

export function extraerDatosDescarga(onclick: string): { componente: string; uuid: string } | null {
	// Busca: 'ALGO:j_idt63':'ALGO:j_idt63'  y  'param_uuid':'ALGO'
	const match = onclick.match(/'([\w:]+:j_idt63)':'[\w:]+','param_uuid':'([\w-]+)'/);
	if (!match) return null;
	return { componente: match[1], uuid: match[2] };
}