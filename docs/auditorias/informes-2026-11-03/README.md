# Informes de jefatura — integración del 3 de noviembre de 2026

El prototipo se integra en **Informes** mediante tres pasos: **Preparar → Revisar → Descargar**. Se conserva la generación institucional existente de Excel y PDF, incluidos sus helpers compartidos; la interfaz de consulta no sustituye el formato del documento.

## Contrato de la pantalla

- **Preparar:** elegir fechas dentro del periodo y al menos una sección de detalle. Hay accesos a los últimos meses disponibles y a todo el periodo. Un rango invertido o fuera del periodo impide continuar.
- **Revisar:** consultar el resumen o una sola tabla a la vez mediante un selector. El resumen siempre forma parte del archivo, aunque se excluyan secciones de detalle.
- **Descargar:** descargar Excel, descargar PDF o abrir el PDF en otra pestaña para imprimir desde el visor del navegador. Se informa de los errores de generación y de las pestañas bloqueadas.

Las cinco opciones de contenido son:

| Identificador de API | Etiqueta al preparar | Referencia temporal |
| --- | --- | --- |
| `cobertura` | Registro de listas por docente | Intervalo elegido |
| `listas` | Listas pendientes de captura | Intervalo elegido |
| `avance` | Avance académico por materia y grupo | Corte actual |
| `riesgo` | Alumnos en riesgo | Corte actual |
| `seguimientos` | Observaciones de seguimiento | Intervalo elegido |

El resumen distingue datos del intervalo y datos al corte. El registro de listas es evidencia de captura en SICAT y no confirma presencia física del docente. La URL conserva fechas, paso, selección y sección consultada; cambiar de carrera o periodo inicia otro informe.

## API y compatibilidad

| Endpoint | Comportamiento |
| --- | --- |
| `GET /jefe-carrera/informe` | Mantiene la consulta completa con `carreraId`, `periodo`, `desde` y `hasta`; la selección de detalle se aplica en la interfaz. |
| `GET /jefe-carrera/informe/exportar` | Añade `secciones` como CSV opcional de los cinco identificadores admitidos. `formato` admite `excel` o `pdf`; por omisión genera Excel. |

Omitir `secciones` conserva la exportación completa anterior. Una selección vacía o con identificadores desconocidos se rechaza; el DTO valida el CSV y el servicio vuelve a comprobar sus valores. El resumen se genera siempre y los detalles conservan el orden institucional. La respuesta mantiene tipo de contenido, nombre de archivo y exposición de `Content-Disposition`.

Se mantienen `JwtAuthGuard`, `RolesGuard` y el rol `JEFE_CARRERA`. La validación del alcance de carrera sigue pasando por el resumen de supervisión antes de consultar los datos del informe. No se amplía el acceso por seleccionar secciones.

## Comparación con el sistema visual

La pantalla sigue el carácter institucional, sobrio y legible de [PRODUCT.md](../../../PRODUCT.md) y [DESIGN.md](../../../DESIGN.md): tipografía y componentes existentes, superficies sólidas, bordes discretos y colores semánticos. El azul señala el paso activo y la acción principal. La selección usa filas separadas en lugar de una cuadrícula de tarjetas; la revisión presenta una tabla a la vez para reducir la carga de lectura.

En escritorio, el resumen de configuración acompaña el contenido en una columna lateral; en móvil pasa al flujo vertical. Los controles principales tienen altura mínima de 44 px y las tablas conservan desplazamiento horizontal dentro de una región enfocable. El PDF mantiene el encabezado, logo y firma institucional mediante los helpers existentes, sin modificar su implementación. Esta integración no cambia los tokens ni el archivo raíz `DESIGN.md`.

## Verificación y límites

- Pasaron **6 pruebas de frontend** y **9 de backend**; también el build de frontend, ESLint y la comprobación TypeScript del backend.
- Se actualizó el test E2E, pero **no se ejecutó su CLI**. La comprobación manual con CUA recorrió el flujo en escritorio de 1440 px y móvil de 390 px.
- El navegador utilizó un harness de API con fixtures y la generación real de `exportar()`. Se descargaron archivos XLSX y PDF reales con resumen y cuatro secciones. Se revisaron visualmente ambas páginas del PDF: logo en la primera; tablas seleccionadas, columna de sexo, recuadro de firma de jefatura y paginación en la segunda.
- No se verificaron conexión a base de datos ni despliegue. Los ejemplos contienen datos de fixtures y no acreditan un recorrido con datos productivos. La impresión física tampoco se verificó.
- El revisor independiente emitió dictamen **SHIP**, sin hallazgos materiales, dentro del alcance verificado.

## Evidencias

| Vista | Escritorio | Móvil |
| --- | --- | --- |
| Preparar | [Captura](preparar-escritorio.png) | [Captura](preparar-movil.png) |
| Revisar | [Resumen](revisar-escritorio.png) | [Tabla](tabla-movil.png) |
| Descargar | [Captura](descargar-escritorio.png) | [Captura](descargar-movil.png) |

La captura de tabla móvil se normalizó a un viewport de **390 × 844 px** para evitar artefactos de unión de capturas.

[Primera página del PDF institucional](pdf-institucional.png) · [PDF de ejemplo](informe-ejemplo.pdf) · [Excel de ejemplo](informe-ejemplo.xlsx).
