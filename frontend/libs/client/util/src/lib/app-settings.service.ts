import { Injectable, inject, signal, effect } from '@angular/core';
import { ThemeService } from './theme.service';
import { TranslocoService } from '@jsverse/transloco';

@Injectable({
  providedIn: 'root',
})
export class AppSettingsService {
  private readonly _langKey = 'erp-lang';
  private _themeService = inject(ThemeService);
  private _translocoService = inject(TranslocoService);

  public language = signal<string>(localStorage.getItem(this._langKey) || 'pl');
  public isDarkMode = this._themeService.isDarkMode;

  public constructor() {
    effect(() => {
      const lang = this.language();
      localStorage.setItem(this._langKey, lang);

      const translocoLang = lang === 'pl' ? 'pl-PL' : 'en-US';
      this._translocoService.setActiveLang(translocoLang);
    });
  }

  public setLanguage(lang: string): void {
    this.language.set(lang);
  }

  public setDarkMode(isDark: boolean): void {
    this._themeService.setDarkMode(isDark);
  }
}
