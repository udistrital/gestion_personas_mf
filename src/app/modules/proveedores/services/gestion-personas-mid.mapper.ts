import {
  ActualizarProveedorJuridicoMidPayload,
  ActualizarProveedorNaturalMidPayload,
  DatosIdentificacionMid,
  MapeoPayloadMid,
  NuevoProveedorJuridicoMidPayload,
  NuevoProveedorNaturalMidPayload,
  CuentaBancariaMid,
  CuentaBancariaMidActualizacion,
  ProveedorMidMaterializado,
  ProveedorJuridicoMid,
  ProveedorNaturalMid,
  ProveedorJuridicoMidActualizacion,
  ProveedorNaturalMidActualizacion,
  TerceroMidActualizacion,
  TerceroMid,
} from "./gestion-personas-mid.models";

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

function enteroMatriculaMercantil(valor: unknown): number {
  if (!esMatriculaMercantilValida(valor)) {
    throw new Error(
      "MatriculaMercantil debe ser una cadena positiva de dígitos no superior a 999999999999999.",
    );
  }

  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero <= 0) {
    throw new Error(
      "MatriculaMercantil debe convertirse en un entero seguro positivo.",
    );
  }
  return numero;
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

function fechaRequerida(
  datos: Record<string, unknown>,
  campo: string,
): string {
  const fecha = fechaOpcional(datos, campo);
  if (!fecha) {
    throw new Error(`El campo ${campo} no contiene una fecha válida.`);
  }
  return fecha;
}

