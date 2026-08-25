import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import {
  ErpActionToolbarBuilder,
  ErpActionToolbarComponent,
  ErpActionToolbarContextDirective,
  ErpActionToolbarZoneDirective,
  ErpConfirmDialogBuilder,
  ErpConfirmDialogService,
  ErpSelectionState,
  ErpToastService,
  erpBuildBatchTargets,
  erpSelectionScopeCount,
} from '@erp/shared/ui';
import { ERP_PERMISSIONS, PermissionStore } from '@erp/shared/auth';
import {
  CatalogMultimediaDownloadService,
  CatalogMultimediaOrchestrator,
  MultimediaExecGenerateDerivativesCommand,
  MultimediaRemoveCommand,
  MultimediaVM,
  SearchMultimediaRequest,
} from '@erp/catalog/data-access';

import { MULTIMEDIA_KEYS } from '../../translation';
import { CatalogMultimediaTableComponent } from '../../components/tables/catalog-multimedia-table/catalog-multimedia-table.component';
import { MultimediaStore } from '../multimedia.store';

/** Etykieta wywołującego dla zadań zlecanych z tej strony — grupuje powiadomienia. */
const MULTIMEDIA_LIBRARY_QUEUE_ID = 'catalog-multimedia-library';

/**
 * Lista biblioteki mediów — toolbar + smart tabela nad wszystkimi zasobami katalogu.
 *
 * <b>Po co osobna strona, skoro panel produktu też pokazuje pliki.</b> Panel pokazuje wyłącznie
 * pliki DOPIĘTE do zaznaczonych produktów, więc każdy widoczny w nim zasób ma co najmniej jedną
 * referencję — a taki backend odmawia usunięcia (`multimedia_still_referenced`). Plik nadający
 * się do skasowania jest widoczny dopiero tutaj, po odpięciu go od wszystkich produktów.
 */
