import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { forkJoin, of, Subject } from "rxjs";
import { catchError, map } from "rxjs/operators";
import {
  Festivo,
  FechasFestivas,
  conjuntoFechas,
} from "../models/calendario.model";
import { CalendarioService } from "./calendario.service";

/**
 * Estado de la consulta del calendario de festivos.
 *
 * - `inactivo` — todavía no se ha pedido ningún año.
 * - `cargando` — hay al menos un año en vuelo.
 * - `listo` — todos los años solicitados se consultaron.
 * - `parcial` — algunos años se consultaron y otros fallaron.
 * - `error` — ninguno de los años solicitados se pudo consultar.
 */
export type EstadoCalendario =
  | "inactivo"
  | "cargando"
  | "listo"
  | "parcial"
  | "error";

/** Detalle de lo ocurrido con la consulta del calendario. */
export interface DetalleCalendario {
  /** Estado de la consulta. */
  readonly estado: EstadoCalendario;
  /** Años que se han solicitado. */
  readonly anios: readonly number[];
  /** Años consultados con éxito. */
  readonly aniosConsultados: readonly number[];
  /** Años que no se pudieron consultar. */
  readonly aniosConError: readonly number[];
  /** Mensaje para el usuario; vacío cuando no hay nada que avisar. */
  readonly mensaje: string;
}

/**
 * Estado compartido del calendario de días festivos.
 *
 * Concentra la consulta, la caché por año y el estado que muestran las
 * pantallas. Vive en la raíz del inyector porque lo consumen el paso 2 (que
 * calcula el cronograma), el asistente (que revalida la regla al llegar los
 * datos) y el paso 7 (que muestra el plazo en la revisión).
 *
 * Si la consulta falla, **no se bloquea el trámite**: el conteo de días hábiles
 * sigue contando sólo fines de semana y las pantallas avisan al solicitante
 * para que revise los festivos al elegir la fecha de cierre.
 */
@Injectable({ providedIn: "root" })
export class CalendarioFestivosService {
  private readonly calendario = inject(CalendarioService);

  /** Contexto de destrucción: cancela las consultas al caer la aplicación. */
  private readonly destroyRef = inject(DestroyRef);

  /** Festivos cargados (con nombre, para mostrarlos). */
  private readonly lista = signal<readonly Festivo[]>([]);

  /** Fechas festivas cargadas (para el cálculo de días hábiles). */
  private readonly fechas = signal<FechasFestivas>(new Set<string>());

  /** Años consultados con éxito. */
  private readonly consultados = signal<readonly number[]>([]);

  /** Años que fallaron y se pueden reintentar. */
  private readonly conError = signal<readonly number[]>([]);

  /** Años con una consulta en vuelo. */
  private readonly enVuelo = new Set<number>();

  /** Detalle de la última consulta (estado, años y mensaje). */
  private readonly detalleInterno = signal<DetalleCalendario>({
    estado: "inactivo",
    anios: [],
    aniosConsultados: [],
    aniosConError: [],
    mensaje: "",
  });

  /**
   * Avisa cuando el conjunto de festivos cambió.
   *
   * Se emite desde la respuesta de la consulta (fuera del ciclo de detección
   * de cambios), para que quien lo escuche pueda reevaluar reglas de negocio
   * sin escribir estado durante la comprobación de la vista.
   */
  private readonly cambios = new Subject<void>();

  /** Emite cada vez que se cargan o se reintentan los festivos. */
  readonly cambios$ = this.cambios.asObservable();

  /** Festivos cargados, con su nombre oficial. */
  readonly festivos = this.lista.asReadonly();

  /** Fechas festivas cargadas (ISO-8601). */
  readonly fechasFestivas = this.fechas.asReadonly();

  /** Detalle de la consulta (estado, años y mensaje). */
  readonly detalle = this.detalleInterno.asReadonly();

  /**
   * true cuando el conteo de días hábiles se hizo sin todos los festivos.
   *
   * Las pantallas avisan en este caso: el número es correcto, pero no tiene en
   * cuenta los días festivos que no se pudieron consultar.
   */
  readonly degradado = computed(
    () =>
      this.detalle().estado === "error" ||
      this.detalle().estado === "parcial",
  );

  /**
   * Carga los festivos de los años indicados.
   *
   * Los años ya consultados no se vuelven a pedir (caché por año) y los que
   * fallaron no se reintentan solos: su reintento es explícito, para no
   * castigar a la API con consultas repetidas.
   */
  cargar(anios: readonly number[]): void {
    const unicos = [...new Set(anios)].sort((a, b) => a - b);
    const pendientes = unicos.filter(
      (anio) =>
        !this.consultados().includes(anio) &&
        !this.conError().includes(anio) &&
        !this.enVuelo.has(anio),
    );

    if (pendientes.length === 0) {
      this.actualizarDetalle();
      return;
    }

    pendientes.forEach((anio) => this.enVuelo.add(anio));
    this.actualizarDetalle();

    forkJoin(
      pendientes.map((anio) =>
        this.calendario.obtener(anio).pipe(
          map((festivos) => ({ anio, consultationOk: true, festivos })),
          catchError(() =>
            of({
              anio,
              consultationOk: false,
              festivos: [] as readonly Festivo[],
            }),
          ),
        ),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultados) => {
        pendientes.forEach((anio) => this.enVuelo.delete(anio));

        const cargados = resultados.filter(
          (resultado) => resultado.consultationOk,
        );
        const fallidos = resultados
          .filter((resultado) => !resultado.consultationOk)
          .map((resultado) => resultado.anio);

        this.consultados.update((anios) => [
          ...new Set([...anios, ...cargados.map((resultado) => resultado.anio)]),
        ]);
        this.conError.update((anios) => [
          ...new Set([...anios, ...fallidos]),
        ]);

        const lista = [
          ...this.lista(),
          ...cargados.flatMap((resultado) => resultado.festivos),
        ].sort((a, b) => a.fecha.localeCompare(b.fecha));

        this.lista.set(lista);
        this.fechas.set(conjuntoFechas(lista));
        this.actualizarDetalle();
        this.cambios.next();
      });
  }

  /** Vuelve a consultar los años que fallaron. */
  reintentar(): void {
    const fallidos = this.conError();
    if (fallidos.length === 0) {
      return;
    }

    this.conError.set([]);
    this.cargar(fallidos);
  }

  /** Recalcula el estado global a partir de los años cargados y fallidos. */
  private actualizarDetalle(): void {
    const anios = [
      ...new Set([...this.consultados(), ...this.conError()]),
    ].sort((a, b) => a - b);
    const consultados = this.consultados();
    const conError = this.conError();

    let estado: EstadoCalendario = "inactivo";
    let mensaje = "";

    if (this.enVuelo.size > 0) {
      estado = "cargando";
    } else if (conError.length > 0 && consultados.length === 0) {
      estado = "error";
      mensaje =
        "No se pudo consultar el calendario de días festivos. El conteo sólo descuenta sábados y domingos.";
    } else if (conError.length > 0) {
      estado = "parcial";
      mensaje = `No se pudo consultar el calendario de festivos de ${this.textoAnios(
        conError,
      )}. El conteo sólo descuenta sábados y domingos para esos años.`;
    } else if (consultados.length > 0) {
      estado = "listo";
    }

    this.detalleInterno.set({
      estado,
      anios,
      aniosConsultados: consultados,
      aniosConError: conError,
      mensaje,
    });
  }

  /** Enumera años en texto ("2026" o "2026 y 2027"). */
  private textoAnios(anios: readonly number[]): string {
    return anios.join(" y ");
  }
}
