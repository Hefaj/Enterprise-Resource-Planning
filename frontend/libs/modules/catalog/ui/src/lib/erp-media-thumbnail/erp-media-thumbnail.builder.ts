import { ErpBaseBuilder } from '@erp/shared/ui';
import { MaybeSignal, Translatable } from '@erp/shared/ui';
import { ErpMediaThumbnailAction, ErpMediaThumbnailConfig, MediaType } from './erp-media-thumbnail.types';

export class ErpMediaThumbnailBuilder extends ErpBaseBuilder<ErpMediaThumbnailConfig> {
  constructor(uuid: string) {
    super();
    this._data.uuid = uuid;
    this._data.actions = [];
  }

  /**
   * Ustawia nazwę pliku wyświetlaną pod miniaturą.
   * @param fileName Nazwa pliku lub klucz tłumaczenia.
   */
  public setFileName(fileName: MaybeSignal<Translatable>): this {
    this._data.fileName = fileName;
    return this;
  }

  /**
   * Ustawia adres URL miniatury obrazu.
   * @param url Adres URL obrazka (lub null, jeśli brak).
   */
  public setThumbnailUrl(url: MaybeSignal<string | null>): this {
    this._data.thumbnailUrl = url;
    return this;
  }

  /**
   * Ustawia typ nośnika (np. 'image', 'video', 'document').
   * Wpływa na wyświetlaną ikonę zastępczą, gdy brak miniatury.
   * @param type Typ multimediów.
   */
  public setMediaType(type: MaybeSignal<MediaType>): this {
    this._data.mediaType = type;
    return this;
  }

  /**
   * Ustawia rozmiar pliku w bajtach.
   * Rozmiar ten może być formatowany w komponencie (np. na MB/KB).
   * @param size Rozmiar pliku.
   */
  public setFileSize(size: MaybeSignal<number>): this {
    this._data.fileSize = size;
    return this;
  }

  /**
   * Określa, czy dana miniatura jest zaznaczona (np. do usunięcia masowego).
   * @param selected Wartość logiczna (true/false) określająca zaznaczenie.
   */
  public setSelected(selected: MaybeSignal<boolean>): this {
    this._data.selected = selected;
    return this;
  }

  /**
   * Ustawia funkcję wywoływaną w momencie zmiany zaznaczenia (checkboxa) na miniaturze.
   * @param fn Callback wywoływany z parametrami: uuid, nowy stan zaznaczenia, wciśnięty shift.
   */
  public setOnSelect(fn: (uuid: string, selected: boolean, shiftKey: boolean) => void): this {
    this._data.onSelect = fn;
    return this;
  }

  /**
   * Ustawia funkcję wywoływaną w momencie kliknięcia samej miniatury (podgląd).
   * @param fn Callback wywoływany z parametrem uuid.
   */
  public setOnPreview(fn: (uuid: string) => void): this {
    this._data.onPreview = fn;
    return this;
  }

  /**
   * Dodaje dodatkową akcję (np. Usuń, Pobierz) dostępną z poziomu menu na miniaturze.
   * @param action Definicja akcji dla miniatury.
   */
  public addAction(action: ErpMediaThumbnailAction): this {
    this._data.actions!.push(action);
    return this;
  }
}
