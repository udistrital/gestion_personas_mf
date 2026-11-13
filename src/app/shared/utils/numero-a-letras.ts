/**
 * Conversión de una cifra en pesos colombianos a su expresión en letras.
 *
 * La constancia de la cotización (P-06) y las tarjetas de valores muestran el
 * total "en letras", igual que los documentos formales de la Universidad. El
 * cálculo es puro y no depende del navegador: no usa `Intl` ni
 * `toLocaleString`, porque la representación hablada del número no existe en
 * la API de internacionalización.
 *
 * Reglas cubiertas:
 * - Apócope del último "uno" antes de `mil` y `millón`/`millones`
 *   ("veintiún mil", "treinta y un millones").
 * - Formas irregulares: `cien`, `quinientos`, `setecientos`, `novecientos`,
 *   `dieciséis`, `veintidós`, `veintitrés`, `veintiséis`.
 * - `mil` y `un millón` no llevan "uno" delante.
 *
 * El importe se redondea al peso, que es la unidad con la que trabaja el
 * módulo (`formatoCop` también redondea).
 */

const UNIDADES: readonly string[] = [
  "",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
  "veinte",
  "veintiuno",
  "veintidós",
  "veintitrés",
  "veinticuatro",
  "veinticinco",
  "veintiséis",
  "veintisiete",
  "veintiocho",
  "veintinueve",
];

const DECENAS: readonly string[] = [
  "",
  "",
  "",
  "treinta",
  "cuarenta",
  "cincuenta",
  "sesenta",
  "setenta",
  "ochenta",
  "noventa",
];

const CENTENAS: readonly string[] = [
  "",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos",
];

/** Convierte un grupo de 0 a 999. */
function convertirGrupo(numero: number): string {
  if (numero === 0) {
    return "";
  }
  if (numero < 30) {
    return UNIDADES[numero];
  }
  if (numero < 100) {
    const decena = Math.floor(numero / 10);
    const unidad = numero % 10;
    return unidad === 0
      ? DECENAS[decena]
      : `${DECENAS[decena]} y ${UNIDADES[unidad]}`;
  }
  if (numero === 100) {
    return "cien";
  }
  const centena = Math.floor(numero / 100);
  const resto = numero % 100;
  return resto === 0
    ? CENTENAS[centena]
    : `${CENTENAS[centena]} ${convertirGrupo(resto)}`;
}

/**
 * Apócope del "uno" final cuando el grupo precede a `mil` o `millón`.
 *
 * "veintiuno" → "veintiún" (con tilde) y "treinta y uno" → "treinta y un".
 */
function apocopar(texto: string): string {
  if (texto === "uno") {
    return "un";
  }
  if (texto.endsWith("veintiuno")) {
    return `${texto.slice(0, -"veintiuno".length)}veintiún`;
  }
  if (texto.endsWith(" uno")) {
    return `${texto.slice(0, -" uno".length)} un`;
  }
  return texto;
}

/** Expresión en letras de un entero no negativo. */
function enteroEnLetras(numero: number): string {
  if (numero === 0) {
    return "cero";
  }

  const partes: string[] = [];
  const milesDeMillones = Math.floor(numero / 1_000_000_000);
  const millones = Math.floor((numero % 1_000_000_000) / 1_000_000);
  const miles = Math.floor((numero % 1_000_000) / 1000);
  const resto = numero % 1000;

  if (milesDeMillones > 0) {
    partes.push(
      milesDeMillones === 1
        ? "mil millones"
        : `${apocopar(convertirGrupo(milesDeMillones))} mil millones`,
    );
  }
  if (millones > 0) {
    partes.push(
      millones === 1
        ? "un millón"
        : `${apocopar(convertirGrupo(millones))} millones`,
    );
  }
  if (miles > 0) {
    partes.push(
      miles === 1 ? "mil" : `${apocopar(convertirGrupo(miles))} mil`,
    );
  }
  if (resto > 0) {
    partes.push(apocopar(convertirGrupo(resto)));
  }

  return partes.join(" ");
}

/**
 * Importe en letras para una constancia en pesos colombianos.
 *
 * @example
 * numeroALetrasCop(213248000);
 * // "Doscientos trece millones doscientos cuarenta y ocho mil pesos m/cte."
 */
export function numeroALetrasCop(valor: number): string {
  const entero = Math.max(0, Math.round(Number.isFinite(valor) ? valor : 0));
  const letras = enteroEnLetras(entero);
  const capitalizado = letras.charAt(0).toUpperCase() + letras.slice(1);
  return `${capitalizado} ${entero === 1 ? "peso" : "pesos"} m/cte.`;
}
