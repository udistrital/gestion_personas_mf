import {
  DatosIdentificacionMid,
  MapeoPayloadMid,
  NuevoProveedorJuridicoMidPayload,
  NuevoProveedorNaturalMidPayload,
  CuentaBancariaMid,
  ProveedorJuridicoMid,
  ProveedorNaturalMid,
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
