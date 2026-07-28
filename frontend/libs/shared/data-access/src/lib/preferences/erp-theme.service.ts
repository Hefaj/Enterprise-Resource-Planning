import { Injectable, inject, effect, signal } from '@angular/core';
import { TUI_DARK_MODE } from '@taiga-ui/core';

import { ErpUserPreferencesService } from './erp-user-preferences.service';

@Injectable({
  providedIn: 'root',
})
export class ErpThemeService {
  private readonly _darkMode = inject(TUI_DARK_MODE);
  private readonly _preferences = inject(ErpUserPreferencesService);

  public isDarkMode = signal<boolean>(this._getInitialTheme());

  public constructor() {
    effect(() => {
      const dark = this.isDarkMode();
      this._updateTheme(dark);
      this._preferences.setTheme(dark ? 'dark' : 'light');
    });
  }

  private _getInitialTheme(): boolean {
    const savedTheme = this._preferences.theme;
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private _updateTheme(isDark: boolean): void {
    this._darkMode.set(isDark);
  }

  public toggleTheme(): void {
    this.isDarkMode.update((prev) => !prev);
  }

  public setDarkMode(isDark: boolean): void {
    this.isDarkMode.set(isDark);
  }
}
