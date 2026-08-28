import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { getModalProviders, registerModals, remoteModalIds, remoteRoutes } from '@erp/task-management/contract';
import { provideRemoteDevSupport } from '@erp/shared/ui';
import { provideErpUserDirectory } from '@erp/shared/data-access';
import { API_BASE_URL } from '@erp/task-management/data-access';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRemoteDevSupport({
      modulePrefix: 'task-management',
      // Kontrakt jest już potrzebny synchronicznie dla routingu samodzielnego remote'a.
      // Nie importujemy go drugi raz dynamicznie: Nx traktuje wtedy tę samą bibliotekę jako
      // jednocześnie eager i lazy, co łamie granice modułów. Same definicje modali pozostają
      // leniwe wewnątrz `registerModals` i `getModalProviders` kontraktu.
      contractLoader: async () => ({ remoteModalIds, registerModals, getModalProviders }),
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
