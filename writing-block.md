# Directriz final — Cierre de issue #26: integración de datos paramétricos

## Objetivo

Revisar y completar la integración de datos paramétricos de los formularios **Persona Natural y Persona Jurídica**, atendiendo las subtareas pendientes, corrigiendo los campos faltantes identificados y verificando los criterios de aceptación.

La prioridad es completar la carga dinámica de catálogos, las relaciones entre campos, los estados de carga y error, y las validaciones funcionales de los formularios.

**Alcance obligatorio:** no implementar la generación, construcción ni envío del payload del formulario. Tampoco modificar la lógica de `submit` relacionada con ese proceso.

## 1. Revisar el estado actual

Antes de realizar cambios:

- Inspeccionar ambos formularios, sus servicios de catálogos, los modelos y las plantillas HTML.
- Identificar qué subtareas ya están implementadas y conservar su comportamiento.
- Verificar que las consultas paramétricas utilicen los filtros por `CodigoAbreviacion` correspondientes.
- Conservar la paginación mediante `limit` y `offset`, recuperando las páginas necesarias antes de aplicar filtros sobre los resultados.
- Verificar el consumo de las versiones correctas de las APIs, especialmente la versión 2 de Ubicaciones que ya se identificó como la adecuada.
- No modificar la autenticación, los interceptores ni la configuración de WSO2 sin evidencia de un defecto relacionado con esta issue.

No reescribir implementaciones funcionales ni duplicar servicios, modelos o lógica existente.

## 2. Persona Jurídica: campo de responsabilidades fiscales

Revisar el **stepper 1** del formulario de Persona Jurídica.

Actualmente, el formulario exige un dato relacionado con la pregunta:

**«Responsabilidades Fiscales en Casilla 53 del RUT vigente»**

Sin embargo, no existe un control visible que permita seleccionar o ingresar el valor requerido, por lo que el usuario no puede avanzar.

Se requiere:

- Identificar dónde se define la validación que impide avanzar y qué control o dato está esperando.
- Revisar la información paramétrica disponible y la documentación existente para determinar cómo debe representarse este campo.
- Incorporar el control faltante en el lugar correspondiente del formulario.
- Si el campo corresponde a un catálogo, cargar sus opciones desde el servicio oficial y asociarlas con sus identificadores reales, siguiendo el patrón de los demás campos paramétricos.
- Si se trata de una selección múltiple, respetar el comportamiento que establezcan el contrato y la implementación existente; no asumir que es un campo de selección única.
- Asegurar que el control permita satisfacer la validación del stepper cuando se proporcione una respuesta válida.

No inventar códigos de catálogo, identificadores, opciones ni endpoints. Si no existe información suficiente para establecer la fuente oficial del campo, documentar exactamente qué dato falta y no sustituirlo por opciones estáticas inventadas.

## 3. Persona Natural: relacionar HIJOS y NUMERO_HIJOS

Revisar la pregunta de Persona Natural que determina si la persona tiene hijos y el campo condicional que permite indicar cuántos tiene.

La información proporcionada para Terceros contiene estos registros:

- `HIJOS`, con `Id: 45`, `CodigoAbreviacion: HIJOS`, activo y asociado al grupo `Grupo_9` — Información Socioeconómica.
- `NUMERO_HIJOS`, con `Id: 46`, `CodigoAbreviacion: NUMERO_HIJOS`, activo y asociado al mismo grupo `Grupo_9`.

Usar los códigos de abreviación como referencia para localizar los registros mediante el servicio correspondiente. Los identificadores anteriores sirven como evidencia de los registros proporcionados, no como valores que deban codificarse directamente en el formulario.

### Comportamiento esperado

- Relacionar la pregunta sobre si tiene hijos con el registro `HIJOS`.
- Cuando la respuesta sea afirmativa, mostrar el campo **«¿Cuántos hijos tiene?»**, asociado a `NUMERO_HIJOS`.
- Permitir que el usuario indique la cantidad mediante un control adecuado para un número entero no negativo.
- Cuando la respuesta sea negativa, ocultar el campo de cantidad y evitar que permanezca una respuesta anterior que pueda provocar inconsistencias en el estado del formulario.
- Mantener el comportamiento de los campos condicionales coherente con el resto del formulario.
- No crear opciones estáticas para representar estos registros ni asumir que `HIJOS` y `NUMERO_HIJOS` son catálogos de opciones: son registros de información complementaria y deben integrarse según el modelo existente.

Esta corrección se limita a la interfaz, el estado del formulario y la relación con los datos paramétricos. No implementar todavía el almacenamiento de las respuestas ni la construcción del payload para el backend.

## 4. Estados de carga, errores y reintentos

Revisar ambos formularios para confirmar que los catálogos tengan estados de carga, manejo de errores y mecanismos de reintento coherentes.

