/**
 * Modelos del paso 5 del asistente de solicitud (S-02).
 *
 * El paso 5 ("Proveedores objetivo") segmenta el mercado por actividad
 * económica (CIIU) y núcleo básico de conocimiento (SNIES) y determina los
 * proveedores habilitados que cumplen las características de la solicitud.
 *
 * Este módulo reúne los contratos, los catálogos (simulados) y los cálculos
 * puros que comparten los tres estados del mockup aprobado: servicios con
 * SNIES, bienes sin SNIES y cruce sin coincidencias.
 */

import { ETIQUETAS_TIPO_NECESIDAD, TipoNecesidadSolicitud } from "./items.model";

/* ── Actividades económicas (CIIU) ────────────────────────────────────────── */

/** Actividad económica del catálogo CIIU (Revisión 4 A.C. — DANE). */
export interface ActividadCiiu {
  readonly codigo: string;
  readonly descripcion: string;
  /** Sector macroeconómico que resume la actividad ("TIC Software"). */
  readonly clase: string;
}

/**
 * Catálogo CIIU simulado.
 *
 * Mientras no exista el servicio de segmentación, este catálogo alimenta el
 * buscador de la tarjeta 2 y permite cruzar los proveedores de prueba.
 */
export const ACTIVIDADES_CIIU: readonly ActividadCiiu[] = [
  {
    codigo: "6201",
    descripcion:
      "Actividades de desarrollo de sistemas informáticos (planificación, análisis, diseño, programación, pruebas)",
    clase: "TIC Software",
  },
  {
    codigo: "6202",
    descripcion:
      "Actividades de consultoría informática y actividades de administración de instalaciones informáticas",
    clase: "Soporte TIC",
  },
  {
    codigo: "6209",
    descripcion:
      "Otras actividades de tecnologías de información y actividades de servicios de computación",
    clase: "Servicios comp.",
  },
  {
    codigo: "4651",
    descripcion:
      "Comercio al por mayor de computadores, equipo periférico y programas de informática",
    clase: "Comercio al por mayor",
  },
  {
    codigo: "2620",
    descripcion: "Fabricación de computadoras y de equipo periférico",
    clase: "Fabricación electrónica",
  },
  {
    codigo: "9511",
    descripcion:
      "Mantenimiento y reparación de computadores y de equipo periférico",
    clase: "Mantenimiento TIC",
  },
  {
    codigo: "4741",
    descripcion:
      "Comercio al por menor de computadores, equipo periférico, programas de informática y equipo de telecomunicaciones",
    clase: "Comercio al por menor",
  },
  {
    codigo: "2712",
    descripcion:
      "Fabricación de equipo de distribución y control de la energía eléctrica",
    clase: "Fabricación eléctrica",
  },
  {
    codigo: "6110",
    descripcion: "Actividades de telecomunicaciones alámbricas",
    clase: "Telecomunicaciones",
  },
  {
    codigo: "7210",
    descripcion:
      "Investigaciones y desarrollo experimental en el campo de las ciencias naturales y la ingeniería",
    clase: "Investigación y desarrollo",
  },
];

/** Actividad ya vinculada a la solicitud (fila de la tabla). */
export interface ActividadVinculada extends ActividadCiiu {
  /** Identificador interno (seguimiento de la tabla). */
  readonly id: string;
}

/**
 * Segmentación de proveedores objetivo de una solicitud.
 *
 * Reúne lo que el solicitante diligenció en el paso 5 (S-02) y que el detalle
 * (S-03, pestaña "Proveedores objetivo") muestra en solo lectura: las
 * actividades económicas CIIU vinculadas y, cuando la naturaleza del objeto lo
 * exige, el área y el núcleo básico de conocimiento (SNIES).
 *
 * Los valores de SNIES son los del catálogo (`AREAS_SNIES` / `NUCLEOS_SNIES`);
 * vacíos cuando la solicitud es de bienes y el SNIES no aplica.
 */
