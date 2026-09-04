import { inject, Injector } from '@angular/core';
import { REMOTE_MODULES_CONFIG, RemoteModuleConfig, loadModuleContract } from '@erp/client/contract';
import {
  ErpNavRegistryService,
  ErpNavigationItem,
  ErpWidgetRegistryService,
  ErpWidgetDefinition,
  ErpJobResultRegistry,
  ErpJobResultResolver,
  JOB_LIST_WIDGET_ID,
  USER_NOTIFICATION_WIDGET_ID,
  SignalrSyncService,
  ErpDocumentationRegistryService,
} from '@erp/shared/data-access';
import { ErpRemoteDocumentationDescriptor } from '@erp/shared/util';
import { ErpModalService } from '@erp/shared/ui';
import { AppSettingsService } from '@erp/client/util';
import { ErpJobToastBridge } from './erp-job-toast.bridge';
import { ErpOptimisticRollbackBridge } from './erp-optimistic-rollback.bridge';
import { ErpAuthService, PermissionStore } from '@erp/shared/auth';

/** Sygnatura SignalR dla zmian uprawnień/ról użytkownika — `AggregateSignatures.IdentityUser`
 * po stronie backendu (patrz docs/architecture/security.md §4/§6). */
const IDENTITY_USER_SIGNATURE = 'identity.user';

