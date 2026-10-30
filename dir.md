# Directriz de implementación: Consumo de dependencias y unidades de medida

## 1. Objetivo

Implementar dos consumos de datos paramétricos en el microfrontend de Gestión de Personas / Gestión de Proveedores de Ágora:

1. Consumo del servicio Oikos para obtener las dependencias institucionales y utilizar sus nombres en los desplegables correspondientes.
2. Consumo del servicio Parámetros, ya integrado en el proyecto, para obtener las unidades de medida registradas bajo el tipo de parámetro `U_COMERCIO`, destinadas al apartado de **Crear solicitud de cotización, stepper 3**.

La implementación debe seguir los patrones arquitectónicos, servicios, modelos, manejo de autenticación y convenciones que ya existen en el proyecto.

---

## 2. Consumo de dependencias – Servicio Oikos

### 2.1. Configuración del servicio

Incorporar una nueva variable de entorno en el archivo de configuración correspondiente (`env`), siguiendo exactamente la convención utilizada para los demás servicios.

Nombre sugerido:

`OIKOS_SERVICE`

Valor:

`https://autenticacion.portaloas.udistrital.edu.co/apioas/oikos_crud_api/v2/`

No modificar las variables existentes ni alterar la configuración de otros servicios.

### 2.2. Endpoint

Realizar la siguiente petición:

- Método: `GET`
- Endpoint: `/dependencia`
- URL completa: `https://autenticacion.portaloas.udistrital.edu.co/apioas/oikos_crud_api/v2/dependencia`

El consumo debe realizarse utilizando el mecanismo de autenticación e interceptor HTTP que ya está implementado en el microfrontend.

No implementar mecanismos de autenticación adicionales.

### 2.3. Estructura de respuesta

El servicio devuelve un arreglo de objetos con la siguiente estructura general:

```json
[
  {
    "Id": 11,
    "Nombre": "OFICINA ASESORA DE PLANEACION Y CONTROL",
    "TelefonoDependencia": "3239300 Secretaria: 1806",
    "CorreoElectronico": "planeac@udistrital.edu.co",
    "Activo": true,
    "FechaCreacion": "2022-07-06T19:45:10.995513Z",
    "FechaModificacion": "2022-07-06T19:45:10.995513Z",
    "DependenciaTipoDependencia": [
      {
        "Id": 5,
        "TipoDependenciaId": {
          "Id": 5,
          "Nombre": "OFICINA ASESORA",
          "Descripcion": "",
          "CodigoAbreviacion": "",
          "Activo": true
        },
        "DependenciaId": {
          "Id": 11,
          "Nombre": "OFICINA ASESORA DE PLANEACION Y CONTROL"
        },
        "Activo": true
      }
    ]
  }
]
```

La respuesta real puede contener diferentes cantidades de dependencias y relaciones de tipos de dependencia.

### 2.4. Implementación requerida

- Crear la integración siguiendo la estructura de servicios utilizada actualmente en el proyecto.
- Definir las interfaces o modelos TypeScript necesarios para representar la respuesta.
- Obtener el arreglo de dependencias del endpoint.
- Utilizar principalmente las propiedades:
  - `Id`: identificador de la dependencia.
  - `Nombre`: nombre que se mostrará en los desplegables.
  - `Activo`: estado de la dependencia.
- Implementar el mapeo necesario para alimentar los componentes de selección.

### 2.5. Consideraciones

- No utilizar nombres de dependencias quemados en el código.
- No utilizar identificadores estáticos.
- Los valores deben provenir directamente del servicio.
- Conservar el identificador original (`Id`) como valor asociado a cada opción.
- Mostrar `Nombre` como etiqueta del desplegable.
- Evitar duplicar llamadas HTTP innecesariamente.
- Si el proyecto ya cuenta con un patrón de almacenamiento o reutilización de catálogos, aprovecharlo.
- No es necesario consumir los datos internos de `DependenciaTipoDependencia` para esta implementación, salvo que el funcionamiento actual de algún componente lo requiera expresamente.
- Mantener el comportamiento y los estilos actuales de los formularios.

---

## 3. Consumo de unidades de medida – Servicio Parámetros

