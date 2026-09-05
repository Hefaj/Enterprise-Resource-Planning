import { ErpInputConfig, ErpInputPickerConfig, Translatable } from '@erp/shared/ui';

/** Link do podstrony backlogu — pokazywany wyłącznie dla tablic scrumowych (§2.4 screens.md). */
export interface ErpBoardToolbarBacklogLink {
  readonly routerLink: readonly unknown[];
  readonly labelKey: Translatable;
}

/** Konfiguracja paska nad tablicą: nazwa, wybór grupowania w swimlane'y i link do backlogu. */
export interface ErpBoardToolbarConfig {
  readonly boardName: Translatable;
  readonly swimlanePickerConfig: ErpInputPickerConfig;
  /** `undefined` ukrywa pole kodu pola niestandardowego (tryb grupowania inny niż „pole"). */
  readonly swimlaneFieldCodeInputConfig?: ErpInputConfig;
  readonly backlogLink?: ErpBoardToolbarBacklogLink;
}