function booleanoRequerido(
  datos: Record<string, unknown>,
  campo: string,
): boolean {
  const valor = datos[campo];
  if (typeof valor !== "boolean") {
    throw new Error(`El campo ${campo} debe ser una respuesta Sí/No.`);
  }
  return valor;
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

  agregarTexto(identificacion, tercero, "PrimerNombre", "primerNombre");
  agregarTexto(identificacion, tercero, "SegundoNombre", "segundoNombre");
  agregarTexto(identificacion, tercero, "PrimerApellido", "primerApellido");
  agregarTexto(identificacion, tercero, "SegundoApellido", "segundoApellido");
  const fechaNacimiento = fechaOpcional(tercero, "FechaNacimiento");
  if (fechaNacimiento !== undefined) {
    identificacion["fechaNacimiento"] = fechaNacimiento;
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
  const cuenta = primeraRelacion(datos, "CuentaBancaria");

  agregarTexto(formulario, tercero, "NombreCompleto", "razonSocial");
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
    if (
      typeof matricula !== "number"
      || !Number.isSafeInteger(matricula)
      || matricula <= 0
    ) {
      throw new Error(
        "La consulta devolvió una MatriculaMercantil que no se puede representar con seguridad en el formulario.",
      );
    }
    formulario["matriculaMercantil"] = String(matricula);
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

  const descripcionPortafolio = textoOpcional(
    actividad,
    "portafolioCapacidadEntrega",
  );
  if (descripcionPortafolio !== undefined) {
    camposActualizados += 1;
  }

  const cuentaConsultada = primeraRelacion(datosConsultados, "CuentaBancaria");
  const cuentaId = cuentaConsultada
    ? enteroNumericoOpcional(
      cuentaConsultada["Id"],
      "CuentaBancaria.Id",
      1,
    )
    : undefined;
  let cuentaBancaria: CuentaBancariaMidActualizacion | undefined;
  if (cuentaId !== undefined) {
    cuentaBancaria = { Id: cuentaId };
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
  } else {
    omisiones.push(
      "CuentaBancaria omitida: no se enviará sin Id consultado para evitar crear una cuenta nueva.",
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
  if (cuentaBancaria && Object.keys(cuentaBancaria).length > 1) {
    payload.CuentaBancaria = [cuentaBancaria];
  } else if (cuentaBancaria) {
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
    detalle.MatriculaMercantil = enteroMatriculaMercantil(matricula);
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

  const descripcionPortafolio = textoOpcional(
    formulario,
    "descripcionServicios",
  );
  if (descripcionPortafolio !== undefined) {
    camposActualizados += 1;
  }

  const cuentaId = cuentaConsultada
    ? enteroNumericoOpcional(
      cuentaConsultada["Id"],
      "CuentaBancaria.Id",
      1,
    )
    : undefined;
  let cuentaBancaria: CuentaBancariaMidActualizacion | undefined;
  if (cuentaId !== undefined) {
    cuentaBancaria = { Id: cuentaId };
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
  } else {
    omisiones.push(
      "CuentaBancaria omitida: no se enviará sin Id consultado para evitar crear una cuenta nueva.",
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
  if (cuentaBancaria && Object.keys(cuentaBancaria).length > 1) {
    payload.CuentaBancaria = [cuentaBancaria];
  } else if (cuentaBancaria) {
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
  const finanzas = registroOpcional(
    formulario["afiliacionesFinanzas"],
    "información bancaria",
  );
  const actividad = registro(formulario["actividadDeclaracion"], "actividad");

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
    const digitoVerificacion = textoOpcional(identificacion, "dv");
    if (digitoVerificacion) {
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

  const descripcionPortafolio = textoOpcional(
    actividad,
    "portafolioCapacidadEntrega",
  );
  const omisiones = [
    "Contacto omitido: el contrato no documenta valores oficiales para Finalidad y TipoCanal.",
    "PerfilDeclarado omitido: el catálogo Grupo_5 del formulario no está confirmado como el catálogo Perfil del MID.",
    "TipoContribuyenteId omitido: no se confirmó una fuente autorizada y el formulario no recopila este identificador.",
    "Otros campos del formulario sin propiedad equivalente se mantienen en el cliente y no se envían.",
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
  if (finanzas) {
    const entidadBancariaId = enteroNumericoOpcional(
      finanzas["entidadBancaria"],
      "EntidadBancariaId",
      1,
    );
    const tipoCuentaId = enteroNumericoOpcional(
      finanzas["tipoCuenta"],
      "TipoCuentaId",
      1,
    );
    const numeroCuenta = textoOpcional(finanzas, "numeroCuentaBancaria");
    if (
      entidadBancariaId !== undefined
      && tipoCuentaId !== undefined
      && numeroCuenta
    ) {
      const cuentaBancaria: CuentaBancariaMid = {
        EntidadBancariaId: entidadBancariaId,
        TipoCuentaId: tipoCuentaId,
        NumeroCuenta: numeroCuenta,
      };
      payload.CuentaBancaria = [cuentaBancaria];
    }
  }
  if (!payload.CuentaBancaria) {
    omisiones.push(
      "CuentaBancaria omitida: el contrato permite omitirla y el formulario no aporta una cuenta completa.",
    );
  }
  if (descripcionPortafolio) {
    payload.DescripcionPortafolio = descripcionPortafolio;
  }

  return { payload, omisiones };
}

export function mapearPersonaJuridicaMid(
  valorFormulario: unknown,
): MapeoPayloadMid<NuevoProveedorJuridicoMidPayload> {
  const formulario = registro(valorFormulario, "persona jurídica");
  const omisiones = [
    "Contacto omitido: el contrato no documenta valores oficiales para Finalidad y TipoCanal.",
    "TipoContribuyenteId omitido: el formulario no recopila este identificador.",
    "CiudadExpedicion y FechaExpedicion omitidas: el formulario no las recopila.",
    "DatosIdentificacion omitidos: el catálogo de tipo documental usado por este formulario no está confirmado como el catálogo TipoDocumentoId del MID.",
    "Otros campos del formulario sin propiedad equivalente se mantienen en el cliente y no se envían.",
  ];

  const tercero: TerceroMid = {
    NombreCompleto: textoRequerido(formulario, "razonSocial"),
  };

  const proveedorJuridico: ProveedorJuridicoMid = {
    MatriculaMercantil: enteroMatriculaMercantil(
      formulario["matriculaMercantil"],
    ),
    FechaConstitucion: fechaRequerida(formulario, "fechaConstitucion"),
    FechaRenovacion: fechaRequerida(formulario, "fechaRenovacion"),
    ReportaBeneficiosFinales: booleanoRequerido(
      formulario,
      "beneficiariosFinales",
    ),
    CotizaBolsa: booleanoRequerido(formulario, "cotizaBolsa"),
    RequiereRevisorFiscal: booleanoRequerido(formulario, "revisorFiscal"),
  };
  const nombreComercial = textoOpcional(formulario, "nombreComercial");
  if (nombreComercial) {
    proveedorJuridico.NombreComercial = nombreComercial;
  }

  const cuentaBancaria: CuentaBancariaMid | undefined = (() => {
    const entidadBancariaId = enteroNumericoOpcional(
      formulario["banco"],
      "EntidadBancariaId",
      1,
    );
    const tipoCuentaId = enteroNumericoOpcional(
      formulario["tipoCuenta"],
      "TipoCuentaId",
      1,
    );
    const numeroCuenta = textoOpcional(formulario, "numeroCuenta");
    if (
      entidadBancariaId === undefined
      || tipoCuentaId === undefined
      || !numeroCuenta
    ) {
      return undefined;
    }
    const cuenta: CuentaBancariaMid = {
      EntidadBancariaId: entidadBancariaId,
      TipoCuentaId: tipoCuentaId,
      NumeroCuenta: numeroCuenta,
    };
    const ciudadAperturaId = enteroOpcional(
      formulario["ciudadApertura"],
      "CiudadAperturaId",
      1,
    );
    if (ciudadAperturaId !== undefined) {
      cuenta.CiudadAperturaId = ciudadAperturaId;
    }
    const nombreTitular = textoOpcional(formulario, "titularCuenta");
    if (nombreTitular) {
      cuenta.NombreTitular = nombreTitular;
    }
    return cuenta;
  })();
  const descripcionPortafolio = textoOpcional(
    formulario,
    "descripcionServicios",
  );
  const payload: NuevoProveedorJuridicoMidPayload = {
    Tercero: tercero,
    ProveedorJuridico: proveedorJuridico,
  };
  if (cuentaBancaria) {
    payload.CuentaBancaria = [cuentaBancaria];
  } else {
    omisiones.push(
      "CuentaBancaria omitida: el contrato permite omitirla y el formulario no aporta una cuenta completa.",
    );
  }
  if (descripcionPortafolio) {
    payload.DescripcionPortafolio = descripcionPortafolio;
  }

  return { payload, omisiones };
}
