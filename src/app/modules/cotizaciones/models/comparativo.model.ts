/**
 * Modelo del comparador de cotizaciones (S-09).
 *
 * Este módulo concentra los cálculos del comparativo: oferta itemizada,
 * totales, diferencia frente al CDP, ranking entre ofertas elegibles, mejor
 * valor por ítem y las filas de la matriz. Las plantillas solo pintan el
 * resultado; no hacen cuentas ni comparan precios.
 *
 * No duplica la respuesta del proveedor: reutiliza `ItemRespuestaProveedor` y
 * `calcularTotalesRespuesta` (P-04). Tampoco duplica la solicitud: recibe el
 * `SolicitudDetalle` ya resuelto por la ruta y el `OferenteTablero` de S-07.
 *
 * Reglas provisionales:
 * - El precio más bajo es una referencia, no una adjudicación (RN-34).
 * - Las ofertas que superan el CDP no participan del ranking ni del mejor
 *   valor por ítem (RN-40); se muestran con advertencia.
 * - La ponderación, el desempate y los criterios técnicos no están definidos:
 *   no se inventa un puntaje.
 */

import type { DocumentoOferente } from "./documentos.model";
import type { ItemSolicitud } from "./items.model";
import { formatoCop } from "./necesidad.model";
import type { OferenteTablero } from "./oferente.model";
import type { IdentidadProveedor, ProveedorObjetivo } from "./proveedores.model";
import {
  identidadProveedor,
  indiceProveedor,
} from "./proveedores.model";
import {
  calcularTotalesRespuesta,
  type ItemRespuestaProveedor,
  type TotalesRespuestaProveedor,
} from "./respuesta-proveedor.model";
import type { SolicitudDetalle } from "./solicitud.model";

/* ── Semilla de la oferta simulada ────────────────────────────────────────── */

/** Condiciones comerciales que acompañan a una oferta del mock. */
export interface SemillaOfertaComparada {
  /** Multiplicador sobre el precio base del pliego. */
  readonly factor: number;
  /** Descuento comercial (0–100); `null` equivale a sin descuento. */
  readonly descuentoPorcentaje: number | null;
  /** Días de validez de la oferta. */
  readonly validezDias: number;
  /** Plazo de entrega o ejecución en días calendario. */
  readonly plazoEntregaDias: number;
  /** Texto de descuentos o beneficios adicionales. */
  readonly condicionesComerciales: string;
  /** Nombre del anexo técnico radicado por el proveedor. */
  readonly anexoTecnico: string;
  /** Versión visible de la cotización ("v1.0", "v1.1"). */
  readonly version: string;
}

interface ConfigOfertaSimulada {
  readonly factor: number;
  readonly descuentoPorcentaje: number;
  readonly validezDias: number;
  readonly plazoEntregaDias: number;
  readonly condicionesComerciales: string;
  readonly anexoTecnico: string;
}

/**
 * Precio unitario base del pliego simulado.
 *
 * No vive en `ItemSolicitud` porque el mock no publica techo por ítem. Si en el
 * futuro el pliego trae `valorUnitarioTecho`, ese valor tiene prioridad.
 */
const BASE_UNITARIO: readonly number[] = [
  18_000_000,
  22_000_000,
  7_500_000,
  350_000,
  12_000_000,
  15_000_000,
  9_000_000,
  850_000,
  6_000_000,
  2_500_000,
  1_200_000,
  450_000,
  4_000_000,
  380_000,
  220_000,
  8_000_000,
  900_000,
  5_500_000,
];

/**
 * Configuración por solicitud y proveedor.
 *
 * `SOL-2026-0039` reproduce el caso base: una oferta con adenda, una con
 * descuento y una por encima del CDP para poder verificar la advertencia de
 * RN-40. `SOL-2026-0042` sirve para el estado de una sola oferta.
 */
const CONFIG_OFERTA: Readonly<
  Record<string, Readonly<Record<string, ConfigOfertaSimulada>>>
