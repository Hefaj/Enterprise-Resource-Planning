import { Type, Signal } from '@angular/core';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';

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
  selectedRowIds: Set<string> | string[];
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
  onRowClick?: (row: TData) => void;
  onRowDoubleClick?: (row: TData) => void;
  trackBy?: (index: number, row: TData) => any;
  onPaginationChange?: (state: ErpPaginationState) => void;
  onSortChange?: (state: ErpSortState[]) => void;
  onFilterChange?: (state: Record<string, any>) => void;
  onSelectionChange?: (items: TData[]) => void;
  onStateChange?: (state: ErpTableState) => void;
  legendItems?: MaybeSignal<ErpCellChip[]>;
}
