import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { sharedPrimeNGConfig } from '@erp/shared/ui';
import { remoteRoutes } from '@erp/notification/contract';

import { API_BASE_URL } from '@erp/notification/data-access';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(remoteRoutes),
    sharedPrimeNGConfig,
    { provide: API_BASE_URL, useValue: 'http://localhost:5250' },
  ],
};
