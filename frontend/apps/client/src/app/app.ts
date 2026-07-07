import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TuiRoot, TUI_DARK_MODE } from '@taiga-ui/core';

@Component({
  imports: [RouterModule, TuiRoot],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly darkMode = inject(TUI_DARK_MODE);

  constructor() {
    const savedTheme = localStorage.getItem('erp-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    this.darkMode.set(isDark);
  }
}

