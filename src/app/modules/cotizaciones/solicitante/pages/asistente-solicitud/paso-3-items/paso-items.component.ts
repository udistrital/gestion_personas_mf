import {
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { map } from "rxjs";
import { AlertService } from "src/app/shared/services/alert.service";
import {
  BalanceMasivo,
  CANTIDAD_MINIMA,
  ESTRUCTURAS_PLANTILLA,
  ETIQUETAS_TIPO_NECESIDAD,
  ItemSolicitud,
  MAX_ARCHIVO_MB,
  MIN_CARACTERES_DESCRIPCION_ITEM,
  MIN_CARACTERES_NOMBRE_ITEM,
  ModoRegistro,
  OpcionUnidadMedida,
  PLANTILLA_MASIVA,
  RechazoMasivo,
  TIPOS_ITEM,
  TipoItem,
  formatoCantidad,
  formatoTamano,
  resumirItems,
} from "../../../../models/items.model";
import { OpcionCatalogo, RegistroPersonaJuridicaCatalogosService } from "src/app/modules/proveedores/components/registro-persona-juridica/services/registro-persona-juridica-catalogos.service";
import { RegistroPersonaJuridicaUnspscService } from "src/app/modules/proveedores/components/registro-persona-juridica/services/registro-persona-juridica-unspsc.service";

/** Máximo de ítems que caben en una página de la tabla (mockup: 5). */
const ITEMS_POR_PAGINA = 5;

type TipoBusquedaCatalogo = "CIIU" | "UNSPSC";

/**
 * Validador del paso 3: exige al menos un ítem en el pliego.
 *
 * Es un validador de grupo porque el paso se considera completo cuando la
 * lista de ítems (cargados o diligenciados) deja de estar vacía.
 */
export function alMenosUnItem(): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const lista = grupo.get("registros")?.value;
    return Array.isArray(lista) && lista.length > 0 ? null : { sinItems: true };
  };
}

/**
 * Validador de longitud mínima sobre el texto plano de un control.
 *
 * A diferencia del validador del paso 2 (que limpia etiquetas HTML del editor
 * enriquecido), los campos del paso 3 son texto plano y bastan un trim.
 */
export function minCaracteresTexto(minimo: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const texto = String(control.value ?? "").trim();
    if (!texto) {
      return { required: true };
    }
    return texto.length >= minimo ? null : { minCaracteres: { minimo } };
  };
}

/**
 * Paso 3 del asistente: "Bienes y servicios a cotizar".
 *
 * Replica las tres vistas del mockup aprobado sobre un mismo componente:
 * registro individual, parámetros del cargue masivo y resultado del lote
 * importado. El modo, el formulario individual y la lista de ítems viven en el
 * subgrupo `items` del formulario raíz para que el borrador los conserve.
 */
@Component({
  selector: "paso-items",
  templateUrl: "./paso-items.component.html",
  styleUrls: ["./paso-items.component.scss"],
  standalone: false,
})
export class PasoItemsComponent implements OnInit {
  readonly tipos = TIPOS_ITEM;
  unidades: readonly OpcionUnidadMedida[] = [];
  readonly catalogoBusqueda = signal<readonly {
    tipo: TipoBusquedaCatalogo;
    codigo: string;
    etiqueta: string;
  }[]>([]);
  readonly estructuras = ESTRUCTURAS_PLANTILLA;
  readonly plantillaMasiva = PLANTILLA_MASIVA;
  readonly maxArchivoMb = MAX_ARCHIVO_MB;
  readonly minNombre = MIN_CARACTERES_NOMBRE_ITEM;
  readonly minDescripcion = MIN_CARACTERES_DESCRIPCION_ITEM;
  readonly etiquetasTipo = ETIQUETAS_TIPO_NECESIDAD;
  readonly formatoCantidad = formatoCantidad;

  /** Tarjetas del selector de modo de registro (tarjeta 1). */
  readonly modos = [
    {
      valor: "individual" as ModoRegistro,
      icono: "add_box",
      titulo: "Solo un elemento",
      descripcion:
        "Diligencie el formulario para registrar ítems individualmente con sus especificaciones técnicas y unidades de entrega.",
    },
    {
      valor: "masivo" as ModoRegistro,
      icono: "upload_file",
      titulo: "Cargue masivo de elementos",
      descripcion:
        "Importe múltiples bienes o servicios mediante la plantilla institucional oficial en formato Excel (.xlsx).",
    },
  ];

