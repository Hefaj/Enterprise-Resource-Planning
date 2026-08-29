import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { remoteRoutes } from '@erp/dms/contract';
import { provideErpUserDirectory } from '@erp/shared/data-access';
import { provideRemoteDevSupport } from '@erp/shared/ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRemoteDevSupport({
      modulePrefix: 'dms',
      contractLoader: () => import('@erp/dms/contract'),
    }),
    provideBrowserGlobalErrorListeners(),
    provideRouter(remoteRoutes),
    ...provideErpUserDirectory('http://localhost:5280'),
  ],
};