export interface SegmentacionProveedores {
  /** Actividades económicas CIIU vinculadas. */
  readonly actividades: readonly ActividadVinculada[];
  /** Valor del área de conocimiento SNIES; vacío cuando no aplica. */
  readonly areaSnies: string;
  /** Valor del núcleo básico de conocimiento; vacío cuando no aplica. */
  readonly nucleoSnies: string;
}

/* ── Núcleo de conocimiento (SNIES) ───────────────────────────────────────── */

/** Opción de los selectores del SNIES. */
export interface OpcionSnies {
  readonly valor: string;
  readonly etiqueta: string;
  /** Icono Material representativo (clásicos, ya disponibles). */
  readonly icono: string;
}

/** Códigos tipo_parametro asociados al área tipo SNIES. */
export const CODIGOS_AREAS_SNIES = [
  "AGRO_VET_AFINES",
  "BELLAS_ARTES",
  "CIENCIAS_EDUCACIÓN",
  "CIENCIAS_SALUD",
  "CIENCIAS_HUMANAS",
  "ECONO_ADMIN_AFINES",
  "ING_ARQ_AFINES",
  "MAT_NATURALES",
] as const;

/** Áreas de conocimiento del SNIES (select "Área de conocimiento"). */
export const AREAS_SNIES: readonly OpcionSnies[] = [
  {
    valor: "AGRO_VET_AFINES",
    etiqueta: "AGRONOMÍA, VETERINARIA Y AFINES",
    icono: "agriculture",
  },
  {
    valor: "BELLAS_ARTES",
    etiqueta: "BELLAS ARTES",
    icono: "palette",
  },
  {
    valor: "CIENCIAS_EDUCACIÓN",
    etiqueta: "CIENCIAS DE LA EDUCACIÓN",
    icono: "school",
  },
  {
    valor: "CIENCIAS_SALUD",
    etiqueta: "CIENCIAS DE LA SALUD",
    icono: "medical_services",
  },
  {
    valor: "CIENCIAS_HUMANAS",
    etiqueta: "CIENCIAS SOCIALES Y HUMANAS",
    icono: "groups",
  },
  {
    valor: "ECONO_ADMIN_AFINES",
    etiqueta: "ECONOMÍA, ADMINISTRACIÓN, CONTADURÍA Y AFINES",
    icono: "account_balance",
  },
  {
    valor: "ING_ARQ_AFINES",
    etiqueta: "INGENIERÍA, ARQUITECTURA, URBANISMO Y AFINES",
    icono: "engineering",
  },
  {
    valor: "MAT_NATURALES",
    etiqueta: "MATEMÁTICAS Y CIENCIAS NATURALES",
    icono: "science",
  },
  {
    valor: "ING",
    etiqueta: "INGENIERÍA, ARQUITECTURA, URBANISMO Y AFINES",
    icono: "engineering",
  },
  {
    valor: "CIEN",
    etiqueta: "CIENCIAS DE LA EDUCACIÓN",
    icono: "school",
  },
  {
    valor: "ECON",
    etiqueta: "ECONOMÍA, ADMINISTRACIÓN, CONTADURÍA Y AFINES",
    icono: "account_balance",
  },
  {
    valor: "SOC",
    etiqueta: "CIENCIAS SOCIALES Y HUMANAS",
    icono: "groups",
  },
  {
    valor: "NAT",
    etiqueta: "MATEMÁTICAS Y CIENCIAS NATURALES",
    icono: "science",
  },
  {
    valor: "SALUD",
    etiqueta: "CIENCIAS DE LA SALUD",
    icono: "medical_services",
  },
  { valor: "SIN", etiqueta: "SIN CLASIFICAR", icono: "help_outline" },
];

