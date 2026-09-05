import { MaybeSignal } from '@erp/shared/ui';

/** Prezentacyjny model jednej komórki macierzy przejść workflow. */
export interface ErpWorkflowTransitionCellConfig {
  /** Klucz nazwy przejścia; brak oznacza możliwą do utworzenia relację „z → do”. */
  transitionNameKey?: MaybeSignal<string | undefined>;
  requiredPermission?: MaybeSignal<boolean>;
  requiredFieldsCount?: MaybeSignal<number>;
  addLabelKey: MaybeSignal<string>;
  permissionBadgeKey: MaybeSignal<string>;
  fieldsBadgeKey: MaybeSignal<string>;
  onSelect: () => void;
}
