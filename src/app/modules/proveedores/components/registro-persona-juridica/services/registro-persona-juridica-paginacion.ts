import { defer, EMPTY, expand, map, Observable, reduce, throwError } from 'rxjs';

export const TAMANO_PAGINA = 100;
const MAXIMO_PAGINAS = 500;

/**
 * Los CRUD (Beego) responden con un máximo de 10 registros si no se indica `limit`.
 * Recupera todas las páginas avanzando `offset` según los registros realmente recibidos.
 * Termina únicamente con una página vacía. Una página no vacía sin ningún ID nuevo indica
 * que el servicio ignoró `offset` (o devolvió datos repetidos), por lo que se propaga un
 * error en lugar de dar por completo un catálogo que puede estar incompleto.
 * Los IDs repetidos, incluso dentro de una misma página, se descartan.
 */
export function obtenerTodasLasPaginas<T>(
  solicitarPagina: (limit: number, offset: number) => Observable<T[]>,
  idDe: (registro: T) => number,
  recurso: string,
): Observable<T[]> {
  return defer(() => {
    const vistos = new Set<number>();
    const acumulados: T[] = [];
    const pedir = (offset: number, numero: number) =>
      solicitarPagina(TAMANO_PAGINA, offset).pipe(map(pagina => ({ pagina, offset, numero })));

    return pedir(0, 1).pipe(
      expand(({ pagina, offset, numero }) => {
        if (pagina.length === 0) {
          return EMPTY;
        }
        let nuevos = 0;
        for (const registro of pagina) {
          const id = idDe(registro);
          if (!vistos.has(id)) {
            vistos.add(id);
            acumulados.push(registro);
            nuevos++;
          }
        }
        if (nuevos === 0) {
          return throwError(
            () =>
              new Error(
                `La paginación de ${recurso} devolvió registros repetidos en offset ${offset}; el catálogo podría estar incompleto.`,
              ),
          );
        }
        if (numero >= MAXIMO_PAGINAS) {
          return throwError(
            () => new Error(`La paginación de ${recurso} superó ${MAXIMO_PAGINAS} páginas.`),
          );
        }
        return pedir(offset + pagina.length, numero + 1);
      }),
      reduce(() => acumulados, acumulados),
    );
  });
}

// Los CRUD pueden responder [{}] cuando la consulta no tiene resultados.
export function descartarRegistrosVacios(registros: unknown[]): unknown[] {
  return registros.filter(
    registro =>
      !(
        registro
        && typeof registro === 'object'
        && !Array.isArray(registro)
        && Object.keys(registro).length === 0
      ),
  );
}
