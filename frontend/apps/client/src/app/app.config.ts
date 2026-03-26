import { ApplicationConfig, inject, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import {
  provideRouter,
  withEnabledBlockingInitialNavigation,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { appRoutes } from './app.routes';
import { ErpNavigationItem, ErpNavRegistryService } from '@erp/shared/data-access';

import { sharedPrimeNGConfig } from '@erp/shared/ui';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { REMOTE_MODULES_CONFIG, RemoteModuleConfig } from './configuration/REMOTE_MODULES_CONFIG';
import { loadRemote } from '@module-federation/enhanced/runtime';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      appRoutes,
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
      withEnabledBlockingInitialNavigation(),
      withViewTransitions({
        skipInitialTransition: true, // Opcjonalne: pomija animację przy pierwszym ładowaniu
      }),
    ),
    provideHttpClient(withFetch()),
    provideZonelessChangeDetection(),
    sharedPrimeNGConfig,
    provideAppInitializer(STARTUP),
  ],
};

async function STARTUP(): Promise<void> {
  const menuRegistry = inject(ErpNavRegistryService);

  menuRegistry.register({
    id: 'dashbord',
    label: 'Home',
    iconId: 'home',
    route: 'dashbord',
  });

  const loadPromises = REMOTE_MODULES_CONFIG.map((config) => loadMenuFromRemote(config));
  const remoteMenus = await Promise.all(loadPromises);

  for (const menu of remoteMenus) {
    if (menu) {
      menuRegistry.register(menu);
    }
  }
}

interface EntryMenuModule {
  remoteMenu: ErpNavigationItem[];
}

async function loadMenuFromRemote(config: RemoteModuleConfig): Promise<ErpNavigationItem | null> {
  try {
    const module = await loadRemote<EntryMenuModule>(config.path);

    if (module?.remoteMenu) {
      const prefixedMenu = applyRoutePrefixToMenu(module.remoteMenu, config.routePrefix);

      return {
        id: config.id,
        label: config.label,
        children: prefixedMenu,
      };
    }

    return null;
  } catch (error) {
    console.warn(`[MFE Gateway] Nie udało się załadować manifestu menu z ${config.path}.`, error);
    return null;
  }
}

function applyRoutePrefixToMenu(items: ErpNavigationItem[], prefix: string): ErpNavigationItem[] {
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
      newItem.children = applyRoutePrefixToMenu(newItem.children as ErpNavigationItem[], prefix);
    }

    return newItem;
  });
}
