import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { remoteRoutes } from '@erp/dms/contract';
import { provideRemoteDevSupport } from '@erp/shared/ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRemoteDevSupport({
      modulePrefix: 'dms',
      contractLoader: () => import('@erp/dms/contract'),
    }),
    provideBrowserGlobalErrorListeners(),
    provideRouter(remoteRoutes)
  ],
};

