import { Injectable } from "@angular/core";
import {
  DEPENDENCIAS_DESTINO,
  DEPENDENCIAS_SOLICITANTES,
  formatoFechaCorta,
} from "../models/datos-generales.model";
import {
  FORMAS_PAGO,
  MEDIOS_PAGO,
  TIPOS_CONTRATO,
  etiquetaCorta,
} from "../models/contratacion.model";
import { AREAS_SNIES, NUCLEOS_SNIES } from "../models/proveedores.model";
import type {
  CambioCampo,
  DatosEdicionSolicitud,
  GrupoDiferencias,
  ResumenDiferencias,
} from "../models/edicion-solicitud.model";
import type { ItemSolicitud } from "../models/items.model";
import { textoPlanoDesdeHtml } from "src/app/shared/utils/texto-plano";
import { resumirItems } from "../models/items.model";

/** Metadatos fijos de cada grupo de diferencias (una sola definición). */
const GRUPOS: Readonly<
  Record<number, { readonly titulo: string; readonly icono: string }>
> = {
  2: { titulo: "Datos generales y cronograma", icono: "event" },
  3: { titulo: "Bienes y servicios a cotizar", icono: "inventory_2" },
  4: { titulo: "Contratación y forma de pago", icono: "payments" },
  5: { titulo: "Proveedores objetivo", icono: "group" },
  6: { titulo: "Documentos y anexos", icono: "folder_open" },
};

/**
 * Cálculo único de diferencias entre dos versiones de una solicitud (S-04).
 *
 * El paso 7 no conoce ningún campo: recibe los grupos ya armados y los pinta.
 * Cuando se agregue un campo nuevo al asistente basta con extender este
 * servicio (y su modelo), sin duplicar lógica en las pantallas.
 */
