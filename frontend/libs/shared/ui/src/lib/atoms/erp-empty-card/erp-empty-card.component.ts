import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpEmptyCardBuilder } from './erp-empty-card.builder';

export { ErpEmptyCardBuilder };

export interface ErpEmptyCardConfig {
  icon?: string;
  title?: string;
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
      class="h-full flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 text-slate-400 select-none"
    >
      <div class="size-10 p-4 bg-white rounded-full shadow-sm flex items-center justify-center">
        <i [class]="_config?.icon || 'pi pi-box'"></i>
      </div>

      <h3 class="font-semibold text-slate-600 mt-2">{{ _config?.title || 'Brak zawartości' }}</h3>
      <p class="text-sm text-center max-w-50 mt-1">
        {{ _config?.description || 'To miejsce czeka na Twoje dane. Przekaż komponent, aby go wypełnić.' }}
      </p>

      @if (_config?.showPulse !== false) {
        <div class="mt-4 flex gap-2">
          <div class="w-2 h-2 rounded-full bg-slate-500 animate-pulse"></div>
          <div class="w-2 h-2 rounded-full bg-slate-500 animate-pulse delay-50"></div>
          <div class="w-2 h-2 rounded-full bg-slate-500 animate-pulse delay-100"></div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpEmptyCardComponent {
  public config = input<ErpEmptyCardConfig>();
}
