# Implementación de la auditoría del dashboard de jefatura

Fecha: 20 de octubre de 2026. Cambios sin commit en `main` al cierre de esta nota.

## Estado por hallazgo

| Hallazgo | Estado | Qué cambió |
|---|---|---|
| F01 indicadores | Resuelto | Inicio enlaza a `vista=ofertas` con su filtro. Materias filtra cada asignación (sin docente, sin horario, sin docente u horario, calificaciones pendientes) y la retícula tiene `sinGrupo=1`. Un enlace con filtros de oferta abre esa vista aunque no la nombre. |
| F02 error como «sin señales» | Resuelto | `estadoConjunto` y `AvisoParcial`: «Cargando», «No disponible» y «Datos parciales» con reintento. «Sin señales detectadas» solo aparece con todas las materias consultadas. |
| F03 informe | Resuelto | El intervalo vive en la URL, se valida contra el periodo y se reinicia al cambiar de carrera o periodo. Las descargas y la impresión exigen la respuesta vigente. Un informe anterior se rotula y no se imprime. El resumen separa las cifras del intervalo de las cifras al corte. |
| F04 guardado parcial | Resuelto | `PATCH /materias/:id` acepta `numUnidades` y `forzar` y lo guarda todo en una transacción. Una reducción con registros responde 409 (`requiereConfirmacion`) antes de escribir nada. |
| F05 «solo consulta» | Resuelto | Reuniones se declara «Todas las fechas · no depende del periodo» y no muestra selector de periodo. La retícula se presenta como catálogo global en todos los periodos. |
| F06 histórico | Parcial | En un periodo anterior se incluyen los grupos dados de baja después (`filtroGrupoVigente`). Los horarios y asignaciones siguen siendo los de hoy y la barra lo dice. Congelar la evidencia por ciclo requiere versionar `HorarioMateria` (migración); es una decisión de producto. |
| F07 calendario | Resuelto | Aviso persistente por modalidad sin calendario. «Listas al día» solo aparece con cobertura evaluable. |
| F17 vencimientos | Resuelto | `senalUnidad` compara días civiles en `America/Mexico_City`; el día de cierre todavía está a tiempo. Tiene pruebas unitarias. |
| F08 frescura | Resuelto | El botón «Actualizar» refresca resumen, clases, reportes y seguimientos. Lo mismo ocurre al volver a la pestaña tras un minuto. Las cachés se vacían al cambiar de cuenta. |
| F09 primer uso | Resuelto | Guía opcional «Cómo revisar tu carrera» en tres pasos; se puede ocultar y la preferencia se recuerda. |
| F10 prioridad | Resuelto | El bloque «Requiere atención» muestra seguimientos para hoy, la lista más antigua y los alumnos en riesgo. «Hoy en la carrera» pasa al final. |
| F11 vocabulario | Resuelto | Explicaciones de alumnos frente a inscripciones, de la fórmula de cobertura y de NA. Se nombran las «calificaciones de unidades cerradas sin capturar». |
| F12 resolución | Parcial | Cada caso dice quién lo corrige (el docente o coordinación) y Horarios aclara que es solo consulta. No se ampliaron permisos de jefatura. |
| F13 móvil | Resuelto | Tarjetas móviles en Grupos y en Grupo › Alumnos; los selectores de contexto miden 44 px. El resto de objetivos ya crecía en `index.css`. |
| F14 contexto | Resuelto | La búsqueda y el orden viven en la URL en Grupos, Docentes y Materias. «← Volver» regresa al listado con sus filtros y las pestañas entran al historial. Docentes se puede ordenar por pendientes, captura o cobertura. |
| F15 seguimientos | Resuelto | Fallo y carga del historial visibles, con reintento. La ausencia de un caso ya no se presenta como resolución. El borrador de la nota se conserva. |
| F16 asistencia | Resuelto | Cada convocado empieza «Sin confirmar» y se marca «Asistió» o «Faltó». El backend rechaza finalizar con asistencia pendiente. Los borradores del acta y de la convocatoria se conservan en la pestaña. |

## Verificación

- Backend: jest 511/511. En los archivos tocados, eslint no suma errores nuevos respecto a HEAD.
- Frontend: build correcto. `tests/jefatura-estados.test.js` 6/6. E2E de jefatura 18/18: 12 previas y 6 de aceptación (F01, F02, F05, F07, F14 y F16).
- Fallos ajenos a este cambio: `calendario-clases` y `calificaciones` en vitest (6, también en HEAD) y 5 de login/roles en `audit.spec.js` (esperan `/materias` y la app abre `/dashboard`).
- Sin probar: datos institucionales reales, pruebas con usuarios (Etapa 3) y mediciones de carga (Etapa 5).

## Despliegue

`PATCH /materias/:id` con `numUnidades` y la regla de asistencia del acta requieren desplegar el backend junto con el frontend. No hay migraciones.
