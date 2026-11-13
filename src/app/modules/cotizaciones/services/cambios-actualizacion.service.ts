import { Injectable } from "@angular/core";
import { textoPlanoDesdeHtml } from "src/app/shared/utils/texto-plano";
import type {
  CambioCampo,
  CambioItemSolicitud,
  GrupoDiferencias,
  ResumenDiferencias,
  TipoCambioItemSolicitud,
} from "../models/edicion-solicitud.model";
import type { DocumentoOferente } from "../models/documentos.model";
import type { ItemSolicitud } from "../models/items.model";
import type {
  DocumentoRespuestaProveedor,
  ItemRespuestaProveedor,
  RespuestaProveedor,
} from "../models/respuesta-proveedor.model";

/** Metadatos de los grupos de la respuesta (pasos 1 a 4 de P-04/P-05). */
const GRUPOS: Readonly<
  Record<number, { readonly titulo: string; readonly icono: string }>
> = {
  1: { titulo: "Elementos y servicios", icono: "inventory_2" },
  2: { titulo: "Vigencia y descuentos", icono: "event" },
  3: { titulo: "Documentos y soportes", icono: "folder_open" },
  4: { titulo: "Observaciones adicionales", icono: "comment" },
};

/**
 * Cálculo único de los cambios de P-05.
 *
 * La vista no compara campos: pide a este servicio
 * 1. los cambios que hizo el solicitante (delegados en
 *    `DiferenciasSolicitudService`, la misma fuente de S-04/S-08), y
 * 2. los cambios que el proveedor introduce frente a su respuesta anterior.
 *
 * Así los pasos 1 y 4 no duplican reglas y el mockup y el resumen final leen
 * exactamente el mismo resultado.
 */
@Injectable({ providedIn: "root" })
export class CambiosActualizacionService {
  /** Cambios del solicitante ya calculados por la capa de datos. */
  cambiosSolicitud(
    diferencias: ResumenDiferencias | null | undefined,
  ): ResumenDiferencias {
    return diferencias ?? { grupos: [], total: 0 };
  }

  /** Estado de un ítem frente a la versión anterior de la solicitud. */
  estadoItem(
    item: ItemSolicitud,
    itemsAnteriores: readonly ItemSolicitud[],
    itemsVigentes: readonly ItemSolicitud[],
  ): TipoCambioItemSolicitud {
    const anterior = itemsAnteriores.find((previo) => previo.id === item.id);
    if (!anterior) {
      return "agregado";
    }
    const vigente = itemsVigentes.find((actual) => actual.id === item.id);
    if (!vigente) {
      return "eliminado";
    }
    return anterior.nombre !== vigente.nombre ||
      anterior.descripcion !== vigente.descripcion ||
      anterior.cantidad !== vigente.cantidad ||
      anterior.unidad !== vigente.unidad ||
      anterior.tipo !== vigente.tipo
      ? "modificado"
      : "sin-cambios";
  }

  /** Estado de un ítem que ya no pertenece a la solicitud vigente. */
  estadoItemAnterior(item: ItemSolicitud): TipoCambioItemSolicitud {
    return "eliminado";
  }

  /** Comparación por ítem reutilizable por la tabla del paso 1. */
  compararItems(
    anteriores: readonly ItemSolicitud[],
    vigentes: readonly ItemSolicitud[],
  ): readonly CambioItemSolicitud[] {
    const cambios: CambioItemSolicitud[] = [];
    for (const vigente of vigentes) {
      const anterior = anteriores.find((item) => item.id === vigente.id);
      cambios.push({
        itemId: vigente.id,
        tipo: anterior
          ? this.estadoItem(vigente, anteriores, vigentes)
          : "agregado",
        anterior,
        vigente,
      });
    }
    for (const anterior of anteriores) {
      if (!vigentes.some((item) => item.id === anterior.id)) {
        cambios.push({
          itemId: anterior.id,
          tipo: "eliminado",
          anterior,
        });
      }
    }
    return cambios;
  }

  /**
   * Cambios del proveedor frente a su respuesta anterior.
   *
   * Compara la oferta económica, las condiciones, los soportes y la
   * observación. La comparación de nombres y cantidades de ítems no se repite
   * aquí: esos cambios pertenecen a la solicitud y los calcula
   * `DiferenciasSolicitudService`.
   */
  calcularRespuesta(
    anterior: RespuestaProveedor | null,
    actual: RespuestaProveedor | null,
    itemsVigentes: readonly ItemSolicitud[],
    itemsAnteriores: readonly ItemSolicitud[],
    documentos: readonly DocumentoOferente[],
  ): ResumenDiferencias {
    if (!anterior || !actual) {
      return { grupos: [], total: 0 };
    }

    const grupos: GrupoDiferencias[] = [
      this.grupo(1, this.cambiosItems(anterior, actual, itemsVigentes, itemsAnteriores)),
      this.grupo(2, this.cambiosCondiciones(anterior, actual)),
      this.grupo(3, this.cambiosDocumentos(anterior, actual, documentos)),
      this.grupo(4, this.cambiosObservacion(anterior, actual)),
    ].filter((grupo) => grupo.cambios.length > 0);

    return {
      grupos,
      total: grupos.reduce((total, grupo) => total + grupo.cambios.length, 0),
    };
  }

