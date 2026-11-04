import { Injectable, inject } from "@angular/core";
import { ROLES_SOLICITANTE } from "src/app/core/constants/roles.const";
import type { EstadoSolicitud } from "src/app/core/constants/estados-solicitud.const";
import { RolService } from "src/app/core/services/rol.service";
import type { ModoEdicionSolicitud } from "../models/edicion-solicitud.model";

/** Pasos que se pueden modificar en una edición completa (borrador). */
export const PASOS_EDICION_COMPLETA: readonly number[] = [2, 3, 4, 5, 6];

/**
 * Pasos que se pueden modificar en una modificación restringida.
 *
 * Solo ítems (paso 3) y fecha de cierre (paso 2); el resto queda de solo
 * lectura y se aplica únicamente si el aprobador acepta el cambio (S-08).
 */
export const PASOS_EDICION_RESTRINGIDA: readonly number[] = [2, 3];

/**
 * Reglas de S-04: qué se puede editar según estado y rol.
 *
 * Es la única fuente de verdad de la pantalla de edición. El armazón la usa
 * para bloquear el acceso, el asistente para deshabilitar pasos y campos, y el
 * detalle/listado para decidir la etiqueta y la ruta de la acción.
 */
@Injectable({ providedIn: "root" })
export class ReglasEdicionSolicitudService {
  private readonly rol = inject(RolService);

  /** Modo de edición habilitado para el estado; `null` = bloqueado. */
  modoEdicion(estado: EstadoSolicitud): ModoEdicionSolicitud | null {
    switch (estado) {
      case "borrador":
        return "completa";
      case "enviada-proveedores":
      case "enviada-con-modificaciones":
        return "restringida";
      default:
        return null;
    }
  }

  /** true si el estado y el rol permiten entrar al asistente de edición. */
  puedeEditar(estado: EstadoSolicitud): boolean {
    return this.modoEdicion(estado) !== null && this.puedeEditarPorRol();
  }

  /**
   * true si el rol actual pertenece al área solicitante.
   *
   * Mientras `RolService` no haya terminado de cargar los roles se permite el
   * acceso: el `AuthGuard` del Root ya exige sesión y la carga es asíncrona.
   * Cuando los roles están disponibles, un rol ajeno queda bloqueado.
   */
  puedeEditarPorRol(): boolean {
    if (!this.rol.estaCargado()) {
      return true;
    }
    return ROLES_SOLICITANTE.some((rol) => this.rol.tieneRol(rol));
  }

  /** Pasos modificables del modo indicado. */
  pasosEditables(modo: ModoEdicionSolicitud): readonly number[] {
    return modo === "completa"
      ? PASOS_EDICION_COMPLETA
      : PASOS_EDICION_RESTRINGIDA;
  }

  /** true si el paso admite cambios en el modo indicado. */
  pasoEditable(paso: number, modo: ModoEdicionSolicitud): boolean {
    return this.pasosEditables(modo).includes(paso);
  }

  /** true si el paso se muestra pero no admite cambios. */
  pasoSoloLectura(paso: number, modo: ModoEdicionSolicitud): boolean {
    return !this.pasoEditable(paso, modo);
  }

  /**
   * Campos del paso 2 que se pueden modificar.
   *
   * La modificación restringida solo permite mover la fecha de cierre; la
   * apertura y los textos de planeación quedan congelados.
   *
   * Nota de diseño: el mockup de S-04 muestra "objetivo", "requisitos",
   * "observaciones" y "plazo de ejecución" dentro del paso 2, pero S-02 no los
   * captura (viajan en el cruce de SICAPITAL y en el acta). Para no inventar
   * campos ni duplicar el formulario se mantienen fuera de la edición; el
   * detalle sigue mostrándolos como datos de solo lectura del expediente.
   */
  camposDatosGeneralesEditables(
    modo: ModoEdicionSolicitud,
  ): readonly string[] {
    return modo === "completa"
      ? [
          "dependenciaSolicitante",
          "dependenciaDestino",
          "fechaApertura",
          "fechaCierre",
          "criterioSeleccion",
          "planAccion",
        ]
      : ["fechaCierre"];
  }

  /** true si el campo del paso 2 se puede modificar. */
  campoDatosGeneralesEditable(
    campo: string,
    modo: ModoEdicionSolicitud,
  ): boolean {
    return this.camposDatosGeneralesEditables(modo).includes(campo);
  }

  /** Texto institucional que explica por qué la solicitud está bloqueada. */
  motivoBloqueo(estado: EstadoSolicitud): string {
    switch (estado) {
      case "en-aprobacion":
        return "La solicitud tiene una modificación en aprobación. Podrá editarla cuando la Oficina de Contratación resuelva la solicitud.";
      case "en-evaluacion":
        return "La solicitud ya fue enviada a proveedores y está en evaluación: las condiciones del pliego no admiten cambios.";
      case "adjudicada":
        return "La solicitud fue adjudicada y el expediente quedó cerrado para modificaciones.";
      case "desierta":
        return "La solicitud fue declarada desierta; el proceso no admite modificaciones.";
      case "cancelada":
        return "La solicitud fue cancelada y su expediente quedó archivado.";
      default:
        return "El estado actual de la solicitud no permite modificaciones directas.";
    }
  }
}
