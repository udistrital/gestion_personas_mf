import { Injectable } from "@angular/core";
import { Observable, delay, of, throwError } from "rxjs";
import { textoPlanoDesdeHtml } from "src/app/shared/utils/texto-plano";
import { MIN_CARACTERES_JUSTIFICACION } from "src/app/shared/validators/justificacion.validator";
import {
  PROVEEDORES_MOCK,
  identidadProveedor,
} from "../models/proveedores.model";
import {
  AdjuntoEstudio,
  CriteriosProveedoresEstudio,
  ETIQUETAS_ESTADO_INSCRIPCION,
  ESTUDIOS_MERCADO_MOCK,
  EstudioMercado,
  EventoEstudioMercado,
  FiltroEstudiosMercado,
  GrupoEstudio,
  InvitacionEstudio,
  RegistroEstudioMercado,
  RegistroInvitacionEstudio,
  ReporteProveedoresEstudio,
  ResultadoListadoEstudios,
  ResultadoProveedoresEstudio,
  SOLICITUDES_ESTUDIO_MOCK,
  SolicitudAsociadaEstudio,
  USUARIO_ESTUDIO_MOCK,
  asuntoInvitacionEstudio,
  buscarProveedoresEstudio,
  calcularValorReferencia,
  estadoEstudioMercado,
} from "../models/estudio-mercado.model";

/**
 * Capa de datos de los estudios de mercado (S-13).
 *
 * Es el único punto de enlace de las pantallas con el backend. El mock
 * conserva los estudios en memoria y simula retardos, errores y vacíos con
 * los parámetros de la URL. Cuando exista HTTP se reemplaza por
 * `EstudiosMercadoServiceHttp` sin tocar las pantallas.
 *
 * Trucos de desarrollo:
 * - `?mockEstudios=error` → falla el listado.
 * - `?mockEstudios=vacio` → listado sin registros.
 * - `?mockProveedores=error` → falla la búsqueda de proveedores.
 * - `?mockProveedores=vacio` → búsqueda sin proveedores.
 * - `?mockProveedores=pocos` → limita la búsqueda a 2 proveedores.
 * - `?mockEnvio=error` → falla el envío de invitaciones.
 * - `?mockGuardado=error` → falla el guardado del borrador.
 * - `?mockDetalleEstudio=error` → falla la consulta de un estudio.
 * - `?mockReporte=error` → falla la generación del reporte RN-19.
 * - `?mockRetardo=3000` → retardo en milisegundos.
 */
export abstract class EstudiosMercadoService {
  abstract listar(
    criterios: Partial<FiltroEstudiosMercado>,
    pagina: number,
    porPagina: number,
  ): Observable<ResultadoListadoEstudios>;

  /** Solicitudes y ofertas simuladas que alimentan el modal económico. */
  abstract listarSolicitudesAsociadas(): Observable<
    readonly SolicitudAsociadaEstudio[]
  >;

  abstract obtenerPorId(id: string): Observable<EstudioMercado | null>;

  /** Crea o actualiza un borrador. `id` nulo crea uno nuevo. */
  abstract guardarBorrador(
    id: string | null,
    datos: RegistroEstudioMercado,
  ): Observable<EstudioMercado>;

  abstract buscarProveedores(
    criterios: CriteriosProveedoresEstudio,
  ): Observable<ResultadoProveedoresEstudio>;

  /** Crea las invitaciones y deja el estudio en recepción. */
  abstract enviarInvitaciones(
    id: string,
    datos: RegistroInvitacionEstudio,
  ): Observable<EstudioMercado>;

  /** Descarta un borrador. Solo se permite en estado `borrador`. */
  abstract descartar(id: string): Observable<void>;

  /**
   * RN-19: reporte básico de proveedores aptos.
   *
   * El mockup no muestra la acción de descarga; el método queda listo para
   * cuando la vista la incorpore. Devuelve un CSV en memoria.
   */
  abstract generarReporteProveedores(
    criterios: CriteriosProveedoresEstudio,
  ): Observable<ReporteProveedoresEstudio>;
}

