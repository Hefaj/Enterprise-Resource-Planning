import { Injectable, effect, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly THEME_KEY = 'erp-theme';
  public isDarkMode = signal<boolean>(this.getInitialTheme());

  constructor() {
    effect(() => {
      const dark = this.isDarkMode();
      this.updateTheme(dark);
      localStorage.setItem(this.THEME_KEY, dark ? 'dark' : 'light');
    });
  }

  private getInitialTheme(): boolean {
    const savedTheme = localStorage.getItem(this.THEME_KEY);
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private updateTheme(isDark: boolean): void {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  public toggleTheme(): void {
    this.isDarkMode.update((prev) => !prev);
  }

  public setDarkMode(isDark: boolean): void {
    this.isDarkMode.set(isDark);
  }
}
