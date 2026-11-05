/**
 * Modelo del tablero de oferentes (S-07).
 *
 * Compone datos que ya existen en otros agregados —la invitación, el proveedor
 * del banco y las observaciones— con un resumen de la respuesta de P-04. No
 * duplica `InvitacionProveedor`, `Solicitud` ni `RespuestaProveedor`: solo
 * guarda lo que el tablero necesita mostrar.
 *
 * El estado de presentación (`EstadoOferente`) se deriva de la respuesta, las
 * observaciones y el cierre del proceso; no se persiste.
 */

import type { EstadoOferente } from "src/app/core/constants/estados-solicitud.const";
import {
  crearOfertaSimulada,
  semillaOfertaComparada,
} from "./comparativo.model";
import type { InvitacionProveedor } from "./invitacion-proveedor.model";
import {
  IdentidadProveedor,
  ProveedorObjetivo,
  buscarProveedores,
  etiquetaNucleoSnies,
  identidadProveedor,
} from "./proveedores.model";
import type { SolicitudDetalle } from "./solicitud.model";
import { cierreSolicitudVencido } from "./solicitud.model";

/* ── Estados y grupos ─────────────────────────────────────────────────────── */

/** Grupo de participación que usa el filtro (reemplaza las pestañas del mockup). */
export type GrupoParticipacionOferente =
  | "todas"
  | "con-cotizacion"
  | "postulados"
  | "notificados"
  | "sin-oferta"
  | "no-participaron";

export const GRUPOS_PARTICIPACION: readonly {
  readonly valor: GrupoParticipacionOferente;
  readonly etiqueta: string;
}[] = [
  { valor: "todas", etiqueta: "Todas las participaciones" },
  { valor: "con-cotizacion", etiqueta: "Con cotización" },
  { valor: "postulados", etiqueta: "Postulados / observaciones" },
  { valor: "notificados", etiqueta: "Notificados" },
  { valor: "sin-oferta", etiqueta: "Sin oferta" },
  { valor: "no-participaron", etiqueta: "No participaron" },
];

/** true si el oferente pertenece al grupo de participación elegido. */
export function coincideParticipacion(
  oferente: OferenteTablero,
  grupo: GrupoParticipacionOferente | "",
): boolean {
  switch (grupo) {
    case "":
    case "todas":
      return true;
    case "con-cotizacion":
      return oferente.estado === "cotizo" || oferente.estado === "modifico";
    case "postulados":
      return oferente.estado === "observo" || oferente.observaciones > 0;
    case "notificados":
      return oferente.estado === "notificado";
    case "sin-oferta":
      return !oferente.respuesta;
    case "no-participaron":
      return oferente.estado === "sin-respuesta";
  }
}

/* ── Contratos ────────────────────────────────────────────────────────────── */

/** Resumen de la respuesta del proveedor (no es la respuesta completa de P-04). */
export interface ResumenRespuestaOferente {
  readonly radicado: string;
  /** Fecha visible (`dd/MM/yyyy HH:mm COT`). */
  readonly fechaEnvio: string;
  readonly fechaEnvioIso: string;
  /** Valor total ofertado en pesos. */
  readonly total: number;
  readonly itemsCotizados: number;
  readonly documentos: number;
  /** Versión del documento de oferta ("v1.0" o la de la adenda). */
  readonly version: string;
  readonly modificadaEl?: string;
  readonly modificadaElIso?: string;
}

/** Fila del tablero de oferentes. */
export interface OferenteTablero {
  readonly id: string;
  readonly invitacion: InvitacionProveedor;
  readonly proveedor: ProveedorObjetivo;
  readonly respuesta: ResumenRespuestaOferente | null;
  readonly observaciones: number;
  readonly estado: EstadoOferente;
  /** Grupo de RF-12: primario (con oferta) o secundario (sin oferta). */
  readonly grupo: "con-oferta" | "sin-oferta";
  readonly ultimaAccion: string;
  readonly ultimaAccionIso: string;
  /** RN-33: resaltado de solo lectura del proveedor seleccionado por el JD. */
  readonly seleccionado: boolean;
}

