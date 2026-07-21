import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { remoteRoutes } from '@erp/sales/contract';
import { provideRemoteDevSupport } from '@erp/shared/ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRemoteDevSupport({
      modulePrefix: 'sales',
      contractLoader: () => import('@erp/sales/contract'),
    }),
    provideBrowserGlobalErrorListeners(),
    provideRouter(remoteRoutes),
  ],
};

