import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { ConsentimientoService } from '../services/consentimiento.service';

@Injectable({
  providedIn: 'root',
})
export class ConsentimientoGuard implements CanActivate {

  constructor(private consentimientoService: ConsentimientoService, private router: Router) { }

  canActivate(): boolean | UrlTree {
    return this.consentimientoService.aceptado()
      ? true
      : this.router.createUrlTree(['/proveedores']);
  }
}