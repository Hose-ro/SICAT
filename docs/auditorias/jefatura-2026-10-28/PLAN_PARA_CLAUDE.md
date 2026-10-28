# Plan de implementación para Claude — UI/UX de jefatura de carrera

## Encargo

Implementa las mejoras pendientes de UI/UX de la interfaz del jefe de carrera en SICAT a partir de la auditoría existente. El objetivo es hacer comprensible y predecible la navegación, conservando las capacidades y las reglas académicas actuales.

Este documento es un encargo de implementación: revisa el estado actual y ejecuta las fases; no lo sustituyas por otra auditoría o una propuesta genérica. Comunica avances y entrega evidencia del resultado. Resuelve las decisiones rutinarias con el contexto disponible. Si surge un impedimento real, descríbelo con precisión y continúa las partes independientes.

Trabaja en `/Users/jose/Documents/8vosemestre/fede/SICAT`.

## 1. Contexto obligatorio

Lee antes de modificar:

1. Las instrucciones AGENTS.md aplicables y su referencia RTK.md. En la sesión anterior RTK.md se encontró en `/Users/jose/.claude/RTK.md`; vuelve a resolverlo si esa ruta no existe.
2. `.agents/skills/impeccable/SKILL.md` y las referencias pertinentes. Respeta el flujo de contexto y el límite de rondas de verificación de la skill. No actualices la skill como efecto secundario.
3. `PRODUCT.md` y `DESIGN.md`.
4. `docs/auditorias/jefatura-2026-10-28/AUDITORIA.md`.
5. `docs/auditorias/jefatura-2026-10-28/implementacion/NOTAS.md` y sus capturas.
6. `.impeccable/surfaces/frontend-src-pages-jefe-carrera-jefeinicio-jsx.md`.

Inspecciona Git antes de editar. El repositorio contiene numerosos cambios anteriores de código, pruebas y capturas. No reviertas, limpies, sobrescribas ni atribuyas a tu trabajo cambios ajenos. Prefiere el checkout actual si es adecuado; no crees otro proyecto ni sustituyas la aplicación por un prototipo.

Stack actual: React 19, Vite, Tailwind 4, componentes shadcn/Base UI y Zustand; backend NestJS, Prisma y PostgreSQL. Interfaz en español.

## 2. Decisiones del usuario que ya están resueltas

**Orden de Inicio:**

1. Clases de hoy.
2. Alumnos en riesgo.
3. Pendientes de docentes.
4. Registro de asistencias y contenido secundario.

El usuario también pidió una gráfica de asistencias más comprensible. Esa primera intervención ya está implementada.

No está definido si el jefe revisa principalmente por docente, grupo o tipo de pendiente. Mantén esas vías como alternativas y usa filtros; no impongas un agrupamiento obligatorio ni vuelvas a preguntar lo que ya se ha respondido.

## 3. Línea base: cambios que ya están hechos

Conserva y verifica lo siguiente; no lo reconstruyas desde cero:

- `JefeInicio.jsx`: clases primero, riesgo segundo y docentes tercero. Cuatro alumnos y cuatro docentes inicialmente, con acceso para ampliar. Riesgo visible desde el inicio y criterio explicativo plegable.
- Clases en curso/próximas con acceso al horario; las sesiones con registro abierto tienen prioridad. Los periodos históricos no muestran clases de hoy.
- «Resumen del periodo y otras revisiones» contiene indicadores y revisiones secundarias. La guía de preparación ya no antecede al trabajo diario en una carrera operativa; una carrera vacía conserva su guía principal.
- `graficas/TendenciaCobertura.jsx`: gráfica única de barras con escala fija 0–100 %, porcentajes, meta 90 %, semana actual provisional, selección por radio nativo y detalle persistente. Filtros Todas/Escolarizado/Mixto, tabla alternativa y enlaces a Horarios/Docentes.
- Scroll horizontal interno en la gráfica móvil, con `touch-action:auto`; selección normalizada si cambian datos o modalidades.
- Se preservan los cálculos y la diferencia entre semana sin clases evaluables y 0 %.

Validación previa: 24 pruebas enfocadas aprobadas, ESLint y build correctos, navegador con fixtures en 1440×1000 y 390×844 y ambos temas. Los archivos E2E se adaptaron a la nueva UI, **pero no se ejecutó su suite**. Tampoco se verificó producción ni un dispositivo táctil real.

La auditoría completa sigue pendiente: no declares resueltos todos los hallazgos por esos cambios de Inicio.

## 4. Reglas que deben mantenerse

