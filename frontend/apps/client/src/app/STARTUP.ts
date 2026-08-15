import { inject, Injector } from '@angular/core';
import { REMOTE_MODULES_CONFIG, RemoteModuleConfig, loadModuleContract } from '@erp/client/contract';
import {
  ErpNavRegistryService,
  ErpNavigationItem,
  ErpWidgetRegistryService,
  ErpWidgetDefinition,
  JOB_LIST_WIDGET_ID,
} from '@erp/shared/data-access';
import { ErpModalService } from '@erp/shared/ui';
import { AppSettingsService } from '@erp/client/util';

export async function STARTUP(): Promise<void> {
  const menuRegistry = inject(ErpNavRegistryService);
  const modalService = inject(ErpModalService);
  const widgetRegistry = inject(ErpWidgetRegistryService);
  // Pobrany synchronicznie: kontekst wstrzykiwania nie przeżywa `await` niżej,
  // a bootstrap feedu zadań potrzebuje injectora już po doładowaniu remota.
  const injector = inject(Injector);
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

  // Lista zadań masowych w nagłówku żyje w remocie `notification`, ale osadza się w layoucie
  // hosta — nie jest ani trasą, ani modalem, więc idzie trzecią ścieżką: rejestrem widżetów.
  // Sam loader jest leniwy; wykona się dopiero przy pierwszym otwarciu dzwonka.
  widgetRegistry.register(JOB_LIST_WIDGET_ID, async () => {
    const contract = await loadModuleContract('notification') as {
      loadJobListComponent: () => Promise<ErpWidgetDefinition>;
    };
    return contract.loadJobListComponent();
  });

  const loadPromises = REMOTE_MODULES_CONFIG.map((config) => loadContractDirect(config.routePrefix, config, modalService));
  const remoteMenus = await Promise.all(loadPromises);

  for (const menu of remoteMenus) {
    if (menu) {
      menuRegistry.register(menu);
    }
  }

  // Feed zadań startuje niezależnie od widżetu: badge przy dzwonku ma pokazywać prawdę
  // od pierwszej sekundy, a nie dopiero po tym, jak użytkownik kliknie.
  await bootstrapJobFeed(injector);
}

/**
 * Uruchamia hydrację feedu zadań z repliki serwera. Awaria (remote niedostępny, backend
 * jeszcze nie wstał) nie może zablokować startu aplikacji — powiadomienia są dodatkiem
 * do shellu, nie warunkiem jego działania.
 */
async function bootstrapJobFeed(injector: Injector): Promise<void> {
  try {
    const contract = await loadModuleContract('notification') as {
      bootstrapJobFeed?: (injector: Injector) => Promise<void>;
    };

    await contract?.bootstrapJobFeed?.(injector);
  } catch (error) {
    console.warn('[STARTUP] Nie udało się uruchomić feedu zadań masowych.', error);
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
