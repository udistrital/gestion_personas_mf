import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";
import { textoPlanoDesdeHtml } from "../utils/texto-plano";

/** Mínimo provisional para formular preguntas; el mockup solo fija el de respuesta. */
export const MIN_CARACTERES_FORO = 20;
export const MAX_CARACTERES_RESPUESTA_FORO = 2000;

/** Cuenta texto visible del editor y valida su mínimo, ignorando el marcado HTML. */
export function contenidoForoMinimo(minimo: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const texto = textoPlanoDesdeHtml(String(control.value ?? "")).trim();
    return texto.length >= minimo ? null : { contenidoForoCorto: { minimo } };
  };
}

/** Valida el límite sobre el texto visible, no sobre el HTML del editor. */
export function contenidoForoMaximo(maximo: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const texto = textoPlanoDesdeHtml(String(control.value ?? "")).trim();
    return texto.length <= maximo ? null : { contenidoForoLargo: { maximo } };
  };
}
