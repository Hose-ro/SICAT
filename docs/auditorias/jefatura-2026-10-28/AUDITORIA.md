# Auditoría UI/UX de jefatura de carrera — SICAT

Fecha: 28 de octubre de 2026. Skill: Impeccable 4.3.1. Modo: Operate.

Método: dos evaluaciones independientes (A: `/root/ux_design`; B: `/root/technical_audit`), revisión del código actual y recorrido adicional del evaluador principal en navegador local con datos simulados. No se modificaron funcionalidades ni archivos de la aplicación.

## Dictamen

La confusión procede principalmente de la arquitectura de información y de la secuencia de trabajo. La interfaz organiza las consultas por entidades —grupos, docentes, materias—, pero el jefe de carrera necesita detectar un pendiente, entender su evidencia, acordar una acción y continuar con el siguiente. Ese recorrido atraviesa varias entidades y representaciones.

El sistema visual sí tiene identidad y coherencia: tipografía, superficies, color institucional y estados con texto. Conviene conservarlo. El rediseño debe empezar por navegación, destinos y jerarquía; cambiar colores o redondear componentes aportaría poco frente al problema descrito.

Resultado heurístico: **23/40**, aceptable con mejoras significativas necesarias. Resultado técnico orientativo: **14/20**, buena base con debilidades en adaptación móvil. Son escalas distintas; ninguna constituye una prueba con usuarios ni una certificación WCAG.

Se registran **14 hallazgos: 0 P0, 5 P1, 9 P2 y 0 P3**. P1 significa dificultad importante de uso; P2, fricción o riesgo con alternativa disponible. El riesgo de gesto táctil F11 requiere confirmación en dispositivo, aunque la configuración que lo causa sí se comprobó.

## Alcance y evidencia

- Código: las páginas `frontend/src/pages/jefe-carrera/`, sus vistas de supervisión, gráficas, bienvenida, primeros pasos y reuniones; rutas y layout compartido; tokens y estilos gráficos.
- Evaluación A: nueve capturas existentes de Inicio, Materias, Horarios, Docentes, móvil, alumnos de grupo, detalle de clase, Observaciones y Reuniones. Son evidencia histórica con datos visibles del 23 de octubre, contrastada con el código actual; no se presentan como capturas nuevas.
- Navegador actual: Inicio → indicador de calificaciones → Materias filtradas → detalle de materia; Horarios, Docentes en tarjetas y por semana, Informe, Reuniones y Observaciones. Escritorio 1440 × 1000 y móvil 390 × 844, tema oscuro. Las otras variantes se revisaron mediante código y capturas existentes.
- Datos: fixtures locales de `frontend/tests/e2e/fixtures.js` y `jefatura-fixture.js`. No se accedió a producción, no se enviaron convocatorias ni se guardaron registros.
- Detector: `impeccable detect --json frontend/src/pages/jefe-carrera` devolvió `[]`, cero hallazgos y cero falsos positivos. Su alcance no incluye todos los estilos compartidos y no evalúa la comprensibilidad de los recorridos.
- No se ejecutó la suite E2E existente, ni una medición actual con axe/Lighthouse, contraste exhaustivo, zoom de 200 %, lector de pantalla o dispositivo táctil real. No se afirma que esas pruebas pasen ni que el producto cumpla WCAG AA.

## Evaluación heurística

| Heurística | /4 | Diagnóstico |
|---|---:|---|
| Visibilidad del estado | 3 | Carrera, periodo y actualización explícitos; varios alcances temporales exigen atención. |
| Correspondencia con el trabajo real | 2 | Lenguaje institucional, pero la organización exige traducir un problema a una entidad. |
| Control y libertad | 3 | Retornos y filtros recordados; procedencia transversal incompleta. |
| Consistencia | 2 | Sistema visual común; indicadores similares con destinos diferentes. |
| Prevención de errores | 3 | Restricciones históricas y avisos de alcance; catálogo global junto al trabajo del periodo. |
| Reconocimiento frente a recuerdo | 2 | Hay que recordar dónde buscar alumnos, unidades y pendientes. |
| Eficiencia | 2 | Enlaces y filtros útiles; demasiados saltos para supervisión y comparación. |
| Minimalismo y jerarquía | 1 | Inicio y cabeceras móviles desplazan las tareas centrales. |
| Recuperación de errores | 3 | Reintentos, estados parciales y conservación de datos; fallo silencioso de portapapeles. |
| Ayuda | 2 | Guía específica del rol; explicaciones largas compensan decisiones de estructura. |
| **Total** | **23/40** | **Mejoras significativas necesarias** |

