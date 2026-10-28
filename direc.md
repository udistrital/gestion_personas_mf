# Directriz para el agente: consumo de catálogos en Cotizaciones

Implementar el consumo de datos paramétricos en el módulo de **Cotizaciones**, tomando como referencia el consumo existente en el módulo de **Registro de Personas**.

## 1. Catálogos que se deben consumir

| Campo en Cotizaciones | Servicio | `area_tipo` | `tipo_parametro` |
|---|---|---|---|
| Unidad ejecutora | Parámetros | `COTIZACIONES` | `EST_SOL_COT` |
| Nombre del bien / servicio | UNSPSC, mediante el servicio utilizado en Registro de Proveedores | Según la implementación existente | Según la implementación existente |
| Código o palabra clave CIIU | Parámetros | Sin filtro por título ni código de abreviación | `CIIU` |
| Medio de pago | Parámetros | Sin filtro por título ni código de abreviación | `MPA` |
| Tipo de forma de pago | Parámetros | Sin filtro por título ni código de abreviación | `TIP_FOR_PAG_COT` |
| Clasificación | Parámetros | `COTIZACIONES` | `CLAS_REQ_DOC_COT` |
| Tipo de contrato | Parámetros | Sin filtro por título ni código de abreviación | `TIP_FOR_PAG_COT` |
| Estado de la solicitud | Parámetros | `COTIZACIONES` | `EST_SOL_COT` |
| Tipo de cotización | Parámetros | `COTIZACIONES` | `TIP_NEC_COT` |

**Consideraciones:**
- Para UNSPSC, revisar y reutilizar el servicio y el patrón de consumo empleados en Registro de Proveedores. No implementar un consumo nuevo si ya existe uno reutilizable.
- El catálogo CIIU debe utilizarse tanto para el campo de código o palabra clave CIIU como para cualquier selección de CIIU contemplada en esta directriz.
- Respetar los filtros indicados para cada catálogo. Cuando se especifica que no debe filtrarse por título ni código de abreviación, no agregar esos filtros.
- Mantener `TIP_FOR_PAG_COT` para Tipo de contrato, tal como se especifica en los requerimientos, sin sustituirlo por otro código por iniciativa propia.

## 2. Implementación

1. Inspeccionar cómo Registro de Personas consume los servicios de Parámetros y cómo Registro de Proveedores consume UNSPSC.
2. Identificar los servicios, modelos, métodos y mecanismos de carga que puedan reutilizarse en Cotizaciones.
3. Implementar el consumo de los catálogos indicados y conectarlos con sus respectivos campos en la interfaz.
4. Respetar la arquitectura, las convenciones y los patrones existentes en el proyecto.
5. Limitar los cambios a los consumos y campos enumerados. No modificar estilos, estructura funcional, otros formularios ni datos que no estén incluidos en este alcance.

## 3. Restricciones

- No intentar consumir otros catálogos ni otros datos del módulo.
- No modificar campos ajenos a los enumerados.
- No ejecutar pruebas.
- No ejecutar comandos Git, cambiar de rama, crear commits ni realizar operaciones sobre el repositorio.
- No hacer refactorizaciones generales ni cambios adicionales fuera del alcance solicitado.

## 4. Resultado esperado

Dejar implementado el consumo de los nueve campos definidos, siguiendo los patrones de los módulos de referencia y manteniendo intacto el resto de Cotizaciones.

Al finalizar, informar brevemente qué archivos se modificaron, qué consumo se implementó para cada campo y si quedó algún impedimento concreto. No afirmar que se realizaron pruebas.