/** Núcleos básicos de conocimiento (NBC) del SNIES. */
export const NUCLEOS_SNIES: readonly OpcionSnies[] = [
  {
    valor: "SISTEMAS",
    etiqueta: "INGENIERÍA DE SISTEMAS, TELEMÁTICA Y AFINES",
    icono: "terminal",
  },
  {
    valor: "ELECTRONICA",
    etiqueta: "INGENIERÍA ELECTRÓNICA, TELECOMUNICACIONES Y AFINES",
    icono: "memory",
  },
  {
    valor: "ELECTRICA",
    etiqueta: "INGENIERÍA ELÉCTRICA Y AFINES",
    icono: "bolt",
  },
  {
    valor: "INDUSTRIAL",
    etiqueta: "INGENIERÍA INDUSTRIAL Y AFINES",
    icono: "factory",
  },
  {
    valor: "ASTRONOMIA",
    etiqueta: "ASTRONOMÍA, ASTROFÍSICA Y AFINES",
    icono: "science",
  },
  { valor: "NO_APLICA", etiqueta: "NO APLICA", icono: "block" },
];

/** Valor del NBC que amplía el espectro (no filtra por idoneidad técnica). */
export const NBC_SIN_IDONEIDAD = "NO_APLICA";

/** Etiqueta legible del área de conocimiento SNIES ("ING" → "INGENIERÍA…"). */
export function etiquetaAreaSnies(valor: string): string {
  return AREAS_SNIES.find((area) => area.valor === valor)?.etiqueta ?? valor;
}

/** Etiqueta legible del núcleo básico de conocimiento ("SISTEMAS" → …). */
export function etiquetaNucleoSnies(valor: string): string {
  return NUCLEOS_SNIES.find((nucleo) => nucleo.valor === valor)?.etiqueta ?? valor;
}

/** Perfil técnico inferido que se muestra al elegir un NBC. */
export interface PerfilNbc {
  readonly titulo: string;
  readonly descripcion: string;
  readonly icono: string;
}

const PERFILES_NBC: Record<string, PerfilNbc> = {
  SISTEMAS: {
    titulo: "Ingeniería de Sistemas y Telemática",
    descripcion: "Convalidado ante el registro institucional de proponentes calificados.",
    icono: "terminal",
  },
  ELECTRONICA: {
    titulo: "Ingeniería Electrónica y Telecomunicaciones",
    descripcion: "Convalidado ante el registro institucional de proponentes calificados.",
    icono: "memory",
  },
  ELECTRICA: {
    titulo: "Ingeniería Eléctrica y Afines",
    descripcion: "Convalidado ante el registro institucional de proponentes calificados.",
    icono: "bolt",
  },
  INDUSTRIAL: {
    titulo: "Ingeniería Industrial y Afines",
    descripcion: "Convalidado ante el registro institucional de proponentes calificados.",
    icono: "factory",
  },
  ASTRONOMIA: {
    titulo: "Astronomía, Astrofísica y Afines",
    descripcion: "Segmentación de alta especificidad académica.",
    icono: "science",
  },
};

/** Perfil general cuando no se exige idoneidad certificada. */
const PERFIL_GENERAL: PerfilNbc = {
  titulo: "Perfil general (sin idoneidad específica)",
  descripcion:
    "Habilita todo el espectro de proveedores registrados sin filtro académico.",
  icono: "groups",
};

/** Perfil técnico inferido para un NBC; cae al perfil general cuando aplica. */
export function perfilNbc(nucleo: string): PerfilNbc {
  return PERFILES_NBC[nucleo] ?? PERFIL_GENERAL;
}

/* ── Proveedores objetivo ─────────────────────────────────────────────────── */

/** Proveedor habilitado en el Banco de Proveedores de la Universidad. */
export interface ProveedorObjetivo {
  /** Identificador interno. */
  readonly id: string;
  readonly nombre: string;
  readonly nit: string;
  readonly ciudad: string;
  /** Icono Material de la tarjeta. */
  readonly icono: string;
  /** Códigos CIIU en los que está habilitado. */
  readonly actividades: readonly string[];
  /** NBC en los que acredita idoneidad. */
  readonly nucleos: readonly string[];
}