### 3.1. Servicio existente

El servicio de Parámetros ya se encuentra integrado en el microfrontend y es utilizado en otros apartados.

Por lo tanto, **no crear una nueva configuración de servicio ni duplicar su integración**.

Reutilizar:

- La variable de entorno existente.
- El servicio HTTP actual.
- Los modelos e interfaces disponibles.
- Los mecanismos de autenticación e interceptores existentes.
- El mecanismo de consulta y filtrado que ya utiliza el proyecto para los datos paramétricos.

### 3.2. Criterio de búsqueda

Se requiere consultar los valores asociados al siguiente tipo de parámetro:

`U_COMERCIO`

La búsqueda debe realizarse utilizando el filtro correspondiente a:

`tipo_parametro`

Valor:

`U_COMERCIO`

Se debe respetar la estructura de consulta que actualmente utiliza el servicio de Parámetros en el proyecto.

No inventar nuevos endpoints ni modificar la implementación existente del servicio para resolver esta consulta.

### 3.3. Implementación requerida

- Identificar el servicio y método existente que permite consultar parámetros.
- Reutilizarlo para filtrar por `tipo_parametro = U_COMERCIO`.
- Obtener los valores registrados para este tipo de parámetro.
- Adaptar la respuesta al formato requerido por el componente de selección.
- Utilizar los valores reales provenientes del servicio, sin definir unidades manualmente.
- Conservar los identificadores originales de los valores paramétricos para su posterior utilización.

### 3.4. Ubicación funcional

El consumo debe alimentar el siguiente apartado:

**Crear solicitud de cotización → Stepper 3.**

En este paso se deben utilizar las unidades de medida obtenidas mediante la consulta del tipo de parámetro `U_COMERCIO`.

El desplegable debe mostrar la información descriptiva de cada unidad de medida, conservando su identificador como valor asociado a la opción.

No modificar otros steppers ni otros apartados que ya consuman parámetros.

---

## 4. Restricciones de implementación

Las siguientes restricciones son obligatorias:

1. No ejecutar pruebas unitarias, pruebas de integración ni pruebas E2E.
2. No ejecutar comandos de Git.
3. No crear ramas, realizar commits, push, pull ni modificar el estado del repositorio.
4. No realizar una revisión posterior para comprobar si los datos se están consumiendo correctamente.
5. No realizar solicitudes HTTP manuales para validar los endpoints.
6. No modificar funcionalidades que no estén directamente relacionadas con los dos consumos solicitados.
7. No alterar estilos, estructuras visuales ni comportamientos existentes de los formularios.
8. No duplicar servicios, configuraciones, interceptores ni mecanismos de autenticación.
9. No introducir datos estáticos para sustituir los valores que deben provenir de los servicios.

## 5. Alcance de los archivos

Identificar los archivos estrictamente necesarios para implementar los cambios:

- Archivo de variables de entorno.
- Servicio nuevo de Oikos para dependencias.
- Interfaces o modelos necesarios para la respuesta de Oikos.
- Servicio o componente existente que deba reutilizarse para alimentar los desplegables de dependencias.
- Servicio de Parámetros existente, únicamente si requiere alguna adaptación mínima.
- Componente y lógica del stepper 3 de Crear solicitud de cotización.

No crear archivos adicionales si la arquitectura actual permite reutilizar los existentes.

## 6. Resultado esperado

Al finalizar la implementación:

**Consumo de dependencias:**
- El microfrontend contará con una configuración para Oikos.
- Existirá un consumo de `GET /dependencia`.
- Los desplegables correspondientes obtendrán dinámicamente los nombres de las dependencias.
- Cada opción conservará el identificador original de Oikos.

**Consumo de unidades de medida:**
- Se reutilizará el servicio de Parámetros existente.
- Se consultarán los valores asociados a `tipo_parametro = U_COMERCIO`.
- El stepper 3 de Crear solicitud de cotización dispondrá de las unidades de medida dinámicamente.
- Cada opción conservará su identificador paramétrico.

Al terminar, presentar únicamente un resumen de los archivos modificados y de la implementación realizada. No ejecutar pruebas, comandos Git ni verificaciones adicionales.