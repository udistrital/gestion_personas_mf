import {
  ActualizarProveedorJuridicoMidPayload,
  ActualizarProveedorNaturalMidPayload,
  DatosIdentificacionMid,
  MapeoPayloadMid,
  NuevoProveedorJuridicoMidPayload,
  NuevoProveedorNaturalMidPayload,
  CuentaBancariaMidActualizacion,
  ProveedorMidMaterializado,
  ProveedorJuridicoMid,
  ProveedorNaturalMid,
  ProveedorJuridicoMidActualizacion,
  ProveedorNaturalMidActualizacion,
  TerceroMidActualizacion,
  TerceroMid,
} from "./gestion-personas-mid.models";
import { textoPlanoDesdeHtml } from "src/app/shared/utils/texto-plano";

const LIMITE_MATRICULA_MERCANTIL = "999999999999999";

function registro(
  valor: unknown,
  nombre: string,
): Record<string, unknown> {
  if (
    typeof valor !== "object"
    || valor === null
    || Array.isArray(valor)
  ) {
    throw new Error(`No fue posible leer los datos de ${nombre}.`);
  }
  return valor as Record<string, unknown>;
}

function registroOpcional(
  valor: unknown,
  nombre: string,
): Record<string, unknown> | undefined {
  if (valor === undefined || valor === null) {
    return undefined;
  }
  return registro(valor, nombre);
}

function textoOpcional(
  datos: Record<string, unknown>,
  campo: string,
): string | undefined {
  const valor = datos[campo];
  if (valor === undefined || valor === null || valor === "") {
    return undefined;
  }
  if (typeof valor !== "string") {
    throw new Error(`El campo ${campo} debe ser una cadena.`);
  }
  const texto = valor.trim();
  return texto.length > 0 ? texto : undefined;
}

function textoRequerido(
  datos: Record<string, unknown>,
  campo: string,
): string {
  const valor = textoOpcional(datos, campo);
  if (!valor) {
    throw new Error(`El campo ${campo} no contiene un valor válido.`);
  }
  return valor;
}

function entero(
  valor: unknown,
  campo: string,
  minimo: number,
): number {
  let numero: number;
  if (typeof valor === "number") {
    numero = valor;
  } else if (typeof valor === "string" && /^\d+$/.test(valor.trim())) {
    numero = Number(valor.trim());
  } else {
    throw new Error(`El campo ${campo} debe ser un número entero.`);
  }
  if (!Number.isSafeInteger(numero) || numero < minimo) {
    throw new Error(`El campo ${campo} debe ser un número entero válido.`);
  }
  return numero;
}

function enteroOpcional(
  valor: unknown,
  campo: string,
  minimo: number,
): number | undefined {
  if (valor === undefined || valor === null || valor === "") {
    return undefined;
  }
  return entero(valor, campo, minimo);
}

function enteroNumericoOpcional(
  valor: unknown,
  campo: string,
  minimo: number,
): number | undefined {
  if (valor === undefined || valor === null || valor === "") {
    return undefined;
  }
  if (
    typeof valor !== "number"
    || !Number.isSafeInteger(valor)
    || valor < minimo
  ) {
    throw new Error(`El campo ${campo} debe ser un número entero válido.`);
  }
  return valor;
}

export function esMatriculaMercantilValida(valor: unknown): valor is string {
  if (typeof valor !== "string" || !/^\d+$/.test(valor)) {
    return false;
  }

  const valorSignificativo = valor.replace(/^0+/, "") || "0";
  if (valorSignificativo === "0") {
    return false;
  }
  if (valorSignificativo.length > LIMITE_MATRICULA_MERCANTIL.length) {
    return false;
  }
  return valorSignificativo.length < LIMITE_MATRICULA_MERCANTIL.length
    || valorSignificativo <= LIMITE_MATRICULA_MERCANTIL;
}

function matriculaMercantilValidada(valor: unknown): string {
  if (!esMatriculaMercantilValida(valor)) {
    throw new Error(
      "MatriculaMercantil debe ser una cadena positiva de dígitos no superior a 999999999999999.",
    );
  }
  return valor;
}