Los valores son juicio experto, no mediciones de satisfacción, tiempo de tarea o éxito real.

## Salud técnica

| Dimensión | /4 | Evidencia y límite |
|---|---:|---|
| Accesibilidad | 3 | Labels, foco, skip link, alternativas tabulares y estados semánticos; conformidad pendiente de medición. |
| Rendimiento | 3 | Rutas diferidas y caché; sin perfiles ni métricas de carga reales. |
| Adaptación responsive | 2 | Reflujo y agenda móvil presentes; exceso de profundidad y restricción táctil en mapas. |
| Temas | 3 | Ambos temas implementados; paleta gráfica paralela al sistema canónico. |
| Integridad de implementación | 3 | Detector limpio y componentes coherentes; atajos manuales verificados. |
| **Total orientativo** | **14/20** | **Buena base; no equivale a facilidad de navegación** |

Integridad: la implementación expresa un producto específico y coherente en su identidad visual. No supera todavía el criterio operativo de recorridos predecibles entre pendientes, evidencia y seguimiento. El detector limpio no invalida esta conclusión de diseño.

## Hallazgos P1

### F01. Los pendientes no tienen un destino estable de trabajo

**Ubicación:** `frontend/src/components/layout/BaseLayout.jsx:162`; `frontend/src/pages/jefe-carrera/JefeInicio.jsx:185`; `JefeSeguimientos.jsx:63`.

**Categoría:** arquitectura de información, descubribilidad y correspondencia con tareas.

El menú ofrece consultas por Grupos, Docentes, Materias y Horarios. Observaciones reúne notas ya registradas, mientras los problemas sin nota se presentan en Inicio y otras vistas. En el recorrido local coexistieron cuatro listas pendientes en Inicio con cero observaciones abiertas: es un estado válido de los datos, pero el usuario debe comprender por qué «Abiertos 0» no significa que no haya problemas por atender.

**Impacto:** antes de actuar, hay que distinguir pendiente, evidencia y registro de seguimiento, y elegir una sección diferente para cada uno.

**Recomendación:** una entrada estable «Pendientes y seguimiento» con separación explícita entre «Por atender» y «Con observación», reutilizando la supervisión y las notas actuales. Mostrar tipo, docente/grupo, antigüedad y acción. Una observación cerrada no debe ocultar un pendiente académico que siga existiendo.

**Aceptación:** una persona puede encontrar un pendiente sin saber previamente si ya tiene nota; al volver del detalle conserva el conjunto filtrado.

**Comando:** `$impeccable shape`.

### F02. Inicio posterga las tareas que promete priorizar

**Ubicación:** `frontend/src/pages/jefe-carrera/JefeInicio.jsx:173`.

**Categoría:** jerarquía y carga cognitiva.

El orden es guía de preparación, indicadores, Requiere atención, tendencia, pendientes por docente, alumnos en riesgo y Hoy en la carrera. Con la guía visible, el primer viewport de escritorio se consume principalmente en preparación e indicadores. La gráfica separa la advertencia del detalle sobre el que se actúa. La agenda de hoy queda al final.

**Impacto:** se repite información y se exige desplazamiento para descubrir el siguiente paso. El problema crece con más docentes y pendientes.

**Recomendación:** contexto compacto, casos prioritarios con acción y agenda breve al principio. Guía plegable y secundaria cuando la carrera ya opera. Tendencia en una sección analítica posterior. Mantener los estados de preparación y los detalles actuales.

