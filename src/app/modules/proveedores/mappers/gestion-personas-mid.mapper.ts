import {
  CuentaBancariaMidPayload,
  ContactoMidPayload,
  DatosIdentificacionMidPayload,
  ProveedorJuridicoMidPayload,
  ProveedorMidPatchPayload,
  ProveedorMidPayload,
  ProveedorNaturalMidPayload,
  TerceroMidPayload,
} from "../models/gestion-personas-mid.model";

type FormValue = Record<string, unknown>;

function asRecord(value: unknown, field: string): FormValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`No se encontró el grupo "${field}" del formulario.`);
  }
  return value as FormValue;
}

function optionalText(value: unknown, field: string): string | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`El campo "${field}" no contiene texto.`);
  }
  return value.trim() ? value.trim() : undefined;
}

function optionalDate(value: unknown, field: string): string | undefined {
  const date = optionalText(value, field);
  if (date === undefined) {
    return undefined;
  }
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || Number.isNaN(parsedDate.getTime())
    || parsedDate.toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`El campo "${field}" debe contener una fecha válida (AAAA-MM-DD).`);
  }
  return date;
}

function optionalNumber(value: unknown, field: string): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`El campo "${field}" no contiene un número válido.`);
  }
  return value;
}

function optionalInteger(value: unknown, field: string): number | undefined {
  const number = optionalNumber(value, field);
  if (number !== undefined && !Number.isSafeInteger(number)) {
    throw new Error(`El campo "${field}" debe ser un número entero.`);
  }
  return number;
}

function optionalId(value: unknown, field: string): number | undefined {
  const id = optionalNumber(value, field);
  if (id === undefined) {
    return undefined;
  }
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`El campo "${field}" debe ser un identificador positivo.`);
  }
  return id;
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new Error(`El campo "${field}" no contiene un valor booleano.`);
  }
  return value;
}

function omitEmpty<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
  ) as Partial<T>;
}

function requiredTypeId(id: number | undefined, field: string): number {
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`No se encontró un identificador válido de catálogo para "${field}".`);
  }
  return id;
}

interface NombreNatural {
  completo?: string;
  primerNombre?: string;
  segundoNombre?: string;
  primerApellido?: string;
  segundoApellido?: string;
}

function mapearNombreNatural(
  identificacion: FormValue,
  exigirNombreCompleto: boolean,
): NombreNatural {
  const primerNombre = optionalText(
    identificacion["primerNombre"],
    "primerNombre",
  );
  const segundoNombre = optionalText(
    identificacion["segundoNombre"],
    "segundoNombre",
  );
  const primerApellido = optionalText(
    identificacion["primerApellido"],
    "primerApellido",
  );
  const segundoApellido = optionalText(
    identificacion["segundoApellido"],
    "segundoApellido",
  );
  if (exigirNombreCompleto && (!primerNombre || !primerApellido)) {
    throw new Error("El nombre y primer apellido son obligatorios para registrar la persona.");
  }
  const completo = primerNombre && primerApellido
    ? [
        primerNombre,
        segundoNombre,
        primerApellido,
        segundoApellido,
      ].filter((parte): parte is string => parte !== undefined).join(" ")
    : undefined;
  return {
    completo,
    primerNombre,
    ...(segundoNombre ? { segundoNombre } : {}),
    primerApellido,
    ...(segundoApellido ? { segundoApellido } : {}),
  };
}

function mapearTerceroNatural(
  root: FormValue,
  tipoContribuyenteId: number,
  terceroId?: number,
): TerceroMidPayload {
  const identificacion = asRecord(root["identificacion"], "identificacion");
  const nombre = mapearNombreNatural(
    identificacion,
    terceroId === undefined,
  );
  let datosIdentificacion: DatosIdentificacionMidPayload[] | undefined;
  if (terceroId === undefined) {
    const numero = optionalText(
      identificacion["numeroDocumento"],
      "numeroDocumento",
    );
    const tipoDocumentoId = optionalId(
      identificacion["tipoDocumento"],
      "tipoDocumento",
    );
    if (!numero) {
      throw new Error("El número de documento es obligatorio para registrar la persona.");
    }
    if (tipoDocumentoId === undefined) {
      throw new Error("El tipo de documento debe corresponder a un catálogo válido.");
    }

    const documento: DatosIdentificacionMidPayload = {
      Numero: numero,
      TipoDocumentoId: tipoDocumentoId,
      ...omitEmpty({
        DigitoVerificacion: optionalText(identificacion["dv"], "dv"),
        CiudadExpedicion: optionalId(
          identificacion["ciudadExpedicion"],
          "ciudadExpedicion",
        ),
        FechaExpedicion: optionalDate(
          identificacion["fechaExpedicion"],
          "fechaExpedicion",
        ),
      }),
    };
    datosIdentificacion = [documento];
  }

  return {
    ...(terceroId === undefined
      ? {}
      : { Id: optionalId(terceroId, "Tercero.Id") }),
    ...(nombre.completo ? { NombreCompleto: nombre.completo } : {}),
    TipoContribuyenteId: requiredTypeId(
      tipoContribuyenteId,
      "Tercero.TipoContribuyenteId",
    ),
    ...omitEmpty({
      PrimerNombre: nombre.primerNombre,
      SegundoNombre: nombre.segundoNombre,
      PrimerApellido: nombre.primerApellido,
      SegundoApellido: nombre.segundoApellido,
    }),
    FechaNacimiento: optionalDate(
      identificacion["fechaNacimiento"],
      "fechaNacimiento",
    ),
    ...(datosIdentificacion ? { DatosIdentificacion: datosIdentificacion } : {}),
  };
}

