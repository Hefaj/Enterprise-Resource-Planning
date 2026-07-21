import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { remoteRoutes, remoteModalIds, registerModals, getModalProviders } from '@erp/catalog/contract';
import { API_BASE_URL } from '@erp/catalog/data-access';
import { provideRemoteDevSupport } from '@erp/shared/ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRemoteDevSupport({
      modulePrefix: 'catalog',
      remoteModalIds,
      registerModals,
      getModalProviders,
    }),
    provideBrowserGlobalErrorListeners(),
    provideRouter(remoteRoutes),
    { provide: API_BASE_URL, useValue: 'http://localhost:5149' },
  ],
};

