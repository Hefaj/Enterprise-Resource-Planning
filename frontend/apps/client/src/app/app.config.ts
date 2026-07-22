import { ApplicationConfig, LOCALE_ID, isDevMode, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { appRoutes } from '@erp/client/contract';
import { provideHttpClient } from '@angular/common/http';
import { STARTUP } from './STARTUP';
import { registerLocaleData } from '@angular/common';
import localePl from '@angular/common/locales/pl';
import { provideTransloco } from '@jsverse/transloco';
import { provideSharedTranslations, TranslocoInlineLoader } from '@erp/shared/ui';
import { remoteApiProviders } from './remote-api.providers';
import { provideTaiga } from '@taiga-ui/core';
import { TUI_LANGUAGE } from '@taiga-ui/i18n';
import { AppLanguage, LanguageService } from '@erp/client/util';

registerLocaleData(localePl);

export const appConfig: ApplicationConfig = {
  providers: [
    provideTaiga(),
    provideSharedTranslations(),
    provideRouter(
      appRoutes,
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
      withViewTransitions({
        skipInitialTransition: true, // Opcjonalne: pomija animację przy pierwszym ładowaniu
      }),
    ),
    provideHttpClient(),
    provideZonelessChangeDetection(),
    provideAppInitializer(STARTUP),
    { provide: LOCALE_ID, useValue: 'pl-PL' },
    {
      provide: TUI_LANGUAGE,
      useFactory: (service: LanguageService) => service.tuiLanguage,
      deps: [LanguageService],
    },
    ...remoteApiProviders,
    provideTransloco({
      config: {
        availableLangs: ['pl-PL', 'en-US'] as AppLanguage[],
        defaultLang: 'pl-PL' as AppLanguage,
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
        missingHandler: {
          logMissingKey: false,
        },
      },
      loader: TranslocoInlineLoader,
    }),
  ],
};


