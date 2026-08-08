import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';
import {
  ErpTableConfig,
  ErpColumnDef,
  ErpColumnGroupDef,
  ErpTableMode,
  ErpSelectionMode,
  ErpTableState,
  ErpPaginationState,
  ErpSortState,
  ErpCellRichContent,
  ErpCellChip,
  isColumnGroupDef,
  ErpSelectionState,
  ErpGroupedRowsConfig,
  ErpGroupRowAction,
} from './erp-table.types';

/**
 * Budowniczy pojedynczej kolumny w tabeli ERP.
 * Umożliwia w płynny sposób (fluent API) skonfigurowanie identyfikatora, nagłówka, zawartości, a także filtrów i sortowania.
 */
export class ErpColumnBuilder<TData = any> extends ErpBaseBuilder<ErpColumnDef<TData>> {
  constructor() {
    super();
    this._data.enableSorting = true;
    this._data.enableResizing = true;
    this._data.visible = true;
  }

  /**
   * Ustawia unikalny identyfikator kolumny.
   */
  public setId(id: Extract<keyof TData, string> | (string & {})): this {
    this._data.id = id;
    return this;
  }

  /**
   * Ustawia klucz dostępu do danych w obiekcie wiersza.
   */
  public setAccessorKey(key: Extract<keyof TData, string> | (string & {})): this {
    this._data.accessorKey = key;
    return this;
  }

  /**
   * Ustawia funkcję zwracającą wartość komórki dla danego wiersza.
   * Używane w przypadku, gdy proste mapowanie klucza to za mało.
   */
  public setAccessorFn(fn: (row: TData) => any): this {
    this._data.accessorFn = fn;
    return this;
  }

  /**
   * Ustawia tekst lub sygnał reprezentujący nagłówek kolumny.
   */
  public setHeader(header: MaybeSignal<Translatable>): this {
    this._data.header = header;
    return this;
  }

  /**
   * Ustawia opcjonalny podtytuł (mniejszy tekst wyświetlany pod nagłówkiem głównym).
   */
  public setSubHeader(subHeader: MaybeSignal<Translatable>): this {
    this._data.subHeader = subHeader;
    return this;
  }

  /**
   * Ustawia niestandardowy komponent Angulara do wyrenderowania zawartości komórki.
   */
  public setCell(component: Type<any>, inputs?: Record<string, any>): this {
    this._data.cell = component;
    if (inputs) {
      this._data.cellInputs = inputs;
    }
    return this;
  }

  /**
   * Ustawia prostą funkcję formatującą tekst komórki bez potrzeby używania niestandardowego komponentu.
   */
  public setCellFormatter(fn: (value: any, row: TData) => string): this {
    this._data.cellFormatter = fn;
    return this;
  }

  /**
   * Ustawia funkcję generującą bogatą, wieloliniową zawartość komórki z badge'ami.
   * Ma wyższy priorytet niż cellFormatter, ale niższy niż cell (custom component).
   */
  public setCellRichContent(fn: (value: any, row: TData) => ErpCellRichContent): this {
    this._data.cellRichContent = fn;
    return this;
  }

  /**
   * Ustawia wyrównanie tekstu w kolumnie (do lewej, do środka, do prawej).
   */
  public setAlign(align: 'left' | 'center' | 'right'): this {
    this._data.align = align;
    return this;
  }

  /**
   * Ustawia dodatkową klasę CSS dla wszystkich komórek w tej kolumnie.
   */
  public setCellClass(cls: string): this {
    this._data.cellClass = cls;
    return this;
  }

  /**
   * Ustawia bazową szerokość kolumny w pikselach.
   */
  public setSize(size: number): this {
    this._data.size = size;
    return this;
  }

  /**
   * Ustawia minimalną szerokość kolumny w pikselach.
   */
  public setMinSize(min: number): this {
    this._data.minSize = min;
    return this;
  }

  /**
   * Ustawia maksymalną szerokość kolumny w pikselach.
   */
  public setMaxSize(max: number): this {
    this._data.maxSize = max;
    return this;
  }