/**
 * Banco de proveedores simulado (mockup: Banco de Proveedores UD).
 *
 * Los primeros doce acreditan idoneidad en Sistemas y actividades TIC; los
 * doce restantes son comercializadores y fabricantes de hardware. Todos
 * registran actividad de comercio (4651) o fabricación (2620), de modo que la
 * segmentación de bienes cubre la totalidad del banco.
 */
export const PROVEEDORES_MOCK: readonly ProveedorObjetivo[] = [
  {
    id: "prov-01",
    nombre: "Redes y Servidores de Colombia S.A.S.",
    nit: "900.842.119-4",
    ciudad: "Bogotá D.C. - Sede Chapinero",
    icono: "dns",
    actividades: ["6201", "6202", "6209", "4651"],
    nucleos: ["SISTEMAS"],
  },
  {
    id: "prov-02",
    nombre: "Soluciones Tecnológicas Universitarias LTDA",
    nit: "830.501.993-2",
    ciudad: "Bogotá D.C. - Centro Teusaquillo",
    icono: "laptop",
    actividades: ["6202", "6209", "4651"],
    nucleos: ["SISTEMAS"],
  },
  {
    id: "prov-03",
    nombre: "DataCloud Andina S.A.S.",
    nit: "901.320.448-7",
    ciudad: "Bogotá D.C. - Salitre Oriental",
    icono: "cloud",
    actividades: ["6201", "6209", "2620"],
    nucleos: ["SISTEMAS"],
  },
  {
    id: "prov-04",
    nombre: "Ingeniería de Software del Sur S.A.S.",
    nit: "901.102.774-5",
    ciudad: "Bogotá D.C. - Puente Aranda",
    icono: "terminal",
    actividades: ["6201", "6202", "4651"],
    nucleos: ["SISTEMAS"],
  },
  {
    id: "prov-05",
    nombre: "Sistemas Integrados Andinos LTDA",
    nit: "860.015.442-9",
    ciudad: "Bogotá D.C. - Chapinero Alto",
    icono: "storage",
    actividades: ["6201", "6209", "4651"],
    nucleos: ["SISTEMAS"],
  },
  {
    id: "prov-06",
    nombre: "Cibernética Aplicada S.A.S.",
    nit: "900.557.301-8",
    ciudad: "Bogotá D.C. - Suba",
    icono: "memory",
    actividades: ["6202", "6209", "2620"],
    nucleos: ["SISTEMAS"],
  },
  {
    id: "prov-07",
    nombre: "Consultoría Informática Bogotá S.A.S.",
    nit: "830.114.908-1",
    ciudad: "Bogotá D.C. - Barrios Unidos",
    icono: "insights",
    actividades: ["6201", "6202", "4651"],
    nucleos: ["SISTEMAS"],
  },
  {
    id: "prov-08",
    nombre: "Redes Empresariales del Norte LTDA",
    nit: "900.221.664-3",
    ciudad: "Bogotá D.C. - Usaquén",
    icono: "router",
    actividades: ["6202", "6209", "2620"],
    nucleos: ["SISTEMAS"],
  },
  {
    id: "prov-09",
    nombre: "Nube Pública Colombia S.A.S.",
    nit: "901.447.882-0",
    ciudad: "Bogotá D.C. - Fontibón",
    icono: "cloud",
    actividades: ["6201", "6209", "4651"],
    nucleos: ["SISTEMAS"],
  },
  {
    id: "prov-10",
    nombre: "Desarrollo Digital Universitario S.A.S.",
    nit: "900.318.550-6",
    ciudad: "Bogotá D.C. - La Candelaria",
    icono: "developer_board",
    actividades: ["6201", "6202", "6209", "4651"],
    nucleos: ["SISTEMAS"],
  },
  {
    id: "prov-11",
    nombre: "Soporte Técnico Especializado S.A.S.",
    nit: "830.902.117-4",
    ciudad: "Bogotá D.C. - Kennedy",
    icono: "build",
    actividades: ["6202", "6209", "2620"],
    nucleos: ["SISTEMAS"],
  },
  {
    id: "prov-12",
    nombre: "Arquitectura de Software Andina LTDA",
    nit: "901.556.330-2",
    ciudad: "Bogotá D.C. - Teusaquillo",
    icono: "account_tree",
    actividades: ["6201", "6209", "4651"],
    nucleos: ["SISTEMAS"],
  },
  {
    id: "prov-13",
    nombre: "Comercializadora de Equipos de Cómputo S.A.S.",
    nit: "830.221.774-9",
    ciudad: "Bogotá D.C. - Chapinero",
    icono: "computer",
    actividades: ["4651", "2620"],
    nucleos: ["ELECTRONICA"],
  },
  {
    id: "prov-14",
    nombre: "Distribuciones Tecnológicas de Colombia LTDA",
    nit: "860.442.119-7",
    ciudad: "Bogotá D.C. - Puente Aranda",
    icono: "storefront",
    actividades: ["4651", "2620"],
    nucleos: ["NO_APLICA"],
  },
  {
    id: "prov-15",
    nombre: "Fábrica de Hardware Bogotá S.A.S.",
    nit: "900.771.223-5",
    ciudad: "Bogotá D.C. - Fontibón",
    icono: "factory",
    actividades: ["4651", "2620"],
    nucleos: ["ELECTRONICA"],
  },
  {
    id: "prov-16",
    nombre: "Suministros Informáticos Andinos S.A.S.",
    nit: "901.223.887-1",
    ciudad: "Bogotá D.C. - Suba",
    icono: "print",
    actividades: ["4651", "2620"],
    nucleos: ["NO_APLICA"],
  },
  {
    id: "prov-17",
    nombre: "Importadora de Tecnología S.A.S.",
    nit: "830.556.201-9",
    ciudad: "Bogotá D.C. - Barrios Unidos",
    icono: "point_of_sale",
    actividades: ["4651", "2620"],
    nucleos: ["NO_APLICA"],
  },
  {
    id: "prov-18",
    nombre: "Equipos y Periféricos del Sur LTDA",
    nit: "860.110.773-2",
    ciudad: "Bogotá D.C. - Tunjuelito",
    icono: "computer",
    actividades: ["4651", "2620"],
    nucleos: ["ELECTRONICA"],
  },
  {
    id: "prov-19",
    nombre: "Mayorista de Cómputo S.A.S.",
    nit: "900.665.442-6",
    ciudad: "Bogotá D.C. - Kennedy",
    icono: "storefront",
    actividades: ["4651", "2620"],
    nucleos: ["NO_APLICA"],
  },
  {
    id: "prov-20",
    nombre: "Manufacturas Electrónicas UD S.A.S.",
    nit: "901.339.114-8",
    ciudad: "Bogotá D.C. - Engativá",
    icono: "memory",
    actividades: ["4651", "2620"],
    nucleos: ["ELECTRONICA"],
  },
  {
    id: "prov-21",
    nombre: "Dispositivos y Redes S.A.S.",
    nit: "830.778.330-4",
    ciudad: "Bogotá D.C. - Usaquén",
    icono: "router",
    actividades: ["4651", "2620"],
    nucleos: ["ELECTRONICA"],
  },
  {
    id: "prov-22",
    nombre: "Soluciones de Cómputo Empresarial S.A.S.",
    nit: "900.114.882-3",
    ciudad: "Bogotá D.C. - Chapinero Alto",
    icono: "laptop",
    actividades: ["4651", "2620"],
    nucleos: ["NO_APLICA"],
  },
  {
    id: "prov-23",
    nombre: "Proveeduría Tecnológica Nacional LTDA",
    nit: "860.223.559-1",
    ciudad: "Bogotá D.C. - Teusaquillo",
    icono: "business",
    actividades: ["4651", "2620"],
    nucleos: ["NO_APLICA"],
  },
  {
    id: "prov-24",
    nombre: "Centro de Equipos y Suministros S.A.S.",
    nit: "901.668.221-7",
    ciudad: "Bogotá D.C. - Salitre",
    icono: "settings_input_antenna",
    actividades: ["4651", "2620"],
    nucleos: ["ELECTRONICA"],
  },
];