function fechaOpcional(
  datos: Record<string, unknown>,
  campo: string,
): string | undefined {
  const fecha = textoOpcional(datos, campo);
  if (!fecha) {
    return undefined;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new Error(`El campo ${campo} debe tener formato AAAA-MM-DD.`);
  }
  const fechaValidada = new Date(`${fecha}T00:00:00Z`);
  if (
    Number.isNaN(fechaValidada.getTime())
    || fechaValidada.toISOString().slice(0, 10) !== fecha
  ) {
    throw new Error(`El campo ${campo} no contiene una fecha válida.`);
  }
  return fecha;
}

function booleanoOpcional(
  datos: Record<string, unknown>,
  campo: string,
): boolean | undefined {
  const valor = datos[campo];
  if (valor === undefined || valor === null || valor === "") {
    return undefined;
  }
  if (typeof valor !== "boolean") {
    throw new Error(`El campo ${campo} debe ser una respuesta Sí/No.`);
  }
  return valor;
}

function idMaterializado(
  datos: Record<string, unknown>,
  campo: string,
  entidad: string,
): number {
  const id = enteroNumericoOpcional(datos[campo], `${entidad}.${campo}`, 1);
  if (id === undefined) {
    throw new Error(
      `La consulta no devolvió el identificador de ${entidad}; no se enviará PATCH para evitar crear otra entidad.`,
    );
  }
  return id;
}

function esModalidad(
  datos: ProveedorMidMaterializado,
  rama: "ProveedorNatural" | "ProveedorJuridico",
): Record<string, unknown> {
  const detalle = registroOpcional(datos[rama], rama);
  const otraRama =
    rama === "ProveedorNatural" ? "ProveedorJuridico" : "ProveedorNatural";
  if (!detalle || (datos[otraRama] !== undefined && datos[otraRama] !== null)) {
    throw new Error(`La respuesta consultada no corresponde a ${rama}.`);
  }
  return detalle;
}

function agregarTexto(
  destino: Record<string, unknown>,
  datos: Record<string, unknown>,
  campoOrigen: string,
  campoDestino: string,
): void {
  const valor = textoOpcional(datos, campoOrigen);
  if (valor !== undefined) {
    destino[campoDestino] = valor;
  }
}

function primeraRelacion(
  datos: Record<string, unknown>,
  campo: string,
): Record<string, unknown> | undefined {
  const valor = datos[campo];
  if (valor === undefined || valor === null) {
    return undefined;
  }
  if (!Array.isArray(valor)) {
    throw new Error(`La relación ${campo} no tiene el formato documentado.`);
  }
  return valor.length === 0
    ? undefined
    : registro(valor[0], campo);
}

function agregarEntero(
  destino: Record<string, unknown>,
  datos: Record<string, unknown>,
  campoOrigen: string,
  campoDestino: string,
  minimo: number,
): void {
  const valor = enteroNumericoOpcional(datos[campoOrigen], campoOrigen, minimo);
  if (valor !== undefined) {
    destino[campoDestino] = valor;
  }
}

export function mapearConsultaPersonaNaturalMid(
  datos: ProveedorMidMaterializado,
): Record<string, unknown> {
  const tercero = registro(datos["Tercero"], "Tercero");
  const detalle = esModalidad(datos, "ProveedorNatural");
  const identificacion: Record<string, unknown> = {};
  const experiencia: Record<string, unknown> = {};
  const afiliacionesFinanzas: Record<string, unknown> = {};
  const actividadDeclaracion: Record<string, unknown> = {};
  const documento = primeraRelacion(tercero, "DatosIdentificacion");

  agregarTexto(identificacion, tercero, "PrimerNombre", "primerNombre");
  agregarTexto(identificacion, tercero, "SegundoNombre", "segundoNombre");
  agregarTexto(identificacion, tercero, "PrimerApellido", "primerApellido");
  agregarTexto(identificacion, tercero, "SegundoApellido", "segundoApellido");
  const fechaNacimiento = fechaOpcional(tercero, "FechaNacimiento");
  if (fechaNacimiento !== undefined) {
    identificacion["fechaNacimiento"] = fechaNacimiento;
  }
  if (documento) {
    agregarTexto(identificacion, documento, "Numero", "numeroDocumento");
    agregarEntero(
      identificacion,
      documento,
      "TipoDocumentoId",
      "tipoDocumento",
      1,
    );
    agregarEntero(
      identificacion,
      documento,
      "CiudadExpedicion",
      "ciudadExpedicion",
      1,
    );
    agregarTexto(
      identificacion,
      documento,
      "FechaExpedicion",
      "fechaExpedicion",
    );
    const digitoVerificacion = enteroNumericoOpcional(
      documento["DigitoVerificacion"],
      "DigitoVerificacion",
      0,
    );
    if (digitoVerificacion !== undefined) {
      identificacion["dv"] = String(digitoVerificacion);
    }
  }

  const experienciaLaboral = enteroNumericoOpcional(
    detalle["ExperienciaLaboralMeses"],
    "ExperienciaLaboralMeses",
    0,
  );
  if (experienciaLaboral !== undefined) {
    experiencia["experienciaLaboralTotal"] = experienciaLaboral;
  }
  const experienciaProfesional = enteroNumericoOpcional(
    detalle["ExperienciaProfesionalMeses"],
    "ExperienciaProfesionalMeses",
    0,
  );
  if (experienciaProfesional !== undefined) {
    experiencia["experienciaProfesional"] = experienciaProfesional;
  }
  const cuenta = primeraRelacion(datos, "CuentaBancaria");
  if (cuenta) {
    agregarEntero(
      afiliacionesFinanzas,
      cuenta,
      "EntidadBancariaId",
      "entidadBancaria",
      1,
    );
    agregarEntero(
      afiliacionesFinanzas,
      cuenta,
      "TipoCuentaId",
      "tipoCuenta",
      1,
    );
    agregarTexto(
      afiliacionesFinanzas,
      cuenta,
      "NumeroCuenta",
      "numeroCuentaBancaria",
    );
  }
  agregarTexto(
    actividadDeclaracion,
    datos,
    "DescripcionPortafolio",
    "portafolioCapacidadEntrega",
  );

  return {
    identificacion,
    experiencia,
    afiliacionesFinanzas,
    actividadDeclaracion,
  };
}

