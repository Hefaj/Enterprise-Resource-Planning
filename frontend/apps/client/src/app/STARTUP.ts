import { inject } from '@angular/core';
import { REMOTE_MODULES_CONFIG, RemoteModuleConfig } from '@erp/client/contract';
import { ErpNavRegistryService, ErpNavigationItem, cacheRemoteRoutes } from '@erp/shared/data-access';
import { ErpModalService } from '@erp/shared/ui';
import { ThemeService, LanguageService } from '@erp/client/util';
import { loadRemoteModule } from '@angular-architects/native-federation';

export async function STARTUP(): Promise<void> {
  const menuRegistry = inject(ErpNavRegistryService);
  const modalService = inject(ErpModalService);
  inject(ThemeService); // Triggers initialization and effect
  inject(LanguageService); // Triggers language initialization and effect

  menuRegistry.register({
    id: 'dashbord',
    label: 'Home',
    iconId: 'home',
    route: 'dashbord',
  });

  const loadPromises = REMOTE_MODULES_CONFIG.map((config) => loadContractFromRemote(config, modalService));
  const remoteMenus = await Promise.all(loadPromises);

  for (const menu of remoteMenus) {
    if (menu) {
      menuRegistry.register(menu);
    }
  }
}

interface EntryContractModule {
  remoteMenu?: ErpNavigationItem[];
  remoteModalIds?: string[];
  remoteRoutes?: any[];
}

async function loadContractFromRemote(
  config: RemoteModuleConfig,
  modalService: ErpModalService,
): Promise<ErpNavigationItem | null> {
  try {
    const module = (await loadRemoteModule({
      remoteName: config.routePrefix,
      exposedModule: './contract',
    })) as EntryContractModule;

    // Cache the remote routes for later use in routing
    if (module?.remoteRoutes) {
      cacheRemoteRoutes(config.id, module.remoteRoutes);
    }

    // Rejestruj mapowanie modalId → modulePrefix (lekkie, tylko stringi)
    if (module?.remoteModalIds) {
      modalService.registerModalIds(config.routePrefix, module.remoteModalIds);
    }

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
    console.warn(`[MFE Gateway] Nie udało się załadować manifestu menu z ${config.id}.`, error);
    return {
      id: config.id,
      label: `${config.label} (nieaktywny)`,
      iconId: 'triangle-alert',
      disabled: true,
    };
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
