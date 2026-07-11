# Desafío de Scraping

Scraper en TypeScript/Node.js que extrae registros judiciales/administrativos y descarga los PDFs asociados desde un sitio construido sobre **JavaServer Faces (JSF) con PrimeFaces**, sin usar automatización de navegador (sin Puppeteer/Playwright/Selenium), solo `axios` + `cheerio`.

## ⚠️ Nota sobre el sitio objetivo

El desafío original apunta a `jurisprudencia.pj.gob.pe`, que **requiere VPN a Perú**. Este repositorio fue desarrollado y probado contra el sitio alternativo indicado en el enunciado, `publico.oefa.gob.pe`, que expone una arquitectura equivalente (JSF + PrimeFaces) sin necesidad de VPN.

La lógica de negocio (ViewState, paginación, retry, logging) es genérica y reutilizable, pero los **nombres de campos del formulario** (`buscarPrimeraPagina`, `irAPagina`, `descargarPDF`, `parsearTabla` en `src/scraper.ts`) están hardcodeados según la estructura HTML específica de OEFA, capturada mediante inspección manual con DevTools. Para apuntar al sitio real, es necesario repetir ese proceso de inspección y actualizar esas funciones (ver sección "Adaptar a otro sitio JSF").

## Requisitos

- Node.js (v18 o superior recomendado)
- npm

## Instalación

```bash
git clone https://github.com/Shadowilla/test-scraper.git
cd scraper-challenge
npm install
```

> **Nota (Windows/PowerShell):** si `npm` da un error de `UnauthorizedAccess` / política de ejecución de scripts, usar `npm.cmd` en su lugar, o habilitar la ejecución con `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`.

## Ejecución

```bash
npm run start
```

Esto ejecuta `app.ts` con `tsx`, que:
1. Obtiene el ViewState inicial del sitio.
2. Busca la primera página de resultados.
3. Recorre todas las páginas siguientes automáticamente (sin límite fijo, se detiene solo al encontrar dos páginas vacías consecutivas).
4. Descarga cada PDF asociado a `descargas/`.
5. Reintenta automáticamente ante fallos (red, rate limiting) con backoff exponencial.
6. Registra los casos que no se pudieron resolver, para poder revisarlos o reintentarlos después.

La corrida completa (~1750 registros) tarda **más de una hora**, por los delays deliberados entre requests para no sobrecargar el servidor.

## Resultados de la corrida completa

| Métrica | Valor |
|---|---|
| Total de registros (filas) en el sitio | 1753 |
| **Archivos PDF únicos obtenidos** | **1610** |
| Operaciones de descarga exitosas (antes de colisiones de nombre) | 1621 |
| Documentos confidenciales (sin PDF disponible) | 132 |
| Fallos técnicos irrecuperables | 0 |

**Nota sobre la diferencia 1621 → 1610**: el nombre de archivo se arma como {expediente}_{resolucion}.pdf. En 11 casos, dos registros distintos generaron el mismo nombre (mismo expediente y resolución), por lo que la segunda descarga sobrescribió a la primera en disco. El scraper reporta 1621 operaciones de descarga exitosas, pero el número real de archivos únicos finales es 1610. No se considera un fallo del scraper (ambas descargas fueron válidas), sino una limitación del esquema de nombrado — se podría resolver incluyendo parte del uuid en el nombre del archivo para garantizar unicidad total.

**Nota sobre confidenciales**: algunos números de expediente agrupan más de un procedimiento distinto (ej. dos filas separadas con el mismo número de expediente, ambas confidenciales). El conteo de 132 corresponde a filas reales de la tabla, no a expedientes únicos deduplicados.

## Estructura del proyecto