export function mapearConsultaPersonaJuridicaMid(
  datos: ProveedorMidMaterializado,
): Record<string, unknown> {
  const tercero = registro(datos["Tercero"], "Tercero");
  const detalle = esModalidad(datos, "ProveedorJuridico");
  const formulario: Record<string, unknown> = {};
  const documento = primeraRelacion(tercero, "DatosIdentificacion");
  const cuenta = primeraRelacion(datos, "CuentaBancaria");

  agregarTexto(formulario, tercero, "NombreCompleto", "razonSocial");
  if (documento) {
    agregarTexto(formulario, documento, "Numero", "nit");
    const digitoVerificacion = enteroNumericoOpcional(
      documento["DigitoVerificacion"],
      "DigitoVerificacion",
      0,
    );
    if (digitoVerificacion !== undefined) {
      formulario["digitoVerificacion"] = String(digitoVerificacion);
    }
  }
  agregarTexto(formulario, detalle, "NombreComercial", "nombreComercial");
  agregarTexto(
    formulario,
    datos,
    "DescripcionPortafolio",
    "descripcionServicios",
  );
  if (cuenta) {
    agregarEntero(formulario, cuenta, "EntidadBancariaId", "banco", 1);
    agregarEntero(formulario, cuenta, "TipoCuentaId", "tipoCuenta", 1);
    agregarTexto(formulario, cuenta, "NumeroCuenta", "numeroCuenta");
    agregarTexto(formulario, cuenta, "NombreTitular", "titularCuenta");
  }

  const matricula = detalle["MatriculaMercantil"];
  if (matricula !== undefined && matricula !== null) {
    if (typeof matricula === "string" && esMatriculaMercantilValida(matricula)) {
      formulario["matriculaMercantil"] = matricula;
    } else if (
      typeof matricula === "number"
      && Number.isSafeInteger(matricula)
      && matricula > 0
    ) {
      formulario["matriculaMercantil"] = String(matricula);
    } else {
      throw new Error(
        "La consulta devolvió una MatriculaMercantil que no se puede representar con seguridad en el formulario.",
      );
    }
  }

  for (const [campoMid, campoFormulario] of [
    ["FechaConstitucion", "fechaConstitucion"],
    ["FechaRenovacion", "fechaRenovacion"],
  ] as const) {
    const fecha = fechaOpcional(detalle, campoMid);
    if (fecha !== undefined) {
      formulario[campoFormulario] = fecha;
    }
  }

  for (const [campoMid, campoFormulario] of [
    ["ReportaBeneficiosFinales", "beneficiariosFinales"],
    ["CotizaBolsa", "cotizaBolsa"],
    ["RequiereRevisorFiscal", "revisorFiscal"],
  ] as const) {
    const valor = booleanoOpcional(detalle, campoMid);
    if (valor !== undefined) {
      formulario[campoFormulario] = valor;
    }
  }

  return formulario;
}