- No cambiar permisos, reglas de inscripción, riesgo, calificaciones, asistencia, periodos ni estados académicos para facilitar el diseño.
- Mantener contexto carrera + periodo en consultas, filtros y navegación. Conservar la distinción entre Escolarizado y Mixto; no usar «sabatino» como sustituto.
- No interpretar datos ausentes, errores o respuestas parciales como cero, «sin riesgo» o «todo al día».
- Una nota cerrada no demuestra que una lista se completó ni que un alumno dejó de estar en riesgo. Estado académico y estado del seguimiento son conceptos distintos.
- Cobertura = listas completas / clases elegibles ya concluidas con lista esperada. Sumar cantidades antes de dividir. Las tardías ya están incluidas en completas; las suspendidas se excluyen del denominador. Captura no equivale a presencia física del docente.
- Conservar incorporación de alumnos, expedientes, unidades, tareas/entregas disponibles en supervisión, historial, reuniones/actas y exportaciones existentes.
- Mantener la identidad «The Registrar's Ledger»: Geist, tokens semánticos, superficies tranquilas y azul contenido. No introducir otra biblioteca visual, gradientes decorativos ni tarjetas anidadas para resolver problemas de estructura.
- Priorizar APIs y componentes existentes. No inventar campos, métricas, estados o endpoints. Si una mejora exige una capacidad de datos nueva, documentar la brecha y mantener una alternativa útil con los datos actuales.

## 5. Arquitectura de navegación objetivo

Reorganiza las ocho entradas existentes; no añadas un segundo sistema paralelo:

| Grupo | Entradas |
|---|---|
| Operación | Inicio · Pendientes y seguimiento · Horarios |
| Consulta académica | Grupos y alumnos · Docentes · Materias |
| Coordinación | Reuniones · Informes |

Materias debe distinguir **Oferta del periodo** y **Retícula**. Conserva las rutas antiguas o su compatibilidad mediante redirecciones que no pierdan contexto.

Recorrido principal: **abrir conjunto de pendientes → revisar evidencia → registrar observación → volver al mismo conjunto**.

## 6. Fase 1 — Pendientes y seguimiento en un lugar estable

Resuelve F01 y prepara F03/F10 de la auditoría.

### Archivos principales

- `frontend/src/components/layout/BaseLayout.jsx`
- `frontend/src/pages/jefe-carrera/JefeSeguimientos.jsx`
- `frontend/src/pages/jefe-carrera/JefeInicio.jsx`
- `frontend/src/pages/jefe-carrera/supervision/useSeguimientos.js`
- `frontend/src/pages/jefe-carrera/supervision/Seguimiento.jsx`
- `frontend/src/pages/jefe-carrera/supervision/useJefatura.js`
- `frontend/src/pages/jefe-carrera/supervision/ui.jsx`
- `frontend/src/App.jsx`

### Implementación

1. Reutiliza la sección actual de Observaciones como base del área «Pendientes y seguimiento».
2. Distingue dos conjuntos: **pendientes académicos detectados** y **observaciones registradas**. Conserva en observaciones las vistas de abiertos, revisión de hoy y cerrados.
3. Construye los pendientes a partir del resumen existente: listas sin completar, alumnos en riesgo, calificaciones pendientes y otras señales actuales. No los conviertas automáticamente en registros persistidos.
4. Usa claves estables según el tipo: clase/fecha, alumno, materia/grupo o docente. Reutiliza `claveCaso` y el contrato de seguimiento cuando correspondan; no unas un seguimiento general de docente a todas sus incidencias como si fueran el mismo caso.
5. Muestra motivo, contexto de grupo/materia/docente, antigüedad cuando esté disponible, estado de observación y acción principal.
6. Permite filtrar por tipo y docente/grupo donde los datos lo soporten. Usa orden determinista; no inventes una puntuación de gravedad ni mezcles unidades distintas en un «total de problemas» ambiguo.
7. Mantén registrar nota, fecha de revisión, cierre y consulta de historial. No introduzcas edición o borrado del historial si no existe.
8. Si falla la consulta de observaciones pero el resumen funciona, conserva los pendientes académicos y explica que su seguimiento no pudo consultarse. El fallo de una fuente no debe ocultar la otra.
9. Diferencia carrera vacía, ausencia real de pendientes, filtros sin resultados, periodo histórico, datos parciales y error.

### Aceptación

