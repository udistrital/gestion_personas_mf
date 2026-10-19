export interface PersonaJuridicaCatalogosPayload {
  procedencia_id: number;
  tipo_organizacion_id: number;
  tamano_empresa_id: number;
  tipo_capital_id: number;
  camara_comercio_id: number;
  responsabilidad_fiscal_perfil: Array<{ responsabilidad_fiscal_id: number }>;
  actividad_economica_proveedor: Array<{ actividad_economica_id: number }>;
  representacion: { cargo_id: number };
  declaracion: Array<{ tipo_declaracion_id: number }>;
}