  private cambiosItems(
    anterior: RespuestaProveedor,
    actual: RespuestaProveedor,
    itemsVigentes: readonly ItemSolicitud[],
    itemsAnteriores: readonly ItemSolicitud[],
  ): readonly CambioCampo[] {
    const cambios: CambioCampo[] = [];
    const ofertasAnteriores = this.mapaOfertas(anterior.items);
    const ofertasActuales = this.mapaOfertas(actual.items);

    for (const item of itemsVigentes) {
      const previa = ofertasAnteriores.get(item.id);
      const vigente = ofertasActuales.get(item.id);
      if (!vigente) {
        continue;
      }
      if (!previa) {
        cambios.push({
          paso: 1,
          etiqueta: `Ítem ${item.nombre} · Ítem agregado por la solicitud`,
          anterior: "—",
          nuevo: this.formatoMoneda(vigente.valorUnitario) + " por unidad",
        });
        continue;
      }
      cambios.push(
        ...this.compactar([
          this.cambio(
            1,
            `Ítem ${item.nombre} · Valor unitario`,
            this.formatoMoneda(previa.valorUnitario),
            this.formatoMoneda(vigente.valorUnitario),
          ),
          this.cambio(
            1,
            `Ítem ${item.nombre} · IVA`,
            this.etiquetaIva(previa.iva),
            this.etiquetaIva(vigente.iva),
          ),
          this.cambio(
            1,
            `Ítem ${item.nombre} · Ficha técnica`,
            this.texto(previa.nota),
            this.texto(vigente.nota),
          ),
        ]),
      );
    }

    for (const [id, previa] of ofertasAnteriores) {
      if (itemsVigentes.some((item) => item.id === id)) {
        continue;
      }
      const item = itemsAnteriores.find((candidato) => candidato.id === id);
      cambios.push({
        paso: 1,
        etiqueta: `Ítem ${item?.nombre ?? id} · Suprimido por la solicitud`,
        anterior: this.formatoMoneda(previa.valorUnitario) + " por unidad",
        nuevo: "—",
      });
    }

    return cambios;
  }

  private cambiosCondiciones(
    anterior: RespuestaProveedor,
    actual: RespuestaProveedor,
  ): readonly CambioCampo[] {
    return this.compactar([
      this.cambio(
        2,
        "Fecha de vencimiento de la oferta",
        this.fecha(anterior.fechaVencimiento),
        this.fecha(actual.fechaVencimiento),
      ),
      this.cambio(
        2,
        "Descuento comercial",
        this.porcentaje(anterior.descuentoPorcentaje),
        this.porcentaje(actual.descuentoPorcentaje),
      ),
      this.cambio(
        2,
        "Condiciones comerciales",
        this.texto(anterior.condicionesComerciales),
        this.texto(actual.condicionesComerciales),
      ),
    ]);
  }

  private cambiosDocumentos(
    anterior: RespuestaProveedor,
    actual: RespuestaProveedor,
    documentos: readonly DocumentoOferente[],
  ): readonly CambioCampo[] {
    const previos = this.describirArchivos(anterior.archivos, documentos);
    const actuales = this.describirArchivos(actual.archivos, documentos);
    return this.compactar([
      this.cambio(3, "Modalidad de cotización", anterior.modalidad, actual.modalidad),
      this.cambio(3, "Soportes y documentos", previos, actuales),
    ]);
  }

  private cambiosObservacion(
    anterior: RespuestaProveedor,
    actual: RespuestaProveedor,
  ): readonly CambioCampo[] {
    return this.compactar([
      this.cambio(
        4,
        "Observación adicional",
        this.texto(anterior.notaAdicional),
        this.texto(actual.notaAdicional),
      ),
    ]);
  }

  private mapaOfertas(
    ofertas: readonly ItemRespuestaProveedor[],
  ): ReadonlyMap<string, ItemRespuestaProveedor> {
    return new Map(ofertas.map((oferta) => [oferta.itemId, oferta]));
  }

  private describirArchivos(
    archivos: readonly DocumentoRespuestaProveedor[],
    documentos: readonly DocumentoOferente[],
  ): string {
    if (archivos.length === 0) {
      return "Sin soportes";
    }
    return archivos
      .map((archivo) => {
        const requisito =
          documentos.find((documento) => documento.id === archivo.requisitoId)
            ?.nombre ?? archivo.requisitoId;
        const nombre =
          archivo.archivo?.name ?? archivo.nombre ?? "Documento radicado";
        return `${requisito}: ${nombre}`;
      })
      .join(" | ");
  }

  private grupo(paso: number, cambios: readonly CambioCampo[]): GrupoDiferencias {
    const meta = GRUPOS[paso];
    return { paso, titulo: meta.titulo, icono: meta.icono, cambios };
  }

  private cambio(
    paso: number,
    etiqueta: string,
    anterior: string,
    nuevo: string,
  ): CambioCampo | null {
    return anterior === nuevo ? null : { paso, etiqueta, anterior, nuevo };
  }

  private compactar(
    cambios: readonly (CambioCampo | null)[],
  ): readonly CambioCampo[] {
    return cambios.filter((cambio): cambio is CambioCampo => cambio !== null);
  }

  private texto(html: string): string {
    const texto = textoPlanoDesdeHtml(html).trim();
    return texto || "—";
  }

  private fecha(valor: string): string {
    if (!valor) {
      return "Sin diligenciar";
    }
    const [anio, mes, dia] = valor.split("-");
    return dia && mes && anio ? `${dia}/${mes}/${anio}` : valor;
  }

  private porcentaje(valor: number | null): string {
    return valor === null || valor === undefined ? "Sin descuento" : `${valor} %`;
  }

  private etiquetaIva(valor: string): string {
    if (valor === "excluido" || valor === "exento") {
      return valor === "excluido" ? "Excluido" : "Exento";
    }
    return `${valor} %`;
  }

  private formatoMoneda(valor: number | null): string {
    if (valor === null || valor === undefined) {
      return "Sin valor";
    }
    return valor.toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    });
  }
}
