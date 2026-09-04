import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpMediaPreviewConfig, ErpMediaPreviewItem } from './erp-media-preview.types';

/**
 * Fluent API do złożenia konfiguracji podglądu — patrz docs/guides/frontend/atoms.md.
 */
export class ErpMediaPreviewBuilder extends ErpBaseBuilder<ErpMediaPreviewConfig> {
  /** Komplet pozycji w kolejności, w jakiej mają się przewijać strzałkami. */
  public setItems(items: MaybeSignal<readonly ErpMediaPreviewItem[]>): this {
    this._data.items = items;
    return this;
  }

  /** Pozycja otwierana jako pierwsza. Nieznane `id` cofa się do pierwszej z listy. */
  public setStartId(id: string): this {
    this._data.startId = id;
    return this;
  }

  /** Włącza przycisk pobrania oryginału i podpina pod niego akcję. */
  public setOnDownload(fn: (item: ErpMediaPreviewItem) => void | Promise<void>): this {
    this._data.onDownload = fn;
    return this;
  }

  public setUnavailableMessage(message: MaybeSignal<Translatable>): this {
    this._data.unavailableMessage = message;
    return this;
  }
}