  /**
   * Włącza lub wyłącza możliwość sortowania po tej kolumnie.
   */
  public setEnableSorting(enabled: boolean): this {
    this._data.enableSorting = enabled;
    return this;
  }

  /**
   * Włącza lub wyłącza możliwość zmiany szerokości tej kolumny.
   */
  public setEnableResizing(enabled: boolean): this {
    this._data.enableResizing = enabled;
    return this;
  }

  /**
   * Ustawia początkową widoczność kolumny.
   */
  public setVisible(visible: boolean): this {
    this._data.visible = visible;
    return this;
  }

  /**
   * Blokuje możliwość ukrycia tej kolumny przez użytkownika (np. w menu widoczności kolumn).
   */
  public setDisableHiding(disabled: boolean): this {
    this._data.disableHiding = disabled;
    return this;
  }

  /**
   * Ustawia zawartość stopki (footer) dla kolumny, często używaną do podsumowań.
   */
  public setFooter(footer: MaybeSignal<Translatable>): this {
    this._data.footer = footer;
    return this;
  }
}

/**
 * Budowniczy grupy kolumn w tabeli ERP.
 * Umożliwia grupowanie kilku kolumn pod wspólnym nagłówkiem (multi-row header).
 */
export class ErpColumnGroupBuilder<TData = any> extends ErpBaseBuilder<ErpColumnGroupDef<TData>> {
  constructor() {
    super();
    this._data.columns = [];
  }

  /**
   * Ustawia unikalny identyfikator grupy.
   */
  public setId(id: string): this {
    this._data.id = id;
    return this;
  }

  /**
   * Ustawia tekst nagłówka grupy (wyświetlany w wierszu nadrzędnym, rozciągnięty colspan).
   */
  public setHeader(header: MaybeSignal<Translatable>): this {
    this._data.header = header;
    return this;
  }

  /**
   * Dodaje kolumnę potomną do grupy.
   */
  public addColumn(configureOrDef: ErpColumnDef<TData> | ((col: ErpColumnBuilder<TData>) => void)): this {
    if (typeof configureOrDef === 'function') {
      const builder = new ErpColumnBuilder<TData>();
      configureOrDef(builder);
      this._data.columns!.push(builder.build());
    } else {
      this._data.columns!.push(configureOrDef);
    }
    return this;
  }
}

/**
 * Budowniczy konfiguracji trybu grupowanych wierszy (`ErpTable.groupedRows`).
 * Grupa (`TGroup`) to sztuczny byt-rodzic bez związku z kolumnami tabeli —
 * renderowany jako pełnoszerokościowy wiersz z tytułem/podtytułem/checkboxem kaskadowym/expand.
 */
export class ErpGroupedRowsBuilder<TGroup = any, TData = any> extends ErpBaseBuilder<ErpGroupedRowsConfig<TGroup, TData>> {
  constructor() {
    super();
    this._data.defaultExpanded = true;
    this._data.actions = [];
  }

  /** Ustawia listę grup (rodziców) do wyświetlenia. */
  public setGroups(groups: MaybeSignal<TGroup[]>): this {
    this._data.groups = groups;
    return this;
  }

  /** Ustawia funkcję zwracającą unikalny, stabilny klucz grupy. */
  public setGetGroupKey(fn: (group: TGroup) => string): this {
    this._data.getGroupKey = fn;
    return this;
  }

  /** Ustawia funkcję zwracającą klucz grupy, do której należy dany wiersz danych. */
  public setGetRowGroupKey(fn: (row: TData) => string): this {
    this._data.getRowGroupKey = fn;
    return this;
  }

  /** Ustawia funkcję zwracającą tytuł wiersza grupy. */
  public setGetGroupTitle(fn: (group: TGroup) => Translatable): this {
    this._data.getGroupTitle = fn;
    return this;
  }

  /** Ustawia funkcję zwracającą podtytuł wiersza grupy (np. SKU/ID). */
  public setGetGroupSubtitle(fn: (group: TGroup) => Translatable | undefined): this {
    this._data.getGroupSubtitle = fn;
    return this;
  }

