# Jefatura: consulta operativa, informe académico y convocatoria

Registro de cambios y validación local del **4 de noviembre de 2026**. SICAT conserva su carácter de registro institucional: datos legibles, estados explícitos y acciones precisas. Esta entrega no acredita despliegue ni validación en producción.

## Alcance y comparación con la interfaz anterior

| Superficie | Incumbente | Resultado |
| --- | --- | --- |
| Inicio | Clases de hoy y próximas reuniones | Panel lateral «Docentes en línea» junto a esas tareas, sin alterar su prioridad operativa. |
| Informes | Informe del periodo | Se conserva ese recorrido y se añade «Calificaciones y asistencia», por grupo, materia y unidad o acumulado a la fecha. |
| Programar reunión | Datos del acta visibles desde el inicio | El acta se prepara mediante una opción desmarcada inicialmente. Se puede convocar y avisar sin completarla. |

Se conservan la identidad institucional, Geist, los colores semánticos, las superficies sólidas y la jerarquía establecida en [DESIGN.md](../../../DESIGN.md). No se modificó ese contrato global para documentar decisiones de estas superficies.

## Reglas de producto y datos

**Docentes en línea.** «En clase» se deriva del horario y de la zona institucional; no mide conexión ni presencia física. Solo muestra clases del momento que no estén suspendidas, agrupadas por docente. Se actualiza cada 30 segundos y al recuperar el foco; no aparece en periodos históricos. La captura de asistencias se distingue en verde con texto y marca de verificación. Una lista parcial muestra su conteo («n de total»); cero registros conserva «Sin asistencias aún» o «Sin alumnos inscritos». Incluye carga, vacío, error y reintento.

**Calificaciones y asistencia.** La consulta exige grupo y materia de la oferta seleccionada. El alcance permite una unidad o el acumulado a la fecha. El avance muestra unidades cerradas sobre el total y aclara que el avance de la materia se comparte entre sus grupos. En el acumulado, las unidades pendientes sin actividad no reducen el promedio. Todos los inscritos aparecen aunque aún no tengan captura.

- **Cero y ausencia de datos:** una calificación de `0` sigue siendo cero; `null` se presenta como «Sin captura» o «—». Las pendientes no se convierten en ceros ni entran en el promedio.
- **Provisionalidad:** las calificaciones de unidades abiertas llevan «(P)», salvo captura manual. Un promedio con alguna nota provisional también se marca.
- **Asistencia registrada:** se suman asistencias y registros del alcance antes de dividir; no se promedian porcentajes por unidad o alumno. Sin registros se muestra «Sin registros». Una lista no capturada no se interpreta como faltas.
- **Corte:** se excluyen registros futuros; el límite temporal es el menor entre el fin del periodo y el momento actual.
- **Compatibilidad:** las unidades sin identificador de datos heredados se distinguen por su orden; no se agrupan todas bajo una clave vacía.

La tabla conserva sexo, número de control, notas, promedio, asistencia y pendientes. En móvil, el desplazamiento horizontal queda dentro de la región de la tabla. Cambiar filtros invalida el resultado y cancela solicitudes pendientes para evitar mostrar o descargar datos de otra selección.

**Exportación institucional.** PDF y Excel usan el mismo servicio y alcance de la consulta, con metadatos, corte, sexo y notas sobre los cálculos. Excel contiene «Resumen», «Calificaciones» y «Avance de unidades». El PDF separa el detalle por unidad para mantener la lectura.

**Reuniones.** «Preparar datos del acta ahora (opcional)» comienza desmarcado en una convocatoria nueva. Sin esa opción, el payload omite los campos de acta; el backend ya los admitía como opcionales. Se mantienen las notificaciones y la justificación de las clases que se cruzan con la reunión. Editar reuniones con acta conserva la compatibilidad; «Ver acta» se oculta cuando no existe contenido. No hubo cambios de esquema ni migraciones de Prisma.

## API y compatibilidad

Se incorporan `GET /jefe-carrera/calificaciones` y `GET /jefe-carrera/calificaciones/exportar` (`formato=pdf|excel`). Reutilizan los guards y las comprobaciones existentes de carrera, periodo, grupo y oferta de supervisión; una unidad ajena a la materia se rechaza. El informe del periodo mantiene su recorrido y sus endpoints.

## Verificación registrada

| Comprobación | Resultado |
| --- | --- |
| Frontend: 16 casos distintos | 3 del panel, 3 del reporte académico, 2 del formulario, 6 del informe y 2 de próximas reuniones; aprobados. |
| Backend: 26 casos distintos | 6 del reporte académico, 15 de reuniones y 5 de supervisión; aprobados. |
| Compilación y análisis | Build de frontend, ESLint y TypeScript (`tsc`) aprobados. |
| Revisión independiente | Dictamen **SHIP**, sin hallazgos materiales. |
| Navegador mediante CUA | Escritorio de 1440 px y móvil de 390 px; informe sin desbordamiento de página. Convocatoria de prueba creada con confirmación para 8 docentes. |
| Archivos descargados | PDF y Excel reales generados con `ReporteAcademicoService`, mediante un harness con fixtures y sin base de datos. Cabecera «Sexo» y las tres hojas de Excel confirmadas. |

Los E2E existentes se actualizaron a las etiquetas actuales, pero **no se ejecutaron por CLI**. La inspección visual del PDF cubrió su primera página, no todas. La comprobación con fixtures no sustituye una prueba contra la base de datos ni una validación de entrega real de notificaciones.

## Evidencias

| Archivo | Cobertura |
| --- | --- |
| [Inicio: escritorio](inicio-escritorio.png) / [móvil](inicio-movil.png) | Escritorio: viewport; móvil: página completa. |
| [Informe académico: escritorio](academico-escritorio.png) / [móvil](academico-movil.png) | Página completa en ambos tamaños. |
| [Reunión sin acta: escritorio](reunion-sin-acta-escritorio.png) / [móvil](reunion-sin-acta-movil.png) | Viewport inicial del modal; no documentan todo su contenido desplazable. |
| [PDF institucional](pdf-institucional.png) | Primera página inspeccionada visualmente. |
| [PDF descargado](calificaciones-acumulado.pdf) / [Excel descargado](calificaciones-acumulado.xlsx) | Acumulado generado por el servicio real con datos de prueba. |

Esta carpeta documenta la validación local previa a la publicación de los cambios en Git.
