import { Type, WritableSignal } from '@angular/core';
import { MaybeSignal } from '../../base/erp-signal-utils';

// ── Cell Renderer Configs ───────────────────────────────

export interface ErpCellImageConfig {
  /** Szerokość obrazka (np. '40px') */
  width?: string;
  /** Wysokość obrazka (np. '40px') */
  height?: string;
  /** Zaokrąglony kształt (avatar) */
  rounded?: boolean;
  /** Ikona fallback gdy brak obrazka */
  fallbackIcon?: string;
}

export interface ErpCellBadgeConfig {
  /** Mapowanie wartości → severity PrimeNG (np. { 'Aktywny': 'success' }) */
  severityMap: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'>;
}

export interface ErpCellTagConfig {
  /** Mapowanie wartości → severity */
  severityMap?: Record<string, string>;
  /** Zaokrąglone rogi */
  rounded?: boolean;
}

export interface ErpCellBooleanConfig {
  /** Ikona dla wartości true */
  trueIcon?: string;
  /** Ikona dla wartości false */
  falseIcon?: string;
  /** Klasa CSS dla wartości true */
  trueClass?: string;
  /** Klasa CSS dla wartości false */
  falseClass?: string;
}

export interface ErpCellLinkConfig {
  /** Pole z obiektu wiersza użyte jako href */
  hrefField?: string;
  /** Callback po kliknięciu linku */
  onClick?: (row: any) => void;
}

export interface ErpCellCustomConfig {
  /** Komponent Angular wstrzykiwany w komórkę */
  component: MaybeSignal<Type<any>>;
  /** Dodatkowe inputy przekazywane do komponentu */
  inputs?: Record<string, any>;
}

export type ErpCellRendererConfig =
  | ErpCellImageConfig
  | ErpCellBadgeConfig
  | ErpCellTagConfig
  | ErpCellBooleanConfig
  | ErpCellLinkConfig
  | ErpCellCustomConfig;

/** Typ renderera komórki */
export type ErpCellType = 'text' | 'image' | 'badge' | 'tag' | 'boolean' | 'link' | 'custom';

// ── Table Interfaces ────────────────────────────────────

export interface ErpTableColumn {
  field: string;
  header: string;
  sortable?: boolean;
  width?: string;
  minWidth?: string;
  align?: 'left' | 'center' | 'right';
  /** Pipe formatujący (dla typu 'text') */
  pipe?: 'currency' | 'date' | 'number' | 'percent';
  pipeArgs?: string;
  frozen?: boolean;
  /** Włącza wbudowany filtr kolumnowy */
  filterable?: boolean;
  filterType?: 'text' | 'numeric' | 'date';
  /** Typ renderera komórki (domyślnie 'text') */
  type?: ErpCellType;
  /** Konfiguracja specyficzna dla danego typu renderera */
  typeConfig?: ErpCellRendererConfig;
}

export interface ErpTableConfig {
  columns: ErpTableColumn[];
  rows?: number;
  rowsPerPageOptions?: number[];
  paginator?: boolean;
  selectionMode?: 'single' | 'multiple';
  globalFilterFields?: string[];
  emptyMessage?: string;
  striped?: boolean;
  scrollable?: boolean;
  scrollHeight?: string;
  size?: 'small' | 'normal' | 'large';
  onRowSelect?: (row: any) => void;
  onRowUnselect?: (row: any) => void;
  data?: any; // MaybeSignal<any[]>
  externalFilters?: any; // MaybeSignal<ErpTableFilters>
  loading?: any; // MaybeSignal<boolean>
  selection?: WritableSignal<any>;
}

export type ErpTableFilters = Record<string, any>;
