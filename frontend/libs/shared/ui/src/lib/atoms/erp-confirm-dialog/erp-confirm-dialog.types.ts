import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';

/**
 * Wydźwięk potwierdzenia. Steruje ikoną i wyglądem przycisku akcji — użytkownik ma poznać
 * po samym kolorze, czy klika „zapisz", czy „skasuj".
 */
export type ErpConfirmAppearance = 'neutral' | 'warning' | 'destructive';

/** Szerokość okna. `s` dla zwykłego pytania, `m` gdy dochodzi lista skutków. */
export type ErpConfirmSize = 's' | 'm';

/**
 * Czwórka kluczy w konwencji, którą moduły już trzymają w swoich słownikach:
 * `confirm.clearAll = { title, message, yes, no }`. Dzięki temu jedna gałąź JSON-a opisuje
 * całe zdanie potwierdzenia, a wywołujący podaje ją jednym `setKeys(...)`.
 */
export interface ErpConfirmKeys {
  readonly title: string;
  readonly message: string;
  readonly yes: string;
  readonly no: string;
}

export interface ErpConfirmDialogConfig {
  /**
   * Treść jako **klucz tłumaczenia**, nie gotowy tekst — tak samo jak w `ErpToastConfig`.
   * Klucz rozwiązuje pipe `erpTranslate` w szablonie dialogu, więc przełączenie języka
   * przy otwartym oknie przerysowuje je od razu. Poprzednie, modułowe serwisy tłumaczyły
   * imperatywnie przez `TranslocoService.translate` i zamrażały język w chwili otwarcia.
   */
  title: MaybeSignal<Translatable>;

  /**
   * Zdanie mówiące, **co się stanie** — nie „czy na pewno". Liczby (ile plików, ilu
   * produktów) przechodzą jako parametry interpolacji w `Translatable`
   * (`{ key, params: { count } }`): potwierdzenie bez liczby nie mówi użytkownikowi
   * tego, co powinno — jaki jest promień rażenia.
   */
  message: MaybeSignal<Translatable>;

  /** Dodatkowe wiersze pod treścią — lista skutków, nazwy obiektów, ostrzeżenia. */
  details?: MaybeSignal<readonly Translatable[]>;

  /** Etykieta przycisku akcji. Domyślnie `shared.confirm.confirm`. */
  confirmLabel?: MaybeSignal<Translatable>;

  /** Etykieta wycofania się. Domyślnie `shared.confirm.cancel`. */
  cancelLabel?: MaybeSignal<Translatable>;

  appearance?: MaybeSignal<ErpConfirmAppearance>;

  /** Nadpisuje ikonę wynikającą z `appearance`. */
  icon?: MaybeSignal<ErpIcon>;

  size?: ErpConfirmSize;

  /**
   * Opcjonalna akcja wykonywana **wewnątrz** dialogu. Gdy jest podana, przycisk pokazuje
   * spinner do czasu jej zakończenia i dopiero potem okno się zamyka — użytkownik widzi
   * postęp tam, gdzie kliknął. Bez niej dialog po prostu zwraca `true` i to wywołujący
   * decyduje, co dalej.
   *
   * Wyjątek z akcji zamyka dialog wynikiem `false` i leci dalej do wywołującego —
   * dialog nie jest miejscem na obsługę błędów.
   */
  onConfirm?: () => void | Promise<void>;
}
