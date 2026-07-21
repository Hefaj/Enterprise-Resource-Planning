import { inject } from '@angular/core';
import { REMOTE_MODULES_CONFIG, RemoteModuleConfig, loadModuleContract } from '@erp/client/contract';
import { ErpNavRegistryService, ErpNavigationItem } from '@erp/shared/data-access';
import { ErpModalService } from '@erp/shared/ui';
import { AppSettingsService } from '@erp/client/util';

export async function STARTUP(): Promise<void> {
  const menuRegistry = inject(ErpNavRegistryService);
  const modalService = inject(ErpModalService);
  inject(AppSettingsService); // Triggers theme and language initialization and effects

  menuRegistry.register({
    id: 'dashbord',
    label: 'Home',
    iconId: 'home',
    route: 'dashbord',
  });

  // Rejestracja centralnych loaderów w serwisie modali (działa w trybie Monolit i w MFE)
  for (const config of REMOTE_MODULES_CONFIG) {
    modalService.registerContractLoader(config.routePrefix, () => loadModuleContract(config.routePrefix));
  }

  const loadPromises = REMOTE_MODULES_CONFIG.map((config) => loadContractDirect(config.routePrefix, config, modalService));
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
  remoteRoutes?: unknown[];
}

async function loadContractDirect(
  modulePrefix: string,
  config: RemoteModuleConfig,
  modalService: ErpModalService,
): Promise<ErpNavigationItem | null> {
  try {
    const module = (await loadModuleContract(modulePrefix)) as EntryContractModule;
    if (!module) {
      console.warn(`[STARTUP] Brak kontraktu dla ${modulePrefix}`);
      return null;
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
