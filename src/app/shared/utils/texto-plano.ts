/**
 * Conversión del HTML del editor enriquecido a texto plano legible.
 *
 * El `editor-enriquecido` guarda en el control del formulario el HTML
 * sanitizado (`<b>`, `<i>`, `<u>`, listas, párrafos). Ese valor es correcto
 * para el área editable, pero al pintarlo como texto plano aparecen las
 * etiquetas; por eso las vistas de solo lectura (por ejemplo, el resumen del
 * paso 7) deben pasar antes por esta función.
 *
 * La conversión usa el parser del navegador (no expresiones regulares), de
 * modo que las entidades HTML (`&amp;`, `&nbsp;`, `&aacute;`, …) se decodifican
 * correctamente y el texto resultante nunca puede inyectar marcado.
 */

/** Etiquetas de bloque que inician un salto de línea en el texto plano. */
const ETIQUETAS_BLOQUE = new Set(["P", "DIV", "UL", "OL"]);

/**
 * Convierte un fragmento HTML en texto plano.
 *
 * Conserva la estructura del documento: los saltos de línea (`<br>`), los
 * párrafos (`<p>`, `<div>`) y los elementos de lista (`<li>`) se traducen a
 * saltos de línea, y cada elemento de lista se marca con un guion. El formato
 * de negrita, cursiva o subrayado se descarta, porque no tiene sentido en un
 * texto plano.
 *
 * @param html Fragmento HTML (o texto plano) a convertir.
 * @returns El texto plano resultante, sin espacios sobrantes al inicio ni al
 * final y sin líneas en blanco consecutivas.
 */
export function textoPlanoDesdeHtml(html: string): string {
  if (!html) {
    return "";
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  const lineas: string[] = [];
  let linea = "";

  /** Cierra la línea en curso si tiene contenido. */
  const cerrarLinea = (): void => {
    // El espacio duro (`&nbsp;`) se normaliza primero; después se colapsan los
    // espacios múltiples que dejan los saltos de línea del editor.
    const limpia = linea
      .replace(/\u00a0/g, " ")
      .trim()
      .replace(/ {2,}/g, " ");
    if (limpia) {
      lineas.push(limpia);
    }
    linea = "";
  };

  /** Recorre el árbol y acumula el texto visible. */
  const recorrer = (nodo: Node): void => {
    for (const hijo of Array.from(nodo.childNodes)) {
      if (hijo.nodeType === Node.TEXT_NODE) {
        linea += hijo.textContent ?? "";
        continue;
      }
      if (hijo.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }

      const elemento = hijo as HTMLElement;
      const etiqueta = elemento.tagName.toUpperCase();

      if (etiqueta === "BR") {
        cerrarLinea();
        continue;
      }
      if (etiqueta === "LI") {
        cerrarLinea();
        // Las listas ordenadas conservan su numeración; las demás usan viñeta.
        const padre = elemento.parentElement;
        const ordenada = padre?.tagName.toUpperCase() === "OL";
        const posicion = ordenada
          ? Array.from(padre?.children ?? []).indexOf(elemento) + 1
          : 0;
        linea += ordenada ? `${posicion}. ` : "• ";
        recorrer(elemento);
        cerrarLinea();
        continue;
      }
      if (ETIQUETAS_BLOQUE.has(etiqueta)) {
        cerrarLinea();
        recorrer(elemento);
        cerrarLinea();
        continue;
      }
      // Etiquetas de formato (`b`, `strong`, `i`, `u`, …): solo se conserva el
      // texto que contienen.
      recorrer(elemento);
    }
  };

  recorrer(doc.body);
  cerrarLinea();

  // El espacio duro (`&nbsp;`) ya se normalizó al cerrar cada línea.
  return lineas.join("\n").trim();
}
