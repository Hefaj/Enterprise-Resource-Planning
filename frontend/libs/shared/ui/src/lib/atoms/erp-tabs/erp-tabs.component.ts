import { ChangeDetectionStrategy, Component, input, model, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { ErpTabsConfig, ErpTabItem } from './erp-tabs.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-tabs',
  standalone: true,
  imports: [CommonModule, TabsModule],
  template: `
    @let _config = config();
    @let _value = value();
    @let _headless = isHeadless();
    @let _items = unwrappedItems();
    @let activeTab = getActiveTab(_items, _value, _config.initialValue);

    <div class="flex flex-col h-full">
      <p-tabs [value]="_value || _config.initialValue" (valueChange)="handleValueChange($event)">
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

      <!-- Tab Content Area -->
      @if (!_headless) {
        <div class="flex-1 mt-4">
          @if (activeTab?.component) {
            <ng-container 
              *ngComponentOutlet="activeTab!.component!; inputs: activeTab!.config" 
            />
          }
          <ng-content></ng-content>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpTabsComponent {
  public config = input.required<ErpTabsConfig>();
  public value = model<string | number | undefined>();
  public headlessInput = input<boolean | undefined>(undefined, { alias: 'headless' });

  protected isHeadless = computed(() => {
    const fromInput = this.headlessInput();
    if (fromInput !== undefined) return fromInput;
    return unwrapSignal(this.config().headless);
  });

  protected unwrappedItems = computed(() => {
    return this.config().items.map(item => ({
      ...item,
      label: unwrapSignal(item.label),
      icon: unwrapSignal(item.icon),
      disabled: unwrapSignal(item.disabled)
    }));
  });

  protected getActiveTab(items: any[], value: any, initialValue: any): any | undefined {
    const val = value ?? initialValue;
    return items.find(i => i.value === val);
  }

  protected handleValueChange(newValue: any): void {
    this.value.set(newValue);
    if (this.config().onTabChange) {
      this.config().onTabChange!(newValue);
    }
  }
}
