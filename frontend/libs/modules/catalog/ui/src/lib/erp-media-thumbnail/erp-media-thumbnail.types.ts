import { MaybeSignal, Translatable } from '@erp/shared/ui';
import { ErpIcon } from '@erp/shared/ui';

export type MediaType = 'image' | 'video' | 'audio' | 'document' | '3d-model' | 'unknown';

export interface ErpMediaThumbnailAction {
  label: Translatable;
  icon?: ErpIcon;
  onClick: (uuid: string) => void | Promise<void>;
}

export interface ErpMediaThumbnailConfig {
  /** UUID multimedium. */
  uuid: string;
  /** Nazwa pliku. */
  fileName: MaybeSignal<Translatable>;
  /** URL miniaturki (thumbnail). Dla audio/doc — brak (wyświetla ikonę). */
  thumbnailUrl?: MaybeSignal<string | null>;
  /** Typ pliku (determinuje ikonę i zachowanie). */
  mediaType: MaybeSignal<MediaType>;
  /** Rozmiar pliku w bajtach (do wyświetlenia). */
  fileSize?: MaybeSignal<number>;
  /** Czy miniatura jest zaznaczona. */
  selected?: MaybeSignal<boolean>;
  /** Funkcja po zaznaczeniu z checkboxa */
  onSelect?: (uuid: string, selected: boolean, shiftKey: boolean) => void;
  /** Callback podglądu (kliknięcie w miniaturę). */
  onPreview?: (uuid: string) => void;
  /** Akcje kontekstowe. */
  actions?: ErpMediaThumbnailAction[];
}
