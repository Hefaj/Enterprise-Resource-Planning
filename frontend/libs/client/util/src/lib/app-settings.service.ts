import { Injectable, inject } from '@angular/core';
import { ErpThemeService, ErpLanguageService, AppLanguage } from '@erp/shared/data-access';

@Injectable({
  providedIn: 'root',
})
export class AppSettingsService {
  private readonly _themeService = inject(ErpThemeService);
  private readonly _languageService = inject(ErpLanguageService);

  public language = this._languageService.language;
  public isDarkMode = this._themeService.isDarkMode;

  public setLanguage(lang: AppLanguage): void {
    this._languageService.setLanguage(lang);
  }

  public setDarkMode(isDark: boolean): void {
    this._themeService.setDarkMode(isDark);
  }
}
