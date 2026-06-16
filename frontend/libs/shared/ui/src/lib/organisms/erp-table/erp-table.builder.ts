import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpContextMenuItem } from '../../atoms/erp-context-menu/erp-context-menu.types';
import { 
  ErpTableConfig, 
  ErpTableColumn, 
  ErpTableLazyEvent,
  ErpCellImageConfig, 
  ErpCellBadgeConfig, 
  ErpCellBooleanConfig,
  ErpCellLinkConfig,
  ErpCellCustomConfig 
} from './erp-table.types';

export class ErpTableBuilder extends ErpBaseBuilder<ErpTableConfig> {
  constructor() {
    super();
    this._data.columns = [];
    this._data.rows = 10;
    this._data.rowsPerPageOptions = [10, 25, 50];
    this._data.paginator = true;
    this._data.striped = true;
    this._data.scrollable = true;
    this._data.scrollHeight = 'flex';
    this._data.emptyMessage = 'Brak danych do wyświetlenia';
  }

  public setData(data: any): this {
    this._data.data = data;
    return this;
  }

  public setExternalFilters(filters: any): this {
    this._data.externalFilters = filters;
    return this;
  }

  public setLoading(loading: any): this {
    this._data.loading = loading;
    return this;
  }

  public setSelection(selection: any): this {
    this._data.selection = selection;
    return this;
  }

  /**
   * Ustawia pełną listę kolumn (zastępuje wcześniej dodane).
   * Przydatne gdy kolumny są budowane dynamicznie przez computed().
   */
  public setColumns(columns: ErpTableColumn[]): this {
    this._data.columns = columns;
    return this;
  }


  /**
   * Dodaje kolumnę tekstową do tabeli.
   * @param field — Klucz pola w obiekcie wiersza
   * @param header — Nagłówek kolumny
   * @param options — Opcje: sortable, width, pipe, filterable itp.
   */
  public addColumn(
    field: string,
    header: Translatable,
    options: Partial<Omit<ErpTableColumn, 'field' | 'header'>> = {}
  ): this {
    this._data.columns!.push({ field, header, ...options });
    return this;
  }

  /**
   * Dodaje kolumnę z obrazkiem (miniatura / avatar).
   * @param field — Klucz pola zawierającego URL obrazka
   * @param header — Nagłówek kolumny (pusty string dla kolumny bez nagłówka)
   * @param config — Konfiguracja: wymiary, zaokrąglenie, fallback ikona
   * @param options — Dodatkowe opcje kolumny (width, align itp.)
   */
  public addImageColumn(
    field: string,
    header: Translatable,
    config: ErpCellImageConfig = {},
    options: Partial<Omit<ErpTableColumn, 'field' | 'header' | 'type' | 'typeConfig'>> = {}
  ): this {
    this._data.columns!.push({ 
      field, 
      header, 
      type: 'image', 
      typeConfig: config,
      ...options 
    });
    return this;
  }

  /**
   * Dodaje kolumnę z badge'em (kolorowy tag na podstawie wartości).
   * @param field — Klucz pola
   * @param header — Nagłówek kolumny
   * @param severityMap — Mapowanie wartości na kolory: { 'Aktywny': 'success', 'Draft': 'warn' }
   * @param options — Dodatkowe opcje kolumny
   */
  public addBadgeColumn(
    field: string,
    header: Translatable,
    severityMap: ErpCellBadgeConfig['severityMap'],
    options: Partial<Omit<ErpTableColumn, 'field' | 'header' | 'type' | 'typeConfig'>> = {}
  ): this {
    this._data.columns!.push({ 
      field, 
      header, 
      type: 'badge', 
      typeConfig: { severityMap },
      ...options 
    });
    return this;
  }

  /**
   * Dodaje kolumnę boolean (ikona check/cross).
   * @param field — Klucz pola boolean
   * @param header — Nagłówek kolumny
   * @param config — Konfiguracja ikon i klas CSS
   * @param options — Dodatkowe opcje kolumny
   */
  public addBooleanColumn(
    field: string,
    header: Translatable,
    config: ErpCellBooleanConfig = {},
    options: Partial<Omit<ErpTableColumn, 'field' | 'header' | 'type' | 'typeConfig'>> = {}
  ): this {
    this._data.columns!.push({ 
      field, 
      header, 
      type: 'boolean', 
      typeConfig: config,
      align: 'center',
      ...options 
    });
    return this;
  }

  /**
   * Dodaje kolumnę z klikalnym linkiem.
   * @param field — Klucz pola z tekstem linku
   * @param header — Nagłówek kolumny
   * @param config — Konfiguracja: onClick callback, hrefField
   * @param options — Dodatkowe opcje kolumny
   */
  public addLinkColumn(
    field: string,
    header: Translatable,
    config: ErpCellLinkConfig = {},
    options: Partial<Omit<ErpTableColumn, 'field' | 'header' | 'type' | 'typeConfig'>> = {}
  ): this {
    this._data.columns!.push({ 
      field, 
      header, 
      type: 'link', 
      typeConfig: config,
      ...options 
    });
    return this;
  }

