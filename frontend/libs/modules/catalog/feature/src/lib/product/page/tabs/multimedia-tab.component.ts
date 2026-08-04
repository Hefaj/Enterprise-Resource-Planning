import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductStore } from '../product.store';
import { MAX_DETAILED_SELECTION } from '@erp/catalog/util';
import { ErpScrollViewportBuilder, ErpScrollViewportComponent } from '@erp/shared/ui';
import { CatalogProductOrchestrator, ProductVM } from '@erp/catalog/data-access';
import { MultimediaGroupComponent } from './multimedia-group.component';
import { ErpSelectionToolbarComponent } from '@erp/shared/ui';
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
    ErpSelectionToolbarComponent,
    ErpTranslatePipe,
    TuiButton,
    TuiIcon
  ],
  template: `
    <div class="erp-multimedia-tab">
      @if (_selectionCount() === 0) {
        <div class="erp-multimedia-tab__empty">
          <p>{{ (PRODUCT_KEYS.base.multimedia.panel.emptySelection | erpTranslate) || '' }}</p>
        </div>
      } 
      @else {
        <!-- Pasek akcji grupowych -->
        @if (_subSelectionCount() > 0) {
          <!-- Pasek dla wybranych zdjęć (podzaznaczenie) -->
          <erp-selection-toolbar 
            [count]="_subSelectionCount()" 
            [active]="true" 
            [translationKey]="'shared.selectionToolbar.selectedFiles'">
            <button tuiButton size="s" appearance="destructive" (click)="onDeleteSelectedMedia()">
              <tui-icon icon="@tui.trash" />
              Usuń zaznaczone
            </button>
            <button tuiButton size="s" appearance="secondary" (click)="onClearMediaSelection()">
              <tui-icon icon="@tui.x" />
              Anuluj
            </button>
          </erp-selection-toolbar>
        } @else if (_selectionCount() > 1) {
          <!-- Pasek dla wybranych produktów -->
          <erp-selection-toolbar [count]="_selectionCount()">
            <button tuiButton size="s" appearance="primary" (click)="onAddMass()">
              <tui-icon icon="@tui.plus" />
              {{ (PRODUCT_KEYS.base.multimedia.panel.bulkAdd | erpTranslate) || '' }}
            </button>
            <button tuiButton size="s" appearance="destructive" (click)="onDeleteMass()">
              <tui-icon icon="@tui.trash" />
              {{ (PRODUCT_KEYS.base.multimedia.panel.bulkDelete | erpTranslate) || '' }}
            </button>
          </erp-selection-toolbar>
        }

        <div class="erp-multimedia-tab__content">
          @if (_selectionCount() <= MAX_DETAILED_SELECTION) {
            <!-- Tryb MULTI (TanStack Virtual) -->
            <div class="erp-multimedia-tab__multi">
              <erp-scroll-viewport [config]="scrollConfig">
                <ng-template #erpScrollItem let-product let-index="index" let-measureFn="measureElement">
                  <erp-multimedia-group [product]="product" [measureElement]="measureFn" [attr.data-index]="index" />
                </ng-template>
              </erp-scroll-viewport>
            </div>
          } @else {
            <!-- Tryb skrócony dla bardzo wielu elementów -->
            <div class="erp-multimedia-tab__bulk-placeholder">
              <tui-icon icon="@tui.layers" class="erp-multimedia-tab__bulk-icon" />
              <p class="erp-multimedia-tab__bulk-text">
                Szczegóły ukryte ze względu na liczbę zaznaczonych elementów.<br>
                Użyj górnego paska, aby zastosować zmiany dla wszystkich <strong>{{ _selectionCount() }}</strong> produktów.
              </p>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
    
    .erp-multimedia-tab {
      height: 100%;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
    }

    .erp-multimedia-tab__empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--tui-text-secondary);
      font-size: 1.125rem;
    }

    .erp-multimedia-tab__content {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    .erp-multimedia-tab__multi {
      flex: 1;
      height: 100%;
    }

    .erp-multimedia-tab__bulk-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      text-align: center;
      padding: 2rem;
    }

    .erp-multimedia-tab__bulk-icon {
      font-size: 3rem;
      color: var(--tui-text-secondary);
      margin-bottom: 1rem;
    }

    .erp-multimedia-tab__bulk-text {
      color: var(--tui-text-secondary);
      line-height: 1.5;
    }
  `],
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
