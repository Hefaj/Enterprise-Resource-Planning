import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  effect,
  ElementRef,
  input,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { injectVirtualizer } from '@tanstack/angular-virtual';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpScrollViewportConfig, ErpVisibleRange } from './erp-scroll-viewport.types';

/**
 * Generyczny komponent wirtualizacji list oparty na TanStack Virtual.
 *
 * Renderuje wirtualizowaną listę elementów o zmiennej wysokości.
 * Elementy są dynamicznie mierzone po wyrenderowaniu (ResizeObserver).
 * Emituje callback `onRangeChange` przy zmianie widocznego zakresu,
 * co pozwala na lazy-loading danych (np. multimediów per grupa).
 *
 * @example
 * ```html
 * <erp-scroll-viewport [config]="scrollConfig">
 *   <ng-template #erpScrollItem let-item let-index="index" let-measureFn="measureElement">
 *     <div #virtualItem>
 *       <erp-group-card [config]="buildCardConfig(item)" />
 *     </div>
 *   </ng-template>
 * </erp-scroll-viewport>
 * ```
 */
@Component({
  selector: 'erp-scroll-viewport',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    <div #scrollElement class="erp-scroll-viewport">
      <div
        [style.height.px]="virtualizer.getTotalSize()"
        class="erp-scroll-viewport__content"
      >
        @for (row of virtualizer.getVirtualItems(); track row.key) {
          <div
            [attr.data-index]="row.index"
            [style.position]="'absolute'"
            [style.top.px]="row.start"
            [style.width]="'100%'"
          >
            <ng-container
              [ngTemplateOutlet]="itemTemplate()!"
              [ngTemplateOutletContext]="{
                $implicit: _items()[row.index],
                index: row.index,
                measureElement: virtualizer.measureElement
              }"
            />
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      min-height: 0;
    }

    .erp-scroll-viewport {
      overflow-y: auto;
      height: 100%;
      contain: strict;
    }

    .erp-scroll-viewport__content {
      width: 100%;
      position: relative;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpScrollViewportComponent<TItem = any> {
  /** Konfiguracja komponentu (z buildera lub obiektu). */
  public readonly config = input.required<ErpScrollViewportConfig<TItem>>();

  /** Referencja do elementu scrollowalnego. */
  private readonly scrollElement = viewChild<ElementRef<HTMLDivElement>>('scrollElement');

  /** Template item przekazany przez content projection. */
  protected readonly itemTemplate = contentChild.required<TemplateRef<any>>('erpScrollItem');

  /** Rozpakowana lista elementów z config. */
  protected readonly _items = computed(() => unwrapSignal(this.config().items) ?? []);

  /** Rozpakowany estimateSize z config. */
  private readonly _estimateSize = computed(() => unwrapSignal(this.config().estimateSize) ?? 200);

  /** Rozpakowany overscan z config. */
  private readonly _overscan = computed(() => unwrapSignal(this.config().overscan) ?? 3);

  /** Rozpakowany paddingStart z config. */
  private readonly _paddingStart = computed(() => unwrapSignal(this.config().paddingStart) ?? 0);

  /** Rozpakowany paddingEnd z config. */
  private readonly _paddingEnd = computed(() => unwrapSignal(this.config().paddingEnd) ?? 0);

  /** Instancja TanStack Virtual virtualizer. */
  protected readonly virtualizer = injectVirtualizer(() => ({
    count: this._items().length,
    scrollElement: this.scrollElement()?.nativeElement,
    estimateSize: () => this._estimateSize(),
    overscan: this._overscan(),
    paddingStart: this._paddingStart(),
    paddingEnd: this._paddingEnd(),
    getItemKey: (index: number) => {
      const items = this._items();
      const keyFn = this.config().getItemKey;
      if (keyFn && items[index]) {
        return keyFn(index, items[index]);
      }
      return index;
    },
    onChange: (instance: any) => {
      const onRangeChange = this.config().onRangeChange;
      if (!onRangeChange) return;

      const virtualItems = instance.getVirtualItems();
      if (virtualItems.length === 0) return;

      const items = this._items();
      const keyFn = this.config().getItemKey;
      const startIndex = virtualItems[0].index;
      const endIndex = virtualItems[virtualItems.length - 1].index;
      const visibleKeys: string[] = [];

      for (const vItem of virtualItems) {
        if (keyFn && items[vItem.index]) {
          visibleKeys.push(keyFn(vItem.index, items[vItem.index]));
        }
      }

      const range: ErpVisibleRange = { startIndex, endIndex, visibleKeys };
      onRangeChange(range);
    },
  }));

  constructor() {
    // Resetuj scroll na górę gdy lista elementów się zmieni (np. zmiana zaznaczenia)
    effect(() => {
      // Odczytaj items aby zarejestrować dependency
      this._items();
      const el = this.scrollElement()?.nativeElement;
      if (el) {
        el.scrollTop = 0;
      }
    });
  }
}
