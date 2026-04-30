// frontend/libs/shared/ui/table/src/lib/models/table.models.ts

import { TemplateRef } from '@angular/core';

export type ColumnType = 'text' | 'icon' | 'image' | 'badge' | 'custom';

export interface TableColumn<T = any> {
  field: keyof T; // Klucz w obiekcie danych
  header: string; // Etykieta nagłówka
  type: ColumnType; // Typ renderowania
  width?: string; // Szerokość kolumny (np. '150px')
  sortable?: boolean; // Czy kolumna jest sortowalna
  frozen?: boolean; // Czy kolumna jest zakotwiczona
  editable?: boolean; // Czy komórki są edytowalne (selekcja komórkowa)

  // Opcjonalny szablon dla pełnej kontroli (np. tagi/pastylki)
  template?: TemplateRef<any>;
}

export interface TableConfig<T> {
  columns: TableColumn<T>[];

  // Konfiguracja funkcjonalności
  lazy: boolean;
  virtualScroll?: boolean;

  // Konfiguracja selekcji
  // Usunęliśmy sztywne selectionMode na rzecz obsługi w SelectionService
  enableRowSelection?: boolean;
  enableCellSelection?: boolean;
}
