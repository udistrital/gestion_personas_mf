import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { interval, startWith, Subscription } from "rxjs";

type EstadoCierre = "normal" | "proximo" | "cerrado";

@Component({
  selector: "contador-regresivo",
  templateUrl: "./contador-regresivo.component.html",
  styleUrls: ["./contador-regresivo.component.scss"],
  standalone: false,
})
export class ContadorRegresivoComponent implements OnInit, OnDestroy {
  @Input({ required: true }) fechaCierre: string | null = null;
  @Input() etiquetaCerrado = "Finalizado";

  texto = "Fecha de cierre no disponible";
  estado: EstadoCierre = "normal";
  private ahora = Date.now();
  private actualizacion?: Subscription;

  ngOnInit(): void {
    this.actualizacion = interval(60_000)
      .pipe(startWith(0))
      .subscribe(() => {
        this.ahora = Date.now();
        this.actualizar();
      });
  }

  ngOnDestroy(): void {
    this.actualizacion?.unsubscribe();
  }

  private actualizar(): void {
    const cierre = fechaFinal(this.fechaCierre);
    if (!cierre) {
      this.texto = "Fecha de cierre no disponible";
      this.estado = "normal";
      return;
    }

    const restante = cierre.getTime() - this.ahora;
    if (restante <= 0) {
      this.texto = this.etiquetaCerrado;
      this.estado = "cerrado";
      return;
    }

    const minutos = Math.floor(restante / 60_000);
    const dias = Math.floor(minutos / (24 * 60));
    const horas = Math.floor((minutos % (24 * 60)) / 60);
    const minutosRestantes = minutos % 60;
    this.texto =
      dias > 0
        ? `Cierra en ${dias} d ${horas} h`
        : horas > 0
          ? `Cierra en ${horas} h ${minutosRestantes} m`
          : `Cierra en ${minutosRestantes} min`;
    this.estado = restante <= 3 * 24 * 60 * 60 * 1000 ? "proximo" : "normal";
  }
}

function fechaFinal(valor: string | null): Date | null {
  if (!valor) {
    return null;
  }

  const partes = valor.split("/").map(Number);
  if (partes.length === 3 && partes.every(Number.isFinite)) {
    const [dia, mes, anio] = partes;
    const verificacion = new Date(Date.UTC(anio, mes - 1, dia));
    if (
      !dia ||
      !mes ||
      !anio ||
      verificacion.getUTCDate() !== dia ||
      verificacion.getUTCMonth() !== mes - 1 ||
      verificacion.getUTCFullYear() !== anio
    ) {
      return null;
    }
    const fechaIso = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    return new Date(`${fechaIso}T23:59:59.999-05:00`);
  }

  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}
