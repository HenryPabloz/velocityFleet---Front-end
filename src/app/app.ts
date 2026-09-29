import { Component } from '@angular/core';

import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.scss',
})
export class App {
  // Injetar aqui garante que o tema salvo seja aplicado assim que o app abre.
  constructor(private temaService: ThemeService) {}
}
