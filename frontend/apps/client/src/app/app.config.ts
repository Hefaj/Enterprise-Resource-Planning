import { ApplicationConfig, Injectable, LOCALE_ID, isDevMode, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { appRoutes } from '@erp/client/contract';
import { sharedPrimeNGConfig } from '@erp/shared/ui';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { STARTUP } from './STARTUP';
import { registerLocaleData } from '@angular/common';
import localePl from '@angular/common/locales/pl';
import { Translation, TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { provideSharedTranslations } from '@erp/shared/ui';
import { Observable, of } from 'rxjs';
import { remoteApiProviders } from './remote-api.providers';

@Injectable({ providedIn: 'root' })
export class TranslocoInlineLoader implements TranslocoLoader {
  public getTranslation(lang: string): Observable<Translation> {
    return of({});
  }
}

registerLocaleData(localePl);

export const appConfig: ApplicationConfig = {
  providers: [
    provideSharedTranslations(),
    provideRouter(
      appRoutes,
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
      withEnabledBlockingInitialNavigation(),
      withViewTransitions({
        skipInitialTransition: true, // Opcjonalne: pomija animację przy pierwszym ładowaniu
      }),
    ),
    provideHttpClient(withFetch()),
    provideZonelessChangeDetection(),
    sharedPrimeNGConfig,
    provideAppInitializer(STARTUP),
    { provide: LOCALE_ID, useValue: 'pl-PL' },
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