> = {
  "SOL-2026-0039": {
    "prov-01": {
      factor: 0.64,
      descuentoPorcentaje: 0,
      validezDias: 30,
      plazoEntregaDias: 35,
      condicionesComerciales:
        "Pago contra entrega y acta de recibo. Incluye capacitación de 8 horas.",
      anexoTecnico: "Ficha_Tecnica_Blade_Sistemas.pdf",
    },
    "prov-02": {
      factor: 0.66,
      descuentoPorcentaje: 0,
      validezDias: 45,
      plazoEntregaDias: 40,
      condicionesComerciales:
        "Pago en dos actas parciales. Sin descuentos adicionales.",
      anexoTecnico: "Anexo_RedesBogota_Adenda.pdf",
    },
    "prov-03": {
      factor: 0.7,
      descuentoPorcentaje: 3,
      validezDias: 30,
      plazoEntregaDias: 45,
      condicionesComerciales:
        "3% de descuento por pronto pago UD y capacitación de 8 horas incluida.",
      anexoTecnico: "Propuesta_Tecnica_Andina.pdf",
    },
    "prov-04": {
      factor: 0.73,
      descuentoPorcentaje: 0,
      validezDias: 60,
      plazoEntregaDias: 30,
      condicionesComerciales:
        "Pago contra entrega. Incluye soporte local en sitio.",
      anexoTecnico: "Oferta_Infraestructura_Andina.zip",
    },
  },
  "SOL-2026-0042": {
    "prov-01": {
      factor: 0.66,
      descuentoPorcentaje: 0,
      validezDias: 30,
      plazoEntregaDias: 40,
      condicionesComerciales:
        "Pago contra entrega. Sin descuentos adicionales.",
      anexoTecnico: "Ficha_Tecnica_Equipos_Computo.pdf",
    },
  },
};

/**
 * Semilla de una oferta del mock.
 *
 * Es determinista: el mismo proveedor y la misma solicitud producen siempre los
 * mismos valores, de modo que S-07 y S-09 muestran la misma cifra.
 */
export function semillaOfertaComparada(
  solicitudId: string,
  proveedor: ProveedorObjetivo,
  indice: number,
  version: string,
): SemillaOfertaComparada {
  const config = CONFIG_OFERTA[solicitudId]?.[proveedor.id];
  const indiceReal = Math.max(1, indiceProveedor(proveedor) || indice + 1);
  const factor = config?.factor ?? 0.72 + ((indiceReal % 4) * 0.03);
  const plazo = config?.plazoEntregaDias ?? 35 + ((indiceReal % 4) * 5);
  const validez = config?.validezDias ?? 30 + ((indiceReal % 3) * 15);
  const anexo =
    config?.anexoTecnico ??
    `Anexo_Tecnico_${proveedor.nombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .slice(0, 32)}.pdf`;

  return {
    factor,
    descuentoPorcentaje: config?.descuentoPorcentaje ?? 0,
    validezDias: validez,
    plazoEntregaDias: plazo,
    condicionesComerciales:
      config?.condicionesComerciales ??
      "Condiciones comerciales por definir en la oferta radicada.",
    anexoTecnico: anexo,
    version,
  };
}

/** Oferta simulada itemizada, con los totales de P-04 ya calculados. */
export interface OfertaSimulada {
  readonly items: readonly ItemRespuestaProveedor[];
  readonly totales: TotalesRespuestaProveedor;
  readonly descuentoPorcentaje: number;
  readonly validezDias: number;
  readonly plazoEntregaDias: number;
  readonly condicionesComerciales: string;
  readonly anexoTecnico: string;
}

/** Construye la oferta itemizada de un proveedor con la semilla indicada. */
export function crearOfertaSimulada(
  solicitud: Pick<SolicitudDetalle, "items">,
  semilla: SemillaOfertaComparada,
): OfertaSimulada {
  const items: ItemRespuestaProveedor[] = solicitud.items.map(
    (item, indice) => ({
      itemId: item.id,
      valorUnitario: Math.round(
        (item.valorUnitarioTecho ??
          BASE_UNITARIO[indice % BASE_UNITARIO.length]) * semilla.factor,
      ),
      iva: "19",
      nota: "",
    }),
  );

  return {
    items,
    totales: calcularTotalesRespuesta(
      solicitud.items,
      items,
      semilla.descuentoPorcentaje,
    ),
    descuentoPorcentaje: semilla.descuentoPorcentaje ?? 0,
    validezDias: semilla.validezDias,
    plazoEntregaDias: semilla.plazoEntregaDias,
    condicionesComerciales: semilla.condicionesComerciales,
    anexoTecnico: semilla.anexoTecnico,
  };
}

/* ── Contratos de la vista ────────────────────────────────────────────────── */

