import { ChangeDetectionStrategy, Component, input, output, computed } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { ErpDynamicFilterConfig } from './erp-dynamic-filter.types';
import { ErpButtonComponent, ErpButtonBuilder } from '../../atoms/erp-button';

import { ErpDynamicFilterBuilder } from './erp-dynamic-filter.builder';

export { ErpDynamicFilterBuilder };

@Component({
  selector: 'erp-dynamic-filter',
  standalone: true,
  imports: [CommonModule, ErpButtonComponent],
  template: `
    <div class="flex flex-col gap-6">
      @for (item of config().items; track $index) {
        <div class="flex flex-col gap-2">
          @if (item.label) {
            <label class="text-sm font-medium text-surface-700 dark:text-surface-300">{{ item.label }}</label>
          }
          <ng-container *ngComponentOutlet="item.component; inputs: item.inputs" />
        </div>
      }

      @if (config().showSubmitButton !== false) {
        <div class="mt-4 pt-6 border-t border-surface-100 dark:border-surface-800">
          <erp-button
            [config]="submitBtnConfig()"
            class="w-full"
            (onClick)="onSubmit()"
          />
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpDynamicFilterComponent {
  public config = input.required<ErpDynamicFilterConfig>();
  public filterSubmit = output<void>();

  protected submitBtnConfig = computed(() => ErpButtonBuilder.create((b) => b.setLabel(this.config().submitButtonLabel || 'Filtruj').setSeverity('info')));

  protected onSubmit(): void {
    this.filterSubmit.emit();
  }
}