  /** Ustawia funkcję zwracającą ikonę wiersza grupy. */
  public setGetGroupIcon(fn: (group: TGroup) => ErpIcon | undefined): this {
    this._data.getGroupIcon = fn;
    return this;
  }

  /** Ustawia funkcję sygnalizującą stan ładowania danej grupy. */
  public setIsGroupLoading(fn: (group: TGroup) => boolean): this {
    this._data.isGroupLoading = fn;
    return this;
  }

  /** Dodaje akcję wyświetlaną w wierszu grupy (np. "Dodaj"). */
  public addAction(action: ErpGroupRowAction<TGroup>): this {
    this._data.actions!.push(action);
    return this;
  }

  /** Ustawia, czy grupy są domyślnie rozwinięte (domyślnie: true). */
  public setDefaultExpanded(expanded: boolean): this {
    this._data.defaultExpanded = expanded;
    return this;
  }

  /**
   * Ustawia funkcję wywoływaną, gdy wiersz grupy staje się widoczny w wirtualizerze,
   * a jej dzieci nie są jeszcze załadowane — do dociągania danych na żądanie.
   */
  public setLoadChildren(fn: (group: TGroup) => void | Promise<void>): this {
    this._data.loadChildren = fn;
    return this;
  }

  /** Ustawia szacowaną wysokość wiersza grupy w px (dla wirtualizera). */
  public setEstimateGroupRowHeight(height: number): this {
    this._data.estimateGroupRowHeight = height;
    return this;
  }
}

/**
 * Główny budowniczy tabeli ERP. Zwraca konfigurację (ErpTableConfig) do przekazania do komponentu.
 */
export class ErpTableBuilder<TData = any> extends ErpBaseBuilder<ErpTableConfig<TData>> {
  constructor() {
    super();
    this._data.mode = 'server';
    this._data.pageSizeOptions = [10, 20, 50, 100];
    this._data.defaultPageSize = 20;
    this._data.enableMultiSort = true;
    this._data.selectionMode = 'none';
    this._data.enableColumnResizing = true;
    this._data.enableColumnReordering = true;
    this._data.enableColumnVisibility = true;
    this._data.stickyHeader = true;
    this._data.bordered = true;
    this._data.columns = [];
  }

  /**
   * Tryb przetwarzania tabeli. 'client' przetwarza paginację i sortowanie lokalnie, 'server' oczekuje tych danych z API.
   */
  public setMode(mode: ErpTableMode): this {
    this._data.mode = mode;
    return this;
  }

  /**
   * Ustawia tablicę danych do wyświetlenia. Można przekazać statyczną listę lub sygnał.
   */
  public setItems(items: MaybeSignal<TData[]>): this {
    this._data.items = items;
    return this;
  }

  /**
   * Ustawia całkowitą liczbę elementów (ważne przy trybie 'server' dla poprawnego działania paginacji).
   */
  public setItemCount(count: MaybeSignal<number>): this {
    this._data.itemCount = count;
    return this;
  }

  /**
   * Sygnalizuje czy dane są obecnie ładowane (wyświetla odpowiedni wskaźnik ładowania).
   */
  public setLoading(loading: MaybeSignal<boolean>): this {
    this._data.loading = loading;
    return this;
  }

  /**
   * Dodaje nową kolumnę poprzez wstrzyknięcie ErpColumnBuilder lub podanie gotowej definicji.
   */
  public addColumn(configureOrDef: ErpColumnDef<TData> | ((col: ErpColumnBuilder<TData>) => void)): this {
    if (typeof configureOrDef === 'function') {
      const builder = new ErpColumnBuilder<TData>();
      configureOrDef(builder);
      this._data.columns!.push(builder.build());
    } else {
      this._data.columns!.push(configureOrDef);
    }
    return this;
  }

  /**
   * Nadpisuje wszystkie kolumny tablicą gotowych definicji.
   */
  public setColumns(columns: (ErpColumnDef<TData> | ErpColumnGroupDef<TData>)[]): this {
    this._data.columns = columns;
    return this;
  }