/**
 * Cruza el banco de proveedores con los criterios de segmentación.
 *
 * Une por actividad económica (al menos una coincidencia CIIU) y —cuando la
 * solicitud exige idoneidad— por núcleo básico de conocimiento. El NBC
 * `NO_APLICA` amplía el espectro y no filtra por perfil académico.
 */
export function buscarProveedores(
  actividades: readonly string[],
  nucleo: string,
  aplicaSnies: boolean,
): readonly ProveedorObjetivo[] {
  if (actividades.length === 0) {
    return [];
  }

  return PROVEEDORES_MOCK.filter((proveedor) => {
    const coincideCiiu = proveedor.actividades.some((codigo) =>
      actividades.includes(codigo),
    );
    if (!coincideCiiu) {
      return false;
    }
    if (!aplicaSnies || !nucleo || nucleo === NBC_SIN_IDONEIDAD) {
      return true;
    }
    return proveedor.nucleos.includes(nucleo);
  });
}

/** true cuando la solicitud exige idoneidad técnica certificada (SNIES). */
export function exigeSnies(tipo: TipoNecesidadSolicitud): boolean {
  return tipo === "servicios" || tipo === "mixta";
}

/**
 * Oferentes registrados por cada código CIIU dentro del cruce.
 *
 * El conteo se limita a los proveedores del cruce (CIIU + SNIES), de modo que
 * la suma de las filas puede superar el total único: un proveedor que
 * concurre en varios códigos se consolida en una sola notificación.
 */
