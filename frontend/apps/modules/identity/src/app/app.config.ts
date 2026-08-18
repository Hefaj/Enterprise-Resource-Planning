import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { remoteRoutes, remoteModalIds, registerModals, getModalProviders } from '@erp/identity/contract';
import { API_BASE_URL } from '@erp/identity/data-access';
import { provideRemoteDevSupport } from '@erp/shared/ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRemoteDevSupport({
      modulePrefix: 'identity',
      remoteModalIds,
      registerModals,
      getModalProviders,
    }),
    provideBrowserGlobalErrorListeners(),
    provideRouter(remoteRoutes),
    { provide: API_BASE_URL, useValue: 'http://localhost:5280' },
  ],
};