- Mostrar el estado de carga mientras se obtienen los datos.
- Presentar mensajes de error claros cuando falle una consulta.
- Mantener disponible el botón «Reintentar» cuando corresponda.
- Evitar que el fallo de un catálogo impida mostrar otros catálogos que sí se hayan cargado correctamente, siempre que la implementación permita aislar las solicitudes.
- Verificar que el reintento vuelva a consultar los datos fallidos sin romper los que ya se cargaron correctamente.
- No mostrar opciones falsas ni tratar un error de servicio como una lista válida vacía sin informar al usuario.

Conservar el tratamiento de errores de Ubicaciones ya implementado. No reintroducir el bloqueo global de los catálogos por una solicitud fallida.

## 5. Ajuste visual mínimo del mensaje de error

En la vista donde aparecen los errores de carga de catálogos, el mensaje está demasiado pegado al botón «Reintentar».

Realizar únicamente un ajuste sutil para aumentar el espacio entre ambos elementos y mejorar su legibilidad.

- Preferir las clases y convenciones de estilo que ya existan en el proyecto.
- Modificar el HTML o la clase de espaciado existente cuando sea suficiente.
- Evitar rediseños, cambios de colores, tamaños, tipografías o estructura general.
- No modificar archivos de estilos globales ni introducir nuevos archivos de estilos para resolver este detalle, salvo que sea estrictamente indispensable y esté justificado.

## 6. Verificación de todas las subtareas

Revisar y documentar el estado de cada punto de la issue:

1. Identificación y mapeo de endpoints para los campos desplegables de ambos formularios.
2. Servicios de Persona Natural para tipos de documento, género, estado civil, ocupación y demás catálogos definidos.
3. Servicios de Persona Jurídica para tipo de sociedad, actividad económica CIIU, régimen tributario y demás catálogos definidos.
4. Campos dependientes de ubicación y otras relaciones en cascada.
5. Sustitución de opciones estáticas por opciones dinámicas, sin eliminar constantes que no sean catálogos.
6. Estados de carga, mensajes de error y reintentos.
7. Corrección del campo de responsabilidades fiscales en Persona Jurídica.
8. Integración de `HIJOS` y `NUMERO_HIJOS` en Persona Natural.
9. Ajuste mínimo de espaciado entre el mensaje de error y el botón de reintento.
10. Identificación de campos faltantes y documentación de aquellos cuya fuente oficial no esté disponible.

Para cada subtarea, indicar si está completada, parcialmente completada, pendiente o bloqueada, junto con la evidencia correspondiente.

## 7. Pruebas y validación

Ejecutar las verificaciones disponibles en el proyecto:

- Compilación de producción o la verificación de build apropiada.
- `git diff --check`.
- Revisión estática de ambos formularios y sus servicios.
- Pruebas funcionales locales de los campos afectados, si el entorno permite ejecutarlas.

Comprobar especialmente:

- Que los catálogos se carguen con las opciones esperadas.
- Que las listas dependientes se actualicen al cambiar la selección padre.
- Que Persona Jurídica pueda superar la validación del stepper 1 al completar correctamente el campo de responsabilidades fiscales.
- Que Persona Natural muestre y oculte la cantidad de hijos según la respuesta.
- Que los errores de catálogos no bloqueen innecesariamente los demás campos.
- Que el reintento funcione y el espaciado visual se haya corregido.

No afirmar que se hicieron pruebas funcionales ni que se verificó el consumo real de las APIs si no fue posible ejecutarlas. Distinguir claramente las comprobaciones estáticas de las pruebas en ejecución.

## 8. Restricciones

- No generar, construir, transformar ni enviar el payload.
- No implementar ni modificar el envío del formulario como parte de esta issue.
- No alterar la autenticación ni el interceptor.
- No modificar Persona Jurídica mientras se resuelven asuntos exclusivos de Persona Natural, ni viceversa, salvo cambios compartidos estrictamente necesarios y justificados.
- No inventar endpoints, filtros, códigos, identificadores u opciones.
- No agregar módulos, dependencias, archivos, pruebas unitarias o infraestructura que no sean necesarios para el alcance.
- No hacer refactorizaciones generales ni cambios visuales adicionales.
- Preservar todos los cambios existentes ajenos a esta intervención, incluidos los cambios locales no relacionados.

## 9. Entrega del agente

Al finalizar, entregar un resumen con:

- Archivos modificados y motivo de cada modificación.
- Tabla de subtareas y criterios de aceptación con su estado y evidencia.
- Resultado de compilación y `git diff --check`.
- Pruebas funcionales ejecutadas y sus resultados.
- Campos faltantes, bloqueos o dependencias pendientes, si existen.
- Confirmación explícita de que no se modificó la generación ni el envío del payload.

No declarar la issue completamente terminada si alguno de los criterios de aceptación continúa sin resolver o sin una explicación documentada.

**Resultado esperado:** dejar cerrada la integración de catálogos de Persona Natural y Persona Jurídica, con las dos correcciones funcionales identificadas, estados de error coherentes y el ajuste visual mínimo, sin incluir el proceso de generación del payload.