export async function STARTUP(): Promise<void> {
  const menuRegistry = inject(ErpNavRegistryService);
  const modalService = inject(ErpModalService);
  const widgetRegistry = inject(ErpWidgetRegistryService);
  const jobResultRegistry = inject(ErpJobResultRegistry);
  const documentationRegistry = inject(ErpDocumentationRegistryService);

  // Samo wstrzyknięcie uruchamia most: jego konstruktor zakłada `effect` nad feedem zadań.
  // Bez tej linijki serwis nigdy by nie powstał — nikt inny go nie wstrzykuje.
  inject(ErpJobToastBridge);
  // Ten sam powód co wyżej: konstruktor mostu subskrybuje `ErpOptimisticStore.rollbacks$`,
  // a nikt poza STARTUP go nie wstrzykuje.
  inject(ErpOptimisticRollbackBridge);
  const permissionStore = inject(PermissionStore);
  const authService = inject(ErpAuthService);
  // Pobrany synchronicznie: kontekst wstrzykiwania nie przeżywa `await` niżej,
  // a bootstrap feedu zadań potrzebuje injectora już po doładowaniu remota. `SignalrSyncService`
  // jest CELOWO pobierany przez `injector.get(...)` niżej, PO bramce autoryzacji, a nie
  // przez `inject()` tutaj — jego konstruktor od razu otwiera połączenie SignalR (patrz
  // `SignalrSyncService._initConnection`), więc wcześniejsze pobranie odpalałoby negocjację
  // (i jej retry) także na stronach, na których nigdy nie będzie tokenu.
  const injector = inject(Injector);
  inject(AppSettingsService); // Triggers theme and language initialization and effects

  // `provideAppInitializer(STARTUP)` biegnie RÓWNOLEGLE z drugim initializerem, który odpala
  // `checkAuth()` (patrz `app.config.ts`). `waitUntilAuthReady()` czeka na TĘ SAMĄ (zamemoizowaną
  // w `ErpAuthService`) obietnicę PRAWDZIWEGO zakończenia `checkAuth()` — nie na pierwszą wartość
  // `isAuthenticated$`, bo to `BehaviorSubject` startujący od `{isAuthenticated: false}` i
  // subskrybowanie go PRZED zakończeniem `checkAuth()` (reguła przy ŚWIEŻYM logowaniu — realna
  // wymiana `code`→token przez sieć) łapało ten nietknięty stan startowy, nie wynik sprawdzenia
  // (pełna historia tego wyścigu — w komentarzu przy `ErpAuthService.checkAuth()`). Dzięki temu
  // token jest już zapisany (`AuthStateService.setAuthorizationData` pisze do storage PRZED
  // opublikowaniem stanu), więc `erpAuthInterceptor` (czyta go synchronicznie) ma go od razu —
  // `PermissionStore.loadWithRetry()` niżej zostaje jako dodatkowa siatka bezpieczeństwa na
  // realną wolność backendu, nie jako obejście tego wyścigu.
  await authService.waitUntilAuthReady();

  // `waitUntilAuthReady()` gwarantuje TYLKO, że `checkAuth()` się zakończył — nie że
  // użytkownik jest zalogowany. Na świeżej wizycie na publicznej trasie (`/login`, przed
  // kliknięciem „Przejdź do logowania") `checkAuth()` rozstrzyga się szybko jako
  // „niezalogowany" i nie ma tu żadnego tokenu ani szans na jego zdobycie w tej karcie —
  // logowanie idzie przez pełny redirect do Keycloaka (nowy load strony), więc `STARTUP()`
  // uruchomi się od nowa po powrocie z code→token, tym razem z `$isAuthenticated() === true`.
  // Odpalanie PermissionStore/SignalR/feedu zadań tutaj i tak dostałoby gwarantowany 401 na
  // każdej próbie retry — to jest dokładnie regresja opisana w komentarzach przy
  // `PermissionStore.loadWithRetry` i `SignalrSyncService._startWithRetry`: te retry są dla
  // PRAWDZIWEGO wyścigu (logowanie w toku, token zaraz będzie), nie dla jego całkowitego braku.
  if (!authService.$isAuthenticated()) {
    return;
  }

  const signalrSync = injector.get(SignalrSyncService);

  // Musi się zakończyć PRZED budową menu (patrz `loadContractDirect` niżej) — filtr menu
  // po `requiredPermission` czyta `PermissionStore` synchronicznie. Fail-closed: błąd sieci
  // zostawia pusty zbiór (menu schowane), nie przerywa startu appki.
  await permissionStore.loadWithRetry();

  // Nieprzefiltrowane drzewa menu (per moduł + statyczny `dashbord`) — trzymane obok
  // zarejestrowanego (już przefiltrowanego) menu, żeby SignalR `onUpdate` niżej mógł je
  // przefiltrować PONOWNIE po odświeżeniu uprawnień i realnie przebudować widoczne menu,
  // zamiast tylko odświeżać stan guardów (patrz komentarz przy `onUpdate` niżej).
  const unfilteredMenus = new Map<string, ErpNavigationItem[]>();

  const DASHBORD_MENU_ID = 'dashbord';
  const dashbordMenuItem: ErpNavigationItem = {
    id: DASHBORD_MENU_ID,
    label: 'Home',
    iconId: 'home',
    route: 'dashbord',
  };
  // Statyczny wpis nie ma `requiredPermission`, więc nie musi przechodzić przez
  // `filterMenuByPermissions` — ale i tak trafia do rejestru nieprzefiltrowanych drzew,
  // żeby pętla rebuildu niżej mogła być jednolita (rejestruje WSZYSTKIE drzewa, nie tylko
  // remote'y).
  unfilteredMenus.set(DASHBORD_MENU_ID, [dashbordMenuItem]);
  menuRegistry.register(dashbordMenuItem);

  // Odświeżenie uprawnień na żywo, gdy admin zmieni role/nadania bieżącego użytkownika —
  // po doładowaniu świeżego stanu `PermissionStore` przelicza WSZYSTKIE zarejestrowane
  // drzewa menu (statyczne + remote'y) z nieprzefiltrowanej kopii i rejestruje je ponownie
  // (`register` upsertuje po `id`) — to realnie przebudowuje widoczne menu, nie tylko
  // odświeża stan guardów tras/API, które i tak zawsze czytają świeży `PermissionStore`.
  signalrSync.subscribe(IDENTITY_USER_SIGNATURE);
  signalrSync.onUpdate(IDENTITY_USER_SIGNATURE).subscribe((uuids) => {
    const currentUserId = authService.$currentUser()?.id;
    if (currentUserId && uuids.includes(currentUserId)) {
      void (async (): Promise<void> => {
        await permissionStore.load();

        for (const [id, unfilteredTree] of unfilteredMenus) {
          if (id === DASHBORD_MENU_ID) {
            // Statyczny wpis bez `requiredPermission` — nic do przefiltrowania, zostaje jak jest.
            continue;
          }

          const visibleMenu = filterMenuByPermissions(unfilteredTree, permissionStore);
          const config = REMOTE_MODULES_CONFIG.find((c) => c.id === id);

          if (visibleMenu.length === 0 || !config) {
            continue;
          }

          menuRegistry.register({
            id: config.id,
            label: config.label,
            children: visibleMenu,
          });
        }
      })();
    }
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

  // Lista powiadomień osobistych pod przyciskiem `erp-notifications` — sąsiad widżetu zadań
  // powyżej, ładowany tą samą leniwą ścieżką rejestru.
  widgetRegistry.register(USER_NOTIFICATION_WIDGET_ID, async () => {
    const contract = await loadModuleContract('notification') as {
      loadUserNotificationListComponent: () => Promise<ErpWidgetDefinition>;
    };
    return contract.loadUserNotificationListComponent();
  });

  const loadPromises = REMOTE_MODULES_CONFIG.map((config) =>
    loadContractDirect(
      config.routePrefix,
      config,
      modalService,
      permissionStore,
      unfilteredMenus,
      jobResultRegistry,
      documentationRegistry,
    ),
  );
  const remoteMenus = await Promise.all(loadPromises);

  for (const menu of remoteMenus) {
    if (menu) {
      menuRegistry.register(menu);
    }
  }

  // Feed zadań startuje niezależnie od widżetu: badge przy dzwonku ma pokazywać prawdę
  // od pierwszej sekundy, a nie dopiero po tym, jak użytkownik kliknie.
  await bootstrapJobFeed(injector);

  // Jak wyżej, dla licznika powiadomień osobistych (Faza 5, `UserNotification`) — druga
  // zakładka tego samego popovera pod dzwonkiem.
  await bootstrapUserNotificationFeed(injector);
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

/** Jak {@link bootstrapJobFeed}, dla licznika powiadomień osobistych. */
async function bootstrapUserNotificationFeed(injector: Injector): Promise<void> {
  try {
    const contract = (await loadModuleContract('notification')) as {
      bootstrapUserNotificationFeed?: (injector: Injector) => Promise<void>;
    };

    await contract?.bootstrapUserNotificationFeed?.(injector);
  } catch (error) {
    console.warn('[STARTUP] Nie udało się uruchomić licznika powiadomień.', error);
  }
}

interface EntryContractModule {
  remoteMenu?: ErpNavigationItem[];
  remoteModalIds?: string[];
  remoteRoutes?: unknown[];

  /** Typy komend, których wyniki ten moduł potrafi zamienić na plik do pobrania. */
  remoteJobResultCommandTypes?: readonly string[];

  /** Leniwy loader resolwera — patrz `ErpJobResultRegistry`. */
  loadJobResultResolver?: (injector: Injector) => Promise<ErpJobResultResolver>;
  remoteDocumentation?: ErpRemoteDocumentationDescriptor;
}

async function loadContractDirect(
  modulePrefix: string,
  config: RemoteModuleConfig,
  modalService: ErpModalService,
  permissionStore: PermissionStore,
  unfilteredMenus: Map<string, ErpNavigationItem[]>,
  jobResultRegistry: ErpJobResultRegistry,
  documentationRegistry: ErpDocumentationRegistryService,
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

    // Kto potrafi zamienić `job.resultRef` na plik do pobrania. Rejestracja jest tu, a nie
    // w module produkującym artefakt, z tego samego powodu co przy modalach i widżetach:
    // feed powiadomień (`scope:notification`) nie może zależeć od `scope:catalog`, a host
    // — jako jedyna warstwa znająca kontrakty remotów — może. Sam resolwer zostaje leniwy.
    const resolverLoader = module?.loadJobResultResolver;
    if (resolverLoader && module?.remoteJobResultCommandTypes) {
      for (const commandType of module.remoteJobResultCommandTypes) {
        jobResultRegistry.register(commandType, resolverLoader);
      }
    }

    if (module.remoteDocumentation
      && (!module.remoteDocumentation.requiredPermission
        || permissionStore.has(module.remoteDocumentation.requiredPermission))) {
      documentationRegistry.register(module.remoteDocumentation);
    }

    if (module?.remoteMenu) {
      const prefixedMenu = applyRoutePrefixToMenu(module.remoteMenu, config.routePrefix);
      // Zachowane NIEPRZEFILTROWANE (ale już prefiksowane routingiem) drzewo — SignalR
      // `onUpdate` w `STARTUP()` filtruje je ponownie po każdym odświeżeniu uprawnień.
      unfilteredMenus.set(config.id, prefixedMenu);
      const visibleMenu = filterMenuByPermissions(prefixedMenu, permissionStore);

      if (visibleMenu.length === 0) {
        return null;
      }

      return {
        id: config.id,
        label: config.label,
        children: visibleMenu,
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

/**
 * Usuwa z drzewa menu pozycje, których `requiredPermission` nie jest w bieżącym zbiorze
 * uprawnień — patrz docs/architecture/security.md §6 Faza 5 („shell filtruje menu, nie
 * każdy moduł osobno"). Brak `requiredPermission` = pozycja zawsze widoczna (domyślne
 * zachowanie sprzed Fazy 5). Węzeł-grupa, który po przefiltrowaniu dzieci zostaje pusty,
 * a oryginalnie miał dzieci, też znika — nie pokazujemy pustych podmenu.
 */
function filterMenuByPermissions(items: ErpNavigationItem[], permissionStore: PermissionStore): ErpNavigationItem[] {
  return items
    .filter((item) => !item.requiredPermission || permissionStore.has(item.requiredPermission))
    .map((item) => {
      if (!item.children || item.children.length === 0) {
        return item;
      }
      return { ...item, children: filterMenuByPermissions(item.children, permissionStore) };
    })
    .filter((item) => !(item.children && item.children.length === 0));
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
