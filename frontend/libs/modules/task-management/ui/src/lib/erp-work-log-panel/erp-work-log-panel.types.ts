import { FormControl } from '@angular/forms';
import { ErpButtonConfig, ErpInputConfig, ErpInputNumberConfig, ErpInputPickerConfig, Translatable } from '@erp/shared/ui';

/** Wpis czasu, już ukształtowany do wyświetlenia — `workTypeName` rozwiązany przez feature. */
export interface ErpWorkLogEntryRow {
  readonly uuid: string;
  readonly loggedOn: string | Date;
  readonly workTypeName: string;
  readonly minutes: number;
  readonly description?: string;
  /** Czy bieżący użytkownik jest autorem — steruje widocznością przycisku usunięcia. */
  readonly isMine: boolean;
}

/**
 * Konfiguracja panelu czasu: estymata (z edycją inline), zalogowane/pozostałe minuty, lista
 * wpisów i formularz dodania. Kontrolki formularza zostają własnością feature (ta sama zasada,
 * co przy `erp-board-toolbar`) — panel tylko je renderuje przez wspólne `erp-input*`.
 */
export interface ErpWorkLogPanelConfig {
  readonly entries: readonly ErpWorkLogEntryRow[];
  readonly loggedMinutes: number;
  /** `null` = brak estymaty (TIME-002 AC1 — bez ostrzeżenia o przekroczeniu, sama liczba). */
  readonly estimateMinutesOrNull: number | null;
  readonly remainingMinutes: number | null;
  readonly canEdit: boolean;
  readonly editingEstimate: boolean;

  // Etykiety — klucze z rejestru feature (`ISSUE_KEYS`), panel nie zna własnych tłumaczeń.
  readonly estimateLabel: Translatable;
  readonly loggedLabel: Translatable;
  readonly remainingLabel: Translatable;
  readonly noEstimateLabel: Translatable;
  readonly noEntriesLabel: Translatable;
  /** Format „N minut" z parametrem `{ minutes }` — funkcja, bo klucz niesie interpolację. */
  readonly formatMinutes: (minutes: number) => Translatable;

  readonly estimateControl: FormControl<number | null>;
  readonly estimateInputConfig: ErpInputNumberConfig;
  readonly editEstimateButton: ErpButtonConfig;
  readonly saveEstimateButton: ErpButtonConfig;
  readonly cancelEstimateButton: ErpButtonConfig;
  readonly onSaveEstimate: () => void;

  readonly workTypeControl: FormControl<string | null>;
  readonly workTypePickerConfig: ErpInputPickerConfig;
  readonly minutesControl: FormControl<number | null>;
  readonly minutesInputConfig: ErpInputNumberConfig;
  readonly descriptionControl: FormControl<string | null>;
  readonly descriptionInputConfig: ErpInputConfig;
  readonly addButton: ErpButtonConfig;
  readonly onAddWorkLog: () => void;

  readonly getRemoveButton: (entry: ErpWorkLogEntryRow) => ErpButtonConfig;
}