export interface FiltroOferentes {
  busqueda: string;
  participacion: GrupoParticipacionOferente;
  estado: string;
  tipoPersona: string;
  ubicacion: string;
}

/** Datos que la preselección de S-09 deja en la bitácora del expediente. */
export interface SeleccionOferenteEvento {
  /** Proveedor elegido; `null` cuando se retira la preselección. */
  readonly proveedorId: string | null;
  readonly proveedorNombre: string;
  /** Total de la oferta seleccionada; 0 al retirar. */
  readonly valor: number;
  /** Rol con el que se ejecutó la acción ("Jefe de dependencia", "Ordenador…"). */
  readonly rol: string;
}

export interface ConteosOferentes {
  /** Proveedores del banco que cumplen la segmentación (RN-19). */
  readonly cumplen: number;
  /** Invitaciones enviadas (filas del tablero). */
  readonly notificados: number;
  /** Proveedores que manifestaron interés o formularon observaciones. */
  readonly postulados: number;
  /** Ofertas radicadas (RF-17). */
  readonly cotizaciones: number;
  /** Invitados que no presentaron oferta (RF-12). */
  readonly sinOferta: number;
}

export interface ResultadoTableroOferentes {
  readonly oferentes: readonly OferenteTablero[];
  readonly total: number;
  readonly conteos: ConteosOferentes;
  readonly ubicaciones: readonly string[];
}

/** Fila básica del reporte de proveedores elegibles (RN-19). */
export interface ProveedorElegibleReporte {
  readonly documento: string;
  readonly nombre: string;
  readonly tipoPersona: string;
  readonly correo: string;
  readonly ubicacion: string;
  readonly actividades: string;
  readonly nucleo: string;
}

/* ── Semilla simulada ─────────────────────────────────────────────────────── */

interface ConfigOferentesSolicitud {
  /** No se enviaron invitaciones para esta solicitud. */
  readonly sinInvitaciones?: boolean;
  /** Se invitó, pero nadie presentó oferta. */
  readonly sinRespuestas?: boolean;
  /** Cuántos de los invitados respondieron (por defecto 4). */
  readonly responderian?: number;
  /** Proveedores que radicaron una adenda después de responder. */
  readonly modificados?: readonly string[];
  /** Proveedor destacado por el jefe de dependencia (RN-33). */
  readonly seleccionado?: string;
  /** Observaciones por proveedor (para el foro y el contador de postulados). */
  readonly observaciones?: Readonly<Record<string, number>>;
}

/**
 * Escenarios de demostración de S-07.
 *
 * - `SOL-2026-0039`: cerrada, varias ofertas, un seleccionado y una adenda.
 * - `SOL-2026-0044`: cerrada, invitados sin oferta.
 * - `SOL-2026-0041`: sin invitaciones (segmentación registrada, sin envío).
 * - `SOL-2026-0151`: en plazo vigente (bloqueo de RN-29).
 */
const CONFIG_OFERENTES: Readonly<
  Record<string, ConfigOferentesSolicitud>
> = {
  "SOL-2026-0039": {
    responderian: 4,
    modificados: ["prov-02"],
    seleccionado: "prov-01",
    observaciones: {
      "prov-01": 1,
      "prov-05": 1,
      "prov-06": 1,
      "prov-07": 1,
    },
  },
  "SOL-2026-0044": {
    sinRespuestas: true,
    observaciones: { "prov-28": 1, "prov-29": 1, "prov-25": 1 },
  },
  "SOL-2026-0042": {
    // Proceso cerrado con una sola oferta: estado de comparador incompleto.
    responderian: 1,
  },
  "SOL-2026-0041": {
    sinInvitaciones: true,
  },
  "SOL-2026-0151": {
    // Proceso vigente: todavía no hay respuestas y el tablero está bloqueado.
    responderian: 0,
  },
};

function dosDigitos(valor: number): string {
  return String(valor).padStart(2, "0");
}

