import { Injectable, inject, effect, signal } from '@angular/core';
import { TUI_DARK_MODE } from '@taiga-ui/core';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly _themeKey = 'erp-theme';
  private readonly _darkMode = inject(TUI_DARK_MODE);

  public isDarkMode = signal<boolean>(this._getInitialTheme());

  public constructor() {
    effect(() => {
      const dark = this.isDarkMode();
      this._updateTheme(dark);
      localStorage.setItem(this._themeKey, dark ? 'dark' : 'light');
    });
  }

  private _getInitialTheme(): boolean {
    const savedTheme = localStorage.getItem(this._themeKey);
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