- Con listas pendientes y cero observaciones, el usuario ve los pendientes y entiende que aún no están documentados.
- Registrar una nota muestra su estado sin eliminar el pendiente académico.
- Cerrar la nota no hace desaparecer una lista que sigue incompleta.
- Los filtros y el contexto sobreviven al detalle y al regreso.
- Los enlaces antiguos a `vista=abiertos`, `vista=hoy` o `vista=cerrados` siguen abriendo el conjunto correcto. Añade un parámetro de sección distinto si lo necesitas; no reutilices silenciosamente esos valores para otra semántica.

## 7. Fase 2 — Destinos uniformes y regreso al origen

Resuelve F03 y F10.

1. Haz que los indicadores y accesos de Inicio abran su conjunto correspondiente con filtros visibles y un título que confirme lo solicitado. Mantén el orden de Inicio ya aprobado.
2. Usa enlaces normales con URL compartible; no dependas exclusivamente de estado efímero del router.
3. Conserva carrera, periodo, filtros y búsqueda del origen. Representa el retorno mediante ruta interna validada; evita redirecciones abiertas o URLs externas arbitrarias.
4. Añade «Volver a [origen]» en recorridos transversales. Conserva la ubicación jerárquica como información complementaria.
5. Al abrir un enlace directamente, ofrece un fallback razonable al listado correspondiente. No uses solamente `history.back()`.
6. Mantén Atrás/Adelante del navegador útiles y evita reescribir el historial con cada actualización automática.

### Aceptación

- Calificaciones pendientes abre exactamente las asignaciones/casos correspondientes.
- Desde una clase abierta por una lista pendiente se vuelve al filtro original.
- Desde un docente a una materia y de regreso se conserva el contexto.
- Recargar o compartir una URL no elimina el filtro ni abre otra carrera/periodo.

## 8. Fase 3 — Detalle académico canónico y separación de retícula/oferta

Resuelve F04 y F06.

### Archivos principales

- `JefeMateriaDetalle.jsx`, `JefeGrupoDetalle.jsx`, `JefeDocenteDetalle.jsx`, `JefeMaterias.jsx`.
- `supervision/useReportes.js`, `supervision/notas.jsx`, `supervision/AlumnoExpediente.jsx`, `supervision/IncorporarAlumno.jsx`.
- Rutas y enlaces de pendientes, grupos, docentes y observaciones.

### Implementación

1. Toma como contexto canónico **materia + grupo + periodo + carrera**. La ruta actual de materia con `oferta=<grupoId>` es una base compatible; evalúala antes de introducir rutas nuevas.
2. Cuando una materia tenga varios grupos, muestra un selector explícito y conserva la selección en URL. Un acceso desde un grupo o pendiente ya debe abrir el grupo correcto.
3. Organiza el detalle con navegación local consistente hacia resumen, alumnos, unidades/calificaciones, clases y seguimiento, usando solo capacidades existentes. No añadas pestañas vacías para completar un patrón.
4. Las unidades y calificaciones deben abrirse directamente: no detrás de «Alumnos inscritos» ni mediante un salto obligatorio al grupo.
5. Extrae o reutiliza las vistas existentes de unidades/calificaciones. Evita duplicar cálculos, dos implementaciones de la misma tabla o nuevos fetches por pestaña sin necesidad.
6. Conserva cierre de curso, estados de unidad, datos parciales y diferencia entre pendientes y calificaciones en cero.
7. Conserva incorporación y expediente, sus validaciones y restricciones históricas.
8. En Materias, diferencia Oferta del periodo de Retícula. Las acciones principales deben corresponder a la vista; la edición global de retícula debe expresar claramente que afecta el catálogo compartido entre periodos.
9. No derives una oferta única por materia: una misma materia puede impartirse en varios grupos/modalidades.

### Aceptación

- Desde un pendiente se consultan las unidades relevantes sin abandonar el contexto académico.
- Un alumno incorporado desde otro grupo conserva su grupo base y todas sus inscripciones pertinentes.
- El periodo histórico permite consulta y mantiene las restricciones de escritura existentes.
- Las rutas previas a grupos/materias siguen funcionando.
- No se confunde «materia del catálogo» con «materia impartida en un grupo».

## 9. Fase 4 — Consulta de grupos/alumnos y comparación de docentes

Resuelve F05, F07 y F08.