/** Documento exigido al oferente, con su estado dentro de la oferta. */
export interface DocumentoOfertaComparada {
  readonly id: string;
  readonly nombre: string;
  readonly obligatorio: boolean;
  readonly icono: string;
  readonly recibido: boolean;
}

/** Perfil del proveedor frente a la segmentación de la solicitud. */
export interface PerfilOfertaComparada {
  readonly concordantes: number;
  readonly totalActividades: number;
  readonly codigos: string;
  readonly ubicacion: string;
  readonly soporte: string;
}

/** Oferta completa que consume la matriz y el panel lateral. */
export interface OfertaComparada {
  readonly id: string;
  readonly oferente: OferenteTablero;
  readonly proveedor: ProveedorObjetivo;
  readonly identidad: IdentidadProveedor;
  readonly radicado: string;
  readonly fechaEnvio: string;
  readonly version: string;
  readonly modificadaEl?: string;
  readonly oferta: OfertaSimulada;
  readonly total: number;
  readonly subtotal: number;
  readonly descuento: number;
  readonly iva: number;
  readonly valorPresupuesto: number;
  readonly diferencia: number;
  readonly porcentajePresupuesto: number;
  readonly ahorro: number;
  readonly excedePresupuesto: boolean;
  readonly ranking: number | null;
  readonly esMenorTotal: boolean;
  readonly margenMenor: number | null;
  readonly porcentajeMargen: number | null;
  readonly mejorPlazo: boolean;
  readonly seleccionado: boolean;
  readonly documentos: readonly DocumentoOfertaComparada[];
  readonly anexoTecnico: string;
  readonly perfil: PerfilOfertaComparada;
}

/** Tono de una celda; usa los tokens de estado del repo. */
export type TonoCeldaComparativa =
  | "neutro"
  | "exito"
  | "advertencia"
  | "error"
  | "primario";

/** Celda de la matriz: un valor de un proveedor para un criterio. */
export interface CeldaComparativa {
  readonly ofertaId: string;
  readonly texto: string;
  readonly secundario?: string;
  readonly tono?: TonoCeldaComparativa;
  readonly icono?: string;
  readonly esMejor?: boolean;
  readonly etiquetaMejor?: string;
  readonly lista?: readonly { readonly texto: string; readonly ok: boolean }[];
  /** Texto que refuerza el color para lectores de pantalla. */
  readonly ariaTexto?: string;
}

/** Sección visual de la matriz (fila de título). */
export type SeccionComparativa =
  | "economica"
  | "comercial"
  | "documental"
  | "perfil";

export const SECCIONES_COMPARATIVO: readonly {
  readonly id: SeccionComparativa;
  readonly etiqueta: string;
  readonly icono: string;
}[] = [
  {
    id: "economica",
    etiqueta: "1. Valores y condición económica",
    icono: "payments",
  },
  {
    id: "comercial",
    etiqueta: "2. Condiciones comerciales y tiempos",
    icono: "schedule",
  },
  {
    id: "documental",
    etiqueta: "3. Cumplimiento documental y técnico",
    icono: "verified_user",
  },
  {
    id: "perfil",
    etiqueta: "4. Perfil y habilitación de idoneidad",
    icono: "badge",
  },
];

/** Fila de la matriz general. */
export interface FilaComparativa {
  readonly id: string;
  readonly seccion: SeccionComparativa;
  readonly etiqueta: string;
  readonly ayuda?: string;
  readonly valores: readonly CeldaComparativa[];
}

/** Fila de la comparación por ítem. */
export interface ItemComparado {
  readonly item: ItemSolicitud;
  readonly valores: readonly CeldaComparativa[];
}

/** Resultado completo que entrega el servicio a la pantalla. */
export interface ResultadoComparativo {
  readonly ofertas: readonly OfertaComparada[];
  readonly filas: readonly FilaComparativa[];
  readonly items: readonly ItemComparado[];
  readonly valorPresupuesto: number;
  readonly preseleccionadoId: string | null;
  readonly excluidas: number;
  readonly invitadosSinOferta: number;
  readonly anuncio: string;
}

/* ── Cálculo del comparativo ──────────────────────────────────────────────── */

type OfertaCalculada = Omit<
  OfertaComparada,
  | "ranking"
  | "esMenorTotal"
  | "margenMenor"
  | "porcentajeMargen"
  | "mejorPlazo"
>;

