import { Signal } from '@angular/core';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';

/**
 * Jeden wpis na liście — plik już zarejestrowany po stronie domeny (nie plik w trakcie transferu,
 * ten stan komponent trzyma sam). Domena dostarcza wyłącznie ukształtowane dane.
 */
export interface ErpFileUploadListItem {
  id: string;
  fileName: string;
  fileSize: number;
  createdAt?: string | Date;
  /** Czy pokazać miniaturę zamiast ikony typu pliku. */
  isImage?: boolean;
  /** Adres podglądu (`blob:`) — leniwy, bo pobranie zamawia dopiero pojawienie się wiersza. */
  previewUrl?: Signal<string | undefined>;
}

/**
 * Konfiguracja `erp-file-upload-list` — port uploadu niezależny od domeny.
 *
 * Komponent trzyma UI-owy stan transferu (wybór, postęp, błąd) i renderuje listę; DECYZJE
 * domenowe — jak wygląda transfer bajtów, co znaczy „usuń", skąd bierze się adres podglądu —
 * zostają po stronie wywołującego przez callbacki configu. Patrz
 * `docs/guides/frontend/multimedia.md` §3 (bilet → PUT → rejestracja, `blob:` a nie adres endpointu).
 */
export interface ErpFileUploadListConfig {
  /** Wpisy już zarejestrowane w domenie (nie pliki w trakcie wyboru). */
  items: MaybeSignal<readonly ErpFileUploadListItem[]>;
  /** Czy pokazać kontrolkę wyboru plików i przyciski usuwania. */
  canEdit?: MaybeSignal<boolean>;
  /** Czy `<input>` przyjmuje wiele plików naraz. Domyślnie `true`. */
  multiple?: MaybeSignal<boolean>;
  /** Filtr typu pliku dla natywnego pickera (atrybut `accept`). */
  accept?: MaybeSignal<string>;
  /** Maksymalna liczba plików w jednej paczce wyboru — `undefined` = bez limitu. */
  maxFilesPerSelection?: number;

  addLabel: MaybeSignal<Translatable>;
  emptyLabel: MaybeSignal<Translatable>;
  previewLabel?: MaybeSignal<Translatable>;
  downloadLabel?: MaybeSignal<Translatable>;
  removeLabel?: MaybeSignal<Translatable>;
  /** Klucz z parametrami `{ uploaded, total }`, pokazywany podczas transferu. */
  uploadingLabel: (uploaded: number, total: number) => Translatable;
  uploadFailedLabel: MaybeSignal<Translatable>;
  tooManyFilesLabel?: MaybeSignal<Translatable>;

  /**
   * Wykonuje transfer wybranej paczki plików — bilet, `PUT`, rejestracja, cokolwiek domena
   * uzna za „upload". Komponent czeka na obietnicę i pokazuje `uploaded`/`total` z callbacku.
   */
  onUpload: (files: readonly File[], onProgress: (uploaded: number) => void) => Promise<void>;
  /** `undefined` ukrywa przycisk podglądu nawet dla `isImage`. */
  onPreview?: (item: ErpFileUploadListItem) => void;
  /** `undefined` ukrywa przycisk pobrania. */
  onDownload?: (item: ErpFileUploadListItem) => void | Promise<void>;
  /** `undefined` ukrywa przycisk usunięcia niezależnie od `canEdit`. */
  onRemove?: (item: ErpFileUploadListItem) => void | Promise<void>;
}
