import { Injectable, inject, signal, effect } from '@angular/core';
import { PrimeNG } from 'primeng/config';
import { ThemeService } from './theme.service';
import { TranslocoService } from '@jsverse/transloco';

@Injectable({
  providedIn: 'root',
})
export class AppSettingsService {
  private readonly _langKey = 'erp-lang';
  private _themeService = inject(ThemeService);
  private _primengConfig = inject(PrimeNG);
  private _translocoService = inject(TranslocoService);

  public language = signal<string>(localStorage.getItem(this._langKey) || 'pl');
  public isDarkMode = this._themeService.isDarkMode;

  public constructor() {
    effect(() => {
      const lang = this.language();
      localStorage.setItem(this._langKey, lang);
      this._updatePrimeNGTranslation(lang);

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

  private _updatePrimeNGTranslation(lang: string): void {
    if (lang === 'pl') {
      this._primengConfig.setTranslation({
        dayNames: ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"],
        dayNamesShort: ["Nie", "Pon", "Wto", "Śro", "Czw", "Pią", "Sob"],
        dayNamesMin: ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "Sb"],
        monthNames: ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"],
        monthNamesShort: ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"],
        today: 'Dzisiaj',
        clear: 'Wyczyść',
        weekHeader: 'Tydz',
      });
    } else {
      this._primengConfig.setTranslation({
        dayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        dayNamesShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        dayNamesMin: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
        monthNames: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
        monthNamesShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        today: 'Today',
        clear: 'Clear',
        weekHeader: 'Wk',
      });
    }
  }
}
