import { ChangeDetectionStrategy, Component, input, computed, signal, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { ErpTabsConfig } from './erp-tabs.types';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { TranslocoModule } from '@jsverse/transloco';
import { provideSharedTranslations, SHARED_KEYS } from '../../translation';

@Component({
  selector: 'erp-tabs',
  standalone: true,
  imports: [CommonModule, TabsModule, TranslocoModule],
  providers: [provideSharedTranslations()],
  template: `
    @let _value = activeValue();
    @let _items = unwrappedItems();
    @let activeTab = getActiveTab(_items, _value);

    <div class="flex flex-col h-full">
      @if (_items.length > 0) {
        <p-tabs [value]="_value" (valueChange)="handleValueChange($event)">
          <p-tablist>
            @for (item of _items; track item.value) {
              <p-tab [value]="item.value" [disabled]="item.disabled">
                <div class="flex items-center gap-2">
                  @if (item.icon) {
                    <i [class]="item.icon"></i>
                  }
                  <span>{{ item.label | transloco }}</span>
                </div>
              </p-tab>
            }
          </p-tablist>
        </p-tabs>

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
               <i class="pi pi-ban text-4xl mb-2"></i>
               <span class="font-medium">{{ SHARED_KEYS.tabs.noAvailable | transloco }}</span>
            </div>
          }
        </div>
      } @else {
        <div class="flex flex-col items-center justify-center h-full opacity-30 p-12">
           <i class="pi pi-inbox text-4xl mb-2"></i>
           <span>{{ SHARED_KEYS.tabs.empty | transloco }}</span>
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
    
    // Fallback: first enabled tab
    const firstEnabled = items.find(i => !i.disabled);
    return firstEnabled?.value;
  });

  constructor() {
    effect(() => {
      const active = this.activeValue();
      const internal = this.internalValue();
      
      // Synchronize internal state and trigger callback if forced to change
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

  protected handleValueChange(newValue: any): void {
    this.internalValue.set(newValue);
    if (this.config().onTabChange) {
      this.config().onTabChange!(newValue);
    }
  }
}