/** Implementación simulada de los estudios de mercado. */
@Injectable()
export class EstudiosMercadoServiceMock extends EstudiosMercadoService {
  private estudios: EstudioMercado[] = ESTUDIOS_MERCADO_MOCK.map(clonarEstudio);
  private consecutivo = ESTUDIOS_MERCADO_MOCK.length + 1;

  listar(
    criterios: Partial<FiltroEstudiosMercado>,
    pagina: number,
    porPagina: number,
  ): Observable<ResultadoListadoEstudios> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 700;

    if (params.get("mockEstudios") === "error") {
      return throwError(
        () => new Error("No fue posible consultar los estudios de mercado."),
      ).pipe(delay(retardo));
    }

    if (params.get("mockEstudios") === "vacio") {
      return of({
        estudios: [],
        total: 0,
        conteos: conteosVacios(),
        dependencias: [],
      }).pipe(delay(retardo));
    }

    const ahora = Date.now();
    const visibles = this.estudios
      .filter((estudio) => estudio.estado !== "descartado")
      .map((estudio) => ({
        ...clonarEstudio(estudio),
        estado: estadoEstudioMercado(estudio, ahora),
      }));

    const filtrados = visibles.filter((estudio) =>
      coincideEstudio(estudio, criterios),
    );
    const desde = pagina * porPagina;

