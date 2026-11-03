import {
  Component,
  DestroyRef,
  ElementRef,
  Input,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AbstractControl, FormGroup } from "@angular/forms";
import { map } from "rxjs";
import { AlertService } from "src/app/shared/services/alert.service";
import {
  ANEXOS_SEMILLA,
  AnexoSolicitud,
  DOCUMENTOS_OFERENTE_SEMILLA,
  DocumentoOferente,
  ERRORES_ANEXO_SEMILLA,
  ClasificacionDocumento,
  ETIQUETA_FORMATOS,
  TAMANO_MAX_MB,
  etiquetaClasificacion,
  formatoPesoTotal,
  iconoPorFormato,
  resumirDocumentosOferente,
  validarArchivo,
} from "../../../../models/documentos.model";
import { formatoTamano } from "../../../../models/items.model";
import { RegistroPersonaJuridicaCatalogosService } from "src/app/modules/proveedores/components/registro-persona-juridica/services/registro-persona-juridica-catalogos.service";

/** Intervalo de simulación del progreso de subida (ms). */
const LATIDO_SUBIDA = 400;

/** Incremento del progreso por latido (%). */
const PASO_PROGRESO = 8;

/** Icono por defecto de un requisito nuevo de la matriz. */
const ICONO_REQUISITO = "note_add";

interface OpcionClasificacion {
  valor: ClasificacionDocumento;
  etiqueta: string;
}

