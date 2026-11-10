/**
 * Modelo del estudio de mercado y de sus invitaciones (S-13).
 *
 * Un estudio de mercado es un proceso propio: no extiende `Solicitud` ni
 * comparte su ciclo de vida. Solo referencia una solicitud (`solicitudId`) y
 * reutiliza el banco de proveedores, las actividades CIIU y los núcleos SNIES
 * que ya usan S-02 y S-07.
 *
 * Los cálculos económicos del modal de creación son deliberadamente simples:
 * el mockup pide una metodología de precio referencial y unas ofertas
 * vinculadas, pero el detalle APU queda fuera de esta entrega.
 */

import type {
  EstadoEstudioMercado,
  EstadoInvitacionEstudio,
} from "src/app/core/constants/estados-solicitud.const";
import { ETIQUETAS_TIPO_NECESIDAD, TipoNecesidadSolicitud } from "./items.model";
import {
  ACTIVIDADES_CIIU,
  ActividadVinculada,
  IdentidadProveedor,
  PROVEEDORES_MOCK,
  ProveedorObjetivo,
  buscarProveedores,
  identidadProveedor,
  indiceProveedor,
} from "./proveedores.model";

/* ── Catálogos propios del estudio ────────────────────────────────────────── */

export type FuenteInformacionEstudio =
  | "agora"
  | "historico"
  | "cce"
  | "mixta";

export type MetodoPrecioEstudio =
  | "menor-homologado"
  | "media-aritmetica"
  | "mediana";

export type VariableTributaria =
  | "iva"
  | "estampilla-universidad"
  | "estampilla-cultura"
  | "estampilla-adulto-mayor";

export type EstadoInscripcionProveedor =
  | "activo"
  | "en-revision"
  | "suspendido";

export type TipoPersonaFiltro =
  | "todos"
  | "natural"
  | "juridica"
  | "consorcio";

export type OrdenProveedoresEstudio =
  | "coincidencia"
  | "razon-social"
  | "rup";

export const ETIQUETAS_FUENTE_INFORMACION: Readonly<
  Record<FuenteInformacionEstudio, string>
> = {
  agora: "Cotizaciones recibidas en ÁGORA",
  historico: "Precios históricos UD / SECOP II",
  cce: "Catálogo Acuerdo Marco de Precios CCE",
  mixta: "Metodología mixta (mercado + histórico)",
};

export const ETIQUETAS_METODO_PRECIO: Readonly<
  Record<MetodoPrecioEstudio, string>
> = {
  "menor-homologado": "Menor valor homologado",
  "media-aritmetica": "Media aritmética",
  mediana: "Mediana estadística",
};

export const ETIQUETAS_VARIABLE_TRIBUTARIA: Readonly<
  Record<VariableTributaria, string>
> = {
  iva: "IVA general 19 % sobre base gravable",
  "estampilla-universidad": "Estampilla Pro-Universidad Distrital (1.1 %)",
  "estampilla-cultura": "Estampilla Pro-Cultura (0.5 %)",
  "estampilla-adulto-mayor": "Estampilla Adulto Mayor (2.0 %)",
};

export const ETIQUETAS_ESTADO_INSCRIPCION: Readonly<
  Record<EstadoInscripcionProveedor, string>
> = {
  activo: "Activo",
  "en-revision": "En revisión",
  suspendido: "Suspendido",
};

export const ETIQUETAS_TIPO_PERSONA_FILTRO: Readonly<
  Record<TipoPersonaFiltro, string>
> = {
  todos: "Todos",
  natural: "Natural",
  juridica: "Jurídica",
  consorcio: "Consorcio / UT",
};

/** Autor simulado mientras el Root no expone el usuario en el MF. */
export const USUARIO_ESTUDIO_MOCK = {
  usuario: "raquimbayap",
  nombre: "Raúl Quimbaya",
  rol: "Jefe de Dependencia",
} as const;

/* ── Solicitudes y ofertas simuladas del modal ───────────────────────────── */

/** Oferta económica que el modal puede vincular al cálculo del estudio. */
export interface OfertaVinculadaEstudio {
  readonly id: string;
  readonly proveedor: string;
  readonly nit: string;
  readonly valor: number;
  readonly seleccionada: boolean;
}

/** Solicitud existente que el modal usa como fuente de ofertas. */
export interface SolicitudAsociadaEstudio {
  readonly id: string;
  readonly titulo: string;
  readonly dependencia: string;
  readonly vigencia: number;
  readonly presupuesto: number;
  readonly tipoNecesidad: TipoNecesidadSolicitud;
  /** Códigos CIIU que hereda el estudio al crearse. */
  readonly actividades: readonly string[];
  readonly ofertas: readonly OfertaVinculadaEstudio[];
}

/** Adjunto cargado en la invitación. En el mock no se persiste el binario. */
export interface AdjuntoEstudio {
  readonly id: string;
  readonly nombre: string;
  readonly tamano: number;
  readonly tipo: string;
  readonly cargadoEl: string;
}

/* ── Estudio e invitaciones ──────────────────────────────────────────────── */

export interface InvitacionEstudio {
  readonly id: string;
  readonly estudioId: string;
  readonly proveedorId: string;
  readonly estado: EstadoInvitacionEstudio;
  readonly fechaEnvio: string | null;
  readonly fechaRespuesta: string | null;
  readonly usuario: string;
  readonly correo: string;
  readonly radicado: string;
}

export type TipoEventoEstudio =
  | "creado"
  | "borrador"
  | "invitaciones"
  | "invitacion-adicional"
  | "cerrado"
  | "descartado";

export interface EventoEstudioMercado {
  readonly id: string;
  readonly tipo: TipoEventoEstudio;
  readonly fecha: string;
  readonly usuario: string;
  readonly nombreUsuario?: string;
  readonly detalle: string;
  readonly radicado?: string;
}

