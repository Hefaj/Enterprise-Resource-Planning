import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { sharedPrimeNGConfig } from '@erp/shared/ui';
import { remoteRoutes } from '@erp/catalog/contract';
import { API_BASE_URL } from '@erp/catalog/data-access';
import { provideSharedTranslations } from '@erp/shared/ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideSharedTranslations(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(remoteRoutes),
    sharedPrimeNGConfig,
    { provide: API_BASE_URL, useValue: 'http://localhost:5149' },
  ],
};
