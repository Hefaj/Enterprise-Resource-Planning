import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { remoteRoutes } from '@erp/task-management/contract';
import { provideRemoteDevSupport } from '@erp/shared/ui';
import { provideErpUserDirectory } from '@erp/shared/data-access';
import { API_BASE_URL } from '@erp/task-management/data-access';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRemoteDevSupport({
      modulePrefix: 'task-management',
      contractLoader: () => import('@erp/task-management/contract'),
    }),
    provideBrowserGlobalErrorListeners(),
    provideRouter(remoteRoutes),
    // Adresy backendów dla remote'a uruchomionego SAMODZIELNIE (`nx serve task-management`).
    // W hoście te same tokeny ustawia `remote-api.providers.ts`; bez nich uruchomiony osobno
    // moduł strzelałby pod własny origin.
    { provide: API_BASE_URL, useValue: 'http://localhost:5290' },
    ...provideErpUserDirectory('http://localhost:5280'),
  ],
};