interface ContextoComparativo {
  readonly solicitud: SolicitudDetalle;
  readonly valorPresupuesto: number;
}

/** Construye el comparativo de las ofertas indicadas. */
export function construirComparativo(
  solicitud: SolicitudDetalle,
  oferentes: readonly OferenteTablero[],
  preseleccionadoId: string | null,
): ResultadoComparativo {
  const valorPresupuesto = solicitud.presupuesto?.valorCdp ?? 0;
  const contexto: ContextoComparativo = { solicitud, valorPresupuesto };
  const base = oferentes
    .filter((oferente) => !!oferente.respuesta)
    .map((oferente, indice) =>
      construirOferta(contexto, oferente, indice, preseleccionadoId),
    );

  const elegibles = base.filter((oferta) => !oferta.excedePresupuesto);
  const menorTotal =
    elegibles.length > 0
      ? Math.min(...elegibles.map((oferta) => oferta.total))
      : null;
  const menorPlazo =
    elegibles.length > 0
      ? Math.min(...elegibles.map((oferta) => oferta.oferta.plazoEntregaDias))
      : null;

  const ranking = new Map<string, number>();
  let posicion = 0;
  let totalAnterior: number | null = null;
  [...elegibles]
    .sort((a, b) => a.total - b.total)
    .forEach((oferta, indice) => {
      if (totalAnterior === null || oferta.total !== totalAnterior) {
        posicion = indice + 1;
      }
      ranking.set(oferta.id, posicion);
      totalAnterior = oferta.total;
    });

  const ofertas: OfertaComparada[] = base.map((oferta) => {
    const hayComparacion = base.length > 1;
    const esMenorTotal =
      hayComparacion &&
      menorTotal !== null &&
      !oferta.excedePresupuesto &&
      oferta.total === menorTotal;
    const margenMenor =
      !hayComparacion ||
      menorTotal === null ||
      oferta.excedePresupuesto
        ? null
        : oferta.total - menorTotal;
    return {
      ...oferta,
      ranking: hayComparacion ? (ranking.get(oferta.id) ?? null) : null,
      esMenorTotal,
      margenMenor,
      porcentajeMargen:
        margenMenor === null || menorTotal === null || menorTotal <= 0
          ? null
          : (margenMenor / menorTotal) * 100,
      mejorPlazo:
        hayComparacion &&
        menorPlazo !== null &&
        !oferta.excedePresupuesto &&
        oferta.oferta.plazoEntregaDias === menorPlazo,
    };
  });

  const excluidas = ofertas.filter((oferta) => oferta.excedePresupuesto).length;
  const invitadosSinOferta = oferentes.length - ofertas.length;

  return {
    ofertas,
    filas: construirFilas(ofertas),
    items: construirItems(solicitud.items, ofertas),
    valorPresupuesto,
    preseleccionadoId:
      ofertas.find((oferta) => oferta.seleccionado)?.id ?? null,
    excluidas,
    invitadosSinOferta,
    anuncio: anuncioComparativo(ofertas.length, excluidas, valorPresupuesto),
  };
}

/** Resultado vacío para los estados sin ofertas y los atajos del mock. */
export function resultadoComparativoVacio(
  valorPresupuesto: number,
): ResultadoComparativo {
  return {
    ofertas: [],
    filas: [],
    items: [],
    valorPresupuesto,
    preseleccionadoId: null,
    excluidas: 0,
    invitadosSinOferta: 0,
    anuncio: "La solicitud no tiene ofertas radicadas para comparar.",
  };
}

