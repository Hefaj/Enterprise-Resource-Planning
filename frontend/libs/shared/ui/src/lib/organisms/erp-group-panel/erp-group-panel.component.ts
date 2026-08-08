import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  input,
  TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TuiIcon } from '@taiga-ui/core';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import {
  ErpActionToolbarComponent,
  ErpActionToolbarZoneDirective,
  ErpActionToolbarContextDirective,
} from '../../molecules/erp-action-toolbar';
import { ErpScrollViewportComponent } from '../../atoms/erp-scroll-viewport';
import { ErpScrollViewportConfig } from '../../atoms/erp-scroll-viewport/erp-scroll-viewport.types';
import { ErpGroupPanelConfig } from './erp-group-panel.types';

/**
 * ErpGroupPanel — reużywalna kompozycja paska akcji (ErpActionToolbar) i wirtualizowanej
 * listy grup (ErpScrollViewport), ze wspólnymi stanami "pusto" i "przepełnienie".
 *
 * Treść pojedynczej grupy (np. siatka multimediów, tabela) dostarcza wywołujący
 * przez content-projected template — dokładnie ten sam kontrakt co `erp-scroll-viewport`.
 *
 * @example
 * ```html
 * <erp-group-panel [config]="panelConfig">
 *   <ng-template #erpGroupItem let-item let-index="index" let-measureElement="measureElement">
 *     <erp-multimedia-group [product]="item" [measureElement]="measureElement" [attr.data-index]="index" />
 *   </ng-template>
 * </erp-group-panel>
 * ```
 */
@Component({
  selector: 'erp-group-panel',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    TuiIcon,
    ErpTranslatePipe,
    ErpActionToolbarComponent,
    ErpActionToolbarZoneDirective,
    ErpActionToolbarContextDirective,
    ErpScrollViewportComponent,
  ],
  template: `
    <div
      class="erp-group-panel"
      erpActionToolbarZone
      [erpActionToolbarContext]="config().toolbar"
    >
      @if (_isEmpty()) {
        <div class="erp-group-panel__state">
          @if (_emptyIcon()) {
            <tui-icon [icon]="_emptyIcon()!" class="erp-group-panel__state-icon" />
          }
          <p>{{ (_emptyMessage() | erpTranslate) || '' }}</p>
        </div>
      } @else {
        <erp-action-toolbar [config]="config().toolbar" />

        <div class="erp-group-panel__body">
          @if (_isOverflow()) {
            <div class="erp-group-panel__state">
              @if (_overflowIcon()) {
                <tui-icon [icon]="_overflowIcon()!" class="erp-group-panel__state-icon" />
              }
              <p>{{ (_overflowMessage() | erpTranslate) || '' }}</p>
            </div>
          } @else {
            <erp-scroll-viewport [config]="_scrollConfig()">
              <ng-template #erpScrollItem let-item let-index="index" let-measureElement="measureElement">
                <ng-container
                  [ngTemplateOutlet]="itemTemplate()"
                  [ngTemplateOutletContext]="{ $implicit: item, index: index, measureElement: measureElement }"
                />
              </ng-template>
            </erp-scroll-viewport>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      min-height: 0;
    }

    .erp-group-panel {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      height: 100%;
      min-height: 0;
    }

    .erp-group-panel__body {
      flex: 1;
      overflow: hidden;
      min-height: 0;
    }

    .erp-group-panel__state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      height: 100%;
      text-align: center;
      padding: 2rem;
      color: var(--tui-text-secondary);
    }

    .erp-group-panel__state-icon {
      font-size: 3rem;
    }

    .erp-group-panel__state p {
      margin: 0;
      line-height: 1.5;
      max-width: 32rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpGroupPanelComponent<TItem = any> {
  /** Konfiguracja komponentu (z buildera lub obiektu). */
  public readonly config = input.required<ErpGroupPanelConfig<TItem>>();

  /** Template pojedynczej grupy przekazany przez content projection. */
  protected readonly itemTemplate = contentChild.required<TemplateRef<any>>('erpGroupItem');

  /** Rozpakowana lista elementów z config. */
  protected readonly _items = computed(() => unwrapSignal(this.config().items) ?? []);

  protected readonly _isEmpty = computed(() => this._items().length === 0);

  protected readonly _isOverflow = computed(() => {
    const overflow = this.config().overflow;
    return !!overflow && this._items().length > overflow.threshold;
  });

  protected readonly _emptyIcon = computed(() => unwrapSignal(this.config().emptyState?.icon));
  protected readonly _emptyMessage = computed(() => unwrapSignal(this.config().emptyState?.message));

  protected readonly _overflowIcon = computed(() => unwrapSignal(this.config().overflow?.icon));
  protected readonly _overflowMessage = computed(() => unwrapSignal(this.config().overflow?.message));

  /** Konfiguracja przekazywana do wewnętrznego erp-scroll-viewport. */
  protected readonly _scrollConfig = computed<ErpScrollViewportConfig<TItem>>(() => {
    const config = this.config();
    return {
      items: config.items,
      getItemKey: config.getItemKey,
      estimateSize: config.estimateSize,
      overscan: config.overscan,
      onRangeChange: config.onRangeChange,
      paddingStart: config.paddingStart,
      paddingEnd: config.paddingEnd,
    };
  });
}