function baseActualizacion(
  datos: ProveedorMidMaterializado,
  rama: "ProveedorNatural" | "ProveedorJuridico",
): {
  Id: number;
  TerceroId: number;
  TipoRegistroId: number;
  TerceroIdMaterializado: number;
  DetalleId: number;
} {
  const proveedorId = idMaterializado(datos, "Id", "Proveedor");
  const terceroId = idMaterializado(datos, "TerceroId", "Proveedor");
  const tipoRegistroId = idMaterializado(datos, "TipoRegistroId", "Proveedor");
  const tercero = registro(datos["Tercero"], "Tercero");
  const terceroIdMaterializado = idMaterializado(tercero, "Id", "Tercero");
  const detalle = esModalidad(datos, rama);
  const detalleId = idMaterializado(detalle, "Id", rama);

  if (terceroId !== terceroIdMaterializado) {
    throw new Error(
      "TerceroId no coincide con Tercero.Id; no se enviará PATCH con una relación ambigua.",
    );
  }

  return {
    Id: proveedorId,
    TerceroId: terceroId,
    TipoRegistroId: tipoRegistroId,
    TerceroIdMaterializado: terceroIdMaterializado,
    DetalleId: detalleId,
  };
}

export function mapearActualizacionPersonaNaturalMid(
  valorFormulario: unknown,
  datosConsultados: ProveedorMidMaterializado,
): MapeoPayloadMid<ActualizarProveedorNaturalMidPayload> {
  const formulario = registro(valorFormulario, "persona natural");
  const identificacion = registro(
    formulario["identificacion"],
    "identificación",
  );
  const experiencia = registro(formulario["experiencia"], "experiencia");
  const finanzas = registro(
    formulario["afiliacionesFinanzas"],
    "información bancaria",
  );
  const actividad = registro(
    formulario["actividadDeclaracion"],
    "actividad",
  );
  const base = baseActualizacion(datosConsultados, "ProveedorNatural");
  const tercero: TerceroMidActualizacion = {
    Id: base.TerceroIdMaterializado,
  };
  const detalle: ProveedorNaturalMidActualizacion = {
    Id: base.DetalleId,
  };
  const omisiones = [
    "DatosIdentificacion y Contacto se omiten en PATCH; no se modifican claves documentales inmutables ni se envían contactos sin valores contractuales confirmados.",
    "La vista representa una cuenta bancaria; las cuentas adicionales consultadas no se modifican ni eliminan.",
    "Los campos omitidos no se borran; el contrato no define el uso de null para limpiar valores.",
  ];
  let camposActualizados = 0;

  for (const [campoFormulario, campoMid] of [
    ["primerNombre", "PrimerNombre"],
    ["segundoNombre", "SegundoNombre"],
    ["primerApellido", "PrimerApellido"],
    ["segundoApellido", "SegundoApellido"],
  ] as const) {
    const valor = textoOpcional(identificacion, campoFormulario);
    if (valor !== undefined) {
      tercero[campoMid] = valor;
      camposActualizados += 1;
    }
  }
  const fechaNacimiento = fechaOpcional(identificacion, "fechaNacimiento");
  if (fechaNacimiento !== undefined) {
    tercero.FechaNacimiento = fechaNacimiento;
    camposActualizados += 1;
  }

  for (const [campoFormulario, campoMid] of [
    ["experienciaLaboralTotal", "ExperienciaLaboralMeses"],
    ["experienciaProfesional", "ExperienciaProfesionalMeses"],
  ] as const) {
    const valor = enteroOpcional(experiencia[campoFormulario], campoMid, 0);
    if (valor !== undefined) {
      detalle[campoMid] = valor;
      camposActualizados += 1;
    }
  }

  const descripcionPortafolioHtml = textoOpcional(
    actividad,
    "portafolioCapacidadEntrega",
  );
  // El editor enriquecido guarda HTML; el MID espera texto legible.
  const descripcionPortafolio = descripcionPortafolioHtml
    ? textoPlanoDesdeHtml(descripcionPortafolioHtml)
    : undefined;
  if (descripcionPortafolio !== undefined) {
    camposActualizados += 1;
  }

  const cuentaConsultada = primeraRelacion(datosConsultados, "CuentaBancaria");
  const cuentaId = cuentaConsultada
    ? idMaterializado(cuentaConsultada, "Id", "CuentaBancaria")
    : undefined;
  const cuentaBancaria: CuentaBancariaMidActualizacion = cuentaId !== undefined
    ? { Id: cuentaId }
    : {};
  const entidadBancariaId = enteroNumericoOpcional(
    finanzas["entidadBancaria"],
    "EntidadBancariaId",
    1,
  );
  if (entidadBancariaId !== undefined) {
    cuentaBancaria.EntidadBancariaId = entidadBancariaId;
    camposActualizados += 1;
  }
  const tipoCuentaId = enteroNumericoOpcional(
    finanzas["tipoCuenta"],
    "TipoCuentaId",
    1,
  );
  if (tipoCuentaId !== undefined) {
    cuentaBancaria.TipoCuentaId = tipoCuentaId;
    camposActualizados += 1;
  }
  const numeroCuenta = textoOpcional(finanzas, "numeroCuentaBancaria");
  if (numeroCuenta !== undefined) {
    cuentaBancaria.NumeroCuenta = numeroCuenta;
    camposActualizados += 1;
  }
  if (cuentaId === undefined && Object.keys(cuentaBancaria).length > 0) {
    cuentaBancaria.EsPrincipal = true;
  }
  if (cuentaId === undefined && Object.keys(cuentaBancaria).length === 0) {
    omisiones.push(
      "CuentaBancaria omitida: el paso no contiene los campos bancarios para crearla.",
    );
  }

  if (camposActualizados === 0) {
    throw new Error(
      "No hay campos compatibles con el MID para actualizar en Persona Natural.",
    );
  }

  const payload: ActualizarProveedorNaturalMidPayload = {
    Id: base.Id,
    TerceroId: base.TerceroId,
    TipoRegistroId: base.TipoRegistroId,
    Tercero: tercero,
    ProveedorNatural: detalle,
  };
  if (descripcionPortafolio !== undefined) {
    payload.DescripcionPortafolio = descripcionPortafolio;
  }
  if (Object.keys(cuentaBancaria).length > (cuentaId === undefined ? 0 : 1)) {
    payload.CuentaBancaria = [cuentaBancaria];
  } else if (cuentaId !== undefined) {
    omisiones.push(
      "CuentaBancaria no modificada: no hay campos bancarios editables con valor.",
    );
  }

  return {
    payload,
    omisiones,
  };
}