```
scraper-challenge/
  app.ts              # Orquestador: recorre páginas y descarga
  src/
    client.ts          # Cliente axios con cookie jar (maneja sesión JSF)
    scraper.ts          # Toda la lógica de scraping (búsqueda, paginación, parseo, descarga, retry, logging)
  descargas/            # PDFs descargados (no versionado)
  errores.log            # Log legible de cualquier operación que agotó sus reintentos
  fallos-descarga.jsonl    # Registro estructurado (JSON Lines) de descargas fallidas, con datos suficientes para reintentar
  sin-pdf.jsonl            # Registro de documentos sin PDF disponible (ej. confidenciales). No son fallos, se excluyen a propósito
```

## Cómo funciona (resumen técnico)

El sitio está construido con JSF, un framework que no expone una API REST convencional: cada interacción (buscar, paginar, descargar) es un `POST` con un formulario completo, incluyendo un token de sesión (`javax.faces.ViewState`) que **cambia en cada respuesta** y debe reenviarse actualizado en la siguiente petición. El scraper reproduce ese ciclo:

- `obtenerViewStateInicial()`: trae el ViewState de arranque desde un `GET` inicial.
- `buscarPrimeraPagina()` / `irAPagina()`: disparan los eventos AJAX parciales que el sitio usa para buscar y paginar (capturados inspeccionando el tráfico real del sitio en DevTools).
- `parsearTabla()`: extrae los datos de la tabla desde la respuesta XML parcial (PrimeFaces envía solo el fragmento HTML que cambió, no la página completa).
- `descargarPDF()`: reproduce el postback de descarga, pidiendo la respuesta como binario (`arraybuffer`) y validando que el contenido sea efectivamente un PDF antes de guardarlo.

## Manejo de errores y rate limiting (429)

Todas las operaciones de red pasan por `conReintentos()`, una función genérica que:
- Reintenta hasta 3 veces ante cualquier fallo (incluyendo 429).
- Espera con backoff exponencial entre intentos (2s, 4s, 8s).
- Si se agotan los intentos, registra el fallo y continúa con el siguiente elemento (documento o página) sin detener todo el proceso.

## Logs generados

| Archivo | Contenido |
|---|---|
| `errores.log` | Texto legible, cualquier operación que agotó sus reintentos (búsqueda, paginación o descarga) |
| `fallos-descarga.jsonl` | Un objeto JSON por línea, por cada descarga fallida. Incluye expediente, componente y UUID necesarios para reintentar puntualmente sin rehacer toda la búsqueda |
| `sin-pdf.jsonl` | Documentos que el sitio marca sin PDF disponible (ej. información confidencial). Se detectan y excluyen antes de intentar la descarga, para no gastar reintentos en algo que nunca va a funcionar |

## Adaptar a otro sitio JSF

1. Inspeccionar el sitio con DevTools (Network tab) para capturar los payloads reales de: carga inicial, búsqueda, paginación y descarga.
2. Actualizar `baseURL` en `src/client.ts`.
3. Reescribir `buscarPrimeraPagina`, `irAPagina`, `descargarPDF` en `src/scraper.ts` con los nombres de campo reales del nuevo formulario.
4. Remapear las columnas en `parsearTabla()` según la estructura real de la tabla del nuevo sitio.
5. Revisar `extraerDatosDescarga()`, el patrón de extracción del link de descarga (regex sobre `onclick`) puede diferir.

Las funciones genéricas (`esperar`, `conReintentos`, `registrarError`, `registrarFalloDescarga`, `registrarSinPDF`, `limpiarNombreArchivo`, `obtenerViewStateInicial`, `extraerNuevoViewState`) no requieren cambios.

## Notas técnicas

- Se deshabilitó la descompresión automática de axios (`decompress: false` en `client.ts`) por un comportamiento inconsistente observado en combinación con `axios-cookiejar-support` al ejecutar con `tsx`.
- Los `<tr>` que llegan en las respuestas de paginación vienen sueltos (sin `<table>` contenedor), ya que PrimeFaces solo envía el fragmento HTML que cambió. Se envuelven manualmente en `<table><tbody>` antes de parsear con cheerio, porque los parsers HTML descartan `<tr>` fuera de una tabla.