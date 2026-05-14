import { ChangeDetectionStrategy, Component, computed, input, ViewChild } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { TableModule, Table } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TagModule } from 'primeng/tag';
import { unwrapSignal } from '../../base/erp-signal-utils';


import { 
  ErpTableConfig, 
  ErpTableColumn, 
  ErpCellBadgeConfig,
  ErpCellTagConfig,
  ErpCellLinkConfig,
  ErpCellCustomConfig} from './erp-table.types';

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
        [selection]="currentSelection"
        (selectionChange)="handleSelectionChange($event)"
        [loading]="loadingSignal()"
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

  get currentSelection() {
    return this.config().selection?.() ?? null;
  }

  handleSelectionChange(event: any) {
    this.config().selection?.set(event);
  }

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
    const raw = this.dataSignal();
    const filters = this.externalFiltersSignal();

    if (!filters || Object.keys(filters).length === 0) {
      return raw;
    }

    return raw.filter((row: any) => {
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
}
