# Implementación de las fases 1–6 — jefatura de carrera

28 de octubre de 2026. Ejecución de `PLAN_PARA_CLAUDE.md` sobre la auditoría del mismo día. Se conservaron los cambios previos de Inicio y la gráfica de registro de asistencias (ver `../implementacion/NOTAS.md`).

## Qué cambió

| Fase | Cambio | Archivos principales |
|---|---|---|
| Navegación | Menú agrupado: Operación (Inicio · Pendientes y seguimiento · Horarios), Consulta académica (Grupos y alumnos · Docentes · Materias), Coordinación (Reuniones · Informes). Mismas ocho entradas y rutas. | `components/layout/BaseLayout.jsx` |
| 1 | «Pendientes y seguimiento» (ruta `/jefe-carrera/seguimientos`) con dos secciones: **Por atender** (listas sin captura, calificaciones, alumnos en riesgo, entregas, unidades por revisar y asignaciones incompletas, derivados del resumen) y **Observaciones registradas** (Abiertos / Para revisar hoy / Cerrados, sin cambios de comportamiento). Claves estables iguales a `claveCaso`; entregas, unidades y asignaciones no tienen caso propio y se documentan con el docente. Filtros por tipo, docente y grupo en la URL; orden determinista por tipo y antigüedad. Estados: carrera vacía, sin pendientes, filtros sin resultados, histórico, calendario no configurado, fallo de observaciones con pendientes visibles. `?vista=abiertos|hoy|cerrados` sigue abriendo Observaciones; la sección nueva usa `?seccion=`. | `JefeSeguimientos.jsx`, `supervision/pendientes.js` |
| 2 | Los cuatro indicadores de Inicio abren su conjunto en la bandeja (`?tipo=`), con título que lo confirma. Recorridos transversales con `?desde=` validado (ruta interna conocida, misma carrera y periodo; nunca URL externa) y «Volver a [origen]» + ubicación jerárquica. Sin origen válido se vuelve al listado recordado. | `JefeInicio.jsx`, `supervision/origen.js`, `supervision/useJefatura.js` (`toDesde`), `supervision/ui.jsx` |
| 3 | Detalle de materia canónico: materia + grupo (`?oferta=`) + sección (`?tab=resumen|alumnos|unidades`). Selector explícito cuando la materia se imparte en varios grupos; unidades y calificaciones se abren directamente. La tabla de unidades se extrajo y la usan materia y grupo (un cálculo, un fetch por oferta con la caché existente). Materias separa **Oferta del periodo** (por defecto si hay oferta) y **Retícula** (catálogo, donde vive «Agregar a la retícula» con su alcance). | `JefeMateriaDetalle.jsx`, `supervision/UnidadesOferta.jsx`, `JefeGrupoDetalle.jsx`, `JefeMaterias.jsx` |
| 4 | «Grupos y alumnos»: búsqueda de alumnos por nombre o número de control con el endpoint autorizado `alumnos/buscar` (alcance de carrera, 30 resultados); el expediente se abre en el grupo base. «Ver alumnos» por grupo, etiquetas «Alumnos del grupo» / «Inscripciones a materias», filtros activos visibles con «Quitar filtros». Docentes: vista **Comparar** (tabla con carga, listas, calificaciones, entregas, registro de listas y última captura) por defecto; tarjetas y mapa semanal se conservan. «Cobertura» → «Registro de listas» con definición plegable. Los grupos de las tarjetas son enlaces a la materia en ese grupo. | `JefeGrupos.jsx`, `supervision/BuscarAlumno.jsx`, `JefeDocentes.jsx`, `JefeDocenteDetalle.jsx`, `graficas/MapaDocentes.jsx` |
| 5 | Horarios en móvil: modalidad visible, filtros secundarios plegados con contador y resumen de lo aplicado, «Pendientes de programar» cerrado por defecto y después de la agenda. Mapas con scroll horizontal: `touch-action: pan-x pan-y` solo en `.viz-plot.overflow-x-auto`. | `supervision/HorarioCarrera.jsx`, `JefeHorarios.jsx`, `components/graficas/graficas.css` |
| 6 | Copiar contacto: si el portapapeles falla o no existe, aviso `role=alert` y campo de solo lectura con el texto seleccionado. Movimiento reducido: la regla global ya no pone todas las transiciones a 0,01 ms; elimina desplazamiento/rotación/escala y animaciones, y conserva color/opacidad/sombra. Tokens `--viz-*` movidos a `index.css` (OKLCH, ambos temas, sin blanco puro). | `supervision/ui.jsx`, `index.css`, `components/graficas/graficas.css` |

No se modificaron permisos, cálculos de riesgo, cobertura, calificaciones, asistencia, periodos ni endpoints. No se creó ningún campo ni métrica nueva.

## Verificación

Resultados en la sección «Resultados» al final de este archivo.

## Límites conocidos

- La búsqueda de alumnos usa `alumnos/buscar`, que filtra por `carreraId` del usuario: un alumno de otra carrera incorporado a materias de esta no aparece; se consulta desde el grupo o la materia donde está inscrito. Un alumno sin grupo base, o con grupo base inactivo en el periodo, aparece sin enlace al expediente.
- Entregas, unidades por revisar y asignaciones incompletas no tienen tipo de caso en el backend; la bandeja no inventa uno y remite a la observación con el docente.
- La antigüedad solo se muestra para listas (único pendiente con fecha en el resumen).
- Gesto táctil horizontal: verificado por estilo calculado y desplazamiento programático; no hubo dispositivo táctil real.
- Las pruebas usan fixtures con fechas relativas a `Date.now()`; no se verificó producción ni el backend real.

