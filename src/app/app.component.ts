import { Component } from "@angular/core";
import { RolService } from "./core/services/rol.service";

@Component({
  selector: 'agora-gestion-personas-mf',
  templateUrl: './app.component.html',
  standalone: false
})
export class AppComponent {
  title = "agora_gestion_personas_mf";

  constructor(private readonly rolService: RolService) {}

  ngOnInit(): void {
    this.rolService.cargarRoles();
  }
}
