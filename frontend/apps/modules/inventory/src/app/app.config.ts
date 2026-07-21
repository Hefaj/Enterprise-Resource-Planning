import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { remoteRoutes } from '@erp/inventory/contract';
import { provideRemoteDevSupport } from '@erp/shared/ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRemoteDevSupport({
      modulePrefix: 'inventory',
      contractLoader: () => import('@erp/inventory/contract'),
    }),
    provideBrowserGlobalErrorListeners(),
    provideRouter(remoteRoutes),
  ],
};

