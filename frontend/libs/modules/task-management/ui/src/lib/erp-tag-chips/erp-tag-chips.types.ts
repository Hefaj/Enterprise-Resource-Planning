import { MaybeSignal } from '@erp/shared/ui';

/** Wygląd pojedynczego chipa — `TuiAppearance` z `@taiga-ui/core` zawężone do tego, co moduł
 * faktycznie różnicuje (priorytet, typ, a od fazy 6 tag użytkownika). */
export type ErpTagChipAppearance = 'neutral' | 'info' | 'warning' | 'negative' | 'positive';

export interface ErpTagChipItem {
  value: string;

  /** Klucz tłumaczenia albo tekst gotowy (np. nazwa tagu — dana, nie klucz registry). */
  label: string;

  /** `true`, gdy `label` jest kluczem tłumaczenia i ma przejść przez `erpTranslate`; `false` dla
   * tekstu danych (nazwa tagu, nazwa typu założonego z UI). Domyślnie `true`. */
  translate?: boolean;

  appearance?: ErpTagChipAppearance;

  icon?: string;
}

/**
 * Chipsy — przygotowane pod tagi (faza 6), używane już teraz dla typu i priorytetu
 * (`docs/modules/task-management/screens.md` §10).
 */
export interface ErpTagChipsConfig {
  items: MaybeSignal<readonly ErpTagChipItem[]>;

  /** Rozmiar chipa TaigaUI; domyślnie `xs` — kontekst jest zawsze gęsty (wiersz tabeli, karta
   * na tablicy). */
  size?: MaybeSignal<'xs' | 's' | 'm'>;

  /** Emitowane po kliknięciu „×” na chipie — bez niego chipsy są tylko do odczytu (np. na
   * tablicy). Usuwanie tagów wchodzi w fazie 6; typ i priorytet nie są usuwalne stąd. */
  removable?: MaybeSignal<boolean>;
}