  /** Subgrupo `items` del `FormGroup` raíz del asistente. */
  @Input({ required: true }) form!: FormGroup;

  /** Notifica al asistente cuando cambia la lista que determina la validez. */
  @Output() itemsCambiados = new EventEmitter<void>();

  @ViewChild("archivo") private entradaArchivo?: ElementRef<HTMLInputElement>;

  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly alerta = inject(AlertService);
  private readonly catalogos = inject(RegistroPersonaJuridicaCatalogosService);
  private readonly unspsc = inject(RegistroPersonaJuridicaUnspscService);

  /** Ítems agregados al pliego (alimenta la tabla consolidada). */
  readonly items = signal<readonly ItemSolicitud[]>([]);

  /** Catálogo asociado a la selección Bien/Servicio. */
  readonly tipoBusqueda = signal<TipoBusquedaCatalogo>("CIIU");

  /** Texto que filtra las opciones del catálogo local. */
  readonly filtroCatalogo = signal("");

  /** Subformulario del ítem individual (creado una sola vez). */
  readonly itemForm: FormGroup;

  /** Nombre del archivo elegido para el cargue masivo. */
  readonly nombreArchivo = signal("");

  /** Tamaño legible del archivo elegido. */
  readonly tamanoArchivo = signal("");

  /** Balance del último cargue procesado (vista de resultado). */
  readonly balance = signal<BalanceMasivo | null>(null);

  /** true mientras se simula el procesamiento del archivo. */
  readonly procesando = signal(false);

  /** Id del ítem que se está editando en el formulario individual. */
  readonly editandoId = signal<string | null>(null);

  /** Página activa de la tabla de ítems aceptados. */
  readonly pagina = signal(1);

  /** Filtro de texto de la tabla de resultados. */
  readonly filtro = signal("");

  /** Dispara el recálculo cuando cambian modo o ítems. */
  private readonly marcas = signal(0);

  constructor() {
    this.itemForm = this.fb.group({
      tipo: ["bien", Validators.required],
      nombre: [
        "",
        [Validators.required, minCaracteresTexto(MIN_CARACTERES_NOMBRE_ITEM)],
      ],
      descripcion: [
        "",
        [
          Validators.required,
          minCaracteresTexto(MIN_CARACTERES_DESCRIPCION_ITEM),
        ],
      ],
      unidad: [null, Validators.required],
      cantidad: [1, [Validators.required, Validators.min(CANTIDAD_MINIMA)]],
    });
  }