@Injectable({ providedIn: "root" })
export class DiferenciasSolicitudService {
  /** Compara la fotografía base con el estado actual del formulario. */
  calcular(
    anterior: DatosEdicionSolicitud,
    nuevo: DatosEdicionSolicitud,
  ): ResumenDiferencias {
    const grupos: GrupoDiferencias[] = [
      this.grupo(2, this.datosGenerales(anterior, nuevo)),
      this.grupo(3, this.items(anterior, nuevo)),
      this.grupo(4, this.contratacion(anterior, nuevo)),
      this.grupo(5, this.proveedores(anterior, nuevo)),
      this.grupo(6, this.documentos(anterior, nuevo)),
    ].filter((grupo) => grupo.cambios.length > 0);

    return {
      grupos,
      total: grupos.reduce((total, grupo) => total + grupo.cambios.length, 0),
    };
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

  private datosGenerales(
    anterior: DatosEdicionSolicitud,
    nuevo: DatosEdicionSolicitud,
  ): readonly CambioCampo[] {
    const antes = anterior.datosGenerales;
    const ahora = nuevo.datosGenerales;
    return this.compactar([
      this.cambio(
        2,
        "Dependencia solicitante",
        etiquetaDependencia(DEPENDENCIAS_SOLICITANTES, antes.dependenciaSolicitante),
        etiquetaDependencia(DEPENDENCIAS_SOLICITANTES, ahora.dependenciaSolicitante),
      ),
      this.cambio(
        2,
        "Dependencia destino",
        etiquetaDependencia(DEPENDENCIAS_DESTINO, antes.dependenciaDestino),
        etiquetaDependencia(DEPENDENCIAS_DESTINO, ahora.dependenciaDestino),
      ),
      this.cambio(
        2,
        "Fecha de apertura",
        this.fecha(antes.fechaApertura),
        this.fecha(ahora.fechaApertura),
      ),
      this.cambio(
        2,
        "Fecha de cierre",
        this.fecha(antes.fechaCierre),
        this.fecha(ahora.fechaCierre),
      ),
      this.cambio(
        2,
        "Criterio de selección",
        this.texto(antes.criterioSeleccion),
        this.texto(ahora.criterioSeleccion),
      ),
      this.cambio(
        2,
        "Plan anual de adquisiciones",
        this.texto(antes.planAccion),
        this.texto(ahora.planAccion),
      ),
    ]);
  }

  private items(
    anterior: DatosEdicionSolicitud,
    nuevo: DatosEdicionSolicitud,
  ): readonly CambioCampo[] {
    const cambios: CambioCampo[] = [];
    const previos = new Map(
      anterior.items.registros.map((item) => [item.id, item]),
    );
    const actuales = new Map(nuevo.items.registros.map((item) => [item.id, item]));

    for (const [id, item] of actuales) {
      const previo = previos.get(id);
      if (!previo) {
        cambios.push({
          paso: 3,
          etiqueta: `Ítem agregado: ${item.nombre}`,
          anterior: "—",
          nuevo: this.describirItem(item),
        });
        continue;
      }
      cambios.push(
        ...this.compactar([
          this.cambio(3, `Ítem ${item.nombre} · Nombre`, previo.nombre, item.nombre),
          this.cambio(
            3,
            `Ítem ${item.nombre} · Descripción técnica`,
            this.texto(previo.descripcion),
            this.texto(item.descripcion),
          ),
          this.cambio(
            3,
            `Ítem ${item.nombre} · Cantidad`,
            String(previo.cantidad),
            String(item.cantidad),
          ),
          this.cambio(
            3,
            `Ítem ${item.nombre} · Unidad de medida`,
            previo.unidad,
            item.unidad,
          )
        ]),
      );
    }

    for (const [id, item] of previos) {
      if (!actuales.has(id)) {
        cambios.push({
          paso: 3,
          etiqueta: `Ítem eliminado: ${item.nombre}`,
          anterior: this.describirItem(item),
          nuevo: "—",
        });
      }
    }

    const resumenAnterior = resumirItems(anterior.items.registros);
    const resumenNuevo = resumirItems(nuevo.items.registros);
    cambios.push(
      ...this.compactar([
        this.cambio(
          3,
          "Total de ítems",
          String(resumenAnterior.totalItems),
          String(resumenNuevo.totalItems),
        ),
        this.cambio(
          3,
          "Plantilla de cargue masivo",
          anterior.items.archivo || "—",
          nuevo.items.archivo || "—",
        ),
      ]),
    );

    return cambios;
  }

  private contratacion(
    anterior: DatosEdicionSolicitud,
    nuevo: DatosEdicionSolicitud,
  ): readonly CambioCampo[] {
    const antes = anterior.contratacion;
    const ahora = nuevo.contratacion;
    return this.compactar([
      this.cambio(
        4,
        "Modalidad de contrato",
        etiquetaCorta(TIPOS_CONTRATO, antes.tipoContrato),
        etiquetaCorta(TIPOS_CONTRATO, ahora.tipoContrato),
      ),
      this.cambio(
        4,
        "Medio de pago",
        etiquetaCorta(MEDIOS_PAGO, antes.medioPago),
        etiquetaCorta(MEDIOS_PAGO, ahora.medioPago),
      ),
      this.cambio(
        4,
        "Forma de pago",
        etiquetaCorta(FORMAS_PAGO, antes.formaPago),
        etiquetaCorta(FORMAS_PAGO, ahora.formaPago),
      ),
      this.cambio(
        4,
        "Cronograma de desembolsos",
        this.parametros(antes.parametros),
        this.parametros(ahora.parametros),
      ),
    ]);
  }

  private proveedores(
    anterior: DatosEdicionSolicitud,
    nuevo: DatosEdicionSolicitud,
  ): readonly CambioCampo[] {
    const antes = anterior.proveedores;
    const ahora = nuevo.proveedores;
    return this.compactar([
      this.cambio(
        5,
        "Actividades económicas (CIIU)",
        this.actividades(antes.actividades),
        this.actividades(ahora.actividades),
      ),
      this.cambio(
        5,
        "Área de conocimiento (SNIES)",
        this.etiquetaSnies(AREAS_SNIES, antes.areaSnies),
        this.etiquetaSnies(AREAS_SNIES, ahora.areaSnies),
      ),
      this.cambio(
        5,
        "Núcleo básico de conocimiento (SNIES)",
        this.etiquetaSnies(NUCLEOS_SNIES, antes.nucleoSnies),
        this.etiquetaSnies(NUCLEOS_SNIES, ahora.nucleoSnies),
      ),
    ]);
  }

  private documentos(
    anterior: DatosEdicionSolicitud,
    nuevo: DatosEdicionSolicitud,
  ): readonly CambioCampo[] {
    return this.compactar([
      this.cambio(
        6,
        "Anexos del expediente",
        this.anexos(anterior),
        this.anexos(nuevo),
      ),
      this.cambio(
        6,
        "Documentos exigidos al oferente",
        this.requeridos(anterior),
        this.requeridos(nuevo),
      ),
    ]);
  }

  private fecha(valor: string): string {
    return valor ? formatoFechaCorta(valor) || valor : "—";
  }

  private texto(html: string): string {
    const texto = textoPlanoDesdeHtml(html).trim();
    return texto || "—";
  }

  private describirItem(item: ItemSolicitud): string {
    return `${item.nombre} (${item.cantidad} ${item.unidad})`;
  }

  private parametros(
    parametros: DatosEdicionSolicitud["contratacion"]["parametros"],
  ): string {
    if (!parametros.length) {
      return "Sin desembolsos";
    }
    return parametros
      .map((parametro) => `${parametro.porcentaje} % · ${parametro.condicion}`)
      .join(" | ");
  }

  private actividades(
    actividades: DatosEdicionSolicitud["proveedores"]["actividades"],
  ): string {
    if (!actividades.length) {
      return "Sin actividades";
    }
    return actividades
      .map((actividad) => `${actividad.codigo} - ${actividad.descripcion}`)
      .join(" | ");
  }

  private etiquetaSnies(
    catalogo: readonly { readonly valor: string; readonly etiqueta: string }[],
    valor: string,
  ): string {
    if (!valor) {
      return "No aplica";
    }
    return catalogo.find((opcion) => opcion.valor === valor)?.etiqueta ?? valor;
  }

  private anexos(datos: DatosEdicionSolicitud): string {
    const nombres = datos.documentos.anexos.map((anexo) => anexo.nombre);
    return nombres.length ? nombres.join(" | ") : "Sin anexos";
  }

  private requeridos(datos: DatosEdicionSolicitud): string {
    const nombres = datos.documentos.requeridos.map(
      (documento) => documento.nombre,
    );
    return nombres.length ? `${nombres.length} documentos: ${nombres.join(" | ")}` : "Sin documentos";
  }
}

/** Etiqueta de una opción de dependencia (valor vacío = sin definir). */
function etiquetaDependencia(
  catalogo: readonly { readonly valor: string; readonly etiqueta: string }[],
  valor: string,
): string {
  if (!valor) {
    return "—";
  }
  return catalogo.find((opcion) => opcion.valor === valor)?.etiqueta ?? valor;
}