**Aceptación:** al abrir Inicio se ve al menos un caso prioritario accionable y acceso a las clases de hoy; una gráfica no interrumpe el acceso al conjunto de pendientes.

**Comando:** `$impeccable distill` y `$impeccable layout`.

### F03. Indicadores equivalentes visualmente navegan de maneras diferentes

**Ubicación:** `frontend/src/pages/jefe-carrera/JefeInicio.jsx:225`.

**Categoría:** consistencia y predictibilidad.

Asistencia salta a pendientes de docentes dentro de Inicio; Calificaciones abre Materias filtradas; Alumnos salta y despliega una sección; Asignaciones abre otra variante de Materias. El pie de Calificaciones vuelve a pendientes de docentes. El recorrido actual confirmó el cambio Inicio → Materias al pulsar «15 Calificaciones pendientes».

**Impacto:** es necesario aprender qué ocurrirá con cada indicador, aunque se vean como el mismo tipo de control.

**Recomendación:** cada indicador abre su conjunto correspondiente en la vista operativa, con el filtro visible y una forma uniforme de volver. Si se mantiene un despliegue local, identificarlo mediante verbo y affordance distintos.

**Aceptación:** «Calificaciones pendientes» conduce a ese conjunto y su título lo confirma; regresar no obliga a reconstruir filtros ni posición de revisión.

**Comando:** `$impeccable clarify` y `$impeccable shape`.

### F04. Para revisar unidades se abandona el detalle de la materia

**Ubicación:** `frontend/src/pages/jefe-carrera/JefeMateriaDetalle.jsx:88`, `:96`, `:141`; `JefeGrupoDetalle.jsx:18`.

**Categoría:** navegación contextual y continuidad de tarea.

La ficha de materia muestra unidades como chips y cifras de pendientes. El acceso «Ver calificaciones y observaciones por unidad» está dentro de «Alumnos inscritos», después de la tabla, y abre el grupo en «Materias y unidades».

**Impacto:** alguien que busca calificaciones debe adivinar que están detrás de alumnos y luego cambiar de entidad. El sistema ofrece varias representaciones del mismo contexto académico.

**Recomendación:** detalle canónico de materia + grupo + periodo, con accesos locales a resumen, alumnos, unidades/calificaciones, clases y seguimiento. Reutilizar las vistas y cálculos actuales. Mantener la retícula como catálogo separado.

**Aceptación:** desde una calificación pendiente se llega a sus unidades sin tener que abrir «Alumnos inscritos» ni buscar otro grupo.

**Comando:** `$impeccable shape`.

### F05. Encontrar un alumno depende de conocer otro dato primero

**Ubicación:** `frontend/src/components/layout/BaseLayout.jsx:162`; `frontend/src/pages/jefe-carrera/JefeGrupoDetalle.jsx:74`; `JefeMateriaDetalle.jsx:128`; `JefeInicio.jsx:217`.

**Categoría:** descubribilidad y reconocimiento.

El expediente se alcanza desde un grupo, una materia o un alumno en riesgo. No hay una entrada estable claramente denominada para alumnos. Las incorporaciones de otros grupos aumentan la incertidumbre sobre dónde buscar.

**Impacto:** localizar una persona exige recordar su grupo o inscripción antes de abrir su información.

**Recomendación dentro del alcance actual:** hacer explícito «Grupos y alumnos», con acceso claro al listado y expediente ya existentes. Como mejora opcional posterior, validar búsqueda transversal por nombre/número de control; esa agregación puede necesitar trabajo de datos y no se presupone incluida en un simple cambio visual.

**Aceptación:** la navegación identifica dónde consultar alumnos y el expediente explica grupo base e inscripciones actuales.

**Comando:** `$impeccable clarify` y `$impeccable shape`.

## Hallazgos P2