function clasificacionDeCatalogo(
  codigo: string | undefined,
  nombre: string,
): ClasificacionDocumento | null {
  const clave = `${codigo ?? ""} ${nombre}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (
    clave.includes("complement") ||
    clave.includes("opcional") ||
    clave.includes("nooblig") ||
    clave.includes("norequerid")
  ) {
    return "complementario";
  }
  if (clave.includes("oblig") || clave.includes("requerid")) {
    return "obligatorio";
  }
  return null;
}

/**
 * Paso 6 del asistente: "Anexos y documentos requeridos".
 *
 * Reúne la vista del mockup aprobado en dos bloques: los anexos técnicos y
 * presupuestales que adjunta el solicitante (con los estados cargado,
 * subiendo y error) y la matriz de documentos que debe presentar cada
 * oferente al cotizar. Los anexos y la matriz viven en el subgrupo
 * `documentos` del formulario raíz para que el borrador los conserve.
 */
@Component({
  selector: "paso-documentos",
  templateUrl: "./paso-documentos.component.html",
  styleUrls: ["./paso-documentos.component.scss"],
  standalone: false,
})
export class PasoDocumentosComponent implements OnInit {
  readonly etiquetaFormatos = ETIQUETA_FORMATOS;
  readonly tamanoMaxMb = TAMANO_MAX_MB;
  readonly etiquetaClasificacion = etiquetaClasificacion;
  formatosClasificacion: readonly OpcionClasificacion[] = [];

  /** Subgrupo `documentos` del `FormGroup` raíz del asistente. */
  @Input({ required: true }) form!: FormGroup;

  @ViewChild("entradaArchivos")
  private entradaArchivos?: ElementRef<HTMLInputElement>;

  private readonly destroyRef = inject(DestroyRef);
  private readonly alerta = inject(AlertService);
  private readonly catalogos = inject(RegistroPersonaJuridicaCatalogosService);

  /** Anexos vinculados al proceso (tarjeta 1). */
  readonly anexos = signal<readonly AnexoSolicitud[]>([]);

  /** Matriz de documentos exigidos al oferente (tarjeta 2). */
  readonly documentos = signal<readonly DocumentoOferente[]>([]);

  /** Timers de la subida simulada, por id de anexo. */
  private readonly timers = new Map<string, ReturnType<typeof setInterval>>();

  ngOnInit(): void {
    this.restaurarOSembrar();
    this.catalogos
      .obtenerCatalogoParametro("CLAS_REQ_DOC_COT", "COTIZACIONES")
      .pipe(
        map((opciones) =>
          opciones.map((opcion) => {
            const valor = clasificacionDeCatalogo(opcion.codigo, opcion.nombre);
            if (!valor) {
              throw new Error(
                `No se reconoce la clasificación del parámetro ${opcion.id}.`,
              );
            }
            return { valor, etiqueta: opcion.nombre };
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (opciones) => {
          this.formatosClasificacion = opciones;
        },
        error: () => {
          this.alerta.showAlert(
            "Catálogo no disponible",
            "No fue posible cargar las clasificaciones de documentos.",
          );
        },
      });

    this.destroyRef.onDestroy(() => this.detenerTimers());
  }

  // ── Estado derivado ──────────────────────────────────────────────────────

  /** Cantidad de anexos vinculados (cabecera de la lista). */
  readonly cantidadAnexos = computed(() => this.anexos().length);

  /** Peso total legible de los anexos ("5.0 MB cargados"). */
  readonly pesoTotal = computed(() => formatoPesoTotal(this.anexos()));

  /** Resumen de la matriz del oferente (obligatorios y complementarios). */
  readonly resumenMatriz = computed(() =>
    resumirDocumentosOferente(this.documentos()),
  );

  /** true cuando la lista de anexos todavía está vacía. */
  readonly sinAnexos = computed(() => this.anexos().length === 0);

  // ── Acciones de la tarjeta 1 (anexos) ────────────────────────────────────

  /** Abre el selector de archivos del equipo. */
  seleccionarArchivos(): void {
    this.entradaArchivos?.nativeElement.click();
  }

  /** Procesa los archivos elegidos: los valida y los vincula al proceso. */
  alElegirArchivos(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivos = Array.from(entrada.files ?? []);
    if (archivos.length === 0) {
      return;
    }

    const errores: string[] = [];
    const vinculados: AnexoSolicitud[] = [];

    for (const archivo of archivos) {
      const resultado = validarArchivo(archivo);
      if (resultado.error) {
        errores.push(archivo.name);
        vinculados.push(this.anexoConError(archivo, resultado));
      } else {
        vinculados.push(this.anexoEnSubida(archivo));
      }
    }

    this.anexos.update((lista) => [...lista, ...vinculados]);
    this.sincronizar();
    entrada.value = "";

    for (const anexo of vinculados) {
      if (anexo.estado === "subiendo") {
        this.iniciarSubida(anexo.id);
      }
    }

    if (errores.length > 0) {
      this.alerta.showAlert(
        "Archivos no vinculados",
        `No fue posible cargar ${errores.length} archivo(s) por formato o tamaño. Revise los detalles en la lista.`,
      );
    }
  }

  /** Quita un anexo cargado de la lista. */
  eliminarAnexo(id: string): void {
    this.detenerTimer(id);
    this.anexos.update((lista) => lista.filter((anexo) => anexo.id !== id));
    this.sincronizar();
  }

  /** Descarta un anexo con error o cancela una subida en curso. */
  descartarAnexo(id: string): void {
    this.eliminarAnexo(id);
  }

  /** Reabre el selector para reintentar un archivo rechazado. */
  reintentarAnexo(id: string): void {
    this.eliminarAnexo(id);
    this.seleccionarArchivos();
  }

  /** Previsualiza el archivo en una pestaña nueva (cuando el navegador lo permite). */
  previsualizarAnexo(anexo: AnexoSolicitud): void {
    this.alerta.showAlert(
      "Previsualización no disponible",
      `El archivo "${anexo.nombre}" se indexará con SHA-256 al conectarse el gestor documental institucional.`,
    );
  }

  /** Reemplaza un anexo cargado abriendo de nuevo el selector. */
  reemplazarAnexo(id: string): void {
    this.eliminarAnexo(id);
    this.seleccionarArchivos();
  }

  // ── Acciones de la tarjeta 2 (matriz del oferente) ───────────────────────

  /** Agrega un requisito nuevo y editable a la matriz. */
  agregarRequerido(): void {
    const consecutivo = this.documentos().length + 1;
    const nuevo: DocumentoOferente = {
      id: `doc-nuevo-${consecutivo}-${Date.now()}`,
      nombre: "Nuevo documento requerido",
      clasificacion: "obligatorio",
      instruccion: "Describa la instrucción para el oferente.",
      fijo: false,
      icono: ICONO_REQUISITO,
    };
    this.documentos.update((lista) => [...lista, nuevo]);
    this.sincronizar();
  }

  /** Quita un requisito de la matriz (no aplica a los bloqueados por norma). */
  eliminarRequerido(id: string): void {
    const objetivo = this.documentos().find((documento) => documento.id === id);
    if (!objetivo || objetivo.fijo) {
      return;
    }
    this.documentos.update((lista) =>
      lista.filter((documento) => documento.id !== id),
    );
    this.sincronizar();
  }

  /** Actualiza la clasificación (obligatorio/complementario) de un requisito. */
  cambiarClasificacion(id: string, evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    const clasificacion = this.formatosClasificacion.find(
      (opcion) => opcion.valor === valor,
    )?.valor;
    if (!clasificacion) {
      return;
    }
    this.documentos.update((lista) =>
      lista.map((documento) =>
        documento.id === id ? { ...documento, clasificacion } : documento,
      ),
    );
    this.sincronizar();
  }

  etiquetaClasificacionCatalogo(
    clasificacion: ClasificacionDocumento,
  ): string {
    return (
      this.formatosClasificacion.find((opcion) => opcion.valor === clasificacion)
        ?.etiqueta ?? this.etiquetaClasificacion(clasificacion)
    );
  }

  /** Actualiza el nombre de un requisito editable. */
  cambiarNombre(id: string, evento: Event): void {
    const nombre = (evento.target as HTMLInputElement).value;
    this.actualizarDocumento(id, { nombre });
  }

  /** Actualiza la instrucción para el oferente de un requisito editable. */
  cambiarInstruccion(id: string, evento: Event): void {
    const instruccion = (evento.target as HTMLTextAreaElement).value;
    this.actualizarDocumento(id, { instruccion });
  }

  // ── Apoyo ────────────────────────────────────────────────────────────────

  private actualizarDocumento(
    id: string,
    cambios: Partial<DocumentoOferente>,
  ): void {
    this.documentos.update((lista) =>
      lista.map((documento) =>
        documento.id === id ? { ...documento, ...cambios } : documento,
      ),
    );
    this.sincronizar();
  }

  /** Construye un anexo válido que arranca la subida simulada. */
  private anexoEnSubida(archivo: File): AnexoSolicitud {
    return {
      id: `${archivo.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      nombre: archivo.name,
      pesoBytes: archivo.size,
      icono: iconoPorFormato(archivo.name),
      estado: "subiendo",
      progreso: 0,
      subidoEl: "Verificando firma digital institucional...",
      autor: "sesión actual",
    };
  }

  /** Construye un anexo rechazado con su motivo. */
  private anexoConError(
    archivo: File,
    resultado: { error: "formato" | "tamano" | null; detalle: string },
  ): AnexoSolicitud {
    return {
      id: `${archivo.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      nombre: archivo.name,
      pesoBytes: archivo.size,
      icono: iconoPorFormato(archivo.name),
      estado: "error",
      error: resultado.error ?? "formato",
      detalle: resultado.detalle,
      progreso: 0,
      subidoEl: "",
      autor: "sesión actual",
    };
  }

  /** Avanza el progreso del anexo hasta completar la subida simulada. */
  private iniciarSubida(id: string): void {
    this.detenerTimer(id);
    const timer = setInterval(() => {
      const anexo = this.anexos().find((item) => item.id === id);
      if (!anexo || anexo.estado !== "subiendo") {
        this.detenerTimer(id);
        return;
      }

      const progreso = Math.min(100, anexo.progreso + PASO_PROGRESO);
      if (progreso >= 100) {
        this.anexos.update((lista) =>
          lista.map((item) =>
            item.id === id
              ? {
                  ...item,
                  estado: "cargado",
                  progreso: 100,
                  subidoEl: "Subido el día de hoy",
                  autor: "sesión actual",
                }
              : item,
          ),
        );
        this.detenerTimer(id);
        this.sincronizar();
        return;
      }

      this.anexos.update((lista) =>
        lista.map((item) =>
          item.id === id ? { ...item, progreso } : item,
        ),
      );
      this.sincronizar();
    }, LATIDO_SUBIDA);

    this.timers.set(id, timer);
  }

  private detenerTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearInterval(timer);
      this.timers.delete(id);
    }
  }

  private detenerTimers(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
  }

  // ── Persistencia en el borrador ──────────────────────────────────────────

  /**
   * Restaura lo guardado en el borrador o siembra el catálogo de ejemplo.
   *
   * Se guardan los arreglos completos (no `FormArray`) para que el borrador
   * pueda restaurarlos con un `patchValue` simple.
   */
  private restaurarOSembrar(): void {
    const anexosGuardados = this.controlOpcional("anexos")?.value;
    if (Array.isArray(anexosGuardados) && anexosGuardados.length > 0) {
      this.anexos.set(anexosGuardados as readonly AnexoSolicitud[]);
    } else {
      this.anexos.set([...ANEXOS_SEMILLA, ...ERRORES_ANEXO_SEMILLA]);
    }

    const requeridosGuardados = this.controlOpcional("requeridos")?.value;
    if (Array.isArray(requeridosGuardados) && requeridosGuardados.length > 0) {
      this.documentos.set(requeridosGuardados as readonly DocumentoOferente[]);
    } else {
      this.documentos.set([...DOCUMENTOS_OFERENTE_SEMILLA]);
    }

    this.sincronizar();

    // Las subidas a medias del borrador se retoman al entrar al paso.
    for (const anexo of this.anexos()) {
      if (anexo.estado === "subiendo") {
        this.iniciarSubida(anexo.id);
      }
    }
  }

  /** Escribe anexos y matriz en el formulario raíz (borrador). */
  private sincronizar(): void {
    this.controlOpcional("anexos")?.setValue([...this.anexos()]);
    this.controlOpcional("requeridos")?.setValue([...this.documentos()]);
  }

  private controlOpcional(nombre: string): AbstractControl | null {
    return this.form.get(nombre);
  }
}