export function conteoOferentesPorActividad(
  proveedores: readonly ProveedorObjetivo[],
  codigos: readonly string[],
): ReadonlyMap<string, number> {
  const conteo = new Map<string, number>(codigos.map((codigo) => [codigo, 0]));

  for (const proveedor of proveedores) {
    for (const codigo of proveedor.actividades) {
      if (conteo.has(codigo)) {
        conteo.set(codigo, (conteo.get(codigo) ?? 0) + 1);
      }
    }
  }

  return conteo;
}

/** Códigos CIIU vinculados en una sola línea ("6201, 6202, 6209"). */
export function listarCodigos(actividades: readonly ActividadVinculada[]): string {
  return actividades.map((actividad) => actividad.codigo).join(", ");
}

/* ── Resumen de la solicitud (tarjeta 1) ──────────────────────────────────── */

/**
 * Resumen de solo lectura que la tarjeta 1 muestra.
 *
 * Lo arma el asistente mezclando el cruce de SICAPITAL (objeto y responsable),
 * el paso 2 (dependencias y cronograma) y el paso 3 (tipo de necesidad).
 */
export interface ResumenSolicitudProveedores {
  readonly objeto: string;
  readonly numeroCotizacion: string;
  readonly vigencia: string;
  readonly unidadEjecutora: string;
  readonly responsable: string;
  readonly dependenciaSolicitante: string;
  readonly ordenadorGasto: string;
  readonly fechaApertura: string;
  readonly fechaCierre: string;
  readonly tipoNecesidad: TipoNecesidadSolicitud;
}

/** Etiqueta visible del tipo de necesidad (reutiliza el paso 3). */
export function etiquetaTipoNecesidad(tipo: TipoNecesidadSolicitud): string {
  return ETIQUETAS_TIPO_NECESIDAD[tipo];
}