1. Presenta «Grupos y alumnos» como destino reconocible. Desde cada grupo debe ser evidente cómo abrir su alumnado y expedientes.
2. Usa nombres precisos: «Alumnos del grupo» para personas; «Inscripciones a materias» cuando se cuentan relaciones. No cambies el cálculo para hacer coincidir etiquetas ambiguas.
3. Conserva riesgo por grupo y modalidades. Muestra filtros activos y una acción clara para restablecerlos.
4. Una búsqueda transversal de alumnos es deseable, pero no presupongas que el endpoint de búsqueda para incorporación sirve como directorio general. Comprueba autorización, alcance y respuesta. Si no existe una fuente adecuada, entrega el acceso por grupos claramente organizado y registra la búsqueda global como mejora aparte.
5. En Docentes, facilita comparación mediante lista/tabla compacta con nombre, grupos/carga, listas pendientes, calificaciones pendientes y registro de listas. Conserva acceso a tarjetas y mapa semanal si siguen aportando información.
6. Mantén orden por nombre, pendientes, antigüedad y cobertura donde ya exista; al llegar desde un pendiente, respeta el filtro de procedencia.
7. Unifica la interacción de nombres de grupo, materia y docente: si parecen enlaces, deben navegar con contexto. No conviertas todos los chips en botones sin una acción útil.
8. Simplifica «Cobertura» mediante etiqueta comprensible y definición contextual. Mantén la distinción entre registro y asistencia física.

### Aceptación

- Un usuario nuevo reconoce dónde consultar un alumno sin depender de la sección de riesgo.
- Comparar pendientes de varios docentes no exige abrir cada ficha.
- Una fila abre el contexto correcto y permite volver al mismo listado.
- Las tablas móviles disponen de alternativa o desplazamiento interno accesible.

## 10. Fase 5 — Horarios móvil y mapas desplazables

Resuelve F09 y F11.

### Archivos principales

- `JefeHorarios.jsx`
- `supervision/HorarioCarrera.jsx`
- `graficas/MapaDocentes.jsx`
- `graficas/MapaRiesgoGrupo.jsx`
- `frontend/src/components/graficas/MapaRiesgo.jsx`
- `frontend/src/components/graficas/graficas.css`

### Implementación

1. Prioriza fecha, Día/Semana y agenda en móvil. Agrupa filtros secundarios en un desplegable accesible con resumen y contador de filtros activos.
2. Mantén visibles los filtros que definen el alcance actual; no ocultes silenciosamente que se consulta Mixto o un grupo/docente específico.
3. Compacta Pendientes de programar: contador y despliegue, sin ocupar la mayor parte del primer viewport por defecto.
4. Conserva agenda/matriz, incidencias, conflictos de aula, suspensiones, detalle de clase, retorno de foco y parámetros de URL.
5. Corrige el `touch-action:pan-y` compartido donde los mapas requieren scroll horizontal. Aplica el cambio con el alcance más estrecho y comprueba las gráficas que sí usan gestos propios.
6. No tomes ausencia de desborde global como prueba del arrastre horizontal. Verifica scroll interno y gesto táctil cuando haya herramienta/dispositivo compatible.

### Aceptación

- En 390×844 se puede ver una clase o un estado vacío/error claro sin atravesar una pantalla entera de configuración secundaria.
- Cambiar modalidad respeta el calendario Escolarizado/Mixto.
- Fecha, filtros y detalle sobreviven al retorno desde un expediente.
- Las columnas fuera de pantalla se pueden alcanzar con teclado y con gesto horizontal; documenta si la prueba táctil real no estuvo disponible.
- Abrir y cerrar un detalle devuelve el foco al control de origen.

## 11. Fase 6 — Recuperación, movimiento y tokens

Resuelve F12, F13 y F14 sin extender el rediseño a otros roles.

1. En `supervision/ui.jsx`, el fallo al copiar contacto debe producir un mensaje accesible y una alternativa seleccionable para copia manual. No afirmes éxito antes de resolver la promesa del portapapeles.
2. Revisa el apagado global de animaciones en `frontend/src/index.css`. Introduce alternativas deliberadas en los componentes afectados antes de retirar una protección global. No restaures movimiento intenso para otros roles como consecuencia accidental.
3. Centraliza los tokens de visualización de `components/graficas/graficas.css` en la fuente canónica, con equivalencia por tema. Mantén las escalas necesarias para datos y el significado de riesgo/meta; no conviertas una escala de datos en color decorativo.
4. Verifica contraste, foco, nombres accesibles, estados seleccionados, tamaño táctil y alternativas tabulares con el estilo calculado. No declares fallos solo por ver `size="sm"` en el código.

### Aceptación

- Una denegación del portapapeles no queda silenciosa.
- Movimiento reducido preserva selección, foco y feedback.
- Cambiar de tema mantiene legibilidad y semántica en tendencia, mapas y riesgo.
- No hay regresiones visibles en docente/alumno por estilos compartidos.

## 12. Validación integrada

