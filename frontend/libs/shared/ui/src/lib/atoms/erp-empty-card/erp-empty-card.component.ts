import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpEmptyCardBuilder } from './erp-empty-card.builder';

export { ErpEmptyCardBuilder };

export interface ErpEmptyCardConfig {
  icon?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  showPulse?: boolean;
}

@Component({
  selector: 'erp-empty-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    @let _config = config();
    <div
      class="h-full flex flex-col items-center justify-center p-8 border-2 border-dashed border-surface-200 dark:border-surface-800 rounded-2xl bg-surface-50/50 dark:bg-surface-950/50 text-surface-400 dark:text-surface-600 select-none"
    >
      <div class="size-12 p-4 bg-surface-0 dark:bg-surface-900 rounded-2xl shadow-sm border border-surface-100 dark:border-surface-800 flex items-center justify-center text-primary-500 dark:text-primary-400">
        <i [class]="(_config?.icon || 'pi pi-box') + ' text-xl'"></i>
      </div>
 
      <h3 class="font-bold text-surface-700 dark:text-surface-100 mt-4 text-lg">{{ _config?.title || 'Brak zawartości' }}</h3>
      @if (_config?.subtitle) {
        <p class="text-sm text-surface-500 dark:text-surface-400 font-semibold tracking-wide uppercase mt-1">{{ _config?.subtitle }}</p>
      }
      <p class="text-sm text-center max-w-sm mt-2 text-surface-500 dark:text-surface-500 italic">
        {{ _config?.description || 'To miejsce czeka na Twoje dane. Przekaż komponent, aby go wypełnić.' }}
      </p>
 
      @if (_config?.showPulse !== false) {
        <div class="mt-6 flex gap-3">
          <div class="w-2 h-2 rounded-full bg-primary-400/50 dark:bg-primary-500/30 animate-pulse"></div>
          <div class="w-2 h-2 rounded-full bg-primary-400/50 dark:bg-primary-500/30 animate-pulse delay-75"></div>
          <div class="w-2 h-2 rounded-full bg-primary-400/50 dark:bg-primary-500/30 animate-pulse delay-150"></div>
        </div>
      }
 
      <div class="w-full mt-8">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpEmptyCardComponent {
  public config = input<ErpEmptyCardConfig>();
}