  /**
   * Dodaje kolumnę z niestandardowym komponentem Angular.
   * Komponent otrzyma inputy: row, field, value + dodatkowe z config.inputs.
   * @param field — Klucz pola
   * @param header — Nagłówek kolumny
   * @param component — Klasa komponentu Angular
   * @param inputs — Dodatkowe inputy przekazywane do komponentu
   * @param options — Dodatkowe opcje kolumny
   */
  public addCustomColumn(
    field: string,
    header: Translatable,
    component: MaybeSignal<Type<any>>,
    inputs?: Record<string, any>,
    options: Partial<Omit<ErpTableColumn, 'field' | 'header' | 'type' | 'typeConfig'>> = {}
  ): this {
    this._data.columns!.push({ 
      field, 
      header, 
      type: 'custom', 
      typeConfig: { component, inputs } as ErpCellCustomConfig,
      ...options 
    });
    return this;
  }

  // ── Konfiguracja tabeli ──

  /**
   * Konfiguruje paginację (ilość wierszy na stronie).
   */
  public setPagination(rows: number, rowsPerPageOptions?: number[]): this {
    this._data.paginator = true;
    this._data.rows = rows;
    if (rowsPerPageOptions) {
      this._data.rowsPerPageOptions = rowsPerPageOptions;
    }
    return this;
  }

  /** Wyłącza paginację. */
  public disablePagination(): this {
    this._data.paginator = false;
    return this;
  }

  /** Tryb selekcji wierszy ('single' | 'multiple'). */
  public setSelectionMode(mode: 'single' | 'multiple'): this {
    this._data.selectionMode = mode;
    return this;
  }

  /** Włącza globalny filtr (search box nad tabelą) dla wskazanych pól. */
  public setGlobalFilter(fields: string[]): this {
    this._data.globalFilterFields = fields;
    return this;
  }

  /** Komunikat wyświetlany, gdy tabela jest pusta. */
  public setEmptyMessage(message: Translatable): this {
    this._data.emptyMessage = message;
    return this;
  }

  /** Włącza/wyłącza paski (striped rows). */
  public setStriped(value = true): this {
    this._data.striped = value;
    return this;
  }

  /** Konfiguruje scrollowanie. */
  public setScrollable(value = true, height?: string): this {
    this._data.scrollable = value;
    if (height) {
      this._data.scrollHeight = height;
    }
    return this;
  }

  /** Callback wywoływany po zaznaczeniu wiersza. */
  public onRowSelect(callback: (row: any) => void): this {
    this._data.onRowSelect = callback;
    return this;
  }

  /** Callback wywoływany po odznaczeniu wiersza. */
  public onRowUnselect(callback: (row: any) => void): this {
    this._data.onRowUnselect = callback;
    return this;
  }

  /** Ustawia rozmiar tabeli (small, normal, large). */
  public setSize(size: 'small' | 'normal' | 'large'): this {
    this._data.size = size;
    return this;
  }

  // ── Wirtualizacja i lazy loading ──

  /**
   * Włącza wirtualny scroll wierszy (zastępuje paginację).
   * @param rowHeight — Wysokość pojedynczego wiersza w px (domyślnie 45)
   */
  public setVirtualScroll(rowHeight = 45, rows = 50): this {
    this._data.virtualScroll = true;
    this._data.virtualScrollRowHeight = rowHeight;
    this._data.rows = rows;
    this._data.paginator = false;
    return this;
  }

  /**
   * Ustawia łączną liczbę rekordów (potrzebna przy lazy load).
   * Może być Signal lub wartością statyczną.
   */
  public setTotalRecords(total: MaybeSignal<number>): this {
    this._data.totalRecords = total;
    return this;
  }

  /**
   * Rejestruje callback wywoływany przez tabelę, gdy potrzebuje danych.
   * Wywoływany przy: inicjalizacji, scroll, zmiana sortowania.
   * @param fn — funkcja przyjmująca ErpTableLazyEvent
   */
  public setLazyLoad(fn: (event: ErpTableLazyEvent) => void): this {
    this._data.onLazyLoad = fn;
    return this;
  }

  /**
   * Ustawia elementy context menu wyświetlanego po PPM na wierszu.
   * Może być Signal – wtedy menu jest aktualizowane reaktywnie (np. zależnie od selekcji).
   */
  public setContextMenuItems(items: MaybeSignal<ErpContextMenuItem[] | undefined>): this {
    this._data.contextMenuItems = items;
    return this;
  }
}
