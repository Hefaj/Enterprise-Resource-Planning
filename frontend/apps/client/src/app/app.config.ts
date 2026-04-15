import { ApplicationConfig, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { appRoutes } from '@erp/client/contract';
import { sharedPrimeNGConfig } from '@erp/shared/ui';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { STARTUP } from './STARTUP';

export const appConfig: ApplicationConfig = {
  providers: [
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
  ],
};