function mapearContacto(
  nombreContacto: unknown,
  valorEspecifico: unknown,
  extension?: unknown,
): ContactoMidPayload | undefined {
  const nombre = optionalText(nombreContacto, "NombreContacto");
  const valor = optionalText(valorEspecifico, "ValorEspecifico");
  if (!nombre && !valor) {
    return undefined;
  }
  return omitEmpty({
    NombreContacto: nombre,
    ValorEspecifico: valor,
    Extension: valor ? optionalText(extension, "Extension") : undefined,
  });
}

function mapearContactosPersonaNatural(
  root: FormValue,
  nombreCompleto: string,
): ContactoMidPayload[] | undefined {
  const contacto = asRecord(root["contacto"], "contacto");
  const finanzas = asRecord(root["afiliacionesFinanzas"], "afiliacionesFinanzas");
  const contactos = [
    mapearContacto(nombreCompleto, contacto["correoElectronico"]),
    mapearContacto(nombreCompleto, contacto["telefonoCelular"]),
    mapearContacto(
      nombreCompleto,
      contacto["otroContacto"],
      contacto["extensionTelefonica"],
    ),
    mapearContacto(
      contacto["contactoEmergencia"],
      contacto["telefonoContactoEmergencia"],
    ),
    mapearContacto(nombreCompleto, contacto["sitioWebPortafolio"]),
    mapearContacto(
      nombreCompleto,
      finanzas["correoNotificacionesTesoreria"],
    ),
  ].filter((contactoMid): contactoMid is ContactoMidPayload => contactoMid !== undefined);
  return contactos.length > 0 ? contactos : undefined;
}

function mapearCuentaBancariaNatural(
  root: FormValue,
): CuentaBancariaMidPayload[] | undefined {
  const finanzas = asRecord(root["afiliacionesFinanzas"], "afiliacionesFinanzas");
  const cuenta: CuentaBancariaMidPayload = omitEmpty({
    EntidadBancariaId: optionalId(
      finanzas["entidadBancaria"],
      "entidadBancaria",
    ),
    TipoCuentaId: optionalId(finanzas["tipoCuenta"], "tipoCuenta"),
    NumeroCuenta: optionalText(
      finanzas["numeroCuentaBancaria"],
      "numeroCuentaBancaria",
    ),
  });
  return Object.values(cuenta).some((value) => value !== undefined)
    ? [cuenta]
    : undefined;
}

function mapearDatosPersonaNatural(
  formValue: unknown,
  tipoRegistroId: number | undefined,
  tipoContribuyenteId: number,
  terceroId?: number,
): ProveedorMidPayload {
  const root = asRecord(formValue, "raíz");
  const identificacion = asRecord(root["identificacion"], "identificacion");
  const experiencia = asRecord(root["experiencia"], "experiencia");
  const actividadDeclaracion = asRecord(
    root["actividadDeclaracion"],
    "actividadDeclaracion",
  );
  const nombre = mapearNombreNatural(
    identificacion,
    terceroId === undefined,
  );
  const proveedorNatural: Partial<ProveedorNaturalMidPayload> = omitEmpty({
    PerfilDeclarado: optionalId(
      identificacion["perfilRolPrincipal"],
      "perfilRolPrincipal",
    ),
    ExperienciaLaboralMeses: optionalInteger(
      experiencia["experienciaLaboralTotal"],
      "experienciaLaboralTotal",
    ),
    ExperienciaProfesionalMeses: optionalInteger(
      experiencia["experienciaProfesional"],
      "experienciaProfesional",
    ),
  });
  const tipoRegistro = requiredTypeId(
    tipoRegistroId,
    "Proveedor.TipoRegistroId",
  );
  const contactos = terceroId === undefined
    ? mapearContactosPersonaNatural(root, nombre.completo ?? "")
    : undefined;
  const cuentasBancarias = terceroId === undefined
    ? mapearCuentaBancariaNatural(root)
    : undefined;
  const descripcionPortafolio = optionalText(
    actividadDeclaracion["portafolioCapacidadEntrega"],
    "portafolioCapacidadEntrega",
  );

  return {
    TipoRegistroId: tipoRegistro,
    Tercero: mapearTerceroNatural(root, tipoContribuyenteId, terceroId),
    ProveedorNatural: proveedorNatural,
    ...omitEmpty({
      DescripcionPortafolio: descripcionPortafolio,
    }),
    ...(contactos ? { Contacto: contactos } : {}),
    ...(cuentasBancarias ? { CuentaBancaria: cuentasBancarias } : {}),
  };
}