export function mapearActualizacionPersonaJuridicaMid(
  valorFormulario: unknown,
  datosConsultados: ProveedorMidMaterializado,
): MapeoPayloadMid<ActualizarProveedorJuridicoMidPayload> {
  const formulario = registro(valorFormulario, "persona jurídica");
  const base = baseActualizacion(datosConsultados, "ProveedorJuridico");
  const cuentaConsultada = primeraRelacion(datosConsultados, "CuentaBancaria");
  const tercero: TerceroMidActualizacion = {
    Id: base.TerceroIdMaterializado,
  };
  const detalle: ProveedorJuridicoMidActualizacion = {
    Id: base.DetalleId,
  };
  const omisiones = [
    "DatosIdentificacion y Contacto se omiten en PATCH; no se envían propiedades documentales con equivalencia no confirmada ni contactos sin valores contractuales confirmados.",
    "La vista representa una cuenta bancaria; las cuentas adicionales consultadas no se modifican ni eliminan.",
    "Los campos omitidos no se borran; el contrato no define el uso de null para limpiar valores.",
  ];
  let camposActualizados = 0;

  const razonSocial = textoOpcional(formulario, "razonSocial");
  if (razonSocial !== undefined) {
    tercero.NombreCompleto = razonSocial;
    camposActualizados += 1;
  }
  const nombreComercial = textoOpcional(formulario, "nombreComercial");
  if (nombreComercial !== undefined) {
    detalle.NombreComercial = nombreComercial;
    camposActualizados += 1;
  }

  const matricula = textoOpcional(formulario, "matriculaMercantil");
  if (matricula !== undefined) {
    detalle.MatriculaMercantil = matriculaMercantilValidada(matricula);
    camposActualizados += 1;
  }

  for (const [campoFormulario, campoMid] of [
    ["fechaConstitucion", "FechaConstitucion"],
    ["fechaRenovacion", "FechaRenovacion"],
  ] as const) {
    const fecha = fechaOpcional(formulario, campoFormulario);
    if (fecha !== undefined) {
      detalle[campoMid] = fecha;
      camposActualizados += 1;
    }
  }

  for (const [campoFormulario, campoMid] of [
    ["beneficiariosFinales", "ReportaBeneficiosFinales"],
    ["cotizaBolsa", "CotizaBolsa"],
    ["revisorFiscal", "RequiereRevisorFiscal"],
  ] as const) {
    const valor = booleanoOpcional(formulario, campoFormulario);
    if (valor !== undefined) {
      detalle[campoMid] = valor;
      camposActualizados += 1;
    }
  }

  const descripcionPortafolioHtml = textoOpcional(
    formulario,
    "descripcionServicios",
  );
  // El editor enriquecido guarda HTML; el MID espera texto legible.
  const descripcionPortafolio = descripcionPortafolioHtml
    ? textoPlanoDesdeHtml(descripcionPortafolioHtml)
    : undefined;
  if (descripcionPortafolio !== undefined) {
    camposActualizados += 1;
  }

  const cuentaId = cuentaConsultada
    ? idMaterializado(cuentaConsultada, "Id", "CuentaBancaria")
    : undefined;
  const cuentaBancaria: CuentaBancariaMidActualizacion = cuentaId !== undefined
    ? { Id: cuentaId }
    : {};
  const entidadBancariaId = enteroNumericoOpcional(
    formulario["banco"],
    "EntidadBancariaId",
    1,
  );
  if (entidadBancariaId !== undefined) {
    cuentaBancaria.EntidadBancariaId = entidadBancariaId;
    camposActualizados += 1;
  }
  const tipoCuentaId = enteroNumericoOpcional(
    formulario["tipoCuenta"],
    "TipoCuentaId",
    1,
  );
  if (tipoCuentaId !== undefined) {
    cuentaBancaria.TipoCuentaId = tipoCuentaId;
    camposActualizados += 1;
  }
  const numeroCuenta = textoOpcional(formulario, "numeroCuenta");
  if (numeroCuenta !== undefined) {
    cuentaBancaria.NumeroCuenta = numeroCuenta;
    camposActualizados += 1;
  }
  const nombreTitular = textoOpcional(formulario, "titularCuenta");
  if (nombreTitular !== undefined) {
    cuentaBancaria.NombreTitular = nombreTitular;
    camposActualizados += 1;
  }
  const ciudadAperturaId = enteroNumericoOpcional(
    formulario["ciudadApertura"],
    "CiudadAperturaId",
    1,
  );
  if (ciudadAperturaId !== undefined) {
    cuentaBancaria.CiudadAperturaId = ciudadAperturaId;
    camposActualizados += 1;
  }
  if (cuentaId === undefined && Object.keys(cuentaBancaria).length > 0) {
    cuentaBancaria.EsPrincipal = true;
  }
  if (cuentaId === undefined && Object.keys(cuentaBancaria).length === 0) {
    omisiones.push(
      "CuentaBancaria omitida: el paso no contiene los campos bancarios para crearla.",
    );
  }

  if (camposActualizados === 0) {
    throw new Error(
      "No hay campos compatibles con el MID para actualizar en Persona Jurídica.",
    );
  }

  const payload: ActualizarProveedorJuridicoMidPayload = {
    Id: base.Id,
    TerceroId: base.TerceroId,
    TipoRegistroId: base.TipoRegistroId,
    Tercero: tercero,
    ProveedorJuridico: detalle,
  };
  if (descripcionPortafolio !== undefined) {
    payload.DescripcionPortafolio = descripcionPortafolio;
  }
  if (Object.keys(cuentaBancaria).length > (cuentaId === undefined ? 0 : 1)) {
    payload.CuentaBancaria = [cuentaBancaria];
  } else if (cuentaId !== undefined) {
    omisiones.push(
      "CuentaBancaria no modificada: no hay campos bancarios editables con valor.",
    );
  }

  return {
    payload,
    omisiones,
  };
}

