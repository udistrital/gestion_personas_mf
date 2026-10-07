import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { ConsentimientoService } from '../services/consentimiento.service';

@Injectable({
  providedIn: 'root',
})
export class ConsentimientoGuard implements CanActivate {

  constructor(private consentimientoService: ConsentimientoService, private router: Router) { }

  canActivate() {
    if (this.consentimientoService.aceptado()) return true;

    return this.router.navigateByUrl("/proveedores");
  }
}