function construirOferta(
  contexto: ContextoComparativo,
  oferente: OferenteTablero,
  indice: number,
  preseleccionadoId: string | null,
): OfertaCalculada {
  const respuesta = oferente.respuesta;
  if (!respuesta) {
    throw new Error("No se puede comparar un oferente sin respuesta radicada.");
  }

  const semilla = semillaOfertaComparada(
    contexto.solicitud.id,
    oferente.proveedor,
    indice,
    respuesta.version,
  );
  const oferta = crearOfertaSimulada(contexto.solicitud, semilla);
  const { total, subtotal, descuento, iva } = oferta.totales;
  const presupuesto = contexto.valorPresupuesto;
  const excedePresupuesto = presupuesto > 0 && total > presupuesto;
  const identidad = identidadProveedor(oferente.proveedor);
  const segmentacion = contexto.solicitud.proveedores?.segmentacion.actividades ?? [];
  const codigosSegmentacion = segmentacion.map((actividad) => actividad.codigo);
  const concordantes = oferente.proveedor.actividades.filter((codigo) =>
    codigosSegmentacion.includes(codigo),
  ).length;

  return {
    id: oferente.proveedor.id,
    oferente,
    proveedor: oferente.proveedor,
    identidad,
    radicado: respuesta.radicado,
    fechaEnvio: respuesta.fechaEnvio,
    version: respuesta.version,
    modificadaEl: respuesta.modificadaEl,
    oferta,
    total,
    subtotal,
    descuento,
    iva,
    valorPresupuesto: presupuesto,
    diferencia: presupuesto > 0 ? total - presupuesto : 0,
    porcentajePresupuesto:
      presupuesto > 0 ? (total / presupuesto) * 100 : 0,
    ahorro: presupuesto > 0 ? presupuesto - total : 0,
    excedePresupuesto,
    seleccionado: preseleccionadoId === oferente.proveedor.id,
    documentos: documentosOferta(
      contexto.solicitud.documentos?.requeridos ?? [],
    ),
    anexoTecnico: oferta.anexoTecnico,
    perfil: {
      concordantes,
      totalActividades: codigosSegmentacion.length,
      codigos: oferente.proveedor.actividades.join(" · "),
      ubicacion: identidad.ubicacion,
      soporte: "Soporte técnico: por definir",
    },
  };
}

function documentosOferta(
  requeridos: readonly DocumentoOferente[],
): readonly DocumentoOfertaComparada[] {
  return requeridos.map((documento) => ({
    id: documento.id,
    nombre: documento.nombre,
    obligatorio: documento.clasificacion === "obligatorio",
    icono: documento.icono,
    // En P-04 la respuesta no se radica sin los obligatorios; el mock los da
    // por recibidos. La validación documental fina pertenece a S-12.
    recibido: true,
  }));
}

