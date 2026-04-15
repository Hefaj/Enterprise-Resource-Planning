import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { sharedPrimeNGConfig } from '@erp/shared/ui';
import { remoteRoutes } from '@erp/sales/contract';

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideRouter(remoteRoutes), sharedPrimeNGConfig],
};
