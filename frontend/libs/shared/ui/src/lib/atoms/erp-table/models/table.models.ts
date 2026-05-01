import { TemplateRef } from '@angular/core';

export type ColumnType = 'text' | 'multiline' | 'icon' | 'image' | 'pill' | 'custom';

export interface PillOptions {
  value: string;
  colorClass?: string; // np. 'bg-green-100 text-green-800'
  icon?: string;
  tooltip?: string;
}

export interface ColumnPillConfig<T = any> {
  getPillOptions?: (rowData: T) => PillOptions | PillOptions[];
}

export interface ColumnImageConfig {
  width?: string;
  height?: string;
  alt?: string;
  cssClass?: string;
}

export interface ColumnIconConfig<T = any> {
  getIcon?: (rowData: T) => string; // np. 'pi pi-check'
  getColorClass?: (rowData: T) => string; // np. 'text-green-500'
}

export interface TableColumn<T = any> {
  field: Extract<keyof T, string>;
  header: string;
  type: ColumnType;
  width?: string; // np. '150px'
  sortable?: boolean;
  frozen?: boolean;
  alignFrozen?: 'left' | 'right';
  editable?: boolean; // Do edycji/selekcji komórki
  
  // Specyficzne konfiguracje
  pillConfig?: ColumnPillConfig<T>;
  imageConfig?: ColumnImageConfig;
  iconConfig?: ColumnIconConfig<T>;

  // Szablon dla ColumnType === 'custom'
  template?: TemplateRef<any>;
}

export interface TableSelectionConfig {
  mode: 'single' | 'multiple' | 'none';
  type: 'row' | 'cell' | 'checkbox';
}

export interface TableConfig<T> {
  columns: TableColumn<T>[];
  
  // Wirtualizacja i wydajność
  lazy?: boolean;
  virtualScroll?: boolean;
  virtualScrollItemSize?: number;
  scrollHeight?: string; // Wymagane przy wirtualizacji (np. '400px')
  
  // Style tabeli PrimeNG
  rowHover?: boolean;
  stripedRows?: boolean;
  
  // Konfiguracja selekcji
  selection?: TableSelectionConfig;
}
