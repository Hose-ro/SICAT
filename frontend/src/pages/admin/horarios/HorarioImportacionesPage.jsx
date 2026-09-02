import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  Camera,
  Check,
  Clock3,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import api from "../../../api/axios";

const DIAS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

const ERRORES_LECTOR = {
  LECTOR_NO_CONFIGURADO: {
    title: "Lector automático sin configurar",
    description:
      "La fotografía se guardó correctamente, pero no fue analizada porque falta OPENAI_API_KEY en el backend.",
  },
  LECTOR_CREDENCIALES_INVALIDAS: {
    title: "Credencial del lector inválida",
    description:
      "Revisa el secreto OPENAI_API_KEY del backend antes de procesar nuevamente.",
  },
  LECTOR_LIMITE_ALCANZADO: {
    title: "Límite temporal alcanzado",
    description:
      "La fotografía sigue guardada. Espera unos minutos y vuelve a procesarla.",
  },
  LECTOR_MODELO_NO_DISPONIBLE: {
    title: "Modelo de lectura no disponible",
    description: "Revisa OPENAI_VISION_MODEL en la configuración del backend.",
  },
  LECTOR_TIEMPO_AGOTADO: {
    title: "La lectura tardó demasiado",
    description: "La fotografía sigue guardada y puede procesarse nuevamente.",
  },
  LECTOR_IMAGEN_INVALIDA: {
    title: "No se pudo preparar la imagen",
    description:
      "Solicita una fotografía JPG, PNG o WebP y evita archivos dañados.",
  },
  LECTOR_SIN_BLOQUES: {
    title: "No se encontraron bloques completos",
    description:
      "Revisa que la tabla ocupe la mayor parte de la fotografía y vuelva a procesarla.",
  },
  LECTOR_RESPUESTA_INVALIDA: {
    title: "La lectura quedó incompleta",
    description: "La fotografía sigue guardada. Intenta procesarla nuevamente.",
  },
  LECTOR_NO_DISPONIBLE: {
    title: "Lector temporalmente no disponible",
    description:
      "La fotografía sigue guardada. Intenta procesarla nuevamente más tarde.",
  },
};

const STATUS = {
  PENDIENTE_PROCESAMIENTO: {
    label: "Procesando",
    className: "bg-primary/10 text-primary",
  },
  PENDIENTE_REVISION: {
    label: "Por revisar",
    className: "bg-warning/15 text-warning-foreground",
  },
  ERROR: {
    label: "Captura manual",
    className: "bg-destructive/10 text-destructive",
  },
  APROBADA: {
    label: "Aprobada",
    className: "bg-success/10 text-success",
  },
  RECHAZADA: {
    label: "Rechazada",
    className: "bg-muted text-muted-foreground",
  },
};

function mensajeError(error, fallback) {
  const message = error.response?.data?.message;
  return Array.isArray(message) ? message.join(". ") : (message ?? fallback);
}

function crearBloque() {
  return {
    reticulaMateriaId: "",
    docenteId: "",
    dia: "Lunes",
    horaInicio: "08:00",
    horaFin: "09:00",
    aulaDetectada: "",
  };
}

function mapearBloques(data) {
  return data.bloques.map((bloque) => ({
    reticulaMateriaId: bloque.reticulaMateriaId ?? "",
    docenteId: bloque.docenteId ?? "",
    materiaDetectada: bloque.materiaDetectada ?? "",
    docenteDetectado: bloque.docenteDetectado ?? "",
    confianzaMateria: bloque.confianzaMateria,
    confianzaDocente: bloque.confianzaDocente,
    dia: bloque.dia,
    horaInicio: bloque.horaInicio,
    horaFin: bloque.horaFin,
    aulaDetectada: bloque.aulaDetectada ?? "",
  }));
}

function obtenerStatus(item) {
  if (
    item.estado === "ERROR" &&
    item.codigoErrorProcesamiento === "LECTOR_NO_CONFIGURADO"
  ) {
    return {
      label: "Sin lector",
      className: "bg-warning/15 text-warning-foreground",
    };
  }
  return STATUS[item.estado] ?? STATUS.ERROR;
}

