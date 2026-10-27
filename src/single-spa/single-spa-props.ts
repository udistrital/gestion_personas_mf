import { ReplaySubject } from 'rxjs';
import { AppProps } from 'single-spa';
import type { Rol } from '../app/core/constants/roles.const';

export const singleSpaPropsSubject = new ReplaySubject<SingleSpaProps>(1);

// Add any custom single-spa props you have to this type def
// https://single-spa.js.org/docs/building-applications.html#custom-props
/** Rol activo seleccionado por el Root para la navegación del microfrontend. */
export type SingleSpaProps = AppProps & {
  readonly rolActivo?: Rol;
};
