import { Type, Signal } from '@angular/core';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';

export type ErpTableMode = 'server' | 'client';

export interface ErpSortState {
  columnId: string;
  direction: 'asc' | 'desc';
}

export interface ErpPaginationState {
  pageIndex: number;
  pageSize: number;
}

export type ErpSelectionMode = 'none' | 'single' | 'multi';

export interface ErpSelectionState<TData = any> {
  mode: ErpTableMode;
  isAllSelected: boolean;
  selectedItems: TData[];
  selectedIds: string[];
  filters?: Record<string, any>;
  /**
   * Liczba wszystkich pozycji pasujących do filtrów (nie tylko widocznej strony).
   * Przy „Zaznacz wszystko" w trybie serwerowym to ONA jest licznością zaznaczenia —
   * `selectedItems` jest wtedy puste, bo zaznaczenie opisuje filtr, a nie lista uuidów.
   * Liczyć zaznaczenie należy przez `erpSelectionCount()`.
   */
  totalCount?: number;
}

export interface ErpCellChip {
  text: Translatable;
  shortText?: Translatable;
  description?: Translatable;
  appearance?: string;
  size?: 's' | 'm';
  icon?: string;
}

export interface ErpCellLine {
  text: string;
  chips?: ErpCellChip[];
}

export interface ErpCellRichContent {
  lines: ErpCellLine[];
  cellChips?: ErpCellChip[];
}



export interface ErpColumnDef<TData = any> {
  id: string;
  accessorKey?: Extract<keyof TData, string> | (string & {});
  accessorFn?: (row: TData) => any;
  header: MaybeSignal<Translatable>;
  subHeader?: MaybeSignal<Translatable>;
  cell?: Type<any>;
  cellInputs?: Record<string, any>;
  cellRichContent?: (value: any, row: TData) => ErpCellRichContent;
  cellFormatter?: (value: any, row: TData) => string;
  minSize?: number;
  size?: number;
  maxSize?: number;
  enableSorting?: boolean;
  enableResizing?: boolean;
  visible?: boolean;
  disableHiding?: boolean;
  footer?: MaybeSignal<Translatable>;
  cellClass?: string;
  align?: 'left' | 'center' | 'right';
}

/**
 * Definicja grupy kolumn — pozwala pogrupować kilka kolumn pod wspólnym nagłówkiem.
 * W nagłówku tabeli renderowany jest wiersz nadrzędny z etykietą grupy (colspan),
 * a pod nim wiersz z poszczególnymi kolumnami potomnymi.
 */
export interface ErpColumnGroupDef<TData = any> {
  id: string;
  header: MaybeSignal<Translatable>;
  columns: ErpColumnDef<TData>[];
}

/**
 * Type guard sprawdzający czy definicja kolumny jest grupą.
 */
export function isColumnGroupDef<TData>(def: ErpColumnDef<TData> | ErpColumnGroupDef<TData>): def is ErpColumnGroupDef<TData> {
  return 'columns' in def && Array.isArray((def as any).columns);
}

export interface ErpTableState {
  sorting: ErpSortState[];
  pagination: ErpPaginationState;
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  columnSizing: Record<string, number>;
  filters: Record<string, any>;
  selection: Pick<ErpSelectionState, 'isAllSelected' | 'selectedIds' | 'filters'>;
  rowSelectionOnClick?: boolean;
  rightClickSelection?: boolean;
}

/**
 * Akcja wyświetlana w wierszu grupy (np. "Dodaj gwarancję do produktu").
 */
export interface ErpGroupRowAction<TGroup = any> {
  label: Translatable;
  icon?: ErpIcon;
  onClick: (group: TGroup) => void | Promise<void>;
  disabled?: (group: TGroup) => boolean;
}

/**
 * Konfiguracja trybu grupowanych wierszy — pozwala wyświetlić dane pogrupowane
 * pod sztucznymi wierszami-rodzicami (bez związku z kolumnami tabeli),
 * w jednej, wspólnej wirtualizowanej liście (jeden scrollbar).
 *
 * Rodzic (`TGroup`) to dowolny byt niezwiązany z `ErpColumnDef<TData>` — renderowany
 * jako pełnoszerokościowy wiersz (tytuł/podtytuł/ikona/akcje), z checkboxem kaskadowo
 * zaznaczającym wszystkie jego dzieci oraz przyciskiem rozwijania.
 *
 * Dzieci (`TData`) to zwykłe wiersze tabeli — przechodzą przez standardowy mechanizm kolumn.
 */
