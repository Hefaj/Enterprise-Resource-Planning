import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  NgZone,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
  ViewChild,
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { TableModule, Table } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TagModule } from 'primeng/tag';
import { MenuItem } from 'primeng/api';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpContextMenuComponent } from '../../atoms/erp-context-menu/erp-context-menu.component';
import { TranslocoModule } from '@jsverse/transloco';
import { provideSharedTranslations, SHARED_KEYS } from '../../translation';

import {
  ErpTableConfig,
  ErpTableColumn,
  ErpTableLazyEvent,
  ErpCellBadgeConfig,
  ErpCellTagConfig,
  ErpCellLinkConfig,
  ErpCellCustomConfig,
} from './erp-table.types';

/** Liczba kolumn renderowanych poza widocznym obszarem (bufor) */
const COL_BUFFER = 3;
/** Minimalna domyślna szerokość kolumny w px (gdy brak width/minWidth) */
const DEFAULT_COL_WIDTH_PX = 150;

@Component({
  selector: 'erp-table',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    TagModule,
    ErpContextMenuComponent,
    TranslocoModule,
  ],
  template: `
    @let _config = config();
    @let _data = displayData();
    @let _cmItems = contextMenuItemsSignal();

    <div class="erp-table-host flex flex-col gap-4 h-full">
      <!-- Global Filter -->
      @if (_config.globalFilterFields?.length) {
        <div class="flex items-center">
          <p-iconfield>
            <p-inputicon styleClass="pi pi-search" />
            <input
              pInputText
              type="text"
              [placeholder]="SHARED_KEYS.table.search | transloco"
              class="w-full md:w-80"
              (input)="onGlobalFilter($event)"
            />
          </p-iconfield>
        </div>
      }

      <!-- Wrapper dla wirtualizacji kolumn -->
      <div
        #colScrollViewport
        class="erp-col-viewport flex-1 min-h-0 overflow-x-auto overflow-y-hidden"
        (scroll)="onHorizontalScroll($event)"
      >
        <!-- Szeroki kontener – jego szerokość = suma wszystkich kolumn, ale nie mniej niż 100% -->
        <div
          class="erp-col-spacer"
          [style.width]="'100%'"
          [style.min-width.px]="totalColumnsWidth()"
        >
          <p-table
            #dt
            [value]="_data"
            [paginator]="!_config.virtualScroll && (_config.paginator ?? true)"
            [rows]="_config.rows ?? 10"
            [rowsPerPageOptions]="_config.rowsPerPageOptions ?? [10, 25, 50]"
            [globalFilterFields]="_config.globalFilterFields ?? []"
            [scrollable]="true"
            [scrollHeight]="_config.scrollHeight ?? 'flex'"
            [stripedRows]="_config.striped ?? true"
            [selectionMode]="_config.selectionMode ?? null"
            [selection]="currentSelection"
            (selectionChange)="handleSelectionChange($event)"
            [loading]="loadingSignal()"
            [virtualScroll]="_config.virtualScroll ?? false"
            [virtualScrollItemSize]="_config.virtualScrollRowHeight ?? 45"
            [lazy]="!!_config.onLazyLoad"
            [totalRecords]="totalRecordsValue()"
            (onLazyLoad)="handleLazyLoad($event)"
            (onRowSelect)="handleRowSelect($event)"
            (onRowUnselect)="handleRowUnselect($event)"
            [styleClass]="getTableStyleClass(_config)"
            [currentPageReportTemplate]="SHARED_KEYS.table.paginationReport | transloco"
            [showCurrentPageReport]="true"
            [tableStyle]="{ 'table-layout': 'fixed', 'min-width': totalColumnsWidth() + 'px', 'width': '100%' }"
          >
            <!-- Header -->
            <ng-template pTemplate="header">
              <tr>
                @if (_config.selectionMode === 'multiple') {
                  <th style="width: 50px; min-width: 50px;">
                    <p-tableHeaderCheckbox />
                  </th>
                }
                @for (col of visibleColumns(); track col.field) {
                  <th
                    [pSortableColumn]="col.sortable ? col.field : undefined"
                    [style.width]="col.width || (DEFAULT_COL_WIDTH_PX + 'px')"
                    [style.min-width]="col.minWidth || col.width || (DEFAULT_COL_WIDTH_PX + 'px')"
                    [style.text-align]="col.align || 'left'"
                  >
                    <div class="flex items-center gap-2">
                      {{ col.header | transloco }}
                      @if (col.sortable) {
                        <p-sortIcon [field]="col.field" />
                      }
                    </div>
                  </th>
                }
              </tr>

              <!-- Column Filters Row -->
              @if (hasColumnFilters(_config)) {
                <tr>
                  @if (_config.selectionMode === 'multiple') {
                    <th></th>
                  }
                  @for (col of visibleColumns(); track col.field) {
                    <th>
                      @if (col.filterable) {
                        <p-columnFilter
                          [field]="col.field"
                          [matchMode]="col.filterType === 'numeric' ? 'equals' : 'contains'"
                          [showMenu]="false"
                        >
                          <ng-template pTemplate="filter" let-value let-filterCallback="filterCallback">
                            <input
                              pInputText
                              type="text"
                              [value]="value"
                              (input)="filterCallback($any($event.target).value)"
                              class="w-full text-sm"
                              [placeholder]="('Filtruj ' + (col.header | transloco))"
                            />
                          </ng-template>
                        </p-columnFilter>
                      }
                    </th>
                  }
                </tr>
              }
            </ng-template>

            <!-- Body -->
            <ng-template pTemplate="body" let-row let-rowIndex="rowIndex">
              <tr
                [pSelectableRow]="row"
                [pSelectableRowIndex]="rowIndex"
                (contextmenu)="onRowContextMenu($event, row)"
                class="erp-table-row"
              >
                @if (_config.selectionMode === 'multiple') {
                  <td style="width: 50px; min-width: 50px;">
                    <p-tableCheckbox [value]="row" />
                  </td>
                }
                @for (col of visibleColumns(); track col.field) {
                  <td
                    [style.text-align]="col.align || 'left'"
                    [style.width]="col.width || (DEFAULT_COL_WIDTH_PX + 'px')"
                    [style.min-width]="col.minWidth || col.width || (DEFAULT_COL_WIDTH_PX + 'px')"
                  >
                    @switch (col.type) {
                      <!-- Image Renderer -->
                      @case ('image') {
                        @if (row[col.field]) {
                          <img
                            [src]="row[col.field]"
                            [alt]="col.header"
                            [style.width]="$any(col.typeConfig)?.width || '40px'"
                            [style.height]="$any(col.typeConfig)?.height || '40px'"
                            class="object-cover"
                            [class.rounded-full]="$any(col.typeConfig)?.rounded"
                            [class.rounded-lg]="!$any(col.typeConfig)?.rounded"
                          />
                        } @else {
                          <div
                            class="flex items-center justify-center bg-surface-100 dark:bg-surface-800 text-surface-400 dark:text-surface-500"
                            [style.width]="$any(col.typeConfig)?.width || '40px'"
                            [style.height]="$any(col.typeConfig)?.height || '40px'"
                            [class.rounded-full]="$any(col.typeConfig)?.rounded"
                            [class.rounded-lg]="!$any(col.typeConfig)?.rounded"
                          >
                            <i [class]="$any(col.typeConfig)?.fallbackIcon || 'pi pi-image'"></i>
                          </div>
                        }
                      }

                      <!-- Badge Renderer -->
                      @case ('badge') {
                        @if (row[col.field] !== null && row[col.field] !== undefined) {
                          <p-tag
                            [value]="row[col.field] | transloco"
                            [severity]="getBadgeSeverity(row[col.field], col)"
                            [rounded]="true"
                          />
                        }
                      }

                      <!-- Tag Renderer -->
                      @case ('tag') {
                        @if (row[col.field] !== null && row[col.field] !== undefined) {
                          <p-tag
                            [value]="row[col.field] | transloco"
                            [severity]="getTagSeverity(row[col.field], col)"
                            [rounded]="$any(col.typeConfig)?.rounded ?? false"
                          />
                        }
                      }

                      <!-- Boolean Renderer -->
                      @case ('boolean') {
                        <i
                          [class]="row[col.field]
                            ? ($any(col.typeConfig)?.trueIcon || 'pi pi-check-circle')
                            : ($any(col.typeConfig)?.falseIcon || 'pi pi-times-circle')"
                          [ngClass]="row[col.field]
                            ? ($any(col.typeConfig)?.trueClass || 'text-green-500')
                            : ($any(col.typeConfig)?.falseClass || 'text-red-400')"
                        ></i>
                      }

                      <!-- Link Renderer -->
                      @case ('link') {
                        <a
                          class="text-primary-500 hover:text-primary-700 hover:underline cursor-pointer transition-colors"
                          (click)="handleLinkClick(row, col, $event)"
                        >
                          {{ row[col.field] }}
                        </a>
                      }

                      <!-- Custom Renderer -->
                      @case ('custom') {
                        @let _customComponent = unwrapComponent($any(col.typeConfig)?.component);
                        @if (_customComponent) {
                          <ng-container
                            *ngComponentOutlet="_customComponent; inputs: getCustomInputs(row, col)"
                          />
                        }
                      }

                      <!-- Default: Text Renderer -->
                      @default {
                        {{ formatValue(row[col.field], col) }}
                      }
                    }
                  </td>
                }
              </tr>
            </ng-template>

            <!-- Virtual Scroll body (skeleton rows while loading) -->
            @if (_config.virtualScroll) {
              <ng-template pTemplate="loadingbody" let-columns>
                <tr class="erp-skeleton-row">
                  @if (_config.selectionMode === 'multiple') {
                    <td style="width: 50px;"><div class="erp-skeleton"></div></td>
                  }
                  @for (col of visibleColumns(); track col.field) {
                    <td><div class="erp-skeleton"></div></td>
                  }
                </tr>
              </ng-template>
            }

            <!-- Empty Message -->
            <ng-template pTemplate="emptymessage">
              <tr>
                <td
                  [attr.colspan]="visibleColumns().length + (_config.selectionMode === 'multiple' ? 1 : 0)"
                  class="text-center py-12"
                >
                  <div class="flex flex-col items-center gap-3 text-surface-400 dark:text-surface-500">
                    <i class="pi pi-inbox text-4xl"></i>
                    <span class="text-lg">{{ _config.emptyMessage ? (_config.emptyMessage | transloco) : (SHARED_KEYS.table.empty | transloco) }}</span>
                  </div>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>
      </div>
    </div>

    <!-- Context Menu – renderowany poza tabelą by uniknąć overflow issues -->
    @if (_cmItems && _cmItems.length > 0) {
      <erp-context-menu #cm [config]="contextMenuConfig()" />
    }
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      position: relative;
    }

    .erp-col-viewport {
      position: relative;
      display: flex;
      flex-direction: column;
    }

    .erp-col-spacer {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    /* Ukrywamy poziomy scrollbar viewportu – PrimeNG obsługuje własny */
    .erp-col-viewport::-webkit-scrollbar {
      height: 8px;
    }
    .erp-col-viewport::-webkit-scrollbar-track {
      background: var(--p-surface-100);
    }
    .erp-col-viewport::-webkit-scrollbar-thumb {
      background: var(--p-surface-300);
      border-radius: 4px;
    }

    :host ::ng-deep p-table {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    :host ::ng-deep .p-datatable {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    :host ::ng-deep .p-datatable-wrapper {
      flex: 1;
      min-height: 0;
      overflow-x: hidden; /* poziomy scroll obsługuje nasz viewport */
    }
    :host ::ng-deep .p-datatable .p-datatable-thead > tr > th {
      background: var(--p-surface-0);
      color: var(--p-surface-700);
      font-weight: 600;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-color: var(--p-surface-200);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    :host ::ng-deep .p-datatable .p-datatable-tbody > tr > td {
      border-color: var(--p-surface-100);
      color: var(--p-surface-700);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    :host ::ng-deep .p-datatable .p-datatable-tbody > tr:hover > td {
      background: var(--p-surface-50) !important;
    }
    :host ::ng-deep .erp-table-row {
      cursor: context-menu;
    }

    /* Skeleton loading rows */
    .erp-skeleton {
      height: 1rem;
      border-radius: 4px;
      background: linear-gradient(
        90deg,
        var(--p-surface-200) 25%,
        var(--p-surface-100) 50%,
        var(--p-surface-200) 75%
      );
      background-size: 200% 100%;
      animation: erp-shimmer 1.4s infinite;
    }
    @keyframes erp-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* Dark mode */
    :host-context(.dark) ::ng-deep .p-datatable .p-datatable-thead > tr > th,
    :host-context([data-theme="dark"]) ::ng-deep .p-datatable .p-datatable-thead > tr > th {
      background: var(--p-surface-900);
      color: var(--p-surface-300);
      border-color: var(--p-surface-800);
    }
    :host-context(.dark) ::ng-deep .p-datatable .p-datatable-tbody > tr > td,
    :host-context([data-theme="dark"]) ::ng-deep .p-datatable .p-datatable-tbody > tr > td {
      color: var(--p-surface-300);
      border-color: var(--p-surface-800);
    }
    :host-context(.dark) ::ng-deep .p-datatable .p-datatable-tbody > tr:hover > td,
    :host-context([data-theme="dark"]) ::ng-deep .p-datatable .p-datatable-tbody > tr:hover > td {
      background: var(--p-surface-800) !important;
    }
    :host-context(.dark) ::ng-deep .p-paginator,
    :host-context([data-theme="dark"]) ::ng-deep .p-paginator {
      background: var(--p-surface-900);
      border-color: var(--p-surface-800);
    }
    :host-context(.dark) .erp-skeleton,
    :host-context([data-theme="dark"]) .erp-skeleton {
      background: linear-gradient(
        90deg,
        var(--p-surface-800) 25%,
        var(--p-surface-700) 50%,
        var(--p-surface-800) 75%
      );
      background-size: 200% 100%;
      animation: erp-shimmer 1.4s infinite;
    }
    :host-context(.dark) .erp-col-viewport::-webkit-scrollbar-track,
    :host-context([data-theme="dark"]) .erp-col-viewport::-webkit-scrollbar-track {
      background: var(--p-surface-800);
    }
    :host-context(.dark) .erp-col-viewport::-webkit-scrollbar-thumb,
    :host-context([data-theme="dark"]) .erp-col-viewport::-webkit-scrollbar-thumb {
      background: var(--p-surface-600);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpTableComponent implements OnInit, OnDestroy {
  protected readonly SHARED_KEYS = SHARED_KEYS;

  @ViewChild('dt') table!: Table;
  private colScrollViewport = viewChild<ElementRef<HTMLDivElement>>('colScrollViewport');
  private contextMenuRef = viewChild<ErpContextMenuComponent>('cm');

  /** Stała eksportowana do szablonu */
  protected readonly DEFAULT_COL_WIDTH_PX = DEFAULT_COL_WIDTH_PX;

  /** Konfiguracja tabeli (kolumny, paginacja, sortowanie itp.) */
  public config = input.required<ErpTableConfig>();

  private zone = inject(NgZone);

  // ── Signals wyliczone z config ──

  protected dataSignal = computed(() => {
    const rawData = this.config().data;
    return typeof rawData === 'function' ? rawData() : (rawData || []);
  });

  protected externalFiltersSignal = computed(() => {
    const rawFilters = this.config().externalFilters;
    return typeof rawFilters === 'function' ? rawFilters() : (rawFilters || {});
  });

  protected loadingSignal = computed(() => {
    const rawLoading = this.config().loading;
    return typeof rawLoading === 'function' ? rawLoading() : !!rawLoading;
  });

  protected totalRecordsValue = computed(() => {
    const raw = this.config().totalRecords;
    if (raw === undefined || raw === null) return 0;
    return typeof raw === 'function' ? (raw as any)() : raw;
  });

  protected contextMenuItemsSignal = computed(() =>
    unwrapSignal(this.config().contextMenuItems) ?? []
  );

  protected contextMenuConfig = computed(() => ({
    items: this.contextMenuItemsSignal() as MenuItem[],
    global: false,
  }));

  get currentSelection() {
    return this.config().selection?.() ?? null;
  }

  handleSelectionChange(event: any) {
    this.config().selection?.set(event);
  }

  // ── Wirtualizacja kolumn ──

  /** Indeks pierwszej widocznej kolumny */
  private firstVisibleColIndex = signal(0);

  /** Liczba widocznych kolumn (obliczona z szerokości viewportu) */
  private visibleColCount = signal(20);

  /** Łączna szerokość wszystkich kolumn w px */
  protected totalColumnsWidth = computed(() => {
    const cols = this.config().columns;
    const selectionColW = this.config().selectionMode === 'multiple' ? 50 : 0;
    return (
      selectionColW +
      cols.reduce((sum, col) => sum + this.getColWidthPx(col), 0)
    );
  });

  /** Kolumny do wyrenderowania (okno wirtualizacji + bufor) */
  protected visibleColumns = computed(() => {
    const allCols = this.config().columns;
    const total = allCols.length;

    // Jeśli kolumn jest mało, renderuj wszystkie
    if (total <= 30) return allCols;

    const first = Math.max(0, this.firstVisibleColIndex() - COL_BUFFER);
    const last = Math.min(total, this.firstVisibleColIndex() + this.visibleColCount() + COL_BUFFER);
    return allCols.slice(first, last);
  });

  // ── Dane do wyświetlenia (filtrowane zewnętrznie tylko w trybie non-lazy) ──

  protected displayData = computed(() => {
    // W trybie lazy dane przychodzą gotowe – nie filtrujemy lokalnie
    if (this.config().onLazyLoad) {
      return this.dataSignal();
    }

    const raw = this.dataSignal();
    const filters = this.externalFiltersSignal();

    if (!filters || Object.keys(filters).length === 0) {
      return raw;
    }

    return raw.filter((row: any) => {
      return Object.entries(filters).every(([key, filterValue]) => {
        if (filterValue === null || filterValue === undefined || filterValue === '') return true;
        const cellValue = row[key];
        if (cellValue === null || cellValue === undefined) return false;
        if (typeof filterValue === 'string') {
          return String(cellValue).toLowerCase().includes(filterValue.toLowerCase());
        }
        if (Array.isArray(filterValue)) return filterValue.includes(cellValue);
        return cellValue === filterValue;
      });
    });
  });

  // ── Lifecycle ──

  private resizeObserver?: ResizeObserver;

  ngOnInit(): void {
    // Obserwujemy zmiany szerokości viewportu, by przeliczyć liczbę widocznych kolumn
    const el = this.colScrollViewport()?.nativeElement;
    if (el) {
      this.resizeObserver = new ResizeObserver(() => {
        this.zone.run(() => this.recalcVisibleCols(el));
      });
      this.resizeObserver.observe(el);
      this.recalcVisibleCols(el);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  // ── Horizontal scroll handler ──

  protected onHorizontalScroll(event: Event): void {
    const el = event.target as HTMLDivElement;
    this.updateVisibleColumnWindow(el.scrollLeft, el.clientWidth);
  }

  private updateVisibleColumnWindow(scrollLeft: number, viewportWidth: number): void {
    const cols = this.config().columns;
    let offset = 0;
    let firstIdx = 0;

    for (let i = 0; i < cols.length; i++) {
      const colW = this.getColWidthPx(cols[i]);
      if (offset + colW > scrollLeft) {
        firstIdx = i;
        break;
      }
      offset += colW;
    }

    const colCount = Math.ceil(viewportWidth / DEFAULT_COL_WIDTH_PX) + 1;

    this.firstVisibleColIndex.set(firstIdx);
    this.visibleColCount.set(colCount);
  }

  private recalcVisibleCols(el: HTMLDivElement): void {
    const viewportWidth = el.clientWidth;
    const colCount = Math.ceil(viewportWidth / DEFAULT_COL_WIDTH_PX) + 1;
    this.visibleColCount.set(colCount);
  }

  // ── Pipe instances ──
  private currencyPipe = new CurrencyPipe('pl-PL');
  private datePipe = new DatePipe('pl-PL');
  private decimalPipe = new DecimalPipe('pl-PL');
  private percentPipe = new PercentPipe('pl-PL');

  // ── Lazy load ──

  protected handleLazyLoad(event: any): void {
    const lazyEvent: ErpTableLazyEvent = {
      first: event.first ?? 0,
      rows: event.rows ?? this.config().rows ?? 50,
      sortField: event.sortField,
      sortOrder: event.sortOrder,
    };
    this.config().onLazyLoad?.(lazyEvent);
  }

  // ── Context menu ──

  protected onRowContextMenu(event: MouseEvent, row: any): void {
    event.preventDefault();
    const items = this.contextMenuItemsSignal();
    if (!items || items.length === 0) return;
    this.contextMenuRef()?.show(event);
  }

  // ── Event Handlers ──

  protected onGlobalFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.table.filterGlobal(value, 'contains');
  }

  protected handleRowSelect(event: any): void {
    this.config().onRowSelect?.(event.data);
  }

  protected handleRowUnselect(event: any): void {
    this.config().onRowUnselect?.(event.data);
  }

  protected handleLinkClick(row: any, col: ErpTableColumn, event: Event): void {
    event.preventDefault();
    const linkConfig = col.typeConfig as ErpCellLinkConfig;
    linkConfig?.onClick?.(row);
  }

  // ── Cell Renderer Helpers ──

  protected hasColumnFilters(config: ErpTableConfig): boolean {
    return config.columns.some(c => c.filterable);
  }

  protected getTableStyleClass(config: ErpTableConfig): string {
    const classes: string[] = [];
    if (config.size === 'small') classes.push('p-datatable-sm');
    if (config.size === 'large') classes.push('p-datatable-lg');
    return classes.join(' ');
  }

  protected getBadgeSeverity(value: any, col: ErpTableColumn): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    const config = col.typeConfig as ErpCellBadgeConfig;
    return config?.severityMap?.[String(value)] || 'info';
  }

  protected getTagSeverity(value: any, col: ErpTableColumn): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    const config = col.typeConfig as ErpCellTagConfig;
    return (config?.severityMap?.[String(value)] as any) || 'info';
  }

  protected getCustomInputs(row: any, col: ErpTableColumn): Record<string, any> {
    const config = col.typeConfig as ErpCellCustomConfig;
    return {
      ...config?.inputs,
      row,
      field: col.field,
      value: row[col.field],
    };
  }

  protected unwrapComponent(componentSignal: any) {
    if (!componentSignal) return null;
    return unwrapSignal(componentSignal);
  }

  protected formatValue(value: any, col: ErpTableColumn): string {
    if (value === null || value === undefined) return '—';

    switch (col.pipe) {
      case 'currency':
        return this.currencyPipe.transform(value, col.pipeArgs || 'PLN', 'symbol', '1.2-2') || String(value);
      case 'date':
        return this.datePipe.transform(value, col.pipeArgs || 'dd.MM.yyyy') || String(value);
      case 'number':
        return this.decimalPipe.transform(value, col.pipeArgs || '1.0-2') || String(value);
      case 'percent':
        return this.percentPipe.transform(value, col.pipeArgs || '1.0-0') || String(value);
      default:
        return String(value);
    }
  }

  /** Zwraca szerokość kolumny w px (parsuje string CSS lub zwraca domyślną). */
  private getColWidthPx(col: ErpTableColumn): number {
    const raw = col.width || col.minWidth;
    if (!raw) return DEFAULT_COL_WIDTH_PX;
    const parsed = parseFloat(raw);
    return isNaN(parsed) ? DEFAULT_COL_WIDTH_PX : parsed;
  }
}
