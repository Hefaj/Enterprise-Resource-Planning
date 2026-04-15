import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { sharedPrimeNGConfig } from '@erp/shared/ui';
import { remoteRoutes } from '@erp/inventory/contract';

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideRouter(remoteRoutes), sharedPrimeNGConfig],
};