## Resultados

- **Unitarias (Vitest):** 128/128 en toda la app; 33 de jefatura, incluidas 9 nuevas (`tests/jefatura-pendientes.test.js`: claves estables, orden determinista, filtros, conteo por tipo, unidad compartida, validación de `desde`).
- **E2E de jefatura (Playwright, fixtures):** 24/24 en `jefatura.spec.js` + `primeros-pasos-jefatura.spec.js` (selectores adaptados a la nueva navegación) y 8/8 en el nuevo `jefatura-pendientes.spec.js`. axe (wcag2a/2aa/21aa) sin violaciones en bandeja, materia en unidades, búsqueda de alumnos, Docentes (tabla), Horarios móvil y las vistas que ya lo comprobaban. Cero hallazgos automáticos no equivale a conformidad WCAG.
- **E2E completa (todos los roles, `reducedMotion: reduce`):** 210/219. Las 9 fallas no tocan jefatura: login y roles redirigen a `/dashboard` en lugar de `/materias` (audit.spec.js) y contraste de los colores de estado introducidos en `c20b63b` (botón destructive, aviso verde del Inicio docente, chip de pasar lista). No se corrigieron aquí.
- **Recorridos verificados:** pendiente sin observación; registrar y cerrar observación sin que desaparezca la lista; calificación pendiente → materia/grupo/periodo en Unidades → volver al filtro original (docente + tipo); docente → materia (varios grupos) → volver al docente; alumno incorporado (expediente con grupo base); periodo histórico sin escritura; fallo solo de observaciones con pendientes visibles; filtros sin resultados frente a carrera sin pendientes; enlaces antiguos `?vista=hoy`; portapapeles denegado; Horarios a 390×844 con la primera clase dentro del primer viewport (antes y≈1072 px) y sin desborde; mapa semanal con `touch-action: pan-x pan-y` y desplazamiento interno; foco devuelto al bloque de clase al cerrar su detalle.
- **Ya cubiertos por la suite existente y aprobados:** semana sin clases frente a 0 %, informe con intervalo inválido y exportaciones, reuniones (próximas/historial, convocatoria y acta con API simulada).
- **Otros:** ESLint sin errores en los archivos modificados (persiste un error previo en `IncorporarAlumno.jsx`, que no se tocó). `npm run build` correcto. `impeccable detect` sobre `pages/jefe-carrera`: `[]`.
- **Navegador local:** Playwright con Chromium 1243 en caché (la versión instalada pide 1248, no descargada) mediante una configuración temporal ya eliminada. Las ejecuciones de la suite reescribieron las capturas de `frontend/audit/` como de costumbre.

## Estado de los hallazgos

| ID | Estado | Evidencia | Limitación |
|---|---|---|---|
| F01 | Resuelto | Bandeja «Por atender» / «Observaciones registradas»; pruebas de pendiente sin nota y de nota cerrada. | Entregas, unidades y asignaciones sin caso propio de observación. |
| F02 | Resuelto | Orden de Inicio previo conservado y comprobado por E2E. | — |
| F03 | Resuelto | Los cuatro indicadores abren su conjunto con `?tipo=`; E2E verifica destinos y suma = 15. | — |
| F04 | Resuelto | Materia + grupo + sección; «Ver unidades» abre la tabla directamente. | — |
| F05 | Parcial | «Grupos y alumnos», «Ver alumnos» por grupo y búsqueda por nombre/número de control. | La búsqueda solo encuentra alumnos registrados en la carrera. |
| F06 | Resuelto | Oferta del periodo / Retícula, con «Agregar» y su alcance en la Retícula. | — |
| F07 | Resuelto | «Alumnos del grupo», «Inscripciones a materias», «Registro de listas» con definición. | «Cobertura de captura» se conserva en el detalle de clase (otra métrica). |
| F08 | Resuelto | Vista «Comparar» por defecto; tarjetas y semana como alternativa. | — |
| F09 | Resuelto (fixtures) | Filtros plegados con resumen; primera clase visible a 390×844. | Sin dispositivo real. |
| F10 | Resuelto | `?desde=` validado, «Volver a [origen]» + ubicación; fallback al listado. | — |
| F11 | Parcial | `pan-x pan-y` en mapas con scroll; desplazamiento programático comprobado. | Gesto táctil real no probado. |
| F12 | Resuelto | Aviso accesible y texto seleccionable al denegar el portapapeles (E2E). | — |
| F13 | Resuelto | Regla global sustituida: sin movimiento, con feedback de color/opacidad; `motion-reduce:` en lo nuevo. | No se auditaron uno a uno los componentes de otros roles. |
| F14 | Resuelto | `--viz-*` en `index.css` (OKLCH, ambos temas, sin blanco puro); capturas claro/oscuro. | Contraste de la paleta no medido exhaustivamente fuera de axe. |

## Evidencia

Capturas de esta implementación en esta carpeta: `bandeja-*`, `materia-*`, `grupos-busqueda.png`, `docentes-*`, `horarios-movil-claro.png`, `mapa-riesgo-oscuro.png`, `inicio-escritorio-claro.png`. Datos simulados.