| ID | Problema y ubicación | Impacto | Recomendación y comando |
|---|---|---|---|
| F06 | Materias mezcla catálogo global y operación del periodo. `JefeMaterias.jsx:114`, `:151`. | «Agregar a la retícula» compite con una consulta filtrada por calificaciones; el alcance global necesita una advertencia extensa. | Separar Oferta del periodo y Retícula; mostrar el alcance junto a la acción correspondiente. `$impeccable clarify`. |
| F07 | Cifras y términos demandan traducción. `JefeGrupos.jsx:60`, `:105`; `JefeDocentes.jsx:157`; `JefeMaterias.jsx:212`. | Alumnos del grupo, inscripciones y cobertura pueden interpretarse como conteos equivalentes o presencia física. | «Alumnos del grupo», «Inscripciones a materias», «Registro de listas» y ayuda contextual breve con definición exacta. Conservar las distinciones de cálculo. `$impeccable clarify`. |
| F08 | Docentes abre tarjetas ordenadas por nombre. `JefeDocentes.jsx:107`, `:143`, `:157`. | Comparar pendientes exige recorrer bloques altos; en móvil la explicación y los filtros preceden a casi todo el directorio. | Lista/tabla compacta de comparación; al entrar desde pendientes, mantener filtro y orden por pendientes. Tarjetas como alternativa. `$impeccable layout`. |
| F09 | La agenda móvil queda demasiado abajo. `supervision/HorarioCarrera.jsx:204`, `:235`, `:251`; `JefeHorarios.jsx:6`. | A 390 × 844, la primera clase apareció en y=1072.5 px desde el inicio del documento, con un pendiente de programar abierto. No hubo desborde global: scrollWidth=390. | Fecha y vista primero; filtros secundarios plegables con resumen aplicado; pendientes de programar compactos. Mantener agenda y matriz. `$impeccable adapt`. |
| F10 | El retorno conduce al listado de la entidad y no siempre al origen transversal. `supervision/ui.jsx:24`, `:54`; `JefeGrupoDetalle.jsx:47`. | Desde una revisión iniciada en docente o pendiente, el retorno puede interrumpir la sesión de trabajo. Los filtros de listados sí se conservan. | «Volver a [origen]» junto a ubicación estable; conservar consulta/filtro. No sustituirlo por un `history.back()` sin fallback. `$impeccable shape`. |
| F11 | Mapas horizontales usan `touch-action: pan-y`. `components/graficas/graficas.css:52`; `graficas/MapaDocentes.jsx:96`; `components/graficas/MapaRiesgo.jsx:95`. | En el mapa semanal se midieron 834 px de contenido en 358 px visibles, con estilo calculado pan-y. La configuración restringe el gesto horizontal nativo. El fallo de gesto real queda pendiente de validar. | Permitir desplazamiento en ambos ejes en mapas; reservar pan-y para la interacción que lo requiera. Probar arrastre táctil y alternativa tabular. `$impeccable adapt`. |
| F12 | Copiar contacto ignora errores de portapapeles. `supervision/ui.jsx:318`. | Si falla el permiso o la API, no se informa si el contacto se copió. Verificado en código, no se forzó la denegación en navegador. | Mensaje accesible de fallo y alternativa seleccionable para copia manual. `$impeccable harden`. |
| F13 | Movimiento reducido usa apagado global a 0.01 ms. `frontend/src/index.css:357`. | Suprime transiciones sin alternativa deliberada por componente. Es una deuda de calidad Impeccable; no demuestra por sí sola una infracción WCAG. | Alternativas estáticas/instantáneas que preserven foco, selección y feedback; aprovechar el patrón gráfico existente en `graficas.css:120`. `$impeccable harden`. |
| F14 | Las gráficas mantienen una paleta paralela. `components/graficas/graficas.css:4`. | Puede divergir del sistema institucional al cambiar temas; incluye blanco puro contrario a DESIGN.md. No se ha demostrado fallo de contraste. | Centralizar tokens gráficos semánticos en la fuente canónica y mantener escalas de datos y ambos temas. `$impeccable document` para registrar el contrato. |

Las rutas abreviadas de esta tabla pertenecen a `frontend/src/pages/jefe-carrera/`, salvo las que comienzan por `components/` (desde `frontend/src/`) y las que indican explícitamente `frontend/`.

## Recorridos y carga cognitiva

