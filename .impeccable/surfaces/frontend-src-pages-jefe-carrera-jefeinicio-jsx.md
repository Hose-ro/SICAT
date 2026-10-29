---
version: 1
slug: "frontend-src-pages-jefe-carrera-jefeinicio-jsx"
primary_target: "frontend/src/pages/jefe-carrera/JefeInicio.jsx"
related_targets: ["frontend/src/pages/jefe-carrera/graficas/TendenciaCobertura.jsx", "frontend/src/pages/jefe-carrera/inicio.css"]
---

# Inicio de jefatura

**Mode:** Operate. Escritorio para supervisión y web móvil para consulta.

**Prioridad confirmada por el usuario, 2026-10-28:** clases de hoy → alumnos en riesgo → pendientes de docentes. No hay un criterio confirmado de revisión por docente, grupo o tipo; conservar los accesos existentes sin imponer uno nuevo.

**Dirección:** mantener The Registrar's Ledger y usar orden de lectura real en DOM. Las clases de hoy deben aparecer antes de la guía y las estadísticas. Riesgo muestra cuatro alumnos inicialmente; pendientes muestra cuatro docentes con ampliación. Los indicadores y otras revisiones se conservan en un desplegable; la preparación de carrera vacía sigue siendo la entrada principal cuando no hay operación.

**Registro de asistencias:** una gráfica de barras con escala fija 0–100 %, porcentajes explícitos, meta de META=90, semanas seleccionables por radio nativo y detalle persistente. Semana en curso con contorno discontinuo y resultado provisional. Semana sin clases evaluables es ausencia de porcentaje, nunca 0 %. Mantener tabla, modalidades, detalle de completas/esperadas, parciales, sin captura, tardías, suspendidas y enlaces a Horarios/Docentes. Desplazamiento interno horizontal en móvil, centrado en la semana seleccionada sin mover la página.

**Restricciones:** cálculos y endpoints actuales. No promediar porcentajes; sumar cantidades antes de dividir. Las tardías ya cuentan entre completas. Suspendidas y clases no elegibles quedan fuera del denominador. Captura en SICAT no demuestra presencia física del docente. No modificar el resto de gráficas para resolver esta.

**Estados:** periodo histórico no presenta clases de hoy; ausencia del agregado no renderiza gráfica; denominadores cero muestran estado vacío; cambios de modalidad o datos normalizan la selección. Sin calendario conservar aviso de información no evaluable.

**Destinos (2026-10-28, fases 1–6):** los cuatro indicadores del resumen abren su conjunto en Pendientes y seguimiento (`?seccion=pendientes&tipo=…`) con «Volver a Inicio»; los enlaces a clases, docentes, expedientes y unidades llevan `?desde=`. La bandeja conjunta, el detalle canónico de materia y la búsqueda de alumnos ya existen fuera de Inicio; Inicio no los duplica.