  ngOnInit(): void {
    this.catalogos
      .obtenerCatalogoParametro("U_COMERCIO")
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (opciones) => {
          this.unidades = opciones.map((opcion) => ({
            valor: opcion.id,
            etiqueta: opcion.nombre,
            icono: "category",
          }));
          const unidad = this.itemForm.get("unidad");
          if (unidad?.value === null && this.unidades.length > 0) {
            unidad?.setValue(this.valorUnidadPredeterminada(), {
              emitEvent: false,
            });
          }
        },
        error: () => {
          this.alerta.showAlert(
            "Catálogo no disponible",
            "No fue posible cargar las unidades de medida.",
          );
        },
      });

    this.catalogos
      .obtenerCatalogoParametro("CIIU")
      .pipe(
        map((opciones) => opciones.map((opcion) => this.opcionCiiu(opcion))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (opciones) => {
          this.catalogoBusqueda.update((actuales) => [
            ...actuales.filter((opcion) => opcion.tipo !== "CIIU"),
            ...opciones,
          ]);
        },
        error: () => {
          this.alerta.showAlert(
            "Catálogo no disponible",
            "No fue posible cargar el catálogo CIIU.",
          );
        },
      });
    this.unspsc
      .obtenerCatalogo()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (opciones) => {
          this.catalogoBusqueda.update((actuales) => [
            ...actuales.filter((opcion) => opcion.tipo !== "UNSPSC"),
            ...opciones.map((opcion) => ({
              tipo: "UNSPSC" as const,
              codigo: opcion.codigo,
              etiqueta: `${opcion.codigo} - ${opcion.titulo}`,
            })),
          ]);
        },
        error: () => {
          this.alerta.showAlert(
            "Catálogo no disponible",
            "No fue posible cargar el catálogo UNSPSC.",
          );
        },
      });

    // Restaura los ítems que el borrador dejó en el formulario.
    const guardados = this.controlOpcional("registros")?.value;
    if (Array.isArray(guardados) && guardados.length > 0) {
      this.items.set(guardados as readonly ItemSolicitud[]);
    }

    const modo = this.controlOpcional("modo");
    modo?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.alCambiarModo());
  }

  // ── Estado derivado ──────────────────────────────────────────────────────

  /** Modo de registro activo ("individual" o "masivo"). */
  readonly modo = computed<ModoRegistro>(() => {
    this.marcas();
    const valor = String(this.controlOpcional("modo")?.value ?? "individual");
    return valor === "masivo" ? "masivo" : "individual";
  });

  /** Resumen numérico de los ítems agregados. */
  readonly resumen = computed(() => resumirItems(this.items()));

  /** Ítems aceptados que cumplen el filtro de la vista de resultado. */
  readonly itemsFiltrados = computed(() => {
    const termino = this.filtro().trim().toLowerCase();
    if (!termino) {
      return this.items();
    }
    return this.items().filter(
      (item) =>
        item.nombre.toLowerCase().includes(termino) ||
        item.descripcion.toLowerCase().includes(termino),
    );
  });

  /** Opciones locales del catálogo según clasificación y filtro. */
  readonly opcionesCatalogoFiltradas = computed(() => {
    const termino = this.filtroCatalogo().trim().toLowerCase();
    return this.catalogoBusqueda().filter(
      (opcion) =>
        opcion.tipo === this.tipoBusqueda() &&
        (!termino ||
          opcion.codigo.toLowerCase().includes(termino) ||
          opcion.etiqueta.toLowerCase().includes(termino)),
    );
  });

  /** Número total de páginas de la tabla de resultados. */
  readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.itemsFiltrados().length / ITEMS_POR_PAGINA)),
  );

  /** Ítems visibles en la página activa. */
  readonly itemsPagina = computed(() => {
    const inicio = (this.pagina() - 1) * ITEMS_POR_PAGINA;
    return this.itemsFiltrados().slice(inicio, inicio + ITEMS_POR_PAGINA);
  });

  /** Rango visible en la tabla ("1–5 de 18"). */
  readonly rangoPagina = computed(() => {
    const total = this.itemsFiltrados().length;
    if (!total) {
      return { desde: 0, hasta: 0, total };
    }
    const desde = (this.pagina() - 1) * ITEMS_POR_PAGINA + 1;
    return {
      desde,
      hasta: Math.min(desde + ITEMS_POR_PAGINA - 1, total),
      total,
    };
  });

  /** Lista de páginas para el paginador del mockup. */
  readonly paginas = computed(() =>
    Array.from({ length: this.totalPaginas() }, (_, indice) => indice + 1),
  );

  /** Icono de cada tipo de ítem ("devices" / "build"). */
  iconoTipo(tipo: TipoItem): string {
    return tipo === "bien" ? "devices" : "build";
  }

  /** Etiqueta legible del tipo ("Bien" / "Servicio"). */
  etiquetaTipo(tipo: TipoItem): string {
    return tipo === "bien" ? "Bien" : "Servicio";
  }

  /** true si el campo ya recibió interacción y es inválido. */
  mostrarError(nombre: string, form: FormGroup): boolean {
    const control = form.get(nombre);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  /** Actualiza el catálogo según Bien/Servicio y limpia la selección anterior. */
  seleccionarTipoNecesidad(tipo: string): void {
    if (tipo !== "bien" && tipo !== "servicio") {
      return;
    }
    const tipoBusqueda: TipoBusquedaCatalogo =
      tipo === "bien" ? "CIIU" : "UNSPSC";
    if (this.tipoBusqueda() !== tipoBusqueda) {
      this.tipoBusqueda.set(tipoBusqueda);
      this.filtroCatalogo.set("");
      this.itemForm.get("nombre")?.setValue("");
    }
    this.itemForm.patchValue({ tipo });
  }

  /** Refleja el texto que filtra las opciones del catálogo local. */
  alFiltrarCatalogo(evento: Event): void {
    this.filtroCatalogo.set((evento.target as HTMLInputElement).value);
  }

  /** Conserva nombres existentes al editar ítems fuera del catálogo de ejemplo. */
  mostrarNombreActual(): boolean {
    const nombre = String(this.itemForm.get("nombre")?.value ?? "");
    return (
      !!nombre &&
      !this.opcionesCatalogoFiltradas().some(
        (opcion) => opcion.etiqueta === nombre,
      )
    );
  }

  private opcionCiiu(opcion: OpcionCatalogo): {
    tipo: "CIIU";
    codigo: string;
    etiqueta: string;
  } {
    if (!opcion.codigo) {
      throw new Error(
        `El parámetro CIIU con Id ${opcion.id} no contiene CodigoAbreviacion.`,
      );
    }
    return {
      tipo: "CIIU",
      codigo: opcion.codigo,
      etiqueta: `${opcion.codigo} - ${opcion.nombre}`,
    };
  }

  /** true cuando el archivo del cargue ya fue elegido. */
  get hayArchivo(): boolean {
    return !!this.controlOpcional("archivo")?.value;
  }

  // ── Ítem individual ──────────────────────────────────────────────────────

  /** Agrega el ítem diligenciado a la lista, o actualiza el que se edita. */
  agregarItem(form: FormGroup): void {
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }
    const valores = form.getRawValue() as {
      tipo: TipoItem;
      nombre: string;
      descripcion: string;
      unidad: number;
      cantidad: number;
    };
    const unidad = this.unidades.find(
      (opcion) => opcion.valor === valores.unidad,
    );
    if (!unidad) {
      this.alerta.showAlert(
        "Unidad no disponible",
        "Seleccione una unidad de medida disponible en el catálogo.",
      );
      return;
    }
    const id = this.editandoId();

    if (id) {
      this.items.update((lista) =>
        lista.map((item) =>
          item.id === id
            ? {
                ...item,
                tipo: valores.tipo,
                nombre: valores.nombre.trim(),
                descripcion: valores.descripcion.trim(),
                unidad: unidad.etiqueta,
                unidadId: unidad.valor,
                cantidad: Number(valores.cantidad),
              }
            : item,
        ),
      );
    } else {
      this.items.update((lista) => [
        ...lista,
        {
          id: this.nuevoId(),
          tipo: valores.tipo,
          nombre: valores.nombre.trim(),
          descripcion: valores.descripcion.trim(),
          unidad: unidad.etiqueta,
          unidadId: unidad.valor,
          cantidad: Number(valores.cantidad),
        },
      ]);
    }

    this.sincronizarLista();
    this.editandoId.set(null);
    form.reset({
      tipo: valores.tipo,
      nombre: "",
      descripcion: "",
      unidad: this.valorUnidadPredeterminada(),
      cantidad: 1,
    });
    this.pagina.set(1);
  }

  /** Quita un ítem del pliego. */
  eliminarItem(id: string): void {
    this.items.update((lista) => lista.filter((item) => item.id !== id));
    if (this.editandoId() === id) {
      this.cancelarEdicion();
    }
    this.sincronizarLista();
    this.pagina.update((actual) => Math.min(actual, this.totalPaginas()));
  }

  /** Copia un ítem existente al formulario para editarlo en el lugar. */
  editarItem(item: ItemSolicitud): void {
    this.controlOpcional("modo")?.setValue("individual");
    this.editandoId.set(item.id);
    this.tipoBusqueda.set(item.tipo === "bien" ? "CIIU" : "UNSPSC");
    this.filtroCatalogo.set("");
    this.itemForm.reset({
      tipo: item.tipo,
      nombre: item.nombre,
      descripcion: item.descripcion,
      unidad: this.valorUnidadParaEdicion(item),
      cantidad: item.cantidad,
    });
  }

  /** Abandona la edición en curso y limpia el formulario individual. */
  cancelarEdicion(): void {
    this.editandoId.set(null);
    this.itemForm.reset({
      tipo: this.itemForm.value.tipo,
      nombre: "",
      descripcion: "",
      unidad: this.valorUnidadPredeterminada(),
      cantidad: 1,
    });
  }

  private valorUnidadPredeterminada(): number | null {
    return this.unidades[0]?.valor ?? null;
  }

  private valorUnidadParaEdicion(item: ItemSolicitud): number | null {
    if (
      item.unidadId !== undefined &&
      this.unidades.some((unidad) => unidad.valor === item.unidadId)
    ) {
      return item.unidadId;
    }
    return (
      this.unidades.find(
        (unidad) =>
          unidad.etiqueta === item.unidad ||
          String(unidad.valor) === item.unidad,
      )?.valor ?? null
    );
  }

  // ── Cargue masivo ────────────────────────────────────────────────────────

  /** Abre el explorador de archivos del sistema. */
  seleccionarArchivo(): void {
    this.entradaArchivo?.nativeElement.click();
  }

  /** Valida y registra el archivo elegido en el explorador. */
  alElegirArchivo(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = "";
    if (!archivo) {
      return;
    }

    if (!archivo.name.toLowerCase().endsWith(".xlsx")) {
      this.alerta.showAlert(
        "Formato no admitido",
        "Solo se aceptan archivos de Excel con extensión .xlsx.",
      );
      return;
    }

    if (archivo.size > MAX_ARCHIVO_MB * 1024 * 1024) {
      this.alerta.showAlert(
        "Archivo demasiado grande",
        `El archivo supera el tamaño máximo admitido (${MAX_ARCHIVO_MB} MB).`,
      );
      return;
    }

    this.nombreArchivo.set(archivo.name);
    this.tamanoArchivo.set(formatoTamano(archivo.size));
    this.controlOpcional("archivo")?.setValue(archivo.name);
  }

  /** Quita el archivo elegido antes de procesarlo. */
  descartarArchivo(): void {
    this.nombreArchivo.set("");
    this.tamanoArchivo.set("");
    this.controlOpcional("archivo")?.setValue("");
  }

  /**
   * Simula el procesamiento del archivo y genera el balance del lote.
   *
   * Sin backend ni parser real: los ítems aceptados y la lista de rechazos son
   * datos de ejemplo fijos, de modo que el resultado sea estable y verificable
   * en pantalla hasta que exista el servicio de importación.
   */
  cargarItems(): void {
    if (!this.hayArchivo || this.procesando()) {
      return;
    }

    this.procesando.set(true);
    setTimeout(() => {
      const aceptados = this.itemsAceptadosMock();
      const archivo = this.nombreArchivo() || "plantilla_diligenciada.xlsx";
      const nuevo: ItemSolicitud[] = [];

      for (let indice = 0; indice < aceptados.length; indice += 1) {
        nuevo.push({
          id: `${indice + 1}`.padStart(2, "0"),
          tipo: aceptados[indice].tipo,
          nombre: aceptados[indice].nombre,
          descripcion: aceptados[indice].descripcion,
          unidad: aceptados[indice].unidad,
          cantidad: aceptados[indice].cantidad,
          codigoUnspsc: aceptados[indice].codigoUnspsc,
        });
      }

      this.items.set(nuevo);
      this.balance.set({
        lote: "BATCH-UD-2026-0319",
        aceptados: nuevo.length,
        rechazados: this.rechazosMock().length,
        total: nuevo.length + this.rechazosMock().length,
        archivo,
        tamano: this.tamanoArchivo() || "148 KB",
        rechazos: this.rechazosMock(),
      });
      this.controlOpcional("modo")?.setValue("masivo");
      this.controlOpcional("procesado")?.setValue(true);
      this.sincronizarLista();
      this.pagina.set(1);
      this.filtro.set("");
      this.procesando.set(false);
    }, 400);
  }

  /** Vuelve a la vista de parámetros del cargue masivo. */
  cargarArchivoCorregido(): void {
    this.balance.set(null);
    this.descartarArchivo();
    this.controlOpcional("procesado")?.setValue(false);
    this.alerta.showAlert(
      "Cargue corregido",
      "Descargue de nuevo la plantilla, corrija las filas rechazadas y vuelva a cargar el archivo.",
    );
  }

  /** Descarga simulada de la plantilla institucional o del reporte de errores. */
  descargarPlantilla(motivo = "plantilla (.xlsx)"): void {
    this.alerta.showAlert(
      "Descarga no disponible",
      `La descarga del archivo de ${motivo} se habilitará cuando se tenga la plantilla ya definida.`,
    );
  }

  // ── Paginación y filtro ──────────────────────────────────────────────────

  irAPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas()) {
      return;
    }
    this.pagina.set(pagina);
  }

  alFiltrar(evento: Event): void {
    this.filtro.set((evento.target as HTMLInputElement).value);
    this.pagina.set(1);
  }

  /** true cuando ya hay un cargue procesado. */
  get hayResultado(): boolean {
    return !!this.balance();
  }

  /** Porcentaje de registros aceptados sobre el total ("85.7" → "85.7"). */
  porcentajeExito(): string {
    const balance = this.balance();
    if (!balance || !balance.total) {
      return "0";
    }
    return this.formatearPorcentaje(balance.aceptados / balance.total);
  }

  /** Porcentaje de registros rechazados sobre el total ("14.3"). */
  porcentajeRechazo(): string {
    const balance = this.balance();
    if (!balance || !balance.total) {
      return "0";
    }
    return this.formatearPorcentaje(balance.rechazados / balance.total);
  }

  /** Cambia el modo de registro desde las tarjetas del selector. */
  seleccionarModo(modo: ModoRegistro): void {
    this.controlOpcional("modo")?.setValue(modo);
  }

  // ── Apoyo ────────────────────────────────────────────────────────────────

  private alCambiarModo(): void {
    this.marcas.update((n) => n + 1);
    this.controlOpcional("procesado")?.setValue(false);
    this.balance.set(null);
    this.pagina.set(1);
  }

  /**
   * Escribe la lista de ítems en el control `registros` del formulario.
   *
   * El paso 3 guarda los ítems como un arreglo plano (no `FormArray`) para que
   * el borrador pueda restaurarlos con un simple `patchValue`.
   */
  private sincronizarLista(): void {
    this.controlOpcional("registros")?.setValue([...this.items()]);
    this.form.updateValueAndValidity();
    this.itemsCambiados.emit();
  }

  private nuevoId(): string {
    const siguiente = this.items().length + 1;
    return `${siguiente}-${Date.now()}`;
  }

  /** Convierte una fracción (0.857) en porcentaje legible ("85.7"). */
  private formatearPorcentaje(fraccion: number): string {
    const valor = (fraccion * 100).toFixed(1);
    return valor.endsWith(".0") ? valor.slice(0, -2) : valor;
  }

  /** Ítems de ejemplo que devolvería el parser (mock del cargue). */
  private itemsAceptadosMock(): readonly ItemSolicitud[] {
    return [
      {
        id: "1",
        tipo: "bien",
        nombre: "Servidor Rack 2U Enterprise",
        descripcion:
          "Procesador Dual Xeon Silver 4410Y, 128GB RAM ECC, 4x 1.92TB SSD SAS Enterprise, doble fuente redundante certificada 80 Plus Platinum.",
        unidad: "Unidad",
        cantidad: 2,
        codigoUnspsc: "43211501",
      },
      {
        id: "2",
        tipo: "servicio",
        nombre: "Licenciamiento Sistema Virtualización",
        descripcion:
          "Suscripción anual soporte enterprise hypervisor para clúster de cómputo académico, incluye parches y actualizaciones de seguridad.",
        unidad: "Licencia",
        cantidad: 16,
        codigoUnspsc: "43232800",
      },
      {
        id: "3",
        tipo: "bien",
        nombre: "Switch Núcleo 48 Puertos 10GbE",
        descripcion:
          "Capa 3 gestionable, 48x SFP+ 10Gbps, 4x QSFP28 100Gbps uplinks, protocolo OSPF/BGP, fuentes y ventiladores hot-swap.",
        unidad: "Unidad",
        cantidad: 4,
        codigoUnspsc: "43222612",
      },
      {
        id: "4",
        tipo: "servicio",
        nombre: "Instalación y Cableado Estructurado",
        descripcion:
          "Certificación Categoría 6A en puntos de red para laboratorio Sala 304 Aduanilla de Paiba, tendido con canaleta perimetral y marquillado.",
        unidad: "Punto",
        cantidad: 48,
        codigoUnspsc: "72151600",
      },
      {
        id: "5",
        tipo: "bien",
        nombre: "UPS Industrial 20 kVA",
        descripcion:
          "Topología doble conversión, banco de baterías VRLA externo para 30 minutos de autonomía plena carga, tarjeta de monitoreo SNMP.",
        unidad: "Unidad",
        cantidad: 3,
        codigoUnspsc: "39121011",
      },
    ];
  }

  /** Filas rechazadas de ejemplo que devolvería el parser (mock del cargue). */
  private rechazosMock(): readonly RechazoMasivo[] {
    return [
      {
        fila: "Fila 7",
        hoja: "BIEN",
        campo: "Cantidad",
        valor: '"cinco"',
        motivo: "Error de tipo de dato:",
        detalle: "la cantidad debe ser un número entero positivo sin letras.",
        icono: "error",
      },
      {
        fila: "Fila 12",
        hoja: "BIEN",
        campo: "Unidad de medida",
        valor: '"Paquete"',
        motivo: "Valor no homologado:",
        detalle:
          "no coincide con el catálogo de unidades de medida institucional (DANE/UD). Usar UNIDAD o KIT.",
        icono: "warning",
      },
      {
        fila: "Fila 19",
        hoja: "SERVICIO",
        campo: "Descripción",
        valor: "",
        motivo: "Campo obligatorio omitido:",
        detalle:
          "se requiere ficha técnica o alcance descriptivo del servicio solicitado.",
        icono: "priority_high",
      },
    ];
  }

  private controlOpcional(nombre: string): AbstractControl | null {
    return this.form.get(nombre);
  }
}
