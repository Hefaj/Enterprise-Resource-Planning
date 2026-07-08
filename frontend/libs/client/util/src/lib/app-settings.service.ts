import { Injectable, inject } from '@angular/core';
import { ThemeService } from './theme.service';
import { LanguageService, AppLanguage } from './language.service';

@Injectable({
  providedIn: 'root',
})
export class AppSettingsService {
  private readonly _themeService = inject(ThemeService);
  private readonly _languageService = inject(LanguageService);

  public language = this._languageService.language;
  public isDarkMode = this._themeService.isDarkMode;

  public setLanguage(lang: AppLanguage): void {
    this._languageService.setLanguage(lang);
  }

  public setDarkMode(isDark: boolean): void {
    this._themeService.setDarkMode(isDark);
  }
}
