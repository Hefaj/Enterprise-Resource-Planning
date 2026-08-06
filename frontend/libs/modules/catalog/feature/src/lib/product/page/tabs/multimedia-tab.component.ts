import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductStore } from '../product.store';
import { MAX_DETAILED_SELECTION } from '@erp/catalog/util';
import { ErpScrollViewportBuilder, ErpScrollViewportComponent } from '@erp/shared/ui';
import { CatalogProductOrchestrator, ProductVM } from '@erp/catalog/data-access';
import { MultimediaGroupComponent } from './multimedia-group.component';
import { ErpActionToolbarBuilder, ErpActionToolbarComponent, ErpActionToolbarZoneDirective, ErpActionToolbarContextDirective } from '@erp/shared/ui';
import { PRODUCT_KEYS } from '../../translation/keys';
import { ErpTranslatePipe } from '@erp/shared/ui';
import { TuiButton, TuiIcon } from '@taiga-ui/core';

@Component({
  selector: 'erp-multimedia-tab',
  standalone: true,
  imports: [
    CommonModule, 
    ErpScrollViewportComponent, 
    MultimediaGroupComponent, 
    ErpActionToolbarComponent,
    ErpActionToolbarZoneDirective,
    ErpActionToolbarContextDirective,
    ErpTranslatePipe,
    TuiIcon
  ],
  template: `
    <div class="h-full w-full p-2">
      <div class="flex flex-col gap-2 h-full w-full" erpActionToolbarZone [erpActionToolbarContext]="toolbarConfig">
        @if (_selectionCount() === 0) {
          <div class="flex items-center justify-center h-full text-[var(--tui-text-secondary)] text-lg">
            <p>{{ (PRODUCT_KEYS.base.multimedia.panel.emptySelection | erpTranslate) || '' }}</p>
          </div>
        } 
        @else {
          <!-- Pasek akcji grupowych i multimediów -->
          <erp-action-toolbar [config]="toolbarConfig" />

          <div class="flex-1 overflow-hidden" >
            @if (_selectionCount() <= MAX_DETAILED_SELECTION) {
              <!-- Tryb MULTI (TanStack Virtual) -->
              <div class="h-full w-full">
                <erp-scroll-viewport [config]="scrollConfig">
                  <ng-template #erpScrollItem let-product let-index="index" let-measureFn="measureElement">
                    <erp-multimedia-group [product]="product" [measureElement]="measureFn" [attr.data-index]="index" />
                  </ng-template>
                </erp-scroll-viewport>
              </div>
            } @else {
              <!-- Tryb skrócony dla bardzo wielu elementów -->
              <div class="flex flex-col items-center justify-center h-full text-center p-8">
                <tui-icon icon="@tui.layers" class="text-[3rem] text-[var(--tui-text-secondary)] mb-4" />
                <p class="text-[var(--tui-text-secondary)] leading-relaxed">
                  Szczegóły ukryte ze względu na liczbę zaznaczonych elementów.<br>
                  Użyj górnego paska, aby zastosować zmiany dla wszystkich <strong>{{ _selectionCount() }}</strong> produktów.
                </p>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultimediaTabComponent {
  private readonly store = inject(ProductStore);
  private readonly productOrchestrator = inject(CatalogProductOrchestrator);

  protected readonly MAX_DETAILED_SELECTION = MAX_DETAILED_SELECTION;
  protected readonly PRODUCT_KEYS = PRODUCT_KEYS;
  
  protected readonly _selectedProducts = computed(() => {
    const selectedItems = this.store.selection()?.selectedItems || [];
    if (selectedItems.length === 0) return [];

    const uuids = selectedItems.map(item => item.uuid);
    const signalMap = this.productOrchestrator.getSignalViewModel();

    return uuids.map(uuid => {
      const vmSignal = signalMap.get(uuid);
      const latestVm = vmSignal ? vmSignal() : null;
      return latestVm || selectedItems.find(x => x.uuid === uuid)!;
    });
  });
  protected readonly _selectionCount = computed(() => this._selectedProducts().length);
  protected readonly _subSelectionCount = computed(() => this.store.selectedMultimedia().size);
  protected readonly _hideMassActions = computed(() => this._selectionCount() <= 1);

  protected readonly toolbarConfig = ErpActionToolbarBuilder.create(b => b
    .setMenuId('multimedia-toolbar')
    .setSelectionCount(this._subSelectionCount)
    .setSelectionLabel('shared.selectionToolbar.selectedFiles')
    .setOnClearSelection(() => this.onClearMediaSelection())
    .addDefaultGroup(g => g
      .setId('mass-actions')
      .setLabel('Masowe zarządzanie')
      .addAction(a => a
        .setId('mass-add')
        // .setLabel(this.PRODUCT_KEYS.base.multimedia.panel.bulkAdd)
        .setLabel('Dodaj multimedia masowo')
        .setIcon('@tui.plus')
        .setAppearance('success')
        .setFn(() => this.onAddMass())
      )
      .addAction(a => a
        .setId('mass-delete')
        // .setLabel(this.PRODUCT_KEYS.base.multimedia.panel.bulkDelete)
        .setLabel('Usuń wszystkie multimedia')
        .setIcon('@tui.trash')
        .setAppearance('warning')
        .setFn(() => this.onDeleteMass())
      )
    )
    .addDefaultGroup(g => g
      .setId('tools')
      .setLabel('Narzędzia')
      .addAction(a => a
        .setId('scan')
        .setLabel('Skanuj foldery')
        .setIcon('@tui.scan')
        .setFn(() => console.log('Skanuj'))
      )
      .addAction(a => a
        .setId('thumbnails')
        .setLabel('Generuj miniatury')
        .setIcon('@tui.image')
        .setFn(() => console.log('Miniatury'))
      )
    )
    .addSelectionGroup(g => g
      .setId('selection-actions')
      .setLabel('Wybrane operacje')
      .addAction(a => a
        .setId('delete-selected')
        .setLabel('Usuń zaznaczone')
        .setIcon('@tui.trash')
        .setAppearance('warning')
        .setFn(() => this.onDeleteSelectedMedia())
      )
      .addAction(a => a
        .setId('download')
        .setLabel('Pobierz oryginały')
        .setIcon('@tui.download')
        .setFn(() => console.log('Pobierz'))
      )
      .addAction(a => a
        .setId('optimize')
        .setLabel('Optymalizuj wybrane')
        .setIcon('@tui.wand')
        .setFn(() => console.log('Optymalizuj'))
      )
    )
  );

  // Zbiór UUID dla których już wywołaliśmy ładowanie
  private readonly loadedProductUuids = new Set<string>();

  protected readonly scrollConfig = new ErpScrollViewportBuilder<ProductVM>()
    .setItems(this._selectedProducts)
    .setGetItemKey((_, item: ProductVM) => item.uuid)
    .setEstimateSize(250)
    .setOverscan(2)
    .setOnRangeChange((range) => {
      // Lazy-load: dociągnij produkty z wymuszeniem wczytania multimediów
      const uuidsToLoad = range.visibleKeys.filter((uuid: string) => !this.loadedProductUuids.has(uuid));

      if (uuidsToLoad.length > 0) {
        for (const uuid of uuidsToLoad) {
          this.loadedProductUuids.add(uuid);
        }
        // Request batch load for the new uuids
        this.productOrchestrator.loadAsync(uuidsToLoad, { includeMultimedia: true });
      }
    })
    .build();

  protected onAddMass(): void {
    console.log('Masowe dodawanie multimediów dla', this._selectionCount(), 'produktów');
  }

  protected onDeleteMass(): void {
    console.log('Masowe usuwanie multimediów dla', this._selectionCount(), 'produktów');
  }

  protected onDeleteSelectedMedia(): void {
    console.log('Usuwanie zaznaczonych multimediów:', this.store.selectedMultimedia());
    // this.store.clearMultimediaSelection();
  }

  protected onClearMediaSelection(): void {
    // Zakładam, że w store będzie metoda czyszcząca, tu na razie log
    console.log('Czyszczenie zaznaczenia zdjęć');
    // this.store.clearMultimediaSelection();
  }
}