export function mapearCreacionPersonaNatural(
  formValue: unknown,
  tipoRegistroId: number | undefined,
  tipoContribuyenteId: number,
): ProveedorMidPayload {
  return mapearDatosPersonaNatural(
    formValue,
    tipoRegistroId,
    tipoContribuyenteId,
  );
}

export function mapearActualizacionPersonaNatural(
  formValue: unknown,
  tipoRegistroId: number,
  tipoContribuyenteId: number,
  terceroId: number,
): ProveedorMidPatchPayload {
  return mapearDatosPersonaNatural(
    formValue,
    tipoRegistroId,
    tipoContribuyenteId,
    terceroId,
  );
}

function mapearCuentaBancariaJuridica(
  root: FormValue,
  cuentaBancariaId?: number,
): CuentaBancariaMidPayload[] | undefined {
  const entidadBancariaId = optionalId(root["banco"], "banco");
  const tipoCuentaId = optionalId(root["tipoCuenta"], "tipoCuenta");
  const numeroCuenta = optionalText(root["numeroCuenta"], "numeroCuenta");
  const confirmacionNumeroCuenta = optionalText(
    root["numeroCuentaConfirmacion"],
    "numeroCuentaConfirmacion",
  );
  const nombreTitular = optionalText(root["titularCuenta"], "titularCuenta");
  const ciudadAperturaId = optionalId(
    root["ciudadApertura"],
    "ciudadApertura",
  );
  if (numeroCuenta && !/^\d{8,20}$/.test(numeroCuenta)) {
    throw new Error("El número de cuenta debe contener entre 8 y 20 dígitos.");
  }
  if (numeroCuenta && confirmacionNumeroCuenta !== numeroCuenta) {
    throw new Error("La confirmación del número de cuenta no coincide.");
  }
  if (
    entidadBancariaId === undefined
    || tipoCuentaId === undefined
    || !numeroCuenta
    || !nombreTitular
    || ciudadAperturaId === undefined
  ) {
    return undefined;
  }

  return [
    {
      ...(cuentaBancariaId === undefined
        ? {}
        : { Id: optionalId(cuentaBancariaId, "CuentaBancaria.Id") }),
      EntidadBancariaId: entidadBancariaId,
      TipoCuentaId: tipoCuentaId,
      NumeroCuenta: numeroCuenta,
      NombreTitular: nombreTitular,
      CiudadAperturaId: ciudadAperturaId,
      EsPrincipal: true,
    },
  ];
}

function mapearContactosPersonaJuridica(
  root: FormValue,
  razonSocial: string,
): ContactoMidPayload[] | undefined {
  const nombreRepresentante = [
    optionalText(root["primerNombre"], "primerNombre"),
    optionalText(root["segundoNombre"], "segundoNombre"),
    optionalText(root["primerApellido"], "primerApellido"),
    optionalText(root["segundoApellido"], "segundoApellido"),
  ].filter((parte): parte is string => parte !== undefined).join(" ");
  const nombreTesoreria = optionalText(
    root["responsableTesoreria"],
    "responsableTesoreria",
  );
  const contactoComercial = optionalText(
    root["contactoComercial"],
    "contactoComercial",
  );
  const contactos = [
    mapearContacto(nombreRepresentante, root["correoRepresentante"]),
    mapearContacto(nombreRepresentante, root["telefonoRepresentante"]),
    mapearContacto(nombreRepresentante, root["correoNotificaciones"]),
    mapearContacto(
      nombreRepresentante,
      root["telefonoFijo"],
      root["extension"],
    ),
    mapearContacto(nombreRepresentante, root["telefonoAlterno"]),
    mapearContacto(razonSocial, root["sitioWeb"]),
    mapearContacto(contactoComercial, root["telefonoAsesor"]),
    mapearContacto(nombreTesoreria, root["correoPagos"]),
    mapearContacto(nombreTesoreria, root["telefonoTesoreria"]),
  ].filter((contactoMid): contactoMid is ContactoMidPayload => contactoMid !== undefined);
  return contactos.length > 0 ? contactos : undefined;
}

