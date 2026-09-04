import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';

export type ErpToastAppearance = 'info' | 'positive' | 'warning' | 'negative';

/** Akcja w toaście — jeden przycisk, nie więcej: toast nie jest miejscem na wybór. */
export interface ErpToastAction {
  readonly label: Translatable;

  readonly fn: () => void | Promise<void>;
}

export interface ErpToastConfig {
  /**
   * Identyfikator toasta. Podanie własnego pozwala go później **podmienić w miejscu**
   * (`ErpToastService.update`) zamiast dorzucać drugi — dzięki temu jeden toast żyje przez całą
   * operację: „generuję raport…" → „raport gotowy [Pobierz]". Bez `id` serwis nadaje własne.
   */
  id?: string;

  /**
   * Treść jako **klucz tłumaczenia**, nie gotowy tekst.
   *
   * Przetłumaczenie w miejscu wywołania zamraża język w chwili wystrzelenia — przełączenie
   * języka nie odświeżyłoby widocznego toasta. Poza tym łamałoby regułę „zero hardcoded
   * stringów" (patrz docs/guides/frontend/translations.md).
   */
  message: MaybeSignal<Translatable>;

  appearance?: MaybeSignal<ErpToastAppearance>;

  /** Nadpisuje ikonę wynikającą z `appearance`. */
  icon?: MaybeSignal<ErpIcon>;

  /**
   * Po ilu milisekundach toast znika sam. `null` = zostaje do ręcznego zamknięcia.
   *
   * Toast z akcją **musi** być trwały: pięć sekund to za mało, żeby przeczytać i kliknąć,
   * a znikający przycisk „Pobierz" jest gorszy niż jego brak. Serwis wymusza to sam.
   */
  autoCloseMs?: number | null;

  action?: ErpToastAction;
}