export function combinarProveedorMidMaterializado(
  anterior: ProveedorMidMaterializado,
  reciente: ProveedorMidMaterializado,
): ProveedorMidMaterializado {
  for (const campo of ["Id", "TerceroId", "TipoRegistroId"] as const) {
    if (
      reciente[campo] !== undefined
      && anterior[campo] !== undefined
      && reciente[campo] !== anterior[campo]
    ) {
      throw new Error(
        `La respuesta PATCH devolvió un ${campo} distinto al registro consultado.`,
      );
    }
  }

  const combinado: ProveedorMidMaterializado = {
    ...anterior,
    ...reciente,
    Id: anterior.Id,
    TerceroId: anterior.TerceroId,
    TipoRegistroId: anterior.TipoRegistroId,
  };

  for (const rama of [
    "Tercero",
    "ProveedorNatural",
    "ProveedorJuridico",
  ] as const) {
    const nodoAnterior = registroOpcional(anterior[rama], rama);
    const nodoReciente = registroOpcional(reciente[rama], rama);
    if (nodoAnterior && nodoReciente) {
      if (
        nodoAnterior["Id"] !== undefined
        && nodoReciente["Id"] !== undefined
        && nodoAnterior["Id"] !== nodoReciente["Id"]
      ) {
        throw new Error(
          `La respuesta PATCH devolvió un Id distinto para ${rama}.`,
        );
      }
      combinado[rama] = { ...nodoAnterior, ...nodoReciente };
    } else if (nodoAnterior) {
      combinado[rama] = nodoAnterior;
    }
  }

  const tercero = registroOpcional(combinado["Tercero"], "Tercero");
  const terceroAnterior = registroOpcional(anterior["Tercero"], "Tercero");
  if (tercero && terceroAnterior) {
    if (tercero["Id"] !== terceroAnterior["Id"]) {
      throw new Error(
        "La respuesta PATCH devolvió un Id distinto para Tercero.",
      );
    }
    for (const relacion of ["DatosIdentificacion"] as const) {
      const valoresAnteriores = terceroAnterior[relacion];
      if (Array.isArray(valoresAnteriores)) {
        tercero[relacion] = valoresAnteriores;
      }
    }
    combinado["Tercero"] = tercero;
  }

  for (const relacion of ["Contacto", "CuentaBancaria"] as const) {
    const valoresAnteriores = anterior[relacion];
    if (Array.isArray(valoresAnteriores)) {
      combinado[relacion] = valoresAnteriores;
    }
  }

  return combinado;
}