| Tarea | Recorrido actual | Fricción | Recorrido recomendado |
|---|---|---|---|
| Revisar listas pendientes | Inicio → indicador → docentes con pendientes → desplegar detalle → clase en Horarios → observación. | Cambian representación y ubicación; la nota y el problema tienen estados distintos. | Pendientes filtrados → evidencia → observación → volver al mismo conjunto. |
| Revisar calificaciones | Inicio → Materias filtradas → materia → Alumnos inscritos → enlace al grupo → Materias y unidades. | El detalle buscado está detrás de una sección con otro nombre y otra entidad. | Pendiente → materia en grupo/periodo → unidades. |
| Consultar alumno | Grupo o materia → listado → expediente; alternativamente riesgo en Inicio. | Requiere conocer pertenencia o estar en riesgo. | Grupos y alumnos → acceso visible al listado/expediente; búsqueda global solo como mejora validada. |
| Supervisar hoy en móvil | Menú → Horarios → contexto y textos → filtros → pendientes de programar → fecha → agenda. | Más de una pantalla antes de la primera clase. | Fecha/vista + filtros resumidos → agenda → detalles secundarios. |
| Continuar seguimiento | Pendiente en Inicio → registrar nota → Observaciones. | «Abiertos» solo refleja observaciones, no todos los pendientes. | Un área de trabajo distingue pendientes reales y casos documentados. |

La cantidad de opciones no constituye un fallo por sí misma: ocho destinos pueden ser razonables. El problema es que sus nombres no permiten predecir cuál resuelve una tarea y varias rutas representan partes de un mismo caso.

**Primera visita:** la guía de cuatro pasos y los cuatro indicadores compiten con ocho destinos. La interfaz debe enseñar una ruta principal sin exigir memorizar el mapa completo.

**Uso experto:** filtros y enlaces ayudan, pero comparar tarjetas y abandonar materia por grupo añade pasos. Priorizar listas comparables y retorno al conjunto.

**Uso móvil interrumpido:** filtros extensos y agenda profunda obligan a reconstruir contexto. Mostrar selección activa y tarea antes que explicaciones.

**Teclado/baja visión:** preservar foco, labels, skip link y alternativas tabulares. El coste de lectura de textos pequeños y tablas anchas merece una sesión específica de zoom y lector de pantalla; no se presume incumplimiento sin medir.

**Recorrido emocional:** el punto de mayor fricción aparece al abrir un pendiente y tener que elegir otra entidad para entenderlo. El punto más sólido es registrar una observación desde el contexto del problema. Falta que el retorno conduzca con claridad al siguiente caso.

## Lo que conviene conservar

1. Carrera y periodo explícitos; distinción entre datos del intervalo, al corte e históricos.
2. Honestidad de las métricas: captura en SICAT no equivale a presencia física del docente.
3. Estados con texto, semántica de formularios, foco visible y alternativas de gráficas como tabla.
4. Filtros en URL y recuperación de listados filtrados.
5. Conservación de datos previos al fallar una actualización y distinción entre información parcial y ausencia real de problemas.
6. Guía específica de jefatura, agenda móvil, reuniones con Próximas/Historial y confirmaciones antes de acciones destructivas.
7. Identidad institucional sobria. No requiere sustituir marca, tipografía ni paleta para resolver la confusión.

## Arquitectura propuesta

Reorganizar las ocho entradas actuales, sin acumular un segundo menú sobre el existente:

| Grupo | Entradas | Contenido actual que se conserva |
|---|---|---|
| Operación | Inicio; Pendientes y seguimiento; Horarios | Resumen diario, pendientes de supervisión, observaciones e historial, agenda y matriz. |
| Consulta académica | Grupos y alumnos; Docentes; Materias | Expedientes, riesgo por grupo, cargas, unidades e inscritos. En Materias: Oferta del periodo y Retícula claramente diferenciadas. |
| Coordinación | Reuniones; Informes | Convocatorias, actas, historial, intervalos y exportaciones. |

Los pendientes se pueden presentar con los datos de supervisión y seguimientos existentes. No se propone convertir una nota cerrada en resolución automática del problema. Búsqueda transversal de alumnos, nuevas agregaciones de API o métricas adicionales requieren alcance propio si los datos actuales no bastan.

