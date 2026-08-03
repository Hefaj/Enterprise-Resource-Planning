import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductListViewStore } from '../product-list-view.store';
import { MAX_DETAILED_SELECTION } from '@erp/catalog/util';
import { ErpScrollViewportBuilder, ErpScrollViewportComponent } from '@erp/shared/ui';
import { CatalogMultimediaOrchestrator, ProductVM } from '@erp/catalog/data-access';
import { MultimediaGroupComponent } from './multimedia-group.component';
import { MultimediaBulkPanelComponent } from './multimedia-bulk-panel.component';
import { PRODUCT_KEYS } from '../../translation/keys';
import { ErpTranslatePipe } from '@erp/shared/ui';

@Component({
  selector: 'erp-multimedia-tab',
  standalone: true,
  imports: [
    CommonModule, 
    ErpScrollViewportComponent, 
    MultimediaGroupComponent, 
    MultimediaBulkPanelComponent,
    ErpTranslatePipe
  ],
  template: `
    <div class="erp-multimedia-tab">
      @if (_selectionCount() === 0) {
        <div class="erp-multimedia-tab__empty">
          <p>{{ (PRODUCT_KEYS.base.multimedia.panel.emptySelection | erpTranslate) || '' }}</p>
        </div>
      } @else if (_selectionCount() === 1) {
        <!-- Tryb SINGLE -->
        <div class="erp-multimedia-tab__single">
          <erp-multimedia-group [product]="_selectedProducts()[0]" />
        </div>
      } @else if (_selectionCount() <= MAX_DETAILED_SELECTION) {
        <!-- Tryb MULTI (TanStack Virtual) -->
        <div class="erp-multimedia-tab__multi">
          <erp-scroll-viewport [config]="scrollConfig">
            <ng-template #erpScrollItem let-product let-index="index" let-measureFn="measureElement">
              <erp-multimedia-group [product]="product" [measureElement]="measureFn" [attr.data-index]="index" />
            </ng-template>
          </erp-scroll-viewport>
        </div>
      } @else {
        <!-- Tryb BULK -->
        <erp-multimedia-bulk-panel [count]="_selectionCount()" />
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
    }

    .erp-multimedia-tab__empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--tui-text-secondary);
      font-size: 1.125rem;
    }

    .erp-multimedia-tab__single {
      overflow-y: auto;
    }

    .erp-multimedia-tab__multi {
      flex: 1;
      height: 100%;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultimediaTabComponent {
  private readonly store = inject(ProductListViewStore);
  private readonly multimediaOrchestrator = inject(CatalogMultimediaOrchestrator);

  protected readonly MAX_DETAILED_SELECTION = MAX_DETAILED_SELECTION;
  protected readonly PRODUCT_KEYS = PRODUCT_KEYS;
  
  protected readonly _selectedProducts = computed(() => this.store.selection()?.selectedItems || []);
  protected readonly _selectionCount = computed(() => this._selectedProducts().length);

  // Zbiór UUID dla których już wywołaliśmy ładowanie
  private readonly loadedProductUuids = new Set<string>();

  protected readonly scrollConfig = new ErpScrollViewportBuilder<ProductVM>()
    .setItems(this._selectedProducts)
    .setGetItemKey((_, item: ProductVM) => item.uuid)
    .setEstimateSize(250)
    .setOverscan(2)
    .setOnRangeChange((range) => {
      // Lazy-load: ładuj multimedia tylko dla nowo widocznych grup
      const uuidsToLoad = range.visibleKeys.filter((uuid: string) => !this.loadedProductUuids.has(uuid));

      if (uuidsToLoad.length > 0) {
        for (const uuid of uuidsToLoad) {
          this.loadedProductUuids.add(uuid);
        }
        // Request batch load for the new uuids
        this.multimediaOrchestrator.loadByProductUuids(uuidsToLoad);
      }
    })
    .build();
}
