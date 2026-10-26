import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";
import { textoPlanoDesdeHtml } from "../utils/texto-plano";

/** Mínimo aprobado por los mockups de justificación de S-04 y S-05. */
export const MIN_CARACTERES_JUSTIFICACION = 20;

/** Cuenta texto visible y omite etiquetas de los editores enriquecidos. */
export function justificacionMinima(minimo: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const texto = textoPlanoDesdeHtml(String(control.value ?? "")).trim();
    return texto.length >= minimo ? null : { justificacionCorta: { minimo } };
  };
}
