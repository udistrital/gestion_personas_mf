import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { SharedModule } from '../../../../../shared/shared.module';

@Component({
  selector: 'app-registro-persona-natural-paso-4',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    SharedModule,
  ],
  templateUrl: './registro-persona-natural-paso-4.component.html',
  styleUrl: './registro-persona-natural-paso-4.component.scss',
})
export class RegistroPersonaNaturalPaso4Component {
  @Input({ required: true })
  actividadDeclaracionForm!: FormGroup;
}
