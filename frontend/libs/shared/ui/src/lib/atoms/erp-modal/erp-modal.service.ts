import {
  EnvironmentInjector,
  inject,
  Injectable,
  Injector,
  runInInjectionContext,
  signal,
  WritableSignal,
} from '@angular/core';
import { TuiDialogService } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { ErpModalComponent } from './erp-modal.component';
import { ErpModalConfig, ErpModalDefinition, ErpModalRef } from './erp-modal.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

/**
 * Globalny serwis do otwierania modali z automatycznym lazy loadingiem modułów.
 *
 * Wszystkie modale są otwierane wyłącznie przez metodę `open(queueID, command, metadata)`,
 * która w razie potrzeby automatycznie dociąga zdalny moduł (remote) za pomocą Module Federation.
 *
 * @example
 * ```ts
 * private modalService = inject(ErpModalService);
 *
 * // Otwieranie (z automatycznym lazy loadingiem modułu jeśli to konieczne):
 * await this.modalService.open(SET_PRICE_MODAL_ID, {
 *   products: [...],
 *   price: null
 * });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ErpModalService {
  private readonly injector = inject(EnvironmentInjector);
  private readonly dialogs = inject(TuiDialogService);

  /** Globalny rejestr definicji modali. */
  private readonly _registry = new Map<string, ErpModalDefinition<any, any>>();

  /** Mapa modalId → routePrefix remota. Budowana przy STARTUP z remoteModalIds. */
  private readonly _modalIdToModule = new Map<string, string>();

  /** Zbiór prefixów remotów, których modale zostały już załadowane. */
  private readonly _loadedRemotes = new Set<string>();

  /** Mapa modulePrefix → lista providerów zarejestrowanych dla modali z danego modułu. */
  private readonly _moduleProviders = new Map<string, any[]>();

  /** Rejestr dynamicznych loaderów kontraktów. */
  private readonly _contractLoaders = new Map<string, () => Promise<any>>();

  // ── Rejestracja ──

  /**
   * Rejestruje loader kontraktu dla danego modułu.
   * Używane w trybie monolitu, aby móc leniwie ładować kontrakty bez Native Federation.
   */
  public registerContractLoader(modulePrefix: string, loader: () => Promise<any>): void {
    this._contractLoaders.set(modulePrefix, loader);
  }

  /**
   * Rejestruje definicje modali w globalnym rejestrze.
   * Wywoływane typowo w konstruktorze serwisu domenowego.
   *
   * @example
   * ```ts
   * constructor() {
   *   inject(ErpModalService).register(
   *     EDIT_SKU_DEFINITION,
   *     EDIT_EAN_DEFINITION,
   *   );
   * }
   * ```
   */
  public register(...definitions: ErpModalDefinition<any, any>[]): void {
    for (const def of definitions) {
      if (this._registry.has(def.id)) {
        console.warn(`[ErpModalService] Modal "${def.id}" is already registered. Overwriting.`);
      }
      this._registry.set(def.id, def);
    }
  }

  /**
   * Rejestruje mapowanie modalId → routePrefix remota.
   * Wywoływane przy STARTUP z remoteModalIds każdego modułu.
   *
   * @param modulePrefix routePrefix remota (np. 'catalog')
   * @param modalIds tablica identyfikatorów modali z danego modułu
   */
  public registerModalIds(modulePrefix: string, modalIds: string[]): void {
    for (const id of modalIds) {
      this._modalIdToModule.set(id, modulePrefix);
    }
  }

  // ── Otwieranie (zawsze przez lazyloading) ──

  /**
   * Otwiera modal na podstawie jego identyfikatora (queueID, np. hash MD5).
   * Jeśli modal nie jest jeszcze zarejestrowany, lazy-ładuje definicje modali
   * z odpowiedniego remota na podstawie mapy modalId → modulePrefix
   * (budowanej przy STARTUP z remoteModalIds).
   *
   * @param queueID Identyfikator modalu (np. hash MD5)
   * @param command Początkowy stan commanda
   * @param metadata Opcjonalne metadane przekazywane do modalu
   */
  public async open<TCommand = any, TMetadata = any, TResult = any>(
    queueID: string,
    command: TCommand,
    metadata?: TMetadata,
  ): Promise<ErpModalRef<TCommand, TMetadata, TResult>> {
    // 1. Sprawdź czy modal jest już zarejestrowany
    if (this._registry.has(queueID)) {
      return this._openDirect<TCommand, TMetadata, TResult>(queueID, command, metadata);
    }

    // 2. Znajdź moduł na podstawie mapy (budowanej przy STARTUP)
    const modulePrefix = this._modalIdToModule.get(queueID);
    if (!modulePrefix) {
      throw new Error(
        `[ErpModalService] Unknown modal ID: "${queueID}". ` +
        `Not found in modalId → module mapping. ` +
        `Make sure the remote module exports remoteModalIds in its contract.`
      );
    }

    // 3. Lazy load definicji modali z remota (jeśli jeszcze nie załadowane)
    if (!this._loadedRemotes.has(modulePrefix)) {
      try {
        const loader = this._contractLoaders.get(modulePrefix);
        if (!loader) {
          throw new Error(`No contract loader registered for "${modulePrefix}"`);
        }

        const contractModule = await loader() as {
          registerModals?: () => Promise<any[]>;
          getModalProviders?: () => Promise<any[]>;
        };

        if (contractModule?.getModalProviders) {
          const providers = await contractModule.getModalProviders();
          this._moduleProviders.set(modulePrefix, providers);
        }

        if (contractModule?.registerModals) {
          const tokens = await contractModule.registerModals();
          runInInjectionContext(this.injector, () => {
            for (const token of tokens) {
              this.register(inject(token));
            }
          });
        }

        this._loadedRemotes.add(modulePrefix);
      } catch (error) {
        throw new Error(
          `[ErpModalService] Failed to load modals for "${modulePrefix}" and queueID "${queueID}". ` +
          `Error: ${error}`
        );
      }
    }

    // 4. Teraz modal powinien być zarejestrowany
    if (!this._registry.has(queueID)) {
      throw new Error(
        `[ErpModalService] Modal "${queueID}" not found after loading "${modulePrefix}/contract". ` +
        `Make sure registerModals() in "${modulePrefix}" returns the ModalDefinition token for this ID.`
      );
    }

    return this._openDirect<TCommand, TMetadata, TResult>(queueID, command, metadata);
  }

  private _openDirect<TCommand, TMetadata, TResult>(
    id: string,
    command: TCommand,
    metadata?: TMetadata
  ): ErpModalRef<TCommand, TMetadata, TResult> {
    const definition = this._registry.get(id);
    if (!definition) {
      throw new Error(`[ErpModalService] Modal "${id}" not found in registry.`);
    }
    const config = definition.build(command, metadata);

    // Automatycznie doklej providery specyficzne dla modułu, w którym zdefiniowany jest ten modal
    const modulePrefix = this._modalIdToModule.get(id);
    if (modulePrefix) {
      const moduleProviders = this._moduleProviders.get(modulePrefix);
      if (moduleProviders && moduleProviders.length > 0) {
        config.providers = [...(config.providers || []), ...moduleProviders];
      }
    }

    return this._openInternal<TCommand, TMetadata, TResult>(config);
  }

  // ── Internals ──

  private _openInternal<TCommand, TMetadata, TResult>(
    config: ErpModalConfig<TCommand, TMetadata, TResult>
  ): ErpModalRef<TCommand, TMetadata, TResult> {
    let elementInjector: Injector | undefined = undefined;
    if (config.providers && config.providers.length > 0) {
      elementInjector = Injector.create({
        providers: config.providers,
        parent: this.injector,
      });
    }

    const commandSignal = signal(config.command) as WritableSignal<TCommand>;
    const metadataSignal = signal(config.metadata) as WritableSignal<TMetadata>;

    (config as any).commandSignal = commandSignal;
    (config as any).metadataSignal = metadataSignal;

    const size = unwrapSignal(config.size) || 'md';
    const appearance = size === 'full' ? 'fullscreen' : 'taiga';
    const mappedSize = this._mapTuiSize(size);

    let closedResolve!: (value: { command: TCommand; metadata?: TMetadata; saved: boolean; result?: TResult }) => void;
    const closedPromise = new Promise<{ command: TCommand; metadata?: TMetadata; saved: boolean; result?: TResult }>((resolve) => {
      closedResolve = resolve;
    });

    let lastResult: { command: TCommand; metadata?: TMetadata; saved: boolean; result?: TResult } | null = null;

    const subscription = this.dialogs.open(
      new PolymorpheusComponent(ErpModalComponent, elementInjector || this.injector),
      {
        size: mappedSize,
        appearance: appearance,
        closable: false,
        dismissible: true,
        data: config,
      }
    ).subscribe({
      next: (val: any) => {
        lastResult = val;
      },
      complete: () => {
        if (lastResult) {
          closedResolve(lastResult);
        } else {
          closedResolve({
            command: commandSignal(),
            metadata: metadataSignal(),
            saved: false
          });
        }
      }
    });

    const ref: ErpModalRef<TCommand, TMetadata, TResult> = {
      close: () => {
        subscription.unsubscribe();
        closedResolve({
          command: commandSignal(),
          metadata: metadataSignal(),
          saved: false
        });
      },
      command: commandSignal,
      metadata: metadataSignal,
      closed: closedPromise
    };

    return ref;
  }

  private _mapTuiSize(size: string): 's' | 'm' | 'l' {
    if (size === 'sm') return 's';
    if (size === 'md') return 'm';
    if (size === 'lg') return 'l';
    if (size === 'xl') return 'l';
    if (size === 'full') return 'l';
    return 'm';
  }
}
