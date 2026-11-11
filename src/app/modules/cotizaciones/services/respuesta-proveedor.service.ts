import { Injectable } from "@angular/core";
import { Observable, delay, of, tap, throwError } from "rxjs";
import type {
  BaseActualizacionRespuesta,
  BaseRespuestaProveedor,
  DocumentoRespuestaProveedor,
  DocumentoRespuestaResuelto,
  ItemRespuestaProveedor,
  ResultadoActualizacionRespuesta,
  RespuestaProveedor,
  VersionRespuestaProveedor,
} from "../models/respuesta-proveedor.model";
import { calcularTotalesRespuesta } from "../models/respuesta-proveedor.model";
import type {
  DetalleInvitacionProveedor,
  ResumenRespuestaVigente,
} from "../models/invitacion-proveedor.model";
import { siguienteVersionModificacion } from "../models/edicion-solicitud.model";
import type { ItemSolicitud } from "../models/items.model";
import { SolicitudesService } from "./solicitudes.service";

export abstract class RespuestaProveedorService {
  abstract obtenerBase(
    detalle: DetalleInvitacionProveedor,
    proveedorId: string,
  ): Observable<BaseRespuestaProveedor>;
  abstract obtenerActualizacion(
    detalle: DetalleInvitacionProveedor,
    proveedorId: string,
  ): Observable<BaseActualizacionRespuesta>;
  abstract guardarBorrador(
    respuesta: RespuestaProveedor,
  ): Observable<void>;
  abstract guardarBorradorActualizacion(
    respuesta: RespuestaProveedor,
  ): Observable<void>;
  abstract eliminarBorrador(
    solicitudId: string,
    proveedorId: string,
  ): Observable<void>;
  abstract eliminarBorradorActualizacion(
    solicitudId: string,
    proveedorId: string,
    versionSolicitud: string,
  ): Observable<void>;
  abstract enviar(respuesta: RespuestaProveedor): Observable<RespuestaProveedor>;
  abstract actualizar(
    respuesta: RespuestaProveedor,
  ): Observable<ResultadoActualizacionRespuesta>;

  /**
   * Respuesta radicada del proveedor para la consulta de P-06.
   *
   * Devuelve `null` mientras no exista una respuesta enviada (un borrador no
   * se considera radicado). Reutiliza la misma semilla y el mismo mapa que
   * P-04/P-05, por lo que la vista no mantiene un modelo paralelo.
   */
  abstract obtenerMiCotizacion(
    detalle: DetalleInvitacionProveedor,
    proveedorId: string,
  ): Observable<RespuestaProveedor | null>;

  /** Documento radicado de la propia respuesta, para verlo o descargarlo. */
  abstract obtenerDocumentoRespuesta(
    radicadoId: string,
    accion: "ver" | "descargar",
  ): Observable<DocumentoRespuestaResuelto>;
}

@Injectable()
export class RespuestaProveedorServiceMock extends RespuestaProveedorService {
  /** Respuesta vigente de cada solicitud/proveedor. */
  private readonly respuestas = new Map<string, RespuestaProveedor>();

  /** Borradores de P-04 (un borrador por solicitud/proveedor). */
  private readonly borradores = new Map<string, RespuestaProveedor>();

  /** Borradores de P-05, separados por versión de solicitud. */
  private readonly borradoresActualizacion = new Map<string, RespuestaProveedor>();

  constructor(private readonly solicitudes: SolicitudesService) {
    super();
  }

