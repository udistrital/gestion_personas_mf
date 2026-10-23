import { Component, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'campo-dinero',
  templateUrl: './campo-dinero.component.html',
  styleUrls: ['./campo-dinero.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CampoDineroComponent),
      multi: true,
    },
  ],
  standalone: false,
})
export class CampoDineroComponent implements ControlValueAccessor {
  valorMostrado = '';
  deshabilitado = false;

  private propagarCambio: (valor: number | null) => void = () => {};
  private propagarTocado: () => void = () => {};

  writeValue(valor: number | string | null): void {
    this.valorMostrado = this.formatear(valor);
  }

  registerOnChange(fn: (valor: number | null) => void): void {
    this.propagarCambio = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.propagarTocado = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado = deshabilitado;
  }

  actualizarValor(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const posicionAnterior = entrada.selectionStart ?? entrada.value.length;
    const digitosAntesDelCursor = entrada.value
      .slice(0, posicionAnterior)
      .replace(/\D/g, '').length;
    const digitos = entrada.value.replace(/\D/g, '');
    this.valorMostrado = this.formatear(digitos);
    entrada.value = this.valorMostrado;
    const posicionNueva = this.posicionDespuesDeDigitos(
      this.valorMostrado,
      digitosAntesDelCursor,
    );
    entrada.setSelectionRange(posicionNueva, posicionNueva);
    this.propagarCambio(digitos ? Number(digitos) : null);
  }

  marcarComoTocado(): void {
    this.propagarTocado();
  }

  permitirSoloDigitos(evento: KeyboardEvent): void {
    if (evento.ctrlKey || evento.metaKey || evento.altKey) {
      return;
    }

    const teclasPermitidas = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!teclasPermitidas.includes(evento.key) && !/^\d$/.test(evento.key)) {
      evento.preventDefault();
    }
  }

  private formatear(valor: number | string | null): string {
    const digitos = String(valor ?? '').replace(/\D/g, '');
    return digitos ? Number(digitos).toLocaleString('es-CO') : '';
  }

  private posicionDespuesDeDigitos(valor: string, cantidadDigitos: number): number {
    if (cantidadDigitos === 0) {
      return 0;
    }

    let digitosEncontrados = 0;
    for (let posicion = 0; posicion < valor.length; posicion++) {
      if (/\d/.test(valor[posicion])) {
        digitosEncontrados++;
      }
      if (digitosEncontrados === cantidadDigitos) {
        return posicion + 1;
      }
    }

    return valor.length;
  }
}
