import { ChangeDetectionStrategy, Component, computed, input, model, Type, ViewChild } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { TableModule, Table } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TagModule } from 'primeng/tag';
import { ErpTableBuilder } from './erp-table.builder';

export { ErpTableBuilder };

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
  component: Type<any>;
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
}

export type ErpTableFilters = Record<string, any>;

// ── Component ───────────────────────────────────────────

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
  ],
  template: `
    @let _config = config();
    @let _data = filteredData();

    <div class="flex flex-col gap-4 h-full">
      <!-- Global Filter -->
      @if (_config.globalFilterFields?.length) {
        <div class="flex items-center">
          <p-iconfield>
            <p-inputicon styleClass="pi pi-search" />
            <input
              pInputText
              type="text"
              [placeholder]="'Szukaj...'"
              class="w-full md:w-80"
              (input)="onGlobalFilter($event)"
            />
          </p-iconfield>
        </div>
      }

      <!-- Table -->
      <p-table
        #dt
        [value]="_data"
        [paginator]="_config.paginator ?? true"
        [rows]="_config.rows ?? 10"
        [rowsPerPageOptions]="_config.rowsPerPageOptions ?? [10, 25, 50]"
        [globalFilterFields]="_config.globalFilterFields ?? []"
        [scrollable]="_config.scrollable ?? true"
        [scrollHeight]="_config.scrollHeight ?? 'flex'"
        [stripedRows]="_config.striped ?? true"
        [selectionMode]="_config.selectionMode ?? null"
        [(selection)]="selection"
        [loading]="loading()"
        [tableStyle]="{ 'min-width': '50rem' }"
        (onRowSelect)="handleRowSelect($event)"
        (onRowUnselect)="handleRowUnselect($event)"
        [styleClass]="getTableStyleClass(_config)"
        [currentPageReportTemplate]="'Pokazuję {first} do {last} z {totalRecords} rekordów'"
        [showCurrentPageReport]="true"
      >
        <!-- Header -->
        <ng-template pTemplate="header">
          <tr>
            @if (_config.selectionMode === 'multiple') {
              <th style="width: 4rem">
                <p-tableHeaderCheckbox />
              </th>
            }
            @for (col of _config.columns; track col.field) {
              <th
                [pSortableColumn]="col.sortable ? col.field : undefined"
                [style.width]="col.width || 'auto'"
                [style.min-width]="col.minWidth || 'auto'"
                [style.text-align]="col.align || 'left'"
              >
                <div class="flex items-center gap-2">
                  {{ col.header }}
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
              @for (col of _config.columns; track col.field) {
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
                          [placeholder]="'Filtruj ' + col.header"
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
          <tr [pSelectableRow]="row" [pSelectableRowIndex]="rowIndex">
            @if (_config.selectionMode === 'multiple') {
              <td>
                <p-tableCheckbox [value]="row" />
              </td>
            }
            @for (col of _config.columns; track col.field) {
              <td [style.text-align]="col.align || 'left'">
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
                        [value]="row[col.field]" 
                        [severity]="getBadgeSeverity(row[col.field], col)"
                        [rounded]="true"
                      />
                    }
                  }

                  <!-- Tag Renderer -->
                  @case ('tag') {
                    @if (row[col.field] !== null && row[col.field] !== undefined) {
                      <p-tag 
                        [value]="row[col.field]" 
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
                    @if ($any(col.typeConfig)?.component) {
                      <ng-container 
                        *ngComponentOutlet="$any(col.typeConfig).component; inputs: getCustomInputs(row, col)" 
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

        <!-- Empty Message -->
        <ng-template pTemplate="emptymessage">
          <tr>
            <td
              [attr.colspan]="_config.columns.length + (_config.selectionMode === 'multiple' ? 1 : 0)"
              class="text-center py-12"
            >
              <div class="flex flex-col items-center gap-3 text-surface-400 dark:text-surface-500">
                <i class="pi pi-inbox text-4xl"></i>
                <span class="text-lg">{{ _config.emptyMessage || 'Brak danych do wyświetlenia' }}</span>
              </div>
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
    :host ::ng-deep .p-datatable .p-datatable-thead > tr > th {
      background: var(--p-surface-0);
      color: var(--p-surface-700);
      font-weight: 600;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-color: var(--p-surface-200);
    }
    :host ::ng-deep .p-datatable .p-datatable-tbody > tr > td {
      border-color: var(--p-surface-100);
      color: var(--p-surface-700);
    }
    :host ::ng-deep .p-datatable .p-datatable-tbody > tr:hover > td {
      background: var(--p-surface-50) !important;
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
      background: var(--p-surface-950);
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
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpTableComponent {
  @ViewChild('dt') table!: Table;

  /** Konfiguracja tabeli (kolumny, paginacja, sortowanie itp.) */
  public config = input.required<ErpTableConfig>();

  /** Dane do wyświetlenia */
  public data = input<any[]>([]);

  /** Filtry zewnętrzne (np. z globalnego panelu ErpDynamicFilter) */
  public externalFilters = input<ErpTableFilters>({});

  /** Stan ładowania */
  public loading = input<boolean>(false);

  /** Kompatybilność z ErpTabs (kontekst zakładki) */
  public tabValue = input<string | number>();

  /** Selekcja wierszy (two-way binding) */
  public selection = model<any>(null);

  // ── Pipe instances ──
  private currencyPipe = new CurrencyPipe('pl-PL');
  private datePipe = new DatePipe('pl-PL');
  private decimalPipe = new DecimalPipe('pl-PL');
  private percentPipe = new PercentPipe('pl-PL');

  /**
   * Dane przefiltrowane przez filtry zewnętrzne.
   * Filtry kolumnowe (wbudowane w p-table) działają niezależnie, na warstwie PrimeNG.
   */
  protected filteredData = computed(() => {
    const raw = this.data();
    const filters = this.externalFilters();

    if (!filters || Object.keys(filters).length === 0) {
      return raw;
    }

    return raw.filter(row => {
      return Object.entries(filters).every(([key, filterValue]) => {
        if (filterValue === null || filterValue === undefined || filterValue === '') {
          return true;
        }

        const cellValue = row[key];
        if (cellValue === null || cellValue === undefined) {
          return false;
        }

        if (typeof filterValue === 'string') {
          return String(cellValue).toLowerCase().includes(filterValue.toLowerCase());
        }

        if (Array.isArray(filterValue)) {
          return filterValue.includes(cellValue);
        }

        return cellValue === filterValue;
      });
    });
  });

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
}
