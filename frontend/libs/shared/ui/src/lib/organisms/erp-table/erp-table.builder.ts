import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpTableConfig, ErpTableColumn } from './erp-table.component';

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

  /**
   * Dodaje kolumnę do tabeli.
   */
  public addColumn(
    field: string,
    header: string,
    options: Partial<Omit<ErpTableColumn, 'field' | 'header'>> = {}
  ): this {
    this._data.columns!.push({ field, header, ...options });
    return this;
  }

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

  /**
   * Wyłącza paginację.
   */
  public disablePagination(): this {
    this._data.paginator = false;
    return this;
  }

  /**
   * Tryb selekcji wierszy ('single' | 'multiple').
   */
  public setSelectionMode(mode: 'single' | 'multiple'): this {
    this._data.selectionMode = mode;
    return this;
  }

  /**
   * Włącza globalny filtr (search box nad tabelą) dla wskazanych pól.
   */
  public setGlobalFilter(fields: string[]): this {
    this._data.globalFilterFields = fields;
    return this;
  }

  /**
   * Komunikat wyświetlany, gdy tabela jest pusta.
   */
  public setEmptyMessage(message: string): this {
    this._data.emptyMessage = message;
    return this;
  }

  /**
   * Włącza/wyłącza paski (striped rows).
   */
  public setStriped(value = true): this {
    this._data.striped = value;
    return this;
  }

  /**
   * Konfiguruje scrollowanie.
   */
  public setScrollable(value = true, height?: string): this {
    this._data.scrollable = value;
    if (height) {
      this._data.scrollHeight = height;
    }
    return this;
  }

  /**
   * Callback wywoływany po zaznaczeniu wiersza.
   */
  public onRowSelect(callback: (row: any) => void): this {
    this._data.onRowSelect = callback;
    return this;
  }

  /**
   * Callback wywoływany po odznaczeniu wiersza.
   */
  public onRowUnselect(callback: (row: any) => void): this {
    this._data.onRowUnselect = callback;
    return this;
  }

  /**
   * Ustawia rozmiar tabeli (small, normal, large).
   */
  public setSize(size: 'small' | 'normal' | 'large'): this {
    this._data.size = size;
    return this;
  }
}