    return of({
      estudios: filtrados.slice(desde, desde + porPagina),
      total: filtrados.length,
      conteos: contarEstudios(visibles),
      dependencias: [...new Set(visibles.map((estudio) => estudio.dependencia))]
        .sort((a, b) => a.localeCompare(b, "es-CO")),
    }).pipe(delay(retardo));
  }

  listarSolicitudesAsociadas(): Observable<
    readonly SolicitudAsociadaEstudio[]
  > {
    const retardo =
      Number(new URLSearchParams(window.location.search).get("mockRetardo")) ||
      450;
    return of(SOLICITUDES_ESTUDIO_MOCK).pipe(delay(retardo));
  }

  obtenerPorId(id: string): Observable<EstudioMercado | null> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 600;

    if (params.get("mockDetalleEstudio") === "error") {
      return throwError(
        () => new Error("No fue posible consultar el estudio de mercado."),
      ).pipe(delay(retardo));
    }

    const estudio = this.estudios.find((candidato) => candidato.id === id);
    return of(estudio ? clonarEstudio(estudio) : null).pipe(delay(retardo));
  }

  guardarBorrador(
    id: string | null,
    datos: RegistroEstudioMercado,
  ): Observable<EstudioMercado> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 700;

    if (params.get("mockGuardado") === "error") {
      return throwError(
        () => new Error("No fue posible guardar el borrador del estudio."),
      ).pipe(delay(retardo));
    }

    const solicitud = SOLICITUDES_ESTUDIO_MOCK.find(
      (candidata) => candidata.id === datos.solicitudId,
    );
    if (!solicitud) {
      return throwError(
        () => new Error("La solicitud asociada ya no está disponible."),
      ).pipe(delay(retardo));
    }

    const objeto = textoPlanoDesdeHtml(datos.objeto).trim();
    if (objeto.length < 10) {
      return throwError(
        () =>
          new Error("El objeto del estudio debe tener al menos 10 caracteres."),
      ).pipe(delay(retardo));
    }

    const analisis = textoPlanoDesdeHtml(datos.analisisTecnico).trim();
    if (analisis.length < 50) {
      return throwError(
        () =>
          new Error(
            "El análisis técnico debe tener al menos 50 caracteres.",
          ),
      ).pipe(delay(retardo));
    }

    if (datos.actividades.length === 0) {
      return throwError(
        () =>
          new Error(
            "Debe seleccionar al menos una actividad económica (CIIU).",
          ),
      ).pipe(delay(retardo));
    }

    const ahora = new Date().toISOString();
    const valorReferencia = calcularValorReferencia(
      datos.ofertasVinculadas,
      datos.metodoPrecio,
    );
    const adjuntos = datos.adjuntos.map((archivo, indice) =>
      adjuntoDeArchivo(archivo, indice, ahora),
    );

    if (id) {
      const indice = this.estudios.findIndex((estudio) => estudio.id === id);
      const existente = this.estudios[indice];
      if (!existente) {
        return throwError(
          () => new Error("El estudio que intenta editar ya no existe."),
        ).pipe(delay(retardo));
      }
      if (existente.estado === "descartado") {
        return throwError(
          () => new Error("El estudio fue descartado y no se puede editar."),
        ).pipe(delay(retardo));
      }

      const actualizado: EstudioMercado = {
        ...existente,
        objeto,
        tipoNecesidad: datos.tipoNecesidad,
        vigencia: datos.vigencia,
        dependencia: datos.dependencia,
        responsable: datos.responsable,
        solicitudId: solicitud.id,
        solicitudTitulo: solicitud.titulo,
        fuenteInformacion: datos.fuenteInformacion,
        metodoPrecio: datos.metodoPrecio,
        analisisTecnico: analisis,
        variablesTributarias: [...datos.variablesTributarias],
        ofertasVinculadas: datos.ofertasVinculadas.map((oferta) => ({
          ...oferta,
        })),
        valorReferencia,
        presupuestoBase: solicitud.presupuesto,
        presupuestoFijado:
          datos.fijarPresupuesto || existente.presupuestoFijado,
        actividades: [...datos.actividades],
        areaSnies: datos.areaSnies,
        nucleoSnies: datos.nucleoSnies,
        fechaLimite: datos.fechaLimite,
        asunto:
          datos.asunto.trim() ||
          asuntoInvitacionEstudio(existente.id, objeto),
        mensaje: datos.mensaje,
        notificar: datos.notificar,
        adjuntos: adjuntos.length ? adjuntos : existente.adjuntos,
        actualizadoEl: ahora,
        eventos: [
          ...existente.eventos,
          eventoDeEstudio(
            existente.id,
            existente.eventos.length + 1,
            "borrador",
            datos.fijarPresupuesto
              ? "Presupuesto referencial fijado y borrador actualizado."
              : "Borrador del estudio actualizado.",
          ),
        ],
      };

      this.estudios[indice] = actualizado;
      return of(clonarEstudio(actualizado)).pipe(delay(retardo));
    }

    const codigo = `EM-${datos.vigencia}-${String(this.consecutivo++).padStart(4, "0")}`;
    const nuevo: EstudioMercado = {
      id: codigo,
      vigencia: datos.vigencia,
      objeto,
      tipoNecesidad: datos.tipoNecesidad,
      dependencia: datos.dependencia,
      responsable: datos.responsable,
      estado: "borrador",
      creadoEl: ahora,
      creadoPor: USUARIO_ESTUDIO_MOCK.usuario,
      actualizadoEl: ahora,
      solicitudId: solicitud.id,
      solicitudTitulo: solicitud.titulo,
      fuenteInformacion: datos.fuenteInformacion,
      metodoPrecio: datos.metodoPrecio,
      analisisTecnico: analisis,
      variablesTributarias: [...datos.variablesTributarias],
      ofertasVinculadas: datos.ofertasVinculadas.map((oferta) => ({ ...oferta })),
      valorReferencia,
      presupuestoBase: solicitud.presupuesto,
      presupuestoFijado: datos.fijarPresupuesto,
      actividades: [...datos.actividades],
      areaSnies: datos.areaSnies,
      nucleoSnies: datos.nucleoSnies,
      fechaLimite: datos.fechaLimite,
      asunto:
        datos.asunto.trim() || asuntoInvitacionEstudio(codigo, objeto),
      mensaje: datos.mensaje,
      notificar: datos.notificar,
      adjuntos,
      invitaciones: [],
      eventos: [
        eventoDeEstudio(
          codigo,
          1,
          "creado",
          `Estudio creado y asociado a la solicitud ${solicitud.id}.`,
        ),
      ],
    };

    this.estudios.unshift(nuevo);
    return of(clonarEstudio(nuevo)).pipe(delay(retardo));
  }

  buscarProveedores(
    criterios: CriteriosProveedoresEstudio,
  ): Observable<ResultadoProveedoresEstudio> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 650;

    if (params.get("mockProveedores") === "error") {
      return throwError(
        () =>
          new Error(
            "No fue posible consultar el banco de proveedores. Intente nuevamente.",
          ),
      ).pipe(delay(retardo));
    }

    if (params.get("mockProveedores") === "vacio") {
      return of({ proveedores: [], total: 0, todos: [], idsFiltrados: [] }).pipe(
        delay(retardo),
      );
    }

    const estudio = criterios.estudioId
      ? this.estudios.find(
          (candidato) => candidato.id === criterios.estudioId,
        ) ?? null
      : null;

    let filas = buscarProveedoresEstudio(criterios, estudio);
    if (params.get("mockProveedores") === "pocos") {
      filas = filas.slice(0, 2);
    }

    const idsFiltrados = filas.map((fila) => fila.proveedor.id);
    const desde = criterios.pagina * criterios.porPagina;

    return of({
      proveedores: filas.slice(desde, desde + criterios.porPagina),
      total: filas.length,
      todos: filas,
      idsFiltrados,
    }).pipe(delay(retardo));
  }

  enviarInvitaciones(
    id: string,
    datos: RegistroInvitacionEstudio,
  ): Observable<EstudioMercado> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 900;

    if (params.get("mockEnvio") === "error") {
      return throwError(
        () =>
          new Error(
            "No fue posible enviar las invitaciones. Intente nuevamente.",
          ),
      ).pipe(delay(retardo));
    }

    const indice = this.estudios.findIndex((estudio) => estudio.id === id);
    const estudio = this.estudios[indice];
    if (!estudio) {
      return throwError(
        () => new Error("El estudio ya no existe en el expediente."),
      ).pipe(delay(retardo));
    }

    if (
      estudio.estado === "descartado" ||
      estudio.estado === "aprobado" ||
      estudio.estado === "cerrado"
    ) {
      return throwError(
        () =>
          new Error(
            "El estado actual del estudio no permite enviar invitaciones.",
          ),
      ).pipe(delay(retardo));
    }

    const ids = [...new Set(datos.proveedoresIds)];
    if (ids.length === 0) {
      return throwError(
        () =>
          new Error(
            "Debe seleccionar al menos un proveedor para enviar la invitación.",
          ),
      ).pipe(delay(retardo));
    }

    const mensaje = textoPlanoDesdeHtml(datos.mensaje).trim();
    if (mensaje.length < MIN_CARACTERES_JUSTIFICACION) {
      return throwError(
        () =>
          new Error(
            `El mensaje de la invitación debe tener al menos ${MIN_CARACTERES_JUSTIFICACION} caracteres.`,
          ),
      ).pipe(delay(retardo));
    }

    const limite = Date.parse(datos.fechaLimite);
    if (!Number.isFinite(limite) || limite <= Date.now()) {
      return throwError(
        () =>
          new Error(
            "La fecha y hora límite de recepción debe ser futura.",
          ),
      ).pipe(delay(retardo));
    }

    const ahora = new Date().toISOString();
    const yaInvitados = new Set(
      estudio.invitaciones.map((invitacion) => invitacion.proveedorId),
    );
    const nuevas: InvitacionEstudio[] = [];

    for (const proveedorId of ids) {
      const proveedor = PROVEEDORES_MOCK.find(
        (candidato) => candidato.id === proveedorId,
      );
      if (!proveedor) {
        return throwError(
          () =>
            new Error(
              "Uno de los proveedores seleccionados ya no está disponible en el banco.",
            ),
        ).pipe(delay(retardo));
      }
      if (yaInvitados.has(proveedorId)) {
        continue;
      }
      nuevas.push({
        id: `INV-${estudio.id}-${estudio.invitaciones.length + nuevas.length + 1}`,
        estudioId: estudio.id,
        proveedorId,
        estado: "invitado",
        fechaEnvio: ahora,
        fechaRespuesta: null,
        usuario: USUARIO_ESTUDIO_MOCK.usuario,
        correo: identidadProveedor(proveedor).correo,
        radicado: `UD-CONTR-INV-2026-${String(2000 + this.consecutivo + nuevas.length).padStart(4, "0")}-SEC`,
      });
    }

    if (nuevas.length === 0) {
      return throwError(
        () =>
          new Error(
            "Los proveedores seleccionados ya fueron invitados a este estudio.",
          ),
      ).pipe(delay(retardo));
    }

    const adjuntos = datos.adjuntos.map((archivo, posicion) =>
      adjuntoDeArchivo(archivo, posicion, ahora),
    );
    const radicado = `UD-CONTR-INV-2026-${String(2000 + this.consecutivo).padStart(4, "0")}-SEC`;
    const actualizado: EstudioMercado = {
      ...estudio,
      estado: "en-recepcion",
      fechaLimite: datos.fechaLimite,
      asunto: datos.asunto,
      mensaje,
      notificar: datos.notificar,
      adjuntos: [...estudio.adjuntos, ...adjuntos],
      invitaciones: [...estudio.invitaciones, ...nuevas],
      actualizadoEl: ahora,
      radicado,
      eventos: [
        ...estudio.eventos,
        eventoDeEstudio(
          estudio.id,
          estudio.eventos.length + 1,
          estudio.invitaciones.length > 0
            ? "invitacion-adicional"
            : "invitaciones",
          `Se enviaron ${nuevas.length} ${
            nuevas.length === 1 ? "invitación" : "invitaciones"
          } formal${nuevas.length === 1 ? "" : "es"} a proveedores habilitados.`,
          radicado,
        ),
      ],
    };

    this.estudios[indice] = actualizado;
    return of(clonarEstudio(actualizado)).pipe(delay(retardo));
  }

  descartar(id: string): Observable<void> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 600;
    const indice = this.estudios.findIndex((estudio) => estudio.id === id);
    const estudio = this.estudios[indice];

    if (!estudio) {
      return throwError(
        () => new Error("El estudio ya no existe en el expediente."),
      ).pipe(delay(retardo));
    }
    if (estudio.estado !== "borrador") {
      return throwError(
        () =>
          new Error(
            "Solo se pueden descartar estudios en estado borrador.",
          ),
      ).pipe(delay(retardo));
    }

    const ahora = new Date().toISOString();
    this.estudios[indice] = {
      ...estudio,
      estado: "descartado",
      actualizadoEl: ahora,
      eventos: [
        ...estudio.eventos,
        eventoDeEstudio(
          estudio.id,
          estudio.eventos.length + 1,
          "descartado",
          "Borrador del estudio descartado por el usuario.",
        ),
      ],
    };
    return of(void 0).pipe(delay(retardo));
  }

  generarReporteProveedores(
    criterios: CriteriosProveedoresEstudio,
  ): Observable<ReporteProveedoresEstudio> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 500;

    if (params.get("mockReporte") === "error") {
      return throwError(
        () =>
          new Error(
            "No fue posible generar el reporte de proveedores aptos.",
          ),
      ).pipe(delay(retardo));
    }

    const estudio = criterios.estudioId
      ? this.estudios.find(
          (candidato) => candidato.id === criterios.estudioId,
        ) ?? null
      : null;
    const filas = buscarProveedoresEstudio(
      { ...criterios, pagina: 0, porPagina: Number.MAX_SAFE_INTEGER },
      estudio,
    );

    const encabezado = [
      "Razón social",
      "NIT",
      "Tipo de persona",
      "Ubicación",
      "CIIU coincidentes",
      "Estado de inscripción",
      "RUP",
      "Correo",
    ];
    const lineas = filas.map((fila) =>
      [
        fila.proveedor.nombre,
        fila.proveedor.nit,
        fila.identidad.etiquetaTipoPersona,
        fila.identidad.ubicacion,
        fila.coincidencias.join(" | "),
        ETIQUETAS_ESTADO_INSCRIPCION[fila.estadoInscripcion],
        fila.rup,
        fila.correoEnmascarado,
      ]
        .map(valorCsv)
        .join(","),
    );

    return of({
      nombreArchivo: `proveedores-estudio-${new Date().toISOString().slice(0, 10)}.csv`,
      contenido: [encabezado.map(valorCsv).join(","), ...lineas].join("\n"),
      total: filas.length,
      generadoEl: new Date().toISOString(),
    }).pipe(delay(retardo));
  }
}

