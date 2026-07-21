import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { remoteRoutes } from '@erp/notification/contract';
import { API_BASE_URL } from '@erp/notification/data-access';
import { provideRemoteDevSupport } from '@erp/shared/ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRemoteDevSupport({
      modulePrefix: 'notification',
      contractLoader: () => import('@erp/notification/contract'),
    }),
    provideBrowserGlobalErrorListeners(),
    provideRouter(remoteRoutes),
    { provide: API_BASE_URL, useValue: 'http://localhost:5250' },
  ],
};