Inspecciona `frontend/package.json`, configuración de pruebas y herramientas disponibles antes de elegir comandos. No actualices dependencias ni cambies Node/lockfiles por costumbre. Ejecuta comprobaciones apropiadas al cambio; no repitas suites completas si no hubo cambios o fallos nuevos que lo justifiquen.

### Pruebas existentes a preservar/ampliar

- `frontend/tests/jefatura-cobertura.test.js`
- `frontend/tests/jefatura-estados.test.js`
- `frontend/tests/jefatura-riesgo.test.js`
- `frontend/tests/jefatura-inicio-grafica.test.jsx`
- `frontend/tests/e2e/jefatura.spec.js`
- `frontend/tests/e2e/primeros-pasos-jefatura.spec.js`
- Fixtures `frontend/tests/e2e/fixtures.js` y `jefatura-fixture.js`.

Actualiza pruebas según el comportamiento acordado; no conserves SVG, sliders ni textos obsoletos solo para satisfacer selectores. Fija el tiempo en pruebas sensibles al calendario: las fixtures actuales dependen de Date.now(). Guarda nueva evidencia en una carpeta de esta implementación, sin sobrescribir la auditoría histórica.

### Recorridos obligatorios

| Caso | Resultado esperado |
|---|---|
| Pendiente sin observación | Visible en la bandeja, con acceso a evidencia y registro de nota. |
| Observación cerrada, lista aún incompleta | Se conserva el pendiente académico y se distingue el seguimiento cerrado. |
| Calificación pendiente | Abre materia/grupo/periodo y unidades correctos; regreso al filtro original. |
| Alumno incorporado de otro grupo | Expediente conserva grupo base y relaciones académicas del periodo. |
| Periodo histórico | Consulta coherente y restricciones de escritura existentes. |
| Error de una fuente | Explicación y reintento; los datos disponibles no se sustituyen por ceros. |
| Filtros sin resultados | Mensaje de filtro y restablecimiento, sin confundirse con carrera vacía. |
| Semana sin clases frente a semana con 0 % | Ausencia de porcentaje y cero real claramente distintos. |
| Informe con intervalo inválido | Validación y exportaciones protegidas como antes. |
| Reuniones | Próximas/historial, convocatoria y acta conservados; sin envíos reales durante pruebas. |

Verifica escritorio, tamaño intermedio y móvil, ambos temas y teclado. Comprueba foco de diálogos, scroll de tablas/mapas, textos largos y zoom. Usa axe cuando esté disponible y comunica sus límites: cero hallazgos automáticos no equivale a conformidad WCAG completa.

Revisa rendimiento con datos representativos si la nueva vista agrega reportes. `useReportes` ya tiene caché y deduplicación: no elimines esas protecciones ni conviertas la bandeja en una descarga de todos los expedientes al cargar. No anuncies problemas de latencia sin medirlos.

## 13. Cierre y entregables

- Implementación funcional en el proyecto actual, sin pantallas simuladas ni botones de adorno.
- Navegación y vocabulario consistentes; URLs previas compatibles.
- Pruebas relevantes ejecutadas, con resultado y limitaciones exactos.
- Capturas nuevas de Inicio, bandeja, detalle académico, listado docente y Horarios móvil, en estados representativos.
- PRODUCT/DESIGN/surface briefs actualizados solo donde la implementación cambie su contrato; no reescribir decisiones ajenas.
- Tabla final F01–F14 con estado **resuelto / parcial / pendiente**, evidencia y limitación. No puntuar como resuelta una búsqueda global o prueba táctil que no se haya hecho.
- Resumen final: qué cambió, qué tareas mejora, cómo se probó y qué queda pendiente. No declarar éxito en producción con pruebas de fixtures.

Finaliza con `$impeccable polish` y una auditoría acotada de los cambios según las instrucciones instaladas. No cierres toda la auditoría previa si permanecen hallazgos fuera de alcance. No publiques ni despliegues cambios sin que ese paso se haya solicitado.

## 14. Orden de ejecución recomendado

1. Verificar línea base y contratos de datos.
2. Bandeja de pendientes/seguimiento y compatibilidad de navegación.
3. Destinos homogéneos y retorno contextual.
4. Detalle académico canónico y separación oferta/retícula.
5. Descubrimiento de alumnos y comparación de docentes.
6. Horarios móvil y gesto horizontal en mapas.
7. Recuperación de portapapeles, movimiento reducido y tokens.
8. Validación integrada, evidencia y cierre honesto de hallazgos.

Cada fase debe quedar funcional antes de extenderse a la siguiente. Mantén el objetivo principal: que el jefe sepa dónde está, qué requiere atención, qué puede hacer y cómo continuar sin reconstruir el contexto.