export function mapearPersonaNaturalMid(
  valorFormulario: unknown,
): MapeoPayloadMid<NuevoProveedorNaturalMidPayload> {
  const formulario = registro(valorFormulario, "persona natural");
  const identificacion = registro(formulario["identificacion"], "identificación");
  const experiencia = registro(formulario["experiencia"], "experiencia");

  const numeroDocumento = textoOpcional(identificacion, "numeroDocumento");
  const tipoDocumentoId = enteroOpcional(
    identificacion["tipoDocumento"],
    "TipoDocumentoId",
    1,
  );
  let datosDocumento: DatosIdentificacionMid | undefined;
  if (numeroDocumento && tipoDocumentoId !== undefined) {
    datosDocumento = {
      Numero: numeroDocumento,
      TipoDocumentoId: tipoDocumentoId,
    };
    const ciudadExpedicion = enteroOpcional(
      identificacion["ciudadExpedicion"],
      "CiudadExpedicion",
      1,
    );
    if (ciudadExpedicion !== undefined) {
      datosDocumento.CiudadExpedicion = ciudadExpedicion;
    }
    const fechaExpedicion = fechaOpcional(
      identificacion,
      "fechaExpedicion",
    );
    if (fechaExpedicion) {
      datosDocumento.FechaExpedicion = fechaExpedicion;
    }
    const digitoVerificacion = enteroOpcional(
      identificacion["dv"],
      "DigitoVerificacion",
      0,
    );
    if (digitoVerificacion !== undefined) {
      datosDocumento.DigitoVerificacion = digitoVerificacion;
    }
  }

  const primerNombre = textoRequerido(identificacion, "primerNombre");
  const segundoNombre = textoOpcional(identificacion, "segundoNombre");
  const primerApellido = textoRequerido(identificacion, "primerApellido");
  const segundoApellido = textoOpcional(identificacion, "segundoApellido");
  const tercero: TerceroMid = {
    PrimerNombre: primerNombre,
    PrimerApellido: primerApellido,
  };
  const fechaNacimiento = fechaOpcional(identificacion, "fechaNacimiento");
  if (fechaNacimiento) {
    tercero.FechaNacimiento = fechaNacimiento;
  }
  if (segundoNombre) {
    tercero.SegundoNombre = segundoNombre;
  }
  if (segundoApellido) {
    tercero.SegundoApellido = segundoApellido;
  }

  const proveedorNatural: ProveedorNaturalMid = {
    ExperienciaLaboralMeses: entero(
      experiencia["experienciaLaboralTotal"],
      "ExperienciaLaboralMeses",
      0,
    ),
    ExperienciaProfesionalMeses: entero(
      experiencia["experienciaProfesional"],
      "ExperienciaProfesionalMeses",
      0,
    ),
  };

  const omisiones = [
    "Caracterización, información tributaria, dirección y contactos omitidos: el MID no declara actualmente estos campos como escribibles.",
    "Género y país de nacimiento omitidos: el MID no declara actualmente estos campos como escribibles.",
    "PerfilDeclarado omitido: el catálogo Grupo_5 del formulario no está confirmado como el catálogo Perfil del MID.",
    "TipoContribuyenteId omitido: no se confirmó una fuente autorizada y el formulario no recopila este identificador.",
    "Los campos de pasos posteriores no se incluyen en el POST inicial.",
  ];
  const payload: NuevoProveedorNaturalMidPayload = {
    Tercero: tercero,
    ProveedorNatural: proveedorNatural,
  };
  if (datosDocumento) {
    payload.Tercero.DatosIdentificacion = [datosDocumento];
  } else {
    omisiones.push(
      "DatosIdentificacion omitidos: el contrato permite omitir la relación y no se construye con una clave natural incompleta.",
    );
  }
  return { payload, omisiones };
}