export interface EstudioMercado {
  readonly id: string;
  readonly vigencia: number;
  readonly objeto: string;
  readonly tipoNecesidad: TipoNecesidadSolicitud;
  readonly dependencia: string;
  readonly responsable: string;
  readonly estado: EstadoEstudioMercado;
  readonly creadoEl: string;
  readonly creadoPor: string;
  readonly actualizadoEl: string;
  readonly solicitudId: string;
  readonly solicitudTitulo: string;
  readonly fuenteInformacion: FuenteInformacionEstudio;
  readonly metodoPrecio: MetodoPrecioEstudio;
  readonly analisisTecnico: string;
  readonly variablesTributarias: readonly VariableTributaria[];
  readonly ofertasVinculadas: readonly OfertaVinculadaEstudio[];
  readonly valorReferencia: number;
  readonly presupuestoBase: number;
  readonly presupuestoFijado: boolean;
  readonly actividades: readonly ActividadVinculada[];
  readonly areaSnies: string;
  readonly nucleoSnies: string;
  readonly fechaLimite: string | null;
  readonly asunto: string;
  readonly mensaje: string;
  readonly notificar: boolean;
  readonly adjuntos: readonly AdjuntoEstudio[];
  readonly invitaciones: readonly InvitacionEstudio[];
  readonly eventos: readonly EventoEstudioMercado[];
  readonly radicado?: string;
}

/* ── Filtros y resultados del listado ────────────────────────────────────── */

export type GrupoEstudio =
  | "todos"
  | "borrador"
  | "en-recepcion"
  | "cerrado"
  | "aprobado";

export interface FiltroEstudiosMercado {
  vigencia: string;
  estado: string;
  dependencia: string;
  busqueda: string;
  grupo: GrupoEstudio;
}

export interface ConteosEstudios {
  readonly todos: number;
  readonly borrador: number;
  readonly "en-recepcion": number;
  readonly cerrado: number;
  readonly aprobado: number;
}

export interface ResultadoListadoEstudios {
  readonly estudios: readonly EstudioMercado[];
  readonly total: number;
  readonly conteos: ConteosEstudios;
  readonly dependencias: readonly string[];
}

/* ── Búsqueda de proveedores por actividad ───────────────────────────────── */

export interface ProveedorEstudio {
  readonly proveedor: ProveedorObjetivo;
  readonly identidad: IdentidadProveedor;
  readonly documento: string;
  readonly rup: string;
  readonly estadoInscripcion: EstadoInscripcionProveedor;
  readonly coincidencias: readonly string[];
  readonly estadoInvitacion: EstadoInvitacionEstudio;
  readonly correoEnmascarado: string;
  readonly telefonoEnmascarado: string;
}

export interface CriteriosProveedoresEstudio {
  readonly estudioId?: string;
  readonly actividades: readonly string[];
  readonly areaSnies: string;
  readonly nucleoSnies: string;
  readonly tipoNecesidad: TipoNecesidadSolicitud;
  readonly tipoPersona: TipoPersonaFiltro;
  readonly departamento: string;
  readonly ciudad: string;
  readonly estadoInscripcion: string;
  readonly palabraClave: string;
  readonly orden: OrdenProveedoresEstudio;
  readonly pagina: number;
  readonly porPagina: number;
}

export interface ResultadoProveedoresEstudio {
  readonly proveedores: readonly ProveedorEstudio[];
  readonly total: number;
  /** Todos los resultados filtrados, para la selección total y el modal. */
  readonly todos: readonly ProveedorEstudio[];
  /** Ids de todos los resultados filtrados, para “seleccionar todos”. */
  readonly idsFiltrados: readonly string[];
}

/* ── Registros de escritura ──────────────────────────────────────────────── */

export interface RegistroEstudioMercado {
  readonly solicitudId: string;
  readonly objeto: string;
  readonly tipoNecesidad: TipoNecesidadSolicitud;
  readonly vigencia: number;
  readonly dependencia: string;
  readonly responsable: string;
  readonly fuenteInformacion: FuenteInformacionEstudio;
  readonly metodoPrecio: MetodoPrecioEstudio;
  readonly analisisTecnico: string;
  readonly variablesTributarias: readonly VariableTributaria[];
  readonly ofertasVinculadas: readonly OfertaVinculadaEstudio[];
  readonly actividades: readonly ActividadVinculada[];
  readonly areaSnies: string;
  readonly nucleoSnies: string;
  readonly fechaLimite: string | null;
  readonly asunto: string;
  readonly mensaje: string;
  readonly notificar: boolean;
  readonly adjuntos: readonly File[];
  readonly fijarPresupuesto: boolean;
}

export interface RegistroInvitacionEstudio {
  readonly proveedoresIds: readonly string[];
  readonly asunto: string;
  readonly mensaje: string;
  readonly fechaLimite: string;
  readonly notificar: boolean;
  readonly adjuntos: readonly File[];
}

export interface ReporteProveedoresEstudio {
  readonly nombreArchivo: string;
  readonly contenido: string;
  readonly total: number;
  readonly generadoEl: string;
}

