# Selector de pendientes — 2 de noviembre de 2026

- Eliminados el subtítulo de Pendientes y seguimiento y la explicación «Detectado en el resumen del periodo…» solicitados por el usuario.
- Conservado el aviso específico de consulta histórica y los avisos de error/calendario.
- Categorías en contenedor compartido, selección destacada y contadores en insignias. Se mantienen todas las categorías existentes, incluidas las de cero resultados.
- Desplegable con nombres completos y cantidades en contenedores de hasta 760px; enlaces de categorías en escritorio con los mismos parámetros de URL.
- Restablecer filtros elimina Docente y Grupo, conservando el tipo. Cuando solo el tipo deja la lista vacía, «Ver todos los tipos» permite salir de esa selección.
- Datos y cálculos existentes conservados. Sin cambios de backend ni publicación.

Validación: 9 pruebas de pendientes aprobadas; ESLint y build correctos. Navegador con fixtures en escritorio y móvil: cambio de categoría, combinación con docente, restablecimiento conservando categoría y selección móvil. Ambos textos ausentes; ancho global de 390px en viewport de 390px; sin errores de consola observados. Los tests E2E afectados se actualizaron, pero no se ejecutó su suite.

Capturas locales con datos de prueba: `escritorio.png` y `movil.png`.
