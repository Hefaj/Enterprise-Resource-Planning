import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { ErpTabsBuilder } from './erp-tabs.builder';

import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { Type } from '@angular/core';

export { ErpTabsBuilder };

export interface ErpTabItem<TComp = any> {
  label: string;
  value: string | number;
  icon?: string;
  disabled?: boolean;
  component?: Type<TComp>;
  config?: ErpComponentSignalInputs<TComp> | any;
}

export interface ErpTabsConfig {
  items: ErpTabItem[];
  initialValue?: string | number;
  onTabChange?: (value: string | number) => void;
  headless?: boolean;
}

@Component({
  selector: 'erp-tabs',
  standalone: true,
  imports: [CommonModule, TabsModule],
  template: `
    @let _config = config();
    @let _value = value();
    @let _headless = headless() ?? _config.headless;
    @let activeTab = getActiveTab(_config, _value);

    <div class="flex flex-col h-full">
      <p-tabs [value]="_value" (valueChange)="handleValueChange($event)">
        <p-tablist>
          @for (item of _config.items; track item.value) {
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
  public headless = input<boolean>();

  protected getActiveTab(config: ErpTabsConfig, value: any): ErpTabItem | undefined {
    const val = value ?? config.initialValue;
    return config.items.find(i => i.value === val);
  }

  protected handleValueChange(newValue: any): void {
    this.value.set(newValue);
    if (this.config().onTabChange) {
      this.config().onTabChange!(newValue);
    }
  }
}
