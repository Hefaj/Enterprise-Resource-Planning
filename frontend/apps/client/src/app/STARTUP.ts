import { inject } from '@angular/core';
import { REMOTE_MODULES_CONFIG, RemoteModuleConfig } from '@erp/client/contract';
import { ErpNavRegistryService, ErpNavigationItem } from '@erp/shared/data-access';
import { ErpModalService } from '@erp/shared/ui';
import { ThemeService, LanguageService } from '@erp/client/util';

/**
 * Rejestr dynamicznych loaderów kontraktów.
 * Umożliwia łatwą migrację między monolitem (import) a mikrofrontendem (loadRemoteModule).
 */
const CONTRACT_LOADERS: Record<string, () => Promise<any>> = {
  catalog: () => import('@erp/catalog/contract'),
  inventory: () => import('@erp/inventory/contract'),
  sales: () => import('@erp/sales/contract'),
  dms: () => import('@erp/dms/contract'),
  'task-management': () => import('@erp/task-management/contract'),
  notification: () => import('@erp/notification/contract'),
};

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

  // Rejestracja loaderów w serwisie modali
  for (const [prefix, loader] of Object.entries(CONTRACT_LOADERS)) {
    modalService.registerContractLoader(prefix, loader);
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
  remoteRoutes?: any[];
}

async function loadContractDirect(
  modulePrefix: string,
  config: RemoteModuleConfig,
  modalService: ErpModalService,
): Promise<ErpNavigationItem | null> {
  try {
    const loader = CONTRACT_LOADERS[modulePrefix];
    if (!loader) {
      console.warn(`[STARTUP] Brak rejestracji loadera kontraktu dla ${modulePrefix}`);
      return null;
    }

    const module = (await loader()) as EntryContractModule;

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
