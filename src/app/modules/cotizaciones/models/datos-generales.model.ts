/**
 * Modelos del paso 2 del asistente de solicitud (S-02).
 *
 * Separa lo que SICAPITAL entrega ya diligenciado (responsable y
 * características: solo lectura en pantalla) de lo que define el solicitante
 * (dependencias, cronograma, criterio de selección y plan de acción).
 */

/** Funcionario que radica la solicitud (tarjeta 1, solo lectura). */
export interface ResponsableSolicitud {
  readonly nombres: string;
  readonly apellidos: string;
  /** Documento con tipo ("C.C. 1.018.452.981"). */
  readonly identificacion: string;
  /** Etiqueta de la unidad ejecutora ("1 - Rectoría"). */
  readonly unidadEjecutora: string;
  /** Ordenador del gasto con código ("ORD-0042 - Dr. … (Rector)"). */
  readonly ordenadorGasto: string;
}

/** Condiciones precargadas de SICAPITAL (tarjeta 3, solo lectura). */
export interface CaracteristicasSolicitud {
  readonly objetivo: string;
  readonly requisitos: string;
  readonly observaciones: string;
  readonly plazoEjecucion: string;
}

/** Catálogos de dependencias de la tarjeta 1. */
export interface OpcionDependencia {
  readonly valor: string;
  readonly etiqueta: string;
}

export const DEPENDENCIAS_SOLICITANTES: readonly OpcionDependencia[] = [
  {
    valor: "DIRTEI",
    etiqueta: "División de Recursos Tecnológicos e Informáticos (DIRTEI)",
  },
  { valor: "DIB", etiqueta: "División de Bibliotecas" },
  { valor: "LAB", etiqueta: "Laboratorios Integrados de Ingeniería" },
  {
    valor: "CIDC",
    etiqueta: "Centro de Investigaciones y Desarrollo Científico (CIDC)",
  },
];

export const DEPENDENCIAS_DESTINO: readonly OpcionDependencia[] = [
  { valor: "VAF", etiqueta: "Vicerrectoría Administrativa y Financiera" },
  { valor: "VAC", etiqueta: "Vicerrectoría Académica" },
  { valor: "SEC", etiqueta: "Secretaría General" },
  { valor: "OAP", etiqueta: "Oficina Asesora de Planeación" },
];

/**
 * Hito de la línea de tiempo proyectada (tarjeta 2).
 *
 * Los hitos son estructurales: el mockup no ofrece campos para sus fechas, así
 * que solo "Publicación" y "Cierre" se alimentan del cronograma; los demás
 * quedan marcados como "Por definir".
 */
export interface HitoCronograma {
  /** Número visible del hito ("01"). */
  readonly numero: string;
  readonly nombre: string;
  /** true ⇒ el hito está definido (círculo relleno); false ⇒ por definir. */
  readonly definido: boolean;
  /** Categoría del hito ("Apertura", "Recepción", "Adjudicación"). */
  readonly categoria: string;
  /** Origen de la fecha: el cronograma o un paso posterior del proceso. */
  readonly origen: "apertura" | "cierre" | "proceso";
}

export const HITOS_CRONOGRAMA: readonly HitoCronograma[] = [
  {
    numero: "01",
    nombre: "Publicación",
    definido: true,
    categoria: "Apertura",
    origen: "apertura",
  },
  {
    numero: "02",
    nombre: "Observaciones",
    definido: false,
    categoria: "Por definir",
    origen: "proceso",
  },
  {
    numero: "03",
    nombre: "Cierre",
    definido: true,
    categoria: "Recepción",
    origen: "cierre",
  },
  {
    numero: "04",
    nombre: "Evaluación",
    definido: false,
    categoria: "Por definir",
    origen: "proceso",
  },
  {
    numero: "05",
    nombre: "Orden de compra",
    definido: false,
    categoria: "Por definir",
    origen: "proceso",
  },
];

/** Mínimos de caracteres de los editores enriquecidos (tarjetas 3 y 4). */
export const MIN_CARACTERES_CRITERIO = 15;
export const MIN_CARACTERES_PLAN = 20;

/** Días hábiles mínimos entre la apertura y el cierre del proceso. */
export const DIAS_HABILES_MINIMOS = 3;

const DIAS_SEMANA = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** Convierte "2026-03-02" en un `Date` local (sin desfase de zona horaria). */
export function parsearFecha(valor: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return null;
  }
  const [anio, mes, dia] = valor.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  return isNaN(fecha.getTime()) ? null : fecha;
}

/** Fecha larga en español ("Lunes, 02 de Marzo de 2026 (00:00 horas)"). */
export function formatoFechaLarga(valor: string): string {
  const fecha = parsearFecha(valor);
  if (!fecha) {
    return "";
  }
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${DIAS_SEMANA[fecha.getDay()]}, ${dia} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()} (00:00 horas)`;
}

/** Fecha corta en español ("02 Mar 2026"). */
export function formatoFechaCorta(valor: string): string {
  const fecha = parsearFecha(valor);
  if (!fecha) {
    return "";
  }
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${dia} ${MESES[fecha.getMonth()].slice(0, 3)} ${fecha.getFullYear()}`;
}

/** Días hábiles transcurridos entre dos fechas (sin contar festivos). */
export function diasHabilesEntre(desde: string, hasta: string): number {
  const inicio = parsearFecha(desde);
  const fin = parsearFecha(hasta);
  if (!inicio || !fin || fin <= inicio) {
    return 0;
  }

  let dias = 0;
  const cursor = new Date(inicio.getTime());
  while (cursor < fin) {
    cursor.setDate(cursor.getDate() + 1);
    const dia = cursor.getDay();
    if (dia !== 0 && dia !== 6) {
      dias += 1;
    }
  }
  return dias;
}
