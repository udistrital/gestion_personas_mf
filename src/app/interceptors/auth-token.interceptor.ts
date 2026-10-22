import { Injectable } from "@angular/core";
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from "@angular/common/http";
import { Observable } from "rxjs";

@Injectable()
export class AuthTokenInterceptor implements HttpInterceptor {
  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    const token = localStorage.getItem("access_token");

    const esApiInstitucional = request.url.startsWith(
      "https://autenticacion.portaloas.udistrital.edu.co/apioas/",
    );

    console.log("[AuthTokenInterceptor] URL:", request.url);
    console.log("[AuthTokenInterceptor] Token presente:", !!token);
    console.log(
      "[AuthTokenInterceptor] API institucional:",
      esApiInstitucional,
    );

    if (!token || !esApiInstitucional) {
      return next.handle(request);
    }

    console.log("[AuthTokenInterceptor] Agregando Authorization Bearer");

    return next.handle(
      request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      }),
    );
  }
}
