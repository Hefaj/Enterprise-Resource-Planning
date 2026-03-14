import { ApplicationConfig, inject, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation, withInMemoryScrolling } from '@angular/router';
import { appRoutes } from './app.routes';
import { NavigationItem, NavRegistryService } from '@erp/shared/data-access';

import { sharedPrimeNGConfig } from '@erp/shared/ui';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { Observable } from 'rxjs';
import { REMOTE_MODULES_CONFIG, RemoteModuleConfig } from './configuration/REMOTE_MODULES_CONFIG';
import { loadRemote } from '@module-federation/enhanced/runtime';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      appRoutes,
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
      withEnabledBlockingInitialNavigation(),
    ),
    provideHttpClient(withFetch()),
    provideZonelessChangeDetection(),
    sharedPrimeNGConfig,
    provideAppInitializer(STARTUP),
  ],
};

async function STARTUP(): Promise<void | Observable<unknown> | Promise<unknown>> {
  const menuRegistry = inject(NavRegistryService);
  const loadPromises = REMOTE_MODULES_CONFIG.map((config) => loadMenuFromRemote(config, menuRegistry));

  return Promise.all(loadPromises);
}

interface EntryMenuModule {
  remoteMenu: NavigationItem[];
}

async function loadMenuFromRemote(config: RemoteModuleConfig, menuRegistry: NavRegistryService): Promise<void> {
  try {
    const module = await loadRemote<EntryMenuModule>(config.path);
    if (module?.remoteMenu) {
      const prefixedMenu = applyRoutePrefixToMenu(module.remoteMenu, config.routePrefix);

      menuRegistry.register({
        id: config.id,
        label: config.label,
        children: prefixedMenu,
      });
    }
  } catch (error) {
    console.warn(`Nie udało się załadować lekkiego manifestu menu z ${config.path}.`, error);
  }
}

function applyRoutePrefixToMenu(items: NavigationItem[], prefix: string): NavigationItem[] {
  return items.map((item) => {
    const newItem = { ...item };

    if (newItem.route) {
      if (Array.isArray(newItem.route)) {
        newItem.route = [`/${prefix}`, ...newItem.route];
      } else {
        const cleanLink = newItem.route.startsWith('/') ? newItem.route.slice(1) : newItem.route;

        newItem.route = `/${prefix}/${cleanLink}`;
      }
    }

    if (newItem.children && Array.isArray(newItem.children)) {
      newItem.children = applyRoutePrefixToMenu(newItem.children as NavigationItem[], prefix);
    }

    return newItem;
  });
}
