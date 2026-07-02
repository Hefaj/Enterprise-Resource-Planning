import { ApplicationConfig, Injectable, LOCALE_ID, isDevMode, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { appRoutes } from '@erp/client/contract';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { STARTUP } from './STARTUP';
import { registerLocaleData } from '@angular/common';
import localePl from '@angular/common/locales/pl';
import { Translation, TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { provideSharedTranslations } from '@erp/shared/ui';
import { Observable, of } from 'rxjs';
import { remoteApiProviders } from './remote-api.providers';
import { provideTaiga } from '@taiga-ui/core';
import { TUI_LANGUAGE, TUI_POLISH_LANGUAGE } from '@taiga-ui/i18n';

@Injectable({ providedIn: 'root' })
export class TranslocoInlineLoader implements TranslocoLoader {
  public getTranslation(lang: string): Observable<Translation> {
    return of({});
  }
}

registerLocaleData(localePl);

export const appConfig: ApplicationConfig = {
  providers: [
    provideTaiga(),
    provideSharedTranslations(),
    provideRouter(
      appRoutes,
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
      withEnabledBlockingInitialNavigation(),
      withViewTransitions({
        skipInitialTransition: true, // Opcjonalne: pomija animację przy pierwszym ładowaniu
      }),
    ),
    provideHttpClient(),
    provideZonelessChangeDetection(),
    provideAppInitializer(STARTUP),
    { provide: LOCALE_ID, useValue: 'pl-PL' },
    // {
    //   provide: TUI_LANGUAGE,
    //   useValue: of(TUI_POLISH_LANGUAGE),
    // },
    ...remoteApiProviders,
    provideTransloco({
      config: {
        availableLangs: ['pl-PL', 'en-US'],
        defaultLang: 'pl-PL',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoInlineLoader,
    }),
  ],
};