/* ── Apoyo ──────────────────────────────────────────────────────────────── */

function clonarEstudio(estudio: EstudioMercado): EstudioMercado {
  return {
    ...estudio,
    variablesTributarias: [...estudio.variablesTributarias],
    ofertasVinculadas: estudio.ofertasVinculadas.map((oferta) => ({
      ...oferta,
    })),
    actividades: [...estudio.actividades],
    adjuntos: [...estudio.adjuntos],
    invitaciones: [...estudio.invitaciones],
    eventos: [...estudio.eventos],
  };
}

function coincideEstudio(
  estudio: EstudioMercado,
  criterios: Partial<FiltroEstudiosMercado>,
): boolean {
  if (
    criterios.vigencia &&
    criterios.vigencia !== "historico" &&
    String(estudio.vigencia) !== criterios.vigencia
  ) {
    return false;
  }
  if (criterios.estado && estudio.estado !== criterios.estado) {
    return false;
  }
  if (
    criterios.dependencia &&
    estudio.dependencia !== criterios.dependencia
  ) {
    return false;
  }
  if (
    criterios.grupo &&
    criterios.grupo !== "todos" &&
    estudio.estado !== criterios.grupo
  ) {
    return false;
  }
  const texto = criterios.busqueda?.trim().toLowerCase();
  if (
    texto &&
    ![
      estudio.id,
      estudio.objeto,
      estudio.responsable,
      estudio.solicitudId,
      estudio.solicitudTitulo,
    ].some((valor) => valor.toLowerCase().includes(texto))
  ) {
    return false;
  }
  return true;
}

