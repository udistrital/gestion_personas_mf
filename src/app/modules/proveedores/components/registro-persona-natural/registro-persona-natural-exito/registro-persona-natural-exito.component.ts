import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject,
} from "@angular/core";
import { ResumenRadicacionPersonaNatural } from "./registro-persona-natural-exito.model";

/** Mensaje que se muestra mientras el navegador confirma el copiado. */
type EstadoCopia = "radicado" | "hash" | "error" | null;

/**
 * Hoja de estilos mínima que se inyecta en el iframe de impresión. El clon de
 * la constancia conserva las clases y los estilos globales de Ágora, así que
 * solo se neutralizan sombras, botones y el tamaño de página.
 */
const ESTILOS_IMPRESION = `
  @page { size: A4 portrait; margin: 14mm; }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
  }
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .constancia {
    width: 100% !important;
    max-width: none !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    break-inside: avoid;
  }
  .constancia__marca-agua,
  .no-imprimir,
  button {
    display: none !important;
  }
`;

@Component({
  selector: "app-registro-persona-natural-exito",
  templateUrl: "./registro-persona-natural-exito.component.html",
  styleUrls: ["./registro-persona-natural-exito.component.scss"],
  standalone: false,
})
export class RegistroPersonaNaturalExitoComponent implements AfterViewInit {
  @Input({ required: true })
  resumen!: ResumenRadicacionPersonaNatural;

  @Output()
  volverInicio = new EventEmitter<void>();

  @ViewChild("tituloExito")
  private tituloExito?: ElementRef<HTMLElement>;

  @ViewChild("certificado")
  private certificado?: ElementRef<HTMLElement>;

  private readonly destroyRef = inject(DestroyRef);
  private readonly temporizadores = new Set<ReturnType<typeof setTimeout>>();
  private acuseCopiaTimer?: ReturnType<typeof setTimeout>;

  copiado: EstadoCopia = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      for (const temporizador of this.temporizadores) {
        clearTimeout(temporizador);
      }
      this.temporizadores.clear();
    });
  }

  ngAfterViewInit(): void {
    const titulo = this.tituloExito?.nativeElement;
    if (!titulo) {
      return;
    }
    // La constancia reemplaza el formulario: el foco y el scroll deben volver
    // al inicio para que el cambio de vista sea perceptible con lector de
    // pantalla y teclado.
    titulo.focus();
  }

  get documentoTexto(): string {
    const partes = [this.resumen.tipoDocumento, this.resumen.numeroDocumento]
      .map((parte) => parte?.trim())
      .filter((parte): parte is string => Boolean(parte));
    const documento = partes.join(" ");
    return this.resumen.ciudadExpedicion
      ? `${documento} de ${this.resumen.ciudadExpedicion}`
      : documento;
  }

  get fechaRadicacionTexto(): string {
    return new Intl.DateTimeFormat("es-CO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(this.resumen.fechaRadicacion);
  }

  get hashAbreviado(): string {
    const hash = this.resumen.hash;
    if (!hash) {
      return "No disponible";
    }
    return hash.length > 30
      ? `${hash.slice(0, 20)}…${hash.slice(-8)}`
      : hash;
  }

  copiarRadicado(): void {
    void this.copiar(this.resumen.radicado, "radicado");
  }

  copiarHash(): void {
    if (!this.resumen.hash) {
      return;
    }
    void this.copiar(this.resumen.hash, "hash");
  }

  volver(): void {
    this.volverInicio.emit();
  }

  /**
   * Abre el diálogo de impresión del navegador con la constancia aislada. No
   * se genera un PDF en el cliente: "Guardar como PDF" es una opción del
   * propio diálogo y evita agregar dependencias al proyecto.
   */
  imprimir(): void {
    const certificado = this.certificado?.nativeElement;
    if (!certificado) {
      window.print();
      return;
    }

    const clon = certificado.cloneNode(true) as HTMLElement;
    clon.querySelectorAll("button, .no-imprimir").forEach((nodo) => {
      nodo.remove();
    });

    const estilos = Array.from(
      document.querySelectorAll('style, link[rel="stylesheet"]'),
    )
      .map((nodo) => nodo.outerHTML)
      .join("\n");

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);

    const ventana = iframe.contentWindow;
    const documento = iframe.contentDocument;
    if (!ventana || !documento) {
      iframe.remove();
      window.print();
      return;
    }

    documento.open();
    documento.write(
      `<!doctype html><html lang="es"><head><meta charset="utf-8">`
        + `<title>${this.escaparHtml(this.resumen.radicado)}</title>`
        + `${estilos}<style>${ESTILOS_IMPRESION}</style></head>`
        + `<body>${clon.outerHTML}</body></html>`,
    );
    documento.close();

    const lanzarImpresion = () => {
      ventana.focus();
      ventana.print();
    };
    // Algunos navegadores no disparan load después de document.write; el
    // tiempo de espera garantiza que los estilos y la fuente estén aplicados.
    this.programar(() => lanzarImpresion(), 250);
    ventana.addEventListener("afterprint", () => iframe.remove(), {
      once: true,
    });
    this.programar(() => iframe.remove(), 60000);
  }

  private async copiar(texto: string, origen: EstadoCopia): Promise<void> {
    const exitoso = await this.escribirEnPortapapeles(texto);
    this.copiado = exitoso ? origen : "error";

    if (this.acuseCopiaTimer) {
      clearTimeout(this.acuseCopiaTimer);
      this.temporizadores.delete(this.acuseCopiaTimer);
    }
    this.acuseCopiaTimer = setTimeout(() => {
      this.copiado = null;
      this.acuseCopiaTimer = undefined;
    }, 2500);
    this.temporizadores.add(this.acuseCopiaTimer);
  }

  private async escribirEnPortapapeles(texto: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
        return true;
      }
    } catch {
      // Se intenta el mecanismo clásico cuando el contexto no es seguro.
    }
    return this.copiarConSeleccion(texto);
  }

  private copiarConSeleccion(texto: string): boolean {
    try {
      const area = document.createElement("textarea");
      area.value = texto;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const exitoso = document.execCommand("copy");
      area.remove();
      return exitoso;
    } catch {
      return false;
    }
  }

  private programar(accion: () => void, espera: number): void {
    const temporizador = setTimeout(() => {
      this.temporizadores.delete(temporizador);
      accion();
    }, espera);
    this.temporizadores.add(temporizador);
  }

  private escaparHtml(valor: string): string {
    return valor.replace(/[&<>"']/g, (caracter) => {
      switch (caracter) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        default:
          return "&#39;";
      }
    });
  }
}
