# agora_gestion_personas_mf

Microcliente **core de Ágora** que aloja los submódulos de registro (gestión de personas naturales y jurídicas). Empaquetado como microfrontend con Single-SPA.

## Especificaciones Técnicas

### Tecnologías Implementadas y Versiones

- **Angular** `21.2.23`
  - Incluye Animations, Common, Compiler, Core, Forms, Platform-Browser, Platform-Browser-Dynamic, Router
- **Angular Material** `21.2.14` (incluye `@angular/cdk`)
- **RxJS** `~7.8.0`
- **Single-spa** `>=4.0.0`
  - Incluye `single-spa-angular` `21.0.2`
- **Bootstrap** `^5.3.0`
- **crypto-js** `^4.2.0`
- **SweetAlert2** `^11.26.24`
- **tslib** `^2.8.1`
- **Zone.js** `~0.15.1`
- **TypeScript** `~5.9.2`

## Variables de Entorno

Las variables se definen en `src/environments/`:

- `environment.ts` — configuración por defecto (local)
- `environment.development.ts` — ambiente de pruebas
- `environment.production.ts` — ambiente de producción

## Ejecución del Proyecto

Este proyecto es parte de una infraestructura de microfrontend implementada con la librería Single-SPA. Para ejecutarlo correctamente, es necesario levantar una aplicación independiente: el **Root**.

### Root

El Root contiene la lógica de Ágora y gestiona el enrutamiento de todos los microfrontends.

#### Pasos para la Ejecución del Root

1. Clonar el repositorio del Root:

   ```bash
   git clone <URL_DEL_REPOSITORIO_ROOT>
   ```

2. Acceder al directorio del repositorio clonado:

   ```bash
   cd <directorio_root>
   ```

3. Instalar las dependencias:

   ```bash
   pnpm install
   ```

4. Iniciar el Root:

   ```bash
   pnpm start
   ```

### agora_gestion_personas_mf

Microcliente core de Ágora que aloja los submódulos de registro.

#### Pasos para la Ejecución del mf

1. Clonar el repositorio:

   ```bash
   git clone <URL_DEL_REPOSITORIO_AGORA_GESTION_PERSONAS_MF>
   ```

2. Acceder al directorio del repositorio clonado:

   ```bash
   cd agora_gestion_personas_mf
   ```

3. Instalar las dependencias:

   ```bash
   pnpm install
   ```

4. Iniciar el microfrontend:

   ```bash
   pnpm start
   ```

   El microfrontend queda disponible en el puerto **4203** (`http://localhost:4203/main.js`).

Con estos pasos, se tendrán las partes mínimas necesarias para ejecutar el proyecto en un entorno local.

## Ejecución Dockerfile

```
# Does not apply
```

## Ejecución docker-compose

```
# Does not apply
```

## Ejecución Pruebas

```
# Developing
```

## Navegación del registro de Persona Natural

En el registro de Persona Natural se puede seleccionar cualquier paso directamente desde el stepper, incluso uno posterior al paso actual. La validación de los datos se conserva al usar el botón **Continuar** y al finalizar; navegar directamente entre pasos no elimina ni modifica las validaciones.

## Estado CI

| Develop | Release | Master |
| ------- | ------- | ------ |
| Build Status | Build Status | Build Status |

## Licencia

This file is part of agora_gestion_personas_mf

agora_gestion_personas_mf is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

agora_gestion_personas_mf is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with agora_gestion_personas_mf. If not, see https://www.gnu.org/licenses/.
