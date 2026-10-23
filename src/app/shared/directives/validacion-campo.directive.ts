import { AfterViewInit, Directive, ElementRef, OnDestroy, OnInit, Renderer2 } from '@angular/core';
import { NgControl } from '@angular/forms';
import { Subscription } from 'rxjs';

@Directive({
  selector: '[formControlName]',
  standalone: false,
})
export class ValidacionCampoDirective implements AfterViewInit, OnDestroy, OnInit {
  private suscripcion = new Subscription();
  private mensaje?: HTMLSpanElement;
  private contenedor?: HTMLElement;

  constructor(
    private readonly elemento: ElementRef<HTMLElement>,
    private readonly renderer: Renderer2,
    private readonly control: NgControl,
  ) {}

  ngOnInit(): void {
    this.contenedor = this.elemento.nativeElement.closest('.campo, .opciones, .checkbox-line') ?? undefined;
  }

  ngAfterViewInit(): void {
    this.suscripcion = this.control.statusChanges?.subscribe(() => this.actualizar()) ?? new Subscription();
    this.actualizar();
  }

  ngOnDestroy(): void {
    this.suscripcion.unsubscribe();
    this.renderer.removeClass(this.elemento.nativeElement, 'campo--invalido');
    this.eliminarMensaje();
  }

  private actualizar(): void {
    const control = this.control.control;
    if (!control || !this.contenedor) {
      return;
    }

    const mostrarError = control.invalid && (control.touched || control.dirty);
    this.renderer[mostrarError ? 'addClass' : 'removeClass'](this.contenedor, 'campo--invalido');
    this.renderer[mostrarError ? 'addClass' : 'removeClass'](this.elemento.nativeElement, 'campo--invalido');

    if (mostrarError) {
      this.mostrarMensaje(this.obtenerMensaje(control.errors));
    } else {
      this.eliminarMensaje();
    }
  }

  private mostrarMensaje(texto: string): void {
    if (!this.mensaje) {
      this.mensaje = this.renderer.createElement('span');
      this.renderer.addClass(this.mensaje, 'mensaje-error-formulario');
      this.renderer.appendChild(this.contenedor, this.mensaje);
    }
    this.renderer.setProperty(this.mensaje, 'textContent', texto);
  }

  private eliminarMensaje(): void {
    if (this.mensaje) {
      this.renderer.removeChild(this.contenedor, this.mensaje);
      this.mensaje = undefined;
    }
  }

  private obtenerMensaje(errores: Record<string, unknown> | null): string {
    if (errores?.['required']) {
      return 'Este campo no puede estar vacío.';
    }
    if (errores?.['pattern']) {
      return 'El valor no sigue el formato esperado.';
    }
    return 'El valor ingresado no es válido.';
  }
}