/* ── Utilidades puras ────────────────────────────────────────────────────── */

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** Fecha y hora legible en hora de Bogotá ("24/02/2026 10:15 COT"). */
export function formatoFechaHoraEstudio(valor: string | null): string {
  if (!valor) {
    return "—";
  }
  const fecha = new Date(valor);
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
  const dato = (tipo: string): string =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${dato("day")}/${dato("month")}/${dato("year")} ${dato("hour")}:${dato("minute")} COT`;
}

/** Fecha larga legible ("24 de febrero de 2026"). */
export function formatoFechaLargaEstudio(valor: string | null): string {
  if (!valor) {
    return "—";
  }
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    return "—";
  }
  const partes = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(fecha);
  const dato = (tipo: string): string =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";
  const mes = Number(dato("month"));
  return `${dato("day")} de ${MESES[mes - 1] ?? ""} de ${dato("year")}`;
}

/** Estado visible del estudio; `cerrado` se deriva del vencimiento. */
export function estadoEstudioMercado(
  estudio: Pick<EstudioMercado, "estado" | "fechaLimite">,
  ahora = Date.now(),
): EstadoEstudioMercado {
  if (estudio.estado === "en-recepcion" && estudio.fechaLimite) {
    const limite = Date.parse(estudio.fechaLimite);
    if (Number.isFinite(limite) && limite <= ahora) {
      return "cerrado";
    }
  }
  return estudio.estado;
}

/** Invitaciones efectivamente cursadas (excluye “sin invitar”). */
export function invitadosDe(estudio: EstudioMercado): number {
  return estudio.invitaciones.filter(
    (invitacion) => invitacion.estado !== "sin-invitar",
  ).length;
}

/** Proveedores que respondieron la invitación. */
export function respondieronDe(estudio: EstudioMercado): number {
  return estudio.invitaciones.filter(
    (invitacion) => invitacion.estado === "respondio",
  ).length;
}

/** Estado de invitación de un proveedor dentro del estudio. */
export function estadoInvitacionDe(
  estudio: EstudioMercado | null,
  proveedorId: string,
): EstadoInvitacionEstudio {
  return (
    estudio?.invitaciones.find(
      (invitacion) => invitacion.proveedorId === proveedorId,
    )?.estado ?? "sin-invitar"
  );
}

/** Valor de referencia según la metodología elegida. */
export function calcularValorReferencia(
  ofertas: readonly OfertaVinculadaEstudio[],
  metodo: MetodoPrecioEstudio,
): number {
  const valores = ofertas
    .filter((oferta) => oferta.seleccionada)
    .map((oferta) => oferta.valor)
    .filter((valor) => Number.isFinite(valor) && valor > 0)
    .sort((a, b) => a - b);

  if (valores.length === 0) {
    return 0;
  }
  if (metodo === "menor-homologado") {
    return valores[0];
  }
  if (metodo === "media-aritmetica") {
    return Math.round(
      valores.reduce((total, valor) => total + valor, 0) / valores.length,
    );
  }
  const medio = Math.floor(valores.length / 2);
  return valores.length % 2 === 1
    ? valores[medio]
    : Math.round((valores[medio - 1] + valores[medio]) / 2);
}

/** Actividades CIIU vinculadas a partir de sus códigos. */
export function actividadesPorCodigo(
  codigos: readonly string[],
): readonly ActividadVinculada[] {
  return codigos.flatMap((codigo) => {
    const actividad = ACTIVIDADES_CIIU.find(
      (candidata) => candidata.codigo === codigo,
    );
    return actividad ? [{ ...actividad, id: `act-${codigo}` }] : [];
  });
}

/** Correo enmascarado (CA-028 / Ley 1581). */
export function enmascararCorreo(correo: string): string {
  const [usuario, dominio] = correo.split("@");
  if (!usuario || !dominio) {
    return "***";
  }
  return `${usuario.slice(0, 3)}***@${dominio}`;
}

/** RUP simulado y estable por proveedor. */
export function rupProveedor(proveedor: ProveedorObjetivo): string {
  const indice = Math.max(1, indiceProveedor(proveedor));
  return `RUP: ${String(10000000 + indice * 137).padStart(8, "0")}`;
}

/** Teléfono enmascarado y estable por proveedor. */
export function telefonoProveedor(proveedor: ProveedorObjetivo): string {
  const indice = Math.max(1, indiceProveedor(proveedor));
  return `+57 (601) 3${String(10 + indice).padStart(2, "0")}-****`;
}

const ESTADOS_INSCRIPCION_MOCK: Readonly<
  Record<string, EstadoInscripcionProveedor>
> = {
  "prov-02": "en-revision",
  "prov-14": "suspendido",
  "prov-19": "en-revision",
};

/** Estado de inscripción simulado del proveedor. */
export function estadoInscripcionProveedor(
  proveedor: ProveedorObjetivo,
): EstadoInscripcionProveedor {
  return ESTADOS_INSCRIPCION_MOCK[proveedor.id] ?? "activo";
}

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Departamentos disponibles en el banco de proveedores. */
export function departamentosProveedores(): readonly string[] {
  const valores = new Set<string>();
  for (const proveedor of PROVEEDORES_BANCO) {
    valores.add(identidadProveedor(proveedor).departamento);
  }
  return [...valores].sort((a, b) => a.localeCompare(b, "es-CO"));
}

/** Ciudades del banco, filtradas por departamento cuando se indica. */
export function ciudadesProveedores(
  departamento: string,
): readonly string[] {
  const valores = new Set<string>();
  for (const proveedor of PROVEEDORES_BANCO) {
    const identidad = identidadProveedor(proveedor);
    if (!departamento || identidad.departamento === departamento) {
      valores.add(identidad.ubicacion);
    }
  }
  return [...valores].sort((a, b) => a.localeCompare(b, "es-CO"));
}

/**
 * Cruza el banco con las actividades CIIU y los filtros de RF-06.
 *
 * El SNIES se muestra y se registra, pero no restringe: RN-03/RN-15 lo dejan
 * como clasificación declarada, no como filtro obligatorio.
 */
export function buscarProveedoresEstudio(
  criterios: CriteriosProveedoresEstudio,
  estudio: EstudioMercado | null = null,
): readonly ProveedorEstudio[] {
  if (criterios.actividades.length === 0) {
    return [];
  }

  const texto = normalizar(criterios.palabraClave.trim());
  const base = buscarProveedores(
    criterios.actividades,
    criterios.nucleoSnies,
    false,
  );

  const filas: ProveedorEstudio[] = base
    .map((proveedor) => {
      const identidad = identidadProveedor(proveedor);
      const coincidencias = proveedor.actividades.filter((codigo) =>
        criterios.actividades.includes(codigo),
      );
      return {
        proveedor,
        identidad,
        documento: proveedor.nit,
        rup: rupProveedor(proveedor),
        estadoInscripcion: estadoInscripcionProveedor(proveedor),
        coincidencias,
        estadoInvitacion: estadoInvitacionDe(estudio, proveedor.id),
        correoEnmascarado: enmascararCorreo(identidad.correo),
        telefonoEnmascarado: telefonoProveedor(proveedor),
      };
    })
    .filter((fila) => {
      if (
        criterios.tipoPersona !== "todos" &&
        fila.identidad.tipoPersona !== criterios.tipoPersona
      ) {
        return false;
      }
      if (
        criterios.departamento &&
        fila.identidad.departamento !== criterios.departamento
      ) {
        return false;
      }
      if (criterios.ciudad && fila.identidad.ubicacion !== criterios.ciudad) {
        return false;
      }
      if (
        criterios.estadoInscripcion &&
        fila.estadoInscripcion !== criterios.estadoInscripcion
      ) {
        return false;
      }
      if (texto) {
        const contenido = [
          fila.proveedor.nombre,
          fila.proveedor.nit,
          fila.rup,
          ...fila.coincidencias,
        ]
          .map(normalizar)
          .join(" ");
        if (!contenido.includes(texto)) {
          return false;
        }
      }
      return true;
    });

  return filas.sort((a, b) => {
    if (criterios.orden === "razon-social") {
      return a.proveedor.nombre.localeCompare(b.proveedor.nombre, "es-CO");
    }
    if (criterios.orden === "rup") {
      return a.rup.localeCompare(b.rup);
    }
    return (
      b.coincidencias.length - a.coincidencias.length ||
      a.proveedor.nombre.localeCompare(b.proveedor.nombre, "es-CO")
    );
  });
}

/** Asunto formal de la invitación, generado a partir del estudio. */
export function asuntoInvitacionEstudio(
  codigo: string,
  objeto: string,
): string {
  return `Invitación a presentar cotización para Estudio de Mercado - ${objeto} - ${codigo}`;
}

/** Mensaje formal precargado, editable por el usuario. */
export function mensajeInvitacionEstudio(
  codigo: string,
  objeto: string,
  fechaLimite: string,
): string {
  return (
    `Estimado proveedor: la Universidad Distrital Francisco José de Caldas le ` +
    `invita cordialmente a remitir su propuesta económica y ficha de ` +
    `especificaciones técnicas para el Estudio de Mercado ${codigo}, ` +
    `correspondiente a ${objeto}. La fecha límite de recepción es el ` +
    `${formatoFechaHoraEstudio(fechaLimite)}.`
  );
}

/** Etiqueta del tipo de necesidad. */
export function etiquetaTipoNecesidadEstudio(
  tipo: TipoNecesidadSolicitud,
): string {
  return ETIQUETAS_TIPO_NECESIDAD[tipo];
}

/* ── Datos semilla ───────────────────────────────────────────────────────── */

/** Ahora en ISO, para construir fechas relativas de la semilla. */
function isoRelativa(dias: number, hora = 10, minuto = 15): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  fecha.setHours(hora, minuto, 0, 0);
  return fecha.toISOString();
}

const OFERTAS_SOLICITUD_SERVIDORES: readonly OfertaVinculadaEstudio[] = [
  {
    id: "oferta-0039-01",
    proveedor: "Sistemas & Soluciones Tecnológicas de Colombia S.A.S.",
    nit: "901.482.304-8",
    valor: 254_200_000,
    seleccionada: true,
  },
  {
    id: "oferta-0039-02",
    proveedor: "Redes y Comunicaciones Bogotá Ltda.",
    nit: "830.112.980-1",
    valor: 268_100_000,
    seleccionada: true,
  },
  {
    id: "oferta-0039-03",
    proveedor: "Infraestructura & Datos Andina S.A.",
    nit: "900.567.891-3",
    valor: 273_000_000,
    seleccionada: true,
  },
];

const OFERTAS_SOLICITUD_REDES: readonly OfertaVinculadaEstudio[] = [
  {
    id: "oferta-0160-01",
    proveedor: "Redes y Servidores de Colombia S.A.S.",
    nit: "900.842.119-4",
    valor: 98_400_000,
    seleccionada: true,
  },
  {
    id: "oferta-0160-02",
    proveedor: "DataCloud Andina S.A.S.",
    nit: "901.320.448-7",
    valor: 104_750_000,
    seleccionada: true,
  },
  {
    id: "oferta-0160-03",
    proveedor: "Nube Pública Colombia S.A.S.",
    nit: "901.447.882-0",
    valor: 101_200_000,
    seleccionada: false,
  },
];

const OFERTAS_SOLICITUD_SOFTWARE: readonly OfertaVinculadaEstudio[] = [
  {
    id: "oferta-0161-01",
    proveedor: "Ingeniería de Software del Sur S.A.S.",
    nit: "901.102.774-5",
    valor: 187_600_000,
    seleccionada: true,
  },
  {
    id: "oferta-0161-02",
    proveedor: "Arquitectura de Software Andina LTDA",
    nit: "901.556.330-2",
    valor: 192_300_000,
    seleccionada: true,
  },
  {
    id: "oferta-0161-03",
    proveedor: "Desarrollo Digital Universitario S.A.S.",
    nit: "900.318.550-6",
    valor: 199_900_000,
    seleccionada: true,
  },
];

export const SOLICITUDES_ESTUDIO_MOCK: readonly SolicitudAsociadaEstudio[] = [
  {
    id: "SOL-2026-0039",
    titulo:
      "Adquisición e instalación de servidores blade y conmutación para Datacenter Paiba",
    dependencia: "Facultad de Ingeniería",
    vigencia: 2026,
    presupuesto: 280_000_000,
    tipoNecesidad: "bienes",
    actividades: ["6201", "6202"],
    ofertas: OFERTAS_SOLICITUD_SERVIDORES,
  },
  {
    id: "SOL-2026-0160",
    titulo:
      "Renovación de la infraestructura de red y conectividad del campus",
    dependencia: "Rectoría",
    vigencia: 2026,
    presupuesto: 120_000_000,
    tipoNecesidad: "servicios",
    actividades: ["6201", "6209"],
    ofertas: OFERTAS_SOLICITUD_REDES,
  },
  {
    id: "SOL-2026-0161",
    titulo:
      "Licenciamiento y soporte de la plataforma de virtualización institucional",
    dependencia: "IDEXUD",
    vigencia: 2026,
    presupuesto: 210_000_000,
    tipoNecesidad: "servicios",
    actividades: ["6202", "6209"],
    ofertas: OFERTAS_SOLICITUD_SOFTWARE,
  },
];

const PROVEEDORES_BANCO: readonly ProveedorObjetivo[] = PROVEEDORES_MOCK;

function proveedorBanco(id: string): ProveedorObjetivo | null {
  return PROVEEDORES_BANCO.find((proveedor) => proveedor.id === id) ?? null;
}

function invitacionSemilla(
  estudioId: string,
  proveedorId: string,
  estado: EstadoInvitacionEstudio,
  fechaEnvio: string | null,
  fechaRespuesta: string | null,
  indice: number,
): InvitacionEstudio | null {
  const proveedor = proveedorBanco(proveedorId);
  if (!proveedor) {
    return null;
  }
  return {
    id: `INV-${estudioId}-${indice}`,
    estudioId,
    proveedorId,
    estado,
    fechaEnvio,
    fechaRespuesta,
    usuario: USUARIO_ESTUDIO_MOCK.usuario,
    correo: identidadProveedor(proveedor).correo,
    radicado: `UD-CONTR-INV-2026-${String(1900 + indice).padStart(4, "0")}-SEC`,
  };
}

function invitacionesSemilla(
  estudioId: string,
  definiciones: readonly {
    readonly proveedorId: string;
    readonly estado: EstadoInvitacionEstudio;
    readonly fechaEnvio: string | null;
    readonly fechaRespuesta?: string | null;
  }[],
): readonly InvitacionEstudio[] {
  return definiciones.flatMap((definicion, indice) => {
    const invitacion = invitacionSemilla(
      estudioId,
      definicion.proveedorId,
      definicion.estado,
      definicion.fechaEnvio,
      definicion.fechaRespuesta ?? null,
      indice + 1,
    );
    return invitacion ? [invitacion] : [];
  });
}

function eventoSemilla(
  id: string,
  tipo: TipoEventoEstudio,
  fecha: string,
  detalle: string,
  radicado?: string,
): EventoEstudioMercado {
  return {
    id,
    tipo,
    fecha,
    usuario: USUARIO_ESTUDIO_MOCK.usuario,
    nombreUsuario: USUARIO_ESTUDIO_MOCK.nombre,
    detalle,
    radicado,
  };
}

const ESTUDIO_0001: EstudioMercado = {
  id: "EM-2026-0001",
  vigencia: 2026,
  objeto:
    "Adquisición e instalación de servidores blade y conmutación para Datacenter Paiba",
  tipoNecesidad: "bienes",
  dependencia: "Facultad de Ingeniería",
  responsable: "Ing. Carlos J. González P.",
  estado: "borrador",
  creadoEl: isoRelativa(-8, 9, 20),
  creadoPor: USUARIO_ESTUDIO_MOCK.usuario,
  actualizadoEl: isoRelativa(-1, 16, 40),
  solicitudId: "SOL-2026-0039",
  solicitudTitulo:
    "Adquisición e instalación de servidores blade y conmutación para Datacenter Paiba",
  fuenteInformacion: "agora",
  metodoPrecio: "menor-homologado",
  analisisTecnico:
    "Se evaluaron las propuestas económicas de cómputo para la Facultad Tecnológica. Todas las ofertas presentan disponibilidad inmediata y garantía extendida por 36 meses.",
  variablesTributarias: [
    "iva",
    "estampilla-universidad",
    "estampilla-cultura",
    "estampilla-adulto-mayor",
  ],
  ofertasVinculadas: OFERTAS_SOLICITUD_SERVIDORES,
  valorReferencia: calcularValorReferencia(
    OFERTAS_SOLICITUD_SERVIDORES,
    "menor-homologado",
  ),
  presupuestoBase: 280_000_000,
  presupuestoFijado: false,
  actividades: actividadesPorCodigo(["6201", "6202"]),
  areaSnies: "",
  nucleoSnies: "",
  fechaLimite: null,
  asunto: "",
  mensaje: "",
  notificar: true,
  adjuntos: [],
  invitaciones: [],
  eventos: [
    eventoSemilla(
      "evt-0001-01",
      "creado",
      isoRelativa(-8, 9, 20),
      "Borrador del estudio creado desde el listado de estudios de mercado.",
    ),
  ],
};

const ESTUDIO_0002: EstudioMercado = {
  id: "EM-2026-0002",
  vigencia: 2026,
  objeto:
    "Licenciamiento de virtualización y soporte para el datacenter institucional",
  tipoNecesidad: "servicios",
  dependencia: "Rectoría",
  responsable: "Dra. Luisa Arboleda",
  estado: "en-recepcion",
  creadoEl: isoRelativa(-14, 11, 5),
  creadoPor: USUARIO_ESTUDIO_MOCK.usuario,
  actualizadoEl: isoRelativa(-2, 15, 30),
  solicitudId: "SOL-2026-0160",
  solicitudTitulo:
    "Renovación de la infraestructura de red y conectividad del campus",
  fuenteInformacion: "mixta",
  metodoPrecio: "media-aritmetica",
  analisisTecnico:
    "El mercado de virtualización presenta una oferta consolidada de integradores locales. Se contrastaron cotizaciones recientes y precios históricos de SECOP II para estimar el valor de referencia.",
  variablesTributarias: ["iva", "estampilla-universidad"],
  ofertasVinculadas: OFERTAS_SOLICITUD_REDES,
  valorReferencia: calcularValorReferencia(
    OFERTAS_SOLICITUD_REDES,
    "media-aritmetica",
  ),
  presupuestoBase: 120_000_000,
  presupuestoFijado: true,
  actividades: actividadesPorCodigo(["6201", "6209"]),
  areaSnies: "ING_ARQ_AFINES",
  nucleoSnies: "SISTEMAS",
  fechaLimite: isoRelativa(12, 17, 0),
  asunto:
    "Invitación a presentar cotización para Estudio de Mercado - Licenciamiento de virtualización - EM-2026-0002",
  mensaje:
    "Estimado proveedor: la Universidad Distrital le invita a remitir su propuesta económica y ficha técnica para el estudio de licenciamiento de virtualización. La recepción cierra el plazo indicado en esta invitación.",
  notificar: true,
  adjuntos: [],
  invitaciones: invitacionesSemilla("EM-2026-0002", [
    {
      proveedorId: "prov-01",
      estado: "respondio",
      fechaEnvio: isoRelativa(-12, 10, 0),
      fechaRespuesta: isoRelativa(-6, 14, 20),
    },
    {
      proveedorId: "prov-03",
      estado: "respondio",
      fechaEnvio: isoRelativa(-12, 10, 0),
      fechaRespuesta: isoRelativa(-5, 9, 10),
    },
    {
      proveedorId: "prov-04",
      estado: "invitado",
      fechaEnvio: isoRelativa(-12, 10, 0),
    },
    {
      proveedorId: "prov-05",
      estado: "invitado",
      fechaEnvio: isoRelativa(-12, 10, 0),
    },
    {
      proveedorId: "prov-09",
      estado: "no-respondio",
      fechaEnvio: isoRelativa(-12, 10, 0),
    },
    {
      proveedorId: "prov-10",
      estado: "invitado",
      fechaEnvio: isoRelativa(-12, 10, 0),
    },
    {
      proveedorId: "prov-12",
      estado: "invitado",
      fechaEnvio: isoRelativa(-12, 10, 0),
    },
    {
      proveedorId: "prov-25",
      estado: "respondio",
      fechaEnvio: isoRelativa(-12, 10, 0),
      fechaRespuesta: isoRelativa(-7, 11, 45),
    },
  ]),
  eventos: [
    eventoSemilla(
      "evt-0002-01",
      "creado",
      isoRelativa(-14, 11, 5),
      "Estudio creado y asociado a la solicitud SOL-2026-0160.",
    ),
    eventoSemilla(
      "evt-0002-02",
      "invitaciones",
      isoRelativa(-12, 10, 0),
      "Se enviaron 8 invitaciones formales a proveedores habilitados.",
      "UD-CONTR-INV-2026-1908-SEC",
    ),
  ],
};

const ESTUDIO_0003: EstudioMercado = {
  id: "EM-2026-0003",
  vigencia: 2026,
  objeto:
    "Cableado estructurado y patch panels Cat 6A para el bloque de laboratorios",
  tipoNecesidad: "bienes",
  dependencia: "Facultad de Ingeniería",
  responsable: "Ing. Andrés Felipe Tobón",
  estado: "en-recepcion",
  creadoEl: isoRelativa(-10, 8, 30),
  creadoPor: USUARIO_ESTUDIO_MOCK.usuario,
  actualizadoEl: isoRelativa(-3, 12, 15),
  solicitudId: "SOL-2026-0039",
  solicitudTitulo:
    "Adquisición e instalación de servidores blade y conmutación para Datacenter Paiba",
  fuenteInformacion: "cce",
  metodoPrecio: "mediana",
  analisisTecnico:
    "Se contrastaron precios del catálogo marco de Colombia Compra Eficiente con cotizaciones locales de cableado estructurado certificado. La mediana neutraliza los valores extremos del mercado.",
  variablesTributarias: ["iva", "estampilla-cultura"],
  ofertasVinculadas: OFERTAS_SOLICITUD_SERVIDORES.map((oferta, indice) => ({
    ...oferta,
    id: `oferta-0003-${indice + 1}`,
    valor: [19_128_000, 20_400_000, 21_750_000][indice] ?? oferta.valor,
  })),
  valorReferencia: calcularValorReferencia(
    [
      { ...OFERTAS_SOLICITUD_SERVIDORES[0], valor: 19_128_000, seleccionada: true },
      { ...OFERTAS_SOLICITUD_SERVIDORES[1], valor: 20_400_000, seleccionada: true },
      { ...OFERTAS_SOLICITUD_SERVIDORES[2], valor: 21_750_000, seleccionada: true },
    ],
    "mediana",
  ),
  presupuestoBase: 45_000_000,
  presupuestoFijado: false,
  actividades: actividadesPorCodigo(["4651", "2620"]),
  areaSnies: "",
  nucleoSnies: "",
  fechaLimite: isoRelativa(6, 16, 0),
  asunto:
    "Invitación a presentar cotización para Estudio de Mercado - Cableado estructurado - EM-2026-0003",
  mensaje:
    "Estimado proveedor: la Universidad Distrital le invita a presentar su cotización para el cableado estructurado certificado del bloque de laboratorios.",
  notificar: true,
  adjuntos: [],
  invitaciones: invitacionesSemilla("EM-2026-0003", [
    {
      proveedorId: "prov-13",
      estado: "invitado",
      fechaEnvio: isoRelativa(-8, 9, 0),
    },
    {
      proveedorId: "prov-14",
      estado: "invitado",
      fechaEnvio: isoRelativa(-8, 9, 0),
    },
    {
      proveedorId: "prov-15",
      estado: "invitado",
      fechaEnvio: isoRelativa(-8, 9, 0),
    },
    {
      proveedorId: "prov-18",
      estado: "invitado",
      fechaEnvio: isoRelativa(-8, 9, 0),
    },
    {
      proveedorId: "prov-21",
      estado: "invitado",
      fechaEnvio: isoRelativa(-8, 9, 0),
    },
  ]),
  eventos: [
    eventoSemilla(
      "evt-0003-01",
      "creado",
      isoRelativa(-10, 8, 30),
      "Estudio creado desde el listado de estudios de mercado.",
    ),
    eventoSemilla(
      "evt-0003-02",
      "invitaciones",
      isoRelativa(-8, 9, 0),
      "Se enviaron 5 invitaciones formales a proveedores de cableado y hardware.",
      "UD-CONTR-INV-2026-1912-SEC",
    ),
  ],
};

const ESTUDIO_0004: EstudioMercado = {
  id: "EM-2026-0004",
  vigencia: 2026,
  objeto: "Equipos de cómputo para los laboratorios de la Facultad Tecnológica",
  tipoNecesidad: "bienes",
  dependencia: "Facultad de Ingeniería",
  responsable: "Ing. Carlos J. González P.",
  estado: "en-recepcion",
  creadoEl: isoRelativa(-30, 10, 0),
  creadoPor: USUARIO_ESTUDIO_MOCK.usuario,
  actualizadoEl: isoRelativa(-12, 17, 10),
  solicitudId: "SOL-2026-0039",
  solicitudTitulo:
    "Adquisición e instalación de servidores blade y conmutación para Datacenter Paiba",
  fuenteInformacion: "historico",
  metodoPrecio: "menor-homologado",
  analisisTecnico:
    "El estudio toma como referencia compras históricas de equipos de cómputo de la Universidad y cotizaciones de distribuidores locales. Se prioriza la oferta que cumple la ficha técnica al menor precio.",
  variablesTributarias: ["iva", "estampilla-universidad", "estampilla-adulto-mayor"],
  ofertasVinculadas: OFERTAS_SOLICITUD_SERVIDORES.map((oferta, indice) => ({
    ...oferta,
    id: `oferta-0004-${indice + 1}`,
    valor: [148_900_000, 152_400_000, 156_800_000][indice] ?? oferta.valor,
  })),
  valorReferencia: 148_900_000,
  presupuestoBase: 170_000_000,
  presupuestoFijado: true,
  actividades: actividadesPorCodigo(["4651", "2620"]),
  areaSnies: "",
  nucleoSnies: "",
  fechaLimite: isoRelativa(-5, 17, 0),
  asunto:
    "Invitación a presentar cotización para Estudio de Mercado - Equipos de cómputo - EM-2026-0004",
  mensaje:
    "Estimado proveedor: la Universidad Distrital le invita a presentar su cotización para el suministro de equipos de cómputo para laboratorios.",
  notificar: true,
  adjuntos: [],
  invitaciones: invitacionesSemilla("EM-2026-0004", [
    {
      proveedorId: "prov-13",
      estado: "respondio",
      fechaEnvio: isoRelativa(-24, 9, 0),
      fechaRespuesta: isoRelativa(-18, 10, 0),
    },
    {
      proveedorId: "prov-15",
      estado: "respondio",
      fechaEnvio: isoRelativa(-24, 9, 0),
      fechaRespuesta: isoRelativa(-17, 11, 30),
    },
    {
      proveedorId: "prov-16",
      estado: "respondio",
      fechaEnvio: isoRelativa(-24, 9, 0),
      fechaRespuesta: isoRelativa(-16, 15, 0),
    },
    {
      proveedorId: "prov-18",
      estado: "respondio",
      fechaEnvio: isoRelativa(-24, 9, 0),
      fechaRespuesta: isoRelativa(-15, 9, 45),
    },
    {
      proveedorId: "prov-20",
      estado: "respondio",
      fechaEnvio: isoRelativa(-24, 9, 0),
      fechaRespuesta: isoRelativa(-14, 12, 0),
    },
    {
      proveedorId: "prov-22",
      estado: "respondio",
      fechaEnvio: isoRelativa(-24, 9, 0),
      fechaRespuesta: isoRelativa(-13, 16, 20),
    },
    {
      proveedorId: "prov-24",
      estado: "no-respondio",
      fechaEnvio: isoRelativa(-24, 9, 0),
    },
    {
      proveedorId: "prov-28",
      estado: "no-respondio",
      fechaEnvio: isoRelativa(-24, 9, 0),
    },
  ]),
  eventos: [
    eventoSemilla(
      "evt-0004-01",
      "creado",
      isoRelativa(-30, 10, 0),
      "Estudio creado y asociado a la solicitud SOL-2026-0039.",
    ),
    eventoSemilla(
      "evt-0004-02",
      "invitaciones",
      isoRelativa(-24, 9, 0),
      "Se enviaron 8 invitaciones formales a proveedores de equipos de cómputo.",
      "UD-CONTR-INV-2026-1920-SEC",
    ),
  ],
};

const ESTUDIO_0005: EstudioMercado = {
  id: "EM-2026-0005",
  vigencia: 2026,
  objeto:
    "Consultoría para la arquitectura de nube institucional y plan de continuidad",
  tipoNecesidad: "servicios",
  dependencia: "IDEXUD",
  responsable: "Dra. Luisa Arboleda",
  estado: "aprobado",
  creadoEl: isoRelativa(-45, 9, 0),
  creadoPor: USUARIO_ESTUDIO_MOCK.usuario,
  actualizadoEl: isoRelativa(-20, 16, 45),
  solicitudId: "SOL-2026-0161",
  solicitudTitulo:
    "Licenciamiento y soporte de la plataforma de virtualización institucional",
  fuenteInformacion: "agora",
  metodoPrecio: "media-aritmetica",
  analisisTecnico:
    "La consultoría se comparó con tres firmas especializadas en arquitectura cloud. Se adoptó la media aritmética por la homogeneidad técnica de las propuestas y se fijó el presupuesto oficial.",
  variablesTributarias: ["iva", "estampilla-universidad", "estampilla-cultura"],
  ofertasVinculadas: OFERTAS_SOLICITUD_SOFTWARE,
  valorReferencia: calcularValorReferencia(
    OFERTAS_SOLICITUD_SOFTWARE,
    "media-aritmetica",
  ),
  presupuestoBase: 210_000_000,
  presupuestoFijado: true,
  actividades: actividadesPorCodigo(["6202", "6209"]),
  areaSnies: "ING_ARQ_AFINES",
  nucleoSnies: "SISTEMAS",
  fechaLimite: isoRelativa(-20, 17, 0),
  asunto:
    "Invitación a presentar cotización para Estudio de Mercado - Arquitectura de nube - EM-2026-0005",
  mensaje:
    "Estimado proveedor: la Universidad Distrital le invita a presentar su propuesta para la consultoría de arquitectura de nube institucional.",
  notificar: true,
  adjuntos: [],
  invitaciones: invitacionesSemilla("EM-2026-0005", [
    {
      proveedorId: "prov-01",
      estado: "respondio",
      fechaEnvio: isoRelativa(-40, 9, 0),
      fechaRespuesta: isoRelativa(-34, 10, 0),
    },
    {
      proveedorId: "prov-04",
      estado: "respondio",
      fechaEnvio: isoRelativa(-40, 9, 0),
      fechaRespuesta: isoRelativa(-33, 11, 0),
    },
    {
      proveedorId: "prov-07",
      estado: "respondio",
      fechaEnvio: isoRelativa(-40, 9, 0),
      fechaRespuesta: isoRelativa(-32, 15, 30),
    },
    {
      proveedorId: "prov-12",
      estado: "respondio",
      fechaEnvio: isoRelativa(-40, 9, 0),
      fechaRespuesta: isoRelativa(-31, 9, 15),
    },
  ]),
  eventos: [
    eventoSemilla(
      "evt-0005-01",
      "creado",
      isoRelativa(-45, 9, 0),
      "Estudio creado y asociado a la solicitud SOL-2026-0161.",
    ),
    eventoSemilla(
      "evt-0005-02",
      "invitaciones",
      isoRelativa(-40, 9, 0),
      "Se enviaron 4 invitaciones formales a firmas de consultoría.",
      "UD-CONTR-INV-2026-1930-SEC",
    ),
  ],
};

const ESTUDIO_0006: EstudioMercado = {
  id: "EM-2026-0006",
  vigencia: 2026,
  objeto: "Mantenimiento preventivo de la infraestructura de red del campus",
  tipoNecesidad: "servicios",
  dependencia: "Rectoría",
  responsable: "Ing. Andrés Felipe Tobón",
  estado: "borrador",
  creadoEl: isoRelativa(-2, 14, 10),
  creadoPor: USUARIO_ESTUDIO_MOCK.usuario,
  actualizadoEl: isoRelativa(-1, 9, 5),
  solicitudId: "SOL-2026-0160",
  solicitudTitulo:
    "Renovación de la infraestructura de red y conectividad del campus",
  fuenteInformacion: "historico",
  metodoPrecio: "mediana",
  analisisTecnico:
    "Se revisaron órdenes de servicio históricas de mantenimiento de red y se calculó una mediana para evitar el sesgo de los contratos de emergencia.",
  variablesTributarias: ["iva"],
  ofertasVinculadas: OFERTAS_SOLICITUD_REDES.map((oferta, indice) => ({
    ...oferta,
    id: `oferta-0006-${indice + 1}`,
    valor: [38_400_000, 41_200_000, 44_800_000][indice] ?? oferta.valor,
  })),
  valorReferencia: 41_200_000,
  presupuestoBase: 50_000_000,
  presupuestoFijado: false,
  actividades: actividadesPorCodigo(["9511"]),
  areaSnies: "",
  nucleoSnies: "",
  fechaLimite: null,
  asunto: "",
  mensaje: "",
  notificar: true,
  adjuntos: [],
  invitaciones: [],
  eventos: [
    eventoSemilla(
      "evt-0006-01",
      "creado",
      isoRelativa(-2, 14, 10),
      "Borrador del estudio creado desde el listado de estudios de mercado.",
    ),
  ],
};

export const ESTUDIOS_MERCADO_MOCK: readonly EstudioMercado[] = [
  ESTUDIO_0001,
  ESTUDIO_0002,
  ESTUDIO_0003,
  ESTUDIO_0004,
  ESTUDIO_0005,
  ESTUDIO_0006,
];