function construirFilas(
  ofertas: readonly OfertaComparada[],
): readonly FilaComparativa[] {
  const filas: FilaComparativa[] = [];

  filas.push(
    fila(
      "subtotal",
      "economica",
      "Subtotal ofertado",
      ofertas.map((oferta) =>
        celda(oferta, formatoCop(oferta.subtotal)),
      ),
      "Suma de los ítems antes de descuentos e IVA.",
    ),
  );
  filas.push(
    fila(
      "descuento",
      "economica",
      "Descuento aplicado",
      ofertas.map((oferta) =>
        oferta.descuento > 0
          ? celda(oferta, `-${formatoCop(oferta.descuento)}`, {
              secundario: `${formatoPorcentaje(oferta.oferta.descuentoPorcentaje)}% sobre el subtotal`,
              tono: "exito",
            })
          : celda(oferta, "Sin descuento", { tono: "neutro" }),
      ),
    ),
  );
  filas.push(
    fila(
      "iva",
      "economica",
      "Total IVA (19%)",
      ofertas.map((oferta) => celda(oferta, formatoCop(oferta.iva))),
    ),
  );
  filas.push(
    fila(
      "total",
      "economica",
      "Precio total (con IVA)",
      ofertas.map((oferta) =>
        celda(oferta, formatoCop(oferta.total), {
          esMejor: oferta.esMenorTotal,
          etiquetaMejor: "Menor precio (referencia)",
          secundario: oferta.excedePresupuesto
            ? "No considerada (RN-40)"
            : oferta.ranking
              ? `${oferta.ranking}.º menor precio`
              : undefined,
          tono: oferta.excedePresupuesto
            ? "error"
            : oferta.esMenorTotal
              ? "exito"
              : undefined,
          ariaTexto: oferta.excedePresupuesto
            ? `${oferta.proveedor.nombre}: ${formatoCop(oferta.total)}, fuera del presupuesto`
            : oferta.esMenorTotal
              ? `${oferta.proveedor.nombre}: ${formatoCop(oferta.total)}, menor precio de referencia`
              : `${oferta.proveedor.nombre}: ${formatoCop(oferta.total)}`,
        }),
      ),
      "Base de comparación económica. No equivale a adjudicación.",
    ),
  );
  filas.push(
    fila(
      "diferencia",
      "economica",
      "Diferencia frente al techo presupuestal (CDP)",
      ofertas.map((oferta) => celdaDiferencia(oferta)),
      "El techo sale del presupuesto de la solicitud (S-03).",
    ),
  );
  filas.push(
    fila(
      "margen",
      "economica",
      "Margen frente a la menor oferta",
      ofertas.map((oferta) => celdaMargen(oferta)),
    ),
  );

  filas.push(
    fila(
      "validez",
      "comercial",
      "Validez de la oferta",
      ofertas.map((oferta) =>
        celda(oferta, `${oferta.oferta.validezDias} días calendario`),
      ),
    ),
  );
  filas.push(
    fila(
      "plazo",
      "comercial",
      "Plazo de entrega / ejecución",
      ofertas.map((oferta) =>
        celda(oferta, `${oferta.oferta.plazoEntregaDias} días calendario`, {
          esMejor: oferta.mejorPlazo,
          etiquetaMejor: "Menor plazo",
          tono: oferta.mejorPlazo ? "exito" : undefined,
          ariaTexto: oferta.mejorPlazo
            ? `${oferta.proveedor.nombre}: menor plazo de entrega`
            : undefined,
        }),
      ),
    ),
  );
  filas.push(
    fila(
      "condiciones",
      "comercial",
      "Descuentos y beneficios adicionales",
      ofertas.map((oferta) =>
        celda(oferta, oferta.oferta.condicionesComerciales, {
          secundario:
            oferta.oferta.descuentoPorcentaje > 0
              ? `${formatoPorcentaje(oferta.oferta.descuentoPorcentaje)}% de descuento`
              : "Sin descuentos adicionales",
        }),
      ),
    ),
  );
  filas.push(
    fila(
      "radicacion",
      "comercial",
      "Radicación en plataforma",
      ofertas.map((oferta) =>
        celda(oferta, oferta.fechaEnvio, {
          secundario: `Radicado ${oferta.radicado}`,
        }),
      ),
    ),
  );
  filas.push(
    fila(
      "version",
      "comercial",
      "Versión de cotización",
      ofertas.map((oferta) =>
        celda(oferta, oferta.version, {
          secundario: oferta.modificadaEl
            ? `Modificada ${oferta.modificadaEl}`
            : "Versión original",
          icono: oferta.modificadaEl ? "edit_note" : undefined,
        }),
      ),
      "El historial de versiones no está parametrizado; se muestra la vigente.",
    ),
  );

  filas.push(
    fila(
      "documentos",
      "documental",
      "Documentos obligatorios",
      ofertas.map((oferta) => {
        if (oferta.documentos.length === 0) {
          return celda(oferta, "Sin requisitos documentales", {
            tono: "neutro",
          });
        }
        const recibidos = oferta.documentos.filter(
          (documento) => documento.recibido,
        ).length;
        return celda(
          oferta,
          `${recibidos} de ${oferta.documentos.length} documentos`,
          {
            lista: oferta.documentos.map((documento) => ({
              texto: documento.nombre,
              ok: documento.recibido,
            })),
            tono: recibidos === oferta.documentos.length ? "exito" : "advertencia",
          },
        );
      }),
    ),
  );
  filas.push(
    fila(
      "anexo",
      "documental",
      "Anexos técnicos y fichas",
      ofertas.map((oferta) =>
        celda(oferta, oferta.anexoTecnico, {
          icono: "download",
          secundario: "Anexo técnico radicado",
        }),
      ),
    ),
  );

  filas.push(
    fila(
      "actividades",
      "perfil",
      "Actividades económicas CIIU",
      ofertas.map((oferta) =>
        celda(
          oferta,
          `${oferta.perfil.concordantes} de ${oferta.perfil.totalActividades} concordantes`,
          { secundario: oferta.perfil.codigos },
        ),
      ),
    ),
  );
  filas.push(
    fila(
      "ubicacion",
      "perfil",
      "Ubicación y soporte técnico",
      ofertas.map((oferta) =>
        celda(oferta, oferta.perfil.ubicacion, {
          secundario: oferta.perfil.soporte,
        }),
      ),
      "El SLA y el soporte local no están parametrizados.",
    ),
  );

  return filas;
}

