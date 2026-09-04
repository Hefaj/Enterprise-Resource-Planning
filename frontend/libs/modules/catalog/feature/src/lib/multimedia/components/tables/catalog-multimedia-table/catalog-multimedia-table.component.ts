import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import {
  ErpSelectionMode,
  ErpSelectionState,
  ErpTableBuilder,
  ErpTableComponent,
  ErpTableConfig,
  ErpTableState,
} from '@erp/shared/ui';

import {
  CatalogMultimediaOrchestrator,
  MultimediaVM,
  SearchMultimediaRequest,
  SortOption,
} from '@erp/catalog/data-access';

import { MULTIMEDIA_KEYS } from '../../../translation';
import { MultimediaLibraryThumbnailCellComponent } from './multimedia-library-thumbnail-cell.component';

/**
 * Smart tabela biblioteki mediów — lista serwerowa nad `searchMultimedia`.
 *
 * Różnica wobec tabeli w panelu produktu: tam wiersz jest parą (produkt, plik) i pochodzi
 * z galerii konkretnych produktów, tu wierszem jest **sam zasób**. Dlatego to jedyne miejsce,
 * w którym widać pliki nieużywane przez żaden produkt — czyli te, które w ogóle da się usunąć
 * (`docs/guides/backend/media-storage.md` §4c).
 */
