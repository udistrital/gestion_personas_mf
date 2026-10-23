export type ModalidadRegistroId = "persona-natural" | "persona-juridica" | "consorcio";

export interface ModalidadRegistro {
  id: ModalidadRegistroId;
  titulo: string;
  subtitulo: string;
  descripcion: string;
  icono: string;
}

export const OPCIONES_MODALIDAD_REGISTRO: ModalidadRegistro[] = [
  {
    id: "persona-natural",
    titulo: "Persona Natural",
    subtitulo: "RUT Persona Natural • C.C. / C.E.",
    descripcion:
      "Orientado a profesionales independientes, contratistas de prestación de servicios (OPS), docentes hora cátedra, consultores y peritos que contratan a título personal con la Universidad.",
    icono: "person",
  },
  {
    id: "persona-juridica",
    titulo: "Persona Jurídica",
    subtitulo: "Sociedades Comerciales, SAS, LTDA, ESAL",
    descripcion:
      "Empresas constituidas, distribuidoras, fabricantes, cooperativas y entidades sin ánimo de lucro representadas legalmente por un titular con NIT corporativo ante la Cámara de Comercio.",
    icono: "domain",
  },
  {
    id: "consorcio",
    titulo: "Consorcio / Unión Temporal",
    subtitulo: "Alianzas Comerciales Ley 80 / 1993",
    descripcion:
      "Agrupaciones temporales de dos o más personas naturales o jurídicas para presentar propuestas conjuntas en licitaciones de obra, consultoría especializada o suministros mayores.",
    icono: "handshake",
  },
];