@Component({
  selector: 'erp-multimedia-library-tab',
  standalone: true,
  imports: [
    ErpActionToolbarComponent,
    ErpActionToolbarZoneDirective,
    ErpActionToolbarContextDirective,
    CatalogMultimediaTableComponent,
  ],
  template: `
    <div class="h-full w-full p-2">
      <div class="flex flex-col gap-2 h-full w-full" erpActionToolbarZone [erpActionToolbarContext]="actionToolbar">
        <erp-action-toolbar [config]="actionToolbar" />
        <div class="flex-1 overflow-hidden">
          <erp-catalog-multimedia-table
            stateKey="multimedia-library-main"
            [filters]="currentFilters()"
            (selectionChange)="onSelectionChange($event)"
            (loadingChange)="store.setLoading($event)"
            (sortsChange)="store.setSorts($event)"
            class="block h-full"
          />
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultimediaLibraryTabComponent {
  protected readonly store = inject(MultimediaStore);
  private readonly orchestrator = inject(CatalogMultimediaOrchestrator);
  private readonly downloadService = inject(CatalogMultimediaDownloadService);
  private readonly confirmDialog = inject(ErpConfirmDialogService);
  private readonly toast = inject(ErpToastService);
  private readonly permissionStore = inject(PermissionStore);

  private readonly table = viewChild(CatalogMultimediaTableComponent);

  protected readonly currentFilters = computed(() => this.store.filters() as SearchMultimediaRequest);
  protected readonly selectionCount = computed(() => erpSelectionScopeCount(this.store.scope()));

  /** Front chowa akcje, na które backend i tak odpowie 403 — patrz docs/backend/identity-authz.md §6. */
  private readonly canEdit = computed(() => this.permissionStore.has(ERP_PERMISSIONS.Catalog.MultimediaUpdate));

  protected readonly actionToolbar = ErpActionToolbarBuilder.create(b => b
    .setMenuId('multimedia-library-toolbar')
    .setSelectionCount(this.selectionCount)
    .setSelectionScope(this.store.scopeKind)
    .setOnClearSelection(() => {
      this.store.clearSelection();
      this.table()?.clearSelection();
    })
    .addDefaultGroup(g => g
      .setId('library')
      .setLabel(MULTIMEDIA_KEYS.base.toolbar.libraryGroup)
      .addAction(a => a
        .setId('refresh')
        .setLabel(MULTIMEDIA_KEYS.base.toolbar.refresh)
        .setIcon('@tui.refresh-cw')
        .setFn(() => this.store.refresh())
      )
    )
    .addSelectionGroup(g => g
      .setId('selection-actions')
      .setLabel(MULTIMEDIA_KEYS.base.toolbar.selectionGroup)
      // Jedyna akcja tej strony, która działa też nad filtrem: „usuń wszystkie nieużywane"
      // jest sensownym żądaniem, a cele rozwiąże backend z `targetFilter`.
      .addAction(a => a
        .setId('remove')
        .setLabel(MULTIMEDIA_KEYS.base.toolbar.remove)
        .setIcon('@tui.trash')
        .setAppearance('warning')
        .setHidden(computed(() => !this.canEdit()))
        .setFn(() => this.onRemove())
      )
      .addAction(a => a
        .setId('generate-derivatives')
        .setLabel(MULTIMEDIA_KEYS.base.toolbar.generateDerivatives)
        .setIcon('@tui.image')
        .setScopes(['explicit'])
        .setUnavailableHint(MULTIMEDIA_KEYS.base.toolbar.scopeUnavailable)
        .setHidden(computed(() => !this.canEdit()))
        .setFn(() => this.onGenerateDerivatives())
      )
      .addAction(a => a
        .setId('download')
        .setLabel(MULTIMEDIA_KEYS.base.toolbar.download)
        .setIcon('@tui.download')
        .setScopes(['explicit'])
        .setUnavailableHint(MULTIMEDIA_KEYS.base.toolbar.scopeUnavailable)
        .setFn(() => this.onDownload())
      )
    )
  );

  /**
   * Zaznaczone zasoby jako modele widoku.
   *
   * Czyta po `ids` z cache orkiestratora, a nie z `scope.items`, bo przy zaznaczeniu
   * zmaterializowanym („Zaznacz wszystko" rozwiązane do listy) `items` jest z definicji puste —
   * identyfikatory są wtedy jedynym, co zasięg niesie.
   */
  private selectedItems(): MultimediaVM[] {
    const scope = this.store.scope();

    if (scope.kind !== 'explicit') {
      return [];
    }

    const vmMap = this.orchestrator.getViewModel()();

    return scope.ids
      .map(uuid => vmMap.get(uuid))
      .filter((vm): vm is MultimediaVM => vm !== undefined);
  }

  protected onSelectionChange(state: ErpSelectionState<MultimediaVM>): void {
    this.store.setSelection(state);
  }

  /**
   * Usunięcie zasobów z katalogu razem z ich plikami.
   *
   * Cele składa `erpBuildBatchTargets` z zasięgu — przy zaznaczeniu opisanym filtrem lecą jako
   * `targetFilter`, więc „zaznacz wszystko" nad filtrem „tylko nieużywane" znaczy dokładnie
   * „posprzątaj wszystkie osierocone pliki", a nie „tę stronę wyników".
   */
  protected onRemove(): void {
    const count = this.selectionCount();

    if (count === 0) {
      this.toast.show({ message: MULTIMEDIA_KEYS.base.toast.nothingSelected, appearance: 'info' });
      return;
    }

    this.confirmDialog
      .confirm(
        ErpConfirmDialogBuilder.create(b =>
          b.setKeys(MULTIMEDIA_KEYS.base.confirm.remove, { count }).setDestructive(),
        ),
      )
      .subscribe(confirmed => {
        if (!confirmed) return;

        void this.orchestrator
          .removeMultiple(
            {
              ...erpBuildBatchTargets<SearchMultimediaRequest>(this.store.scope()),
              // Pusty szablon jest tu WYMAGANY, mimo że komenda nie ma czego nieść poza uuid:
              // `BatchEndpointBase` rozpoznaje tryb „szablon + cele" po obecności
              // `templateCommand` i bez niego odrzuca żądanie („Brak komend do wykonania"),
              // nawet gdy `targetUuids` jest pełne. Uuid dokłada materializacja, per cel.
              templateCommand: {},
            },
            MULTIMEDIA_LIBRARY_QUEUE_ID,
          )
          .then(() => {
            this.store.clearSelection();
            this.table()?.clearSelection();
          });
      });
  }

  /**
   * Zlecenie wariantów dla WSKAZANYCH zasobów.
   *
   * Odsiewamy tu pliki, które wariantów nie potrzebują (mają je już albo nie są obrazami
   * z naszego magazynu): backend odrzuciłby je osobnym `job_item` z błędem, czyli raportem
   * pełnym „porażek", z których żadna nie jest problemem użytkownika. Kto chce zlecić
   * generowanie nad całym zbiorem, ma do tego filtr „tylko bez miniatur".
   */
  protected async onGenerateDerivatives(): Promise<void> {
    const selected = this.selectedItems();

    const targets = selected.filter(vm => vm.mediaType === 'image' && !vm.originalUrl && !vm.hasDerivatives);

    if (targets.length === 0) {
      this.toast.show({
        message: selected.length === 0
          ? MULTIMEDIA_KEYS.base.toast.nothingSelected
          : MULTIMEDIA_KEYS.base.toast.derivativesNothingToDo,
        appearance: 'info',
      });
      return;
    }

    const commands: MultimediaExecGenerateDerivativesCommand[] = targets.map(vm => ({ uuid: vm.uuid }));

    await this.orchestrator.generateDerivativesMultiple({ commands }, MULTIMEDIA_LIBRARY_QUEUE_ID);

    // Zadanie kończy się na przyjęciu zleceń, nie na gotowych plikach — miniaturka wskoczy
    // do tabeli sama, zdarzeniem `AggregateChanged`. Bez tego zdania użytkownik patrzy na
    // niezmienioną tabelę i uznaje, że akcja nic nie zrobiła.
    this.toast.show({
      message: { key: MULTIMEDIA_KEYS.base.toast.derivativesRequested, params: { count: targets.length } },
      appearance: 'info',
    });
  }

  /** Pobranie oryginałów wskazanych plików — po jednym pobraniu przeglądarki, nie archiwum. */
  protected async onDownload(): Promise<void> {
    const items = this.selectedItems();

    if (items.length === 0) {
      this.toast.show({ message: MULTIMEDIA_KEYS.base.toast.nothingSelected, appearance: 'info' });
      return;
    }

    this.toast.show({
      message: { key: MULTIMEDIA_KEYS.base.toast.downloadStarted, params: { count: items.length } },
      appearance: 'info',
    });

    const result = await this.downloadService.downloadMany(items);

    if (result.failed > 0) {
      this.toast.show({
        message: { key: MULTIMEDIA_KEYS.base.toast.downloadPartial, params: result },
        appearance: 'warning',
      });
    }

    if (result.skippedExternal > 0) {
      this.toast.show({
        message: {
          key: MULTIMEDIA_KEYS.base.toast.downloadSkippedExternal,
          params: { count: result.skippedExternal },
        },
        appearance: 'info',
      });
    }
  }
}
