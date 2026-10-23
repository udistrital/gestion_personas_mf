export type VistaConsentimiento = "informado" | "confirmado" | "rechazado";

export type TonoConsentimiento = "primario" | "exito" | "error";

export type AccionConsentimiento = "aceptar" | "rechazar" | "entendido" | "reconsentar";

export interface BotonConsentimiento {
  accion: AccionConsentimiento;
  texto: string;
  icono: string;
  destacado: boolean;
}

export interface EnlaceConsentimiento {
  texto: string;
  url: string;
}

export type SegmentoConsentimiento = string | EnlaceConsentimiento;

export interface ParrafoConsentimiento {
  segmentos: SegmentoConsentimiento[];
}

export interface ContenidoConsentimiento {
  titulo: string;
  antetitulo: string;
  icono: string;
  tono: TonoConsentimiento;
  parrafos: ParrafoConsentimiento[];
  botones: BotonConsentimiento[];
}

/** Url de las políticas de privacidad de la Universidad. Mientras esté vacía,
 *  el enlace se renderiza como texto plano. */
export const URL_POLITICAS_PRIVACIDAD = "https://pwi.udistrital.edu.co/politicas-de-privacidad";

export const CONSENTIMIENTO_INFORMADO: ContenidoConsentimiento = {
  titulo: "CONSENTIMIENTO INFORMADO",
  antetitulo: "RESPETADO USUARIO",
  icono: "privacy_tip",
  tono: "primario",
  parrafos: [
    {
      segmentos: [
        "Se solicita su autorización para que de manera voluntaria, previa, expresa, informada e inequívoca permita a la Universidad Francisco José de Caldas la recolección, almacenamiento, disposición y divulgación (de los datos que se consideren públicos) de los datos personales ingresados al sistema de información para fines institucionales, todo esto, siguiendo los principios de transparencia de la información.",
      ],
    },
    {
      segmentos: [
        "Su confidencialidad y seguridad se darán de acuerdo a lo establecido en la Ley 1581 de 2012 (Régimen General de Protección de Datos Personales) y la Ley 1712 de 2014 de Transparencia y del derecho al acceso a la información pública Nacional, lo cual podrá ser consultado en las ",
        {
          texto: "políticas de privacidad de la Universidad",
          url: URL_POLITICAS_PRIVACIDAD,
        },
        ".",
      ],
    },
    {
      segmentos: [
        "Cabe recordar que su cuenta en el Sistema es personal, por lo tanto, su usuario y contraseña son exclusivamente su responsabilidad. De igual manera, y siguiendo el principio de la buena fe establecido en el artículo 83 de la Constitución Política de Colombia, se presume que los datos y soportes suministrados son verídicos, y cualquier inconsistencia o dato falso que se identifique en el proceso de verificación de la información será responsabilidad del titular de la cuenta, quien asumirá de forma directa las consecuencias civiles, penales y administrativas que su actuación genere ante las autoridades públicas.",
      ],
    },
  ],
  botones: [
    {
      accion: "rechazar",
      texto: "No acepto",
      icono: "close",
      destacado: false,
    },
    {
      accion: "aceptar",
      texto: "Acepto",
      icono: "check",
      destacado: true,
    },
  ],
};

export const CONSENTIMIENTO_CONFIRMADO: ContenidoConsentimiento = {
  titulo: "CONFIRMADO",
  antetitulo: "CONSENTIMIENTO ACEPTADO",
  icono: "verified_user",
  tono: "exito",
  parrafos: [
    {
      segmentos: ["Puede proceder con el registro de su información"],
    },
  ],
  botones: [
    {
      accion: "entendido",
      texto: "Entendido",
      icono: "check",
      destacado: true,
    },
  ],
};

export const CONSENTIMIENTO_RECHAZADO: ContenidoConsentimiento = {
  titulo: "CONSENTIMIENTO NO ACEPTADO",
  antetitulo: "TRATAMIENTO DE DATOS PERSONALES",
  icono: "block",
  tono: "error",
  parrafos: [
    {
      segmentos: [
        "Ha declinado el consentimiento para el tratamiento de datos personales. Recuerde que la aceptación es obligatoria según la Ley 1581 de 2012 para proceder con el registro en el Banco de Proveedores de la Universidad Distrital Francisco José de Caldas, No es posible continuar con el diligenciamiento del formulario.",
      ],
    },
  ],
  botones: [
    {
      accion: "entendido",
      texto: "Entendido",
      icono: "close",
      destacado: false,
    },
    {
      accion: "reconsentar",
      texto: "Ver consentimiento",
      icono: "visibility",
      destacado: true,
    },
  ],
};

export const CONTENIDO_CONSENTIMIENTO: Record<VistaConsentimiento, ContenidoConsentimiento> = {
  informado: CONSENTIMIENTO_INFORMADO,
  confirmado: CONSENTIMIENTO_CONFIRMADO,
  rechazado: CONSENTIMIENTO_RECHAZADO,
};