function construirItems(
  items: readonly ItemSolicitud[],
  ofertas: readonly OfertaComparada[],
): readonly ItemComparado[] {
  const hayComparacion = ofertas.length > 1;
  return items.map((item) => {
    const elegibles = ofertas.filter(
      (oferta) => !oferta.excedePresupuesto,
    );
    const valores = elegibles
      .map((oferta) => valorUnitario(oferta, item.id))
      .filter((valor): valor is number => valor !== null);
    const menor = valores.length > 0 ? Math.min(...valores) : null;

    return {
      item,
      valores: ofertas.map((oferta) => {
        const valor = valorUnitario(oferta, item.id);
        if (valor === null) {
          return celda(oferta, "No cotizado", {
            tono: "neutro",
            secundario: "Ítem no ofertado",
          });
        }
        const esMejor =
          hayComparacion &&
          menor !== null &&
          !oferta.excedePresupuesto &&
          valor === menor;
        return celda(oferta, `${formatoCop(valor)} /u`, {
          secundario: `Subtotal: ${formatoCop(valor * item.cantidad)}`,
          esMejor,
          etiquetaMejor: "Menor valor por ítem",
          tono: esMejor ? "exito" : undefined,
          ariaTexto: esMejor
            ? `${oferta.proveedor.nombre}: menor valor por ítem`
            : undefined,
        });
      }),
    };
  });
}

function valorUnitario(
  oferta: OfertaComparada,
  itemId: string,
): number | null {
  return (
    oferta.oferta.items.find((item) => item.itemId === itemId)?.valorUnitario ??
    null
  );
}

function celdaDiferencia(oferta: OfertaComparada): CeldaComparativa {
  if (oferta.valorPresupuesto <= 0) {
    return celda(oferta, "Sin CDP registrado", { tono: "neutro" });
  }
  if (oferta.excedePresupuesto) {
    return celda(
      oferta,
      `+${formatoCop(oferta.diferencia)} (${formatoPorcentaje(oferta.porcentajePresupuesto)}% del techo)`,
      {
        tono: "error",
        icono: "warning",
        secundario: "No se tendrá en cuenta (RN-40)",
        ariaTexto: `${oferta.proveedor.nombre}: oferta superior al presupuesto`,
      },
    );
  }
  return celda(
    oferta,
    `-${formatoCop(Math.abs(oferta.diferencia))} (Ahorro ${formatoPorcentaje(
      Math.abs(oferta.diferencia / oferta.valorPresupuesto) * 100,
    )}%)`,
    {
      tono: "exito",
      icono: "savings",
      ariaTexto: `${oferta.proveedor.nombre}: ahorro frente al presupuesto`,
    },
  );
}

function celdaMargen(oferta: OfertaComparada): CeldaComparativa {
  if (oferta.excedePresupuesto) {
    return celda(oferta, "No considerada (RN-40)", {
      tono: "error",
      secundario: "Supera el techo presupuestal",
    });
  }
  if (oferta.esMenorTotal) {
    return celda(oferta, "Base de referencia ($ 0)", { tono: "primario" });
  }
  if (oferta.margenMenor === null) {
    return celda(oferta, "—", { tono: "neutro" });
  }
  return celda(
    oferta,
    `+${formatoCop(oferta.margenMenor)} (+${formatoPorcentaje(oferta.porcentajeMargen ?? 0)}%)`,
  );
}

function fila(
  id: string,
  seccion: SeccionComparativa,
  etiqueta: string,
  valores: readonly CeldaComparativa[],
  ayuda?: string,
): FilaComparativa {
  return { id, seccion, etiqueta, ayuda, valores };
}

function celda(
  oferta: OfertaComparada,
  texto: string,
  opciones: Omit<CeldaComparativa, "ofertaId" | "texto"> = {},
): CeldaComparativa {
  return { ofertaId: oferta.id, texto, ...opciones };
}

function anuncioComparativo(
  total: number,
  excluidas: number,
  valorPresupuesto: number,
): string {
  const base = `Comparando ${total} ${total === 1 ? "oferta" : "ofertas"}.`;
  const presupuesto =
    valorPresupuesto > 0
      ? ` Techo presupuestal: ${formatoCop(valorPresupuesto)}.`
      : " Sin CDP registrado.";
  const exclusion =
    excluidas > 0
      ? ` ${excluidas} ${excluidas === 1 ? "oferta queda" : "ofertas quedan"} fuera del presupuesto y no se tienen en cuenta.`
      : "";
  return `${base}${presupuesto}${exclusion}`;
}

/** Formato porcentual del módulo (una décima, coma decimal). */
export function formatoPorcentaje(valor: number): string {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(valor);
}
