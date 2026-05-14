import { ChangeDetectionStrategy, Component, input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { ErpTabsConfig } from './erp-tabs.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-tabs',
  standalone: true,
  imports: [CommonModule, TabsModule],
  template: `
    @let _value = activeValue();
    @let _items = unwrappedItems();
    @let activeTab = getActiveTab(_items, _value);

    <div class="flex flex-col h-full">
      <p-tabs [value]="_value" (valueChange)="handleValueChange($event)">
        <p-tablist>
          @for (item of _items; track item.value) {
            <p-tab [value]="item.value" [disabled]="item.disabled">
              <div class="flex items-center gap-2">
                @if (item.icon) {
                  <i [class]="item.icon"></i>
                }
                <span>{{ item.label }}</span>
              </div>
            </p-tab>
          }
        </p-tablist>
      </p-tabs>

      <div class="flex-1 mt-4">
        @if (activeTab?.component) {
          <ng-container 
            *ngComponentOutlet="activeTab!.component!; inputs: activeTab!.config" 
          />
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpTabsComponent {
  public config = input.required<ErpTabsConfig>();

  protected internalValue = signal<string | number | undefined>(undefined);

  protected unwrappedItems = computed(() => {
    return this.config().items.map(item => ({
      ...item,
      label: unwrapSignal(item.label),
      icon: unwrapSignal(item.icon),
      disabled: unwrapSignal(item.disabled)
    }));
  });

  protected activeValue = computed(() => {
    return this.internalValue() ?? this.config().initialValue;
  });

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