  /**
   * Dodaje grupę kolumn z wspólnym nagłówkiem nadrzędnym (multi-row header).
   */
  public addColumnGroup(configureOrDef: ErpColumnGroupDef<TData> | ((group: ErpColumnGroupBuilder<TData>) => void)): this {
    if (typeof configureOrDef === 'function') {
      const builder = new ErpColumnGroupBuilder<TData>();
      configureOrDef(builder);
      this._data.columns!.push(builder.build());
    } else {
      this._data.columns!.push(configureOrDef);
    }
    return this;
  }

  /**
   * Ustawia opcje wyboru rozmiaru strony wyświetlane w paginacji.
   */
  public setPageSizeOptions(options: number[]): this {
    this._data.pageSizeOptions = options;
    return this;
  }

  /**
   * Ustawia domyślny rozmiar strony (ilość wierszy na stronę).
   */
  public setDefaultPageSize(size: number): this {
    this._data.defaultPageSize = size;
    return this;
  }

  /**
   * Włącza lub wyłącza możliwość sortowania wielokolumnowego.
   */
  public setEnableMultiSort(enabled: boolean): this {
    this._data.enableMultiSort = enabled;
    return this;
  }

  /**
   * Określa tryb zaznaczania wierszy: 'none' (brak), 'single' (pojedynczy) lub 'multi' (wielokrotny, pojawia się kolumna z checkboxem).
   */
  public setSelectionMode(mode: ErpSelectionMode): this {
    this._data.selectionMode = mode;
    return this;
  }

  /**
   * Ustawia funkcję definiującą unikalny klucz dla każdego wiersza.
   */
  public setRowIdAccessor(fn: (row: TData) => string): this {
    this._data.rowIdAccessor = fn;
    return this;
  }

  /**
   * Włącza lub wyłącza globalnie możliwość zmiany szerokości kolumn w tabeli.
   */
  public setEnableColumnResizing(enabled: boolean): this {
    this._data.enableColumnResizing = enabled;
    return this;
  }

  /**
   * Włącza lub wyłącza globalnie możliwość zmiany kolejności kolumn (drag & drop).
   */
  public setEnableColumnReordering(enabled: boolean): this {
    this._data.enableColumnReordering = enabled;
    return this;
  }

  /**
   * Włącza lub wyłącza globalnie przycisk zarządzania widocznością poszczególnych kolumn.
   */
  public setEnableColumnVisibility(enabled: boolean): this {
    this._data.enableColumnVisibility = enabled;
    return this;
  }

  /**
   * Uruchamia mechanizm wirtualnego przewijania (virtual scrolling), rekomendowane dla bardzo długich list.
   */
  public setEnableVirtualScroll(enabled: boolean): this {
    this._data.enableVirtualScroll = enabled;
    return this;
  }

  /**
   * Szacowana wysokość pojedynczego wiersza, niezbędna przy aktywnym wirtualnym przewijaniu.
   */
  public setEstimatedRowHeight(height: number): this {
    this._data.estimatedRowHeight = height;
    return this;
  }

  /**
   * Włącza styl paskowany (zebra) dla wierszy tabeli.
   */
  public setStriped(striped: MaybeSignal<boolean>): this {
    this._data.striped = striped;
    return this;
  }

  /**
   * Włącza lub wyłącza widoczność obramowań dla komórek tabeli.
   */
  public setBordered(bordered: MaybeSignal<boolean>): this {
    this._data.bordered = bordered;
    return this;
  }

  /**
   * Włącza tryb kompaktowy – zmniejsza odstępy w komórkach by pomieścić więcej danych na ekranie.
   */
  public setCompact(compact: MaybeSignal<boolean>): this {
    this._data.compact = compact;
    return this;
  }

  /**
   * Przypina nagłówek tabeli do góry (sticky header), co sprawia że pozostaje widczny podczas przewijania pionowego.
   */
  public setStickyHeader(sticky: boolean): this {
    this._data.stickyHeader = sticky;
    return this;
  }

  /**
   * Ustawia z góry określoną wysokość tabeli. Umożliwia zdefiniowanie obszaru wewnętrznego scrollowania.
   */
  public setTableHeight(height: MaybeSignal<string>): this {
    this._data.tableHeight = height;
    return this;
  }