**Primer viewport propuesto:** carrera/periodo compactos; título; casos prioritarios con docente/grupo, motivo y acción; agenda breve de hoy. Preparación y tendencia quedan disponibles después. No convertir todos los contenidos en nuevas tarjetas equivalentes.

## Orden de trabajo y criterios de validación

1. **P1 — `$impeccable shape`:** acordar navegación y detalle canónico (F01/F04/F05/F10). Mantener inventario de capacidades, roles, edición global/histórica y exportaciones antes de mover rutas.
2. **P1 — `$impeccable distill` y `$impeccable layout`:** reordenar Inicio y simplificar comparación de docentes (F02/F08). Acción antes que analítica o explicación extensa.
3. **P1/P2 — `$impeccable clarify`:** unificar destinos de indicadores, nombres y alcance de catálogos/métricas (F03/F06/F07).
4. **P2 — `$impeccable adapt`:** agenda y filtros móviles; gesto horizontal de mapas (F09/F11).
5. **P2 — `$impeccable harden`:** errores al copiar y movimiento reducido deliberado (F12/F13).
6. **P2 — `$impeccable document`:** centralizar y registrar tokens gráficos coherentes (F14).
7. **Cierre — `$impeccable polish`:** revisión conjunta de escritorio/móvil, ambos temas, teclado, textos y estados. Repetir `$impeccable audit` después de los cambios.

La validación debe cubrir: encontrar un pendiente sin nota, revisar una unidad desde una alerta, abrir alumno incorporado a otro grupo, registrar observación y regresar al filtro, consultar clases de hoy en móvil y exportar un intervalo válido. Verificar también carga, error, datos parciales, cero real, filtros sin resultados y periodo histórico.

Criterios propuestos de aceptación, no resultados obtenidos: una clase de hoy visible en el primer viewport móvil con filtros secundarios cerrados; destinos homogéneos para indicadores; acceso directo a unidades desde materia; retorno a la lista original; arrastre horizontal real en mapas. Validar estas tareas con jefes de carrera antes de declarar resuelta la navegación.

## Riesgos pendientes y notas de ejecución

- Rendimiento: `supervision/useReportes.js:59` consulta por oferta y actualiza por respuesta; hay caché de 60 segundos y deduplicación. Medir con volumen representativo antes de clasificarlo como fallo de rendimiento.
- No reportar objetivos táctiles pequeños a partir de `size=sm`: `index.css:343` aplica mínimos móviles. Requiere medición del control concreto.
- No atribuir inconsistencias de cifras o fechas del fixture a errores de producción. Son datos de prueba.
- Independencia: A no vio el detector ni la evaluación B; B no vio A ni auditorías anteriores. El evaluador principal sintetizó después de ambas evaluaciones y añadió evidencia de navegador.
- Target de archivo: `frontend/src/pages/jefe-carrera/JefeInicio.jsx`; slug obtenido por helper: `frontend-src-pages-jefe-carrera-jefeinicio-jsx`. No existía `.impeccable/critique/ignore.md`.
- Contexto Impeccable cargado una vez. El único surface brief encontrado era de Tareas del docente; no se aplicó como restricción específica a jefatura. Se usaron PRODUCT.md, DESIGN.md y la implementación del rol.
- No se inyectó overlay ni se arrancó servidor del detector: la API de evaluación disponible es de solo lectura y no permite la precondición de inyección mutable. El detector CLI sí se ejecutó.
- Servidor local temporal con fixtures detenido al terminar; tab de inspección cerrado y viewport restaurado. Scripts temporales eliminados; resultados útiles se conservan en esta carpeta.

## Decisiones para una siguiente fase

1. Prioridad de la pantalla inicial: pendientes de docentes, alumnos en riesgo o clases de hoy.
2. Forma habitual de revisión: por docente, por grupo o por tipo de pendiente.

Estas decisiones ajustan el orden del rediseño; no son necesarias para considerar entregada esta auditoría.