@Component({
  selector: 'erp-catalog-multimedia-table',
  standalone: true,
  imports: [ErpTableComponent],
  template: `<erp-table class="block h-full w-full" [config]="tableConfig()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogMultimediaTableComponent {
  private readonly orchestrator = inject(CatalogMultimediaOrchestrator);

  public readonly filters = input<SearchMultimediaRequest>({});
  public readonly stateKey = input<string>();
  public readonly selectionMode = input<ErpSelectionMode>('multi');

  public readonly selectionChange = output<ErpSelectionState<MultimediaVM>>();
  public readonly loadingChange = output<boolean>();
  public readonly sortsChange = output<SortOption[] | undefined>();

  private readonly currentUuids = signal<string[]>([]);
  private readonly totalCount = signal<number>(0);
  private readonly loading = signal<boolean>(false);

  private readonly tableComponent = viewChild(ErpTableComponent);

  private lastTableState: ErpTableState | null = null;

  public clearSelection(): void {
    this.tableComponent()?.clearSelection();
  }

  protected readonly items = computed<MultimediaVM[]>(() => {
    const uuids = this.currentUuids();
    const vmMap = this.orchestrator.getViewModel()();

    return uuids
      .map(uuid => vmMap.get(uuid))
      .filter((vm): vm is MultimediaVM => vm !== undefined);
  });

  constructor() {
    effect(() => {
      const currentFilters = this.filters();

      // Strażnik: pierwsze pobranie zleca `setOnStateChange` tabeli, po tym jak wyemituje ona
      // swój początkowy stan. Bez tego wejście na widok wysyła dwa identyczne żądania.
      if (this.lastTableState !== null) {
        void this.fetchData(currentFilters, this.lastTableState);
      }
    });
  }

  protected readonly tableConfig = computed<ErpTableConfig<MultimediaVM>>(() => {
    const builder = new ErpTableBuilder<MultimediaVM>()
      .setMode('server')
      .setRowIdAccessor(x => x.uuid)
      // Filtry w konfiguracji tabeli: przy „Zaznacz wszystko" to one opisują zaznaczenie
      // i wracają w `ErpSelectionState.filters` jako cel operacji masowej.
      .setFilters(this.filters)
      .setStateKey(this.stateKey())
      .setEnableVirtualScroll(true)
      .setEstimatedRowHeight(56)
      .setDefaultPageSize(20)
      .setPageSizeOptions([10, 20, 50, 100])
      .setSelectionMode(this.selectionMode())
      .setItems(this.items)
      .setItemCount(this.totalCount)
      .setLoading(this.loading)
      .setEmptyMessage(MULTIMEDIA_KEYS.base.table.emptyMessage)

      .addColumn(c => c
        .setId('thumbnail')
        .setHeader(MULTIMEDIA_KEYS.base.table.columns.thumbnail)
        .setCell(MultimediaLibraryThumbnailCellComponent)
        .setEnableSorting(false)
        .setSize(90)
        .setGrow(0)
      )
      .addColumn(c => c
        .setId('fileName')
        .setAccessorKey('fileName')
        .setHeader(MULTIMEDIA_KEYS.base.table.columns.fileName)
        .setSize(320)
      )
      .addColumn(c => c
        .setId('mediaType')
        .setAccessorKey('mediaType')
        .setHeader(MULTIMEDIA_KEYS.base.table.columns.mediaType)
        .setEnableSorting(false)
        .setSize(120)
        .setGrow(0)
      )
      .addColumn(c => c
        .setId('fileSize')
        .setAccessorKey('fileSize')
        .setHeader(MULTIMEDIA_KEYS.base.table.columns.fileSize)
        .setAlign('right')
        .setEnableSorting(false)
        .setSize(120)
        .setGrow(0)
        .setCellRichContent((bytes: number) => ({ lines: [{ text: formatBytes(bytes) }] }))
      )
      // Kolumna, dla której ta strona istnieje: „nieużywany" to jedyny stan, w którym plik da
      // się usunąć z katalogu — reszta odpada w komendzie z `multimedia_still_referenced`.
      .addColumn(c => c
        .setId('references')
        .setAccessorKey('referenceCount')
        .setHeader(MULTIMEDIA_KEYS.base.table.columns.references)
        .setEnableSorting(false)
        .setSize(140)
        .setGrow(0)
        // Sama liczba, bez etykiety: `ErpCellLine.text` renderuje się dosłownie
        // (`{{ line.text }}`), więc klucz tłumaczenia pokazałby się tu jako klucz.
        // Zero czyta się jednoznacznie — to jest właśnie plik, który da się usunąć.
        .setCellRichContent((count: number) => ({ lines: [{ text: String(count ?? 0) }] }))
      )
      .addColumn(c => c
        .setId('derivatives')
        .setAccessorKey('hasDerivatives')
        .setHeader(MULTIMEDIA_KEYS.base.table.columns.derivatives)
        .setEnableSorting(false)
        .setSize(120)
        .setGrow(0)
        .setCellRichContent((hasDerivatives: boolean) => ({ lines: [{ text: hasDerivatives ? '✓' : '—' }] }))
      );

    builder
      .setOnStateChange(state => {
        const sortingChanged = !this.lastTableState
          || JSON.stringify(this.lastTableState.sorting) !== JSON.stringify(state.sorting);
        const dataStateChanged = !this.lastTableState
          || JSON.stringify(this.lastTableState.pagination) !== JSON.stringify(state.pagination)
          || sortingChanged;

        this.lastTableState = state;

        if (sortingChanged) {
          this.sortsChange.emit(this.toSorts(state));
        }

        if (dataStateChanged) {
          void this.fetchData(this.filters(), state);
        }
      })
      .setOnSelectionChange(state => this.selectionChange.emit(state));

    return builder.build();
  });

  private toSorts(tableState: ErpTableState | null): SortOption[] | undefined {
    if (!tableState?.sorting || tableState.sorting.length === 0) return undefined;

    return tableState.sorting.map(sort => ({
      field: sort.columnId,
      order: sort.direction === 'asc' ? 1 : -1,
    }));
  }

  private async fetchData(
    filters: SearchMultimediaRequest,
    tableState: ErpTableState | null,
  ): Promise<void> {
    this.loading.set(true);
    this.loadingChange.emit(true);

    try {
      const request: SearchMultimediaRequest = {
        ...filters,
        // `pageIndex` liczy od zera, `page` z `PagedRequest` od jedynki.
        page: (tableState?.pagination?.pageIndex ?? 0) + 1,
        pageSize: tableState?.pagination?.pageSize ?? 20,
      };

      const sorts = this.toSorts(tableState);
      if (sorts) {
        request.sorts = sorts;
      }

      const response = await this.orchestrator.searchAsync(request, { autoLoad: true });

      this.currentUuids.set(response.uuids ?? []);
      this.totalCount.set(response.totalCount ?? 0);
    } catch (error) {
      console.error('[CatalogMultimediaTableComponent] Błąd pobierania danych:', error);
      this.currentUuids.set([]);
      this.totalCount.set(0);
    } finally {
      this.loading.set(false);
      this.loadingChange.emit(false);
    }
  }
}

/** Rozmiar pliku w jednostkach czytelnych dla człowieka — dane, nie klucz tłumaczeń. */
function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${parseFloat((bytes / Math.pow(1024, exponent)).toFixed(1))} ${units[exponent]}`;
}
