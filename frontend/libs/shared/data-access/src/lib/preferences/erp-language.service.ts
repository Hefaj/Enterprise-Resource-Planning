import { Injectable, inject, signal, effect, computed } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { TUI_POLISH_LANGUAGE, TUI_ENGLISH_LANGUAGE, TuiLanguage } from '@taiga-ui/i18n';
import { BehaviorSubject } from 'rxjs';

import { ErpUserPreferencesService } from './erp-user-preferences.service';

export type AppLanguage = 'pl-PL' | 'en-US';

@Injectable({
  providedIn: 'root',
})
export class ErpLanguageService {
  private readonly _preferences = inject(ErpUserPreferencesService);
  private readonly _translocoService = inject(TranslocoService);

  public language = signal<AppLanguage>(this._getInitialLanguage());

  public readonly tuiLanguage = computed<TuiLanguage>(() => {
    const lang = this.language();
    return lang === 'pl-PL' ? TUI_POLISH_LANGUAGE : TUI_ENGLISH_LANGUAGE;
  });

  private readonly _tuiLanguage$ = new BehaviorSubject<TuiLanguage>(TUI_POLISH_LANGUAGE);
  public readonly tuiLanguage$ = this._tuiLanguage$.asObservable();

  public constructor() {
    effect(() => {
      const lang = this.language();
      this._preferences.setLanguage(lang);
      this._translocoService.setActiveLang(lang);

      const tuiLang = lang === 'pl-PL' ? TUI_POLISH_LANGUAGE : TUI_ENGLISH_LANGUAGE;
      this._tuiLanguage$.next(tuiLang);
    });
  }

  private _getInitialLanguage(): AppLanguage {
    const saved = this._preferences.language;
    return (saved === 'pl-PL' || saved === 'en-US') ? saved : 'pl-PL';
  }

  public setLanguage(lang: AppLanguage): void {
    this.language.set(lang);
  }
}
