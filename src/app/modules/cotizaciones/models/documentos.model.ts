/**
 * Modelos del paso 6 del asistente de solicitud (S-02).
 *
 * El paso 6 ("Anexos y documentos requeridos") reúne dos bloques: los anexos
 * técnicos y presupuestales que adjunta el solicitante (sección 1) y la matriz
 * de documentos que debe presentar cada oferente al cotizar (sección 2).
 *
 * Mientras no exista el servicio de carga real, este módulo concentra los
 * contratos, las reglas de validación de archivos y el catálogo simulado que
 * reproduce el mockup aprobado.
 */

import { formatoTamano } from "./items.model";

/* ── Anexos de la solicitud (sección 1) ───────────────────────────────────── */

/** Tamaño máximo admitido por archivo (mockup: "Hasta 25 MB por archivo"). */
export const TAMANO_MAX_MB = 25;

/** Extensiones permitidas para los anexos de la solicitud. */
export const FORMATOS_PERMITIDOS: readonly string[] = [
  "pdf",
  "docx",
  "xlsx",
  "zip",
];

/** Texto legible de los formatos admitidos (mockup). */
export const ETIQUETA_FORMATOS = "PDF, DOCX, XLSX, ZIP";

/** Estado de un anexo dentro de la lista del proceso. */
export type EstadoAnexo = "cargado" | "subiendo" | "error";

/** Variante del error de carga: formato no permitido o exceso de tamaño. */
export type ErrorAnexo = "formato" | "tamano";

/** Anexo vinculado al proceso de cotización. */
export interface AnexoSolicitud {
  readonly id: string;
  /** Nombre del archivo con extensión. */
  readonly nombre: string;
  /** Peso en bytes (0 mientras no se conoce). */
  readonly pesoBytes: number;
  /** Icono Material según el formato. */
  readonly icono: string;
  readonly estado: EstadoAnexo;
  /** Motivo del error cuando `estado === "error"`. */
  readonly error?: ErrorAnexo;
  /** Detalle del error mostrado al usuario. */
  readonly detalle?: string;
  /** Porcentaje de subida (0-100) mientras `estado === "subiendo"`. */
  readonly progreso: number;
  /** Texto ya formateado de la subida ("Subido el 02 Mar 2026, 10:15 AM"). */
  readonly subidoEl: string;
  /** Autor de la carga ("cjgonzalezp"). */
  readonly autor: string;
  /**
   * Línea descriptiva del soporte ("Estudio de conveniencia técnica…").
   *
   * Opcional: el asistente no la necesita, pero el detalle de la solicitud
   * (S-03) la muestra bajo el nombre del archivo.
   */
  readonly descripcion?: string;
}

/* ── Matriz de documentos del oferente (sección 2) ────────────────────────── */

/** Clasificación de un documento exigido al oferente. */
export type ClasificacionDocumento = "obligatorio" | "complementario";

/** Documento que debe presentar el oferente al cotizar. */
export interface DocumentoOferente {
  readonly id: string;
  /** Nombre del requisito ("RUT actualizado (Vigencia 2026)"). */
  readonly nombre: string;
  readonly clasificacion: ClasificacionDocumento;
  /** Instrucción para el oferente. */
  readonly instruccion: string;
  /** true ⇒ requisito bloqueado por norma (no se edita ni se elimina). */
  readonly fijo: boolean;
  /** Icono Material de la fila. */
  readonly icono: string;
  /** Norma que respalda un requisito fijo ("RF-021: Requisito de Oferta"). */
  readonly norma?: string;
  /**
   * true si el documento puede corregirse o complementarse en S-12.
   *
   * Los requisitos bloqueados por el pliego se muestran en S-12, pero no se
   * pueden seleccionar. Si se omite, se asume que el documento es subsanable.
   */
  readonly subsanable?: boolean;
  /**
   * true si el documento afecta el puntaje de la ponderación.
   *
   * Es provisional: la regla institucional sobre qué documentos con puntaje se
   * pueden subsanar todavía no está definida.
   */
  readonly afectaPuntaje?: boolean;
}

/* ── Documentos radicados en una oferta ───────────────────────────────────── */

/** Estado de un documento dentro de la oferta radicada. */
export type EstadoDocumentoOferta =
  | "cargado"
  | "subsanado"
  | "pendiente"
  | "no-subsanado";

/**
 * Documento aportado por el proveedor.
 *
 * Es la proyección de lectura que comparten el detalle del proveedor (S-10) y
 * la consulta de la propia respuesta (P-06). `subsanado` y `pendiente` quedan
 * definidos para cuando exista S-12 (RF-19/RN-08); hoy la semilla solo produce
 * documentos cargados.
 */