/** Fecha `dd/MM/yyyy` + días → ISO con desfase de Colombia. */
function isoDesdeFechaCorta(
  fecha: string | null,
  dias: number,
  hora: number,
  minuto: number,
): string {
  let anio: number;
  let mes: number;
  let dia: number;

  if (fecha) {
    [dia, mes, anio] = fecha.split("/").map(Number);
  } else {
    const ahora = new Date();
    anio = ahora.getFullYear();
    mes = ahora.getMonth() + 1;
    dia = ahora.getDate();
  }

  const base = new Date(Date.UTC(anio, mes - 1, dia));
  base.setUTCDate(base.getUTCDate() + dias);
  return `${base.getUTCFullYear()}-${dosDigitos(base.getUTCMonth() + 1)}-${dosDigitos(base.getUTCDate())}T${dosDigitos(hora)}:${dosDigitos(minuto)}:00-05:00`;
}

/** Formatea un ISO como `dd/MM/yyyy HH:mm COT` (zona oficial del proceso). */
export function formatoFechaHoraOferente(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) {
    return "—";
  }
  const partes = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(fecha);
  const valor = (tipo: string): string =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${valor("day")}/${valor("month")}/${valor("year")} ${valor("hour")}:${valor("minute")} COT`;
}

/** Proveedores del banco que cumplen la segmentación de la solicitud. */
export function proveedoresElegibles(
  solicitud: Pick<SolicitudDetalle, "proveedores">,
): readonly ProveedorObjetivo[] {
  const detalle = solicitud.proveedores;
  if (!detalle) {
    return [];
  }
  const codigos = detalle.segmentacion.actividades.map(
    (actividad) => actividad.codigo,
  );
  return buscarProveedores(
    codigos,
    detalle.segmentacion.nucleoSnies,
    detalle.requiereIdoneidad,
  );
}

/**
 * Construye las filas del tablero para una solicitud.
 *
 * `cerrada` decide si un invitado sin respuesta se muestra como “Sin
 * respuesta” (plazo vencido) o como “Notificado” (proceso vigente).
 */
export function crearOferentes(
  solicitud: SolicitudDetalle,
  cerrada: boolean,
): readonly OferenteTablero[] {
  const config = CONFIG_OFERENTES[solicitud.id] ?? {};
  if (config.sinInvitaciones) {
    return [];
  }

  const elegibles = proveedoresElegibles(solicitud);
  const respondieron = config.sinRespuestas
    ? 0
    : config.responderian ?? Math.min(4, elegibles.length);
  const requeridos = solicitud.documentos?.requeridos.length ?? 0;

  return elegibles.map((proveedor, indice) => {
    const observaciones = config.observaciones?.[proveedor.id] ?? 0;
    const responde = indice < respondieron;
    const modificado = responde && !!config.modificados?.includes(proveedor.id);

    const fechaEnvioIso = responde
      ? isoDesdeFechaCorta(solicitud.apertura, 2 + indice, 10 + (indice % 6), (indice * 7) % 60)
      : "";
    const modificadaElIso = modificado
      ? isoDesdeFechaCorta(solicitud.apertura, 3 + indice, 15, 42)
      : "";
    const observacionIso =
      observaciones > 0
        ? isoDesdeFechaCorta(
            solicitud.apertura,
            1 + (indice % 3),
            9,
            12,
          )
        : "";

    const respuesta: ResumenRespuestaOferente | null = responde
      ? (() => {
          const version = modificado ? "v1.1" : "v1.0";
          // El total sale de la misma oferta itemizada que usa S-09. Así el
          // tablero y el comparador nunca muestran cifras distintas.
          const oferta = crearOfertaSimulada(
            solicitud,
            semillaOfertaComparada(
              solicitud.id,
              proveedor,
              indice,
              version,
            ),
          );
          return {
            radicado: `COT-${solicitud.id.slice(-4)}-${dosDigitos(indice + 1)}`,
            fechaEnvio: formatoFechaHoraOferente(fechaEnvioIso),
            fechaEnvioIso,
            total: oferta.totales.total,
            itemsCotizados: oferta.items.length,
            documentos: requeridos,
            version,
            modificadaEl: modificado
              ? formatoFechaHoraOferente(modificadaElIso)
              : undefined,
            modificadaElIso: modificado ? modificadaElIso : undefined,
          };
        })()
      : null;

    const estado: EstadoOferente = respuesta
      ? modificado
        ? "modifico"
        : "cotizo"
      : observaciones > 0
        ? "observo"
        : cerrada
          ? "sin-respuesta"
          : "notificado";

    const ultimaAccionIso =
      modificadaElIso ||
      fechaEnvioIso ||
      observacionIso ||
      isoDesdeFechaCorta(solicitud.apertura, 0, 8, 0);

    const invitacion: InvitacionProveedor = {
      id: `INV-${solicitud.id.slice(-4)}-${proveedor.id.replace("prov-", "")}`,
      solicitudId: solicitud.id,
      estado: respuesta ? "enviada" : cerrada ? "vencida" : "borrador",
      fechaRadicacion: respuesta?.fechaEnvioIso,
      adendaPublicada: modificado
        ? {
            versionAnterior: "v1.0",
            versionVigente: "v1.1",
            publicadaEl: formatoFechaHoraOferente(modificadaElIso),
            anexoId: `anexo-${solicitud.id.slice(-4)}-adenda`,
          }
        : undefined,
    };

    return {
      id: invitacion.id,
      invitacion,
      proveedor,
      respuesta,
      observaciones,
      estado,
      grupo: respuesta ? "con-oferta" : "sin-oferta",
      ultimaAccion: formatoFechaHoraOferente(ultimaAccionIso),
      ultimaAccionIso,
      seleccionado: config.seleccionado === proveedor.id,
    };
  });
}

/** Contadores del tablero (RF-17, RF-12 y RN-19). */
export function conteosOferentes(
  solicitud: SolicitudDetalle,
  oferentes: readonly OferenteTablero[],
): ConteosOferentes {
  const cumplen = proveedoresElegibles(solicitud).length;
  const cotizaciones = oferentes.filter((oferente) => !!oferente.respuesta).length;
  return {
    cumplen,
    notificados: oferentes.length,
    postulados: oferentes.filter((oferente) => oferente.observaciones > 0).length,
    cotizaciones,
    sinOferta: Math.max(0, oferentes.length - cotizaciones),
  };
}

/**
 * Número exacto de ofertas recibidas a partir del tamaño del padrón elegible
 * y de la configuración de la solicitud (RF-17).
 *
 * Es la fuente única que comparten el tablero (S-07), el detalle (S-03) y la
 * pestaña “Proveedores objetivo”, para que las cifras no se contradigan.
 */
export function contarOfertasRecibidasDesde(
  solicitudId: string,
  elegibles: number,
): number {
  const config = CONFIG_OFERENTES[solicitudId] ?? {};
  if (config.sinInvitaciones || config.sinRespuestas) {
    return 0;
  }
  return Math.min(config.responderian ?? 4, elegibles);
}

/** Reporte básico de proveedores elegibles (RN-19). */
export function reporteProveedoresElegibles(
  solicitud: SolicitudDetalle,
): readonly ProveedorElegibleReporte[] {
  const detalle = solicitud.proveedores;
  const nucleo = detalle?.segmentacion.nucleoSnies
    ? etiquetaNucleoSnies(detalle.segmentacion.nucleoSnies)
    : "No aplica";
  return proveedoresElegibles(solicitud).map((proveedor) => {
    const identidad: IdentidadProveedor = identidadProveedor(proveedor);
    return {
      documento: proveedor.nit,
      nombre: proveedor.nombre,
      tipoPersona: identidad.etiquetaTipoPersona,
      correo: identidad.correo,
      ubicacion: identidad.ubicacion,
      actividades: proveedor.actividades.join(" · "),
      nucleo,
    };
  });
}

/** true cuando el periodo de cotización terminó (RN-29). */
export function ofertasDisponibles(
  solicitud: Pick<SolicitudDetalle, "cierre">,
): boolean {
  return cierreSolicitudVencido(solicitud.cierre);
}
