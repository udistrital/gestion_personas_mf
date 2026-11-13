import { Injectable } from "@angular/core";
import {
  ACTIVIDADES_CIIU,
  AREAS_SNIES,
  ActividadCiiu,
  NUCLEOS_SNIES,
  OpcionSnies,
  ProveedorObjetivo,
  buscarProveedores,
} from "../models/proveedores.model";

/**
 * Catálogos y cruce de actividades económicas compartidos por S-13.
 *
 * El Paso 5 de S-02 se deja intacto por decisión de producto. Esta capa
 * concentra la misma información (CIIU, áreas y núcleos SNIES, banco de
 * proveedores) para que el selector de S-13 no replique la lógica de carga y
 * pueda migrar a HTTP en un solo punto.
 */
@Injectable({ providedIn: "root" })
export class ActividadesEconomicasService {
  /** Catálogo CIIU (DANE Revisión 4 A.C.). */
  readonly actividadesCiiu: readonly ActividadCiiu[] = ACTIVIDADES_CIIU;

  /** Áreas de conocimiento SNIES. */
  readonly areasSnies: readonly OpcionSnies[] = AREAS_SNIES;

  /** Núcleos básicos de conocimiento SNIES. */
  readonly nucleosSnies: readonly OpcionSnies[] = NUCLEOS_SNIES;

  /**
   * Cruce del banco con las actividades y el núcleo declarado.
   *
   * Para S-13 el SNIES no es restrictivo (RN-03/RN-15): el llamador pasa
   * `aplicaSnies = false` y el cruce se hace solo por CIIU.
   */
  buscarProveedores(
    codigos: readonly string[],
    nucleo: string,
    aplicaSnies: boolean,
  ): readonly ProveedorObjetivo[] {
    return buscarProveedores(codigos, nucleo, aplicaSnies);
  }

  /** Etiqueta de una actividad CIIU por código. */
  etiquetaCiiu(codigo: string): string {
    const actividad = this.actividadesCiiu.find(
      (candidata) => candidata.codigo === codigo,
    );
    return actividad ? `${actividad.codigo} - ${actividad.descripcion}` : codigo;
  }
}