function mapearDatosPersonaJuridica(
  formValue: unknown,
  tipoRegistroId: number | undefined,
  tipoContribuyenteId: number,
  terceroId?: number,
  cuentaBancariaId?: number,
  permitirCrearCuentaBancaria: boolean = false,
  tipoDocumentoNitId?: number,
): ProveedorMidPayload {
  const root = asRecord(formValue, "raíz");
  const razonSocial = optionalText(root["razonSocial"], "razonSocial");
  if (!razonSocial) {
    throw new Error("La razón social es obligatoria para registrar la persona jurídica.");
  }
  const tipoRegistro = requiredTypeId(
    tipoRegistroId,
    "Proveedor.TipoRegistroId",
  );

  const matriculaTexto = optionalText(
    root["matriculaMercantil"],
    "matriculaMercantil",
  );
  const matricula = matriculaTexto === undefined
    ? undefined
    : Number(matriculaTexto);
  if (
    matricula !== undefined
    && (!Number.isSafeInteger(matricula) || matricula <= 0)
  ) {
    throw new Error("La matrícula mercantil debe ser un entero positivo.");
  }
  const datosIdentificacion = terceroId === undefined
    ? (() => {
        const numero = optionalText(root["nit"], "nit");
        if (!numero) {
          throw new Error("El NIT es obligatorio para registrar la persona jurídica.");
        }
        const tipoDocumentoId = tipoDocumentoNitId === undefined
          ? undefined
          : optionalId(tipoDocumentoNitId, "TipoDocumentoId NIT");
        return tipoDocumentoId === undefined
          ? undefined
          : [{
              Numero: numero,
              TipoDocumentoId: tipoDocumentoId,
              ...omitEmpty({
                DigitoVerificacion: optionalText(
                  root["digitoVerificacion"],
                  "digitoVerificacion",
                ),
              }),
            }];
      })()
    : undefined;

  const proveedorJuridico: Partial<ProveedorJuridicoMidPayload> = omitEmpty({
    NombreComercial: optionalText(root["nombreComercial"], "nombreComercial"),
    MatriculaMercantil: matricula,
    FechaConstitucion: optionalDate(
      root["fechaConstitucion"],
      "fechaConstitucion",
    ),
    FechaRenovacion: optionalDate(root["fechaRenovacion"], "fechaRenovacion"),
    ReportaBeneficiosFinales: optionalBoolean(
      root["beneficiariosFinales"],
      "beneficiariosFinales",
    ),
    CotizaBolsa: optionalBoolean(root["cotizaBolsa"], "cotizaBolsa"),
    RequiereRevisorFiscal: optionalBoolean(
      root["revisorFiscal"],
      "revisorFiscal",
    ),
  });
  const cuentaBancaria = cuentaBancariaId !== undefined
    || permitirCrearCuentaBancaria
    ? mapearCuentaBancariaJuridica(root, cuentaBancariaId)
    : undefined;
  const contactos = terceroId === undefined
    ? mapearContactosPersonaJuridica(root, razonSocial)
    : undefined;
  const descripcionPortafolio = optionalText(
    root["descripcionServicios"],
    "descripcionServicios",
  );

  return {
    TipoRegistroId: tipoRegistro,
    Tercero: {
      ...(terceroId === undefined
        ? {}
        : { Id: optionalId(terceroId, "Tercero.Id") }),
      TipoContribuyenteId: requiredTypeId(
        tipoContribuyenteId,
        "Tercero.TipoContribuyenteId",
      ),
      NombreCompleto: razonSocial,
      ...(datosIdentificacion ? { DatosIdentificacion: datosIdentificacion } : {}),
    },
    ProveedorJuridico: proveedorJuridico,
    ...(cuentaBancaria ? { CuentaBancaria: cuentaBancaria } : {}),
    ...(contactos ? { Contacto: contactos } : {}),
    ...omitEmpty({ DescripcionPortafolio: descripcionPortafolio }),
  };
}

export function mapearCreacionPersonaJuridica(
  formValue: unknown,
  tipoRegistroId: number | undefined,
  tipoContribuyenteId: number,
  tipoDocumentoNitId?: number,
): ProveedorMidPayload {
  return mapearDatosPersonaJuridica(
    formValue,
    tipoRegistroId,
    tipoContribuyenteId,
    undefined,
    undefined,
    true,
    tipoDocumentoNitId,
  );
}

export function mapearActualizacionPersonaJuridica(
  formValue: unknown,
  tipoRegistroId: number,
  tipoContribuyenteId: number,
  terceroId: number,
  cuentaBancariaId?: number,
  permitirCrearCuentaBancaria = false,
): ProveedorMidPatchPayload {
  return mapearDatosPersonaJuridica(
    formValue,
    tipoRegistroId,
    tipoContribuyenteId,
    terceroId,
    cuentaBancariaId,
    permitirCrearCuentaBancaria,
  );
}