  obtenerBase(
    detalle: DetalleInvitacionProveedor,
    proveedorId: string,
  ): Observable<BaseRespuestaProveedor> {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mockRespuestaCarga") === "error") {
      return throwError(
        () => new Error("No fue posible cargar los datos de la respuesta."),
      ).pipe(delay(this.retardo()));
    }
    const respuesta =
      this.borradores.get(this.clave(detalle.solicitud.id, proveedorId)) ??
      this.respuestas.get(this.clave(detalle.solicitud.id, proveedorId)) ??
      null;
    return of({
      items: detalle.solicitud.items,
      documentos: detalle.solicitud.documentos?.requeridos ?? [],
      respuesta,
    }).pipe(delay(this.retardo()));
  }

  obtenerActualizacion(
    detalle: DetalleInvitacionProveedor,
    proveedorId: string,
  ): Observable<BaseActualizacionRespuesta> {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mockActualizacion") === "error-carga") {
      return throwError(
        () =>
          new Error(
            "No fue posible cargar la respuesta vigente para actualizarla.",
          ),
      ).pipe(delay(this.retardo()));
    }

    const respuestaVigente = this.respuestaVigente(detalle, proveedorId);
    if (!respuestaVigente || !detalle.adenda) {
      return throwError(
        () =>
          new Error(
            "No existe una respuesta radicada o una modificación de la solicitud para actualizar.",
          ),
      ).pipe(delay(this.retardo()));
    }

    const borrador =
      this.borradoresActualizacion.get(
        this.claveBorradorActualizacion(
          detalle.solicitud.id,
          proveedorId,
          detalle.solicitud.version,
        ),
      ) ?? null;

    return of({
      items: detalle.solicitud.items,
      itemsAnteriores: detalle.adenda.itemsAnteriores,
      documentos: detalle.solicitud.documentos?.requeridos ?? [],
      respuestaVigente,
      adenda: detalle.adenda,
      proveedor: detalle.proveedor,
      borrador,
    }).pipe(delay(this.retardo()));
  }

  obtenerMiCotizacion(
    detalle: DetalleInvitacionProveedor,
    proveedorId: string,
  ): Observable<RespuestaProveedor | null> {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mockMiCotizacion") === "error") {
      return throwError(
        () =>
          new Error(
            "No fue posible consultar su cotización radicada. Intente nuevamente.",
          ),
      ).pipe(delay(this.retardo()));
    }

    const respuesta = this.respuestaVigente(detalle, proveedorId);
    return of(
      respuesta && respuesta.estado === "enviada" ? respuesta : null,
    ).pipe(delay(this.retardo()));
  }

  obtenerDocumentoRespuesta(
    radicadoId: string,
    accion: "ver" | "descargar",
  ): Observable<DocumentoRespuestaResuelto> {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mockDocumento") === "error") {
      return throwError(
        () =>
          new Error(
            "No fue posible consultar el archivo en el repositorio institucional (Alfresco UD).",
          ),
      ).pipe(delay(this.retardo()));
    }

    const documento = this.buscarDocumentoRadicado(radicadoId);
    if (!documento) {
      return throwError(
        () =>
          new Error(
            "El documento solicitado no existe en la respuesta radicada.",
          ),
      ).pipe(delay(this.retardo()));
    }

    return of({
      disponible: true,
      mensaje: `${
        accion === "ver" ? "Vista previa" : "Descarga"
      } simulada de «${documento.nombre}». El repositorio institucional (Alfresco UD) aún no está conectado: el archivo real se servirá desde este mismo punto.`,
    }).pipe(delay(this.retardo()));
  }

  guardarBorrador(respuesta: RespuestaProveedor): Observable<void> {
    if (this.forzarError()) {
      return throwError(() => new Error("No fue posible guardar el borrador."));
    }
    this.borradores.set(this.clave(respuesta.solicitudId, respuesta.proveedorId), {
      ...respuesta,
      estado: "borrador",
      archivos: [],
    });
    return of(void 0).pipe(delay(this.retardo()));
  }

  guardarBorradorActualizacion(
    respuesta: RespuestaProveedor,
  ): Observable<void> {
    if (this.forzarError()) {
      return throwError(
        () => new Error("No fue posible guardar el borrador de la actualización."),
      );
    }
    this.borradoresActualizacion.set(
      this.claveBorradorActualizacion(
        respuesta.solicitudId,
        respuesta.proveedorId,
        respuesta.versionSolicitudRespondida,
      ),
      { ...respuesta, estado: "borrador", archivos: [] },
    );
    return of(void 0).pipe(delay(this.retardo()));
  }

  eliminarBorrador(
    solicitudId: string,
    proveedorId: string,
  ): Observable<void> {
    this.borradores.delete(this.clave(solicitudId, proveedorId));
    return of(void 0).pipe(delay(this.retardo()));
  }

  eliminarBorradorActualizacion(
    solicitudId: string,
    proveedorId: string,
    versionSolicitud: string,
  ): Observable<void> {
    this.borradoresActualizacion.delete(
      this.claveBorradorActualizacion(solicitudId, proveedorId, versionSolicitud),
    );
    return of(void 0).pipe(delay(this.retardo()));
  }

  enviar(respuesta: RespuestaProveedor): Observable<RespuestaProveedor> {
    if (this.forzarError()) {
      return throwError(() => new Error("No fue posible enviar la respuesta."));
    }
    const fecha = new Date().toISOString();
    const total = respuesta.total;
    const enviada: RespuestaProveedor = {
      ...respuesta,
      estado: "enviada",
      fechaRadicacion: fecha,
      radicado: `COT-${Date.now()}`,
      version: respuesta.version || "v1.0",
      revision: respuesta.revision || 1,
      versionesAnteriores: respuesta.versionesAnteriores ?? [],
      archivos: this.normalizarArchivos(respuesta.archivos),
      hash: this.hashSimple(
        `${respuesta.solicitudId}|${respuesta.version || "v1.0"}|${total}|${fecha}`,
      ),
    };
    return of(enviada).pipe(
      delay(this.retardo()),
      tap((registrada) => {
        this.borradores.delete(
          this.clave(registrada.solicitudId, registrada.proveedorId),
        );
        this.respuestas.set(
          this.clave(registrada.solicitudId, registrada.proveedorId),
          registrada,
        );
        this.solicitudes.registrarRespuestaProveedor(
          registrada.solicitudId,
          registrada.fechaRadicacion ?? new Date().toISOString(),
          this.resumenVigente(registrada),
        );
      }),
    );
  }

  actualizar(
    respuesta: RespuestaProveedor,
  ): Observable<ResultadoActualizacionRespuesta> {
    if (this.forzarError()) {
      return throwError(
        () => new Error("No fue posible actualizar la respuesta. Intente nuevamente."),
      );
    }

    const clave = this.clave(respuesta.solicitudId, respuesta.proveedorId);
    const anterior = this.respuestas.get(clave);
    if (!anterior) {
      return throwError(
        () => new Error("No existe una respuesta radicada para actualizar."),
      );
    }
    if (anterior.actualizadaParaVersion === respuesta.versionSolicitudRespondida) {
      return throwError(
        () =>
          new Error(
            "Solo se permite una actualización por cada modificación de la solicitud (RN-42).",
          ),
      );
    }

    const fecha = new Date().toISOString();
    const revision = anterior.revision + 1;
    const version = siguienteVersionModificacion(anterior.version);
    const radicado = `COT-RESP-${respuesta.solicitudId}-V${revision}`;
    const resumenAnterior: VersionRespuestaProveedor = {
      version: anterior.version,
      revision: anterior.revision,
      fecha: anterior.fechaRadicacion ?? anterior.fechaActualizacion ?? fecha,
      radicado: anterior.radicado,
      versionSolicitud: anterior.versionSolicitudRespondida,
      total: anterior.total,
      usuario: anterior.usuarioActualizacion ?? anterior.proveedorId,
    };

    const actualizada: RespuestaProveedor = {
      ...respuesta,
      estado: "enviada",
      version,
      revision,
      actualizadaParaVersion: respuesta.versionSolicitudRespondida,
      fechaActualizacion: fecha,
      usuarioActualizacion: respuesta.proveedorId,
      reemplazaRadicado: anterior.radicado,
      radicado,
      archivos: this.normalizarArchivos(respuesta.archivos),
      hash: this.hashSimple(
        `${respuesta.solicitudId}|${version}|${respuesta.total}|${fecha}`,
      ),
      versionesAnteriores: [...anterior.versionesAnteriores, resumenAnterior],
    };

    this.respuestas.set(clave, actualizada);
    this.borradoresActualizacion.delete(
      this.claveBorradorActualizacion(
        respuesta.solicitudId,
        respuesta.proveedorId,
        respuesta.versionSolicitudRespondida,
      ),
    );
    this.solicitudes.registrarActualizacionProveedor(
      respuesta.solicitudId,
      this.resumenVigente(actualizada),
    );

    const itemsSuprimidos = anterior.items.filter(
      (item) => !respuesta.items.some((actual) => actual.itemId === item.itemId),
    ).length;

    return of<ResultadoActualizacionRespuesta>({
      respuesta: actualizada,
      totalAnterior: anterior.total,
      itemsActivos: respuesta.items.filter((item) => !item.eliminado).length,
      itemsSuprimidos,
      hash: this.hashSimple(
        `${actualizada.solicitudId}|${actualizada.version}|${actualizada.total}|${fecha}`,
      ),
    }).pipe(delay(this.retardo()));
  }

  private respuestaVigente(
    detalle: DetalleInvitacionProveedor,
    proveedorId: string,
  ): RespuestaProveedor | null {
    const clave = this.clave(detalle.solicitud.id, proveedorId);
    const existente = this.respuestas.get(clave);
    if (existente?.estado === "enviada") {
      return existente;
    }
    if (!detalle.yaRespondio || !detalle.invitacion.respuestaVigente) {
      return null;
    }
    const sembrada = this.crearRespuestaSeed(detalle, proveedorId);
    this.respuestas.set(clave, sembrada);
    return sembrada;
  }

  /**
   * Respuesta radicada de demostración.
   *
   * Los ítems anteriores salen de la fotografía de la adenda para que el
   * proveedor vea exactamente el mismo cambio que el solicitante. Los precios
   * son deterministas y no pretenden representar un backend real.
   */
  private crearRespuestaSeed(
    detalle: DetalleInvitacionProveedor,
    proveedorId: string,
  ): RespuestaProveedor {
    const resumen = detalle.invitacion.respuestaVigente!;
    const esVigente =
      resumen.versionSolicitud === detalle.solicitud.version;
    const itemsFuente: readonly ItemSolicitud[] =
      !esVigente && detalle.adenda
        ? detalle.adenda.itemsAnteriores
        : detalle.solicitud.items;

    const items = itemsFuente.map((item, indice) =>
      this.ofertaSeed(item, indice),
    );
    const archivos = [
      {
        requisitoId: "soporte-cotizacion",
        radicadoId: `radicado-${detalle.invitacion.id}-soporte`,
        nombre: "Cotizacion_Oficial_v1.0.pdf",
        tamanoBytes: 2.4 * 1024 * 1024,
      },
      ...(detalle.solicitud.documentos?.requeridos ?? []).map((documento) => ({
        requisitoId: documento.id,
        radicadoId: `radicado-${detalle.invitacion.id}-${documento.id}`,
        nombre: `${documento.nombre.replace(/\s+/g, "_")}_v1.0.pdf`,
        tamanoBytes: 640 * 1024,
      })),
    ];
    const versionesAnteriores = (detalle.invitacion.versionesRespuesta ?? [])
      .filter((version) => version.version !== resumen.version)
      .map<VersionRespuestaProveedor>((version) => ({
        version: version.version,
        revision: version.revision,
        fecha: version.fecha,
        radicado: version.radicado,
        versionSolicitud: version.versionSolicitud,
        total: version.total ?? 0,
        usuario: version.usuario,
      }));

    const total = calcularTotalesRespuesta(itemsFuente, items, 0).total;

    return {
      id: `RESP-${detalle.invitacion.id}`,
      solicitudId: detalle.solicitud.id,
      invitacionId: detalle.invitacion.id,
      proveedorId,
      estado: "enviada",
      items,
      fechaVencimiento: this.sumarDias(detalle.solicitud.cierre, 30),
      descuentoPorcentaje: 0,
      condicionesComerciales: "",
      modalidad: "individual",
      archivos,
      notaAdicional: "",
      total,
      version: resumen.version,
      revision: resumen.revision,
      versionSolicitudRespondida: resumen.versionSolicitud,
      actualizadaParaVersion: resumen.actualizadaParaVersion,
      fechaRadicacion: resumen.fecha,
      fechaActualizacion: resumen.actualizadaParaVersion ? resumen.fecha : undefined,
      usuarioActualizacion: resumen.usuario,
      radicado: resumen.radicado,
      hash: this.hashSimple(
        `${detalle.solicitud.id}|${resumen.version}|${total}|${resumen.fecha}`,
      ),
      versionesAnteriores,
    };
  }

  private ofertaSeed(
    item: ItemSolicitud,
    indice: number,
  ): ItemRespuestaProveedor {
    const precios: Readonly<Record<string, number>> = {
      "1": 28_500_000,
      "2": 22_000_000,
      "3": 12_800_000,
      "4": 320_000,
      "5": 3_500_000,
    };
    return {
      itemId: item.id,
      valorUnitario: precios[item.id] ?? 1_000_000 + indice * 250_000,
      iva: "19",
      nota: "Oferta radicada en la versión anterior.",
    };
  }

  private resumenVigente(
    respuesta: RespuestaProveedor,
  ): ResumenRespuestaVigente {
    return {
      version: respuesta.version,
      revision: respuesta.revision,
      radicado: respuesta.radicado,
      fecha:
        respuesta.fechaActualizacion ??
        respuesta.fechaRadicacion ??
        new Date().toISOString(),
      versionSolicitud: respuesta.versionSolicitudRespondida,
      usuario: respuesta.usuarioActualizacion ?? respuesta.proveedorId,
      total: respuesta.total,
      actualizadaParaVersion: respuesta.actualizadaParaVersion,
    };
  }

  /**
   * Conserva los metadatos de los documentos al radicar.
   *
   * El `File` no se guarda en memoria (no es serializable y el mock no sube
   * binarios), pero la constancia de P-06 necesita el nombre, el tamaño y el
   * radicado de cada soporte. Sin esta normalización, una respuesta recién
   * enviada aparecería sin documentos.
   */
  private normalizarArchivos(
    archivos: readonly DocumentoRespuestaProveedor[],
  ): readonly DocumentoRespuestaProveedor[] {
    return archivos.map((documento, indice) => ({
      requisitoId: documento.requisitoId,
      radicadoId:
        documento.radicadoId ?? `radicado-${Date.now()}-${indice + 1}`,
      nombre: documento.nombre ?? documento.archivo?.name ?? "documento.pdf",
      tamanoBytes: documento.tamanoBytes ?? documento.archivo?.size ?? 0,
    }));
  }

  /** Busca un documento radicado en las respuestas registradas. */
  private buscarDocumentoRadicado(
    radicadoId: string,
  ): DocumentoRespuestaProveedor | undefined {
    for (const respuesta of this.respuestas.values()) {
      const documento = respuesta.archivos.find(
        (archivo) => archivo.radicadoId === radicadoId,
      );
      if (documento) {
        return documento;
      }
    }
    return undefined;
  }

  private clave(solicitudId: string, proveedorId: string): string {
    return `${solicitudId}:${proveedorId}`;
  }

  private claveBorradorActualizacion(
    solicitudId: string,
    proveedorId: string,
    versionSolicitud: string,
  ): string {
    return `${this.clave(solicitudId, proveedorId)}:${versionSolicitud}`;
  }

  private sumarDias(fechaCorta: string | null, dias: number): string {
    if (!fechaCorta) {
      return "";
    }
    const [dia, mes, anio] = fechaCorta.split("/").map(Number);
    if (!dia || !mes || !anio) {
      return "";
    }
    const fecha = new Date(Date.UTC(anio, mes - 1, dia + dias));
    return fecha.toISOString().slice(0, 10);
  }

  private hashSimple(semilla: string): string {
    let hash = 0;
    for (let indice = 0; indice < semilla.length; indice += 1) {
      hash = (hash * 31 + semilla.charCodeAt(indice)) >>> 0;
    }
    const hex = hash.toString(16).toUpperCase().padStart(8, "0");
    return `SHA-256: ${hex.slice(0, 4)}...${hex.slice(4)}`;
  }

  private retardo(): number {
    return Number(new URLSearchParams(window.location.search).get("mockRetardo")) || 700;
  }

  private forzarError(): boolean {
    const params = new URLSearchParams(window.location.search);
    return (
      params.get("mockRespuesta") === "error" ||
      params.get("mockActualizacion") === "error-guardado"
    );
  }
}
