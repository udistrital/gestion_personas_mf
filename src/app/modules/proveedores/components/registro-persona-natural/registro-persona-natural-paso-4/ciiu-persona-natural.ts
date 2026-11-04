/**
 * Actividades económicas de ejemplo para la vista previa de la constancia.
 * El paso 4 ya no usa esta lista: se alimenta del catálogo CIIU de
 * PARAMETROS_SERVICE. Se conserva para que "Ver constancia de ejemplo"
 * muestre datos reconocibles sin depender del backend.
 */
export interface ActividadCiiuPersonaNatural {
  codigo: string;
  nombre: string;
  descripcion: string;
  principal: boolean;
}

export const CIIU_PERSONA_NATURAL: readonly ActividadCiiuPersonaNatural[] = [
  {
    codigo: "6201",
    nombre: "Desarrollo de sistemas y tecnologías TIC",
    descripcion:
      "Actividades de desarrollo de sistemas lógicos (software y aplicativos institucionales).",
    principal: true,
  },
  {
    codigo: "6202",
    nombre: "Consultoría informática y gestión de instalaciones",
    descripcion:
      "Actividades de consultoría informática y gestión de instalaciones e infraestructura tecnológica.",
    principal: false,
  },
  {
    codigo: "8544",
    nombre: "Educación técnica, tecnológica y formación continua",
    descripcion:
      "Educación técnica, tecnológica y de formación académica avanzada o continua.",
    principal: false,
  },
];