export interface DocumentoOfertaRadicado {
  readonly id: string;
  /** Documento de la matriz de S-03; `null` para anexos libres. */
  readonly requisitoId: string | null;
  readonly nombre: string;
  readonly nombreArchivo: string;
  readonly clasificacion: ClasificacionDocumento;
  readonly etiquetaClasificacion: string;
  readonly formato: string;
  readonly icono: string;
  readonly estado: EstadoDocumentoOferta;
  readonly fechaRadicacion: string;
  readonly pesoBytes: number;
  readonly peso: string;
  readonly descripcion: string;
  /** true para el soporte principal de la cotización. */
  readonly principal: boolean;
  /** false cuando el archivo no cumple los formatos de RN-41. */
  readonly formatoValido: boolean;
}

/** Resumen de la matriz del oferente (cabecera de la tarjeta 2). */
export interface ResumenDocumentosOferente {
  readonly total: number;
  readonly obligatorios: number;
  readonly complementarios: number;
}

/** Cuenta los documentos por clasificación. */
export function resumirDocumentosOferente(
  documentos: readonly DocumentoOferente[],
): ResumenDocumentosOferente {
  let obligatorios = 0;
  let complementarios = 0;

  for (const documento of documentos) {
    if (documento.clasificacion === "obligatorio") {
      obligatorios += 1;
    } else {
      complementarios += 1;
    }
  }

  return {
    total: documentos.length,
    obligatorios,
    complementarios,
  };
}

/* ── Validación e iconografía de archivos ─────────────────────────────────── */

/** Extensión en minúsculas de un nombre de archivo ("pdf"). */
export function extensionDe(nombre: string): string {
  return nombre.split(".").pop()?.toLowerCase() ?? "";
}

/** Icono Material según el formato del archivo. */
export function iconoPorFormato(nombre: string): string {
  switch (extensionDe(nombre)) {
    case "pdf":
      return "picture_as_pdf";
    case "doc":
    case "docx":
      return "description";
    case "xls":
    case "xlsx":
      return "table_view";
    default:
      return "insert_drive_file";
  }
}

/** Etiqueta legible del formato de un archivo ("PDF", "DOCX"). */
export function etiquetaFormato(nombre: string): string {
  return extensionDe(nombre).toUpperCase();
}

/** Resultado de validar un archivo antes de vincularlo. */
export interface ResultadoValidacionArchivo {
  readonly error: ErrorAnexo | null;
  readonly detalle: string;
}

/**
 * Valida formato y tamaño de un archivo seleccionado.
 *
 * Reglas del mockup: solo se admiten PDF, DOCX, XLSX y ZIP, y cada documento no
 * puede superar los 25 MB.
 */
export function validarArchivo(archivo: File): ResultadoValidacionArchivo {
  const extension = extensionDe(archivo.name);
  if (!FORMATOS_PERMITIDOS.includes(extension)) {
    return {
      error: "formato",
      detalle:
        "Formato ejecutable no permitido por seguridad institucional (solo se admiten .pdf, .docx, .xlsx, .zip).",
    };
  }

  const maximoBytes = TAMANO_MAX_MB * 1024 * 1024;
  if (archivo.size > maximoBytes) {
    return {
      error: "tamano",
      detalle: `El archivo supera el tamaño máximo permitido de ${TAMANO_MAX_MB} MB por documento (archivo actual: ${formatoTamano(archivo.size)}).`,
    };
  }

  return { error: null, detalle: "" };
}

/** Peso total de los anexos vinculados en formato legible ("5.0 MB cargados"). */
export function formatoPesoTotal(anexos: readonly AnexoSolicitud[]): string {
  // Solo cuentan los archivos efectivamente vinculados: un anexo rechazado
  // (formato inválido o exceso de tamaño) no forma parte del proceso.
  const total = anexos.reduce(
    (acumulado, anexo) =>
      anexo.estado === "error" ? acumulado : acumulado + anexo.pesoBytes,
    0,
  );
  return total > 0 ? `${formatoTamano(total)} cargados` : "0 B cargados";
}

/* ── Consulta de un documento al gestor documental ─────────────────────────── */

/**
 * Resultado de pedir un documento al gestor documental.
 *
 * Hoy no hay almacenamiento real: el servicio simulado devuelve los metadatos
 * del archivo y el aviso de que la operación es simulada. Cuando se conecte el
 * repositorio institucional (Alfresco UD), este mismo punto devolverá la URL
 * real del binario sin cambiar las pantallas.
 */
export interface DocumentoResuelto {
  /** Metadatos del archivo solicitado. */
  readonly documento: AnexoSolicitud;
  /** true cuando el archivo está disponible para verse o descargarse. */
  readonly disponible: boolean;
  /** Mensaje que explica el resultado de la operación. */
  readonly mensaje: string;
}

/* ── Catálogo simulado (reproduce el mockup aprobado) ─────────────────────── */

