import { MatPaginatorIntl } from "@angular/material/paginator";

/**
 * Textos del `MatPaginator` en español, con el rango del mockup de S-01:
 * "Mostrando 1–7 de 42 solicitudes".
 */
export function paginadorEnEspanol(): MatPaginatorIntl {
  const intl = new MatPaginatorIntl();
  intl.itemsPerPageLabel = "Mostrar:";
  intl.nextPageLabel = "Siguiente página";
  intl.previousPageLabel = "Página anterior";
  intl.firstPageLabel = "Primera página";
  intl.lastPageLabel = "Última página";
  intl.getRangeLabel = (pagina: number, porPagina: number, total: number) => {
    if (total === 0) {
      return "Mostrando 0 de 0 solicitudes";
    }
    const desde = pagina * porPagina + 1;
    const hasta = Math.min((pagina + 1) * porPagina, total);
    return `Mostrando ${desde}–${hasta} de ${total} solicitudes`;
  };
  return intl;
}