function contarEstudios(
  estudios: readonly EstudioMercado[],
): ResultadoListadoEstudios["conteos"] {
  const conteos = conteosVacios();
  for (const estudio of estudios) {
    if (estudio.estado === "borrador") {
      conteos.borrador += 1;
    } else if (estudio.estado === "en-recepcion") {
      conteos["en-recepcion"] += 1;
    } else if (estudio.estado === "cerrado") {
      conteos.cerrado += 1;
    } else if (estudio.estado === "aprobado") {
      conteos.aprobado += 1;
    }
  }
  return conteos;
}

function conteosVacios(): {
  todos: number;
  borrador: number;
  "en-recepcion": number;
  cerrado: number;
  aprobado: number;
} {
  return {
    todos: 0,
    borrador: 0,
    "en-recepcion": 0,
    cerrado: 0,
    aprobado: 0,
  };
}

function eventoDeEstudio(
  estudioId: string,
  indice: number,
  tipo: EventoEstudioMercado["tipo"],
  detalle: string,
  radicado?: string,
): EventoEstudioMercado {
  return {
    id: `evt-${estudioId}-${indice}`,
    tipo,
    fecha: new Date().toISOString(),
    usuario: USUARIO_ESTUDIO_MOCK.usuario,
    nombreUsuario: USUARIO_ESTUDIO_MOCK.nombre,
    detalle,
    radicado,
  };
}

function adjuntoDeArchivo(
  archivo: File,
  indice: number,
  fecha: string,
): AdjuntoEstudio {
  return {
    id: `adj-${fecha}-${indice}`,
    nombre: archivo.name,
    tamano: archivo.size,
    tipo: archivo.type || archivo.name.split(".").pop() || "archivo",
    cargadoEl: fecha,
  };
}

function valorCsv(valor: string): string {
  return `"${valor.replace(/"/g, '""')}"`;
}

/** Grupos disponibles en los filtros rápidos del listado. */
export const GRUPOS_ESTUDIO: readonly {
  valor: GrupoEstudio;
  etiqueta: string;
}[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "borrador", etiqueta: "Borradores" },
  { valor: "en-recepcion", etiqueta: "En recepción" },
  { valor: "cerrado", etiqueta: "Cerrados" },
  { valor: "aprobado", etiqueta: "Aprobados" },
];
