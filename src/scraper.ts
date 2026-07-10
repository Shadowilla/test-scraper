import { http } from './client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

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

export async function buscarPrimeraPagina(viewState: string): Promise<string> {
	// Se preparan los parámetros obligatorios del formulario (payload),
	// considerando la primera página,
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
	payload.append('listarDetalleInfraccionRAAForm:dt_scrollState', '0,0');
	payload.append('javax.faces.ViewState', viewState);
	
	const response = await http.post<string>('/repdig/consulta/consultaTfa.xhtml', payload.toString());
	return response.data;
}

export async function irAPagina(viewState: string, dtFirst: number): Promise<string> {
	// Se preparan los parámetros obligatorios del formulario (payload),
	// especificando el número de página a consultar con dtFirst,
	// y se envía una petición POST para obtener los resultados de la búsqueda
	const payload = new URLSearchParams();
	
	payload.append('javax.faces.partial.ajax', 'true');
	payload.append('javax.faces.source', 'listarDetalleInfraccionRAAForm:dt');
	payload.append('javax.faces.partial.execute', 'listarDetalleInfraccionRAAForm:dt');
	payload.append('javax.faces.partial.render', 'listarDetalleInfraccionRAAForm:dt');
	payload.append('listarDetalleInfraccionRAAForm:dt', 'listarDetalleInfraccionRAAForm:dt');
	payload.append('listarDetalleInfraccionRAAForm:dt_pagination', 'true');
	payload.append('listarDetalleInfraccionRAAForm:dt_first', dtFirst.toString());
	payload.append('listarDetalleInfraccionRAAForm:dt_rows', '10');
	payload.append('listarDetalleInfraccionRAAForm:dt_skipChildren', 'true');
	payload.append('listarDetalleInfraccionRAAForm:dt_encodeFeature', 'true');
	payload.append('listarDetalleInfraccionRAAForm', 'listarDetalleInfraccionRAAForm');
	payload.append('listarDetalleInfraccionRAAForm:txtNroexp', '');
	payload.append('listarDetalleInfraccionRAAForm:j_idt21', '');
	payload.append('listarDetalleInfraccionRAAForm:j_idt25', '');
	payload.append('listarDetalleInfraccionRAAForm:idsector', '');
	payload.append('listarDetalleInfraccionRAAForm:j_idt34', '');
	payload.append('listarDetalleInfraccionRAAForm:dt_scrollState', '0,0');
	payload.append('javax.faces.ViewState', viewState);
	
	const response = await http.post<string>('/repdig/consulta/consultaTfa.xhtml', payload.toString());
	return response.data;
}

function extraerDatosDescarga(onclick: string): { componente: string; uuid: string } | null {
	// Busca: 'ALGO:j_idt63':'ALGO:j_idt63'  y  'param_uuid':'ALGO'
	const match = onclick.match(/'([\w:]+:j_idt63)':'[\w:]+','param_uuid':'([\w-]+)'/);
	if (!match) return null;
	return { componente: match[1]!, uuid: match[2]! };
}

export function parsearTabla(xmlParcial: string): any[] {
	console.log('Procesando respuesta XML parcial de PrimeFaces');
	
	// Se carga la respuesta del servidor en modo XML,
	// y se extrae el texto HTML oculto dentro de la etiqueta <update>
	const $xml = cheerio.load(xmlParcial, { xmlMode: true });
	const htmlContenido = $xml('update[id$="pgLista"], update[id$=":dt"]').text();
	
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
	const $ = cheerio.load(`<table><tbody>${htmlContenido || $xml('update').text()}</tbody></table>`);
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

export function extraerNuevoViewState(xmlParcial: string): string {
	const $xml = cheerio.load(xmlParcial, { xmlMode: true });
	const nuevoViewState = $xml('update[id*="ViewState"]').text();
	
	if (!nuevoViewState) {
		throw new Error('No se pudo extraer el nuevo ViewState de la respuesta');
	}
	
	return nuevoViewState;
}

export async function descargarPDF(
viewState: string,
idBoton: string,
uuid: string,
nombreArchivo: string
): Promise<void> {
	console.log(`Iniciando descarga de: ${nombreArchivo}`);
	const payloadPDF = new URLSearchParams();
	
	payloadPDF.append('listarDetalleInfraccionRAAForm', 'listarDetalleInfraccionRAAForm');
	payloadPDF.append('listarDetalleInfraccionRAAForm:txtNroexp', '');
	payloadPDF.append('listarDetalleInfraccionRAAForm:j_idt21', '');
	payloadPDF.append('listarDetalleInfraccionRAAForm:j_idt25', '');
	payloadPDF.append('listarDetalleInfraccionRAAForm:idsector', '');
	payloadPDF.append('listarDetalleInfraccionRAAForm:j_idt34', '');
	payloadPDF.append('listarDetalleInfraccionRAAForm:dt_scrollState', '0,0');
	payloadPDF.append(idBoton, idBoton);
	// Si el formulario pide obligatoriamente el param_uuid en el POST, se añade:
	if (uuid) {
		payloadPDF.append('param_uuid', uuid);
	}
	payloadPDF.append('javax.faces.ViewState', viewState);
	
	try {
		const response = await http.post<Buffer>(
			'/repdig/consulta/consultaTfa.xhtml', 
			payloadPDF.toString(), {
				responseType: 'arraybuffer',	// Indica a Axios que descargue un archivo binario
				headers: { 'Accept': 'application/pdf, application/octet-stream, */*' }	// Le avisa al servidor que se espera un PDF
			}
		);
		
		// Se verifica si PDF es válido
		const firma = Buffer.from(response.data).slice(0, 4).toString();
		if (firma !== '%PDF') {
			throw new Error(`El archivo descargado no es un PDF válido (encabezado: ${firma})`);
		}
		// Se guarda físicamente el archivo en carpeta 'descargas'
		const rutaDestino = path.join(process.cwd(), 'descargas', nombreArchivo);
		// Crea la carpeta 'descargas' si no existe
		if (!fs.existsSync(path.dirname(rutaDestino))) {
			fs.mkdirSync(path.dirname(rutaDestino), { recursive: true });
		}
		fs.writeFileSync(rutaDestino, response.data);
		console.log(`Archivo guardado con éxito en: ${rutaDestino}`);
	}
	catch (error) {
		console.error(`Error al descargar el PDF ${nombreArchivo}:`, error);
	}
}

export function limpiarNombreArchivo(nombre: string): string {
	// Reemplaza caracteres problemáticos para el sistema de archivos de Windows
	return nombre.replace(/[\\/:*?"<>|°\n\r]/g, '_').trim();
}

export function esperar(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export async function conReintentos<T>(
	operacion: () => Promise<T>,
	descripcion: string,
	maxIntentos: number = 3
): Promise<T> {
	for (let intento = 1; intento <= maxIntentos; intento++) {
		try {
			return await operacion();
		}
		catch (error) {
			if (intento === maxIntentos) {
				console.error(`${descripcion}: falló tras ${maxIntentos} intentos.`);
				throw error;
			}
			const esperaMs = 2000 * Math.pow(2, intento - 1);	// Aumenta tiempo de espera de forma exponencial
			console.warn(`${descripcion}: intento ${intento} falló, reintentando en ${esperaMs / 1000}s...`);
			await esperar(esperaMs);
		}
	}
	throw new Error('No debería llegar acá');	// TypeScript necesita esto por el tipo de retorno
}