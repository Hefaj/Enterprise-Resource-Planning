import { ChangeDetectionStrategy, Component, input, output, computed } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { ErpDynamicFilterConfig } from './erp-dynamic-filter.types';
import { ErpButtonComponent, ErpButtonBuilder } from '../../atoms/erp-button';

import { ErpDynamicFilterBuilder } from './erp-dynamic-filter.builder';
import { unwrapSignal } from '../../base/erp-signal-utils';

export { ErpDynamicFilterBuilder };

@Component({
  selector: 'erp-dynamic-filter',
  standalone: true,
  imports: [CommonModule, ErpButtonComponent],
  template: `
    <div class="flex flex-col gap-6">
      @for (item of items(); track $index) {
        <div class="flex flex-col gap-2">
          @if (item.resolvedLabel) {
            <label class="text-sm font-medium text-surface-700 dark:text-surface-300">{{ item.resolvedLabel }}</label>
          }
          <ng-container *ngComponentOutlet="item.component; inputs: item.inputs" />
        </div>
      }

      @if (showSubmitButton()) {
        <div class="mt-4 pt-6 border-t border-surface-100 dark:border-surface-800">
          <erp-button
            [config]="submitBtnConfig()"
            class="w-full"
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

  protected items = computed(() => {
    const rawItems = unwrapSignal(this.config().items) ?? [];
    return rawItems.map((item) => ({
      ...item,
      resolvedLabel: unwrapSignal(item.label),
    }));
  });

  protected showSubmitButton = computed(() => unwrapSignal(this.config().showSubmitButton) !== false);

  protected submitBtnConfig = computed(() =>
    ErpButtonBuilder.create((b) =>
      b
        .setLabel(unwrapSignal(this.config().submitButtonLabel) || 'Filtruj')
        .setSeverity('info')
        .setOnClick(() => this.onSubmit()),
    ),
  );

  protected onSubmit(): void {
    this.filterSubmit.emit();
  }
}
