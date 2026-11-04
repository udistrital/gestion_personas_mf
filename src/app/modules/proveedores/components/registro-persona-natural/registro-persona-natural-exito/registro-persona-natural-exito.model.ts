/**
 * Datos que alimentan la constancia de radicación exitosa del registro de
 * proveedores (persona natural o jurídica). El contenedor de cada formulario
 * los construye a partir del formulario y de la respuesta del MID.
 */
export interface ResumenRadicacionProveedor {
  nombreCompleto: string;
  tipoDocumento: string;
  numeroDocumento: string;
  ciudadExpedicion: string;
  tipoSolicitante: string;
  /** Representante legal de la persona jurídica; vacío en persona natural. */
  representanteLegal?: string;
  /** Documento del representante legal; vacío en persona natural. */
  documentoRepresentante?: string;
  ciiuPrincipal: string;
  ciiuSecundarias: string[];
  correoPersonal: string;
  correoTesoreria: string;
  /** Código provisional hasta que el MID emita el radicado oficial. */
  radicado: string;
  fechaRadicacion: Date;
  /** Hash SHA-256 de referencia local; null si el navegador no lo permite. */
  hash: string | null;
  proveedorId?: number;
  /** true cuando el MID confirmó el registro con observaciones (Status 206). */
  parcial: boolean;
  observaciones?: string;
}