export interface ErpGroupedRowsConfig<TGroup = any, TData = any> {
  /** Lista grup (rodziców) do wyświetlenia — w tej kolejności. */
  groups: MaybeSignal<TGroup[]>;
  /** Unikalny, stabilny klucz grupy. */
  getGroupKey: (group: TGroup) => string;
  /** Klucz grupy, do której należy dany wiersz danych (dziecko). */
  getRowGroupKey: (row: TData) => string;
  /** Tytuł wiersza grupy. */
  getGroupTitle: (group: TGroup) => Translatable;
  /** Opcjonalny podtytuł wiersza grupy (np. SKU/ID). */
  getGroupSubtitle?: (group: TGroup) => Translatable | undefined;
  /** Opcjonalna ikona wiersza grupy. */
  getGroupIcon?: (group: TGroup) => ErpIcon | undefined;
  /** Czy dana grupa jest w trakcie ładowania (np. sygnał z orkiestratora). */
  isGroupLoading?: (group: TGroup) => boolean;
  /** Akcje wyświetlane w wierszu grupy. */
  actions?: ErpGroupRowAction<TGroup>[];
  /** Czy grupy są domyślnie rozwinięte (domyślnie: true). */
  defaultExpanded?: boolean;
  /**
   * Wywoływane, gdy wiersz grupy staje się widoczny w wirtualizerze, a jej dzieci
   * nie są jeszcze załadowane (`getRowGroupKey` nie zwraca dla niej żadnych wierszy
   * w `items`) — do dociągania danych "na żądanie".
   */
  loadChildren?: (group: TGroup) => void | Promise<void>;
  /** Szacowana wysokość wiersza grupy w px (dla wirtualizera). Domyślnie 56. */
  estimateGroupRowHeight?: number;
  /**
   * Wywoływane przy każdej zmianie widocznego zakresu wirtualizera — dla każdej grupy,
   * której przynajmniej jeden wiersz-dziecko jest aktualnie widoczny (wraz z overscanem),
   * przekazuje pełną listę jej aktualnie widocznych wierszy.
   *
   * W przeciwieństwie do `loadChildren` (wywoływane raz, tylko gdy grupa nie ma jeszcze
   * żadnych wierszy w `items`), to wywołanie działa niezależnie od tego, czy wiersze już
   * istnieją — pozwala doładowywać kolejne porcje *danych* dla już istniejących wierszy
   * w miarę scrollowania w głąb dużej grupy (np. produkt z setkami zdjęć, gdzie same
   * wiersze/ID są znane od razu, ale ich szczegóły ładują się stopniowo).
   * Implementacja powinna sama pilnować deduplikacji (np. Set już zażądanych ID).
   */
  onVisibleRowsChange?: (group: TGroup, visibleRows: TData[]) => void;
}

export interface ErpTableConfig<TData = any> {
  items?: MaybeSignal<TData[]>;
  itemCount?: MaybeSignal<number>;
  loading?: MaybeSignal<boolean>;
  columns: (ErpColumnDef<TData> | ErpColumnGroupDef<TData>)[];
  mode: ErpTableMode;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  enableMultiSort?: boolean;
  selectionMode?: ErpSelectionMode;
  rowIdAccessor?: (row: TData) => string;
  enableColumnResizing?: boolean;
  enableColumnReordering?: boolean;
  enableColumnVisibility?: boolean;
  enableVirtualScroll?: boolean;
  estimatedRowHeight?: number;
  striped?: MaybeSignal<boolean>;
  bordered?: MaybeSignal<boolean>;
  compact?: MaybeSignal<boolean>;
  stickyHeader?: boolean;
  tableHeight?: MaybeSignal<string>;
  emptyMessage?: MaybeSignal<Translatable>;
  skeletonRows?: number;
  initialState?: Partial<ErpTableState>;
  /**
   * Unikalny klucz stanu tabeli — jeśli podany, `erp-table` sam odczytuje i zapisuje
   * (debounced) stan (paginacja, sortowanie, widoczność/kolejność/szerokość kolumn)
   * w preferencjach użytkownika, bez potrzeby obsługi tego po stronie hosta.
   */
  stateKey?: string;
  onRowClick?: (row: TData) => void;
  onRowDoubleClick?: (row: TData) => void;
  trackBy?: (index: number, row: TData) => any;
  onPaginationChange?: (state: ErpPaginationState) => void;
  onSortChange?: (state: ErpSortState[]) => void;
  onSelectionChange?: (state: ErpSelectionState<TData>) => void;
  onStateChange?: (state: ErpTableState) => void;
  legendItems?: MaybeSignal<ErpCellChip[]>;
  filters?: MaybeSignal<Record<string, any>>;
  /**
   * Włącza tryb grupowanych wierszy — dane wyświetlane pod sztucznymi wierszami-rodzicami
   * w jednej, wspólnej wirtualizowanej liście. Wymaga `enableVirtualScroll: true`.
   */
  groupedRows?: ErpGroupedRowsConfig<any, TData>;
}