export function mapearPersonaJuridicaMid(
  valorFormulario: unknown,
): MapeoPayloadMid<NuevoProveedorJuridicoMidPayload> {
  const formulario = registro(valorFormulario, "persona jurídica");
  const omisiones = [
    "NIT omitido: el formulario no proporciona el TipoDocumentoId confirmado para NIT.",
    "Representante legal omitido: el MID no declara actualmente una relación escribible para este nodo.",
    "Información tributaria, dirección y contactos omitidos: el MID no declara actualmente estos campos como escribibles.",
    "Procedencia omitida: su propiedad no está declarada en el modelo escribible actual.",
    "Los campos de pasos posteriores no se incluyen en el POST inicial.",
  ];

  const tercero: TerceroMid = {
    NombreCompleto: textoRequerido(formulario, "razonSocial"),
  };

  // Solo se envían los campos societarios que el formulario todavía aporta.
  const proveedorJuridico: ProveedorJuridicoMid = {};
  const camposSocietariosOmitidos: string[] = [];

  const matricula = textoOpcional(formulario, "matriculaMercantil");
  if (matricula !== undefined) {
    proveedorJuridico.MatriculaMercantil =
      matriculaMercantilValidada(matricula);
  } else {
    camposSocietariosOmitidos.push("MatriculaMercantil");
  }

  const fechaConstitucion = fechaOpcional(formulario, "fechaConstitucion");
  if (fechaConstitucion !== undefined) {
    proveedorJuridico.FechaConstitucion = fechaConstitucion;
  } else {
    camposSocietariosOmitidos.push("FechaConstitucion");
  }

  const fechaRenovacion = fechaOpcional(formulario, "fechaRenovacion");
  if (fechaRenovacion !== undefined) {
    proveedorJuridico.FechaRenovacion = fechaRenovacion;
  } else {
    camposSocietariosOmitidos.push("FechaRenovacion");
  }

  for (const [campoFormulario, campoMid] of [
    ["beneficiariosFinales", "ReportaBeneficiosFinales"],
    ["cotizaBolsa", "CotizaBolsa"],
    ["revisorFiscal", "RequiereRevisorFiscal"],
  ] as const) {
    const valor = booleanoOpcional(formulario, campoFormulario);
    if (valor !== undefined) {
      proveedorJuridico[campoMid] = valor;
    } else {
      camposSocietariosOmitidos.push(campoMid);
    }
  }

  const nombreComercial = textoOpcional(formulario, "nombreComercial");
  if (nombreComercial) {
    proveedorJuridico.NombreComercial = nombreComercial;
  }

  if (camposSocietariosOmitidos.length > 0) {
    omisiones.push(
      `ProveedorJuridico parcial: se omitieron ${camposSocietariosOmitidos.join(", ")} porque el formulario ya no los captura.`,
    );
  }

  const payload: NuevoProveedorJuridicoMidPayload = {
    Tercero: tercero,
    ProveedorJuridico: proveedorJuridico,
  };

  return { payload, omisiones };
}
