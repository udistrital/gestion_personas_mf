
import { NgModule } from "@angular/core";
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import {
  MAT_DATE_LOCALE,
  provideNativeDateAdapter,
  MAT_DATE_FORMATS,
} from "@angular/material/core";
import { AuthTokenInterceptor } from "./interceptors/auth-token.interceptor";

@NgModule({
  declarations: [AppComponent],
  bootstrap: [AppComponent],
  imports: [
    AppRoutingModule,
    BrowserModule,
    BrowserAnimationsModule,
  ],
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthTokenInterceptor,
      multi: true,
    },
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: "es-CO" },
    {
      provide: MAT_DATE_FORMATS,
      useValue: {
        parse: { dateInput: "dd/MM/yyyy" },
        display: { dateInput: "dd/MM/yyyy" },
      },
    },
  ],
})
export class AppModule {}