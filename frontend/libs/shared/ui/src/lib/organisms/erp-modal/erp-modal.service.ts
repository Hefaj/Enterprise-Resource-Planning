import {
  ApplicationRef,
  ComponentRef,
  createComponent,
  EnvironmentInjector,
  inject,
  Injectable,
} from '@angular/core';
import { ErpModalComponent } from './erp-modal.component';
import { ErpModalConfig, ErpModalDefinition, ErpModalRef } from './erp-modal.types';

/**
 * Globalny serwis do otwierania modali.
 *
 * Obsługuje dwa tryby:
 * 1. **Rejestrowy** — modal zarejestrowany przez `register()`, otwierany przez `open(id, command)`
 * 2. **Bezpośredni** — modal otwierany przez `open(config)` z pełną konfiguracją
 *
 * @example
 * ```ts
 * private modalService = inject(ErpModalService);
 *
 * // Tryb rejestrowy (zalecany):
 * this.modalService.open('catalog.product.edit-sku', { productUuids: [...], sku: '' });
 *
 * // Tryb bezpośredni:
 * this.modalService.open(ErpModalBuilder.modal<MyCommand>(b => b.setTitle('...')));
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ErpModalService {
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);

  /** Globalny rejestr definicji modali. */
  private readonly _registry = new Map<string, ErpModalDefinition<any, any>>();

  // ── Rejestracja ──

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

  // ── Otwieranie ──

  /**
   * Otwira modal z pełną konfiguracją (tryb bezpośredni).
   */
  public open<TCommand = any, TMetadata = any>(
    config: ErpModalConfig<TCommand, TMetadata>
  ): ErpModalRef<TCommand, TMetadata>;

  /**
   * Otwira zarejestrowany modal po identyfikatorze (tryb rejestrowy).
   * @param id Identyfikator modalu zarejestrowanego przez `register()`
   * @param command Początkowy stan commanda
   * @param metadata Opcjonalne metadane przekazywane do modalu
   */
  public open<TCommand = any, TMetadata = any>(
    id: string,
    command: TCommand,
    metadata?: TMetadata
  ): ErpModalRef<TCommand, TMetadata>;

  public open<TCommand = any, TMetadata = any>(
    configOrId: ErpModalConfig<TCommand, TMetadata> | string,
    command?: TCommand,
    metadata?: TMetadata
  ): ErpModalRef<TCommand, TMetadata> {
    let config: ErpModalConfig<TCommand, TMetadata>;

    if (typeof configOrId === 'string') {
      const definition = this._registry.get(configOrId);
      if (!definition) {
        throw new Error(
          `[ErpModalService] Modal "${configOrId}" not found in registry. ` +
          `Available: [${Array.from(this._registry.keys()).join(', ')}]`
        );
      }
      config = definition.build(command!, metadata);
    } else {
      config = configOrId;
    }

    return this._openInternal(config);
  }

  // ── Internals ──

  private _openInternal<TCommand, TMetadata>(
    config: ErpModalConfig<TCommand, TMetadata>
  ): ErpModalRef<TCommand, TMetadata> {
    // Tworzenie komponentu dynamicznie
    const componentRef = createComponent(
      ErpModalComponent,
      {
        environmentInjector: this.injector,
      }
    ) as unknown as ComponentRef<ErpModalComponent<TCommand, TMetadata>>;

    // Ustawienie configu
    componentRef.setInput('config', config);

    // Podpięcie do ApplicationRef (detekcja zmian)
    this.appRef.attachView(componentRef.hostView);

    // Inicjalizacja commanda i metadanych
    componentRef.instance.initCommand();

    // Dodanie do DOM
    const domElement = (componentRef.hostView as any).rootNodes[0] as HTMLElement;
    document.body.appendChild(domElement);

    // Cleanup po zamknięciu
    const checkAndCleanup = () => {
      const interval = setInterval(() => {
        if (!componentRef.instance.visible()) {
          clearInterval(interval);
          this._destroyModal(componentRef, domElement);
        }
      }, 100);
    };
    checkAndCleanup();

    // Zwracamy referencję
    const ref: ErpModalRef<TCommand, TMetadata> = {
      close: () => {
        componentRef.instance.visible.set(false);
      },
      command: componentRef.instance.commandSignal,
      metadata: componentRef.instance.metadataSignal,
    };

    return ref;
  }

  private _destroyModal<TCommand, TMetadata>(
    componentRef: ComponentRef<ErpModalComponent<TCommand, TMetadata>>,
    domElement: HTMLElement
  ): void {
    setTimeout(() => {
      this.appRef.detachView(componentRef.hostView);
      componentRef.destroy();
      if (domElement.parentNode) {
        domElement.parentNode.removeChild(domElement);
      }
    }, 300);
  }
}