  /**
   * Ustawia komunikat (tekst lub klucz tłumaczenia) wyświetlany, gdy tabela nie zawiera żadnych danych.
   */
  public setEmptyMessage(message: MaybeSignal<Translatable>): this {
    this._data.emptyMessage = message;
    return this;
  }

  /**
   * Określa liczbę atrap wierszy (skeleton loading) rysowanych zanim dane zostaną pobrane z serwera.
   */
  public setSkeletonRows(count: number): this {
    this._data.skeletonRows = count;
    return this;
  }

  /**
   * Pozwala z góry nadać tabeli początkowy stan (np. zapisane z poprzedniej sesji sortowanie lub widoczność kolumn).
   */
  public setInitialState(state: Partial<ErpTableState>): this {
    this._data.initialState = state;
    return this;
  }

  /**
   * Ustawia unikalny klucz stanu tabeli — włącza automatyczny odczyt i (debounced) zapis
   * stanu (paginacja, sortowanie, kolumny) w preferencjach użytkownika przez sam `erp-table`.
   */
  public setStateKey(key: string | undefined): this {
    this._data.stateKey = key;
    return this;
  }

  /**
   * Funkcja wykonywana w momencie pojedynczego kliknięcia na wiersz.
   */
  public setOnRowClick(fn: (row: TData) => void): this {
    this._data.onRowClick = fn;
    return this;
  }

  /**
   * Funkcja wykonywana w momencie podwójnego kliknięcia na wiersz.
   */
  public setOnRowDoubleClick(fn: (row: TData) => void): this {
    this._data.onRowDoubleClick = fn;
    return this;
  }

  /**
   * Ustawia funkcję śledzącą (trackBy), optymalizującą proces przerenderowywania wierszy tabeli w Angularze.
   */
  public setTrackBy(fn: (index: number, row: TData) => any): this {
    this._data.trackBy = fn;
    return this;
  }

  /**
   * Zdarzenie zmiany paginacji.
   */
  public setOnPaginationChange(fn: (state: ErpPaginationState) => void): this {
    this._data.onPaginationChange = fn;
    return this;
  }

  /**
   * Zdarzenie zmiany sortowania.
   */
  public setOnSortChange(fn: (state: ErpSortState[]) => void): this {
    this._data.onSortChange = fn;
    return this;
  }

  /**
   * Wstrzykuje dodatkowe (lub ręczne) elementy do legendy tabeli.
   */
  public setLegendItems(items: MaybeSignal<ErpCellChip[]>): this {
    this._data.legendItems = items;
    return this;
  }

  /**
   * Zewnętrzne filtry przypisane do tabeli.
   */
  public setFilters(filters: MaybeSignal<Record<string, any>>): this {
    this._data.filters = filters;
    return this;
  }


  /**
   * Zdarzenie zmiany zaznaczenia wierszy.
   */
  public setOnSelectionChange(fn: (state: ErpSelectionState<TData>) => void): this {
    this._data.onSelectionChange = fn;
    return this;
  }

  /**
   * Zdarzenie zmiany ogólnego stanu tabeli (paginacja, sortowanie, filtry).
   */
  public setOnStateChange(fn: (state: ErpTableState) => void): this {
    this._data.onStateChange = fn;
    return this;
  }

  /**
   * Włącza tryb grupowanych wierszy (jedna wirtualizowana lista, sztuczne wiersze-rodzice
   * bez związku z kolumnami + kaskadowa selekcja). Wymaga `enableVirtualScroll(true)`.
   */
  public setGroupedRows<TGroup = any>(configureOrDef: ErpGroupedRowsConfig<TGroup, TData> | ((b: ErpGroupedRowsBuilder<TGroup, TData>) => void)): this {
    if (typeof configureOrDef === 'function') {
      const builder = new ErpGroupedRowsBuilder<TGroup, TData>();
      configureOrDef(builder);
      this._data.groupedRows = builder.build();
    } else {
      this._data.groupedRows = configureOrDef;
    }
    return this;
  }
}
