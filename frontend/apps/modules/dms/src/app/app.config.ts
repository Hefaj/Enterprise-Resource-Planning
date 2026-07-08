import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { remoteRoutes } from '@erp/dms/contract';
import { provideSharedTranslations } from '@erp/shared/ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideSharedTranslations(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(remoteRoutes)
  ],
};
