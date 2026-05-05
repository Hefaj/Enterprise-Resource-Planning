import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { ErpTabsBuilder } from './erp-tabs.builder';

export { ErpTabsBuilder };

export interface ErpTabItem {
  label: string;
  value: string | number;
  icon?: string;
  disabled?: boolean;
}

export interface ErpTabsConfig {
  items: ErpTabItem[];
}

@Component({
  selector: 'erp-tabs',
  standalone: true,
  imports: [CommonModule, TabsModule],
  template: `
    @let _config = config();
    @let _value = value();

    <p-tabs [value]="_value" (valueChange)="value.set($event)">
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpTabsComponent {
  public config = input.required<ErpTabsConfig>();
  public value = model<string | number | undefined>();
}
