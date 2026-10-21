import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable, of, timeout } from "rxjs";
import { map, tap } from "rxjs/operators";
import { environment } from "src/environments/environment";
import { Festivo, RespuestaFestivosApi } from "../models/calendario.model";

/** Tiempo máximo de espera de la consulta del calendario. */
const TIEMPO_LIMITE_MS = 8000;

/** Código ISO 3166-1 alpha-2 de Colombia (calendario laboral nacional). */
const CODIGO_PAIS = "CO";

/**
 * Consulta de los días festivos de un calendario laboral.
 *
 * Usa la API pública de Nager.Date, que responde JSON estático con cabeceras
 * CORS permisivas: el microfrontend la consume **directamente desde el
 * navegador**, sin proxy ni backend propio, y por eso el mismo código funciona
 * igual en local y en producción. Los festivos se generan algorítmicamente a
 * partir de la Ley 51 de 1983 (regla Emiliani), así que el dato se actualiza
 * solo y el proyecto no guarda ninguna constante de calendario.
 *
 * Importa la **versión 3** a propósito (`/api/v3/PublicHolidays/{año}/{país}`):
 * es la que traslada al lunes los festivos móviles según la regla Emiliani y
 * la que trae el nombre en español (`localName`). La versión 4 publicada en
 * `nagerholidays.com` devuelve las fechas sin trasladar (Ascensión y Corpus
 * Christi quedarían en su fecha original), por lo que no debe usarse aquí.
 */
@Injectable({ providedIn: "root" })
export class CalendarioService {
  private readonly http = inject(HttpClient);

  /** Festivos ya consultados, por año (una consulta por año y sesión). */
  private readonly cache = new Map<number, readonly Festivo[]>();

  /**
   * Festivos de un año, ordenados por fecha.
   *
   * La respuesta se cachea por año: el asistente la pide una sola vez por
   * vigencia, aunque el solicitante mueva las fechas varias veces.
   */
  obtener(anio: number): Observable<readonly Festivo[]> {
    const cacheados = this.cache.get(anio);
    if (cacheados) {
      return of(cacheados);
    }

    return this.http
      .get<RespuestaFestivosApi[]>(
        `${environment.CALENDARIO_FESTIVOS_URL}/${anio}/${CODIGO_PAIS}`,
      )
      .pipe(
        timeout({ each: TIEMPO_LIMITE_MS }),
        map((respuesta) => this.normalizar(respuesta)),
        tap((festivos) => this.cache.set(anio, festivos)),
      );
  }

  /** Traduce la respuesta de la API al modelo de dominio. */
  private normalizar(respuesta: RespuestaFestivosApi[]): readonly Festivo[] {
    if (!Array.isArray(respuesta)) {
      throw new Error("El calendario de festivos respondió un formato inesperado.");
    }

    return respuesta
      .filter((festivo) => typeof festivo?.date === "string")
      .map((festivo) => ({
        fecha: festivo.date,
        nombre: festivo.localName || festivo.name,
      }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }
}
