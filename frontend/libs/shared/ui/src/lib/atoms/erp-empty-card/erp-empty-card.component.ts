import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpEmptyCardConfig } from './erp-empty-card.types';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { TranslocoModule } from '@jsverse/transloco';
import { provideSharedTranslations, SHARED_KEYS } from '../../translation';

@Component({
  selector: 'erp-empty-card',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  template: `
    @let _icon = icon();
    @let _title = title();
    @let _subtitle = subtitle();
    @let _description = description();
    @let _showPulse = showPulse();

    <div
      class="h-full flex flex-col items-center justify-center p-8 border-2 border-dashed border-surface-200 dark:border-surface-800 rounded-2xl bg-surface-50/50 dark:bg-surface-950/50 text-surface-400 dark:text-surface-600 select-none"
    >
      <div
        class="size-12 p-4 bg-surface-0 dark:bg-surface-900 rounded-2xl shadow-sm border border-surface-100 dark:border-surface-800 flex items-center justify-center text-primary-500 dark:text-primary-400"
      >
        <i [class]="(_icon || 'pi pi-box') + ' text-xl'"></i>
      </div>

      <h3 class="font-bold text-surface-700 dark:text-surface-100 mt-4 text-lg">
        {{ _title ? (_title | transloco) : (SHARED_KEYS.emptyCard.empty | transloco) }}
      </h3>
      @if (_subtitle) {
        <p class="text-sm text-surface-500 dark:text-surface-400 font-semibold tracking-wide uppercase mt-1">
          {{ _subtitle | transloco }}
        </p>
      }
      <p class="text-sm text-center max-w-sm mt-2 text-surface-500 dark:text-surface-500 italic">
        {{ _description ? (_description | transloco) : (SHARED_KEYS.emptyCard.description | transloco) }}
      </p>

      @if (_showPulse !== false) {
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
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class ErpEmptyCardComponent {
  protected readonly SHARED_KEYS = SHARED_KEYS;

  public config = input<ErpEmptyCardConfig>({});

  protected icon = computed(() => unwrapSignal(this.config().icon));
  protected title = computed(() => unwrapSignal(this.config().title));
  protected subtitle = computed(() => unwrapSignal(this.config().subtitle));
  protected description = computed(() => unwrapSignal(this.config().description));
  protected showPulse = computed(() => unwrapSignal(this.config().showPulse));
}