/** Textos de fecha/hora del mockup (formato fijo para el estado simulado). */
const SUBIDA_ESTUDIOS = "Subido el 02 Mar 2026, 10:15 AM";
const SUBIDA_ANEXO = "Subido el 02 Mar 2026, 10:18 AM";

/** Autor de la carga simulada. */
const AUTOR_MOCK = "cjgonzalezp";

/** Anexos iniciales del proceso (semilla del mockup). */
export const ANEXOS_SEMILLA: readonly AnexoSolicitud[] = [
  {
    id: "anexo-estudios-previos",
    nombre: "Estudios_Previos_Infraestructura_2026.pdf",
    pesoBytes: 2.4 * 1024 * 1024,
    icono: "picture_as_pdf",
    estado: "cargado",
    progreso: 100,
    subidoEl: SUBIDA_ESTUDIOS,
    autor: AUTOR_MOCK,
  },
  {
    id: "anexo-tecnico-servidores",
    nombre: "Anexo_Tecnico_Especificaciones_Servidores.docx",
    pesoBytes: 840 * 1024,
    icono: "description",
    estado: "cargado",
    progreso: 100,
    subidoEl: SUBIDA_ANEXO,
    autor: AUTOR_MOCK,
  },
  {
    id: "anexo-cdp-presupuestal",
    nombre: "CDP_Presupuestal_Firmado_2026.pdf",
    pesoBytes: 1.8 * 1024 * 1024,
    icono: "picture_as_pdf",
    estado: "subiendo",
    progreso: 68,
    subidoEl: "Verificando firma digital institucional...",
    autor: AUTOR_MOCK,
  },
];

/** Errores de carga simulados del mockup (sección 1). */
export const ERRORES_ANEXO_SEMILLA: readonly AnexoSolicitud[] = [
  {
    id: "anexo-manual-exe",
    nombre: "Manual_Procedimientos_Archivo.exe",
    pesoBytes: 0,
    icono: "insert_drive_file",
    estado: "error",
    error: "formato",
    detalle:
      "Formato ejecutable no permitido por seguridad institucional (solo se admiten .pdf, .docx, .xlsx, .zip).",
    progreso: 0,
    subidoEl: "",
    autor: AUTOR_MOCK,
  },
  {
    id: "anexo-video-mp4",
    nombre: "Video_Sustentacion_Sede.mp4",
    pesoBytes: 82.4 * 1024 * 1024,
    icono: "insert_drive_file",
    estado: "error",
    error: "tamano",
    detalle:
      "El archivo supera el tamaño máximo permitido de 25 MB por documento (archivo actual: 82.4 MB).",
    progreso: 0,
    subidoEl: "",
    autor: AUTOR_MOCK,
  },
];

/** Matriz inicial de documentos del oferente (semilla del mockup). */
export const DOCUMENTOS_OFERENTE_SEMILLA: readonly DocumentoOferente[] = [
  {
    id: "doc-cotizacion-propia",
    nombre: "Cotización propia del oferente",
    clasificacion: "obligatorio",
    instruccion:
      "Desglose económico formal firmado por el representante legal o persona natural con vigencia no menor a 30 días calendario.",
    fijo: true,
    icono: "receipt_long",
    norma: "RF-021: Requisito de Oferta",
    // La cotización formal es el soporte principal: no se subsana en S-12.
    subsanable: false,
    afectaPuntaje: false,
  },
  {
    id: "doc-rut",
    nombre: "RUT actualizado (Vigencia 2026)",
    clasificacion: "obligatorio",
    instruccion:
      "Registro Único Tributario con actividad económica coincidente con el código CIIU del requerimiento.",
    fijo: false,
    icono: "badge",
    subsanable: true,
    afectaPuntaje: false,
  },
  {
    id: "doc-certificacion-bancaria",
    nombre: "Certificación bancaria (no mayor a 30 días)",
    clasificacion: "obligatorio",
    instruccion:
      "Certificación de cuenta activa para abono y dispersión de recursos institucionales.",
    fijo: false,
    icono: "account_balance",
    subsanable: true,
    afectaPuntaje: false,
  },
  {
    id: "doc-catalogo-tecnico",
    nombre: "Catálogo técnico o brochures de los bienes ofrecidos",
    clasificacion: "complementario",
    instruccion:
      "Ficha técnica extendida de fábrica para validación de especificaciones por el comité evaluador de la UD.",
    fijo: false,
    icono: "menu_book",
    subsanable: true,
    afectaPuntaje: true,
  },
];

/** Etiqueta legible de una clasificación. */
export function etiquetaClasificacion(
  clasificacion: ClasificacionDocumento,
): string {
  return clasificacion === "obligatorio" ? "Obligatorio" : "Complementario";
}
