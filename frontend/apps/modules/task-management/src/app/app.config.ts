import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { remoteRoutes } from '@erp/task-management/contract';
import { provideRemoteDevSupport } from '@erp/shared/ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRemoteDevSupport({
      modulePrefix: 'task-management',
      contractLoader: () => import('@erp/task-management/contract'),
    }),
    provideBrowserGlobalErrorListeners(),
    provideRouter(remoteRoutes),
  ],
};

