# Ajustes de Inicio y registro de asistencias

28 de octubre de 2026. Implementación de las prioridades confirmadas tras la auditoría.

## Cambios

- Orden real de lectura: Clases de hoy → Alumnos en riesgo → Pendientes por docente → Registro de asistencias.
- Hasta tres clases en curso/próximas, con enlace al horario. Las sesiones con registro abierto aparecen primero. Se conserva la exclusión de Hoy en periodos históricos.
- Riesgo abierto inicialmente con cuatro casos como máximo; criterio en ayuda desplegable y acceso al conjunto por grupo.
- Pendientes conserva agrupación, antigüedad y observaciones; muestra cuatro docentes inicialmente y permite ampliar.
- Indicadores y otras revisiones permanecen en «Resumen del periodo y otras revisiones». La guía de preparación queda después del trabajo operativo; una carrera vacía mantiene su bienvenida y guía.
- Gráfica única de barras, escala fija 0–100 %, porcentaje visible, meta 90 %, semana actual provisional, selección mediante radios nativos/teclado y detalle persistente. Sin clases evaluables no se representa como cero.
- Tabla, filtros por modalidad y enlaces a docentes/horarios conservados. Cantidades de listas tardías y suspendidas visibles; cálculos originales intactos.
- Scroll horizontal interno y centrado de semana al seleccionar/redimensionar. Tokens existentes; estilos limitados a Inicio.

## Verificación realizada

- 24 pruebas aprobadas en cuatro archivos: cobertura, estados, riesgo y el nuevo componente gráfico.
- ESLint sin errores en los dos componentes, nuevo test y dos archivos E2E actualizados.
- Compilación de producción completada.
- Detector Impeccable de layout: cero hallazgos en los componentes afectados.
- Navegador local con fixtures: 1440×1000 y 390×844; ambos temas; selección con flechas; filtros Todas/Mixto; alternancia gráfica/tabla. Sin errores de consola observados.
- DOM confirma el orden de las cuatro secciones. La línea de meta se verificó geométricamente en 90 %. Ancho global igual al viewport (1440 y 390); gráfica móvil con scroll interno y touch-action:auto.
- Los tests E2E existentes se actualizaron a la nueva interacción. No se ejecutó su suite ni se realizó una validación con backend/producción o dispositivo táctil real.

## Evidencia

- [Inicio en escritorio](inicio-escritorio-oscuro.png)
- [Inicio en móvil](inicio-movil-oscuro.png)
- [Gráfica en escritorio, oscuro](grafica-escritorio-oscuro.png)
- [Gráfica en escritorio, claro](grafica-escritorio-claro.png)
- [Gráfica en móvil](grafica-movil-oscuro.png)

Capturas del navegador local con datos simulados. Las capturas de Inicio se tomaron tras activar «Saltar al contenido», por lo que la barra móvil fija puede cubrir el comienzo del contexto de carrera.

## Alcance pendiente

Esta entrega no da por corregidos todos los hallazgos de la auditoría: bandeja de pendientes y seguimiento, detalle académico canónico, acceso transversal a alumnos y otras vistas conservan su implementación. No se ha decidido un criterio único de revisión por docente, grupo o tipo. No se publicaron cambios.
