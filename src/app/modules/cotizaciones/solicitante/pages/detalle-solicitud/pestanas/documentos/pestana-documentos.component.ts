import { Component, DestroyRef, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AlertService } from "src/app/shared/services/alert.service";
import {
  AnexoSolicitud,
  DocumentoOferente,
  etiquetaClasificacion,
  etiquetaFormato,
  formatoPesoTotal,
  resumirDocumentosOferente,
} from "../../../../../models/documentos.model";
import { DocumentosDetalle } from "../../../../../models/detalle-solicitud.model";
import { SolicitudDetalle } from "../../../../../models/solicitud.model";
import { formatoTamano } from "../../../../../models/items.model";
import { SolicitudesService } from "../../../../../services/solicitudes.service";
import { SolicitudDetalleStore } from "../../solicitud-detalle.store";

/**
 * Pestaña "Documentos" del detalle de una solicitud (S-03).
 *
 * Muestra en solo lectura el expediente documental: los anexos oficiales que
 * adjuntó la institución (sección 1) y la matriz de documentos que debe
 * presentar cada oferente al cotizar (sección 2).
 *
 * Los anexos y la matriz son los mismos del paso 6 del asistente (S-02), de
 * modo que no hay dos definiciones del mismo concepto. La solicitud la entrega
 * el armazón a través de `SolicitudDetalleStore`, así que la pestaña no repite
 * la petición.
 *
 * Ver y descargar pasan por `SolicitudesService.obtenerDocumento`: es el único
 * punto que cambia cuando se conecte el gestor documental institucional. No
 * hay acciones de escritura (cargar, reemplazar ni eliminar): el mockup es de
 * consulta y así lo declara el sello "Solo Lectura Institucional".
 */
@Component({
  selector: "app-pestana-documentos",
  templateUrl: "./pestana-documentos.component.html",
  styleUrls: ["./pestana-documentos.component.scss"],
  standalone: false,
})
export class PestanaDocumentosComponent {
  private readonly store = inject(SolicitudDetalleStore);
  private readonly servicio = inject(SolicitudesService);
  private readonly alerta = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  /** Solicitud resuelta por el armazón. */
  readonly solicitud = computed<SolicitudDetalle | null>(
    () => this.store.solicitud(),
  );

  /** Expediente documental; `null` cuando la solicitud aún no tiene soportes. */
  readonly documentos = computed<DocumentosDetalle | null>(
    () => this.solicitud()?.documentos ?? null,
  );

  /** Anexos oficiales cargados por la institución (sección 1). */
  readonly anexos = computed<readonly AnexoSolicitud[]>(
    () => this.documentos()?.anexos ?? [],
  );

  /** Documentos exigidos al oferente (sección 2). */
  readonly requeridos = computed<readonly DocumentoOferente[]>(
    () => this.documentos()?.requeridos ?? [],
  );

  /** Resumen de la matriz del oferente (obligatorios y complementarios). */
  readonly resumenMatriz = computed(() =>
    resumirDocumentosOferente(this.requeridos()),
  );

  /** Peso total legible de los anexos ("5.2 MB cargados"). */
  readonly pesoTotal = computed(() => formatoPesoTotal(this.anexos()));

  /** Etiqueta legible de la clasificación de un requisito. */
  readonly etiquetaClasificacion = etiquetaClasificacion;

  /** Identificador del anexo cuya consulta está en curso. */
  readonly descargando = signal<string | null>(null);

  /** Mensaje del último error al ver o descargar un archivo. */
  readonly errorDescarga = signal<string>("");

  /** Etiqueta del formato de un archivo ("PDF", "DOCX"). */
  formato(nombre: string): string {
    return etiquetaFormato(nombre);
  }

  /** Peso legible de un anexo ("2.4 MB"). */
  peso(anexo: AnexoSolicitud): string {
    return formatoTamano(anexo.pesoBytes);
  }

  /** Previsualiza un anexo (operación simulada). */
  verDocumento(anexo: AnexoSolicitud): void {
    this.resolverDocumento(anexo, "Previsualización no disponible");
  }

  /** Descarga un anexo (operación simulada). */
  descargarDocumento(anexo: AnexoSolicitud): void {
    this.resolverDocumento(anexo, "Descarga simulada");
  }

  /** Descarga masiva del expediente documental (operación simulada). */
  descargarTodo(): void {
    this.alerta.showAlert(
      "Descarga en preparación",
      "El paquete .zip con los anexos del expediente se generará cuando el gestor documental institucional (Alfresco UD) esté conectado.",
    );
  }

  /** Cierra el aviso de error de la última consulta. */
  cerrarError(): void {
    this.errorDescarga.set("");
  }

  /**
   * Pide el documento al servicio y traduce el resultado a la vista.
   *
   * El servicio simulado devuelve los metadatos del archivo; cuando exista el
   * gestor documental, este mismo punto devolverá el binario real.
   */
  private resolverDocumento(anexo: AnexoSolicitud, titulo: string): void {
    this.errorDescarga.set("");
    this.descargando.set(anexo.id);

    this.servicio
      .obtenerDocumento(anexo.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resuelto) => {
          this.descargando.set(null);
          this.alerta.showAlert(titulo, resuelto.mensaje);
        },
        error: (error: Error) => {
          this.descargando.set(null);
          this.errorDescarga.set(
            error.message ||
              "No fue posible consultar el archivo en el repositorio institucional.",
          );
        },
      });
  }
}
