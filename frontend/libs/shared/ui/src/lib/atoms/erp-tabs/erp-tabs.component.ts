import { ChangeDetectionStrategy, Component, input, computed, signal, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiTabs } from '@taiga-ui/kit';
import { ErpTabsConfig } from './erp-tabs.types';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { provideSharedTranslations, SHARED_KEYS } from '../../translation';

@Component({
  selector: 'erp-tabs',
  standalone: true,
  imports: [CommonModule, TuiTabs, ErpTranslatePipe],
  template: `
    @let _value = activeValue();
    @let _items = unwrappedItems();
    @let activeTab = getActiveTab(_items, _value);
    @let _activeIndex = activeIndex();

    <div class="flex flex-col h-full">
      @if (_items.length > 0) {
        <tui-tabs
          [activeItemIndex]="_activeIndex"
          (activeItemIndexChange)="handleIndexChange($event, _items)"
        >
          @for (item of _items; track item.value) {
            <button
              tuiTab
              [disabled]="item.disabled"
            >
              <div class="flex items-center gap-2">
                @if (item.icon) {
                  <i [class]="item.icon"></i>
                }
                <span>{{ item.label | erpTranslate }}</span>
              </div>
            </button>
          }
        </tui-tabs>

        <div class="flex-1 mt-4 flex flex-col min-h-0">
          @for (item of _items; track item.value) {
            @if (item.value === _value && item.component) {
              <div class="tab-content-animate flex-1 min-h-0">
                <ng-container 
                  *ngComponentOutlet="item.component; inputs: item.config" 
                />
              </div>
            }
          }
          @if (!activeTab) {
            <div class="flex flex-col items-center justify-center h-full opacity-50 grayscale p-12">
               <span class="font-medium">{{ SHARED_KEYS.tabs.noAvailable | erpTranslate }}</span>
            </div>
          }
        </div>
      } @else {
        <div class="flex flex-col items-center justify-center h-full opacity-30 p-12">
           <span>{{ SHARED_KEYS.tabs.empty | erpTranslate }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    @keyframes tabFadeIn {
      0% {
        opacity: 0;
        transform: translateY(4px);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .tab-content-animate {
      animation: tabFadeIn 0.2s cubic-bezier(0, 0, 0.2, 1) forwards;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpTabsComponent {
  protected readonly SHARED_KEYS = SHARED_KEYS;

  public config = input.required<ErpTabsConfig>();

  protected internalValue = signal<string | number | undefined>(undefined);

  protected unwrappedItems = computed(() => {
    const rawItems = unwrapSignal(this.config().items) || [];
    return rawItems.map(item => ({
      ...item,
      label: unwrapSignal(item.label),
      value: unwrapSignal(item.value),
      icon: unwrapSignal(item.icon),
      disabled: unwrapSignal(item.disabled),
      component: unwrapSignal(item.component),
      config: unwrapSignal(item.config)
    }));
  });

  protected activeValue = computed(() => {
    const items = this.unwrappedItems();
    const currentVal = this.internalValue() ?? unwrapSignal(this.config().initialValue);
    
    const activeTab = items.find(i => i.value === currentVal);
    
    if (activeTab && !activeTab.disabled) {
      return currentVal;
    }
    
    const firstEnabled = items.find(i => !i.disabled);
    return firstEnabled?.value;
  });

  protected activeIndex = computed(() => {
    const items = this.unwrappedItems();
    const val = this.activeValue();
    return items.findIndex(item => item.value === val);
  });

  constructor() {
    effect(() => {
      const active = this.activeValue();
      const internal = this.internalValue();
      
      if (active !== internal) {
        untracked(() => {
          this.handleValueChange(active);
        });
      }
    });
  }

  protected getActiveTab(items: any[], activeVal: any): any | undefined {
    return items.find(i => i.value === activeVal);
  }

  protected handleIndexChange(index: number, items: any[]): void {
    const targetItem = items[index];
    if (targetItem && !targetItem.disabled) {
      this.handleValueChange(targetItem.value);
    }
  }

  protected handleValueChange(newValue: any): void {
    this.internalValue.set(newValue);
    if (this.config().onTabChange) {
      this.config().onTabChange!(newValue);
    }
  }
}