export default function HorarioImportacionesPage() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [bloques, setBloques] = useState([]);
  const [observaciones, setObservaciones] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [rejecting, setRejecting] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [lector, setLector] = useState(null);

  const cargarLista = useCallback(async (preferredId) => {
    const response = await api.get("/horario-importaciones");
    setItems(response.data);
    const pending = response.data.find((item) =>
      ["PENDIENTE_REVISION", "ERROR", "PENDIENTE_PROCESAMIENTO"].includes(
        item.estado,
      ),
    );
    const nextId = preferredId ?? pending?.id ?? response.data[0]?.id ?? null;
    setSelectedId((current) => current ?? nextId);
  }, []);

  const cargarConfiguracion = useCallback(async () => {
    const response = await api.get(
      "/horario-importaciones/configuracion/lector",
    );
    setLector(response.data);
  }, []);

  useEffect(() => {
    Promise.all([cargarLista(), cargarConfiguracion()])
      .catch((error) =>
        setMessage({
          type: "error",
          text: mensajeError(error, "No se pudieron cargar las importaciones"),
        }),
      )
      .finally(() => setLoading(false));
  }, [cargarConfiguracion, cargarLista]);

  useEffect(() => {
    if (!selectedId) {
      setDetalle(null);
      return;
    }
    let cancelled = false;
    let objectUrl = "";
    setDetailLoading(true);
    setMessage({ type: "", text: "" });
    Promise.all([
      api.get(`/horario-importaciones/${selectedId}`),
      api
        .get(`/horario-importaciones/${selectedId}/foto`, {
          responseType: "blob",
        })
        .then((response) => {
          objectUrl = URL.createObjectURL(response.data);
          return objectUrl;
        })
        .catch(() => ""),
    ])
      .then(([response, imageUrl]) => {
        if (cancelled) return;
        const data = response.data;
        setDetalle(data);
        setBloques(mapearBloques(data));
        setObservaciones(data.observaciones ?? "");
        setFotoUrl(imageUrl);
        setRejecting(false);
        setMotivo("");
      })
      .catch((error) => {
        if (!cancelled)
          setMessage({
            type: "error",
            text: mensajeError(error, "No se pudo cargar la propuesta"),
          });
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedId]);

  const pendientes = useMemo(
    () =>
      items.filter((item) => !["APROBADA", "RECHAZADA"].includes(item.estado))
        .length,
    [items],
  );
  const editable =
    detalle && detalle.estado !== "APROBADA" && detalle.estado !== "RECHAZADA";
  const completos =
    bloques.length > 0 &&
    bloques.every(
      (bloque) =>
        bloque.reticulaMateriaId &&
        bloque.docenteId &&
        bloque.dia &&
        bloque.horaInicio &&
        bloque.horaFin,
    );

  const actualizarBloque = (index, field, value) => {
    setBloques((current) =>
      current.map((bloque, currentIndex) =>
        currentIndex === index ? { ...bloque, [field]: value } : bloque,
      ),
    );
  };

  const payloadActual = () => ({
    observaciones,
    bloques: bloques.map((bloque) => ({
      reticulaMateriaId: Number(bloque.reticulaMateriaId),
      docenteId: Number(bloque.docenteId),
      dia: bloque.dia,
      horaInicio: bloque.horaInicio,
      horaFin: bloque.horaFin,
      aulaDetectada: bloque.aulaDetectada,
    })),
  });

  const guardar = async ({ silent = false } = {}) => {
    if (!completos) {
      setMessage({
        type: "error",
        text: "Completa materia, docente, día y horas de todos los bloques.",
      });
      return false;
    }
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const response = await api.patch(
        `/horario-importaciones/${detalle.id}`,
        payloadActual(),
      );
      setDetalle(response.data);
      if (!silent)
        setMessage({ type: "success", text: "La propuesta quedó guardada." });
      await cargarLista(detalle.id);
      return true;
    } catch (error) {
      setMessage({
        type: "error",
        text: mensajeError(error, "No se pudo guardar la propuesta"),
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const aprobar = async () => {
    const guardado = await guardar({ silent: true });
    if (!guardado) return;
    setSaving(true);
    try {
      await api.post(`/horario-importaciones/${detalle.id}/aprobar`);
      setMessage({
        type: "success",
        text: "Horario aprobado, grupo y docentes actualizados.",
      });
      await cargarLista(detalle.id);
      const response = await api.get(`/horario-importaciones/${detalle.id}`);
      setDetalle(response.data);
    } catch (error) {
      setMessage({
        type: "error",
        text: mensajeError(error, "No se pudo aprobar el horario"),
      });
    } finally {
      setSaving(false);
    }
  };

  const reprocesar = async () => {
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const response = await api.post(
        `/horario-importaciones/${detalle.id}/reprocesar`,
      );
      setDetalle(response.data);
      setBloques(mapearBloques(response.data));
      setMessage({
        type: response.data.estado === "ERROR" ? "error" : "success",
        text:
          response.data.estado === "ERROR"
            ? response.data.errorProcesamiento ||
              "No se pudo leer la fotografía."
            : "La fotografía se procesó nuevamente. Revisa las coincidencias.",
      });
      await cargarLista(detalle.id);
    } catch (error) {
      setMessage({
        type: "error",
        text: mensajeError(error, "No se pudo reprocesar la fotografía"),
      });
    } finally {
      setSaving(false);
    }
  };

  const rechazar = async () => {
    if (motivo.trim().length < 3) {
      setMessage({
        type: "error",
        text: "Explica brevemente qué debe corregirse.",
      });
      return;
    }
    setSaving(true);
    try {
      await api.post(`/horario-importaciones/${detalle.id}/rechazar`, {
        motivo,
      });
      setMessage({
        type: "success",
        text: "La propuesta fue rechazada y el alumno recibió la observación.",
      });
      setRejecting(false);
      await cargarLista(detalle.id);
      const response = await api.get(`/horario-importaciones/${detalle.id}`);
      setDetalle(response.data);
    } catch (error) {
      setMessage({
        type: "error",
        text: mensajeError(error, "No se pudo rechazar la propuesta"),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Administración académica
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">
            Horarios por revisar
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Confirma materias y docentes antes de publicar un horario para todo
            el grupo.
          </p>
        </div>
        <span className="w-fit rounded-full bg-warning/15 px-3 py-1.5 text-sm font-medium text-warning-foreground">
          {pendientes} pendiente{pendientes === 1 ? "" : "s"}
        </span>
      </header>

      {message.text && (
        <div
          role={message.type === "error" ? "alert" : "status"}
          className={`rounded-2xl border px-4 py-3 text-sm ${
            message.type === "error"
              ? "border-destructive/25 bg-destructive/10 text-destructive"
              : "border-success/25 bg-success/10 text-success"
          }`}
        >
          {message.text}
        </div>
      )}

      {lector && !lector.configurado && (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold">Lectura automática desactivada</p>
            <p className="mt-1 max-w-3xl text-muted-foreground">
              Falta configurar{" "}
              <code className="font-medium text-foreground">
                OPENAI_API_KEY
              </code>{" "}
              en el backend. Las fotografías se reciben, pero quedan para
              captura manual hasta configurar el secreto y reiniciar el
              servicio.
            </p>
          </div>
        </div>
      )}

      <div className="grid min-h-[620px] gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section
          className="overflow-hidden rounded-[22px] border border-border bg-card"
          aria-label="Importaciones recibidas"
        >
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold text-foreground">Solicitudes</h2>
          </div>
          <div className="max-h-[720px] overflow-y-auto p-2">
            {loading && (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-20 animate-pulse rounded-xl bg-muted"
                  />
                ))}
              </div>
            )}
            {!loading && items.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                No hay fotografías por revisar.
              </div>
            )}
            {items.map((item) => {
              const status = obtenerStatus(item);
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`mb-1 w-full rounded-xl px-3 py-3 text-left transition-colors focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 ${
                    selectedId === item.id ? "bg-accent" : "hover:bg-muted"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {item.alumno.nombre}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.semestre}° {item.seccion} · {item.periodo} ·{" "}
                    {item.bloques.length} bloques
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section
          className="overflow-hidden rounded-[22px] border border-border bg-card"
          aria-label="Revisión del horario"
        >
          {!selectedId && (
            <div className="flex min-h-[620px] flex-col items-center justify-center gap-3 px-6 text-center">
              <BookOpenCheck
                className="h-8 w-8 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="font-medium text-foreground">
                Selecciona una solicitud
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                La fotografía y sus coincidencias aparecerán aquí.
              </p>
            </div>
          )}
          {selectedId && detailLoading && (
            <div className="space-y-4 p-6">
              <div className="h-8 w-1/2 animate-pulse rounded-lg bg-muted" />
              <div className="h-72 animate-pulse rounded-2xl bg-muted" />
            </div>
          )}
          {detalle && !detailLoading && (
            <div>
              <div className="flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {detalle.alumno.nombre}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {detalle.carrera.nombre} · {detalle.semestre}°{" "}
                    {detalle.seccion} · {detalle.periodo}
                  </p>
                </div>
                <span
                  className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${obtenerStatus(detalle).className}`}
                >
                  {obtenerStatus(detalle).label}
                </span>
              </div>

              <div className="grid gap-6 p-5 2xl:grid-cols-[minmax(260px,0.75fr)_minmax(420px,1.25fr)]">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Camera
                      className="h-4 w-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    Fotografía recibida
                  </div>
                  <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background p-2">
                    {fotoUrl ? (
                      <img
                        src={fotoUrl}
                        alt="Horario enviado por el alumno"
                        className="max-h-[440px] w-full rounded-xl object-contain"
                      />
                    ) : (
                      <p className="px-4 text-center text-sm text-muted-foreground">
                        No hay una fotografía disponible para esta solicitud.
                      </p>
                    )}
                  </div>
                  {detalle.errorProcesamiento && (
                    <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
                      <p className="font-medium">
                        {(
                          ERRORES_LECTOR[detalle.codigoErrorProcesamiento] ?? {}
                        ).title ?? "Se necesita captura manual"}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {(
                          ERRORES_LECTOR[detalle.codigoErrorProcesamiento] ?? {}
                        ).description ?? detalle.errorProcesamiento}
                      </p>
                    </div>
                  )}
                  {editable && detalle.fotoDisponible && (
                    <button
                      type="button"
                      disabled={saving || lector?.configurado === false}
                      onClick={reprocesar}
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/35 focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      Procesar nuevamente
                    </button>
                  )}
                </div>

                <div className="min-w-0 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-foreground">
                        Bloques confirmados
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Una fila por materia, día e intervalo.
                      </p>
                    </div>
                    {editable && (
                      <button
                        type="button"
                        onClick={() =>
                          setBloques((current) => [...current, crearBloque()])
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/35 focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Agregar bloque
                      </button>
                    )}
                  </div>

                  {bloques.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                      No se detectaron bloques. Agrégalos manualmente usando la
                      fotografía.
                    </div>
                  )}

                  <div className="space-y-3">
                    {bloques.map((bloque, index) => (
                      <div
                        key={`${index}-${bloque.dia}-${bloque.horaInicio}`}
                        className="rounded-2xl border border-border bg-background p-3"
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="space-y-1 text-xs font-medium text-muted-foreground sm:col-span-2">
                            Materia
                            <select
                              value={bloque.reticulaMateriaId}
                              disabled={!editable}
                              onChange={(event) =>
                                actualizarBloque(
                                  index,
                                  "reticulaMateriaId",
                                  event.target.value,
                                )
                              }
                              className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-70"
                            >
                              <option value="">Selecciona una materia</option>
                              {detalle.catalogo.reticula.map((materia) => (
                                <option key={materia.id} value={materia.id}>
                                  {materia.clave} · {materia.nombre}
                                </option>
                              ))}
                            </select>
                            {bloque.materiaDetectada &&
                              !bloque.reticulaMateriaId && (
                                <span className="block text-xs text-warning-foreground">
                                  Texto detectado: {bloque.materiaDetectada}
                                </span>
                              )}
                          </label>
                          <label className="space-y-1 text-xs font-medium text-muted-foreground sm:col-span-2">
                            Docente
                            <select
                              value={bloque.docenteId}
                              disabled={!editable}
                              onChange={(event) =>
                                actualizarBloque(
                                  index,
                                  "docenteId",
                                  event.target.value,
                                )
                              }
                              className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-70"
                            >
                              <option value="">Selecciona un docente</option>
                              {detalle.catalogo.docentes.map((docente) => (
                                <option key={docente.id} value={docente.id}>
                                  {docente.nombre}
                                </option>
                              ))}
                            </select>
                            {bloque.docenteDetectado && !bloque.docenteId && (
                              <span className="block text-xs text-warning-foreground">
                                Detectado: {bloque.docenteDetectado}. Este
                                docente no está registrado.{" "}
                                <Link
                                  to="/usuarios"
                                  className="font-semibold text-primary hover:underline"
                                >
                                  Ir a Usuarios
                                </Link>
                              </span>
                            )}
                          </label>
                          <label className="space-y-1 text-xs font-medium text-muted-foreground">
                            Día
                            <select
                              value={bloque.dia}
                              disabled={!editable}
                              onChange={(event) =>
                                actualizarBloque(
                                  index,
                                  "dia",
                                  event.target.value,
                                )
                              }
                              className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-70"
                            >
                              {DIAS.map((dia) => (
                                <option key={dia}>{dia}</option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-1 text-xs font-medium text-muted-foreground">
                            Aula detectada
                            <input
                              value={bloque.aulaDetectada}
                              disabled={!editable}
                              onChange={(event) =>
                                actualizarBloque(
                                  index,
                                  "aulaDetectada",
                                  event.target.value,
                                )
                              }
                              placeholder="Opcional"
                              className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-70"
                            />
                          </label>
                          <label className="space-y-1 text-xs font-medium text-muted-foreground">
                            Inicio
                            <input
                              type="time"
                              value={bloque.horaInicio}
                              disabled={!editable}
                              onChange={(event) =>
                                actualizarBloque(
                                  index,
                                  "horaInicio",
                                  event.target.value,
                                )
                              }
                              className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-70"
                            />
                          </label>
                          <label className="space-y-1 text-xs font-medium text-muted-foreground">
                            Fin
                            <input
                              type="time"
                              value={bloque.horaFin}
                              disabled={!editable}
                              onChange={(event) =>
                                actualizarBloque(
                                  index,
                                  "horaFin",
                                  event.target.value,
                                )
                              }
                              className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-70"
                            />
                          </label>
                        </div>
                        {editable && (
                          <button
                            type="button"
                            onClick={() =>
                              setBloques((current) =>
                                current.filter(
                                  (_, currentIndex) => currentIndex !== index,
                                ),
                              )
                            }
                            className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                          >
                            <Trash2
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            Quitar bloque
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <label className="block space-y-1 text-xs font-medium text-muted-foreground">
                    Observaciones internas
                    <textarea
                      value={observaciones}
                      disabled={!editable}
                      maxLength={500}
                      rows={3}
                      onChange={(event) => setObservaciones(event.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-70"
                    />
                  </label>

                  {editable && !rejecting && (
                    <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setRejecting(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                        Rechazar
                      </button>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          disabled={saving || !completos}
                          onClick={() => guardar()}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/35 focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50"
                        >
                          <Save className="h-4 w-4" aria-hidden="true" />
                          Guardar borrador
                        </button>
                        <button
                          type="button"
                          disabled={saving || !completos}
                          onClick={aprobar}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-strong focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                          Aprobar y publicar
                        </button>
                      </div>
                    </div>
                  )}

                  {editable && rejecting && (
                    <div className="space-y-3 rounded-2xl border border-destructive/25 bg-destructive/10 p-4">
                      <label className="block space-y-1 text-sm font-medium text-foreground">
                        Motivo para el alumno
                        <textarea
                          autoFocus
                          value={motivo}
                          onChange={(event) => setMotivo(event.target.value)}
                          maxLength={500}
                          rows={3}
                          placeholder="Ejemplo: la sección de la fotografía no coincide con tu registro."
                          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                        />
                      </label>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setRejecting(false)}
                          className="rounded-xl px-3 py-2 text-sm font-medium text-foreground hover:bg-background"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={rechazar}
                          className="rounded-xl bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
                        >
                          Confirmar rechazo
                        </button>
                      </div>
                    </div>
                  )}

                  {!editable && detalle.grupo && (
                    <div className="flex flex-wrap gap-4 rounded-2xl bg-muted px-4 py-3 text-sm text-foreground">
                      <span className="inline-flex items-center gap-2">
                        <UserRound className="h-4 w-4 text-muted-foreground" />{" "}
                        Grupo {detalle.grupo.nombre}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-muted-foreground" />{" "}
                        {bloques.length} bloques revisados
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
